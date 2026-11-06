"""Library kit - the "New books" display rack in the cinema library (scene/areas/places/Cinema.tsx BookDisplay).

Game contract (Blender axes; three = (x, z, -y)):
  * SM_LB_Display: 1.8 m wide, 0.7 m deep, 1.45 m tall; pivot = floor centre; books face -Y (three +Z).
    Three slanted tiers; each tier holds 3 books face-out. The game draws the covers (colour + emoji + title):
    tier ledge fronts at three (z, y) = (0.22, 0.30), (0.02, 0.72), (-0.18, 1.14), cover slope 15 degrees back,
    book slots at x = -0.55, 0, 0.55 (cover 0.42 x 0.56 m).
  * SM_LB_Sign: a small A-frame floor sign ("NEW BOOKS" is drawn by the game), 0.6 x 0.9 m, pivot = floor centre.
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()


def display():
    W, D, H = 1.8, 0.7, 1.45
    parts = []
    # side panels: a stepped profile (outline in (y, z) is swept along X)
    prof = [(-D / 2, 0), (D / 2, 0), (D / 2, 0.42), (0.2, 0.42), (0.2, 0.84), (0.0, 0.84), (0.0, 1.26), (-0.2, 1.26), (-0.2, H), (-D / 2, H)]
    for s in (-1, 1):
        side = lpm.sweep(f"side{s}", [(-y, z) for y, z in prof], depth=0.05, color=P["wood_dark"], axis="y")
        # sweep(axis=y) takes (x, z) outlines extruded along y: turn it so the outline lies in the YZ plane
        lpm.rotate(side, 90, "Z")
        lpm.move(side, s * (W / 2 - 0.025), 0, 0)
        parts.append(side)
    parts.append(lpm.box("back", (W - 0.1, 0.04, H - 0.05), at=(0, D / 2 - 0.02, 0.0), color=P["wood"]))
    parts.append(lpm.box("plinth", (W - 0.1, D - 0.04, 0.08), at=(0, 0, 0), color=P["wood_dark"]))
    # three slanted book beds with a lip at the front
    for k, (y, z) in enumerate([(0.22, 0.30), (0.02, 0.72), (-0.18, 1.14)]):
        bed = lpm.box(f"bed{k}", (W - 0.1, 0.32, 0.03), at=(0, -y, z - 0.03), color=P["wood"])
        lpm.rotate(bed, -15, "X", about=(0, -y, z))
        parts.append(bed)
        parts.append(lpm.box(f"lip{k}", (W - 0.1, 0.03, 0.06), at=(0, -y - 0.14, z - 0.04), color=P["wood_dark"]))
    parts.append(lpm.box("top", (W, 0.17, 0.04), at=(0, 0.265, H - 0.04), color=P["wood_dark"]))
    return lpm.finish("SM_LB_Display", parts, P, budget=300)


def sign():
    """A-frame: two boards, feet 0.4 m apart, meeting at the top under a wooden cap."""
    parts = []
    lean = math.degrees(math.atan2(0.18, 0.86))
    for s in (-1, 1):
        board = lpm.box(f"board{s}", (0.6, 0.03, 0.88), at=(0, 0, 0), color=P["slate_dark"])
        lpm.rotate(board, s * lean, "X")      # +X rotation tips the top towards +Y: s=+1 starts at -Y
        lpm.move(board, 0, -s * 0.2, 0)
        parts.append(board)
    parts.append(lpm.box("cap", (0.64, 0.1, 0.05), at=(0, 0, 0.84), color=P["wood"]))
    return lpm.finish("SM_LB_Sign", parts, P, budget=80)


export_web(display(), P, extra=[sign()], slug="library_kit", spread=1.6)
