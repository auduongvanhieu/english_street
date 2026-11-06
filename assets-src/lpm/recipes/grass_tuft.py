"""Grass tufts scattered over every grass tile (scene/Flora.tsx), 2 variants, instanced in the thousands.

Game contract: pivot = clump centre on the ground; Flora scales each instance so its height is ~0.45 m x random;
objects SM_GrassTuft_large / SM_GrassTuft_small (instances alternate). Budget <= 120 / 80 tris (the Quaternius
clumps they replace averaged ~290). Fresh yellow-greens so tufts read against the teal-green tiles (the old
dark clumps looked like twigs).
"""
import math, random
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web
import bmesh
from mathutils import Vector

lpm.reset()
P = palette()


def blade(name, a, h, w, lean, color, r0=0.03, thick=0.012):
    """A tapered, outward-leaning blade (2 levels to a point, 14 tris) as a closed thin shell: front + back skins
    (offset along the radial direction) joined along both edges and the base."""
    d = Vector((math.cos(a), math.sin(a), 0)); t = Vector((-math.sin(a), math.cos(a), 0))
    lv = [(0.0, 0.0, w), (0.6 * h, lean * 0.4, w * 0.7)]
    bm = bmesh.new()
    skins = []
    for side in (0.5, -0.5):
        base = d * (r0 + side * thick)
        rows = [[bm.verts.new(base + d * off + Vector((0, 0, z)) + t * ww), bm.verts.new(base + d * off + Vector((0, 0, z)) - t * ww)] for z, off, ww in lv]
        skins.append(rows)
    tip = bm.verts.new(d * (r0 + lean) + Vector((0, 0, h)))
    F, B = skins
    for k in range(1):
        bm.faces.new([F[k][0], F[k][1], F[k + 1][1], F[k + 1][0]])
        bm.faces.new([B[k + 1][0], B[k + 1][1], B[k][1], B[k][0]])
        for e in (0, 1):                                   # the two long edges
            bm.faces.new([F[k][e], F[k + 1][e], B[k + 1][e], B[k][e]])
    bm.faces.new([F[1][0], F[1][1], tip]); bm.faces.new([B[1][1], B[1][0], tip])
    for e in (0, 1):
        bm.faces.new([F[1][e], tip, B[1][e]])
    bm.faces.new([F[0][1], F[0][0], B[0][0], B[0][1]])    # base
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return lpm._object(name, bm, color)


def tuft(name, n, hmin, hmax, seed):
    rnd = random.Random(seed)
    parts = []
    for i in range(n):
        a = 2 * math.pi * i / n + rnd.uniform(-0.25, 0.25)
        h = rnd.uniform(hmin, hmax)
        c = P["leaf_light"] if i % 3 == 0 else P["leaf"] if i % 3 == 1 else P["green"]
        parts.append(blade(f"{name}_{i}", a, h, rnd.uniform(0.022, 0.03), h * rnd.uniform(0.3, 0.55), c))
    return lpm.finish(name, parts, P, budget=120 if n > 6 else 80, center=False)


large = tuft("SM_GrassTuft_large", 8, 0.32, 0.5, 4)
small = tuft("SM_GrassTuft_small", 5, 0.2, 0.32, 9)
export_web(large, P, extra=[small], slug="grass_tuft", spread=0.8)
