"""Bus stop shelter - street furniture, 2.7 x 1.5 x 2.55 m, budget 1200 tris.

Game contract (scene/areas/Areas.tsx BusStop, world/seats.ts) - Blender axes (glTF/three: x, z, -y):
  * open side faces -Y (three +z, turned to the road by the group rotation)
  * bench seat top z = 0.50 at y = +0.20, seats at x = +-0.5 (world/seats.ts)
  * sign disc centre (1.85, -0.5, 2.55), faces +-Y, half thickness <= 0.035 (BUS text sits at +-0.04)
  * pivot = shelter centre on the ground (no x-centring: the sign pole is off to the right)
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, glass, export_web

lpm.reset()
P = palette()
parts = []
add = parts.append

# --- ground pad + posts --------------------------------------------------------------------------
add(lpm.box("pad", (2.7, 1.45, 0.05), at=(0, 0.02, 0), color=P["concrete"]))
FRONT_Y, BACK_Y, PX = -0.52, 0.5, 1.18
for x in (-PX, PX):
    add(lpm.box(f"post_f{x}", (0.09, 0.09, 2.38), at=(x, FRONT_Y, 0.03), color=P["slate_dark"]))
    add(lpm.box(f"post_b{x}", (0.09, 0.09, 2.27), at=(x, BACK_Y, 0.03), color=P["slate_dark"]))
    for z in (0.18, 2.06):  # side rails
        add(lpm.box(f"rail_s{x}{z}", (0.07, BACK_Y - FRONT_Y - 0.06, 0.07), at=(x, (FRONT_Y + BACK_Y) / 2, z), color=P["slate"]))
for z in (0.18, 2.06):  # back rails
    add(lpm.box(f"rail_b{z}", (2 * PX - 0.06, 0.07, 0.07), at=(0, BACK_Y, z), color=P["slate"]))

# --- canopy: thin wing sloping to the back, chunky blue fascia at the front ------------------------
# outline in (depth u, z), extruded along x then turned so u -> +y
# >= 0.1 m thick everywhere: thinner slabs pick up shadow acne under the game's sun (normalBias 0.04)
roof = lpm.sweep("roof", [(-0.8, 2.36), (0.76, 2.24), (0.76, 2.35), (-0.62, 2.47), (-0.8, 2.53)], depth=2.78, color=P["blue"])
lpm.rotate(roof, 90, "Z")
lpm.paint(roof, P["slate"], where=lambda c, n, i: n.z < -0.5)          # underside
lpm.paint(roof, P["blue_dark"], where=lambda c, n, i: abs(n.x) > 0.9)   # end caps
add(roof)
# three dark ribs along the slope break up the big top face (the game camera mostly sees the roof from above)
for x in (-0.95, 0.0, 0.95):
    rib = lpm.sweep(f"rib{x}", [(-0.64, 2.455), (0.74, 2.335), (0.74, 2.375), (-0.64, 2.495)], depth=0.07, at=(0, -x, 0), color=P["blue_dark"])
    lpm.rotate(rib, 90, "Z")
    add(rib)
add(lpm.box("stripe", (2.8, 0.03, 0.035), at=(0, -0.815, 2.43), color=P["white"]))  # stands 1.5 cm proud of the fascia

# --- bench: wooden slats on two steel brackets -----------------------------------------------------
for x in (-0.7, 0.7):
    add(lpm.sweep(f"bracket{x}", [(-0.03, 0.0), (0.03, 0.0), (0.03, 0.43), (0.0, 0.46), (-0.03, 0.43)], depth=0.36, at=(x, 0.2, 0.03), color=P["slate_dark"]))
    add(lpm.box(f"brace{x}", (0.06, 0.05, 0.42), at=(x, 0.42, 0.42), color=P["slate_dark"]))
for k, y in enumerate((0.06, 0.2, 0.34)):
    add(lpm.box(f"seat{k}", (1.75, 0.12, 0.04), at=(0, y, 0.46), color=P["wood"] if k != 1 else P["wood_dark"]))
for k, z in enumerate((0.66, 0.8)):
    add(lpm.box(f"back{k}", (1.75, 0.035, 0.1), at=(0, 0.43, z), color=P["wood"]))

# --- advert light box on the right wall (white frame, yellow poster, blue band) -----------------------
add(lpm.box("ad_frame", (0.1, 0.84, 1.5), at=(PX, (FRONT_Y + BACK_Y) / 2 + 0.05, 0.4), color=P["white"]))
for s in (-1, 1):
    add(lpm.box(f"ad_poster{s}", (0.02, 0.7, 1.32), at=(PX + s * 0.05, (FRONT_Y + BACK_Y) / 2 + 0.05, 0.49), color=P["yellow"]))
    add(lpm.box(f"ad_band{s}", (0.03, 0.7, 0.26), at=(PX + s * 0.05, (FRONT_Y + BACK_Y) / 2 + 0.05, 1.1), color=P["blue"]))
    add(lpm.box(f"ad_dot{s}", (0.035, 0.2, 0.2), at=(PX + s * 0.05, (FRONT_Y + BACK_Y) / 2 + 0.05, 0.7), color=P["orange"]))

# --- bus stop sign: pole, footing, white-rimmed blue disc, timetable box ---------------------------------
SX, SY = 1.85, -0.5
add(lpm.prism("sign_foot", 8, 0.1, 0.06, at=(SX, SY, 0), color=P["concrete_dark"]))
add(lpm.prism("sign_pole", 8, 0.045, 2.3, at=(SX, SY, 0.05), color=P["slate"]))
rim = lpm.prism("sign_rim", 16, 0.34, 0.05, at=(SX, SY, 2.55), color=P["white"])
disc = lpm.prism("sign_disc", 16, 0.30, 0.066, at=(SX, SY, 2.55), color=P["blue"])
for o, h in ((rim, 0.05), (disc, 0.066)):
    lpm.move(o, 0, 0, -h / 2)
    lpm.rotate(o, 90, "X", about=(SX, SY, 2.55))
    add(o)
add(lpm.box("timetable", (0.3, 0.07, 0.42), at=(SX, SY - 0.06, 1.15), color=P["slate_dark"]))
add(lpm.box("timetable_face", (0.24, 0.02, 0.34), at=(SX, SY - 0.1, 1.19), color=P["white"]))
add(lpm.box("timetable_head", (0.24, 0.025, 0.06), at=(SX, SY - 0.1, 1.47), color=P["blue"]))

shelter = lpm.finish("SM_BusShelter", parts, P, budget=1200, center=False)

# --- glass: back wall and the left side ---------------------------------------------------------------
panes = [
    lpm.box("g_back", (2 * PX - 0.1, 0.02, 1.84), at=(0, BACK_Y, 0.22)),
    lpm.box("g_left", (0.02, BACK_Y - FRONT_Y - 0.1, 1.84), at=(-PX, (FRONT_Y + BACK_Y) / 2, 0.22)),
]
g = glass("SM_BusShelter", panes)

export_web(shelter, P, extra=[g], slug="bus_shelter")
