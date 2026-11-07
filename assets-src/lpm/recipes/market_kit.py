"""Supermarket kit - the shopping trolley a player pushes (scene/areas/Trolley.tsx) and the till scanner.

Game contract (Blender axes; three = (x, z, -y)):
  * SM_MK_Trolley: 0.56 m wide, 0.9 m long, handle top 1.0 m. Pivot = floor point under the handle bar; the basket
    runs forwards along -Y (three +Z) from y -0.12 to y -0.86. Basket floor (where the game stacks the shopping) at
    z 0.52, inner size 0.48 x 0.66, rim at z 0.95. Four castors.
  * SM_MK_Scanner: flat barcode scanner window with a small screen post, 0.36 x 0.3, pivot = its base centre
    (stands on the checkout belt at 0.92 m).
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()


def trolley():
    parts = []
    y0, y1 = -0.12, -0.86          # basket back and front (Blender y; front = -Y)
    w = 0.56
    zf, zr = 0.5, 0.95              # basket floor and rim
    yc = (y0 + y1) / 2
    L = y0 - y1
    # basket: floor, two sides, front and back panels as thin wire-coloured slabs, plus a top rim
    parts.append(lpm.box("floor", (w - 0.04, L - 0.02, 0.02), at=(0, yc, zf), color=P["steel"]))
    for s in (-1, 1):
        parts.append(lpm.box(f"side{s}", (0.02, L, zr - zf), at=(s * (w / 2 - 0.01), yc, zf), color=P["steel"], taper=(1.0, 1.0)))
        parts.append(lpm.box(f"rim{s}", (0.035, L + 0.02, 0.03), at=(s * (w / 2 - 0.01), yc, zr - 0.01), color=P["teal"]))
    parts.append(lpm.box("front", (w, 0.02, zr - zf), at=(0, y1 + 0.01, zf), color=P["steel"]))
    parts.append(lpm.box("back", (w, 0.02, zr - zf), at=(0, y0 - 0.01, zf), color=P["steel"]))
    for y in (y0, y1):
        parts.append(lpm.box(f"rimx{y}", (w + 0.02, 0.035, 0.03), at=(0, y, zr - 0.01), color=P["teal"]))
    # wire lines on the sides (darker bars read as a mesh at game distance)
    for s in (-1, 1):
        for k in range(1, 4):
            parts.append(lpm.box(f"wire{s}{k}", (0.025, L, 0.012), at=(s * (w / 2 - 0.005), yc, zf + k * (zr - zf) / 4), color=P["slate"]))
    # handle: two uprights rising from the back of the basket and a red bar
    for s in (-1, 1):
        parts.append(lpm.box(f"upr{s}", (0.03, 0.03, 0.12), at=(s * (w / 2 - 0.02), y0 + 0.02, zr - 0.04), color=P["steel"]))
    bar = lpm.prism("bar", 6, 0.02, w + 0.04, at=(0, 0, 0), color=P["red"])
    lpm.rotate(bar, 90, "Y")
    lpm.move(bar, -(w + 0.04) / 2, y0 + 0.03, 1.0)
    parts.append(bar)
    # chassis: two rails under the basket and a lower tray, then four castors
    for s in (-1, 1):
        parts.append(lpm.box(f"rail{s}", (0.03, L + 0.04, 0.03), at=(s * 0.2, yc, 0.12), color=P["slate"]))
        parts.append(lpm.box(f"leg_b{s}", (0.03, 0.03, zf - 0.12), at=(s * 0.22, y0 - 0.04, 0.12), color=P["slate"]))
        parts.append(lpm.box(f"leg_f{s}", (0.03, 0.03, zf - 0.12), at=(s * 0.22, y1 + 0.04, 0.12), color=P["slate"]))
    parts.append(lpm.box("tray", (0.4, L - 0.1, 0.02), at=(0, yc, 0.15), color=P["slate"]))
    for s in (-1, 1):
        for y in (y0 - 0.04, y1 + 0.04):
            wheel = lpm.prism(f"wh{s}{y}", 8, 0.06, 0.04, at=(0, 0, 0), color=P["ink"])
            lpm.rotate(wheel, 90, "Y")
            lpm.move(wheel, s * 0.2 - 0.02, y, 0.06)
            parts.append(wheel)
    return lpm.finish("SM_MK_Trolley", parts, P, budget=500)


def scanner():
    parts = [lpm.box("base", (0.36, 0.3, 0.03), color=P["slate_dark"])]
    parts.append(lpm.box("window", (0.26, 0.2, 0.005), at=(0, 0, 0.03), color=P["red"]))
    parts.append(lpm.box("post", (0.04, 0.04, 0.3), at=(0.15, 0.12, 0.03), color=P["slate"]))
    scr = lpm.box("screen", (0.2, 0.03, 0.14), at=(0.15, 0.12, 0.3), color=P["ink"])
    lpm.rotate(scr, -15, "X", about=(0.15, 0.12, 0.3))
    parts.append(scr)
    parts.append(lpm.box("screen_face", (0.17, 0.005, 0.1), at=(0.15, 0.1, 0.32), color=P["green"]))
    return lpm.finish("SM_MK_Scanner", parts, P, budget=80)


export_web(trolley(), P, extra=[scanner()], slug="market_kit", spread=1.0)
