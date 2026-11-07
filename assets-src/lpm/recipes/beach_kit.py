"""Beach kit - Sunny Bay (scene/areas/places/SunnyBay.tsx), the seaside reached by train.

Game contract (Blender axes; three = (x, z, -y)); pivot = floor centre, front towards -Y (three +Z) unless noted.
  * SM_BC_Palm: palm tree ~5 m, trunk leaning +X a little, crown of 7 fronds.
  * SM_BC_Umbrella: beach umbrella 2.2 m wide, pole 2.3 m, striped canopy.
  * SM_BC_Towel: beach towel 0.8 x 1.8 (flat).
  * SM_BC_Deckchair: 0.6 x 1.2 deckchair, seat 0.35 high, back towards +Y (three -Z).
  * SM_BC_Tower: lifeguard tower 2 x 2, platform at 2.0, a flag pole at the back right (+X, +Y) 4.5 m high;
    the flag itself is drawn by the game (colour changes): pole top at three (0.85, 4.4, -0.85).
  * SM_BC_Kiosk: ice-cream kiosk 2.6 x 1.8, counter front (-Y) at 1.0 m, roof 2.7 m.
  * SM_BC_Rock: rock 1.2 m.
  * SM_BC_Castle: a finished sandcastle 0.9 x 0.9.
  * SM_BC_Shelter: station shelter 6 x 2.2 (open front -Y, roof 2.8 m) with a bench.
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()
B = lpm.box


def palm():
    parts = []
    z = 0.0
    x = 0.0
    for k in range(6):
        seg = lpm.prism(f"trunk{k}", 6, 0.16 - k * 0.012, 0.75, radius_top=0.15 - k * 0.012, at=(x, 0, z), color=P["bark"] if k % 2 else P["wood"])
        parts.append(seg)
        z += 0.75
        x += 0.08 + k * 0.02
    for k in range(7):
        a = k * 2 * math.pi / 7
        fr = B(f"frond{k}", (0.35, 1.9, 0.04), at=(0, 0.95, 0), color=P["leaf"] if k % 2 else P["leaf_dark"], taper=(1.0, 0.25))
        lpm.rotate(fr, -28, "X", about=(0, 0, 0))
        lpm.rotate(fr, math.degrees(a), "Z", about=(0, 0, 0))
        lpm.move(fr, x, 0, z)
        parts.append(fr)
    for k in range(3):
        parts.append(lpm.prism(f"coco{k}", 6, 0.11, 0.18, at=(x + math.cos(k * 2.1) * 0.15, math.sin(k * 2.1) * 0.15, z - 0.2), color=P["wood_dark"]))
    return lpm.finish("SM_BC_Palm", parts, P, budget=320)


def umbrella():
    parts = [lpm.prism("pole", 6, 0.03, 2.3, color=P["white"])]
    canopy = lpm.lathe("canopy", [(0.0, 2.45), (1.1, 2.1), (1.12, 2.06), (0.0, 2.3)], segments=8, color=P["red"])
    parts = [parts[0], canopy]
    # stripes: a second, slightly smaller white cone offset in rotation
    stripes = lpm.lathe("stripes", [(0.0, 2.452), (0.6, 2.27), (0.62, 2.26), (0.0, 2.36)], segments=8, color=P["white"])
    parts.append(stripes)
    return lpm.finish("SM_BC_Umbrella", parts, P, budget=120)


def towel():
    parts = [B("towel", (0.8, 1.8, 0.012), color=P["blue"])]
    for k in range(3):
        parts.append(B(f"stripe{k}", (0.8, 0.12, 0.004), at=(0, -0.6 + k * 0.6, 0.012), color=P["yellow"]))
    return lpm.finish("SM_BC_Towel", parts, P, budget=30)


def deckchair():
    parts = []
    for x in (-0.28, 0.28):
        parts.append(B(f"rail{x}", (0.04, 1.1, 0.04), at=(x, 0, 0.3), color=P["wood"]))
        parts.append(B(f"legf{x}", (0.04, 0.04, 0.3), at=(x, -0.5, 0), color=P["wood"]))
        parts.append(B(f"legb{x}", (0.04, 0.04, 0.3), at=(x, 0.5, 0), color=P["wood"]))
    seat = B("seat", (0.52, 0.7, 0.02), at=(0, -0.15, 0.33), color=P["teal"])
    parts.append(seat)
    back = B("back", (0.52, 0.02, 0.7), at=(0, 0.35, 0.33), color=P["teal"])
    lpm.rotate(back, 30, "X", about=(0, 0.35, 0.33))
    parts.append(back)
    return lpm.finish("SM_BC_Deckchair", parts, P, budget=90)


def tower():
    parts = []
    for x in (-0.85, 0.85):
        for y in (-0.85, 0.85):
            parts.append(B(f"leg{x}{y}", (0.12, 0.12, 2.0), at=(x, y, 0), color=P["white"]))
    parts.append(B("deck", (2.0, 2.0, 0.12), at=(0, 0, 2.0), color=P["wood"]))
    parts.append(B("hut", (1.6, 1.4, 1.2), at=(0, 0.2, 2.12), color=P["red"]))
    parts.append(B("window", (1.2, 0.02, 0.5), at=(0, -0.51, 2.6), color=P["ink"]))
    parts.append(B("roof", (2.0, 1.8, 0.1), at=(0, 0.1, 3.32), color=P["white"]))
    parts.append(B("rail", (2.0, 0.06, 0.06), at=(0, -0.97, 2.9), color=P["white"]))
    for k in range(5):
        st = B(f"step{k}", (0.7, 0.22, 0.05), at=(0, -1.25 - k * 0.25, 1.8 - k * 0.4), color=P["wood"])
        parts.append(st)
    parts.append(lpm.prism("flagpole", 6, 0.04, 4.4, at=(0.85, 0.85, 0), color=P["steel"]))
    return lpm.finish("SM_BC_Tower", parts, P, budget=260)


def kiosk():
    parts = [B("base", (2.6, 1.8, 1.0), color=P["white"])]
    parts.append(B("stripe", (2.62, 1.82, 0.15), at=(0, 0, 0.6), color=P["orange"]))
    parts.append(B("counter", (2.7, 0.4, 0.06), at=(0, -0.95, 1.0), color=P["wood"]))
    for x in (-1.25, 1.25):
        parts.append(B(f"post{x}", (0.1, 0.1, 1.6), at=(x, -0.8, 1.0), color=P["white"]))
    parts.append(B("back", (2.6, 0.1, 1.6), at=(0, 0.85, 1.0), color=P["cream"]))
    parts.append(B("roof", (3.0, 2.2, 0.12), at=(0, -0.1, 2.6), color=P["orange"], taper=(0.9, 0.9)))
    parts.append(B("sign", (1.8, 0.06, 0.4), at=(0, -0.95, 2.72), color=P["white"]))
    cone = lpm.prism("cone", 8, 0.02, 0.5, radius_top=0.22, at=(1.6, -0.6, 2.7), color=P["hay"])
    parts.append(cone)
    parts.append(lpm.lathe("scoop", [(0.0, 3.18), (0.25, 3.25), (0.25, 3.4), (0.0, 3.55)], segments=8, at=(1.6, -0.6, 0), color=P["red"]))
    return lpm.finish("SM_BC_Kiosk", parts, P, budget=200)


def rock():
    r = lpm.lathe("rock", [(0.0, 0.0), (0.6, 0.05), (0.55, 0.45), (0.3, 0.75), (0.0, 0.8)], segments=6, color=P["concrete_dark"])
    lpm.rotate(r, 12, "Y")
    return lpm.finish("SM_BC_Rock", [r], P, budget=60)


def castle():
    parts = [B("base", (0.9, 0.9, 0.2), color=P["hay"])]
    for x in (-0.33, 0.33):
        for y in (-0.33, 0.33):
            parts.append(lpm.prism(f"tower{x}{y}", 6, 0.12, 0.38, radius_top=0.1, at=(x, y, 0.2), color=P["hay_dark"]))
    parts.append(lpm.prism("keep", 6, 0.2, 0.5, radius_top=0.16, at=(0, 0, 0.2), color=P["hay"]))
    parts.append(B("flag", (0.12, 0.01, 0.08), at=(0.06, 0, 0.82), color=P["red"]))
    parts.append(lpm.prism("stick", 4, 0.008, 0.18, at=(0, 0, 0.7), color=P["wood"]))
    return lpm.finish("SM_BC_Castle", parts, P, budget=120)


def shelter():
    parts = [B("floor", (6.0, 2.2, 0.15), color=P["concrete"])]
    parts.append(B("back", (6.0, 0.1, 2.6), at=(0, 1.05, 0.15), color=P["blue"]))
    for x in (-2.95, 2.95):
        parts.append(B(f"side{x}", (0.1, 2.2, 2.6), at=(x, 0, 0.15), color=P["blue"]))
    parts.append(B("roof", (6.4, 2.6, 0.12), at=(0, -0.1, 2.75), color=P["white"]))
    parts.append(B("bench", (3.0, 0.5, 0.45), at=(0, 0.7, 0.15), color=P["wood"]))
    parts.append(B("sign", (2.4, 0.06, 0.5), at=(0, -1.2, 2.2), color=P["blue_dark"]))
    return lpm.finish("SM_BC_Shelter", parts, P, budget=120)


objs = [palm(), umbrella(), towel(), deckchair(), tower(), kiosk(), rock(), castle(), shelter()]
export_web(objs[0], P, extra=objs[1:], slug="beach_kit", spread=4.0)
