# Performance notes

Numbers from headless Chromium (SwiftShader software GL, so FPS is not representative; draw calls and
triangles are). Measured via `window.__esPerf` after joining and dismissing the placement prompt.

| Date | Build | Viewport | Quality | Draw calls | Triangles |
|---|---|---|---|---|---|
| 2026-11-03 | Phase 6 | 1280×720 | high | 391 | — |
| 2026-11-03 | Phase 6 | 1280×720 | low | 210 | — |
| 2026-11-03 | Step 2 / phase 7 (mobile HUD) | iPhone 13 390×664 | low | 184 | 47.8k |
| 2026-11-03 | Step 2 / phase 7 (mobile HUD) | Pixel 7 412×839 | low | 184 | 47.8k |
| 2026-11-03 | Step 2 / phase 7 (mobile HUD) | iPhone 13 landscape 750×342 | low | 198 | 49.1k |

| 2026-11-04 | Step 2 / phase 10 (human NPCs) | 1280×720 | high | 257 | ~150k |
| 2026-11-04 | Step 2 / phase 11 (flora + critters) | 1280×720 | high | 286 | ~410k |
| 2026-11-04 | Step 2 / phase 11 (flora + critters) | iPhone 13 390×664 | low | 133 | ~174k |
| 2026-11-06 | before LPM assets — Main Street / river bank | 1400×900 | high | 354 / 394 | 1.469M / 1.508M |
| 2026-11-06 | LPM assets (bus shelter, fountain, street lamp ×~230, lantern ×~45) — Main Street / river bank | 1400×900 | high | 353–375 / 420–436 | 1.537M / 1.598M (+4.6% / +6%) |
| 2026-11-06 | + LPM birds, sailboats, willows — Main Street / river bank | 1400×900 | high | 388 / 442 | 1.465M / 1.517M (willow ~3k → 1.1k tris) |
| 2026-11-06 | + LPM grass tufts, farm & zoo kits — Main Street / river bank / zoo / farm | 1400×900 | high | 362 / 408 / 435 / 236 | 1.307M / 1.352M / 1.207M / 1.014M |
| 2026-11-07 | + trip sports (volleyball, surf, cable car, boat trip), VIP row, queue shoppers | 900×640 | default | Sunny Bay court 135 · Maple Hill cable car 45 · Riverside jetty 71 · Screen 1 167 | Maple Hill 0.19M · Riverside 0.17M · cinema 0.94M |
| 2026-11-07 | + My farm v2: country around the farm (farm_land, one merged mesh), garden props, timers, order board | 900×640 | default | My farm (wide view, whole country) 51 | 0.22M |

Budgets (see the Step 2 plan): ≤ 450 draw calls on high, ≤ 250 on low, ≥ 30 FPS on a mid-range phone.
Real-device FPS should be checked with the ⚡/✨ quality toggle; the `perf` analytics event records it per session
(`/admin/stats` → client.avgFps, lowFpsSessions).

## Mobile layout (phase 7)

- Touch devices get a dedicated HUD: profile pill (top-left), utility buttons (top-right), joystick
  (bottom-left), action cluster with **Talk to <NPC>** / emotes / chat (bottom-right). All targets ≥ 44 px.
- Panels are bottom sheets (`ui/Sheet.tsx`): drag the handle down to close, `max-h-88dvh`, safe-area padding.
- The on-screen keyboard never hides inputs: `ui/useKeyboardInset.ts` publishes the covered height as
  `--kb`; sheets and the chat box offset by it. The viewport uses `interactive-widget=overlays-content`
  so the canvas is not resized when the keyboard opens.
- Camera: one-finger drag (or mouse drag) orbits, pinch / wheel zooms (`input/camera.ts`); movement input is
  rotated by the camera yaw so "up" on the joystick is always "away from the camera".
- PWA: `vite-plugin-pwa` precaches the app shell and caches `/models/*.glb` on first use (`es-models` cache).

## Step 3 — 100 players per zone (2026-11-04, dev VPS, 6 GB)

`BOTS=101 SECONDS=40 pnpm --filter @es/game-server load:bots` (every bot moves every tick = worst case):

| Metric | Value |
|---|---|
| Rooms during the run | 2 (Main Street 100/100 + Main Street 2 1/100 — overflow works) |
| Game-server CPU / RSS | 16 % / 121 MB |
| Join time p50 / p95 | 7 ms / 30 ms |
| Input→patch round-trip p50 / p95 | 23 ms / 46 ms |
| Downstream per browser client (100 players, 20 Hz patches) | 19.3 KB/s, 21 frames/s |

Decision: full-room state sync stays (no per-radius `StateView`); the threshold for revisiting is ~60 KB/s per client.

## Step 3 — horizon (2026-11-04, headless swiftshader, draw calls from `PerfProbe`)

| View | Before | After |
|---|---|---|
| Desktop 1100×650, high | 286 | 322 (≈ +36: 7 backdrop instanced models, water, rims, 2 bridges, 2 boats, ducks, fences, hay, fields, 7 clouds) |
| iPhone 390×760, low | 133 | 146 |

Budget: high ≤ 320 is slightly exceeded on the widest desktop view (322); low stays under 150.

## Fix: whole-store subscription in App (2026-11-04)

`App` used `useGame()` without a selector, so every player-position patch (≈20 Hz while anyone moves, including your own
echo) re-rendered the HUD **and** the entire R3F tree (horizon, flora, critters…). Players felt it as stutter while
walking, most noticeably near animals. Now App uses narrow selectors and `Scene` is `memo`-ised.

CDP CPU profile, headless, 3 s of walking (low quality): JS busy time ≈ 1.87 s → 0.78 s (far), ≈ 1.45 s → 0.40 s
(walking into a cat); React (`jsxDEV`/`createElement`/`diffProps`) dropped out of the top samples entirely.
Rule: never call a Zustand store hook without a selector in a component that renders the scene or large UI.


## Sports park minigames (2026-11-06)

Football: one ball mesh (320 tris) + a shadow disc, one ring per player on a team; the server simulates the ball at
30 Hz only while someone is within 30 m of the pitch (the room's simulation interval went 1 Hz → 30 Hz; bubbles and the
heat map still run once a second). Ball patches ride the normal 20 Hz state patch (3 floats). Minigames add 3 cones,
3 start rings and one basketball: +8 draw calls near the park, nothing elsewhere (lazy chunks `Football`, `Minigames`).

## River boats (2026-11-06)

`River` is a lazy chunk mounted with the horizon: 4 piers, kiosk, 4 buoys, 4 hire boats (+2 oars each for rowing
boats), the ferry, 2 timetable boards and fishing floats: ≈ +20 draw calls when the river is in view (all LPM,
vertex-coloured, shared toon material). Boats sync through the room state (5 numbers / boat, only while someone
rows); the ferry is computed from the shared clock, no network traffic.

## Draw only what can be seen (2026-11-09)

The backdrop (houses and trees along the whole street), both sets of street lamps and the flowers / grass tufts were
street-wide InstancedMeshes: their bounding spheres cover the whole map, so the frustum never dropped them and every
instance was drawn (and the lamps cast shadows) even from inside the restaurant. `scene/nearInstances.tsx` now keeps
only the instances near and in front of the camera (within the far plane; 80 m inside an area; flowers 70 / 45 m),
rebuilt when the camera moves 3 m or turns ~6°. NPCs, street animals and cyclists (frustum culling off, they pop) are
hidden beyond 80 m (45 m inside an area) by `FarHide`. Inside an area the sun's shadow box shrinks to the yard.

Headless, high quality, 900×640 (draw calls · triangles):

| View | Before | After |
|---|---|---|
| Main Street | 323 · 1.26M | 288 · 0.63M |
| Restaurant | 189 · 0.98M | 133 · 0.23M |
| School | 120 · 0.89M | 82 · 0.17M |
| Supermarket | 188 · 1.04M | 111 · 0.27M |

Also since 2026-11-09 the canvas runs on demand at a frame-rate cap (Settings → Frame rate, 30 by default).
