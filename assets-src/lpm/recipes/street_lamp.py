"""Street lamp - repeated street furniture (~170 instances), 4.4 m tall, budget 300 tris.

Game contract (scene/Sky.tsx StreetLamps, world/layout.ts LAMP_H / LAMP_ARM / buildLampPosts):
  * pivot = post foot; post radius <= 0.2 m (round collider r 0.2)
  * arm reaches 1.2 m towards +Y (three: -z, over the road), head underside at z = 4.11 so the instanced
    bulb box (0.32 x 0.08 x 0.2, centre z 4.06) sits flush under it
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()
parts = []
add = parts.append
ARM, H = 1.2, 4.2

# foot: octagonal plinth with a chamfered collar, then a slim tapered pole with one decorative band
add(lpm.lathe("foot", [(0, 0), (0.19, 0), (0.19, 0.24), (0.1, 0.5), (0, 0.5)], segments=8, color=P["slate_dark"]))
add(lpm.prism("pole", 8, 0.09, H - 0.42, at=(0, 0, 0.45), color=P["slate"], radius_top=0.065, cap=False))  # ends hidden in foot / finial
add(lpm.prism("band", 8, 0.1, 0.08, at=(0, 0, 2.5), color=P["slate_dark"], cap=False))  # caps would sit inside the pole
add(lpm.lathe("finial", [(0.07, H - 0.02), (0.09, H + 0.04), (0.04, H + 0.14), (0, H + 0.2)], segments=6, color=P["slate_dark"]))

# swan-neck arm: rises off the pole and levels out over the road (outline in (reach, z), turned so reach -> +Y)
arm = lpm.sweep("arm", [(0.03, 3.86), (0.22, 4.08), (0.48, 4.22), (ARM + 0.05, 4.26), (ARM + 0.05, 4.19), (0.5, 4.15), (0.27, 4.03), (0.03, 3.74)], depth=0.07, color=P["slate"])
lpm.rotate(arm, 90, "Z")
add(arm)

# lamp head: a flat tapered hood with a little cap, underside at z 4.11
add(lpm.box("hood", (0.4, 0.54, 0.13), at=(0, ARM, 4.11), color=P["slate_dark"], taper=(0.7, 0.75)))
add(lpm.box("rim", (0.44, 0.58, 0.03), at=(0, ARM, 4.10), color=P["slate"]))
add(lpm.prism("cap", 6, 0.07, 0.06, at=(0, ARM, 4.23), color=P["slate_dark"]))

lamp = lpm.finish("SM_StreetLamp", parts, P, budget=300, center=False)
export_web(lamp, P, slug="street_lamp")
