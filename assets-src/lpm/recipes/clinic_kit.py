"""Clinic kit - the doctor's consulting room (scene/areas/places/Clinic.tsx), off the map.

Game contract (Blender axes; three = (x, z, -y)); every piece: pivot = floor centre, front towards -Y (three +Z).
  * SM_CL_Couch: examination couch 1.9 x 0.7, top at 0.72, raised head end at -X; paper roll on top.
  * SM_CL_Desk: 1.4 x 0.7 desk (top 0.75) with a monitor and keyboard; the doctor sits behind it (+Y side).
  * SM_CL_Chair: patient chair 0.5 x 0.5, seat 0.45, facing -Y.
  * SM_CL_Cabinet: glass-front medicine cabinet 0.9 x 0.4 x 1.8 (glass as *_glass).
  * SM_CL_Lightbox: wall X-ray light box 0.9 x 0.6, bottom at 1.2 (hangs on the wall, pivot = floor below it).
  * SM_CL_Scale: floor scale with a height rod (1.9 m).
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()


def couch():
    parts = [lpm.box("frame", (1.9, 0.6, 0.6), color=P["steel"])]
    parts.append(lpm.box("pad", (1.9, 0.7, 0.12), at=(0, 0, 0.6), color=P["teal"]))
    head = lpm.box("head", (0.55, 0.7, 0.1), at=(-0.65, 0, 0.72), color=P["teal"])
    lpm.rotate(head, -22, "Y", about=(-0.4, 0, 0.72))
    parts.append(head)
    parts.append(lpm.box("paper", (1.3, 0.5, 0.01), at=(0.25, 0, 0.72), color=P["white"]))
    parts.append(lpm.box("step", (0.4, 0.3, 0.2), at=(0.3, -0.5, 0), color=P["slate"]))
    return lpm.finish("SM_CL_Couch", parts, P, budget=120)


def desk():
    parts = [lpm.box("top", (1.4, 0.7, 0.05), at=(0, 0, 0.7), color=P["wood"])]
    for x in (-0.65, 0.65):
        parts.append(lpm.box(f"leg{x}", (0.06, 0.65, 0.7), at=(x, 0, 0), color=P["wood_dark"]))
    parts.append(lpm.box("drawers", (0.4, 0.6, 0.55), at=(0.4, 0, 0.12), color=P["wood_dark"]))
    parts.append(lpm.box("stand", (0.12, 0.1, 0.18), at=(-0.2, 0.18, 0.75), color=P["slate_dark"]))
    parts.append(lpm.box("monitor", (0.55, 0.04, 0.34), at=(-0.2, 0.15, 0.9), color=P["ink"]))
    parts.append(lpm.box("screen", (0.5, 0.005, 0.29), at=(-0.2, 0.128, 0.925), color=P["blue"]))
    parts.append(lpm.box("keys", (0.4, 0.14, 0.02), at=(-0.2, -0.12, 0.75), color=P["slate"]))
    parts.append(lpm.box("chair", (0.5, 0.5, 0.45), at=(0, 0.6, 0), color=P["slate_dark"]))
    parts.append(lpm.box("chair_back", (0.5, 0.08, 0.5), at=(0, 0.83, 0.45), color=P["slate_dark"]))
    return lpm.finish("SM_CL_Desk", parts, P, budget=160)


def chair():
    parts = [lpm.box("seat", (0.5, 0.5, 0.06), at=(0, 0, 0.42), color=P["blue"])]
    parts.append(lpm.box("back", (0.5, 0.06, 0.45), at=(0, 0.22, 0.48), color=P["blue"]))
    for x in (-0.22, 0.22):
        for y in (-0.22, 0.22):
            parts.append(lpm.box(f"leg{x}{y}", (0.04, 0.04, 0.42), at=(x, y, 0), color=P["steel"]))
    return lpm.finish("SM_CL_Chair", parts, P, budget=80)


def cabinet():
    parts = [lpm.box("body", (0.9, 0.4, 1.8), color=P["white"])]
    for z in (0.5, 0.95, 1.4):
        parts.append(lpm.box(f"shelf{z}", (0.84, 0.34, 0.02), at=(0, 0.02, z), color=P["concrete"]))
        for k in range(4):
            parts.append(lpm.box(f"box{z}{k}", (0.14, 0.12, 0.18), at=(-0.3 + k * 0.2, 0.0, z + 0.02), color=[P["red"], P["blue"], P["green"], P["yellow"]][k]))
    glass = lpm.box("door_glass", (0.84, 0.01, 1.3), at=(0, -0.2, 0.42), color=P["white"])
    return lpm.finish("SM_CL_Cabinet", parts, P, budget=200), glass


def lightbox():
    parts = [lpm.box("box", (0.9, 0.06, 0.6), at=(0, 0, 1.2), color=P["slate"])]
    parts.append(lpm.box("panel", (0.8, 0.01, 0.5), at=(0, -0.031, 1.25), color=P["white"]))
    return lpm.finish("SM_CL_Lightbox", parts, P, budget=40, ground=False)


def scale():
    parts = [lpm.box("plate", (0.4, 0.4, 0.06), color=P["concrete"])]
    parts.append(lpm.box("rod", (0.04, 0.04, 1.9), at=(0, 0.18, 0.06), color=P["steel"]))
    parts.append(lpm.box("arm", (0.3, 0.04, 0.03), at=(0, 0.06, 1.7), color=P["steel"]))
    return lpm.finish("SM_CL_Scale", parts, P, budget=40)


cab, cab_glass = cabinet()
cab_glass = lpm.finish("SM_CL_Cabinet_glass", [cab_glass], P, budget=20)
export_web(couch(), P, extra=[desk(), chair(), cab, cab_glass, lightbox(), scale()], slug="clinic_kit",
           spread=[(0, 0, 0), (2.4, 0, 0), (4.0, 0, 0), (5.4, 0, 0), (5.4, 0, 0), (6.8, 0, 0), (8.0, 0, 0)])
