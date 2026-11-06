# English Street — 3D art direction

This is the shared style guide for every low-poly 3D asset in the game. It covers models from Kenney/Quaternius, props built in code with `Part`, and models built in Blender with the **blender-lpm-skill** (`.claude/skills/blender-lpm-skill`).
When you add, edit or replace a 3D asset, follow this document and the procedure in section 9.

## 1. Look and feel

- **Cute, bright, toy-like city.** Big-headed chibi characters (`CHIBI_HEIGHT` ≈ 1.52 m), shapes with clear outlines, saturated colours on accents and calmer colours on large surfaces.
- **The art has to read from the game camera.** The camera orbits 5–16 m behind the player (default 10 m) and looks down at an angle, usually 25–40°. So:
  - The **top faces** (roofs, tabletops, basins) are seen most. They need some detail (ribs, borders, a second shade) and must not be one big flat slab of colour.
  - The silhouette must read at 10–15 m: tell an object from its outline before its details.
- **Every triangle has a job.** Spend triangles where the outline changes (canopy edges, the neck of a street lamp, a basin rim). A flat surface is a single face.
- Avoid the "pile of boxes and spheres" look:
  - Each asset has 1 primary shape, 2–4 secondary shapes, and only a few selective details.
  - Use tapers, bevels and chamfers, rims proud of the surface, `lathe` for round parts and `sweep` for curved parts.

## 2. Palette

Every Blender LPM asset uses one shared palette: `ES_PALETTE` in `assets-src/lpm/es_lpm.py`. Add a colour by **appending** a cell at the end; never change the order of existing cells.

| Cell | Hex | Used for |
|---|---|---|
| slate | `#596273` | metal posts and frames (main) |
| slate_dark | `#3d4452` | feet, hoods, under-roof shade (fake AO) |
| steel | `#9aa4b2` | light metal |
| blue / blue_dark | `#2f80ed` / `#1f5fb8` | public-transport identity (bus stop, bus), roof ribs |
| white | `#f4f6f8` | trim, signs |
| cream | `#f3e3c3` | stone rims, light trim |
| wood / wood_dark | `#a0703c` / `#6e4a26` | benches, planks (alternate the two shades) |
| concrete / concrete_dark | `#b8bcc2` / `#8e939b` | basins, kerbs, footings |
| orange / red / green / yellow | `#f2994a` `#e05a47` `#4caf6a` `#f6c945` | accents: posters, small signs (never large areas) |
| ink | `#2a2230` | nearly black: lantern frames (same colour as the chibi outline) |
| water / water_light | `#4fa3e0` / `#bfe6fb` | water surfaces, jets |

Colour rules:

- Pair each base colour with a darker shade (`x` / `x_dark`) for recesses and undersides.
- Two parts that touch must contrast. Pavements are grey-violet, so street props use slate/blue/cream, never a mid grey on a mid grey.
- Saturated colours go on accents only. Large surfaces stay calm.
- Code-built props (`Part`) and existing Kenney models keep their own colours, but new colours should come from this palette.

## 3. Scale, axes, pivot

- **1 unit = 1 m.** City tile `TILE` = 4 m.
- Reference sizes:

  | Object | Size |
  |---|---|
  | Door | 2.2 m |
  | Bench seat | 0.45–0.5 m high |
  | Street lamp | 4.2 m (arm 1.2 m) |
  | Bus | 9 × 2.4 × 3 m |
  | Bus shelter | 2.7 × 1.5 × 2.5 m |
  | Riverside lantern | 2.5 m |

- **Blender:** Z up, the front faces **−Y**. glTF/three.js converts this to Y up, front **+Z**: Blender `(x, y, z)` → three `(x, z, −y)`.
- **Pivot:**
  - Props: centre of the base, z = 0 on the ground.
  - Off-centre props (bus shelter, street lamp): the point the game uses to place them. Call `finish(center=False)` for these.
  - Kit modules: the snapping corner.
- **Game contract:** every recipe starts with a docstring listing the numbers the game depends on (seat height, sign position, collider radius, bulb position…). When you replace an old model, measure the old one and keep those numbers.

## 4. Shading and materials

- **Flat shading, toon.** In game, LPM assets are drawn with `chibiMaterial()`: `MeshToonMaterial` with a 3-step gradient and `vertexColors`. This is the same material as every code-built prop, so they can share a draw call and be instanced.
- One colour per face. `export_web()` writes it twice:
  - as a palette UV plus the palette texture (the skill's standard);
  - as `COLOR_0` (what the game actually uses).
- **No** normal maps, no baked textures, no generated textures. Rings, ribs and rivets are real geometry.
- **Exceptions:**
  - see-through parts go in a separate object named `<Name>_glass` or `<Name>_water`; the game swaps in `lpmGlassMat` / `lpmWaterMat`;
  - night light comes from the game (`windowMat` panes, `glowPointsMat` glow points, instanced bulb blocks), not from emission inside the GLB.
- **Shadow acne:** the sun has `normalBias 0.04`. A slab that casts a shadow must be **≥ 0.1 m thick**, otherwise it gets shadow stripes.
- Parts must never be coplanar. Sink each part ≥ 2 mm into its neighbour, or let it stand ≥ 2 mm proud.

## 5. Naming, files, export

| Item | Rule |
|---|---|
| Recipe | `assets-src/lpm/recipes/<slug>.py`, slug in `snake_case` |
| Blender object | `SM_<PascalCase>` (+ `_glass`, `_water`, `_COL`) |
| Web output | `apps/web/public/models/lpm/<slug>.glb` (committed) |
| Work output | `_work/lpm/<slug>/` — `.blend`, `views/sheet.png`, `inspect.json`, `gates.md` (git-ignored, recreate with `build.py`). Multi-part GLBs: `export_web(spread=…)` lays the parts out in the review `.blend` only |
| Floating pivot | flying/floating assets (bird, boat) are listed in `FLOATING` in `build.py` (gate `--allow-floating`) |
| Load in game | `scene/LpmModel.tsx`: `<LpmModel slug=… />` for a single object, `useLpmGeometry(slug)` for an `InstancedMesh`, `useLpmParts(slug)` for multi-part GLBs with animated parts (bird wings, boat variants), `Part.addColored()` to merge into a code-built mesh; add the slug to the `LpmSlug` type and call `preloadLpm(slug)` |
| GLB | Y up, transforms applied, flat normals, COLOR_0, no animation/skin/camera/light |

## 6. Budgets per asset group

Pick the budget by **how many copies there are and how much screen space the asset takes**, not one flat number:

| Group | Examples | Triangles (each) | Materials | Draw calls | GLB |
|---|---|---|---|---|---|
| Repeated street furniture (> 30 copies, instanced) | street lamp, lantern post, bollard, bin | ≤ 300 (aim for 200) | 1 (toon) | 1 per kind (InstancedMesh) | ≤ 30 KB |
| Single street prop (≤ 10 copies) | bus shelter, bench, kiosk | ≤ 1 200 | toon + glass | ≤ 3 per copy | ≤ 80 KB |
| Centrepiece | fountain, statue, signature building | ≤ 1 500 | toon + water/glass | ≤ 3 | ≤ 120 KB |
| Kit module (walls, stalls, enclosures) | farm stall, zoo hut | 300–3 000 | toon (+ glass) | merge per area | ≤ 150 KB |
| Character / animal | chibi, animals (built in code) | ≤ 3 000 | toon + outline | — | — |

Whole-scene budgets (docs/PERF.md):

- ≤ 450 draw calls on high, ≤ 250 on low.
- ≥ 30 FPS on a mid-range phone.
- Large instanced groups only cast shadows on high (`castShadow={!low}`).

## 7. Detail level

- **Facet counts:**
  - rivets and pegs: 6 sides
  - posts and handles: 8
  - basins, bowls, signs: 12–16
- **Details only where the camera sees them:**
  - the roof top (seen from the camera)
  - the front side (the side the player approaches)
  - the outline
- Hidden faces are removed with `cap=False` on prism ends that sit inside another part.

## 8. Asset inventory and priorities

| Asset | Source | Copies | Status |
|---|---|---|---|
| Bus shelter | LPM `bus_shelter` | 9 | ✅ rebuilt (was a flat box with a white panel) |
| Main Street fountain | LPM `fountain` | 1 (centre of the scene) | ✅ rebuilt (was a Kenney tile with a blob of water) |
| Street lamp | LPM `street_lamp` | ~230 | ✅ rebuilt (was a box "L") |
| Riverside lantern post | LPM `lantern_post` | ~45 | ✅ rebuilt (was a box post) |
| Birds (3 kinds: pigeon, gull, sparrow) | LPM `bird` (separate body + wing, wing pivot at the shoulder) | 36 in the sky | ✅ rebuilt (was a sphere + box wings) |
| River sailboats (red / blue) | LPM `boat` | 2 | ✅ rebuilt (was a box with the bow sticking out the side) |
| Weeping willow (riverside tree tiles) | LPM `willow`, merged into the tree tile via `Part.addColored` | ~55 | ✅ rebuilt (was ~3,000 tris of tubes, now 1,124) |
| Bus | code (`Buses.tsx`, rounded boxes) | ≤ 9 | kept: already detailed, door animation |
| Shops / backdrop houses / roads | Kenney city kit | many | kept: consistent Kenney style, lit windows already added |
| Grass tufts (2 variants) | LPM `grass_tuft` (instanced, ~110 / 70 tris) | thousands | ✅ rebuilt (Quaternius clumps ~290 tris read as dark twigs) |
| Other trees, flowers | code (`treeTiles.ts`, `kit.tree`) + Quaternius | many | kept |
| Farm: barn, coop, windmill (+ turning sails), troughs, hay bales, market stall | LPM `farm_kit`, merged into the farm mesh (`Part.addColored`) | 1 area | ✅ rebuilt |
| Zoo: zookeeper hut, benches, rocks (tinted per habitat), bear cave, hay feeder, hutch | LPM `zoo_kit`, merged into the zoo mesh | 1 area | ✅ rebuilt; fences, pools and bamboo still code |
| Restaurant, supermarket, places | code (`Part` / `Merged`) | 1 each | next: rebuild per area |
| Chibi, animals, critters | code (`buildChibi`, `buildAnimal`, `buildCritter`) | many | kept in code: rounded chibi style + joint rig; the zebra was rebuilt in code on 2026-11-06 on a horse frame (neck, long head, mane, body/leg stripes) to stay consistent with the other animals |

## 9. Procedure (required for every asset)

1. **Brief:** asset, real size (m), triangle budget from section 6, palette cells, number of copies.
2. **Contract:** measure the old model/code and write down the numbers the game uses (pivot, heights, collider, sockets, text/glow positions) in the recipe docstring.
3. **Recipe:** `assets-src/lpm/recipes/<slug>.py`, built with `lpm` (`box`, `prism`, `lathe`, `sweep`, `paint`…) plus `es_lpm` (`lathe_loop`, `glass`, `export_web`).
4. **Build + look:** `python3 assets-src/lpm/build.py <slug>`. This builds, renders 5 views (front/side/back/quarter/top) with Cycles, inspects the result and runs the gates. Open `_work/lpm/<slug>/views/sheet.png` and fix the outline, proportions and colour contrast. Three iterations is normal.
5. **Gates:** `build.py` must print `PASS`. A "loose parts" warning is expected (each part is its own shell, by design).
6. **In game:**
   - put the model in place;
   - take screenshots with the real camera and lighting, **in daylight and at night** (`hour` 13 / 21), from a distance and close up (headless Playwright script `view.mjs`, see the agent memory);
   - fix z-fighting, shadow acne and anything hard to read.
7. **Checks:**
   - `pnpm typecheck`, `pnpm test`, `pnpm --filter @es/web build`;
   - compare `window.__esPerf` (draw calls/triangles) before and after in a representative scene, and record it in docs/PERF.md.
8. Update the inventory table in section 8.

## 10. Environment (this VPS)

- Blender 5.2.3 LTS portable: `~/opt/blender/blender`. `build.py` finds it automatically; to use another one, set `BLENDER_EXE`.
- There is no GPU and no `libEGL`, so EEVEE and Workbench cannot render headless. **Always use Cycles CPU** (`--engine CYCLES`); 5 views at 512 px take about 10 s.
- Never use the paid scripts in the skill (`make_turnaround.py`, `multiview_to_mesh.py` → fal.ai) or the GPU ones (`hy3d_local_mv.py`) unless the user explicitly allows it. Build from primitives.
