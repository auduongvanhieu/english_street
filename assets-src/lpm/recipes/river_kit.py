"""River kit - rowing boats, a duck pedalo, the ferry, piers and the boat-hire kiosk (scene/River.tsx).

Game contract (Blender axes; three = (x, z, -y)):
  * boats: pivot = hull centre on the waterline; bow towards -Y (three +Z, i.e. forward at rotation 0)
  * SM_RV_Rowboat: 3.0 x 1.2 m. Seats (three local): rower (x 0, z +0.1), passenger (x 0, z -0.85); seat top 0.24
    above the waterline. Oarlocks at (+-0.62, 0.32, +0.1); the oar is a separate object.
  * SM_RV_Oar: pivot at the oarlock, shaft along +X (1.7 m), blade at the far end; the game mirrors it for the left.
  * SM_RV_DuckBoat: 2.6 x 1.5 m pedalo, two seats side by side (x -+0.32, z -0.15), seat top 0.3; duck head at the bow.
  * SM_RV_Ferry: 8 x 3.6 m, flat deck at +0.45, rails all round with a gap at both ends (y = +-4, |x| < 0.9),
    benches along both sides (riders stand in the middle strip |x| < 0.8).
  * SM_RV_Pier: deck 2.4 m wide, 5 m long from the bank end (y 0) to the tip (y -5), deck top at z 0 (pivot),
    posts down to -1.3 (they disappear into the water).
  * SM_RV_Kiosk: 2.2 x 1.6 m boat-hire hut, pivot = floor centre, serving window on -Y (three +Z).
  * SM_RV_Buoy, SM_RV_LifeRing: small props.
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web

lpm.reset()
P = palette()


def hull(name, plan, depth, z0, color, keel=0.62, bow_rise=0.12, bow_y=-1.0):
    """A plan outline (x, y) extruded up from z0; narrower keel; the bow end (y < bow_y) rises a little."""
    h = lpm.sweep(name, plan, depth=depth, at=(0, 0, z0), color=color, axis="z")
    ymin = min(y for _, y in plan)
    for v in h.data.vertices:
        if v.co.z < z0 + depth / 2:
            v.co.x *= keel
            v.co.y *= 0.92
        if v.co.z > z0 + depth / 2 and v.co.y < bow_y:
            v.co.z += bow_rise * (bow_y - v.co.y) / (bow_y - ymin)
    h.data.update()
    return h


def ring_wall(name, plan, inset, z0, z1, color, top=None, bow_rise=0.0, bow_y=-1.0):
    """An open hull side: the band between the plan outline and the same outline scaled by `inset`, from z0 to z1
    (outer wall, inner wall, flat top). Top faces get `top` colour; the bow end (y < bow_y) rises by bow_rise."""
    import bmesh
    from mathutils import Vector
    ymin = min(y for _, y in plan)
    rise = lambda y: bow_rise * (bow_y - y) / (bow_y - ymin) if y < bow_y else 0.0
    bm = bmesh.new()
    n = len(plan)
    ob_ = [bm.verts.new(Vector((x, y, z0))) for x, y in plan]
    ot = [bm.verts.new(Vector((x, y, z1 + rise(y)))) for x, y in plan]
    ib = [bm.verts.new(Vector((x * inset, y * inset, z0))) for x, y in plan]
    it = [bm.verts.new(Vector((x * inset, y * inset, z1 + rise(y * inset)))) for x, y in plan]
    tops = []
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([ob_[i], ob_[j], ot[j], ot[i]])
        bm.faces.new([ib[j], ib[i], it[i], it[j]])
        tops.append(bm.faces.new([ot[i], ot[j], it[j], it[i]]))
        bm.faces.new([ob_[j], ob_[i], ib[i], ib[j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = lpm._object(name, bm, color)
    if top is not None:
        lpm.paint(ob, top, where=lambda c, nrm, i: nrm.z > 0.7)
    return ob


# ---------------------------------------------------------------- rowboat
def rowboat():
    L, B = 1.5, 0.6
    plan = [(0, -L), (0.38, -L + 0.45), (B, -0.4), (B, 0.9), (0.42, L), (-0.42, L), (-B, 0.9), (-B, -0.4), (-0.38, -L + 0.45)]
    # bottom (solid, below the floor) + an open side band with a wooden gunwale on top
    parts = [hull("rb_hull", plan, 0.2, -0.18, P["white"], bow_rise=0.0)]
    parts.append(ring_wall("rb_side", plan, 0.9, 0.02, 0.34, P["blue"], top=P["wood_dark"], bow_rise=0.12))
    parts.append(lpm.sweep("rb_floor", [(x * 0.9, y * 0.9) for x, y in plan], depth=0.02, at=(0, 0, 0.02), color=P["wood"], axis="z"))
    # thwarts (seats): rower in the middle, passenger at the stern; three z = -y
    parts.append(lpm.box("rb_seat_row", (1.1, 0.3, 0.05), at=(0, -0.1, 0.19), color=P["wood"]))
    parts.append(lpm.box("rb_seat_stern", (0.8, 0.36, 0.05), at=(0, 0.85, 0.19), color=P["wood"]))
    parts.append(lpm.box("rb_seat_bow", (0.55, 0.25, 0.05), at=(0, -1.0, 0.21), color=P["wood"]))
    for s in (-1, 1):
        parts.append(lpm.prism(f"rb_lock{s}", 6, 0.035, 0.08, at=(s * 0.62, -0.1, 0.36), color=P["steel"]))
    return lpm.finish("SM_RV_Rowboat", parts, P, budget=500, ground=False, center=False)


def oar():
    parts = [lpm.prism("oar_shaft", 6, 0.025, 1.45, at=(0, 0, 0), color=P["wood"], cap=False)]
    lpm.rotate(parts[0], 90, "Y")
    parts.append(lpm.box("oar_blade", (0.42, 0.03, 0.15), at=(1.62, 0, -0.075), color=P["wood_dark"]))
    parts.append(lpm.prism("oar_grip", 6, 0.03, 0.18, at=(0, 0, 0), color=P["wood_dark"]))
    lpm.rotate(parts[-1], 90, "Y"); lpm.move(parts[-1], -0.2, 0, 0)
    return lpm.finish("SM_RV_Oar", parts, P, budget=80, ground=False, center=False)


# ---------------------------------------------------------------- duck pedalo
def duckboat():
    L, B = 1.3, 0.75
    plan = [(0, -L), (0.5, -L + 0.3), (B, -0.3), (B, 0.8), (0.5, L), (-0.5, L), (-B, 0.8), (-B, -0.3), (-0.5, -L + 0.3)]
    parts = [hull("db_hull", plan, 0.25, -0.15, P["yellow"], keel=0.75, bow_rise=0.0)]
    parts.append(ring_wall("db_side", plan, 0.86, 0.1, 0.46, P["yellow"], top=P["orange"]))
    parts.append(lpm.sweep("db_floor", [(x * 0.86, y * 0.86) for x, y in plan], depth=0.02, at=(0, 0, 0.1), color=P["white"], axis="z"))
    # bench with a back rest, two places
    parts.append(lpm.box("db_seat", (1.05, 0.45, 0.06), at=(0, 0.15, 0.25), color=P["white"]))
    parts.append(lpm.box("db_back", (1.05, 0.08, 0.4), at=(0, 0.42, 0.3), color=P["white"]))
    # duck neck + head + beak + eyes at the bow (three +z)
    parts.append(lpm.lathe("db_neck", [(0.22, 0), (0.2, 0.35), (0.16, 0.65), (0, 0.72)], segments=8, at=(0, -0.95, 0.35), color=P["yellow"]))
    head = lpm.lathe("db_head", [(0, -0.22), (0.17, -0.16), (0.23, 0), (0.17, 0.16), (0, 0.22)], segments=8, at=(0, -1.0, 1.08), color=P["yellow"])
    parts.append(head)
    beak = lpm.prism("db_beak", 6, 0.09, 0.26, at=(0, 0, 0), color=P["orange"], radius_top=0.03)
    lpm.rotate(beak, 90, "X"); lpm.move(beak, 0, -1.2, 1.04)
    parts.append(beak)
    for s in (-1, 1):
        parts.append(lpm.box(f"db_eye{s}", (0.03, 0.06, 0.06), at=(s * 0.2, -1.07, 1.1), color=P["ink"]))
    # tail at the stern
    parts.append(lpm.sweep("db_tail", [(0.0, 0.0), (0.18, 0.0), (0.0, 0.45)], depth=0.12, at=(0, 0, 0), color=P["yellow"], axis="y"))
    lpm.rotate(parts[-1], 90, "Z"); lpm.move(parts[-1], 0, L - 0.05, 0.4)
    return lpm.finish("SM_RV_DuckBoat", parts, P, budget=600, ground=False, center=False)


# ---------------------------------------------------------------- ferry
def ferry():
    L, B = 4.0, 1.8
    plan = [(-B + 0.4, -L), (B - 0.4, -L), (B, -L + 0.6), (B, L - 0.6), (B - 0.4, L), (-B + 0.4, L), (-B, L - 0.6), (-B, -L + 0.6)]
    parts = [hull("fe_hull", plan, 0.6, -0.15, P["white"], keel=0.9, bow_rise=0.0)]
    lpm.paint(parts[0], P["blue_dark"], where=lambda c, n, i: c.z < 0.12 and abs(n.z) < 0.9)
    parts.append(lpm.sweep("fe_deck", [(x * 0.96, y * 0.98) for x, y in plan], depth=0.04, at=(0, 0, 0.43), color=P["wood"], axis="z"))
    # rails: posts + top rail on both long sides, short end rails beside the gangway gap (|x| < 0.9)
    for s in (-1, 1):
        x = s * (B - 0.12)
        for k in range(7):
            y = -L + 0.6 + k * (2 * L - 1.2) / 6
            parts.append(lpm.box(f"fe_post{s}{k}", (0.06, 0.06, 0.8), at=(x, y, 0.45), color=P["white"]))
        parts.append(lpm.box(f"fe_rail{s}", (0.08, 2 * L - 1.1, 0.06), at=(x, 0, 1.25), color=P["blue"]))
        for e in (-1, 1):
            parts.append(lpm.box(f"fe_end{s}{e}", (B - 1.0, 0.06, 0.06), at=(s * (0.9 + (B - 1.0) / 2 - 0.1), e * (L - 0.25), 1.25), color=P["blue"]))
            parts.append(lpm.box(f"fe_endpost{s}{e}", (0.06, 0.06, 0.8), at=(s * 0.92, e * (L - 0.25), 0.45), color=P["white"]))
        # benches along the sides
        parts.append(lpm.box(f"fe_bench{s}", (0.42, 3.2, 0.06), at=(s * (B - 0.45), -0.6, 0.85), color=P["wood_dark"]))
        for y in (-2.0, 0.8):
            parts.append(lpm.box(f"fe_bleg{s}{y}", (0.36, 0.06, 0.4), at=(s * (B - 0.45), y, 0.45), color=P["slate"]))
    # wheelhouse at the stern (three -z = +y)
    parts.append(lpm.box("fe_cabin", (1.6, 1.2, 1.25), at=(0, L - 1.3, 0.47), color=P["white"]))
    parts.append(lpm.box("fe_cabin_roof", (1.8, 1.4, 0.08), at=(0, L - 1.3, 1.72), color=P["blue_dark"]))
    parts.append(lpm.box("fe_window", (1.3, 0.02, 0.4), at=(0, L - 1.91, 1.15), color=P["ink"]))
    for s in (-1, 1):
        parts.append(lpm.box(f"fe_sidewin{s}", (0.02, 0.8, 0.35), at=(s * 0.81, L - 1.3, 1.15), color=P["ink"]))
    parts.append(lpm.prism("fe_funnel", 8, 0.16, 0.5, at=(0, L - 1.0, 1.8), color=P["red"], radius_top=0.14))
    # life rings on the cabin sides
    for s in (-1, 1):
        ring = lpm.lathe(f"fe_ring{s}", [(0.16, -0.04), (0.2, 0), (0.16, 0.04), (0.12, 0), (0.16, -0.04)], segments=10, at=(0, 0, 0), color=P["orange"])
        lpm.rotate(ring, 90, "Y"); lpm.move(ring, s * 0.83, L - 1.3, 0.9)
        parts.append(ring)
    return lpm.finish("SM_RV_Ferry", parts, P, budget=1300, ground=False, center=False)


# ---------------------------------------------------------------- pier, kiosk, buoy, life ring
def pier():
    W, LEN = 2.4, 5.0
    parts = []
    n = 10
    for k in range(n):
        y = -LEN * (k + 0.5) / n
        parts.append(lpm.box(f"pi_plank{k}", (W, LEN / n - 0.04, 0.08), at=(0, y, -0.08), color=P["wood"] if k % 2 == 0 else P["wood_dark"]))
    for s in (-1, 1):
        parts.append(lpm.box(f"pi_beam{s}", (0.12, LEN, 0.18), at=(s * (W / 2 - 0.1), -LEN / 2, -0.26), color=P["wood_dark"]))
        for y in (-0.4, -2.5, -4.7):
            parts.append(lpm.prism(f"pi_post{s}{y}", 6, 0.1, 1.55, at=(s * (W / 2 - 0.05), y, -1.3), color=P["bark"]))
    for s in (-1, 1):
        parts.append(lpm.lathe(f"pi_bollard{s}", [(0.09, 0), (0.09, 0.22), (0.13, 0.26), (0.0, 0.3)], segments=6, at=(s * (W / 2 - 0.2), -LEN + 0.25, 0), color=P["slate_dark"]))
    return lpm.finish("SM_RV_Pier", parts, P, budget=420, ground=False, center=False)


def kiosk():
    parts = [lpm.box("ki_body", (2.2, 1.6, 1.0), color=P["cream"])]
    parts.append(lpm.box("ki_counter", (2.3, 0.3, 0.06), at=(0, -0.85, 1.0), color=P["wood"]))
    parts.append(lpm.box("ki_upper_back", (2.2, 0.1, 1.15), at=(0, 0.75, 1.0), color=P["cream"]))
    for s in (-1, 1):
        parts.append(lpm.box(f"ki_upper_side{s}", (0.1, 1.6, 1.15), at=(s * 1.05, 0, 1.0), color=P["cream"]))
    # striped awning roof (blue / white)
    for k in range(6):
        parts.append(lpm.box(f"ki_roof{k}", (2.6 / 6, 2.1, 0.08), at=(-1.3 + 2.6 / 12 + k * 2.6 / 6, -0.15, 2.2), color=P["blue"] if k % 2 == 0 else P["white"], taper=(1.0, 0.95)))
    parts.append(lpm.box("ki_sign", (1.8, 0.06, 0.38), at=(0, -0.83, 2.28), color=P["blue_dark"]))
    ring = lpm.lathe("ki_ring", [(0.2, -0.05), (0.26, 0), (0.2, 0.05), (0.14, 0), (0.2, -0.05)], segments=10, color=P["orange"])
    lpm.rotate(ring, 90, "X"); lpm.move(ring, 0.7, -0.82, 0.5)
    parts.append(ring)
    return lpm.finish("SM_RV_Kiosk", parts, P, budget=380)


def buoy():
    parts = [lpm.lathe("bu_body", [(0, -0.3), (0.22, -0.2), (0.25, 0.05), (0.15, 0.3), (0.05, 0.55), (0, 0.6)], segments=8, color=P["red"])]
    lpm.paint(parts[0], P["white"], where=lambda c, n, i: 0.05 < c.z < 0.3)
    return lpm.finish("SM_RV_Buoy", parts, P, budget=80, ground=False, center=False)


boats = [rowboat(), oar(), duckboat(), ferry(), pier(), kiosk(), buoy()]
export_web(boats[0], P, extra=boats[1:], slug="river_kit", spread=[(0, 0, 0), (0, 2.5, 0), (3, 0, 0), (8, 0, 0), (14, 0, 0), (17.5, 0, 0), (20, 0, 0)])
