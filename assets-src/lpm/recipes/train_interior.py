"""Train carriage interior - the coach players ride in (scene/TrainRide.tsx), budget 3000 tris.

Game contract (carriage local space, three axes; origin = floor centre; the carriage runs along x):
  * inside 14 m long (x -7 ... 7), side walls at z +-1.3, floor y 0, ceiling y 2.3
  * four seating bays centred at x = -5.25, -1.75, 1.75, 5.25 on both sides of a 0.8 m aisle (|z| < 0.4):
    double seats facing each other at x = bay -+ 0.8 (seat cushion top y 0.42, seats from |z| 0.45 to 1.25),
    a small table between them at x = bay; the game puts sitting places at z = +-0.65 and +-1.05
  * windows: one per bay and side, 2.4 m wide (x = bay +- 1.2), sill y 0.85, top y 1.85
  * end walls at x = +-7 with a (closed) gangway door; keep the aisle clear
Meshes: SM_TR_Inside (floor, seats, tables, racks, ends), SM_TR_Ceiling (hidden while the camera is above it), SM_TR_WallN (z = -1.3) and SM_TR_WallS
(z = +1.3) so the game can cut away the wall on the camera's side, SM_TR_Win_glass (all window panes).
Built in three axes and converted to Blender's (x, -z, y) by tbox(); pivot = carriage origin.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()
L, HW, CEIL = 14.0, 1.3, 2.3
BAYS = [-5.25, -1.75, 1.75, 5.25]
SILL, TOP = 0.85, 1.85


def tbox(name, sx, sy, sz, x, y0, z, color):
    """Box in three axes: size (x, height, z-width), base centre (x, y0, z)."""
    return lpm.box(name, (sx, sz, sy), at=(x, -z, y0), color=color)


inside = []
add = inside.append
# floor with a carpet runner, ceiling with a light strip
add(tbox("floor", L, 0.04, 2 * HW, 0, -0.04, 0, P["slate_dark"]))
add(tbox("runner", L - 0.4, 0.01, 0.75, 0, 0.0, 0, P["carpet"]))
for b in BAYS:
    for side in (-1, 1):
        zc = side * 0.85
        for k, dx in enumerate((-0.8, 0.8)):
            x = b + dx
            back_x = x + (-0.27 if dx < 0 else 0.27)
            add(tbox(f"base{b}{side}{k}", 0.5, 0.34, 0.8, x, 0.0, zc, P["slate"]))
            add(tbox(f"cush{b}{side}{k}", 0.5, 0.08, 0.8, x, 0.34, zc, P["blue"]))
            add(tbox(f"back{b}{side}{k}", 0.08, 0.72, 0.8, back_x, 0.38, zc, P["blue"]))
            add(tbox(f"head{b}{side}{k}", 0.1, 0.16, 0.8, back_x, 1.1, zc, P["blue_dark"]))
        # table on a wall bracket
        add(tbox(f"table{b}{side}", 0.55, 0.04, 0.6, b, 0.7, side * 0.95, P["wood"]))
        add(tbox(f"tleg{b}{side}", 0.06, 0.7, 0.06, b, 0.0, side * 1.1, P["steel"]))
        # luggage rack above the window
        add(tbox(f"rack{b}{side}", 2.6, 0.03, 0.4, b, 1.98, side * 1.08, P["steel"]))
        add(tbox(f"rackl{b}{side}", 2.6, 0.06, 0.03, b, 1.95, side * 0.9, P["steel"]))
# grab poles by the vestibules
for x in (-6.6, 6.6):
    for side in (-1, 1):
        add(lpm.prism(f"pole{x}{side}", 6, 0.03, CEIL, at=(x, -side * 0.42, 0), color=P["yellow"], cap=False))
# end walls with a gangway door and a little window in it
for s in (-1, 1):
    x = s * (L / 2 + 0.05)
    add(tbox(f"end_l{s}", 0.1, CEIL, HW - 0.5, x, 0, -(HW + 0.5) / 2, P["white"]))
    add(tbox(f"end_r{s}", 0.1, CEIL, HW - 0.5, x, 0, (HW + 0.5) / 2, P["white"]))
    add(tbox(f"end_top{s}", 0.1, 0.3, 1.0, x, 2.0, 0, P["white"]))
    add(tbox(f"door{s}", 0.06, 2.0, 1.0, x - s * 0.02, 0, 0, P["red"]))
    add(tbox(f"doorwin{s}", 0.02, 0.5, 0.5, x - s * 0.06, 1.2, 0, P["ink"]))
    add(tbox(f"sign{s}", 0.02, 0.18, 0.7, x - s * 0.06, 2.06, 0, P["ink"]))
inner = lpm.finish("SM_TR_Inside", inside, P, budget=2200, ground=False, center=False)


def side_wall(name, side):
    z = side * (HW + 0.05)
    parts = [tbox(f"{name}_low", L, SILL, 0.1, 0, 0, z, P["white"]),
             tbox(f"{name}_stripe", L, 0.12, 0.11, 0, 0.55, z, P["red"]),
             tbox(f"{name}_high", L, CEIL - TOP, 0.1, 0, TOP, z, P["white"])]
    # pillars between the windows and at both ends
    edges = [-L / 2] + [b + s * 1.2 for b in BAYS for s in (-1, 1)] + [L / 2]
    for i in range(0, len(edges), 2):
        x0, x1 = edges[i], edges[i + 1]
        if x1 - x0 > 0.01:
            parts.append(tbox(f"{name}_p{i}", x1 - x0, TOP - SILL, 0.1, (x0 + x1) / 2, SILL, z, P["white"]))
    for b in BAYS:
        parts.append(tbox(f"{name}_sill{b}", 2.4, 0.04, 0.16, b, SILL - 0.02, z - side * 0.04, P["slate"]))
    return lpm.finish(name, parts, P, budget=300, ground=False, center=False)


ceiling = lpm.finish("SM_TR_Ceiling", [tbox("ceiling", L, 0.05, 2 * HW, 0, CEIL, 0, P["cream"]),
                                        tbox("light", L - 1.0, 0.02, 0.3, 0, CEIL - 0.02, 0, P["white"])], P, budget=40, ground=False, center=False)
wall_n = side_wall("SM_TR_WallN", -1)
wall_s = side_wall("SM_TR_WallS", 1)
panes = [tbox(f"pane{b}{s}", 2.4, TOP - SILL, 0.02, b, SILL, s * (HW + 0.05), P["white"]) for b in BAYS for s in (-1, 1)]
glass = lpm.finish("SM_TR_Win_glass", panes, P, budget=200, ground=False, center=False)
export_web(inner, P, extra=[ceiling, wall_n, wall_s, glass], slug="train_interior")
