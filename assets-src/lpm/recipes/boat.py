"""Small sailboat drifting on the river (scene/Horizon.tsx Boat), 2 colour variants, budget 600 tris each.

Game contract (Blender axes; three = (x, z, -y)):
  * pivot = hull centre on the waterline (the game sets y = WATER_Y + 0.2 and bobs it)
  * long axis X, bow towards -X (the game turns it by PI when sailing towards +x)
  * objects: SM_Boat_red (red hull, white sails), SM_Boat_blue (blue hull, yellow sails)
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()
VARIANTS = {"red": ("red", "white"), "blue": ("blue_dark", "yellow")}
L, B = 2.3, 0.72          # half length, half beam
plan = [(-L, 0.0), (-L + 0.7, -0.5), (-0.6, -B), (1.5, -B), (L, -0.52), (L, 0.52), (1.5, B), (-0.6, B), (-L + 0.7, 0.5)]

boats = []
for name, (hull_c, sail_c) in VARIANTS.items():
    parts = []
    add = parts.append
    # hull: plan outline extruded from below the waterline, narrower at the keel, a raised bow sheer
    hull = lpm.sweep(f"hull_{name}", plan, depth=0.62, at=(0, 0, -0.22), color=P[hull_c], axis="z")
    lpm.taper(hull, 1.0, -0.22, 0.4)
    for v in hull.data.vertices:            # keel narrower than the deck, bow rises
        if v.co.z < 0:
            v.co.y *= 0.62; v.co.x *= 0.93
        if v.co.z > 0 and v.co.x < -1.0:
            v.co.z += 0.18 * (-1.0 - v.co.x) / (L - 1.0)
    hull.data.update()
    lpm.paint(hull, P["white"], where=lambda c, n, i: n.z < -0.9)          # light keel (seen through the water)
    add(hull)
    # gunwale: a white rail 3 cm proud of the hull top edge
    rail = lpm.sweep(f"rail_{name}", [(x * 1.02, y * 1.04) for x, y in plan], depth=0.06, at=(0, 0, 0.37), color=P["white"], axis="z")
    for v in rail.data.vertices:
        if v.co.x < -1.0:
            v.co.z += 0.18 * (-1.0 - v.co.x) / (L - 1.0)
    rail.data.update()
    add(rail)
    # wooden deck on top of the rail plate, inset so a white border shows all round
    deck = lpm.sweep(f"deck_{name}", [(x * 0.9, y * 0.84) for x, y in plan], depth=0.03, at=(0, 0, 0.42), color=P["wood"], axis="z")
    for v in deck.data.vertices:
        if v.co.x < -1.0:
            v.co.z += 0.18 * (-1.0 - v.co.x) / (L - 1.0)
    deck.data.update()
    add(deck)
    # cabin with portholes, roof
    add(lpm.box(f"cabin_{name}", (1.1, 0.9, 0.42), at=(0.55, 0, 0.44), color=P["cream"], taper=(0.92, 0.9)))
    add(lpm.box(f"roof_{name}", (1.18, 0.98, 0.06), at=(0.55, 0, 0.85), color=P[hull_c]))
    for x in (0.3, 0.75):
        for s in (-1, 1):
            add(lpm.box(f"win{x}{s}_{name}", (0.18, 0.02, 0.12), at=(x, s * 0.425, 0.63), color=P["ink"]))
    # mast, boom, sails (thin closed plates so both sides render), pennant
    MX = -0.25
    add(lpm.prism(f"mast_{name}", 6, 0.05, 3.3, at=(MX, 0, 0.4), color=P["wood_dark"], radius_top=0.035))
    boom = lpm.prism(f"boom_{name}", 6, 0.035, 1.9, at=(0, 0, 0), color=P["wood_dark"])
    lpm.rotate(boom, 90, "Y"); lpm.move(boom, MX + 0.04, 0, 1.05)
    add(boom)
    add(lpm.sweep(f"sail_{name}", [(MX + 0.08, 1.12), (MX + 1.85, 1.12), (MX + 0.08, 3.55)], depth=0.025, color=P[sail_c]))
    add(lpm.sweep(f"jib_{name}", [(MX - 0.08, 1.0), (MX - 0.08, 3.25), (-L + 0.35, 0.62)], depth=0.025, color=P[sail_c]))
    add(lpm.sweep(f"flag_{name}", [(MX, 3.62), (MX + 0.38, 3.55), (MX, 3.47)], depth=0.02, color=P[hull_c]))
    b = lpm.finish(f"SM_Boat_{name}", parts, P, budget=600, ground=False, center=False)
    boats.append(b)

export_web(boats[0], P, extra=boats[1:], slug="boat", spread=[(0, 0, 0), (0, 2.2, 0)])
