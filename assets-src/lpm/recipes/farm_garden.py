"""
"My farm" garden decoration (Blender LPM, flat palette colours) -> apps/web/public/models/lpm/farm_garden.glb.

Objects (1 unit = 1 m, Z up, front = -Y; the game turns three Y-up so -Y here is +Z there). All pivots at the
bottom centre, nothing is walked on, so the game only adds a small blocker for the planter and the tree trunk.
  * SM_FG_Planter: wooden flower box 2.4 (X) x 0.7 (Y) x 0.32, soil top, two rows of flowers up to ~0.75 m.
  * SM_FG_Clump: a wild flower clump in the grass, ~0.7 m across, flowers up to ~0.45 m (instanced a lot).
  * SM_FG_Bush: round flowering bush ~1.3 m across, 0.9 m tall.
  * SM_FG_Sunflowers: three sunflowers 1.5 ... 1.9 m with leaves, faces turned to -Y (the game's +Z).
  * SM_FG_AppleTree: round fruit tree ~4.2 m, crown radius ~1.6 m, red apples; trunk radius 0.2.
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()
B = lpm.box
FLOWERS = ("red", "yellow", "white", "orange", "blue")


def ball(name, r, at, color, segments=6, squash=1.0):
    prof = [(0.0, -r * squash), (r * 0.75, -r * 0.6 * squash), (r, 0.0), (r * 0.75, r * 0.6 * squash), (0.0, r * squash)]
    return lpm.lathe(name, prof, segments=segments, at=at, color=color)


def flower(parts, name, x, y, h, col, head=0.07):
    parts.append(lpm.prism(f"{name}_stem", 4, 0.012, h, at=(x, y, 0), color=P["leaf_dark"]))
    parts.append(lpm.prism(f"{name}_head", 5, head, 0.04, at=(x, y, h - 0.01), color=P[col]))
    parts.append(lpm.prism(f"{name}_eye", 4, head * 0.35, 0.05, at=(x, y, h), color=P["yellow"] if col != "yellow" else P["orange"]))


def planter():
    parts = [B("box", (2.4, 0.7, 0.32), color=P["wood"])]
    parts.append(B("rim", (2.5, 0.8, 0.05), at=(0, 0, 0.3), color=P["wood_dark"]))
    parts.append(B("soil", (2.3, 0.6, 0.02), at=(0, 0, 0.32), color=P["soil"]))
    k = 0
    for row, y in enumerate((-0.15, 0.15)):
        for i in range(7):
            x = -1.0 + i * 0.33 + (0.16 if row else 0)
            if x > 1.05:
                continue
            flower(parts, f"f{k}", x, y, 0.62 + 0.08 * ((i + row) % 3), FLOWERS[(i * 2 + row) % len(FLOWERS)], head=0.1)
            k += 1
        parts.append(ball(f"leaves{row}", 0.16, (0.0, y, 0.38), P["leaf"], segments=5))
        lpm.scale(parts[-1], 6.5, 1.0, 0.5, about=(0.0, y, 0.38))
    return lpm.finish("SM_FG_Planter", parts, P, budget=420)


def clump():
    parts = [ball("leaf", 0.2, (0, 0, 0.08), P["leaf"], squash=0.6)]
    lpm.scale(parts[0], 1.5, 1.2, 1.0)
    for i, (x, y, h) in enumerate([(0.0, 0.0, 0.42), (0.18, 0.1, 0.32), (-0.17, 0.08, 0.36), (0.08, -0.17, 0.3), (-0.12, -0.14, 0.28)]):
        flower(parts, f"f{i}", x, y, h, FLOWERS[i % len(FLOWERS)], head=0.08)
    return lpm.finish("SM_FG_Clump", parts, P, budget=140)


def bush():
    parts = [ball("b0", 0.5, (0, 0, 0.42), P["leaf_dark"], segments=7, squash=0.85)]
    parts.append(ball("b1", 0.36, (0.38, 0.1, 0.32), P["leaf"], segments=6))
    parts.append(ball("b2", 0.34, (-0.36, -0.08, 0.3), P["leaf"], segments=6))
    for i in range(9):
        a = i * 2.39996
        r = 0.42 + 0.08 * (i % 2)
        z = 0.45 + 0.28 * math.sin(i * 1.7)
        parts.append(ball(f"fl{i}", 0.065, (math.cos(a) * r, math.sin(a) * r, z), P[("red", "white", "yellow")[i % 3]], segments=4))
    return lpm.finish("SM_FG_Bush", parts, P, budget=220)


def sunflowers():
    parts = []
    for i, (x, y, h) in enumerate([(-0.35, 0.05, 1.55), (0.0, -0.05, 1.9), (0.35, 0.08, 1.7)]):
        parts.append(lpm.prism(f"stem{i}", 5, 0.03, h, at=(x, y, 0), color=P["leaf_dark"]))
        for s in (-1, 1):
            lf = B(f"leaf{i}{s}", (0.28, 0.12, 0.02), at=(x + s * 0.15, y, h * (0.45 if s < 0 else 0.6)), color=P["leaf"])
            lpm.rotate(lf, s * 25, "Y", about=(x, y, h * 0.5))
            parts.append(lf)
        petals = lpm.prism(f"petals{i}", 10, 0.24, 0.04, at=(x, y, 0), color=P["yellow"])
        eye = lpm.prism(f"eye{i}", 8, 0.12, 0.06, at=(x, y, 0), color=P["bark"])
        for ob in (petals, eye):
            lpm.rotate(ob, 75, "X", about=(x, y, 0))
            lpm.move(ob, 0, -0.04, h)
            parts.append(ob)
    return lpm.finish("SM_FG_Sunflowers", parts, P, budget=260)


def apple_tree():
    parts = [lpm.prism("trunk", 6, 0.2, 2.0, radius_top=0.15, color=P["bark"])]
    crowns = [(0, 0, 2.9, 1.35, "leaf"), (0.75, 0.35, 2.45, 0.85, "leaf_dark"), (-0.7, -0.3, 2.5, 0.85, "leaf_dark"), (0.1, -0.6, 3.5, 0.8, "leaf_light")]
    for k, (x, y, z, r, c) in enumerate(crowns):
        b = ball(f"crown{k}", r, (x, y, z), P[c], segments=7, squash=0.9)
        lpm.rotate(b, k * 23, "Z")
        parts.append(b)
    for i in range(10):
        a = i * 2.39996
        e = 0.35 + 0.5 * ((i * 7) % 5) / 5
        r = 1.3 * math.cos(e - 0.4)
        parts.append(ball(f"apple{i}", 0.09, (math.cos(a) * r, math.sin(a) * r, 2.6 + 0.9 * math.sin(e - 0.4)), P["red"], segments=4))
    return lpm.finish("SM_FG_AppleTree", parts, P, budget=420)


objs = [planter(), clump(), bush(), sunflowers(), apple_tree()]
export_web(objs[0], P, extra=objs[1:], slug="farm_garden", spread=[(0, 0, 0), (2.4, 0, 0), (3.8, 0, 0), (5.6, 0, 0), (8.4, 0, 0)])
