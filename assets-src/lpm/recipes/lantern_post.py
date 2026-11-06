"""Riverside lantern post - repeated park furniture (~45 instances), 2.5 m tall, budget 250 tris.

Game contract (scene/NightLights.tsx): pivot = post foot; the instanced glowing bulb is a 0.30 x 0.36 x 0.30 box
centred at z = 2.05 (LANTERN_H), so the lantern cage leaves 1.87-2.23 open between four thin corner bars;
the festoon string hangs from z = 2.15 at the post axis (hidden by the bulb).
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()
parts = []
add = parts.append
L = 2.05

add(lpm.lathe("foot", [(0, 0), (0.17, 0), (0.17, 0.18), (0.07, 0.42), (0, 0.42)], segments=8, color=P["ink"]))
add(lpm.prism("pole", 8, 0.055, 1.45, at=(0, 0, 0.4), color=P["slate_dark"], radius_top=0.045, cap=False))  # ends hidden in foot / neck
add(lpm.prism("collar", 8, 0.075, 0.06, at=(0, 0, 1.0), color=P["ink"], cap=False))
# lantern: base tray, four corner bars, pyramid roof with a finial
add(lpm.box("tray", (0.4, 0.4, 0.05), at=(0, 0, 1.82), color=P["ink"], taper=(1.08, 1.08)))
add(lpm.box("neck", (0.16, 0.16, 0.06), at=(0, 0, 1.77), color=P["slate_dark"]))
for x in (-0.18, 0.18):
    for y in (-0.18, 0.18):
        add(lpm.box(f"bar{x}{y}", (0.03, 0.03, 0.38), at=(x, y, 1.865), color=P["ink"]))
add(lpm.box("eave", (0.46, 0.46, 0.04), at=(0, 0, 2.24), color=P["ink"]))
add(lpm.box("roof", (0.42, 0.42, 0.16), at=(0, 0, 2.28), color=P["slate_dark"], taper=(0.25, 0.25)))
add(lpm.lathe("finial", [(0.05, 2.43), (0.03, 2.5), (0, 2.56)], segments=6, color=P["ink"]))

post = lpm.finish("SM_LanternPost", parts, P, budget=250, center=False)
export_web(post, P, slug="lantern_post")
