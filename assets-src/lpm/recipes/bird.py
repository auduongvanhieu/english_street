"""Flying birds - 3 kinds x (body, wing), flocks of 6 in the sky (scene/Wildlife.tsx), drawn at scale 2.6.

Game contract (Blender axes; three = (x, z, -y)):
  * body origin = body centre; head/beak towards -Y (three +z, the flight direction); length ~0.62
  * wing origin = shoulder, wing reaching along +X, leading edge towards -Y; the game rotates it about the
    flight axis to flap and mirrors it for the left side
  * objects: SM_Bird_body_<kind>, SM_Bird_wing_<kind>, kind in dark | white | brown (Wildlife.tsx kinds order)
Budget: body <= 200, wing <= 40 tris (36 birds in the sky at once).
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web
sys.path.insert(0, os.path.join(os.path.dirname(lpm.__file__)))
import lpm_kit as kit
import bpy
from mathutils import Matrix

lpm.reset()
P = palette()
KINDS = {  # back, belly, wing tip, beak
    "dark": ("slate", "steel", "ink", "yellow"),
    "white": ("white", "white", "ink", "orange"),
    "brown": ("wood", "cream", "wood_dark", "yellow"),
}
objs = []
for kind, (back, belly, tip, beak) in KINDS.items():
    # body: revolved along its length (z), then turned so the head points to -Y
    body = lpm.lathe(f"body_{kind}", [(0, -0.26), (0.05, -0.19), (0.095, -0.06), (0.105, 0.04), (0.085, 0.13), (0, 0.17)], segments=8, color=P[back])
    lpm.rotate(body, 90, "X")
    lpm.scale(body, 1, 1, 0.85)
    lpm.paint(body, P[belly], where=lambda c, n, i: n.z < -0.35)
    head = kit.blob(f"head_{kind}", (0.17, 0.18, 0.16), at=(0, -0.19, 0.0), color=P[back], segments=8, rings=4)
    bk = lpm.prism(f"beak_{kind}", 4, 0.032, 0.09, at=(0, 0, 0), color=P[beak], radius_top=0.0, rotate=45)
    lpm.rotate(bk, 90, "X"); lpm.move(bk, 0, -0.26, 0.075)
    eyes = [lpm.box(f"eye{s}_{kind}", (0.012, 0.03, 0.03), at=(s * 0.075, -0.235, 0.085), color=P["ink"]) for s in (-1, 1)]
    tail = lpm.sweep(f"tail_{kind}", [(-0.035, 0.12), (0.035, 0.12), (0.1, 0.33), (0.03, 0.29), (0, 0.32), (-0.03, 0.29), (-0.1, 0.33)], depth=0.02, at=(0, 0, 0.0), color=P[back], axis="z")
    lpm.paint(tail, P[tip], where=lambda c, n, i: c.y > 0.27)
    objs.append(lpm.finish(f"SM_Bird_body_{kind}", [body, head, bk, *eyes, tail], P, budget=200, ground=False, center=False))
    # wing: flat outline in the XY plane with a notched trailing edge, darker primaries at the tip
    wing = lpm.sweep(f"wing_{kind}", [(0.0, -0.07), (0.32, -0.11), (0.62, -0.05), (0.8, 0.04), (0.68, 0.06), (0.62, 0.03),
                                      (0.55, 0.09), (0.47, 0.05), (0.38, 0.11), (0.22, 0.09), (0.0, 0.09)], depth=0.022, at=(0, 0, -0.011), color=P[back], axis="z")
    lpm.paint(wing, P[tip], where=lambda c, n, i: c.x > 0.56)
    objs.append(lpm.finish(f"SM_Bird_wing_{kind}", [wing], P, budget=40, ground=False, center=False))

# review layout only: each kind assembled (wing at the shoulder + a mirrored copy), kinds 0.9 m apart
for k, o in enumerate(objs[1::2]):
    m = o.copy(); m.data = o.data.copy(); m.name = o.name + "_L_preview"
    bpy.context.scene.collection.objects.link(m)
    m.data.transform(Matrix.Scale(-1, 4, (1, 0, 0))); m.data.flip_normals()
    m.data.transform(Matrix.Translation((k * 0.9 - 0.06, -0.04, 0.03)))
lay = [(k // 2 * 0.9 + (0.06 if k % 2 else 0), -0.04 if k % 2 else 0, 0.03 if k % 2 else 0) for k in range(len(objs))]
export_web(objs[0], P, extra=objs[1:], slug="bird", spread=lay)
