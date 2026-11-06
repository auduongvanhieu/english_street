"""Town fountain - park centrepiece on Main Street, 2.84 m across x 1.95 m tall, budget 1500 tris.

Game contract (world/layout.ts buildBlockers, scene/City.tsx): centred on the old fountain tile (0, 0, 2*TILE),
base on the pavement top; the basin wall stays inside the +-1.2 m blocker square (only the low rim and the
flat step stick out). Replaces the Kenney 'pavement-fountain' tile, which keeps its plain pavement under it.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, lathe_loop, glass, export_web

lpm.reset()
P = palette()
parts = []
add = parts.append
SEG = 12          # hero prop: 12-sided basin and bowl (style guide: 10-16 for hero round shapes)
ROT = 15.0        # a flat side faces the street

# --- ground step + main basin -----------------------------------------------------------------------
add(lpm.lathe("step", [(0, 0), (1.42, 0), (1.42, 0.06), (0, 0.06)], segments=SEG, color=P["concrete_dark"]))
lpm.rotate(parts[-1], ROT)
basin = lathe_loop("basin", [(1.22, 0.05), (1.22, 0.40), (1.31, 0.42), (1.31, 0.53), (1.03, 0.53), (1.03, 0.30)], SEG, color=P["concrete"], rotate_deg=ROT)
lpm.paint(basin, P["cream"], where=lambda c, n, i: c.z > 0.415)       # rim cap
add(basin)
add(lpm.lathe("water", [(0, 0.30), (1.05, 0.30), (1.05, 0.40), (0, 0.40)], segments=SEG, color=P["water"]))
lpm.rotate(parts[-1], ROT)
add(lathe_loop("ripple", [(0.80, 0.39), (1.0, 0.39), (1.0, 0.415), (0.80, 0.415)], SEG, color=P["water_light"], rotate_deg=ROT))

# --- pedestal + upper bowl ----------------------------------------------------------------------------
add(lpm.lathe("pedestal", [(0.36, 0.30), (0.36, 0.50), (0.25, 0.58), (0.17, 0.92), (0.25, 1.02), (0.30, 1.10)], segments=8, color=P["concrete"]))
add(lpm.lathe("ped_ring", [(0.39, 0.40), (0.39, 0.47), (0, 0.47)], segments=8, color=P["cream"]))
bowl = lathe_loop("bowl", [(0.27, 1.02), (0.70, 1.20), (0.76, 1.30), (0.66, 1.31), (0.62, 1.25), (0.27, 1.14)], SEG, color=P["concrete"], rotate_deg=ROT)
lpm.paint(bowl, P["cream"], where=lambda c, n, i: c.z > 1.27)
add(bowl)
add(lpm.lathe("bowl_water", [(0, 1.18), (0.64, 1.18), (0.64, 1.28), (0, 1.28)], segments=SEG, color=P["water"]))
lpm.rotate(parts[-1], ROT)

# --- water: a rounded jet with a splash cap; the falling sheet is a separate see-through "_water" mesh ---------
add(lpm.lathe("jet", [(0, 1.2), (0.1, 1.2), (0.075, 1.42), (0.06, 1.62), (0.1, 1.7), (0.15, 1.76), (0.12, 1.82), (0, 1.86)], segments=8, color=P["water_light"]))
f = lpm.finish("SM_Fountain", parts, P, budget=1500)
# thin shell flaring from the bowl lip down into the basin water (closed loop, so it has an inside and an outside)
sheet = lathe_loop("sheet", [(0.75, 1.31), (0.87, 1.21), (0.95, 0.96), (0.99, 0.39), (0.965, 0.39), (0.925, 0.96), (0.845, 1.19), (0.73, 1.28)], SEG, rotate_deg=ROT)
w = glass("SM_Fountain", [sheet], color="#bfe6fb", kind="water", alpha=0.5)
export_web(f, P, extra=[w], slug="fountain")
