"""Old Town kit - the clock tower square and the museum (scene/areas/places/OldTown.tsx), reached by train.

Game contract (Blender axes; three = (x, z, -y)); pivot = floor centre, front towards -Y (three +Z) unless noted.
  * SM_OT_ClockTower: 4 x 4 base, clock storey 11 … 13.6 m, roof spire to ~17.5 m. The clock face is a white disc
    radius 1.25 on the front, centre at height 12.3, face plane at three z = +2.06 (the game draws the hands).
  * SM_OT_HouseA / SM_OT_HouseB: narrow townhouse 5 wide (X) x 6 deep, front gable to ~10 m, door in the middle.
  * SM_OT_Museum: hall 22 (X) x 14 (Y), walls 6 m high and 0.4 thick, doorway 3 m wide in the middle of the front,
    a portico of four columns 2 m in front of it. Without its roof (separate object).
  * SM_OT_MuseumRoof: the roof slab of the hall and the portico pediment (pivot = hall floor centre, like the hall).
  * SM_OT_Pedestal: exhibit plinth 0.8 x 0.8, top at 0.9.
  * Exhibits (pivot = their base; they stand on a pedestal top): SM_OT_Helmet, SM_OT_Crown, SM_OT_Phone, SM_OT_Ship.
  * SM_OT_Bicycle: penny-farthing 1.6 long (along X), stands on the floor.
  * SM_OT_Map: framed old map on an easel, 1.3 wide, 1.7 high, facing -Y.
  * SM_OT_Shelter: station shelter 6 x 2.2 (open front -Y, roof 2.8 m) with a bench, sign at 2.2 m.
  * SM_OT_Bench: bench 1.6 long, seat 0.45, back towards +Y.
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()
B = lpm.box


def clock_tower():
    parts = [B("base", (4.4, 4.4, 1.0), color=P["concrete_dark"])]
    parts.append(B("shaft", (3.6, 3.6, 10.0), at=(0, 0, 1.0), color=P["cream"]))
    parts.append(B("door", (1.2, 0.06, 2.2), at=(0, -1.82, 1.0), color=P["wood_dark"]))
    for z in (4.5, 7.5):
        parts.append(B(f"win{z}", (0.6, 0.06, 1.2), at=(0, -1.82, z), color=P["slate_dark"]))
    parts.append(B("band", (4.0, 4.0, 0.3), at=(0, 0, 10.7), color=P["concrete_dark"]))
    parts.append(B("clock", (4.0, 4.0, 2.6), at=(0, 0, 11.0), color=P["cream"]))
    face = lpm.prism("face", 16, 1.25, 0.06, at=(0, -2.0, 12.3), color=P["white"])
    lpm.rotate(face, 90, "X", about=(0, -2.0, 12.3))
    parts.append(face)
    ring = lpm.prism("ring", 16, 1.38, 0.04, at=(0, -1.99, 12.3), color=P["gold"])
    lpm.rotate(ring, 90, "X", about=(0, -1.99, 12.3))
    parts.append(ring)
    parts.append(B("cornice", (4.4, 4.4, 0.3), at=(0, 0, 13.6), color=P["concrete_dark"]))
    parts.append(lpm.prism("spire", 4, 3.0, 3.8, radius_top=0.02, at=(0, 0, 13.9), rotate=45, color=P["teal"]))
    parts.append(lpm.prism("tip", 6, 0.05, 0.9, at=(0, 0, 17.6), color=P["gold"]))
    return lpm.finish("SM_OT_ClockTower", parts, P, budget=240)


def house(name, wall, roof):
    parts = [B("walls", (5.0, 6.0, 7.0), color=P[wall])]
    parts.append(B("gable", (5.0, 0.25, 3.0), at=(0, -2.9, 7.0), color=P[wall], taper=(0.02, 1.0)))
    for s in (-1, 1):
        r = B(f"roof{s}", (3.3, 6.2, 0.16), at=(s * 1.3, 0.05, 8.15), color=P[roof])
        lpm.rotate(r, s * 50, "Y", about=(s * 1.3, 0.05, 8.23))
        parts.append(r)
    parts.append(B("shopwin", (3.4, 0.05, 1.6), at=(0, -3.02, 0.6), color=P["water_light"]))
    parts.append(B("door", (1.0, 0.06, 2.1), at=(1.7, -3.02, 0), color=P["wood_dark"]))
    parts.append(B("awning", (3.6, 0.6, 0.08), at=(-0.2, -3.25, 2.5), color=P["red" if wall != "red" else "teal"]))
    for z in (3.4, 5.3):
        for x in (-1.3, 1.3):
            parts.append(B(f"w{x}{z}", (0.9, 0.05, 1.2), at=(x, -3.02, z), color=P["slate_dark"]))
    return lpm.finish(name, parts, P, budget=140)


def museum():
    W, D, H, T = 22.0, 14.0, 6.0, 0.4
    parts = [B("floor", (W, D, 0.1), color=P["concrete"])]
    parts.append(B("back", (W, T, H), at=(0, D / 2 - T / 2, 0.1), color=P["cream"]))
    for x in (-W / 2 + T / 2, W / 2 - T / 2):
        parts.append(B(f"side{x}", (T, D, H), at=(x, 0, 0.1), color=P["cream"]))
    side_w = (W - 3.0) / 2
    for s in (-1, 1):
        parts.append(B(f"front{s}", (side_w, T, H), at=(s * (1.5 + side_w / 2), -D / 2 + T / 2, 0.1), color=P["cream"]))
    parts.append(B("lintel", (3.0, T, 1.6), at=(0, -D / 2 + T / 2, 4.5), color=P["cream"]))
    parts.append(B("plinth", (W + 0.4, D + 0.4, 0.5), at=(0, 0, -0.4), color=P["concrete_dark"]))
    # portico: steps and four columns
    parts.append(B("step", (10.0, 2.4, 0.1), at=(0, -D / 2 - 1.2, 0), color=P["concrete"]))
    for x in (-4.2, -1.6, 1.6, 4.2):
        parts.append(lpm.prism(f"col{x}", 10, 0.35, 5.6, at=(x, -D / 2 - 1.8, 0.1), color=P["white"]))
    # windows on the front
    for x in (-7.5, -4.5, 4.5, 7.5):
        parts.append(B(f"win{x}", (1.2, 0.05, 2.2), at=(x, -D / 2 - 0.02, 2.0), color=P["slate_dark"]))
    return lpm.finish("SM_OT_Museum", parts, P, budget=320)


def museum_roof():
    W, D = 22.0, 14.0
    parts = [B("slab", (W + 0.6, D + 0.6, 0.4), at=(0, 0, 6.1), color=P["concrete_dark"])]
    parts.append(B("entab", (10.4, 2.6, 0.5), at=(0, -D / 2 - 1.3, 5.7), color=P["white"]))
    parts.append(B("pediment", (10.4, 0.4, 1.8), at=(0, -D / 2 - 2.3, 6.2), color=P["white"], taper=(0.02, 1.0)))
    return lpm.finish("SM_OT_MuseumRoof", parts, P, budget=60, ground=False, center=False)


def pedestal():
    parts = [B("plinth", (0.9, 0.9, 0.12), color=P["concrete_dark"]), B("body", (0.7, 0.7, 0.7), at=(0, 0, 0.12), color=P["white"])]
    parts.append(B("top", (0.85, 0.85, 0.08), at=(0, 0, 0.82), color=P["concrete_dark"]))
    return lpm.finish("SM_OT_Pedestal", parts, P, budget=40)


def helmet():
    h = lpm.lathe("helm", [(0.0, 0.0), (0.2, 0.0), (0.21, 0.2), (0.17, 0.33), (0.0, 0.4)], segments=10, color=P["steel"])
    plume = B("plume", (0.05, 0.3, 0.12), at=(0, 0.04, 0.38), color=P["red"])
    visor = B("visor", (0.3, 0.03, 0.06), at=(0, -0.2, 0.2), color=P["ink"])
    return lpm.finish("SM_OT_Helmet", [h, plume, visor], P, budget=90)


def crown():
    parts = [lpm.prism("band", 10, 0.18, 0.1, color=P["gold"])]
    for k in range(5):
        a = k * 2 * math.pi / 5
        parts.append(lpm.prism(f"pt{k}", 4, 0.04, 0.12, radius_top=0.0, at=(math.cos(a) * 0.17, math.sin(a) * 0.17, 0.1), color=P["gold"]))
        parts.append(lpm.prism(f"gem{k}", 4, 0.025, 0.03, at=(math.cos(a) * 0.185, math.sin(a) * 0.185, 0.04), color=P["red"] if k % 2 else P["blue"]))
    parts.append(lpm.prism("cushion", 8, 0.26, 0.06, at=(0, 0, -0.06), color=P["carpet"]))
    return lpm.finish("SM_OT_Crown", parts, P, budget=110)


def phone():
    parts = [B("box", (0.3, 0.2, 0.22), color=P["wood_dark"]), B("dial", (0.14, 0.02, 0.14), at=(0, -0.11, 0.04), color=P["cream"])]
    parts.append(B("hook", (0.04, 0.04, 0.18), at=(0.12, 0, 0.22), color=P["ink"]))
    parts.append(B("handset", (0.07, 0.07, 0.22), at=(0.18, 0, 0.1), color=P["ink"]))
    parts.append(lpm.prism("bell", 8, 0.06, 0.06, at=(-0.08, 0, 0.22), color=P["gold"]))
    return lpm.finish("SM_OT_Phone", parts, P, budget=70)


def ship():
    hull = B("hull", (0.18, 0.6, 0.12), color=P["wood_dark"], taper=(1.0, 1.0))
    parts = [B("stand", (0.12, 0.3, 0.05), color=P["wood"]), hull]
    lpm.move(hull, 0, 0, 0.05)
    parts.append(B("deck", (0.16, 0.56, 0.02), at=(0, 0, 0.17), color=P["wood"]))
    for y, h in ((-0.15, 0.4), (0.12, 0.45)):
        parts.append(lpm.prism(f"mast{y}", 4, 0.01, h, at=(0, y, 0.18), color=P["wood_dark"]))
        parts.append(B(f"sail{y}", (0.02, 0.2, h * 0.6), at=(0, y, 0.25), color=P["cream"]))
    return lpm.finish("SM_OT_Ship", parts, P, budget=80)


def bicycle():
    parts = []
    big = lpm.prism("big", 14, 0.65, 0.04, at=(0.3, 0, 0.65), color=P["ink"])
    lpm.rotate(big, 90, "X", about=(0.3, 0, 0.65))
    parts.append(big)
    small = lpm.prism("small", 10, 0.18, 0.04, at=(-0.62, 0, 0.18), color=P["ink"])
    lpm.rotate(small, 90, "X", about=(-0.62, 0, 0.18))
    parts.append(small)
    frame = B("frame", (1.0, 0.04, 0.04), at=(-0.15, 0, 0.95), color=P["steel"])
    lpm.rotate(frame, -40, "Y", about=(-0.15, 0, 0.95))
    parts.append(frame)
    parts.append(B("seat", (0.2, 0.1, 0.05), at=(0.15, 0, 1.33), color=P["wood_dark"]))
    parts.append(B("bar", (0.04, 0.5, 0.04), at=(0.32, 0, 1.36), color=P["steel"]))
    return lpm.finish("SM_OT_Bicycle", parts, P, budget=140)


def map_easel():
    parts = []
    for x in (-0.5, 0.5):
        leg = B(f"leg{x}", (0.05, 0.05, 1.7), at=(x, 0.1, 0), color=P["wood_dark"])
        lpm.rotate(leg, -6, "X", about=(x, 0.1, 0))
        parts.append(leg)
    parts.append(B("frame", (1.3, 0.06, 0.95), at=(0, -0.02, 0.7), color=P["gold"]))
    parts.append(B("map", (1.16, 0.02, 0.81), at=(0, -0.06, 0.77), color=P["hay"]))
    for k, (x, z) in enumerate([(-0.3, 1.0), (0.2, 0.9), (0.1, 1.2)]):
        parts.append(B(f"ink{k}", (0.3, 0.01, 0.05), at=(x, -0.075, z), color=P["wood_dark"]))
    return lpm.finish("SM_OT_Map", parts, P, budget=80)


def shelter():
    parts = [B("floor", (6.0, 2.2, 0.15), color=P["concrete"])]
    parts.append(B("back", (6.0, 0.1, 2.6), at=(0, 1.05, 0.15), color=P["barn_red"]))
    for x in (-2.95, 2.95):
        parts.append(B(f"side{x}", (0.1, 2.2, 2.6), at=(x, 0, 0.15), color=P["barn_red"]))
    parts.append(B("roof", (6.4, 2.6, 0.12), at=(0, -0.1, 2.75), color=P["slate"]))
    parts.append(B("bench", (3.0, 0.5, 0.45), at=(0, 0.7, 0.15), color=P["wood"]))
    parts.append(B("sign", (2.4, 0.06, 0.5), at=(0, -1.2, 2.2), color=P["ink"]))
    return lpm.finish("SM_OT_Shelter", parts, P, budget=120)


def bench():
    parts = [B("seat", (1.6, 0.45, 0.06), at=(0, 0, 0.42), color=P["wood"])]
    back = B("back", (1.6, 0.05, 0.45), at=(0, 0.24, 0.5), color=P["wood"])
    lpm.rotate(back, 10, "X", about=(0, 0.24, 0.5))
    parts.append(back)
    for x in (-0.7, 0.7):
        parts.append(B(f"leg{x}", (0.06, 0.45, 0.42), at=(x, 0, 0), color=P["ink"]))
    return lpm.finish("SM_OT_Bench", parts, P, budget=50)


objs = [clock_tower(), house("SM_OT_HouseA", "cream", "barn_red_dark"), house("SM_OT_HouseB", "orange", "slate"), museum(), museum_roof(), pedestal(), helmet(), crown(), phone(), ship(), bicycle(), map_easel(), shelter(), bench()]
export_web(objs[0], P, extra=objs[1:], slug="oldtown_kit", spread=8.0)
