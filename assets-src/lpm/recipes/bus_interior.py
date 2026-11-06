"""City bus interior (scene/Buses.tsx) - seen only by the player riding that bus (camera inside), budget 2400 tris.

Game contract (bus local space, three axes: bus faces -x, door on the +z side at x = -2.4 +- 0.67):
  * floor = top of the solid lower body, y 1.505; ceiling = underside of the roof, y 2.43; side walls at z +-1.2
  * keep x -3.1 ... -1.7 clear on the +z side (doorway), driver's seat front-left (-z) at x ~ -3.75
Built in three axes and converted to Blender's (x, -z, y) by the helpers below; pivot = bus origin.
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()
parts = []
add = parts.append
FLOOR, CEIL = 1.505, 2.43


def tbox(name, sx, sy, sz, x, y0, z, color):
    """Box in three axes: size (x, height, z-width), base centre (x, y0, z)."""
    return lpm.box(name, (sx, sz, sy), at=(x, -z, y0), color=color)


def tpole(name, x, z, y0, y1, color, r=0.03):
    return lpm.prism(name, 6, r, y1 - y0, at=(x, -z, y0), color=color, cap=False)


# floor plate over the yellow body top, darker aisle runner
add(tbox("floor", 8.7, 0.02, 2.3, 0.15, FLOOR - 0.005, 0, P["slate_dark"]))
add(tbox("aisle", 6.6, 0.02, 0.5, 0.9, FLOOR + 0.005, 0, P["slate"]))
# ceiling panel with two light strips
add(tbox("ceiling", 8.7, 0.03, 2.3, 0.15, CEIL - 0.04, 0, P["cream"]))
for z in (-0.55, 0.55):
    add(tbox(f"light{z}", 7.0, 0.02, 0.12, 0.6, CEIL - 0.055, z, P["white"]))

# seats: double benches both sides, facing the front (-x), backrest on the +x side
ROWS = [-1.2, -0.35, 0.5, 1.35, 2.2, 3.05, 3.85]
for i, x in enumerate(ROWS):
    for side in (-1, 1):
        zc = side * 0.72
        add(tbox(f"leg{i}{side}", 0.06, 0.32, 0.06, x, FLOOR, side * 0.4, P["steel"]))
        add(tbox(f"frame{i}{side}", 0.5, 0.05, 0.86, x, FLOOR + 0.3, zc, P["steel"]))
        add(tbox(f"cushion{i}{side}", 0.46, 0.08, 0.82, x - 0.02, FLOOR + 0.34, zc, P["blue"]))
        back = tbox(f"back{i}{side}", 0.08, 0.42, 0.82, x + 0.21, FLOOR + 0.38, zc, P["blue"])
        lpm.rotate(back, -8, "Y", about=(x + 0.21, -zc, FLOOR + 0.38))   # leans back a little
        add(back)
        add(tbox(f"grab{i}{side}", 0.05, 0.05, 0.8, x + 0.25, FLOOR + 0.82, zc, P["steel"]))
# yellow stanchions at the aisle every other row + two at the door, and ceiling rails along the aisle
for i, x in enumerate(ROWS):
    if i % 2 == 0:
        for side in (-1, 1):
            add(tpole(f"pole{i}{side}", x - 0.3, side * 0.3, FLOOR, CEIL - 0.04, P["yellow"]))
for x in (-3.15, -1.65):
    add(tpole(f"doorpole{x}", x, 0.95, FLOOR, CEIL - 0.04, P["yellow"]))
for side in (-1, 1):
    rail = lpm.prism(f"rail{side}", 6, 0.025, 7.4, at=(0, 0, 0), color=P["yellow"], cap=False)
    lpm.rotate(rail, 90, "Y")
    lpm.move(rail, -3.4, -side * 0.3, CEIL - 0.16)
    add(rail)

# driver: seat, dashboard, steering wheel (front-left, -z side)
DX, DZ = -3.75, -0.6
add(tbox("drv_base", 0.5, 0.3, 0.5, DX, FLOOR, DZ, P["slate_dark"]))
add(tbox("drv_cushion", 0.5, 0.1, 0.5, DX, FLOOR + 0.3, DZ, P["ink"]))
add(tbox("drv_back", 0.1, 0.55, 0.5, DX + 0.25, FLOOR + 0.35, DZ, P["ink"]))
add(tbox("dash", 0.35, 0.45, 2.2, -4.3, FLOOR, 0, P["slate_dark"]))
add(tbox("dash_top", 0.4, 0.04, 2.2, -4.3, FLOOR + 0.45, 0, P["ink"]))
col = lpm.prism("column", 6, 0.035, 0.45, at=(0, 0, 0), color=P["ink"], cap=False)
lpm.rotate(col, -55, "Y"); lpm.move(col, -4.15, -DZ, FLOOR + 0.42)
add(col)
wheel = lpm.prism("wheel", 10, 0.2, 0.04, at=(0, 0, 0), color=P["ink"])
hub = lpm.prism("wheel_hub", 10, 0.13, 0.05, at=(0, 0, -0.005), color=P["slate"])
for o in (wheel, hub):
    lpm.rotate(o, -55, "Y"); lpm.move(o, -3.95, -DZ, FLOOR + 0.72)
    add(o)
# a "STOP" button box by the door and a destination screen over the aisle
add(tbox("stop_btn", 0.08, 0.12, 0.08, -1.65, FLOOR + 1.0, 0.95, P["red"]))
add(tbox("screen", 0.05, 0.22, 0.7, -2.0, CEIL - 0.3, 0, P["ink"]))
add(tbox("screen_text", 0.02, 0.1, 0.5, -2.03, CEIL - 0.24, 0, P["orange"]))

inner = lpm.finish("SM_BusInterior", parts, P, budget=2400, ground=False, center=False)
export_web(inner, P, slug="bus_interior")
