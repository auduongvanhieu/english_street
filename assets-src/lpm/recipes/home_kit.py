"""Home furniture kit - what players buy and place in "My room" (scene/areas/places/MyRoom.tsx, @es/shared home.ts).

Game contract (Blender axes; three = (x, z, -y)): every piece has its pivot at the floor centre of its footprint and its
front towards -Y (three +Z). Footprints (x by y, metres) must match FURNITURE in packages/shared/src/home.ts:
  bed 1.4x2.0 · sofa 1.8x0.85 · armchair 0.85x0.85 · table 1.2x0.8 · chair 0.5x0.5 · desk 1.2x0.6 · lamp 0.4x0.4
  bookshelf 1.0x0.35 · plant 0.5x0.5 · rug 2.0x1.4 (flat) · tv 1.2x0.45 · wardrobe 1.2x0.6 · clock 0.4x0.1 (wall,
  centre at 1.7) · picture 0.8x0.06 (wall, centre at 1.5) · fridge 0.7x0.7 · cooker 0.7x0.65
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()
B = lpm.box


def bed():
    parts = [B("frame", (1.4, 2.0, 0.3), at=(0, 0, 0.05), color=P["wood"])]
    parts.append(B("mattress", (1.34, 1.94, 0.18), at=(0, 0, 0.35), color=P["white"]))
    parts.append(B("blanket", (1.36, 1.3, 0.06), at=(0, -0.3, 0.5), color=P["blue"]))
    parts.append(B("pillow", (1.0, 0.35, 0.12), at=(0, 0.72, 0.53), color=P["cream"]))
    parts.append(B("head", (1.4, 0.08, 0.95), at=(0, 0.96, 0.05), color=P["wood_dark"]))
    for x in (-0.65, 0.65):
        for y in (-0.95, 0.95):
            parts.append(B(f"leg{x}{y}", (0.08, 0.08, 0.05), at=(x, y, 0), color=P["wood_dark"]))
    return lpm.finish("SM_HM_Bed", parts, P, budget=140)


def sofa():
    parts = [B("base", (1.8, 0.85, 0.4), at=(0, 0, 0.05), color=P["teal"])]
    parts.append(B("back", (1.8, 0.2, 0.45), at=(0, 0.32, 0.45), color=P["teal"]))
    for x in (-0.82, 0.82):
        parts.append(B(f"arm{x}", (0.16, 0.85, 0.3), at=(x, 0, 0.45), color=P["teal"]))
    for x in (-0.42, 0.42):
        parts.append(B(f"cushion{x}", (0.78, 0.6, 0.1), at=(x, -0.08, 0.45), color=P["green"]))
    parts.append(B("feet", (1.7, 0.75, 0.05), at=(0, 0, 0), color=P["wood_dark"]))
    return lpm.finish("SM_HM_Sofa", parts, P, budget=120)


def armchair():
    parts = [B("base", (0.85, 0.85, 0.4), at=(0, 0, 0.05), color=P["orange"])]
    parts.append(B("back", (0.85, 0.18, 0.5), at=(0, 0.33, 0.45), color=P["orange"]))
    for x in (-0.36, 0.36):
        parts.append(B(f"arm{x}", (0.13, 0.85, 0.25), at=(x, 0, 0.45), color=P["orange"]))
    parts.append(B("feet", (0.75, 0.75, 0.05), at=(0, 0, 0), color=P["wood_dark"]))
    return lpm.finish("SM_HM_Armchair", parts, P, budget=80)


def table():
    parts = [B("top", (1.2, 0.8, 0.05), at=(0, 0, 0.72), color=P["wood"])]
    for x in (-0.53, 0.53):
        for y in (-0.33, 0.33):
            parts.append(B(f"leg{x}{y}", (0.06, 0.06, 0.72), at=(x, y, 0), color=P["wood_dark"]))
    parts.append(lpm.prism("vase", 6, 0.06, 0.18, at=(0.3, 0, 0.77), color=P["blue"]))
    return lpm.finish("SM_HM_Table", parts, P, budget=80)


def chair():
    parts = [B("seat", (0.46, 0.46, 0.05), at=(0, 0, 0.44), color=P["wood"])]
    parts.append(B("back", (0.46, 0.05, 0.45), at=(0, 0.2, 0.49), color=P["wood"]))
    for x in (-0.19, 0.19):
        for y in (-0.19, 0.19):
            parts.append(B(f"leg{x}{y}", (0.04, 0.04, 0.44), at=(x, y, 0), color=P["wood_dark"]))
    return lpm.finish("SM_HM_Chair", parts, P, budget=70)


def desk():
    parts = [B("top", (1.2, 0.6, 0.04), at=(0, 0, 0.72), color=P["white"])]
    parts.append(B("drawers", (0.4, 0.55, 0.7), at=(0.38, 0, 0.02), color=P["white"]))
    parts.append(B("leg", (0.04, 0.55, 0.72), at=(-0.56, 0, 0), color=P["steel"]))
    parts.append(B("laptop", (0.34, 0.24, 0.02), at=(-0.15, -0.05, 0.76), color=P["slate"]))
    lid = B("lid", (0.34, 0.02, 0.22), at=(-0.15, 0.07, 0.77), color=P["slate_dark"])
    lpm.rotate(lid, -15, "X", about=(-0.15, 0.07, 0.77))
    parts.append(lid)
    return lpm.finish("SM_HM_Desk", parts, P, budget=80)


def lamp():
    parts = [lpm.prism("base", 8, 0.16, 0.04, color=P["slate_dark"])]
    parts.append(lpm.prism("pole", 6, 0.02, 1.35, at=(0, 0, 0.04), color=P["steel"]))
    parts.append(lpm.prism("shade", 8, 0.2, 0.28, radius_top=0.12, at=(0, 0, 1.3), color=P["cream"]))
    return lpm.finish("SM_HM_Lamp", parts, P, budget=80)


def bookshelf():
    parts = [B("back", (1.0, 0.03, 1.8), at=(0, 0.16, 0), color=P["wood_dark"])]
    for x in (-0.48, 0.48):
        parts.append(B(f"side{x}", (0.04, 0.35, 1.8), at=(x, 0, 0), color=P["wood"]))
    for k, z in enumerate((0.02, 0.45, 0.9, 1.35, 1.76)):
        parts.append(B(f"shelf{k}", (0.92, 0.33, 0.03), at=(0, 0, z), color=P["wood"]))
    cols = [P["red"], P["blue"], P["green"], P["yellow"], P["orange"], P["teal"]]
    for k, z in enumerate((0.05, 0.48, 0.93, 1.38)):
        x = -0.4
        i = 0
        while x < 0.38:
            w = 0.05 + ((i * 7 + k) % 3) * 0.02
            parts.append(B(f"book{k}{i}", (w, 0.24, 0.28 + ((i + k) % 3) * 0.04), at=(x + w / 2, -0.02, z), color=cols[(i + k) % len(cols)]))
            x += w + 0.01
            i += 1
    return lpm.finish("SM_HM_Bookshelf", parts, P, budget=320)


def plant():
    parts = [lpm.prism("pot", 8, 0.16, 0.3, radius_top=0.2, color=P["orange"])]
    parts.append(lpm.prism("soil", 8, 0.18, 0.02, at=(0, 0, 0.28), color=P["soil"]))
    for k in range(5):
        a = k * 2 * math.pi / 5
        leaf = B(f"leaf{k}", (0.12, 0.04, 0.55), at=(0, 0, 0.3), color=P["leaf"] if k % 2 else P["leaf_dark"], taper=(0.2, 1.0))
        lpm.rotate(leaf, 25, "X", about=(0, 0, 0.3))
        lpm.rotate(leaf, math.degrees(a), "Z", about=(0, 0, 0))
        parts.append(leaf)
    return lpm.finish("SM_HM_Plant", parts, P, budget=120)


def rug():
    parts = [B("rug", (2.0, 1.4, 0.015), color=P["carpet"])]
    parts.append(B("inner", (1.6, 1.0, 0.004), at=(0, 0, 0.015), color=P["cream"]))
    return lpm.finish("SM_HM_Rug", parts, P, budget=30)


def tv():
    parts = [B("cabinet", (1.2, 0.45, 0.45), color=P["wood_dark"])]
    parts.append(B("stand", (0.25, 0.15, 0.05), at=(0, 0.05, 0.45), color=P["slate_dark"]))
    parts.append(B("screen", (1.0, 0.06, 0.6), at=(0, 0.05, 0.5), color=P["ink"]))
    parts.append(B("glass", (0.92, 0.01, 0.52), at=(0, 0.015, 0.54), color=P["blue_dark"]))
    return lpm.finish("SM_HM_TV", parts, P, budget=60)


def wardrobe():
    parts = [B("body", (1.2, 0.6, 2.0), color=P["wood"])]
    parts.append(B("split", (0.02, 0.01, 1.9), at=(0, -0.3, 0.05), color=P["wood_dark"]))
    for x in (-0.08, 0.08):
        parts.append(B(f"knob{x}", (0.03, 0.03, 0.15), at=(x, -0.31, 1.0), color=P["gold"]))
    return lpm.finish("SM_HM_Wardrobe", parts, P, budget=60)


def clock():
    parts = [lpm.prism("face", 12, 0.2, 0.05, color=P["white"])]
    parts.append(lpm.prism("rim", 12, 0.22, 0.04, color=P["red"]))
    parts.append(B("hand1", (0.02, 0.01, 0.15), at=(0, 0, 0.05), color=P["ink"]))
    parts.append(B("hand2", (0.11, 0.01, 0.02), at=(0.05, 0, 0.05), color=P["ink"]))
    o = lpm.finish("SM_HM_Clock", parts, P, budget=80, ground=False)
    lpm.rotate(o, 90, "X")
    return o


def picture():
    parts = [B("frame", (0.8, 0.06, 0.6), color=P["gold"])]
    parts.append(B("art", (0.7, 0.01, 0.5), at=(0, -0.03, 0.05), color=P["blue"]))
    parts.append(B("sun", (0.12, 0.012, 0.12), at=(0.18, -0.035, 0.38), color=P["yellow"]))
    parts.append(B("hill", (0.6, 0.012, 0.16), at=(-0.03, -0.035, 0.06), color=P["green"], taper=(0.3, 1.0)))
    return lpm.finish("SM_HM_Picture", parts, P, budget=40, ground=False)


def fridge():
    parts = [B("body", (0.7, 0.7, 1.8), color=P["white"])]
    parts.append(B("split", (0.7, 0.01, 0.02), at=(0, -0.35, 1.2), color=P["concrete_dark"]))
    parts.append(B("handle", (0.03, 0.04, 0.4), at=(0.28, -0.37, 1.3), color=P["steel"]))
    return lpm.finish("SM_HM_Fridge", parts, P, budget=40)


def cooker():
    parts = [B("body", (0.7, 0.65, 0.9), color=P["concrete"])]
    parts.append(B("door", (0.55, 0.02, 0.45), at=(0, -0.33, 0.2), color=P["slate_dark"]))
    for i, (x, y) in enumerate(((-0.16, -0.14), (0.16, -0.14), (-0.16, 0.14), (0.16, 0.14))):
        parts.append(lpm.prism(f"ring{i}", 8, 0.1, 0.01, at=(x, y, 0.9), color=P["ink"]))
    parts.append(lpm.lathe("pot", [(0.0, 0.0), (0.12, 0.0), (0.12, 0.14), (0.0, 0.14)], segments=8, at=(-0.16, 0.14, 0.91), color=P["red"]))
    return lpm.finish("SM_HM_Cooker", parts, P, budget=120)


objs = [bed(), sofa(), armchair(), table(), chair(), desk(), lamp(), bookshelf(), plant(), rug(), tv(), wardrobe(), clock(), picture(), fridge(), cooker()]
export_web(objs[0], P, extra=objs[1:], slug="home_kit", spread=2.4)
