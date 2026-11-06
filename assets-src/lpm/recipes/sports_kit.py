"""Sports park kit - the live football, a basketball and a training cone (scene/areas/places/Football.tsx, Hoops).

Game contract:
  * SM_SP_Football: diameter 0.34 m (FOOTBALL.ballR = 0.17 in @es/shared sports.ts); pivot = bottom of the ball,
    so the game draws it at (x, y - 0.17, z) from the server position (ball centre). White with 12 ink pentagons.
  * SM_SP_Basketball: diameter 0.24 m, pivot = bottom; orange with ink seams.
  * SM_SP_Cone: 0.32 m training cone, pivot = foot centre (Coach says "go to the cone").
Budget: football <= 320, basketball <= 200, cone <= 60 tris.
"""
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web
import bmesh
from mathutils import Vector

lpm.reset()
P = palette()


def football():
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=0.17)
    bm.verts.ensure_lookup_table()
    bm.faces.index_update()
    # the 12 original icosahedron corners are the only 5-valent vertices: the faces round them form the pentagons
    corners = [v for v in bm.verts if len(v.link_edges) == 5]
    ink = {f.index for v in corners for f in v.link_faces}
    ob = lpm._object("SM_SP_Football", bm, P["white"])
    lpm.paint(ob, P["ink"], where=lambda c, n, i: i in ink)
    lpm.move(ob, dz=0.17)
    return lpm.finish("SM_SP_Football", [ob], P, budget=320)


def basketball():
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=9, radius=0.12)
    ob = lpm._object("SM_SP_Basketball", bm, P["orange"])
    # seams: the equator band (9 rings put a band of faces on it) and two great circles of one-face-wide strips
    def seam(c, n, i):
        a = math.degrees(math.atan2(c.y, c.x)) % 90
        return abs(c.z) < 0.01 or abs(a - 11.25) < 3
    lpm.paint(ob, P["ink"], where=seam)
    lpm.move(ob, dz=0.12)
    return lpm.finish("SM_SP_Basketball", [ob], P, budget=260)


def cone():
    parts = [
        lpm.box("base", (0.26, 0.26, 0.025), color=P["orange"]),
        lpm.prism("body", 8, 0.1, 0.3, at=(0, 0, 0.025), color=P["orange"], radius_top=0.02),
        lpm.prism("band", 8, 0.072, 0.06, at=(0, 0, 0.13), color=P["white"], radius_top=0.058, cap=False),
    ]
    return lpm.finish("SM_SP_Cone", parts, P, budget=60)


ball = football()
export_web(ball, P, extra=[basketball(), cone()], slug="sports_kit", spread=0.5)
