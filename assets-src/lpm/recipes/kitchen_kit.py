"""Restaurant kitchen kit - the cooking stations behind the bar (scene/areas/Restaurant.tsx Kitchen).

Game contract (Blender axes; three = (x, z, -y)): every piece stands against a back wall, pivot = floor centre of
its front edge... simpler: pivot = floor centre, front (where the cook stands) towards -Y (three +Z).
  * SM_KT_Fridge   0.8 x 0.7 x 1.9
  * SM_KT_Sink     1.2 x 0.65 x 0.9 worktop, basin + tap
  * SM_KT_Prep     1.6 x 0.65 x 0.9 worktop with a chopping board, knife and a mixing bowl
  * SM_KT_Stove    1.6 x 0.7 x 0.9 cooker with 4 rings, a pot and a frying pan, oven door at the front
  * SM_KT_Spices   1.2 x 0.25 wall shelf (two levels) with jars, bottom at 1.2 m (hangs on the wall)
  * SM_KT_Pass     1.0 x 0.4 heat-lamp gantry for the serving hatch (stands on the bar top, pivot = its base)
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()
WORK_H = 0.9


def cabinet(name, w, d, color=None):
    """Base cabinet with a worktop and a door line at the front (-Y)."""
    parts = [lpm.box(f"{name}_body", (w, d - 0.04, WORK_H - 0.05), at=(0, 0.02, 0), color=color or P["white"])]
    parts.append(lpm.box(f"{name}_top", (w + 0.02, d, 0.05), at=(0, 0, WORK_H - 0.05), color=P["steel"]))
    parts.append(lpm.box(f"{name}_kick", (w - 0.04, 0.02, 0.08), at=(0, -d / 2 + 0.03, 0), color=P["slate_dark"]))
    for k in range(int(w // 0.6)):
        x = -w / 2 + 0.3 + k * 0.6
        parts.append(lpm.box(f"{name}_h{k}", (0.12, 0.02, 0.02), at=(x, -d / 2 - 0.01, WORK_H - 0.2), color=P["slate"]))
    return parts


def fridge():
    parts = [lpm.box("fr_body", (0.8, 0.7, 1.9), color=P["white"])]
    parts.append(lpm.box("fr_split", (0.8, 0.02, 0.02), at=(0, -0.36, 1.2), color=P["concrete_dark"]))
    for z0, z1 in ((0.15, 1.1), (1.3, 1.8)):
        parts.append(lpm.box(f"fr_handle{z0}", (0.03, 0.04, z1 - z0 - 0.4), at=(0.3, -0.37, z0 + 0.2), color=P["steel"]))
    return lpm.finish("SM_KT_Fridge", parts, P, budget=120)


def sink():
    parts = cabinet("si", 1.2, 0.65)
    parts.append(lpm.box("si_basin", (0.55, 0.4, 0.02), at=(0, 0.02, WORK_H + 0.001), color=P["slate"]))
    parts.append(lpm.box("si_rim", (0.6, 0.45, 0.015), at=(0, 0.02, WORK_H), color=P["concrete"]))
    tap = lpm.prism("si_tap", 6, 0.02, 0.3, at=(0, 0.25, WORK_H), color=P["steel"])
    parts.append(tap)
    spout = lpm.box("si_spout", (0.03, 0.18, 0.03), at=(0, 0.17, WORK_H + 0.28), color=P["steel"])
    parts.append(spout)
    return lpm.finish("SM_KT_Sink", parts, P, budget=160)


def prep():
    parts = cabinet("pr", 1.6, 0.65)
    parts.append(lpm.box("pr_board", (0.5, 0.32, 0.03), at=(-0.25, 0, WORK_H), color=P["wood"]))
    parts.append(lpm.box("pr_knife", (0.24, 0.035, 0.008), at=(-0.2, -0.1, WORK_H + 0.032), color=P["steel"]))
    parts.append(lpm.box("pr_knife_h", (0.1, 0.03, 0.02), at=(-0.37, -0.1, WORK_H + 0.03), color=P["ink"]))
    parts.append(lpm.lathe("pr_bowl", [(0.04, 0), (0.12, 0.03), (0.16, 0.1), (0.14, 0.1), (0.1, 0.035), (0.0, 0.03)], segments=10, at=(0.45, 0.05, WORK_H), color=P["cream"]))
    return lpm.finish("SM_KT_Prep", parts, P, budget=220)


def stove():
    parts = cabinet("st", 1.6, 0.7, color=P["concrete"])
    parts.append(lpm.box("st_oven", (0.7, 0.02, 0.5), at=(0, -0.36, 0.2), color=P["slate_dark"]))
    parts.append(lpm.box("st_ovenh", (0.5, 0.03, 0.03), at=(0, -0.38, 0.74), color=P["steel"]))
    for i, (x, y) in enumerate(((-0.4, -0.15), (-0.4, 0.15), (0.4, -0.15), (0.4, 0.15))):
        parts.append(lpm.prism(f"st_ring{i}", 8, 0.11, 0.012, at=(x, y, WORK_H), color=P["ink"]))
    # pot (left back) and frying pan (right front)
    parts.append(lpm.lathe("st_pot", [(0.0, 0.0), (0.15, 0.0), (0.16, 0.2), (0.17, 0.2), (0.17, 0.22), (0.13, 0.22), (0.13, 0.03), (0.0, 0.03)], segments=10, at=(-0.4, 0.15, WORK_H + 0.012), color=P["steel"]))
    parts.append(lpm.lathe("st_pan", [(0.0, 0.0), (0.13, 0.0), (0.15, 0.04), (0.13, 0.04), (0.12, 0.012), (0.0, 0.012)], segments=10, at=(0.4, -0.15, WORK_H + 0.012), color=P["slate_dark"]))
    parts.append(lpm.box("st_pan_h", (0.22, 0.03, 0.02), at=(0.62, -0.15, WORK_H + 0.04), color=P["ink"]))
    # extractor hood above
    parts.append(lpm.box("st_hood", (1.4, 0.55, 0.35), at=(0, 0.08, 1.85), color=P["steel"], taper=(0.45, 0.6)))
    return lpm.finish("SM_KT_Stove", parts, P, budget=420)


def spices():
    parts = []
    for z in (1.2, 1.55):
        parts.append(lpm.box(f"sp_shelf{z}", (1.2, 0.22, 0.025), at=(0, 0, z), color=P["wood"]))
        for k in range(6):
            col = [P["red"], P["yellow"], P["green"], P["cream"], P["orange"], P["ink"]][(k + int(z * 10)) % 6]
            x = -0.5 + k * 0.2
            parts.append(lpm.prism(f"sp_jar{z}{k}", 6, 0.045, 0.13, at=(x, 0, z + 0.025), color=P["white"]))
            parts.append(lpm.prism(f"sp_lid{z}{k}", 6, 0.047, 0.03, at=(x, 0, z + 0.155), color=col))
    for s in (-1, 1):
        parts.append(lpm.box(f"sp_bracket{s}", (0.03, 0.2, 0.4), at=(s * 0.58, 0.01, 1.17), color=P["wood_dark"]))
    return lpm.finish("SM_KT_Spices", parts, P, budget=360, ground=False)


def passlamp():
    parts = []
    for s in (-1, 1):
        parts.append(lpm.prism(f"pa_post{s}", 6, 0.025, 0.55, at=(s * 0.45, 0, 0), color=P["steel"]))
    parts.append(lpm.box("pa_lamp", (1.0, 0.3, 0.08), at=(0, 0, 0.55), color=P["red"]))
    parts.append(lpm.box("pa_glow", (0.9, 0.22, 0.01), at=(0, 0, 0.545), color=P["yellow"]))
    parts.append(lpm.box("pa_plate", (0.9, 0.35, 0.02), at=(0, 0, 0), color=P["steel"]))
    return lpm.finish("SM_KT_Pass", parts, P, budget=80)


export_web(fridge(), P, extra=[sink(), prep(), stove(), spices(), passlamp()], slug="kitchen_kit", spread=1.9)
