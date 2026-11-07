"""
Sunny Bay sports props (Blender LPM, flat palette colours) -> apps/web/public/models/lpm/beach_sports.glb.

Objects (1 unit = 1 m, Z up, front = -Y; the game turns three Y-up so -Y here is +Z there):
  * SM_BS_Net: beach volleyball net between two poles 8 m apart (x = +-4), poles 2.55 m, top band at 2.43 m,
    net 0.9 m deep (1.5 ... 2.4 m). Court lines are drawn by the game (16 x 8 m).
  * SM_BS_Ball: volleyball, radius 0.11, pivot at its centre (z = 0 is the bottom of the ball).
  * SM_BS_Board: surfboard 2.0 long (Y, nose at -Y) x 0.56 wide x 0.06 thick, lying flat, pivot at its bottom centre.
    The game puts the surfer on it (deck top at 0.06).
  * SM_BS_Rack: surf school rack 3.0 (X) x 1.0 (Y), three boards standing in it, sign board 2.2 x 0.5 at 2.1 m
    facing -Y (text by the game).
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()
B = lpm.box

BOARD = [(0.0, -1.0), (0.12, -0.86), (0.23, -0.5), (0.28, 0.0), (0.25, 0.6), (0.16, 0.95), (-0.16, 0.95), (-0.25, 0.6), (-0.28, 0.0), (-0.23, -0.5), (-0.12, -0.86)]


def net():
    parts = []
    for x in (-4.0, 4.0):
        parts.append(lpm.prism(f"pole{x}", 8, 0.06, 2.55, at=(x, 0, 0), color=P["yellow"]))
        parts.append(lpm.prism(f"foot{x}", 8, 0.12, 0.08, at=(x, 0, 0), color=P["concrete_dark"]))
    parts.append(B("band", (7.9, 0.03, 0.07), at=(0, 0, 2.38), color=P["white"]))
    parts.append(B("bottom", (7.9, 0.02, 0.04), at=(0, 0, 1.5), color=P["white"]))
    for k in range(1, 4):
        parts.append(B(f"h{k}", (7.9, 0.012, 0.02), at=(0, 0, 1.5 + k * 0.22), color=P["ink"]))
    for k in range(13):
        x = -3.6 + k * 0.6
        parts.append(B(f"v{k}", (0.02, 0.012, 0.86), at=(x, 0, 1.52), color=P["ink"]))
    return lpm.finish("SM_BS_Net", parts, P, budget=360)


def ball():
    prof = [(0.0, 0.0)] + [(0.11 * math.sin(math.pi * k / 6), 0.11 - 0.11 * math.cos(math.pi * k / 6)) for k in range(1, 6)] + [(0.0, 0.22)]
    parts = [lpm.lathe("ball", prof, segments=8, color=P["white"])]
    parts.append(lpm.prism("band", 8, 0.112, 0.05, at=(0, 0, 0.085), color=P["blue"]))
    return lpm.finish("SM_BS_Ball", parts, P, budget=120)


def board():
    parts = [lpm.sweep("deck", BOARD, 0.06, color=P["orange"], axis="z")]
    parts.append(B("stripe", (0.06, 1.7, 0.004), at=(0, 0.0, 0.06), color=P["white"]))
    return lpm.finish("SM_BS_Board", parts, P, budget=80)


def rack():
    parts = []
    for x in (-1.45, 1.45):
        parts.append(B(f"post{x}", (0.1, 0.1, 2.35), at=(x, 0.3, 0), color=P["wood"]))
    parts.append(B("rail", (3.0, 0.1, 0.1), at=(0, 0.3, 1.2), color=P["wood_dark"]))
    parts.append(B("base", (3.0, 1.0, 0.12), at=(0, 0, 0), color=P["wood_dark"]))
    parts.append(B("sign", (2.2, 0.06, 0.5), at=(0, 0.24, 1.86), color=P["teal"]))
    for k, col in enumerate(("red", "yellow", "blue")):
        bd = lpm.sweep(f"board{k}", BOARD, 0.05, color=P[col], axis="z")
        lpm.scale(bd, 0.9, 0.9, 1.0)
        lpm.rotate(bd, -78, "X")
        lpm.move(bd, -0.8 + k * 0.8, 0.05, 1.0)
        parts.append(bd)
    return lpm.finish("SM_BS_Rack", parts, P, budget=260)


objs = [net(), ball(), board(), rack()]
export_web(objs[0], P, extra=objs[1:], slug="beach_sports", spread=[(0, 0, 0), (5.5, 0, 0), (7.5, 0, 0), (10.5, 0, 0)])
