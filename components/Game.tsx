"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Game.module.css";

const W = 360;
const H = 640;
const GRASS_TOP = H - 130;
const DIRT_TOP = H - 58;
const DUCK_W = 48;
const DUCK_H = 66;
const SHOTS_PER_DUCK = 3;
const MAX_ESCAPES = 3;
const HIT_RADIUS = 42;

type Phase = "menu" | "wave" | "flying" | "falling" | "caught" | "escaped" | "poster" | "over";

const IMG_SRC = {
  fly: "/sprites/fly.webp",
  flyup: "/sprites/flyup.webp",
  fall: "/sprites/fall.webp",
  boom: "/sprites/boom.webp",
  clouds: "/sprites/clouds.webp",
} as const;

// Gato pixel-art (16x13) que sale del pasto a atrapar al facho
const CAT_MAP = [
  ".O............O.",
  ".OO..........OO.",
  ".OPO........OPO.",
  ".OOOOOOOOOOOOOO.",
  ".ODOOOOOOOOOODO.",
  ".OWWOOOOOOOOWWO.",
  ".OWBOOOOOOOOBWO.",
  ".OOOOOOPPOOOOOO.",
  ".OOOOOPPPPOOOOO.",
  ".OOOOBOOOOBOOOO.",
  ".OOOOOBBBBOOOOO.",
  "..OOOOOOOOOOOO..",
  "..OO..OOOO..OO..",
];

const CAT_COLORS: Record<string, string> = {
  O: "#e8923a",
  D: "#b5651d",
  W: "#ffffff",
  B: "#1a1a1a",
  P: "#ff9eb5",
};

function makeCatSprite(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = CAT_MAP.length;
  const g = c.getContext("2d")!;
  CAT_MAP.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = CAT_COLORS[row[x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

// Frailejón (Espeletia) procedural: roseta de hojas plateadas, flores
// amarillas y tronco grueso con hojas secas. Reemplaza al árbol del Duck Hunt.
const FJ_W = 48;
const FJ_H = 72;

function makeFrailejonSprite(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = FJ_W;
  c.height = FJ_H;
  const g = c.getContext("2d")!;
  const cx = FJ_W / 2;
  const cy = 22;

  const trunkW = 12;
  const trunkTop = cy + 2;
  for (let y = trunkTop; y < FJ_H; y++) {
    const x0 = Math.round(cx - trunkW / 2);
    for (let x = x0; x < x0 + trunkW; x++) {
      const r = Math.random();
      g.fillStyle = r < 0.14 ? "#5d3c20" : r < 0.34 ? "#8a6a3c" : "#6e4a2a";
      g.fillRect(x, y, 1, 1);
    }
  }
  for (let y = trunkTop + 3; y < FJ_H; y += 3) {
    g.fillStyle = "rgba(35, 20, 8, 0.45)";
    g.fillRect(Math.round(cx - trunkW / 2), y, trunkW, 1);
  }

  for (let i = -2; i <= 2; i++) {
    const lx = cx + i * 4.5;
    g.fillStyle = i % 2 ? "#9c7a45" : "#86653a";
    g.beginPath();
    g.moveTo(lx - 2.5, trunkTop + 1);
    g.lineTo(lx + 2.5, trunkTop + 1);
    g.lineTo(lx, trunkTop + 8 + Math.random() * 5);
    g.closePath();
    g.fill();
  }

  const leaves = 17;
  const shades = ["#cdd9a8", "#aec57f", "#93ab68", "#bccf92"];
  for (let i = 0; i < leaves; i++) {
    const ang = (i / leaves) * Math.PI * 2 + Math.random() * 0.25;
    const len = 14 + Math.random() * 7;
    const dy = Math.sin(ang) * (Math.sin(ang) > 0 ? 0.4 : 0.85);
    const ex = cx + Math.cos(ang) * len;
    const ey = cy + dy * len;
    const px = -Math.sin(ang) * 1.8;
    const py = Math.cos(ang) * 1.8;
    g.fillStyle = shades[i % shades.length];
    g.beginPath();
    g.moveTo(cx + px, cy + py);
    g.lineTo(cx - px, cy - py);
    g.lineTo(ex, ey);
    g.closePath();
    g.fill();
  }

  g.fillStyle = "#dde6bd";
  g.beginPath();
  g.arc(cx, cy, 4.2, 0, Math.PI * 2);
  g.fill();

  const flowers = 3;
  for (let i = 0; i < flowers; i++) {
    const fx = cx + (i - (flowers - 1) / 2) * 9 + (Math.random() - 0.5) * 4;
    const fy = cy - 12 - Math.random() * 7;
    g.strokeStyle = "#76914e";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(cx + (fx - cx) * 0.25, cy - 2);
    g.quadraticCurveTo(fx, (cy + fy) / 2, fx, fy);
    g.stroke();
    g.fillStyle = "#ffd23f";
    for (let p = 0; p < 6; p++) {
      const pa = (p / 6) * Math.PI * 2;
      g.fillRect(fx + Math.cos(pa) * 2.6 - 1, fy + Math.sin(pa) * 2.6 - 1, 2.2, 2.2);
    }
    g.fillStyle = "#d98e04";
    g.fillRect(fx - 1.4, fy - 1.4, 2.8, 2.8);
  }

  return c;
}

function pseudo(j: number): number {
  const v = Math.sin(j * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<Phase>("menu");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [wave, setWave] = useState(1);
  const [shots, setShots] = useState(SHOTS_PER_DUCK);
  const [escapes, setEscapes] = useState(0);
  const [gameOverVisible, setGameOverVisible] = useState(false);
  const [posterBreak, setPosterBreak] = useState(false);

  const phaseRef = useRef<Phase>("menu");
  const apiRef = useRef<{ startGame: () => void; resume: () => void } | null>(null);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("dhf-best") || 0));
    } catch {}
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgs = {} as Record<keyof typeof IMG_SRC, HTMLImageElement>;
    (Object.keys(IMG_SRC) as (keyof typeof IMG_SRC)[]).forEach((k) => {
      const im = new Image();
      im.src = IMG_SRC[k];
      imgs[k] = im;
    });
    const catSprite = makeCatSprite();
    const fjSprite = makeFrailejonSprite();
    const fjSmall = makeFrailejonSprite();

    const music = new Audio("/sprites/music.ogg");
    music.loop = true;
    music.volume = 0.35;
    const shotSfx = new Audio("/sprites/flap.mp3");
    shotSfx.volume = 0.6;
    const boomSfx = new Audio("/sprites/boom.mp3");
    boomSfx.volume = 0.7;

    const s = {
      score: 0,
      wave: 1,
      escapes: 0,
      kills: 0,
      shotsLeft: SHOTS_PER_DUCK,
      stateT: 0,
      duck: { x: W / 2, y: GRASS_TOP - 60, vx: 2, vy: -2, rot: 0 },
      dirT: 0,
      flyT: 0,
      escaping: false,
      boomX: 0,
      boomY: 0,
      boomT: 0,
      flashT: 0,
      catT: -1, // -1 inactivo; 0..1 animación
      cross: { x: W / 2, y: H / 2, visible: false },
      cloudX: 0,
    };

    function syncHud() {
      setScore(s.score);
      setWave(s.wave);
      setShots(s.shotsLeft);
      setEscapes(s.escapes);
    }

    function spawnDuck() {
      s.duck.x = 60 + Math.random() * (W - 120);
      s.duck.y = GRASS_TOP - 40;
      s.duck.vx = (Math.random() < 0.5 ? -1 : 1) * 2;
      s.duck.vy = -3;
      s.duck.rot = 0;
      s.dirT = 0;
      s.flyT = 0;
      s.escaping = false;
      s.shotsLeft = SHOTS_PER_DUCK;
      syncHud();
    }

    function startGame() {
      s.score = 0;
      s.wave = 1;
      s.escapes = 0;
      s.kills = 0;
      s.catT = -1;
      s.boomT = 0;
      setGameOverVisible(false);
      setPosterBreak(false);
      syncHud();
      music.play().catch(() => {});
      goWave();
    }
    apiRef.current = { startGame, resume: goWave };

    function goWave() {
      s.stateT = 0;
      setPhaseBoth("wave");
    }

    function duckSpeed() {
      return Math.min(5.6, 2.1 + s.wave * 0.35);
    }

    function newDirection() {
      const ang = -Math.PI * (0.1 + Math.random() * 0.8); // mayormente hacia arriba/lados
      const sp = duckSpeed();
      s.duck.vx = Math.cos(ang) * sp * (Math.random() < 0.5 ? -1 : 1);
      s.duck.vy = Math.sin(ang) * sp;
      s.dirT = 500 + Math.random() * 700;
    }

    function shoot(x: number, y: number) {
      if (phaseRef.current !== "flying" || s.shotsLeft <= 0) return;
      s.shotsLeft -= 1;
      s.flashT = 90;
      shotSfx.currentTime = 0;
      shotSfx.play().catch(() => {});
      const dx = x - s.duck.x;
      const dy = y - s.duck.y;
      if (Math.sqrt(dx * dx + dy * dy) <= HIT_RADIUS) {
        // ¡le diste!
        s.score += 100 * s.wave;
        s.boomX = s.duck.x;
        s.boomY = s.duck.y;
        s.boomT = 1;
        boomSfx.currentTime = 0;
        boomSfx.play().catch(() => {});
        s.duck.vy = -2;
        s.stateT = 0;
        setPhaseBoth("falling");
      } else if (s.shotsLeft <= 0) {
        // sin balas: el facho huye
        s.escaping = true;
      }
      syncHud();
    }

    function gameOver() {
      setPhaseBoth("over");
      setBest((b) => {
        const nb = Math.max(b, s.score);
        try {
          localStorage.setItem("dhf-best", String(nb));
        } catch {}
        return nb;
      });
      window.setTimeout(() => setGameOverVisible(true), 800);
    }

    function update(dt: number) {
      const n = Math.min(dt, 50) / 16.6667;
      s.stateT += dt;
      s.cloudX += 0.08 * n;
      if (s.flashT > 0) s.flashT = Math.max(0, s.flashT - dt);
      if (s.boomT > 0) s.boomT = Math.max(0, s.boomT - dt * 0.002);

      const ph = phaseRef.current;

      if (ph === "wave" && s.stateT > 1400) {
        spawnDuck();
        s.stateT = 0;
        setPhaseBoth("flying");
        return;
      }

      if (ph === "flying") {
        s.flyT += dt;
        s.dirT -= dt;
        if (s.flyT > 8000) s.escaping = true;

        if (s.escaping) {
          s.duck.vy = Math.max(s.duck.vy - 0.25 * n, -7);
          s.duck.vx *= Math.pow(0.97, n);
        } else {
          if (s.dirT <= 0) newDirection();
          // rebotes en los bordes del cielo
          if (s.duck.x < 40) s.duck.vx = Math.abs(s.duck.vx);
          if (s.duck.x > W - 40) s.duck.vx = -Math.abs(s.duck.vx);
          if (s.duck.y < 60) s.duck.vy = Math.abs(s.duck.vy);
          if (s.duck.y > GRASS_TOP - 50) s.duck.vy = -Math.abs(s.duck.vy);
        }
        s.duck.x += s.duck.vx * n;
        s.duck.y += s.duck.vy * n;

        if (s.duck.y < -80) {
          s.escapes += 1;
          syncHud();
          s.stateT = 0;
          setPhaseBoth("escaped");
        }
        return;
      }

      if (ph === "falling") {
        s.duck.vy += 0.4 * n;
        s.duck.y += s.duck.vy * n;
        s.duck.rot += 0.12 * n;
        if (s.duck.y >= GRASS_TOP + 10) {
          s.catT = 0;
          s.kills += 1;
          s.stateT = 0;
          setPhaseBoth("caught");
        }
        return;
      }

      if (ph === "caught") {
        s.catT = Math.min(1, s.stateT / 1600);
        if (s.stateT > 1800) {
          s.catT = -1;
          s.wave += 1;
          syncHud();
          // cada 3 fachos cazados: mensaje VOTA POR LA VIDA
          if (s.kills % 3 === 0) {
            setPhaseBoth("poster");
            setPosterBreak(true);
          } else {
            goWave();
          }
        }
        return;
      }

      if (ph === "escaped" && s.stateT > 1500) {
        if (s.escapes >= MAX_ESCAPES) gameOver();
        else goWave();
      }
    }

    // ----- dibujo -----

    function drawSky() {
      ctx!.fillStyle = "#64b0ff";
      ctx!.fillRect(0, 0, W, H);
      const im = imgs.clouds;
      if (im.complete && im.naturalWidth > 0) {
        const cw = W * 1.4;
        const ch = (cw * im.naturalHeight) / im.naturalWidth;
        const off = (s.cloudX % (cw + W)) - cw;
        ctx!.globalAlpha = 0.5;
        ctx!.drawImage(im, off, 60, cw, ch);
        ctx!.drawImage(im, off + cw + W * 0.6, 160, cw * 0.8, ch * 0.8);
        ctx!.globalAlpha = 1;
      }
    }

    function blockyEllipse(cx: number, cy: number, rx: number, ry: number, color: string) {
      ctx!.fillStyle = color;
      const step = 6;
      for (let yy = -ry; yy < ry; yy += step) {
        const k = Math.sqrt(Math.max(0, 1 - (yy / ry) * (yy / ry)));
        const w2 = Math.round((rx * k) / step) * step;
        ctx!.fillRect(Math.round(cx - w2), Math.round(cy + yy), w2 * 2, step);
      }
    }

    function drawTree() {
      // frailejón grande en lugar del árbol del Duck Hunt
      ctx!.imageSmoothingEnabled = false;
      const fw = 120;
      const fh = (fw * FJ_H) / FJ_W;
      ctx!.drawImage(fjSprite, 64 - fw / 2, GRASS_TOP + 12 - fh, fw, fh);
    }

    function drawBush() {
      blockyEllipse(W - 30, GRASS_TOP - 14, 42, 22, "#0f5c0f");
      // frailejón pequeño junto al arbusto
      ctx!.imageSmoothingEnabled = false;
      const fw = 62;
      const fh = (fw * FJ_H) / FJ_W;
      ctx!.drawImage(fjSmall, W - 60 - fw / 2, GRASS_TOP + 8 - fh, fw, fh);
    }

    function drawGrassAndDirt() {
      // pasto
      ctx!.fillStyle = "#3fbf3f";
      ctx!.fillRect(0, GRASS_TOP, W, DIRT_TOP - GRASS_TOP);
      for (let i = 0; i < 90; i++) {
        const gx = pseudo(i) * W;
        const gy = GRASS_TOP + pseudo(i + 200) * (DIRT_TOP - GRASS_TOP - 8);
        ctx!.fillStyle = pseudo(i + 400) < 0.5 ? "#2e9e2e" : "#62d962";
        ctx!.fillRect(gx, gy, 3, 7);
      }
      // borde superior del pasto
      ctx!.fillStyle = "#62d962";
      for (let x = 0; x < W; x += 8) {
        ctx!.fillRect(x, GRASS_TOP - 4, 4, 6);
      }
      // tierra
      ctx!.fillStyle = "#c66a18";
      ctx!.fillRect(0, DIRT_TOP, W, H - DIRT_TOP);
      for (let i = 0; i < 40; i++) {
        ctx!.fillStyle = "#9c4f0e";
        ctx!.fillRect(pseudo(i + 700) * W, DIRT_TOP + 8 + pseudo(i + 900) * (H - DIRT_TOP - 16), 6, 3);
      }
    }

    function drawDuck(now: number) {
      const ph = phaseRef.current;
      if (ph !== "flying" && ph !== "falling") return;
      const falling = ph === "falling";
      const im = falling
        ? imgs.fall
        : Math.floor(now / 140) % 2 === 0
          ? imgs.fly
          : imgs.flyup;
      ctx!.save();
      ctx!.translate(s.duck.x, s.duck.y);
      if (falling) {
        ctx!.rotate(s.duck.rot);
      } else {
        // el sprite mira hacia arriba: rotarlo hacia su dirección de vuelo
        ctx!.rotate(Math.atan2(s.duck.vy, s.duck.vx) + Math.PI / 2);
      }
      if (im.complete && im.naturalWidth > 0) {
        ctx!.drawImage(im, -DUCK_W / 2, -DUCK_H / 2, DUCK_W, DUCK_H);
      } else {
        ctx!.fillStyle = "#ffe94e";
        ctx!.fillRect(-DUCK_W / 2, -DUCK_H / 2, DUCK_W, DUCK_H);
      }
      ctx!.restore();
    }

    function drawCat() {
      if (s.catT < 0) return;
      // sube, sostiene al facho y se hunde
      const t = s.catT;
      const up = t < 0.35 ? t / 0.35 : t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
      const catW = 64;
      const catH = (catW * catSprite.height) / catSprite.width;
      const baseY = GRASS_TOP + 30;
      const y = baseY - up * (catH + 26);
      const x = Math.max(40, Math.min(W - 40, s.duck.x));
      ctx!.imageSmoothingEnabled = false;
      // facho atrapado sobre la cabeza del gato
      const im = imgs.fall;
      if (im.complete && im.naturalWidth > 0) {
        ctx!.drawImage(im, x - 18, y - 40, 36, 50);
      }
      ctx!.drawImage(catSprite, x - catW / 2, y, catW, catH);
    }

    function drawBoom() {
      if (s.boomT <= 0) return;
      const im = imgs.boom;
      if (!im.complete || im.naturalWidth === 0) return;
      const size = 70 * (1.2 + (1 - s.boomT) * 0.8);
      ctx!.globalAlpha = s.boomT;
      ctx!.drawImage(im, s.boomX - size / 2, s.boomY - size / 2, size, size);
      ctx!.globalAlpha = 1;
    }

    function drawCrosshair() {
      if (!s.cross.visible) return;
      const ph = phaseRef.current;
      if (ph !== "flying" && ph !== "wave") return;
      const { x, y } = s.cross;
      ctx!.strokeStyle = "#ff3333";
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.arc(x, y, 14, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.moveTo(x - 20, y);
      ctx!.lineTo(x - 8, y);
      ctx!.moveTo(x + 8, y);
      ctx!.lineTo(x + 20, y);
      ctx!.moveTo(x, y - 20);
      ctx!.lineTo(x, y - 8);
      ctx!.moveTo(x, y + 8);
      ctx!.lineTo(x, y + 20);
      ctx!.stroke();
    }

    function draw(now: number) {
      drawSky();
      drawTree();
      drawDuck(now);
      drawBoom();
      drawCat();
      drawBush();
      drawGrassAndDirt();
      drawCrosshair();
      if (s.flashT > 0) {
        ctx!.fillStyle = `rgba(255,255,255,${((s.flashT / 90) * 0.45).toFixed(3)})`;
        ctx!.fillRect(0, 0, W, H);
      }
    }

    let raf = 0;
    let last = performance.now();
    function loop(now: number) {
      const dt = now - last;
      last = now;
      update(dt);
      draw(now);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    function canvasPos(e: PointerEvent) {
      const r = canvas!.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * W,
        y: ((e.clientY - r.top) / r.height) * H,
      };
    }

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const p = canvasPos(e);
      s.cross.x = p.x;
      s.cross.y = p.y;
      s.cross.visible = true;
      shoot(p.x, p.y);
    };
    const onPointerMove = (e: PointerEvent) => {
      const p = canvasPos(e);
      s.cross.x = p.x;
      s.cross.y = p.y;
      s.cross.visible = true;
    };
    const onPointerLeave = () => {
      s.cross.visible = false;
    };
    const onVisibility = () => {
      if (document.hidden) music.pause();
      else if (phaseRef.current !== "menu") music.play().catch(() => {});
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      music.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = () => apiRef.current?.startGame();
  const handleRestart = () => {
    setGameOverVisible(false);
    apiRef.current?.startGame();
  };
  const handleContinue = () => {
    setPosterBreak(false);
    apiRef.current?.resume();
  };

  const playing = phase !== "menu" && phase !== "over";

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />

      {playing && (
        <>
          <div className={styles.hud}>
            <div className={styles.scoreBox}>
              PUNTOS
              <br />
              <span>{score}</span>
            </div>
            <div className={styles.scoreBox}>
              MÁXIMO
              <br />
              <span>{best}</span>
            </div>
          </div>

          <div className={styles.escapeRow}>
            {Array.from({ length: MAX_ESCAPES }, (_, i) => (
              <span key={i} className={i < escapes ? styles.escapeLost : styles.escapeOk}>
                ✗
              </span>
            ))}
          </div>

          <div className={styles.bullets}>
            {Array.from({ length: SHOTS_PER_DUCK }, (_, i) => (
              <span key={i} className={i < shots ? styles.bullet : styles.bulletUsed} />
            ))}
          </div>

          <div className={styles.waveTag}>OLEADA {wave}</div>

          <p className={styles.creditInGame}>
            By{" "}
            <a
              href="https://www.instagram.com/cristhian_lunaa"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cristhian Luna
            </a>{" "}
            - Team Cauca
          </p>
        </>
      )}

      {phase === "wave" && (
        <div className={styles.banner}>
          <p>OLEADA {wave}</p>
        </div>
      )}

      {phase === "escaped" && (
        <div className={styles.banner}>
          <p className={styles.bannerBad}>¡SE ESCAPÓ!</p>
        </div>
      )}

      {phase === "menu" && (
        <div className={styles.overlay}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sprites/splash.webp" alt="" className={styles.splash} />
          <div className={styles.panel}>
            <h1 className={styles.title}>
              DUCK HUNT
              <br />
              FACHO
            </h1>
            <p className={styles.subtitle}>FIRMES A LA CÁRCEL</p>
            <div className={styles.scoresRow}>
              <div className={styles.scoreItem}>
                MÁXIMO<b>{best}</b>
              </div>
            </div>
            <button className={styles.btn} onClick={handleStart}>
              ▶ EMPEZAR
            </button>
            <p className={styles.hint}>
              DISPARA ANTES DE QUE ESCAPE
              <br />
              {MAX_ESCAPES} ESCAPES = DERROTA
            </p>
          </div>
          <p className={styles.credit}>
            By{" "}
            <a
              href="https://www.instagram.com/cristhian_lunaa"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cristhian Luna
            </a>{" "}
            - Team Cauca
          </p>
        </div>
      )}

      {posterBreak && (
        <div className={styles.overlay}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/poster.jpg" alt="Vota por la vida" className={styles.poster} />
          <button className={styles.btn} onClick={handleContinue}>
            ▶ CONTINUAR
          </button>
        </div>
      )}

      {gameOverVisible && (
        <div className={styles.overlay}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/poster.jpg" alt="Vota por la vida" className={styles.poster} />
          <div className={styles.finalScore}>
            PUNTOS: {score} · MÁXIMO: {best}
          </div>
          <button className={styles.btn} onClick={handleRestart}>
            ↺ REINTENTAR
          </button>
        </div>
      )}

      <div className={styles.scanlines} />
    </div>
  );
}
