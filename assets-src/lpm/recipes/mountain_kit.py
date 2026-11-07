"""Mountain kit - Maple Hill (scene/areas/places/MapleHill.tsx), the hills reached by train.

Game contract (Blender axes; three = (x, z, -y)); pivot = floor centre, front towards -Y (three +Z) unless noted.
  * SM_MH_Pine: pine tree ~6 m (trunk + three cones), instanced on the slopes.
  * SM_MH_Maple: the big red maple tree ~7.5 m, crown radius ~3 m (a landmark of the hike).
  * SM_MH_Cabin: ranger cabin 6 x 4.5, door in the middle of the front (-Y), porch 1.2 deep in front, roof ridge ~4.1 m.
  * SM_MH_Bridge: footbridge over the stream, 2.4 wide (X) x 6 long (Y), deck top at 0.1, railings 1 m.
  * SM_MH_Tent: A-frame tent 2 x 2.4, opening at the front.
  * SM_MH_Campfire: ring of stones 1.2 wide with logs; the flames are drawn by the game.
  * SM_MH_Picnic: picnic table 1.8 long (X) with two benches (seats at y +-0.65, 0.45 high).
  * SM_MH_BigRock: boulder ~3 m wide, 2.2 m high.
  * SM_MH_Viewer: coin binoculars on a post, eyepieces 1.3 m high, looking towards -Y.
  * SM_MH_Shelter: wooden station shelter 6 x 2.2 (open front -Y, roof 2.8 m) with a bench, sign board at 2.2 m.
  * SM_MH_Board: ranger notice board 2.0 x 1.2 on two posts (face -Y, centre 1.5 m high), small roof; text by game.
  * SM_MH_Cairn: summit cairn ~1.2 m with a flag pole 2.6 m.
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()
B = lpm.box


def pine():
    parts = [lpm.prism("trunk", 5, 0.18, 1.4, radius_top=0.14, color=P["bark"])]
    for k, (r, h, z) in enumerate([(1.5, 2.2, 1.0), (1.15, 2.0, 2.4), (0.75, 1.8, 3.7)]):
        parts.append(lpm.prism(f"cone{k}", 7, r, h, radius_top=0.02, at=(0, 0, z), color=P["leaf_dark"] if k != 1 else P["teal"]))
    return lpm.finish("SM_MH_Pine", parts, P, budget=90)


def maple():
    parts = [lpm.prism("trunk", 6, 0.35, 3.2, radius_top=0.24, color=P["bark"])]
    for k, a in enumerate((0, 2.1, 4.2)):
        br = lpm.prism(f"branch{k}", 4, 0.1, 1.4, radius_top=0.06, at=(0, 0, 2.6), color=P["bark"])
        lpm.rotate(br, 40, "X", about=(0, 0, 2.6))
        lpm.rotate(br, math.degrees(a), "Z", about=(0, 0, 0))
        parts.append(br)
    blobs = [(0, 0, 4.6, 2.6, "red"), (1.4, 0.6, 4.0, 1.8, "orange"), (-1.3, 0.8, 4.2, 1.8, "barn_red"), (0.3, -1.4, 4.1, 1.7, "orange"), (-0.5, -0.3, 5.9, 1.7, "red")]
    for k, (x, y, z, r, c) in enumerate(blobs):
        b = lpm.lathe(f"crown{k}", [(0.0, -r * 0.8), (r * 0.8, -r * 0.45), (r, 0.1), (r * 0.7, r * 0.6), (0.0, r * 0.8)], segments=7, at=(x, y, z), color=P[c])
        lpm.rotate(b, k * 23, "Z")
        parts.append(b)
    return lpm.finish("SM_MH_Maple", parts, P, budget=360)


def cabin():
    parts = [B("floor", (6.0, 4.5, 0.3), color=P["wood_dark"])]
    # log walls: a few stacked logs on each side, darker every other one
    for k in range(5):
        c = P["wood"] if k % 2 else P["wood_dark"]
        z = 0.3 + k * 0.5
        parts.append(B(f"back{k}", (6.0, 0.3, 0.5), at=(0, 2.1, z), color=c))
        for x in (-2.85, 2.85):
            parts.append(B(f"side{x}{k}", (0.3, 4.5, 0.5), at=(x, 0, z), color=c))
        for x in (-1.95, 1.95):
            parts.append(B(f"front{x}{k}", (2.1, 0.3, 0.5), at=(x, -2.1, z), color=c))
    parts.append(B("lintel", (1.8, 0.3, 0.5), at=(0, -2.1, 2.3), color=P["wood"]))
    parts.append(B("door", (1.0, 0.06, 1.9), at=(0, -2.12, 0.3), color=P["barn_red_dark"]))
    for x in (-1.9, 1.9):
        parts.append(B(f"win{x}", (0.9, 0.04, 0.7), at=(x, -2.27, 1.2), color=P["water_light"]))
    # gables + roof
    for y in (-2.1, 2.1):
        parts.append(B(f"gable{y}", (5.7, 0.3, 1.25), at=(0, y, 2.8), color=P["wood"], taper=(0.02, 1.0)))
    for s in (-1, 1):
        r = B(f"roof{s}", (3.6, 5.6, 0.16), at=(s * 1.6, -0.3, 3.35), color=P["barn_red_dark"])
        lpm.rotate(r, s * 21, "Y", about=(s * 1.6, -0.3, 3.43))
        parts.append(r)
    parts.append(B("chimney", (0.5, 0.5, 1.6), at=(1.6, 1.2, 3.6), color=P["concrete_dark"]))
    # porch
    parts.append(B("porch", (6.0, 1.2, 0.2), at=(0, -2.85, 0), color=P["wood"]))
    for x in (-2.85, 2.85):
        parts.append(B(f"pp{x}", (0.14, 0.14, 2.4), at=(x, -3.35, 0.2), color=P["wood_dark"]))
    parts.append(B("porchroof", (6.4, 1.6, 0.1), at=(0, -2.95, 2.6), color=P["barn_red_dark"]))
    return lpm.finish("SM_MH_Cabin", parts, P, budget=520)


def bridge():
    parts = [B("deck", (2.4, 6.0, 0.12), at=(0, 0, -0.02), color=P["wood"])]
    for k in range(7):
        parts.append(B(f"plank{k}", (2.42, 0.08, 0.02), at=(0, -2.7 + k * 0.9, 0.1), color=P["wood_dark"]))
    for x in (-1.15, 1.15):
        parts.append(B(f"rail{x}", (0.08, 6.0, 0.08), at=(x, 0, 0.95), color=P["wood_dark"]))
        for y in (-2.9, -1, 1, 2.9):
            parts.append(B(f"post{x}{y}", (0.12, 0.12, 1.0), at=(x, y, 0), color=P["wood_dark"]))
    return lpm.finish("SM_MH_Bridge", parts, P, budget=160)


def tent():
    parts = []
    for s in (-1, 1):
        w = B(f"wall{s}", (1.35, 2.4, 0.05), at=(s * 0.5, 0, 0.6), color=P["orange"])
        lpm.rotate(w, s * 52, "Y", about=(s * 0.5, 0, 0.6))
        parts.append(w)
    back = lpm.prism("back", 3, 1.05, 0.05, at=(0, 1.2, 0.0), color=P["red"])
    lpm.rotate(back, 90, "X", about=(0, 1.2, 0))
    parts.append(back)
    parts.append(B("door", (0.6, 0.02, 0.8), at=(0, -1.21, 0.0), color=P["ink"]))
    parts.append(B("floor", (2.0, 2.4, 0.03), color=P["slate_dark"]))
    return lpm.finish("SM_MH_Tent", parts, P, budget=80)


def campfire():
    parts = []
    for k in range(8):
        a = k * 2 * math.pi / 8
        parts.append(lpm.prism(f"stone{k}", 5, 0.16, 0.18, radius_top=0.1, at=(math.cos(a) * 0.55, math.sin(a) * 0.55, 0), color=P["concrete_dark"] if k % 2 else P["slate"]))
    for k in range(3):
        lg = B(f"log{k}", (0.12, 0.8, 0.12), at=(0, 0, 0.1), color=P["bark"])
        lpm.rotate(lg, k * 60, "Z", about=(0, 0, 0.1))
        parts.append(lg)
    return lpm.finish("SM_MH_Campfire", parts, P, budget=140)


def picnic():
    parts = [B("top", (1.8, 0.8, 0.06), at=(0, 0, 0.72), color=P["wood"])]
    for y in (-0.65, 0.65):
        parts.append(B(f"bench{y}", (1.8, 0.3, 0.05), at=(0, y, 0.42), color=P["wood"]))
    for x in (-0.7, 0.7):
        parts.append(B(f"leg{x}", (0.08, 1.6, 0.06), at=(x, 0, 0.36), color=P["wood_dark"]))
        parts.append(B(f"tleg{x}", (0.08, 0.08, 0.72), at=(x, 0, 0), color=P["wood_dark"]))
    return lpm.finish("SM_MH_Picnic", parts, P, budget=90)


def big_rock():
    r = lpm.lathe("rock", [(0.0, 0.0), (1.5, 0.1), (1.4, 1.0), (0.9, 1.8), (0.0, 2.2)], segments=7, color=P["concrete_dark"])
    lpm.rotate(r, 9, "Y")
    r2 = lpm.lathe("rock2", [(0.0, 0.0), (0.8, 0.05), (0.7, 0.6), (0.0, 1.0)], segments=6, at=(1.3, -0.6, 0), color=P["slate"])
    return lpm.finish("SM_MH_BigRock", [r, r2], P, budget=110)


def viewer():
    parts = [lpm.prism("post", 6, 0.08, 1.05, color=P["steel"]), lpm.prism("foot", 6, 0.3, 0.08, color=P["slate_dark"])]
    parts.append(B("body", (0.5, 0.4, 0.3), at=(0, 0, 1.05), color=P["green"]))
    for x in (-0.12, 0.12):
        e = lpm.prism(f"lens{x}", 8, 0.09, 0.3, at=(x, -0.2, 1.2), color=P["ink"])
        lpm.rotate(e, 90, "X", about=(x, -0.2, 1.2))
        parts.append(e)
    return lpm.finish("SM_MH_Viewer", parts, P, budget=120)


def shelter():
    parts = [B("floor", (6.0, 2.2, 0.15), color=P["concrete"])]
    parts.append(B("back", (6.0, 0.1, 2.6), at=(0, 1.05, 0.15), color=P["wood"]))
    for x in (-2.95, 2.95):
        parts.append(B(f"side{x}", (0.1, 2.2, 2.6), at=(x, 0, 0.15), color=P["wood_dark"]))
    parts.append(B("roof", (6.4, 2.6, 0.12), at=(0, -0.1, 2.75), color=P["barn_red_dark"]))
    parts.append(B("bench", (3.0, 0.5, 0.45), at=(0, 0.7, 0.15), color=P["wood_dark"]))
    parts.append(B("sign", (2.4, 0.06, 0.5), at=(0, -1.2, 2.2), color=P["teal"]))
    return lpm.finish("SM_MH_Shelter", parts, P, budget=120)


def board():
    parts = [B("panel", (2.0, 0.08, 1.2), at=(0, 0, 0.9), color=P["wood_dark"])]
    parts.append(B("face", (1.85, 0.02, 1.05), at=(0, -0.05, 0.975), color=P["cream"]))
    for x in (-1.05, 1.05):
        parts.append(B(f"post{x}", (0.12, 0.12, 2.4), at=(x, 0, 0), color=P["wood"]))
    parts.append(B("roof", (2.5, 0.6, 0.08), at=(0, -0.05, 2.38), color=P["barn_red_dark"]))
    return lpm.finish("SM_MH_Board", parts, P, budget=60)


def cairn():
    parts = []
    for k, (r, h) in enumerate([(0.6, 0.35), (0.48, 0.3), (0.36, 0.28), (0.24, 0.25)]):
        z = sum(hh for _, hh in [(0.6, 0.35), (0.48, 0.3), (0.36, 0.28), (0.24, 0.25)][:k])
        parts.append(lpm.prism(f"stone{k}", 6, r, h, radius_top=r * 0.8, at=(0, 0, z), color=P["concrete_dark"] if k % 2 else P["slate"]))
    parts.append(lpm.prism("pole", 5, 0.03, 2.6, color=P["steel"]))
    parts.append(B("flag", (0.7, 0.02, 0.45), at=(0.37, 0, 2.1), color=P["red"]))
    return lpm.finish("SM_MH_Cairn", parts, P, budget=90)


objs = [pine(), maple(), cabin(), bridge(), tent(), campfire(), picnic(), big_rock(), viewer(), shelter(), board(), cairn()]
export_web(objs[0], P, extra=objs[1:], slug="mountain_kit", spread=5.0)
