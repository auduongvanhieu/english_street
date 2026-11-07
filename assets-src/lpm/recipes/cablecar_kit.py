"""
Maple Hill cable car (Blender LPM, flat palette colours) -> apps/web/public/models/lpm/cablecar_kit.glb.

Objects (1 unit = 1 m, Z up, front = -Y):
  * SM_CC_Gondola: cabin 1.8 (X) x 1.6 (Y) x 1.9 high, floor at z 0.05, open doorway on the -Y side (1.0 wide),
    windows all round from 1.0 to 1.7 m, hanger arm up to the grip at z 3.4 (the game hangs the cabin by this point:
    cable height - 3.4). Two benches along X inside (seats at y +-0.5, 0.45 high).
  * SM_CC_Pylon: steel pylon 9 m high, crossarm 3.2 wide (X) at the top with sheaves at x +-1.3 (z 9.0), so the
    two cables run along Y at x +-1.3, height 9.0 above the pylon foot.
  * SM_CC_Station: open station 6 (X) x 5 (Y): platform 0.4 high, four posts, roof at 4.6, bullwheel r 1.3 at
    z 4.0 turning the cables at x +-1.3; sign board 3.0 x 0.6 at 3.9 m facing -Y (text by the game).
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()
B = lpm.box


def gondola():
    parts = [B("floor", (1.8, 1.6, 0.1), at=(0, 0, 0.0), color=P["slate_dark"])]
    # walls: back (+Y), sides, and the front either side of the doorway
    parts.append(B("back", (1.8, 0.06, 0.95), at=(0, 0.77, 0.1), color=P["red"]))
    for x in (-0.87, 0.87):
        parts.append(B(f"side{x}", (0.06, 1.6, 0.95), at=(x, 0, 0.1), color=P["red"]))
    for x in (-0.65, 0.65):
        parts.append(B(f"front{x}", (0.5, 0.06, 1.85), at=(x, -0.77, 0.1), color=P["red"]))
    parts.append(B("lintel", (1.8, 0.06, 0.2), at=(0, -0.77, 1.75), color=P["red"]))
    # window frames (the openings are left open: you look out of the cabin) and the roof band
    for x in (-0.87, 0.87):
        for y in (-0.5, 0.5):
            parts.append(B(f"mull{x}{y}", (0.07, 0.07, 0.72), at=(x, y, 1.03), color=P["white"]))
    for y in (-0.77, 0.77):
        parts.append(B(f"top{y}", (1.8, 0.07, 0.2), at=(0, y, 1.75), color=P["red"]))
    for x in (-0.87, 0.87):
        parts.append(B(f"tops{x}", (0.07, 1.6, 0.2), at=(x, 0, 1.75), color=P["red"]))
    parts.append(B("roof", (1.95, 1.75, 0.12), at=(0, 0, 1.94), color=P["white"], taper=(0.85, 0.85)))
    for y in (-0.5, 0.5):
        parts.append(B(f"bench{y}", (1.5, 0.35, 0.45), at=(0, y * 1.0, 0.1), color=P["wood"]))
    parts.append(B("hanger", (0.1, 0.1, 1.3), at=(0, 0, 2.05), color=P["steel"]))
    parts.append(B("arm", (0.1, 0.5, 0.1), at=(0, 0.2, 3.25), color=P["steel"]))
    parts.append(B("grip", (0.3, 0.2, 0.18), at=(0, 0.0, 3.32), color=P["slate"]))
    return lpm.finish("SM_CC_Gondola", parts, P, budget=420)


def pylon():
    parts = [B("foot", (1.6, 1.6, 0.4), color=P["concrete"])]
    parts.append(B("mast", (0.9, 0.9, 8.4), at=(0, 0, 0.4), color=P["slate"], taper=(0.45, 0.45)))
    for k in range(3):
        parts.append(B(f"ring{k}", (0.95 - k * 0.15, 0.95 - k * 0.15, 0.08), at=(0, 0, 2.2 + k * 2.2), color=P["yellow"]))
    parts.append(B("arm", (3.2, 0.3, 0.3), at=(0, 0, 8.6), color=P["slate_dark"]))
    for x in (-1.3, 1.3):
        sh = lpm.prism(f"sheave{x}", 10, 0.22, 0.08, at=(0, 0, -0.04), color=P["steel"])
        lpm.rotate(sh, 90, "Y")
        lpm.move(sh, x, 0, 9.0)
        parts.append(sh)
    return lpm.finish("SM_CC_Pylon", parts, P, budget=220)


def station():
    parts = [B("platform", (6.0, 5.0, 0.4), color=P["concrete"])]
    parts.append(B("edge", (6.02, 0.15, 0.04), at=(0, -2.43, 0.4), color=P["yellow"]))
    for x in (-2.8, 2.8):
        for y in (-2.3, 2.3):
            parts.append(B(f"post{x}{y}", (0.25, 0.25, 4.3), at=(x, y, 0.4), color=P["wood_dark"]))
    parts.append(B("roof", (6.6, 5.6, 0.18), at=(0, 0, 4.7), color=P["barn_red"], taper=(0.92, 0.9)))
    wheel = lpm.prism("wheel", 16, 1.3, 0.12, color=P["steel"])
    lpm.move(wheel, 0, 0.4, 3.95)
    parts.append(wheel)
    parts.append(B("hub", (0.3, 0.3, 0.7), at=(0, 0.4, 4.0), color=P["slate_dark"]))
    parts.append(B("sign", (3.0, 0.08, 0.6), at=(0, -2.45, 3.85), color=P["green"]))
    parts.append(B("gate", (1.2, 0.08, 1.0), at=(-1.6, -1.2, 0.4), color=P["white"]))
    return lpm.finish("SM_CC_Station", parts, P, budget=280)


objs = [gondola(), pylon(), station()]
export_web(objs[0], P, extra=objs[1:], slug="cablecar_kit", spread=[(0, 0, 0), (4, 0, 0), (10, 0, 0)])
