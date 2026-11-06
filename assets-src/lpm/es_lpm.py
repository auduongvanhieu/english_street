"""
es_lpm.py - English Street adapter for the blender-lpm-skill toolkit (runs INSIDE Blender).

The skill builds flat-shaded palette assets and exports Unity FBX. The game is Three.js, so this module adds:
  * ES_PALETTE  - the shared palette from docs/3d-art-direction.md (one palette for every LPM asset)
  * export_web() - GLB for apps/web/public/models/lpm/: Y-up, metres, flat normals, palette UVs + texture
                   AND a COLOR_0 vertex colour per face, so the game can draw it with the shared toon material
                   (chibiMaterial, vertexColors) like every code-built prop.
Objects whose name ends in "_glass" / "_water" are exported as separate meshes; the game swaps in its shared\nglass / water material (see glass()).

Recipes: assets-src/lpm/recipes/<asset>.py  ·  build all: python3 assets-src/lpm/build.py
"""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, ".claude", "skills", "blender-lpm-skill", "scripts"))

import bpy  # noqa: E402
import lpm  # noqa: E402,F401  (re-exported for recipes)

WEB_DIR = os.path.join(ROOT, "apps", "web", "public", "models", "lpm")
WORK_DIR = os.path.join(ROOT, "_work", "lpm")

# (name, sRGB hex, metallic, roughness[, emission]) - keep in sync with docs/3d-art-direction.md
ES_PALETTE = [
    ("slate", "#596273", 0.0, 0.6),
    ("slate_dark", "#3d4452", 0.0, 0.6),
    ("steel", "#9aa4b2", 0.0, 0.5),
    ("blue", "#2f80ed", 0.0, 0.55),
    ("blue_dark", "#1f5fb8", 0.0, 0.6),
    ("white", "#f4f6f8", 0.0, 0.7),
    ("cream", "#f3e3c3", 0.0, 0.8),
    ("wood", "#a0703c", 0.0, 0.8),
    ("wood_dark", "#6e4a26", 0.0, 0.85),
    ("concrete", "#b8bcc2", 0.0, 0.9),
    ("concrete_dark", "#8e939b", 0.0, 0.9),
    ("orange", "#f2994a", 0.0, 0.7),
    ("red", "#e05a47", 0.0, 0.7),
    ("green", "#4caf6a", 0.0, 0.75),
    ("yellow", "#f6c945", 0.0, 0.7),
    ("ink", "#2a2230", 0.0, 0.8),
    ("water", "#4fa3e0", 0.0, 0.2),
    ("water_light", "#bfe6fb", 0.0, 0.2),
    ("leaf", "#7fb04a", 0.0, 0.8),
    ("leaf_light", "#9dc95f", 0.0, 0.8),
    ("leaf_dark", "#5f9440", 0.0, 0.8),
    ("bark", "#6e4c33", 0.0, 0.9),
    ("barn_red", "#b8382c", 0.0, 0.8),
    ("barn_red_dark", "#8c2a20", 0.0, 0.8),
    ("hay", "#e0b84f", 0.0, 0.9),
    ("hay_dark", "#c49a3a", 0.0, 0.9),
    ("soil", "#6b4a30", 0.0, 0.95),
]


def palette():
    return lpm.Palette(ES_PALETTE)


def lathe_loop(name, profile, segments=12, at=(0, 0, 0), color=0, rotate_deg=0.0):
    """Revolve a CLOSED (radius, z) loop around Z with no caps: hollow rings, basins, rims, water curtains.
    (lpm.lathe caps both ends, which closes a basin over its water.) Loop order: counter-clockwise in (r, z)."""
    import math
    import bmesh
    from mathutils import Vector
    x, y, z = at
    bm = bmesh.new()
    rings = []
    for r, zz in profile:
        rings.append([bm.verts.new(Vector((x + r * math.cos(math.radians(rotate_deg) + 2 * math.pi * i / segments),
                                           y + r * math.sin(math.radians(rotate_deg) + 2 * math.pi * i / segments), z + zz)))
                      for i in range(segments)])
    n = len(rings)
    for k in range(n):
        a, b = rings[k], rings[(k + 1) % n]
        for i in range(segments):
            j = (i + 1) % segments
            bm.faces.new([a[i], a[j], b[j], b[i]])
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return lpm._object(name, bm, color)


def _vertex_colors(ob, pal):
    """Face-corner colour attribute (linear float) from the per-face lpm_color cell."""
    me = ob.data
    attr = me.attributes.get("lpm_color")
    col = me.color_attributes.get("Col") or me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    lin = [[lpm._srgb_to_linear(v) for v in lpm._hex(e[1])] for e in pal.entries]
    for poly in me.polygons:
        c = lin[attr.data[poly.index].value if attr else 0]
        for li in poly.loop_indices:
            col.data[li].color = (c[0], c[1], c[2], 1.0)
    me.color_attributes.active_color = col
    me.color_attributes.render_color_index = me.color_attributes.find("Col")


def glass(name, parts, color="#cfe6ff", kind="glass", alpha=0.35):
    """Join see-through parts into one '<name>_<kind>' object with its own simple material.
    kind 'glass' (panes) or 'water' (falling water, sprays): the game swaps in its shared glass / water material."""
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = ob.data.name = f"{name}_{kind}"
    uv = ob.data.uv_layers.new(name="UVMap")  # planar glass: one flat UV is enough (gate: UVs present)
    for poly in ob.data.polygons:
        poly.use_smooth = False
        for li in poly.loop_indices:
            uv.data[li].uv = (0.5, 0.5)
    m = bpy.data.materials.new(f"M_{name}_{kind}")
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*[lpm._srgb_to_linear(v) for v in lpm._hex(color)], 1.0)
    bsdf.inputs["Alpha"].default_value = alpha
    bsdf.inputs["Roughness"].default_value = 0.1
    if hasattr(m, "surface_render_method"):
        m.surface_render_method = "BLENDED"
    ob.data.materials.clear(); ob.data.materials.append(m)
    ob["lpm_tris"] = lpm.tri_count(ob)
    return ob


def export_web(ob, pal, extra=(), slug=None, spread=0.0):
    """Write apps/web/public/models/lpm/<slug>.glb and _work/lpm/<slug>/<Name>.blend; print a ##JSON## report.
    spread (float step along X, or one (dx, dy, dz) per object): GLB keeps every object at its pivot, but the review .blend lays them out along X (multi-part GLBs
    such as bird kinds / boat variants would otherwise overlap in the 5-view sheet)."""
    slug = slug or ob.name.removeprefix("SM_").lower()
    for o in (ob, *extra):          # every palette-painted object (not glass/water) gets COLOR_0
        if o.data.attributes.get("lpm_color"):
            _vertex_colors(o, pal)
    os.makedirs(WEB_DIR, exist_ok=True)
    work = os.path.join(WORK_DIR, slug)
    os.makedirs(work, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in (ob, *extra):
        o.select_set(True)
    bpy.context.view_layer.objects.active = ob
    glb = os.path.join(WEB_DIR, f"{slug}.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
        export_normals=True, export_texcoords=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
        export_materials="EXPORT", export_image_format="AUTO", export_extras=True, export_animations=False,
        export_skins=False, export_morph=False, export_cameras=False, export_lights=False,
    )
    if spread:
        from mathutils import Matrix
        for i, o in enumerate((ob, *extra)):   # mesh data, so transforms stay applied
            off = spread[i] if isinstance(spread, (list, tuple)) else (i * spread, 0, 0)
            o.data.transform(Matrix.Translation(off))
    blend = os.path.join(work, f"{ob.name}.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    xs = [v.co for v in ob.data.vertices]
    rep = {
        "name": ob.name, "slug": slug, "glb": os.path.relpath(glb, ROOT), "glb_bytes": os.path.getsize(glb),
        "blend": os.path.relpath(blend, ROOT), "tris": lpm.tri_count(ob), "budget": ob.get("lpm_budget"),
        "extra": {o.name: lpm.tri_count(o) for o in extra},
        "bounds_blender_m": [[round(min(v[i] for v in xs), 3) for i in range(3)], [round(max(v[i] for v in xs), 3) for i in range(3)]],
    }
    print("##JSON##" + json.dumps(rep))
    return rep
