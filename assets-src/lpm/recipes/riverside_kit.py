"""Riverside kit - the market village reached by train (scene/areas/places/Riverside.tsx).

Game contract (Blender axes; three = (x, z, -y)); pivot = floor centre, front towards -Y (three +Z) unless noted.
  * SM_RS_StallRed / SM_RS_StallGreen: market stall 3.0 wide x 1.6 deep, counter front (-Y) top at 0.95,
    striped awning up to 2.6 m; a sign board above the awning front at 2.75 m (text by the game).
  * SM_RS_Crates: three fruit crates stacked, 1.2 x 0.6.
  * SM_RS_Mill: water-mill house 6 x 5 (walls 4 m, roof ridge ~6.3 m), the wheel side is +X (three +X):
    the wheel axle sits at three (3.35, 1.6, 0); the wheel is a separate object.
  * SM_RS_Wheel: mill wheel, radius 1.8, 0.5 thick, axle along X, pivot = axle centre (the game spins it).
  * SM_RS_Bridge: stone arch footbridge, 3.2 wide (X) x 16 long (Y), deck top at 0.15 (flat ends), arch underneath.
  * SM_RS_Bench: park bench 1.6 long, seat 0.45 high, back towards +Y (three -Z).
  * SM_RS_PostBox: red pillar box 1.2 m.
  * SM_RS_Parasol: café table with a parasol (2.2 wide, 2.3 high).
  * SM_RS_Cottage: cottage 6 x 5, door on the front (-Y), roof ridge ~5.5 m.
  * SM_RS_Shelter: station shelter 6 x 2.2 (open front -Y, roof 2.8 m) with a bench, sign at 2.2 m.
  * SM_RS_Duck: a duck 0.35 long, pivot on the water line, head towards -Y.
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()
B = lpm.box


def stall(name, col):
    parts = [B("counter", (3.0, 0.8, 0.95), at=(0, -0.4, 0), color=P["wood"])]
    parts.append(B("top", (3.1, 0.9, 0.06), at=(0, -0.4, 0.95), color=P["wood_dark"]))
    for x in (-1.45, 1.45):
        for y in (-0.75, 0.75):
            parts.append(B(f"post{x}{y}", (0.08, 0.08, 2.5), at=(x, y, 0), color=P["wood_dark"]))
    parts.append(B("back", (3.0, 0.06, 1.6), at=(0, 0.75, 0.6), color=P["cream"]))
    # striped awning, sloping down to the front
    for k in range(6):
        a = B(f"aw{k}", (0.5, 1.9, 0.05), at=(-1.25 + k * 0.5, -0.1, 2.45), color=P[col] if k % 2 == 0 else P["white"])
        lpm.rotate(a, -14, "X", about=(0, -0.1, 2.45))
        parts.append(a)
    parts.append(B("sign", (2.0, 0.06, 0.4), at=(0, -1.05, 2.55), color=P["cream"]))
    # some goods on the counter
    for k, x in enumerate((-1.0, -0.3, 0.4, 1.05)):
        parts.append(B(f"box{k}", (0.5, 0.4, 0.16), at=(x, -0.45, 1.0), color=P["wood"]))
        parts.append(B(f"fill{k}", (0.44, 0.34, 0.06), at=(x, -0.45, 1.14), color=P[("red", "yellow", "green", "orange")[k]]))
    return lpm.finish(name, parts, P, budget=230)


def crates():
    parts = []
    for k, (x, z) in enumerate([(-0.3, 0), (0.32, 0), (0, 0.36)]):
        parts.append(B(f"c{k}", (0.58, 0.5, 0.34), at=(x, 0, z), color=P["wood"]))
        parts.append(B(f"f{k}", (0.5, 0.42, 0.04), at=(x, 0, z + 0.32), color=P[("red", "green", "orange")[k]]))
    return lpm.finish("SM_RS_Crates", parts, P, budget=60)


def mill():
    parts = [B("walls", (6.0, 5.0, 4.0), color=P["cream"])]
    parts.append(B("base", (6.2, 5.2, 0.6), color=P["concrete_dark"]))
    parts.append(B("door", (1.1, 0.06, 2.0), at=(-1.2, -2.52, 0.0), color=P["wood_dark"]))
    for x in (0.8, 2.0):
        parts.append(B(f"win{x}", (0.7, 0.05, 0.8), at=(x, -2.52, 1.6), color=P["water_light"]))
    parts.append(B("winup", (0.9, 0.05, 0.7), at=(0, -2.52, 3.0), color=P["water_light"]))
    for y in (-2.5, 2.5):
        parts.append(B(f"gable{y}", (6.0, 0.2, 2.2), at=(0, y * 0.98, 4.0), color=P["cream"], taper=(0.02, 1.0)))
    for s in (-1, 1):
        r = B(f"roof{s}", (3.9, 5.6, 0.16), at=(s * 1.6, 0, 5.05), color=P["barn_red_dark"])
        lpm.rotate(r, s * 36, "Y", about=(s * 1.6, 0, 5.13))
        parts.append(r)
    parts.append(B("axle", (0.5, 0.3, 0.3), at=(3.15, 0, 1.45), color=P["wood_dark"]))
    return lpm.finish("SM_RS_Mill", parts, P, budget=260)


def wheel():
    parts = []
    for side in (-0.22, 0.22):
        ring = lpm.prism(f"rim{side}", 12, 1.8, 0.06, at=(0, 0, side - 0.03), color=P["wood_dark"])
        parts.append(ring)
    parts.append(lpm.prism("hub", 8, 0.3, 0.5, at=(0, 0, -0.25), color=P["wood_dark"]))
    for k in range(8):
        pad = B(f"pad{k}", (0.12, 0.5, 0.5), at=(1.6, 0, -0.25), color=P["wood"])
        lpm.rotate(pad, k * 45, "Z", about=(0, 0, 0))
        parts.append(pad)
        sp = B(f"spoke{k}", (1.6, 0.08, 0.08), at=(0.8, 0, -0.04), color=P["wood"])
        lpm.rotate(sp, k * 45, "Z", about=(0, 0, 0))
        parts.append(sp)
    obj = lpm.finish("SM_RS_Wheel", parts, P, budget=300, ground=False, center=False)
    # axle along X: the disc above lies in XY (axle Z); turn it so the axle runs along X
    lpm.rotate(obj, 90, "Y")
    return obj


def bridge():
    parts = []
    # the deck: flat ends and a gentle middle (kept flat for walking)
    parts.append(B("deck", (3.2, 16.0, 0.3), at=(0, 0, -0.15), color=P["concrete"]))
    for x in (-1.5, 1.5):
        parts.append(B(f"wall{x}", (0.25, 16.0, 0.9), at=(x, 0, 0.15), color=P["concrete_dark"]))
    # stone body under the deck (into the water) and piers at the ends
    parts.append(B("body", (3.0, 15.6, 0.9), at=(0, 0, -1.05), color=P["concrete_dark"]))
    for y in (-7.6, 7.6):
        for x in (-1.5, 1.5):
            parts.append(B(f"pier{x}{y}", (0.4, 0.4, 1.3), at=(x, y, -0.15), color=P["concrete"]))
    return lpm.finish("SM_RS_Bridge", parts, P, budget=140, ground=False, center=False)


def bench():
    parts = [B("seat", (1.6, 0.45, 0.06), at=(0, 0, 0.42), color=P["wood"])]
    back = B("back", (1.6, 0.05, 0.45), at=(0, 0.24, 0.5), color=P["wood"])
    lpm.rotate(back, 10, "X", about=(0, 0.24, 0.5))
    parts.append(back)
    for x in (-0.7, 0.7):
        parts.append(B(f"leg{x}", (0.06, 0.45, 0.42), at=(x, 0, 0), color=P["slate_dark"]))
    return lpm.finish("SM_RS_Bench", parts, P, budget=50)


def postbox():
    parts = [lpm.prism("body", 10, 0.25, 1.05, color=P["red"]), lpm.lathe("cap", [(0.0, 1.05), (0.29, 1.05), (0.27, 1.15), (0.0, 1.22)], segments=10, color=P["red"])]
    parts.append(B("slot", (0.24, 0.03, 0.04), at=(0, -0.25, 0.85), color=P["ink"]))
    parts.append(B("foot", (0.6, 0.6, 0.06), color=P["ink"]))
    return lpm.finish("SM_RS_PostBox", parts, P, budget=120)


def parasol():
    parts = [lpm.prism("pole", 6, 0.03, 2.3, color=P["white"]), lpm.prism("table", 8, 0.45, 0.04, at=(0, 0, 0.72), color=P["white"])]
    parts.append(lpm.prism("leg", 6, 0.04, 0.72, color=P["slate_dark"]))
    parts.append(lpm.lathe("canopy", [(0.0, 2.45), (1.1, 2.05), (1.12, 2.0), (0.0, 2.25)], segments=8, color=P["green"]))
    return lpm.finish("SM_RS_Parasol", parts, P, budget=110)


def cottage():
    parts = [B("walls", (6.0, 5.0, 3.0), color=P["cream"])]
    parts.append(B("door", (1.0, 0.06, 1.9), at=(0, -2.52, 0), color=P["teal"]))
    for x in (-1.8, 1.8):
        parts.append(B(f"win{x}", (0.9, 0.05, 0.8), at=(x, -2.52, 1.2), color=P["water_light"]))
    for y in (-2.5, 2.5):
        parts.append(B(f"gable{y}", (6.0, 0.2, 2.2), at=(0, y * 0.98, 3.0), color=P["cream"], taper=(0.02, 1.0)))
    for s in (-1, 1):
        r = B(f"roof{s}", (3.9, 5.6, 0.16), at=(s * 1.6, 0, 4.05), color=P["slate"])
        lpm.rotate(r, s * 36, "Y", about=(s * 1.6, 0, 4.13))
        parts.append(r)
    parts.append(B("chimney", (0.5, 0.5, 1.4), at=(1.8, 1.0, 4.2), color=P["barn_red"]))
    return lpm.finish("SM_RS_Cottage", parts, P, budget=120)


def shelter():
    parts = [B("floor", (6.0, 2.2, 0.15), color=P["concrete"])]
    parts.append(B("back", (6.0, 0.1, 2.6), at=(0, 1.05, 0.15), color=P["green"]))
    for x in (-2.95, 2.95):
        parts.append(B(f"side{x}", (0.1, 2.2, 2.6), at=(x, 0, 0.15), color=P["green"]))
    parts.append(B("roof", (6.4, 2.6, 0.12), at=(0, -0.1, 2.75), color=P["white"]))
    parts.append(B("bench", (3.0, 0.5, 0.45), at=(0, 0.7, 0.15), color=P["wood"]))
    parts.append(B("sign", (2.4, 0.06, 0.5), at=(0, -1.2, 2.2), color=P["blue_dark"]))
    return lpm.finish("SM_RS_Shelter", parts, P, budget=120)


def duck():
    parts = [lpm.lathe("body", [(0.0, 0.0), (0.15, 0.03), (0.16, 0.1), (0.0, 0.16)], segments=7, color=P["white"])]
    lpm.rotate(parts[0], 90, "X")
    parts.append(lpm.prism("head", 6, 0.07, 0.12, at=(0, -0.13, 0.12), color=P["green"]))
    parts.append(B("beak", (0.05, 0.08, 0.03), at=(0, -0.22, 0.18), color=P["orange"]))
    return lpm.finish("SM_RS_Duck", parts, P, budget=70)


objs = [stall("SM_RS_StallRed", "red"), stall("SM_RS_StallGreen", "green"), crates(), mill(), wheel(), bridge(), bench(), postbox(), parasol(), cottage(), shelter(), duck()]
export_web(objs[0], P, extra=objs[1:], slug="riverside_kit", spread=6.0)
