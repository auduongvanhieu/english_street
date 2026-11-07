"""Cinema snacks - what a player carries after the snack bar (prop "snack:<kind>", scene/areas/Snack.tsx).

Game contract (Blender axes; three = (x, z, -y)): every snack has its pivot at the centre of its base and is held in
front of the chest by the game (scaled 1:1, real sizes).
  * SM_CN_Popcorn: striped bucket 0.13 m top radius, 0.2 m tall, popcorn heaped above the rim.
  * SM_CN_Nachos: 0.2 x 0.15 tray with chips and a cheese dip cup.
  * SM_CN_Drink: 0.07 m paper cup, 0.2 m tall, lid and straw.
  * SM_CN_IceCream: cone 0.12 m with two scoops.
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()


def popcorn():
    parts = []
    # bucket: 8 staves alternating red / white, tapering outwards
    n = 8
    for k in range(n):
        a = k * 2 * math.pi / n
        st = lpm.box(f"stave{k}", (0.085, 0.012, 0.2), at=(0, 0, 0), color=P["red"] if k % 2 else P["white"], taper=(1.35, 1.0))
        lpm.rotate(st, 6, "X")
        lpm.move(st, 0, -0.09, 0)
        lpm.rotate(st, math.degrees(a), "Z", about=(0, 0, 0))
        parts.append(st)
    parts.append(lpm.prism("bottom", 8, 0.09, 0.01, color=P["red"]))
    # popcorn heap: a few low lumps above the rim
    parts.append(lpm.lathe("heap", [(0.0, 0.17), (0.12, 0.18), (0.11, 0.23), (0.06, 0.27), (0.0, 0.28)], segments=8, color=P["cream"]))
    for k in range(5):
        a = k * 1.3
        parts.append(lpm.prism(f"kernel{k}", 5, 0.025, 0.03, at=(math.cos(a) * 0.07, math.sin(a) * 0.07, 0.23 + (k % 2) * 0.02), color=P["yellow"] if k % 2 else P["cream"]))
    return lpm.finish("SM_CN_Popcorn", parts, P, budget=220)


def nachos():
    parts = [lpm.box("tray", (0.22, 0.16, 0.03), color=P["slate_dark"])]
    for k in range(6):
        chip = lpm.prism(f"chip{k}", 3, 0.05, 0.008, at=(-0.07 + (k % 3) * 0.05, -0.04 + (k // 3) * 0.05, 0.03 + (k % 2) * 0.01), color=P["hay"], rotate=k * 40)
        lpm.rotate(chip, 12 * (1 if k % 2 else -1), "X", about=(0, 0, 0.03))
        parts.append(chip)
    parts.append(lpm.prism("dip_cup", 8, 0.035, 0.035, at=(0.07, 0.04, 0.03), color=P["white"]))
    parts.append(lpm.prism("dip", 8, 0.03, 0.005, at=(0.07, 0.04, 0.062), color=P["orange"]))
    return lpm.finish("SM_CN_Nachos", parts, P, budget=120)


def drink():
    parts = [lpm.prism("cup", 8, 0.055, 0.19, radius_top=0.07, color=P["blue"])]
    parts.append(lpm.prism("band", 8, 0.064, 0.05, radius_top=0.067, at=(0, 0, 0.1), color=P["white"]))
    parts.append(lpm.prism("lid", 8, 0.073, 0.015, at=(0, 0, 0.19), color=P["white"]))
    straw = lpm.prism("straw", 4, 0.007, 0.12, at=(0, 0, 0), color=P["red"])
    lpm.rotate(straw, 10, "Y")
    lpm.move(straw, 0.01, 0, 0.19)
    parts.append(straw)
    return lpm.finish("SM_CN_Drink", parts, P, budget=90)


def icecream():
    parts = [lpm.prism("cone", 8, 0.008, 0.12, radius_top=0.04, color=P["hay"])]
    parts.append(lpm.lathe("scoop1", [(0.0, 0.11), (0.045, 0.12), (0.045, 0.15), (0.0, 0.17)], segments=8, color=P["cream"]))
    parts.append(lpm.lathe("scoop2", [(0.0, 0.16), (0.04, 0.17), (0.04, 0.2), (0.0, 0.22)], segments=8, color=P["red"]))
    return lpm.finish("SM_CN_IceCream", parts, P, budget=80)


export_web(popcorn(), P, extra=[nachos(), drink(), icecream()], slug="cinema_kit", spread=0.4)
