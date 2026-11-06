"""Sunny Hills Zoo kit (scene/areas/Zoo.tsx + the shared rock() in scene/areas/kit.tsx) - one GLB, one object per
prop, merged into the area mesh in game (Part.addColored). Pivot = footprint centre on the ground, front -Y (three +z).

Game contract (world/zooLayout.ts):
  * SM_ZooHut 4 x 4 m (HUT blocker), front windows at x +-1.3, centre z 1.4 (night panes), door 1 x 1.7 centred
  * SM_Bench seat top z 0.47 (seats registered at x +-0.45, facing +z three), 1.8 m wide
  * SM_Rock / SM_Cave are painted in light neutral greys: the game multiplies them by each habitat's rock colour
  * SM_Feeder 1.8 x 0.8 (PETTING_FEEDER blocker) * SM_Hutch 2.4 x 1.5 (PETTING_HUTCH), opening on its front
"""
import math, random
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web
sys.path.insert(0, os.path.dirname(lpm.__file__))
import lpm_kit as kit

lpm.reset()
P = palette()
objs = []


def along_x(name, outline, length, color, at=(0, 0, 0)):
    ob = lpm.sweep(name, outline, depth=length, color=color)
    lpm.rotate(ob, 90, "Z"); lpm.move(ob, *at)
    return ob


def jitter(ob, amt, seed):
    rnd = random.Random(seed)
    for v in ob.data.vertices:
        if v.co.z > 0.02:
            v.co.x += rnd.uniform(-amt, amt); v.co.y += rnd.uniform(-amt, amt); v.co.z += rnd.uniform(-amt, amt) * 0.6
    ob.data.update()
    return ob


# ------------------------------------------------------------------------------------------- zookeeper hut
h = []
h.append(lpm.box("plinth", (4.1, 4.1, 0.2), at=(0, 0, 0), color=P["concrete_dark"]))
h.append(along_x("walls", [(-1.9, 0.2), (1.9, 0.2), (1.9, 2.4), (0, 3.2), (-1.9, 2.4)], 3.8, P["cream"]))
for x in (-1.95, 1.95):
    for y in (-1.95, 1.95):
        h.append(lpm.box(f"post{x}{y}", (0.2, 0.2, 2.45), at=(x, y, 0.15), color=P["wood_dark"]))
roof = along_x("roof", [(-2.45, 2.25), (0, 3.65), (2.45, 2.25), (2.45, 2.45), (0, 3.9), (-2.45, 2.45)], 4.6, P["hay"])
lpm.paint(roof, P["hay_dark"], where=lambda c, n, i: n.z < -0.3)
h.append(roof)
h.append(along_x("ridge", [(-0.2, 3.75), (0, 3.98), (0.2, 3.75)], 4.7, P["wood_dark"]))
# front: door with frame (the deep front eave is its porch), two windows with green shutters
h.append(lpm.box("door", (1.0, 0.06, 1.7), at=(0, -1.92, 0.2), color=P["wood_dark"]))
h.append(lpm.box("door_frame", (1.2, 0.04, 1.85), at=(0, -1.91, 0.2), color=P["wood"]))
h.append(lpm.prism("knob", 6, 0.04, 0.06, at=(0.35, -1.98, 1.0), color=P["yellow"]))
for s in (-1, 1):
    x = s * 1.3
    h.append(lpm.box(f"win{s}", (0.9, 0.06, 0.7), at=(x, -1.93, 1.05), color=P["ink"]))
    h.append(lpm.box(f"win_frame{s}", (1.02, 0.04, 0.82), at=(x, -1.91, 0.99), color=P["wood"]))
    h.append(lpm.box(f"sill{s}", (1.1, 0.14, 0.06), at=(x, -1.98, 0.96), color=P["wood_dark"]))
    for d in (-1, 1):
        h.append(lpm.box(f"shutter{s}{d}", (0.28, 0.04, 0.78), at=(x + d * 0.67, -1.93, 1.01), color=P["green"]))
objs.append(lpm.finish("SM_ZooHut", h, P, budget=900, center=False))

# ------------------------------------------------------------------------------------------- park bench
bn = []
for x in (-0.75, 0.75):
    bn.append(lpm.sweep(f"side{x}", [(-0.22, 0), (-0.16, 0), (-0.12, 0.42), (0.16, 0.42), (0.2, 0), (0.26, 0), (0.22, 0.47), (0.24, 0.92), (0.19, 0.92), (0.16, 0.47), (-0.2, 0.47)],
                        depth=0.06, color=P["ink"]))
    lpm.rotate(bn[-1], 90, "Z"); lpm.move(bn[-1], x, 0, 0)
for k, y in enumerate((-0.15, -0.02, 0.11)):
    bn.append(lpm.box(f"seat{k}", (1.8, 0.11, 0.045), at=(0, y, 0.43), color=P["wood"] if k != 1 else P["wood_dark"]))
for k, z in enumerate((0.6, 0.76)):
    bn.append(lpm.box(f"back{k}", (1.8, 0.04, 0.1), at=(0, 0.215, z), color=P["wood"]))
objs.append(lpm.finish("SM_Bench", bn, P, budget=300, center=False))

# ------------------------------------------------------------------------------------------- rocks (tinted in game)
rk = [jitter(kit.blob("rock_a", (1.45, 1.1, 0.8), at=(0, 0, -0.08), color=P["white"], segments=7, rings=4), 0.07, 1),
      jitter(kit.blob("rock_b", (0.7, 0.6, 0.45), at=(0.7, 0.25, -0.05), color=P["white"], segments=6, rings=3), 0.05, 2),
      jitter(kit.blob("rock_c", (0.45, 0.4, 0.3), at=(-0.6, -0.35, -0.04), color=P["white"], segments=6, rings=3), 0.04, 3)]
for o in rk:
    lpm.paint(o, P["concrete"], where=lambda c, n, i: n.z < 0.35)       # flanks a shade darker than the tops
objs.append(lpm.finish("SM_Rock", rk, P, budget=300, center=False))

cv = [jitter(kit.blob("cave", (3.1, 2.1, 2.0), at=(0, 0.1, -0.75), color=P["white"], segments=9, rings=5), 0.12, 5),
      jitter(kit.blob("cave_top", (1.3, 1.1, 0.6), at=(0.55, 0.3, 0.95), color=P["white"], segments=6, rings=3), 0.06, 6),
      jitter(kit.blob("cave_side", (1.0, 0.9, 0.7), at=(-1.35, 0.2, -0.1), color=P["white"], segments=6, rings=3), 0.05, 8)]
lpm.paint(cv[0], P["concrete"], where=lambda c, n, i: n.z < 0.3)
cv.append(lpm.sweep("mouth", [(-0.55, 0), (0.55, 0), (0.5, 0.45), (0.3, 0.75), (0, 0.85), (-0.3, 0.75), (-0.5, 0.45)], depth=0.3, at=(0, -0.82, 0), color=P["ink"]))
objs.append(lpm.finish("SM_Cave", cv, P, budget=600, center=False))

# ------------------------------------------------------------------------------------------- petting corner
fd = [lpm.box("fd_box", (1.8, 0.8, 0.55), at=(0, 0, 0.15), color=P["wood"], taper=(1.05, 1.1))]
for x in (-0.82, 0.82):
    for y in (-0.32, 0.32):
        fd.append(lpm.box(f"fd_leg{x}{y}", (0.1, 0.1, 0.2), at=(x, y, 0), color=P["wood_dark"]))
fd.append(jitter(kit.blob("fd_hay", (1.6, 0.62, 0.4), at=(0, 0, 0.52), color=P["hay"], segments=10, rings=4), 0.035, 7))
for k in range(7):     # V hay rack above the trough
    x = -0.78 + k * 0.26
    for s in (-1, 1):
        sl = lpm.box(f"fd_slat{k}{s}", (0.04, 0.04, 0.6), at=(x, s * 0.12, 0.62), color=P["wood_dark"])
        lpm.rotate(sl, s * 22, "X", about=(x, 0, 0.62)); fd.append(sl)
fd.append(lpm.box("fd_rail", (1.8, 0.06, 0.06), at=(0, 0, 1.15), color=P["wood_dark"]))
objs.append(lpm.finish("SM_Feeder", fd, P, budget=500, center=False))

hu = []
for x in (-1.1, 1.1):
    for y in (-0.6, 0.6):
        hu.append(lpm.box(f"hu_leg{x}{y}", (0.1, 0.1, 0.3), at=(x, y, 0), color=P["wood_dark"]))
hu.append(lpm.box("hu_body", (2.4, 1.5, 0.7), at=(0, 0, 0.25), color=P["orange"]))
hu.append(along_x("hu_roof", [(-0.85, 0.92), (0.85, 1.12), (0.85, 1.2), (-0.85, 1.0)], 2.6, P["barn_red"]))
hu.append(lpm.box("hu_door", (0.5, 0.06, 0.38), at=(-0.6, -0.76, 0.3), color=P["ink"]))
hu.append(lpm.box("hu_mesh", (1.1, 0.04, 0.5), at=(0.5, -0.76, 0.35), color=P["slate_dark"]))
for k in range(5):
    hu.append(lpm.box(f"hu_wire{k}", (0.03, 0.06, 0.5), at=(0.05 + k * 0.22, -0.78, 0.35), color=P["steel"]))
ramp = along_x("hu_ramp", [(-0.76, 0.3), (-0.76, 0.34), (-1.2, 0.03), (-1.2, 0.0)], 0.45, P["wood"], at=(-0.6, 0, 0))
hu.append(ramp)
objs.append(lpm.finish("SM_Hutch", hu, P, budget=400, center=False))

lay = [(0, 0, 0), (4, 0, 0), (7, 0, 0), (10.5, 0, 0), (14, 0, 0), (17, 0, 0)]
export_web(objs[0], P, extra=objs[1:], slug="zoo_kit", spread=lay)
