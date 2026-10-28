"""Pertemuan 9 — Sci-Fi / Mechanical Crate, built step by step in Blender.

Every modeling operation the module asks for is performed here with the same
Blender operators/bmesh calls the shortcuts trigger (the shortcut is noted next
to each step), so the workflow is reproducible and reviewable:

    blender -b --factory-startup --python build_scifi_crate.py

Outputs
  components/praktikum/pertemuan-9/blender/P09_SciFi_Crate.blend   the asset
  public/praktikum-9/stage-<n>.png      one render per workflow stage
  public/praktikum-9/stage-<n>.glb      the crate at that stage (modifiers applied)
  public/praktikum-9/experiments.png    side-by-side experiment objects
  public/praktikum-9/topology.png       final mesh with its wireframe
  public/praktikum-9/stats.json         vertex/face/quad/n-gon counts per stage

Tested with Blender 4.2 LTS.
"""

import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
PUBLIC = os.path.join(REPO, "public", "praktikum-9")
BLEND_PATH = os.path.join(HERE, "P09_SciFi_Crate.blend")
os.makedirs(PUBLIC, exist_ok=True)

EPS = 1e-4

# Body half-extents after Apply Scale: Cube(size 2) scaled X2 / Y1.5 / Z1.2.
HX, HY, HZ = 2.0, 1.5, 1.2
FOOT_H = 0.3
LID_RAISE = 0.12

COLORS = {
    "Crate_Body": (0.25, 0.42, 0.62, 1),
    "Side_Panel": (0.85, 0.55, 0.15, 1),
    "Handle": (0.12, 0.13, 0.16, 1),
    "Vent_Slats": (0.12, 0.13, 0.16, 1),
    "Foot": (0.30, 0.31, 0.34, 1),
}


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def log(message):
    print(f"[P09] {message}", flush=True)


def activate(obj):
    """Make `obj` the only selected, active object (what clicking it does)."""
    for other in bpy.context.view_layer.objects:
        other.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def edit_bmesh(obj, fn):
    """Edit Mode equivalent: work on the mesh's vertices/edges/faces, write back."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    fn(bm)
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def faces_where(bm, normal, predicate=lambda f: True):
    n = Vector(normal)
    return [f for f in bm.faces if f.normal.dot(n) > 0.99 and predicate(f)]


def largest(faces):
    return max(faces, key=lambda f: f.calc_area())


def extrude_face(bm, face, offset):
    """E: duplicate the face into a new face + side walls, then move it.

    The original face is deleted — it would otherwise remain inside the mesh
    as the 'extrude ganda' duplicate the module warns about (section 93).
    """
    result = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.delete(bm, geom=[face], context="FACES")
    verts = [g for g in result["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=verts, vec=Vector(offset))
    new_faces = [g for g in result["geom"] if isinstance(g, bmesh.types.BMFace)]
    bm.normal_update()
    n = Vector(offset).normalized()
    caps = [f for f in new_faces if f.normal.dot(n) > 0.99]
    return caps[0] if caps else None


def inset_face(bm, face, thickness):
    """I: shrink the face inward and fill the border with a ring of new faces.

    The original face survives as the inner face; it is returned.
    """
    bmesh.ops.inset_individual(bm, faces=[face], thickness=thickness, depth=0.0, use_even_offset=True)
    return face


def new_mesh_object(name, collection, build, location=(0, 0, 0), parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    bm = bmesh.new()
    build(bm)
    bm.to_mesh(mesh)
    bm.free()
    obj.location = location
    if parent:
        obj.parent = parent
    return obj


def mesh_stats(mesh):
    tris = sum(1 for p in mesh.polygons if len(p.vertices) == 3)
    quads = sum(1 for p in mesh.polygons if len(p.vertices) == 4)
    ngons = sum(1 for p in mesh.polygons if len(p.vertices) > 4)
    return {
        "verts": len(mesh.vertices),
        "edges": len(mesh.edges),
        "faces": len(mesh.polygons),
        "tris": tris,
        "quads": quads,
        "ngons": ngons,
    }


def mesh_stats_bm(bm):
    return {"verts": len(bm.verts), "edges": len(bm.edges), "faces": len(bm.faces)}


# ---------------------------------------------------------------------------
# scene setup
# ---------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"

crate_col = bpy.data.collections.new("SciFi_Crate")
scene.collection.children.link(crate_col)
exp_col = bpy.data.collections.new("Eksperimen")
scene.collection.children.link(exp_col)
stage_col = bpy.data.collections.new("Studio")
scene.collection.children.link(stage_col)

# An Empty as the asset root: moving it moves every part (Outliner hierarchy).
root = bpy.data.objects.new("SciFi_Crate", None)
root.empty_display_type = "PLAIN_AXES"
crate_col.objects.link(root)

stats = {"stages": []}
crate_parts = []


def record_stage(index, title, notes):
    """Render the crate, export it as GLB, and store topology counts."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    parts = []
    for obj in crate_parts:
        evaluated = obj.evaluated_get(depsgraph)
        evaluated_mesh = evaluated.to_mesh()
        parts.append(
            {
                "name": obj.name,
                "base": mesh_stats(obj.data),
                "evaluated": mesh_stats(evaluated_mesh),
                "modifiers": [f"{m.type.title()} ({m.name})" for m in obj.modifiers],
                "scale": [round(v, 4) for v in obj.scale],
            }
        )
        evaluated.to_mesh_clear()

    stats["stages"].append({"index": index, "title": title, "notes": notes, "parts": parts})
    render(os.path.join(PUBLIC, f"stage-{index}.png"), crate_camera)
    export_glb(os.path.join(PUBLIC, f"stage-{index}.glb"))
    total = sum(p["evaluated"]["faces"] for p in parts)
    log(f"stage {index} '{title}': {len(parts)} objects, {total} evaluated faces")


# ---------------------------------------------------------------------------
# camera, light, renderer — Workbench with per-object colours and cavity,
# close to the solid viewport students see while modeling.
# ---------------------------------------------------------------------------
def make_camera(name, location, target, lens=50):
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam = bpy.data.objects.new(name, cam_data)
    stage_col.objects.link(cam)
    cam.location = location
    direction = Vector(target) - Vector(location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return cam


crate_camera = make_camera("Camera_Crate", (7.6, -8.8, 6.4), (0, 0, 1.45), lens=42)
exp_camera = make_camera("Camera_Eksperimen", (16, -17, 13), (16, 0.6, 0.4), lens=30)
scene.camera = crate_camera

sun_data = bpy.data.lights.new("Key_Light", "SUN")
sun_data.energy = 3
sun = bpy.data.objects.new("Key_Light", sun_data)
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
stage_col.objects.link(sun)

ground = new_mesh_object(
    "Ground",
    stage_col,
    lambda bm: bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=90),
)
ground.color = (0.82, 0.83, 0.85, 1)

render_settings = scene.render
render_settings.engine = "BLENDER_WORKBENCH"
render_settings.resolution_x = 1280
render_settings.resolution_y = 800
render_settings.film_transparent = False
shading = scene.display.shading
shading.light = "STUDIO"
shading.color_type = "OBJECT"
shading.show_cavity = True
shading.cavity_type = "BOTH"
shading.show_shadows = True
shading.shadow_intensity = 0.35
scene.display.render_aa = "8"
scene.world = bpy.data.worlds.new("World")
scene.world.color = (0.05, 0.06, 0.09)


def render(path, camera):
    exp_col.hide_render = camera is not exp_camera
    crate_col.hide_render = camera is exp_camera
    scene.camera = camera
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def export_glb(path):
    """Export the crate plus an EDGES_<part> line copy of every part.

    glTF stores faces as triangles, so a wireframe drawn from the faces would
    show diagonals that do not exist in Blender. The edge copies keep the real
    quad/n-gon edges (after modifiers) for the portal's topology view.
    """
    depsgraph = bpy.context.evaluated_depsgraph_get()
    edge_objects = []
    for obj in crate_parts:
        evaluated = obj.evaluated_get(depsgraph).to_mesh()
        mesh = bpy.data.meshes.new(f"EDGES_{obj.name}")
        mesh.from_pydata([v.co.copy() for v in evaluated.vertices], [tuple(e.vertices) for e in evaluated.edges], [])
        obj.evaluated_get(depsgraph).to_mesh_clear()
        edges = bpy.data.objects.new(f"EDGES_{obj.name}", mesh)
        edges.matrix_world = obj.matrix_world.copy()
        crate_col.objects.link(edges)
        edge_objects.append(edges)

    for obj in bpy.context.view_layer.objects:
        obj.select_set(obj in crate_parts or obj in edge_objects)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,  # modifier results, exactly what the viewport shows
        export_materials="NONE",
        use_mesh_edges=True,  # loose edges (the EDGES_* objects) become glTF LINES primitives
        export_yup=True,
    )
    for edges in edge_objects:
        mesh = edges.data
        bpy.data.objects.remove(edges, do_unlink=True)
        bpy.data.meshes.remove(mesh)


def paint(obj, key):
    obj.color = COLORS[key]


# ===========================================================================
# STAGE 1 — PRIMITIVE / BLOCKOUT
# Big forms only: proportion and silhouette before any detail (section 28).
# ===========================================================================

# Shift+A > Mesh > Cube, F2 "Crate_Body", S X 2 / S Y 1.5 / S Z 1.2, Ctrl+A > Scale.
bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, FOOT_H + HZ))
body = bpy.context.active_object
body.name = body.data.name = "Crate_Body"
body.scale = (2.0, 1.5, 1.2)
log(f"Crate_Body scale before Apply Scale: {tuple(round(v, 3) for v in body.scale)}")
activate(body)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
log(f"Crate_Body scale after  Apply Scale: {tuple(round(v, 3) for v in body.scale)}")
bpy.context.scene.collection.objects.unlink(body)
crate_col.objects.link(body)
body.parent = root
paint(body, "Crate_Body")
crate_parts.append(body)

# Side panel: a single Plane, later given thickness by Solidify (Challenge C).
SP_Y, SP_Z = 1.1, 0.8


def build_side_panel(bm):
    # Winding chosen so the face normal points -X, i.e. away from the body.
    corners = [(0, -SP_Y, -SP_Z), (0, -SP_Y, SP_Z), (0, SP_Y, SP_Z), (0, SP_Y, -SP_Z)]
    verts = [bm.verts.new(c) for c in corners]
    bm.faces.new(verts)


side_panel = new_mesh_object(
    "Side_Panel", crate_col, build_side_panel, location=(-HX - 0.01, 0, FOOT_H + HZ), parent=root
)
paint(side_panel, "Side_Panel")
crate_parts.append(side_panel)

# Handle: starts as one small cube on the lid — the posts and bar are extruded from it.
HANDLE_T = 0.14


def build_handle_post(bm):
    bmesh.ops.create_cube(bm, size=HANDLE_T)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(-0.45, 0, HANDLE_T / 2))


handle = new_mesh_object(
    "Handle", crate_col, build_handle_post, location=(0, 0, FOOT_H + 2 * HZ + LID_RAISE), parent=root
)
paint(handle, "Handle")
crate_parts.append(handle)

# One vent slat — Array repeats it later (Challenge B).


def build_slat(bm):
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(2.4, 0.06, 0.1), verts=bm.verts)


# Resting on the recessed front panel (body face at y = -HY + 0.12, slat half-depth 0.03).
vent = new_mesh_object("Vent_Slats", crate_col, build_slat, location=(0, -HY + 0.12 - 0.03, FOOT_H + HZ - 0.55), parent=root)
paint(vent, "Vent_Slats")
crate_parts.append(vent)

# Feet: one foot, then Shift+D three times — placed with numeric input
# (the equivalent of Shift+D, X/Y, value).


def build_foot(bm):
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(0.5, 0.45, FOOT_H), verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, FOOT_H / 2))


foot = new_mesh_object("Foot_FL", crate_col, build_foot, location=(-1.6, -1.15, 0), parent=root)
paint(foot, "Foot")
crate_parts.append(foot)
for name, (x, y) in {"Foot_FR": (1.6, -1.15), "Foot_BL": (-1.6, 1.15), "Foot_BR": (1.6, 1.15)}.items():
    duplicate = foot.copy()
    duplicate.data = foot.data.copy()  # Shift+D: an independent copy, not Alt+D linked data
    duplicate.name = duplicate.data.name = name
    duplicate.location = (x, y, 0)
    crate_col.objects.link(duplicate)
    crate_parts.append(duplicate)

record_stage(
    1,
    "Primitive / Blockout",
    "Cube (S X2 Y1.5 Z1.2 lalu Apply Scale), Plane panel samping, cube kecil handle, satu slat, "
    "satu foot + 3 duplicate. Belum ada detail.",
)

# ===========================================================================
# STAGE 2 — EXTRUDE + INSET
# ===========================================================================


def detail_body(bm):
    # Front and back: I 0.18, then E inward 0.12 -> recessed panel.
    for normal in ((0, -1, 0), (0, 1, 0)):
        face = largest(faces_where(bm, normal))
        inner = inset_face(bm, face, 0.18)
        extrude_face(bm, inner, Vector(normal) * -0.12)

    # Lid: I 0.2, E up 0.12 (raised lid), then I 0.15, E down 0.06 (recess in the lid).
    top = largest(faces_where(bm, (0, 0, 1)))
    lid = extrude_face(bm, inset_face(bm, top, 0.2), (0, 0, LID_RAISE))
    extrude_face(bm, inset_face(bm, lid, 0.15), (0, 0, -0.06))


edit_bmesh(body, detail_body)


def detail_handle(bm):
    # Left post: top face E up 0.12, then E up 0.14 for the bar section.
    top = faces_where(bm, (0, 0, 1))[0]
    top = extrude_face(bm, top, (0, 0, 0.12))
    extrude_face(bm, top, (0, 0, HANDLE_T))
    # Bar: the +X face of that top segment, E along X 0.76, then E 0.14 for the corner.
    side = max(faces_where(bm, (1, 0, 0)), key=lambda f: f.calc_center_median().z)
    side = extrude_face(bm, side, (0.76, 0, 0))
    extrude_face(bm, side, (HANDLE_T, 0, 0))
    # Right post: the bottom face of the corner segment, E down 0.26 to the lid.
    corner_bottom = max(faces_where(bm, (0, 0, -1)), key=lambda f: f.calc_center_median().x)
    extrude_face(bm, corner_bottom, (0, 0, -0.26))


edit_bmesh(handle, detail_handle)

record_stage(
    2,
    "Extrude + Inset",
    "Panel depan & belakang: Inset 0.18 lalu Extrude ke dalam 0.12. Tutup: Inset 0.2, Extrude "
    "naik 0.12, Inset 0.15, Extrude turun 0.06. Handle berbentuk U dari 5 Extrude pada satu cube.",
)

# ===========================================================================
# STAGE 3 — LOOP CUT + BEVEL (+ Knife)
# ===========================================================================


def detail_side_panel(bm):
    # Ctrl+R, two cuts: the edge ring is the two edges running along Y (top and
    # bottom), so the cuts run vertically and split the plate into three strips.
    ring = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < EPS]
    bmesh.ops.subdivide_edges(bm, edges=ring, cuts=2, use_grid_fill=True)
    # Slide the two new loops to y = ±0.35 so the middle strip is 0.7 wide.
    for v in bm.verts:
        if abs(abs(v.co.y) - SP_Y / 3) < 0.02:
            v.co.y = math.copysign(0.35, v.co.y)
    bm.normal_update()
    # Middle strip: I 0.06 and E outward 0.05 -> a raised rib.
    middle = [f for f in bm.faces if abs(f.calc_center_median().y) < EPS][0]
    extrude_face(bm, inset_face(bm, middle, 0.06), (-0.05, 0, 0))
    # K (Knife) — chamfer the four corners, then remove the cut-off pieces.
    # Loop Cut cannot make diagonal edges; a knife cut across each corner can.
    cut = 0.25
    for sy in (-1, 1):
        for sz in (-1, 1):
            corner = Vector((0, sy * SP_Y, sz * SP_Z))
            no = Vector((0, sy, sz)).normalized()
            bmesh.ops.bisect_plane(
                bm,
                geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
                plane_co=corner - Vector((0, sy * cut, 0)),
                plane_no=no,
                clear_outer=True,
            )


edit_bmesh(side_panel, detail_side_panel)


def bevel_body(bm):
    # Ctrl+B on the four vertical outer corners, 3 segments, 0.1 wide.
    corners = [
        e
        for e in bm.edges
        if all(abs(abs(v.co.x) - HX) < EPS and abs(abs(v.co.y) - HY) < EPS for v in e.verts)
    ]
    bmesh.ops.bevel(
        bm,
        geom=corners,
        offset=0.1,
        offset_type="OFFSET",
        profile_type="SUPERELLIPSE",
        segments=3,
        profile=0.5,
        affect="EDGES",
        clamp_overlap=True,
    )


edit_bmesh(body, bevel_body)

record_stage(
    3,
    "Loop Cut + Bevel",
    "Panel samping: Loop Cut 2 garis vertikal, strip tengah di-Inset + Extrude jadi rib, empat "
    "sudut dipotong Knife. Body: Bevel 3 segment pada empat sudut tegak.",
)

# ===========================================================================
# STAGE 4 — MODIFIERS (non-destructive)
# ===========================================================================

# Crate_Body — Bevel modifier catches every remaining hard edge (angle limit).
bevel_mod = body.modifiers.new("Bevel", "BEVEL")
bevel_mod.width = 0.025
bevel_mod.segments = 2
bevel_mod.limit_method = "ANGLE"
bevel_mod.angle_limit = math.radians(30)

# Side_Panel — Solidify gives the plane thickness (Challenge C), then Mirror
# across the crate's root puts the same panel on the opposite side (Challenge A).
solidify = side_panel.modifiers.new("Solidify", "SOLIDIFY")
solidify.thickness = 0.08
solidify.offset = 1.0  # grow along the normal, i.e. outward from the body
mirror = side_panel.modifiers.new("Mirror", "MIRROR")
mirror.use_axis = (True, False, False)
mirror.mirror_object = root

# Vent_Slats — Array stacks the slat (Challenge B), Mirror puts the stack on the back too.
array = vent.modifiers.new("Array", "ARRAY")
array.count = 6
array.use_relative_offset = True
array.relative_offset_displace = (0, 0, 2.2)
vent_mirror = vent.modifiers.new("Mirror", "MIRROR")
vent_mirror.use_axis = (False, True, False)
vent_mirror.mirror_object = root

# Handle — Bevel then Subdivision Surface: a rounded grip (Challenge F). The
# bevel adds supporting edges so Subdivision rounds the bar without melting it.
handle_bevel = handle.modifiers.new("Bevel", "BEVEL")
handle_bevel.width = 0.02
handle_bevel.segments = 2
subsurf = handle.modifiers.new("Subdivision", "SUBSURF")
subsurf.levels = 2
subsurf.render_levels = 2

for foot_obj in [o for o in crate_parts if o.name.startswith("Foot_")]:
    foot_bevel = foot_obj.modifiers.new("Bevel", "BEVEL")
    foot_bevel.width = 0.03
    foot_bevel.segments = 2

record_stage(
    4,
    "Modifier",
    "Bevel (body, handle, foot), Solidify + Mirror (panel samping), Array + Mirror (slat vent), "
    "Subdivision Surface (handle). Base mesh tidak berubah — semuanya masih bisa diedit.",
)

# ===========================================================================
# STAGE 5 — CLEANUP + FINAL INSPECTION
# ===========================================================================
cleanup_report = {}
for obj in crate_parts:
    def clean(bm, name=obj.name):
        before = len(bm.verts)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)  # M > By Distance
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # A, Shift+N
        cleanup_report[name] = before - len(bm.verts)

    edit_bmesh(obj, clean)

log(f"Merge by Distance removed: {cleanup_report}")
stats["cleanup"] = cleanup_report

# Transform inspection: every part's scale must be (1, 1, 1).
bad_scale = [o.name for o in crate_parts if any(abs(s - 1) > EPS for s in o.scale)]
stats["nonUnitScale"] = bad_scale
log(f"Objects with non-unit scale: {bad_scale or 'none'}")

# Normal / topology inspection. Two neighbouring faces wind consistently when
# they traverse their shared edge in opposite directions; any edge where they
# don't is a flipped normal. Non-manifold edges (open holes, edges shared by
# 3+ faces) are counted too. Both should be 0 on a clean closed part.
topology = {}
for obj in crate_parts:
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    inconsistent = sum(
        1
        for e in bm.edges
        if len(e.link_loops) == 2 and e.link_loops[0].vert is e.link_loops[1].vert
    )
    non_manifold = sum(1 for e in bm.edges if not e.is_manifold)
    topology[obj.name] = {"flippedEdges": inconsistent, "nonManifoldEdges": non_manifold}
    bm.free()
stats["topology"] = topology
log(f"Topology inspection: {topology}")

record_stage(
    5,
    "Final Asset",
    "Merge by Distance + Recalculate Normal pada semua part, scale semua part (1,1,1), "
    "hierarchy SciFi_Crate di Outliner.",
)

# ===========================================================================
# EXPERIMENTS — in their own collection, beside the crate
# ===========================================================================
EX = 12.0  # x offset of the experiment row


def labelled_cube(name, location, size=1.0):
    obj = new_mesh_object(name, exp_col, lambda bm: bmesh.ops.create_cube(bm, size=size), location=location)
    obj.color = (0.7, 0.72, 0.76, 1)
    return obj


# Eksperimen 1 — Object Mode scale vs Edit Mode scale: same shape, different state.
exp1_a = labelled_cube("Exp1_A_ObjectScale", (EX - 6, -3, 0.5))
exp1_a.scale = (2, 1, 1)
exp1_b = labelled_cube("Exp1_B_EditScale", (EX - 6, 0, 0.5))
edit_bmesh(exp1_b, lambda bm: bmesh.ops.scale(bm, vec=(2, 1, 1), verts=bm.verts))
stats["exp1"] = {"A_scale": list(exp1_a.scale), "B_scale": list(exp1_b.scale)}

# Eksperimen 2 — Bevel on a non-uniformly scaled cube, before vs after Apply Scale.
for name, apply_scale, y in (("Exp2_BevelBeforeApply", False, -3), ("Exp2_BevelAfterApply", True, 0)):
    cube = labelled_cube(name, (EX - 1.5, y, 0.25))
    cube.scale = (3, 1, 0.5)
    if apply_scale:
        activate(cube)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = cube.modifiers.new("Bevel", "BEVEL")
    mod.width = 0.15
    mod.segments = 3

# Eksperimen 6 — bevel segments 1 / 3 / 6.
for i, segments in enumerate((1, 3, 6)):
    cube = labelled_cube(f"Exp6_Bevel_{segments}seg", (EX + 3 + i * 1.6, -3, 0.5))
    mod = cube.modifiers.new("Bevel", "BEVEL")
    mod.width = 0.2
    mod.segments = segments

# Eksperimen 7 — modifier order: Mirror→Bevel vs Bevel→Mirror on the same half.
for i, order in enumerate((("MIRROR", "BEVEL"), ("BEVEL", "MIRROR"))):
    half = new_mesh_object(
        f"Exp7_{order[0].title()}_then_{order[1].title()}",
        exp_col,
        lambda bm: (
            bmesh.ops.create_cube(bm, size=1.0),
            bmesh.ops.translate(bm, verts=bm.verts, vec=(0.5, 0, 0)),
        ),
        location=(EX + 4 + i * 2.6, 0.5, 0.5),
    )
    half.color = (0.7, 0.72, 0.76, 1)
    for kind in order:
        mod = half.modifiers.new(kind.title(), kind)
        if kind == "MIRROR":
            mod.use_clip = True
        else:
            mod.width = 0.12
            mod.segments = 3

# Eksperimen 11 — Merge by Distance: a cube with every vertex doubled.
merge = labelled_cube("Exp11_MergeByDistance", (EX + 10, -3, 0.5))


def double_and_merge(bm):
    bmesh.ops.duplicate(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:])
    before = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
    stats["exp11"] = {"before": before, "after": len(bm.verts)}


edit_bmesh(merge, double_and_merge)

# Eksperimen 12 — Recalculate Normal: flip three faces, then fix them.
normals = labelled_cube("Exp12_RecalcNormal", (EX + 10, 0, 0.5))


def flip_and_fix(bm):
    bmesh.ops.reverse_faces(bm, faces=bm.faces[:3])
    bm.normal_update()
    centre_ = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
    flipped = sum(1 for f in bm.faces if (f.calc_center_median() - centre_).dot(f.normal) < 0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    fixed = sum(1 for f in bm.faces if (f.calc_center_median() - centre_).dot(f.normal) < 0)
    stats["exp12"] = {"inwardBefore": flipped, "inwardAfter": fixed}


edit_bmesh(normals, flip_and_fix)

# Second row (y = 3) — the experiments that change topology rather than shading.
ROW2 = 3.2


def evaluated_faces(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    return len(obj.evaluated_get(depsgraph).data.polygons)


def top_face(bm):
    return largest(faces_where(bm, Vector((0, 0, 1))))


# Eksperimen 3 — Move (G) vs Extrude (E) on the top face of identical cubes.
exp3 = {}
for name, use_extrude, x in (("Exp3_Move_G", False, EX - 6), ("Exp3_Extrude_E", True, EX - 4.4)):
    cube = labelled_cube(name, (x, ROW2, 0.5))

    def grow(bm, use_extrude=use_extrude, name=name):
        face = top_face(bm)
        if use_extrude:
            extrude_face(bm, face, (0, 0, 0.6))
        else:
            bmesh.ops.translate(bm, verts=face.verts, vec=(0, 0, 0.6))
        exp3[name] = mesh_stats_bm(bm)

    edit_bmesh(cube, grow)
stats["exp3"] = exp3

# Eksperimen 4 — Inset then Extrude inward: a recessed panel on one face.
exp4 = labelled_cube("Exp4_InsetExtrude", (EX - 2.4, ROW2, 0.5))


def recess(bm):
    before = len(bm.faces)
    inner = inset_face(bm, top_face(bm), 0.15)
    after_inset = len(bm.faces)
    extrude_face(bm, inner, (0, 0, -0.12))
    stats["exp4"] = {"faces": [before, after_inset, len(bm.faces)]}


edit_bmesh(exp4, recess)

# Eksperimen 5 — one loop vs three loops (Ctrl+R) around the same quad strip.
exp5 = {}
for i, cuts in enumerate((1, 3)):
    cube = labelled_cube(f"Exp5_LoopCut_{cuts}", (EX + i * 1.6, ROW2, 0.5))

    def loop(bm, cuts=cuts):
        ring = [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).normalized().x) > 0.99]
        bmesh.ops.subdivide_edges(bm, edges=ring, cuts=cuts, use_grid_fill=True)
        exp5[str(cuts)] = mesh_stats_bm(bm)

    edit_bmesh(cube, loop)
stats["exp5"] = exp5

# Eksperimen 6 and 7 — how much geometry each modifier setup produces.
stats["exp6"] = {str(s): evaluated_faces(bpy.data.objects[f"Exp6_Bevel_{s}seg"]) for s in (1, 3, 6)}
stats["exp7"] = {
    o.name: {"faces": evaluated_faces(o), "stack": [m.type for m in o.modifiers]}
    for o in exp_col.objects
    if o.name.startswith("Exp7_")
}

# Eksperimen 8 — four bolts by Shift+D vs one bolt with an Array modifier.
bolt_x = EX + 3.6
bolts = [labelled_cube("Exp8_Duplicate_Bolt", (bolt_x, ROW2 - 0.5, 0.15), size=0.3)]
for i in range(1, 4):
    copy = bolts[0].copy()
    copy.data = bolts[0].data.copy()  # Shift+D: an independent mesh per copy
    copy.location.x = bolt_x + i * 0.5
    exp_col.objects.link(copy)
    bolts.append(copy)
array_bolt = labelled_cube("Exp8_Array_Bolt", (bolt_x, ROW2 + 0.5, 0.15), size=0.3)
arr = array_bolt.modifiers.new("Array", "ARRAY")
arr.count = 4
arr.use_relative_offset = False
arr.use_constant_offset = True
arr.constant_offset_displace = (0.5, 0, 0)
stats["exp8"] = {
    "duplicate": {"objects": len(bolts), "meshes": len({b.data.name for b in bolts})},
    "array": {"objects": 1, "count": arr.count, "faces": evaluated_faces(array_bolt)},
}

# Eksperimen 9 — snapping: a block "aligned by eye" is off by a few millimetres;
# Snap To Vertex moves its corner exactly onto the target corner. Headless
# Blender has no viewport to raycast against, so the snap is done the way the
# tool resolves it: the source vertex closest to the target gets its offset.
def world_verts(obj):
    bpy.context.view_layer.update()  # a new location reaches matrix_world only after an update
    return [obj.matrix_world @ v.co for v in obj.data.vertices]


def snap_gap(target, source):
    """Distance from the source's front-left-bottom corner to the target's front-right-bottom one."""
    t = max(world_verts(target), key=lambda c: (round(c.x, 4), -c.y, -c.z))
    s = min(world_verts(source), key=lambda c: (round(c.x, 4), c.y, c.z))
    return t - s


exp9 = {}
for label, y, snap in (("ByEye", ROW2 - 0.7, False), ("Snapped", ROW2 + 0.7, True)):
    target = labelled_cube(f"Exp9_Target_{label}", (EX + 6.4, y, 0.5), size=0.8)
    block = labelled_cube(f"Exp9_{label}", (EX + 6.4 + 0.83, y + 0.02, 0.5), size=0.8)
    if snap:
        block.location += snap_gap(target, block)
    gap = snap_gap(target, block)
    exp9[label] = [round(abs(c), 6) for c in gap]
stats["exp9"] = exp9

# Eksperimen 10 — Proportional Editing: the centre vertex of a grid moved up
# by 0.8, with O off and with O on (Smooth falloff, radius 1.5).
exp10 = {}
for i, proportional in enumerate((False, True)):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=12, y_subdivisions=12, size=3, location=(EX + 10 + i * 3.4, ROW2 + 0.3, 0.02))
    grid = bpy.context.active_object
    grid.name = f"Exp10_Proportional_{'ON' if proportional else 'OFF'}"
    for coll in grid.users_collection:
        coll.objects.unlink(grid)
    exp_col.objects.link(grid)
    grid.color = (0.7, 0.72, 0.76, 1)
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(grid.data)
    for v in bm.verts:
        v.select = False
    min(bm.verts, key=lambda v: v.co.length).select = True
    bmesh.update_edit_mesh(grid.data)
    bpy.ops.transform.translate(
        value=(0, 0, 0.8),
        use_proportional_edit=proportional,
        proportional_edit_falloff="SMOOTH",
        proportional_size=1.5,
    )
    bpy.ops.object.mode_set(mode="OBJECT")
    exp10["on" if proportional else "off"] = sum(1 for v in grid.data.vertices if v.co.z > 1e-4)
stats["exp10"] = {"movedVertsOff": exp10["off"], "movedVertsOn": exp10["on"]}

render(os.path.join(PUBLIC, "experiments.png"), exp_camera)

# ===========================================================================
# TOPOLOGY RENDER — final crate with its edges drawn by a Wireframe copy
# ===========================================================================
wire_objects = []
for obj in crate_parts:
    wire = obj.copy()
    wire.data = obj.data.copy()
    wire.name = f"WIRE_{obj.name}"
    crate_col.objects.link(wire)
    wire.color = (0.05, 0.05, 0.06, 1)
    wf = wire.modifiers.new("Wireframe", "WIREFRAME")
    wf.thickness = 0.012
    wf.use_replace = True
    wire_objects.append(wire)
render(os.path.join(PUBLIC, "topology.png"), crate_camera)
for wire in wire_objects:
    bpy.data.objects.remove(wire, do_unlink=True)

# ===========================================================================
# SAVE
# ===========================================================================
scene.camera = crate_camera
exp_col.hide_render = False
crate_col.hide_render = False
with open(os.path.join(PUBLIC, "stats.json"), "w", encoding="utf-8") as handle_file:
    json.dump(stats, handle_file, indent=2)
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH, compress=True)
log(f"saved {BLEND_PATH}")
log("done")
sys.exit(0)
