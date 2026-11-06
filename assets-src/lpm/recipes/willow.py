"""Weeping willow for the riverside tree tiles (scene/treeTiles.ts, tile 'grass-willow'), ~3.3 m tall, budget 1500 tris.

Game contract: pivot = trunk foot on the ground; crown centre ~ (0.15, -0.05, 2.45) and outer curtain radius
~1.3 m like the code-built willow it replaces (NightLights hangs fairy lights on the crown's upper vertices).
Shape: leaning trunk with a root flare and two limbs, a two-tone dome, and two layers of hanging "curtain"
with a jagged hem - alternating light/dark columns read as strands of leaves.
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web
sys.path.insert(0, os.path.dirname(lpm.__file__))
import lpm_kit as kit
import bmesh
from mathutils import Vector

lpm.reset()
P = palette()
parts = []
add = parts.append
CX, CY = 0.15, 0.05          # crown centre (trunk leans a little)


def frond(name, a, r0, z0, bulge, z_tip, w0, color, thick=0.045):
    """One hanging strand of leaves: a thin flat panel hanging from inside the crown, bowing outwards and
    tapering to a point (4 levels; closed so both sides render)."""
    d = Vector((math.cos(a), math.sin(a), 0)); t = Vector((-math.sin(a), math.cos(a), 0))
    c = Vector((CX, CY, 0))
    span = z0 - z_tip
    levels = [(r0, z0, w0), (r0 + bulge, z0 - 0.35 * span, w0 * 0.85), (r0 + bulge * 0.8, z0 - 0.75 * span, w0 * 0.5), (r0 + bulge * 0.55, z_tip, 0.0)]
    bm = bmesh.new()
    rows = []
    for r, z, w in levels:
        row = []
        for side in (1, -1):                     # outer / inner skin
            base = c + d * (r + side * thick / 2) + Vector((0, 0, z))
            row.append([bm.verts.new(base + t * w), bm.verts.new(base - t * w)] if w > 0 else [bm.verts.new(base)])
        rows.append(row)
    for k in range(len(rows) - 1):
        for side in (0, 1):
            A, B = rows[k][side], rows[k + 1][side]
            f = [A[0], A[1], B[1], B[0]] if len(B) == 2 else [A[0], A[1], B[0]]
            bm.faces.new(f if side == 0 else list(reversed(f)))
        # edges of the strip
        for e in (0, 1):
            A0, A1 = rows[k][0], rows[k][1]
            B0, B1 = rows[k + 1][0], rows[k + 1][1]
            ia = e
            ib = e if len(B0) == 2 else 0
            if len(B0) == 2:
                bm.faces.new([A0[ia], B0[ib], B1[ib], A1[ia]])
            else:
                bm.faces.new([A0[ia], B0[0], A1[ia]]) if ib == 0 and e == 0 else bm.faces.new([A0[ia], A1[ia], B0[0]])
    top = rows[0]
    bm.faces.new([top[0][0], top[0][1], top[1][1], top[1][0]])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return lpm._object(name, bm, color)


# trunk: root flare + leaning tapered trunk + two limbs into the crown
add(lpm.lathe("flare", [(0, 0), (0.32, 0), (0.2, 0.22), (0.16, 0.4), (0, 0.4)], segments=7, color=P["bark"]))
tr = lpm.prism("trunk", 7, 0.19, 2.1, at=(0, 0, 0.3), color=P["bark"], radius_top=0.11, cap=False)
for v in tr.data.vertices:
    v.co.x += CX * (v.co.z / 2.4); v.co.y += CY * (v.co.z / 2.4)
tr.data.update(); add(tr)
add(kit.limb("limb_l", 0.08, 0.04, 0.9, at=(0.08, 0.02, 1.35), color=P["bark"], pitch=-140, yaw=-30, sides=5))
add(kit.limb("limb_r", 0.07, 0.035, 0.8, at=(0.1, 0.0, 1.55), color=P["bark"], pitch=-145, yaw=120, sides=5))

# crown: a tall rounded dome + lighter top + two side lobes (rounder than a cap so there is no hat brim)
add(kit.blob("dome", (2.1, 2.0, 1.5), at=(CX, CY, 1.75), color=P["leaf"], segments=10, rings=6))
add(kit.blob("top", (1.4, 1.35, 0.85), at=(CX - 0.08, CY + 0.08, 2.5), color=P["leaf_light"], segments=8, rings=4))
add(kit.blob("lobe_a", (1.0, 0.95, 0.75), at=(CX + 0.72, CY - 0.3, 1.95), color=P["leaf_light"], segments=8, rings=4))
add(kit.blob("lobe_b", (0.95, 1.0, 0.7), at=(CX - 0.7, CY + 0.45, 1.9), color=P["leaf"], segments=8, rings=4))

# hanging strands: an outer ring of long ones (two light shades) and an inner ring of shorter dark ones;
# gaps between them let the trunk show through
import random
rnd = random.Random(11)
N_OUT, N_IN = 24, 12
for i in range(N_OUT):
    a = 2 * math.pi * i / N_OUT + rnd.uniform(-0.06, 0.06)
    # roots start inside the dome (its radius at z 2.35 is ~1.0) so no strand top shows under the crown
    add(frond(f"out{i}", a, 0.8, 2.35 + rnd.uniform(-0.08, 0.08), 0.38 + rnd.uniform(0, 0.1), rnd.uniform(0.45, 1.05), 0.15,
              P["leaf_light"] if i % 2 else P["leaf"]))
for i in range(N_IN):
    a = 2 * math.pi * (i + 0.5) / N_IN + rnd.uniform(-0.1, 0.1)
    add(frond(f"in{i}", a, 0.55, 2.2, 0.32, rnd.uniform(0.85, 1.25), 0.17, P["leaf_dark"]))

tree = lpm.finish("SM_Willow", parts, P, budget=1500, center=False)
export_web(tree, P, slug="willow")
