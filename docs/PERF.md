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
