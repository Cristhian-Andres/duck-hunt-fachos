# 🎯 Duck Hunt Facho

Juego arcade retro estilo **Duck Hunt (NES)** construido con **Next.js 15**, **React 19** y **TypeScript**. El facho vuela errático por el cielo como un pato: dispárale antes de que escape. Cuando cae, un gato sale del pasto a atraparlo. Si se te escapan 3, pierdes… y te espera el póster de **"VOTA POR LA VIDA"**.

> By [Cristhian Luna](https://www.instagram.com/cristhian_lunaa) - Team Cauca

## 🎮 Cómo se juega

| Acción | Celular | Computadora |
|---|---|---|
| Disparar | Tocar la pantalla | Clic (la mira sigue el mouse) |

- Tienes **3 balas** por cada vuelo. Sin balas, el facho huye.
- Cada acierto vale **100 × oleada**; cada oleada vuela más rápido.
- **3 escapes = derrota** (sale el póster con botón de reinicio).
- El récord se guarda en el navegador (`localStorage`).

## 🛠️ Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Canvas 2D (360×640, `image-rendering: pixelated`)
- Escena estilo NES dibujada proceduralmente: cielo azul, árbol, arbustos, pasto y tierra
- Gato pixel-art procedural que atrapa al facho al caer
- Mira de disparo, flash de pantalla tipo zapper, HUD de balas/escapes/oleada
- Estética retro: fuente *Press Start 2P*, scanlines CRT
- Responsive: fullscreen móvil con safe-areas, gabinete arcade 9:16 en escritorio

## 🚀 Desarrollo local

```bash
npm install
npm run dev
# → http://localhost:3001
```

Build de producción: `npm run build && npm start`.
