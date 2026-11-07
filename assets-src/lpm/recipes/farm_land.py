"""
Country around "My farm" (Blender LPM, flat palette colours) -> apps/web/public/models/lpm/farm_land.glb.

Everything stands outside the farm fence (scene/areas/places/MyFarmLand.tsx places and merges them, one draw call).
Objects (1 unit = 1 m, Z up, front = -Y; the game turns three Y-up so -Y here is +Z there), pivots at the bottom centre:
  * SM_FL_Hill: a low grassy hill, 24 m across, 6 m high (backdrop ring, scaled per copy).
  * SM_FL_Pine: pine 5.5 m (trunk + three cones).
  * SM_FL_Oak: round leafy tree 5 m, crown radius ~2 m.
  * SM_FL_Pond: pond 9 x 7 m (water at 0.04 m), stone rim, reeds and lily pads.
  * SM_FL_Wheat: wheat field 6 x 4 m, eight golden rows 0.7 m high.
  * SM_FL_House: neighbour's farmhouse 6 x 5 m, roof ridge 5.2 m, chimney; front door faces -Y.
  * SM_FL_Mailbox: mailbox on a post, 1.25 m.
  * SM_FL_Wall: dry stone wall 4 m long, 0.7 m high (along X).
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()
B = lpm.box


def ball(name, r, at, color, segments=6, squash=1.0):
    prof = [(0.0, -r * squash), (r * 0.75, -r * 0.6 * squash), (r, 0.0), (r * 0.75, r * 0.6 * squash), (0.0, r * squash)]
    return lpm.lathe(name, prof, segments=segments, at=at, color=color)


def hill():
    h = lpm.lathe("hill", [(0.0, 0.0), (12.0, 0.0), (11.0, 1.4), (8.0, 3.6), (4.0, 5.4), (0.0, 6.0)], segments=12, color=P["leaf"])
    lpm.scale(h, 1.0, 0.75, 1.0)
    return lpm.finish("SM_FL_Hill", [h], P, budget=200)


def pine():
    parts = [lpm.prism("trunk", 5, 0.2, 1.4, radius_top=0.15, color=P["bark"])]
    for k, (r, hgt, z) in enumerate([(1.6, 2.2, 1.0), (1.2, 2.0, 2.4), (0.8, 1.7, 3.7)]):
        parts.append(lpm.prism(f"cone{k}", 7, r, hgt, radius_top=0.02, at=(0, 0, z), color=P["leaf_dark"] if k != 1 else P["green"]))
    return lpm.finish("SM_FL_Pine", parts, P, budget=100)


def oak():
    parts = [lpm.prism("trunk", 6, 0.28, 2.4, radius_top=0.2, color=P["bark"])]
    for k, (x, y, z, r, c) in enumerate([(0, 0, 3.4, 1.9, "leaf"), (1.1, 0.4, 2.9, 1.2, "leaf_dark"), (-1.0, -0.5, 3.0, 1.2, "leaf_dark"), (0.2, -0.9, 4.3, 1.1, "leaf_light")]):
        b = ball(f"crown{k}", r, (x, y, z), P[c], segments=7, squash=0.85)
        lpm.rotate(b, k * 31, "Z")
        parts.append(b)
    return lpm.finish("SM_FL_Oak", parts, P, budget=220)


def pond():
    parts = []
    water = lpm.prism("water", 14, 4.5, 0.04, color=P["water"])
    lpm.scale(water, 1.0, 0.78, 1.0)
    parts.append(water)
    mud = lpm.prism("mud", 14, 4.9, 0.03, color=P["soil"])
    lpm.scale(mud, 1.0, 0.8, 1.0)
    parts.append(mud)
    for i in range(16):
        a = i / 16 * math.tau
        s = B(f"stone{i}", (0.55, 0.4, 0.22), at=(math.cos(a) * 4.75, math.sin(a) * 3.75, 0.0), color=P["concrete"] if i % 3 else P["concrete_dark"])
        lpm.rotate(s, math.degrees(a) + 90, "Z", about=(math.cos(a) * 4.75, math.sin(a) * 3.75, 0))
        parts.append(s)
    for i, (x, y) in enumerate([(-3.6, 1.6), (-3.9, 1.0), (-3.3, 2.1), (3.4, -1.9), (3.8, -1.3)]):
        parts.append(lpm.prism(f"reed{i}", 4, 0.04, 1.1 + 0.2 * (i % 2), radius_top=0.01, at=(x, y, 0), color=P["leaf_dark"]))
        parts.append(lpm.prism(f"cat{i}", 5, 0.06, 0.22, at=(x, y, 0.85 + 0.2 * (i % 2)), color=P["bark"]))
    for i, (x, y) in enumerate([(1.2, 1.0), (-0.8, -1.4), (2.2, -0.2), (-1.8, 0.6)]):
        parts.append(lpm.prism(f"pad{i}", 7, 0.35, 0.02, at=(x, y, 0.045), color=P["green"]))
    parts.append(ball("flower", 0.09, (1.2, 1.0, 0.12), P["white"], segments=5))
    return lpm.finish("SM_FL_Pond", parts, P, budget=420)


def wheat():
    parts = [B("soil", (6.0, 4.0, 0.08), color=P["soil"])]
    for r in range(8):
        y = -1.75 + r * 0.5
        row = lpm.sweep(f"row{r}", [(-2.9, 0.0), (2.9, 0.0), (2.85, 0.55), (-2.85, 0.6)], 0.32, at=(0, y, 0.06), color=P["hay"] if r % 2 else P["hay_dark"])
        parts.append(row)
    return lpm.finish("SM_FL_Wheat", parts, P, budget=220)


def house():
    parts = [B("walls", (6.0, 5.0, 3.0), color=P["cream"])]
    roof = lpm.sweep("roof", [(-3.4, 0.0), (3.4, 0.0), (0.0, 2.2)], 5.6, at=(0, 0, 3.0), color=P["barn_red"])
    parts.append(roof)
    parts.append(B("chimney", (0.6, 0.6, 1.6), at=(1.8, 1.2, 4.0), color=P["concrete_dark"]))
    parts.append(B("door", (1.0, 0.08, 2.0), at=(0, -2.52, 0), color=P["wood_dark"]))
    for x in (-1.9, 1.9):
        parts.append(B(f"win{x}", (1.0, 0.08, 0.9), at=(x, -2.52, 1.4), color=P["blue_dark"]))
        parts.append(B(f"sill{x}", (1.2, 0.16, 0.08), at=(x, -2.56, 1.36), color=P["white"]))
    parts.append(B("step", (1.6, 0.6, 0.2), at=(0, -2.8, 0), color=P["concrete"]))
    return lpm.finish("SM_FL_House", parts, P, budget=300)


def mailbox():
    parts = [B("post", (0.1, 0.1, 1.0), color=P["wood"])]
    parts.append(B("box", (0.3, 0.5, 0.25), at=(0, 0, 1.0), color=P["red"]))
    parts.append(B("flag", (0.03, 0.12, 0.2), at=(0.17, 0.1, 1.1), color=P["yellow"]))
    return lpm.finish("SM_FL_Mailbox", parts, P, budget=60)


def wall():
    parts = []
    for i in range(7):
        x = -1.75 + i * 0.58
        parts.append(B(f"low{i}", (0.6, 0.55, 0.38), at=(x, 0, 0), color=P["concrete"] if i % 2 else P["concrete_dark"]))
        if i < 6:
            parts.append(B(f"up{i}", (0.56, 0.5, 0.32), at=(x + 0.29, 0.02, 0.37), color=P["concrete_dark"] if i % 2 else P["concrete"]))
    return lpm.finish("SM_FL_Wall", parts, P, budget=160)


objs = [hill(), pine(), oak(), pond(), wheat(), house(), mailbox(), wall()]
export_web(objs[0], P, extra=objs[1:], slug="farm_land", spread=[(0, 0, 0), (16, 0, 0), (21, 0, 0), (30, 0, 0), (39, 0, 0), (47, 0, 0), (53, 0, 0), (57, 0, 0)])
