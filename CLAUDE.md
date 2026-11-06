# English Street — notes for Claude Code

A 3D multiplayer game for learning English (React Three Fiber + Colyseus + Fastify). The overview, folder layout and commands are in [README.md](README.md).
Design: [docs/GDD.md](docs/GDD.md) · deploy: [docs/DEPLOY.md](docs/DEPLOY.md) · performance: [docs/PERF.md](docs/PERF.md).

## 3D assets (low-poly) — required

Whenever you **create, edit, optimise or replace** a low-poly 3D asset (props, street furniture, buildings, kit modules):

1. **Read and use the `blender-lpm-skill`** (`.claude/skills/blender-lpm-skill/SKILL.md`, plus `references/` as needed).
   - Build from primitives with a triangle budget and a palette.
   - Do not decimate high-poly meshes.
   - Do not call AI generators or paid services (fal.ai…) unless the user allows it.
2. **Follow [docs/3d-art-direction.md](docs/3d-art-direction.md)**: the shared palette `ES_PALETTE`, scale (1 unit = 1 m), axes and pivot, naming, budgets per asset group, flat toon shading, and how to write glass/water objects.
3. **Each recipe has a source file that can be re-run:**
   - recipe in `assets-src/lpm/recipes/<slug>.py`;
   - built through the adapter `assets-src/lpm/es_lpm.py`, which exports GLB with vertex colours to `apps/web/public/models/lpm/`;
   - loaded in game with `scene/LpmModel.tsx` (`<LpmModel>`, or `useLpmGeometry` for instancing).
4. **An asset is only done after this loop:**
   - `python3 assets-src/lpm/build.py <slug>`: build, render the 5 views with Cycles, gates must print `PASS`;
   - **look at** `_work/lpm/<slug>/views/sheet.png` and fix what looks wrong;
   - put it in the game, take screenshots under the real camera and lighting (day and night), and fix again;
   - `pnpm typecheck`, `pnpm --filter @es/web build`; compare draw calls/triangles (`window.__esPerf`).
5. **When you replace an existing model,** keep the gameplay contract: pivot, size, seat positions, colliders, text/glow positions, animations/rigs. Write these numbers in the recipe docstring.

Blender on this machine: `~/opt/blender/blender` (5.2 LTS, headless). There is no GPU, so render with `--engine CYCLES`; EEVEE and Workbench do not work.
