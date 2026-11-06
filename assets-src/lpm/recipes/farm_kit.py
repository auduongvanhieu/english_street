"""Green Valley Farm kit (scene/areas/Farm.tsx) - one GLB, one object per prop, merged into the farm's single
vertex-coloured mesh in game (Part.addColored). Every pivot = footprint centre on the ground, front (door side)
towards -Y (three +z).

Game contract (world/farmLayout.ts, Farm.tsx):
  * SM_Barn 16 x 9.5 m footprint (BARN blocker), walls 4.2 m; front windows where the night panes are:
    hayloft 1.6 x 1.1 centred z 3.55, side windows 1.5 x 1.1 at x +-5.8, z 2.0; front face at y = -4.75
  * SM_Coop 3 x 2.5 m (COOP blocker)        * SM_WindmillTower radius <= 1.2 (blocker), axle at (0, -1.0, 5.6)
  * SM_WindmillSails pivot = hub (game spins it about the axle, three z)
  * SM_Trough 2.4 x 0.6, SM_HayBale r 0.55 x 0.9 lying along X, SM_Stall 3.2 x 1.0 (STALL blocker)
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()
objs = []


def along_x(name, outline, length, color, at=(0, 0, 0)):
    """Extrude an (y, z) outline along X (sweep works in (x, z) along Y, then turn it)."""
    ob = lpm.sweep(name, outline, depth=length, color=color)
    lpm.rotate(ob, 90, "Z")
    lpm.move(ob, *at)
    return ob


# ------------------------------------------------------------------------------------------- barn
W, D, H = 16.0, 9.5, 4.2
FY = -D / 2
b = []
gable = [(-D / 2, 0), (D / 2, 0), (D / 2, H), (3.2, 5.45), (0, 6.3), (-3.2, 5.45), (-D / 2, H)]
b.append(along_x("barn_body", gable, W, P["barn_red"]))
roof_out = [(-5.1, 4.0), (-3.4, 5.62), (0, 6.55), (3.4, 5.62), (5.1, 4.0)]
roof_in = [(4.9, 4.0), (3.28, 5.4), (0, 6.32), (-3.28, 5.4), (-4.9, 4.0)]
roof = along_x("barn_roof", roof_out + roof_in, W + 0.6, P["slate_dark"])
lpm.paint(roof, P["white"], where=lambda c, n, i: abs(n.x) > 0.9)   # white gable trim on the roof ends
b.append(roof)
for x in (-W / 2, W / 2):
    for y in (-D / 2, D / 2):
        b.append(lpm.box(f"corner{x}{y}", (0.22, 0.22, H), at=(x, y, 0), color=P["white"]))
b.append(lpm.box("band", (W + 0.1, 0.06, 0.18), at=(0, FY - 0.02, H - 0.25), color=P["white"]))
# big double door: dark leaves with white frame and X braces
b.append(lpm.box("door_frame", (4.3, 0.06, 3.45), at=(0, FY - 0.02, 0), color=P["white"]))
for s in (-1, 1):
    b.append(lpm.box(f"door{s}", (1.95, 0.08, 3.2), at=(s * 1.0, FY - 0.05, 0), color=P["barn_red_dark"]))
    for d in (-1, 1):
        br = lpm.box(f"brace{s}{d}", (0.14, 0.04, 3.6), at=(s * 1.0, FY - 0.1, -0.2), color=P["white"])
        lpm.rotate(br, d * 31, "Y", about=(s * 1.0, FY - 0.1, 1.6))
        b.append(br)
    b.append(lpm.box(f"rail{s}", (1.95, 0.04, 0.14), at=(s * 1.0, FY - 0.1, 1.53), color=P["white"]))
# hayloft window + side windows (glass dark so the night panes read)
b.append(lpm.box("loft_frame", (1.8, 0.06, 1.3), at=(0, FY - 0.02, 2.9), color=P["white"]))
b.append(lpm.box("loft", (1.6, 0.08, 1.1), at=(0, FY - 0.04, 3.0), color=P["wood_dark"]))
for s in (-1, 1):
    b.append(lpm.box(f"win_frame{s}", (1.5, 0.06, 1.1), at=(s * 5.8, FY - 0.02, 1.45), color=P["white"]))
    b.append(lpm.box(f"win{s}", (1.3, 0.08, 0.9), at=(s * 5.8, FY - 0.04, 1.55), color=P["slate"]))
    b.append(lpm.box(f"win_bar{s}", (0.06, 0.1, 0.9), at=(s * 5.8, FY - 0.05, 1.55), color=P["white"]))
# cupola on the ridge with a little roof and a weather vane
b.append(lpm.box("cupola", (1.2, 1.2, 0.9), at=(0, 0, 6.1), color=P["white"]))
b.append(lpm.box("louver", (0.8, 1.24, 0.5), at=(0, 0, 6.25), color=P["slate_dark"]))
b.append(lpm.box("cupola_roof", (1.6, 1.6, 0.55), at=(0, 0, 6.98), color=P["slate_dark"], taper=(0.05, 0.05)))
b.append(lpm.prism("vane_rod", 4, 0.025, 0.7, at=(0, 0, 7.4), color=P["ink"]))
b.append(lpm.sweep("vane", [(0, 0), (0.45, 0.06), (0.32, 0.14), (0.05, 0.12)], depth=0.02, at=(-0.2, 0, 7.85), color=P["ink"]))
objs.append(lpm.finish("SM_Barn", b, P, budget=1500, center=False))

# ------------------------------------------------------------------------------------------- chicken coop
c = []
for x in (-1.25, 1.25):
    for y in (-0.95, 0.95):
        c.append(lpm.box(f"leg{x}{y}", (0.12, 0.12, 0.4), at=(x, y, 0), color=P["wood_dark"]))
c.append(lpm.box("floor", (2.9, 2.3, 0.12), at=(0, 0, 0.35), color=P["wood_dark"]))
c.append(along_x("walls", [(-1.1, 0.45), (1.1, 0.45), (1.1, 1.5), (0, 2.1), (-1.1, 1.5)], 2.7, P["yellow"]))
c.append(along_x("roof", [(-1.35, 1.4), (0, 2.2), (1.35, 1.4), (1.35, 1.52), (0, 2.34), (-1.35, 1.52)], 3.1, P["barn_red"]))
c.append(lpm.box("hatch", (0.5, 0.06, 0.6), at=(0.6, -1.12, 0.5), color=P["wood_dark"]))
c.append(lpm.box("hatch_frame", (0.62, 0.04, 0.7), at=(0.6, -1.11, 0.46), color=P["white"]))
c.append(lpm.box("window", (0.5, 0.06, 0.4), at=(-0.6, -1.12, 0.9), color=P["ink"]))
# ramp from the hatch sill down to the ground, with cleats for little chicken feet
c.append(along_x("ramp", [(-1.1, 0.42), (-1.1, 0.47), (-2.0, 0.05), (-2.0, 0.0)], 0.45, P["wood"], at=(0.6, 0, 0)))
for k in range(3):
    f = 0.25 + k * 0.25
    c.append(lpm.box(f"cleat{k}", (0.45, 0.05, 0.035), at=(0.6, -1.1 - f * 0.9, 0.45 - f * 0.43), color=P["wood_dark"]))
c.append(lpm.box("nestbox", (0.5, 1.6, 0.55), at=(1.55, 0, 0.6), color=P["yellow"], taper=(1.0, 1.0)))
c.append(lpm.box("nestlid", (0.62, 1.7, 0.06), at=(1.55, 0, 1.15), color=P["barn_red"]))
objs.append(lpm.finish("SM_Coop", c, P, budget=700, center=False))

# ------------------------------------------------------------------------------------------- windmill
t = []
t.append(lpm.lathe("w_base", [(0, 0), (1.18, 0), (1.18, 0.5), (1.05, 0.55), (0, 0.55)], segments=8, color=P["concrete_dark"]))
t.append(lpm.lathe("w_tower", [(1.0, 0.5), (0.68, 5.9), (0, 5.9)], segments=8, color=P["cream"]))
t.append(lpm.lathe("w_ring", [(0.78, 4.4), (0.82, 4.45), (0.82, 4.6), (0, 4.6)], segments=8, color=P["wood_dark"]))
t.append(lpm.lathe("w_cap", [(0.9, 5.85), (0.95, 5.95), (0.75, 6.5), (0.3, 6.95), (0, 7.05)], segments=8, color=P["barn_red_dark"]))
t.append(lpm.box("w_door", (0.75, 0.1, 1.3), at=(0, -1.0, 0.5), color=P["wood_dark"]))
t.append(lpm.box("w_window", (0.4, 0.1, 0.5), at=(0, -0.79, 3.2), color=P["ink"]))
axle = lpm.prism("w_axle", 6, 0.13, 0.55, at=(0, 0, 0), color=P["wood_dark"])
lpm.rotate(axle, 90, "X"); lpm.move(axle, 0, -0.5, 5.6)
t.append(axle)
objs.append(lpm.finish("SM_WindmillTower", t, P, budget=600, center=False))

s_ = []
s_.append(lpm.prism("hub", 8, 0.22, 0.3, at=(0, 0, 0), color=P["wood_dark"]))
lpm.rotate(s_[0], 90, "X"); lpm.move(s_[0], 0, 0.15, 0)
for k in range(4):
    a = 45 + k * 90
    arm = [lpm.box(f"spar{k}", (0.12, 0.08, 2.7), at=(0, 0, 0.1), color=P["wood_dark"]),
           lpm.box(f"sail{k}", (0.55, 0.04, 2.0), at=(0.33, 0, 0.7), color=P["white"]),
           lpm.box(f"rib{k}a", (0.6, 0.06, 0.05), at=(0.33, -0.01, 1.15), color=P["wood"]),
           lpm.box(f"rib{k}b", (0.6, 0.06, 0.05), at=(0.33, -0.01, 1.85), color=P["wood"])]
    for o in arm:
        lpm.rotate(o, a, "Y")
        s_.append(o)
sails = lpm.finish("SM_WindmillSails", s_, P, budget=300, ground=False, center=False)
objs.append(sails)

# ------------------------------------------------------------------------------------------- trough, hay bale
tr = [lpm.box("tr_body", (2.4, 0.6, 0.38), at=(0, 0, 0.06), color=P["wood"], taper=(1.06, 1.15)),
      lpm.box("tr_water", (2.2, 0.48, 0.03), at=(0, 0, 0.38), color=P["water"])]
for x in (-1.0, 1.0):
    tr.append(lpm.box(f"tr_leg{x}", (0.1, 0.7, 0.1), at=(x, 0, 0), color=P["wood_dark"]))
for x in (-0.4, 0.4):
    tr.append(lpm.box(f"tr_band{x}", (0.06, 0.66, 0.4), at=(x, 0, 0.05), color=P["slate_dark"], taper=(1.0, 1.12)))
objs.append(lpm.finish("SM_Trough", tr, P, budget=200, center=False))

# round bale: darker rolled ends with a lighter swirl, no bands (bands made it read as a barrel)
hb = lpm.prism("bale", 12, 0.55, 0.9, at=(0, 0, -0.45), color=P["hay"])
lpm.paint(hb, P["hay_dark"], where=lambda c, n, i: abs(n.z) > 0.9)
swirl = lpm.prism("bale_swirl", 12, 0.34, 0.93, at=(0, 0, -0.465), color=P["hay"])
core = lpm.prism("bale_core", 12, 0.14, 0.94, at=(0, 0, -0.47), color=P["hay_dark"])
bale = [hb, swirl, core]
for o in bale:
    lpm.rotate(o, 90, "Y"); lpm.move(o, 0, 0, 0.55)
objs.append(lpm.finish("SM_HayBale", bale, P, budget=200, center=False))

# ------------------------------------------------------------------------------------------- market stall
st = [lpm.box("counter", (3.2, 0.95, 0.9), at=(0, 0, 0), color=P["wood"]),
      lpm.box("counter_top", (3.35, 1.05, 0.08), at=(0, 0, 0.9), color=P["wood_dark"]),
      lpm.box("skirt", (3.22, 0.04, 0.5), at=(0, -0.49, 0.15), color=P["cream"])]
for x in (-1.5, 1.5):
    for y in (-0.4, 0.4):
        st.append(lpm.box(f"post{x}{y}", (0.1, 0.1, 2.5 if y > 0 else 2.2), at=(x, y, 0), color=P["wood_dark"]))
for k in range(8):   # striped awning sloping down to the front
    aw = lpm.box(f"awning{k}", (0.42, 1.5, 0.06), at=(-1.47 + k * 0.42, -0.15, 2.36), color=P["barn_red"] if k % 2 == 0 else P["white"])
    lpm.rotate(aw, 12, "X", about=(0, -0.15, 2.36))
    st.append(aw)
for k in range(8):   # scalloped valance
    st.append(lpm.box(f"val{k}", (0.42, 0.04, 0.22), at=(-1.47 + k * 0.42, -0.9, 2.0), color=P["barn_red"] if k % 2 == 0 else P["white"]))
fruit = [P["orange"], P["red"], P["yellow"], P["green"]]
for i in range(4):
    x = -1.1 + i * 0.73
    st.append(lpm.box(f"crate{i}", (0.6, 0.5, 0.25), at=(x, -0.1, 0.98), color=P["wood"], taper=(1.05, 1.05)))
    for k in range(4):
        st.append(lpm.lathe(f"fruit{i}{k}", [(0, 0), (0.08, 0.04), (0.09, 0.1), (0, 0.17)], segments=6, at=(x - 0.12 + (k % 2) * 0.24, -0.2 + (k // 2) * 0.2, 1.18), color=fruit[i]))
objs.append(lpm.finish("SM_Stall", st, P, budget=1200, center=False))

lay = [(0, 0, 0), (12, 0, 0), (17, 0, 0), (17, 0, 0), (22, 0, 0), (25, 0, 0), (29, 0, 0)]
export_web(objs[0], P, extra=objs[1:], slug="farm_kit", spread=lay)
