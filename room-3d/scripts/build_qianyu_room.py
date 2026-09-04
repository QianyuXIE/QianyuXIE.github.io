"""Build Qianyu's original interactive room as a Blender source scene.

Run from the repository root:
  blender --background --python room-3d/scripts/build_qianyu_room.py -- <repo-root>

The file deliberately creates original geometry and materials.  It uses a
single, named scene graph so the exported GLB can be addressed by Three.js
raycasting and camera-focus anchors later.
"""

import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(sys.argv[sys.argv.index("--") + 1]).resolve() if "--" in sys.argv else Path.cwd()
OUTPUT = ROOT / "assets" / "room3d"
SOURCE = ROOT / "room-3d" / "source"
TEXTURES = OUTPUT / "textures"
PREVIEW = ROOT / "room-3d" / "preview"
OUTPUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
TEXTURES.mkdir(parents=True, exist_ok=True)
PREVIEW.mkdir(parents=True, exist_ok=True)


PALETTE = {
    "wall": (0.84, 0.83, 0.79, 1),
    "space": (0.92, 0.91, 0.87, 1),
    "wall_dark": (0.14, 0.14, 0.13, 1),
    "floor": (0.88, 0.87, 0.83, 1),
    "wood": (0.42, 0.25, 0.14, 1),
    "wood_light": (0.60, 0.39, 0.22, 1),
    "cream": (0.91, 0.89, 0.84, 1),
    "paper": (0.96, 0.95, 0.91, 1),
    "ink": (0.025, 0.027, 0.026, 1),
    "teal": (0.055, 0.060, 0.058, 1),
    "teal_light": (0.24, 0.33, 0.30, 1),
    "red": (0.42, 0.075, 0.055, 1),
    "gold": (0.62, 0.43, 0.16, 1),
    "vinyl": (0.008, 0.01, 0.012, 1),
    "glass": (0.16, 0.21, 0.22, 0.24),
    "sky": (0.32, 0.38, 0.39, 1),
    "screen": (0.008, 0.012, 0.011, 1),
    "lamp": (0.95, 0.76, 0.46, 1),
    "plant": (0.16, 0.20, 0.16, 1),
    "metal": (0.30, 0.31, 0.30, 1),
    "blue": (0.10, 0.16, 0.22, 1),
}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def material(name, rgba, roughness=0.58, metallic=0.0, emission=None):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = 2.5
    return mat


M = {}


def initialize_materials():
    materials = {key: material(key, color) for key, color in PALETTE.items()}
    materials["screen"] = material("screen", PALETTE["screen"], roughness=0.25, metallic=0.15, emission=(0.001, 0.003, 0.003, 1))
    materials["lamp"] = material("lamp", PALETTE["lamp"], roughness=0.4, metallic=0.05, emission=(1.0, 0.20, 0.02, 1))
    materials["metal"] = material("metal", PALETTE["metal"], roughness=0.30, metallic=0.85)
    materials["glass"] = material("glass", PALETTE["glass"], roughness=0.10, metallic=0.08)
    glass_bsdf = materials["glass"].node_tree.nodes.get("Principled BSDF")
    glass_bsdf.inputs["Alpha"].default_value = 0.24
    if "Transmission Weight" in glass_bsdf.inputs:
        glass_bsdf.inputs["Transmission Weight"].default_value = 0.38
    if hasattr(materials["glass"], "surface_render_method"):
        materials["glass"].surface_render_method = "DITHERED"
    materials["sky"] = material("sky", PALETTE["sky"], roughness=0.35, emission=(0.11, 0.48, 0.56, 1))
    materials["space"] = material("space", PALETTE["space"], roughness=0.82)
    materials["photo_sea"] = image_material("photo_sea", ROOT / "img" / "Me" / "Me8.jpg")
    materials["photo_snow"] = image_material("photo_snow", ROOT / "img" / "Me" / "Me9.jpg")
    return materials


def tag(obj, interaction=None, group="environment"):
    obj["room_group"] = group
    if interaction:
        obj["interaction"] = interaction
    return obj


def activate(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


def add_box(name, location, dimensions, mat, bevel=0.04, interaction=None, group="environment", rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("soft_edges", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
    obj.data.materials.append(mat)
    return tag(obj, interaction, group)


def add_cylinder(name, location, radius, depth, mat, vertices=48, rotation=(0, 0, 0), interaction=None, group="environment"):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    bevel = obj.modifiers.new("rim_softness", "BEVEL")
    bevel.width = min(radius * 0.08, 0.035)
    bevel.segments = 2
    return tag(obj, interaction, group)


def add_cone(name, location, radius_bottom, radius_top, depth, mat, vertices=48, rotation=(0, 0, 0), interaction=None, group="environment"):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius_bottom, radius2=radius_top, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    bevel = obj.modifiers.new("rim_softness", "BEVEL")
    bevel.width = min(radius_bottom * 0.06, 0.025)
    bevel.segments = 2
    return tag(obj, interaction, group)


def add_uv_sphere(name, location, scale, mat, interaction=None, group="environment"):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return tag(obj, interaction, group)


def add_torus(name, location, major_radius, minor_radius, mat, interaction=None, group="environment"):
    bpy.ops.mesh.primitive_torus_add(major_radius=major_radius, minor_radius=minor_radius, major_segments=48, minor_segments=10, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return tag(obj, interaction, group)


def add_curve(name, points, radius, mat, interaction=None, group="environment", cyclic=False):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    curve.materials.append(mat)
    return tag(obj, interaction, group)


def add_focus(name, location, target):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=location)
    obj = bpy.context.object
    obj.name = name
    obj.empty_display_size = 0.4
    obj["focus_target"] = list(target)
    obj["room_group"] = "focus"
    return obj


def add_text_panel(name, location, size, color, group):
    panel = add_box(name, location, size, M[color], bevel=0.018, group=group)
    return panel


def image_material(name, path):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    for node in list(nodes):
        nodes.remove(node)
    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    image = nodes.new("ShaderNodeTexImage")
    image.image = bpy.data.images.load(str(path), check_existing=True)
    bsdf.inputs["Roughness"].default_value = 0.62
    links.new(image.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat


def add_image_plane(name, location, width, height, mat, interaction=None, group="wall"):
    vertices = [
        (-width / 2, 0, -height / 2),
        (width / 2, 0, -height / 2),
        (width / 2, 0, height / 2),
        (-width / 2, 0, height / 2),
    ]
    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(vertices, [], [(0, 1, 2, 3)])
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop, uv in zip(mesh.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        uv_layer.data[loop.index].uv = uv
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.data.materials.append(mat)
    obj["preserve_uv"] = True
    return tag(obj, interaction, group)


def look_at(obj, point):
    direction = Vector(point) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def room_shell():
    # One display wall and an oversized floor create the open studio seen in
    # the reference. There are deliberately no side walls or ceiling.
    add_box("studio_floor", (0, 0, -0.10), (28, 28, 0.18), M["floor"], bevel=0.06, group="environment")
    add_box("studio_wall", (0, 5.55, 20.0), (60.0, 0.18, 40.2), M["wall"], bevel=0.08, group="environment")
    add_box("studio_baseboard", (0, 5.38, 0.22), (59.7, 0.14, 0.24), M["cream"], bevel=0.025, group="environment")


def desk_and_computer():
    group = "computer"
    # Thin off-white desktop on two restrained timber trestles.
    add_box("desk_top", (0.15, 1.15, 2.92), (7.25, 2.30, 0.12), M["cream"], bevel=0.038, group="desk")
    for x in (-2.95, 3.25):
        for y in (0.38, 1.92):
            lean = math.radians(2.5 if x < 0 else -2.5)
            add_box("desk_leg", (x, y, 1.46), (0.13, 0.13, 2.85), M["wood_light"], bevel=0.022, group="desk", rotation=(0, lean, 0))
    add_box("desk_front_edge", (0.15, -0.01, 2.86), (7.05, 0.045, 0.075), M["paper"], bevel=0.018, group="desk")

    # MacBook Air blockout: recognisable proportions without decorative bulk.
    add_box("macbook_air_base", (-0.15, 0.92, 3.015), (2.16, 1.36, 0.045), M["metal"], bevel=0.026, interaction="cv", group=group)
    add_box("macbook_air_deck", (-0.15, 0.94, 3.044), (2.08, 1.28, 0.012), M["metal"], bevel=0.014, interaction="cv", group=group)
    add_box("macbook_air_front_lip", (-0.15, 0.24, 3.020), (0.48, 0.012, 0.012), M["ink"], bevel=0.004, group=group)
    add_cylinder("macbook_air_hinge", (-0.15, 1.58, 3.11), 0.028, 1.86, M["ink"], vertices=32, rotation=(0, math.radians(90), 0), group=group)
    add_box("macbook_air_lid", (-0.15, 1.72, 3.77), (2.10, 0.026, 1.42), M["metal"], bevel=0.025, interaction="cv", group=group, rotation=(math.radians(-12), 0, 0))
    add_box("macbook_air_bezel", (-0.15, 1.698, 3.77), (2.02, 0.010, 1.34), M["ink"], bevel=0.018, group=group, rotation=(math.radians(-12), 0, 0))
    add_box("macbook_air_screen", (-0.15, 1.689, 3.76), (1.90, 0.006, 1.20), M["screen"], bevel=0.012, interaction="cv", group=group, rotation=(math.radians(-12), 0, 0))
    add_box("terminal_line_1", (-0.51, 1.681, 3.96), (0.62, 0.007, 0.020), M["teal_light"], bevel=0.006, group=group, rotation=(math.radians(-12), 0, 0))
    add_box("terminal_line_2", (-0.35, 1.684, 3.78), (0.94, 0.007, 0.019), M["cream"], bevel=0.006, group=group, rotation=(math.radians(-12), 0, 0))
    for row in range(4):
        for column in range(9):
            add_box("macbook_air_key_%02d_%02d" % (row, column), (-0.95 + column * 0.20, 0.91 + row * 0.132, 3.056), (0.135, 0.074, 0.010), M["ink"], bevel=0.005, group=group)
    add_box("macbook_air_trackpad", (-0.15, 0.51, 3.054), (0.78, 0.34, 0.006), M["cream"], bevel=0.010, interaction="cv", group=group)

    # Papers are the quiet research entry point on the left of the desktop.
    for offset in range(2):
        add_box("research_paper_%02d" % offset, (-2.24 + offset * 0.025, 0.92 + offset * 0.018, 3.035 + offset * 0.012), (0.90, 0.66, 0.018), M["paper"], bevel=0.012, interaction="research" if offset == 0 else None, group="research", rotation=(0, 0, math.radians(-5)))
    add_cylinder("research_pen", (-1.72, 0.84, 3.09), 0.025, 0.68, M["ink"], vertices=20, rotation=(0, math.radians(90), math.radians(-12)), group="research")
    add_focus("focus_cv", (0.0, -2.7, 4.8), (-0.15, 1.35, 3.65))


def research_corner():
    # One refined, compact research easel — the only left-side narrative prop.
    # Shift the freestanding research board entirely left of the bookcase.
    center = (-7.30, 3.86, 3.95)
    add_box("research_easel_frame", center, (2.45, 0.12, 1.86), M["paper"], bevel=0.07, interaction="research", group="research")
    add_box("research_easel_face", (-7.30, 3.77, 3.95), (2.19, 0.026, 1.58), M["cream"], bevel=0.035, interaction="research", group="research")
    for x in (-8.23, -6.37):
        add_box("research_easel_leg", (x, 3.89, 1.26), (0.10, 0.10, 3.05), M["wood_light"], bevel=0.035, group="research")
    add_box("research_easel_tray", (-7.30, 3.64, 2.95), (2.02, 0.22, 0.10), M["wood_light"], bevel=0.025, group="research")
    for x, z, width, color in [(-7.85, 4.45, 0.52, "red"), (-7.17, 4.15, 0.76, "teal_light"), (-7.09, 3.67, 0.62, "gold")]:
        add_box("research_easel_note", (x, 3.72, z), (width, 0.020, 0.06), M[color], bevel=0.018, group="research")
    for offset in range(2):
        add_box("research_paper_%02d" % offset, (-1.30 + offset * 0.03, 1.13 + offset * 0.02, 3.25 + offset * 0.018), (0.82, 0.62, 0.024), M["paper"], bevel=0.018, interaction="research" if offset == 0 else None, group="research", rotation=(0, 0, math.radians(-8)))
    add_focus("focus_research", (-6.85, 0.3, 4.3), (-7.30, 3.8, 3.7))


def music_corner():
    group = "music"
    # Turntable body, platter, vinyl and needle.
    add_box("turntable_body", (3.95, 1.15, 3.34), (2.12, 1.60, 0.22), M["cream"], bevel=0.08, interaction="music", group=group)
    add_cylinder("turntable_platter", (3.58, 1.15, 3.50), 0.54, 0.075, M["metal"], vertices=64, group=group)
    add_cylinder("vinyl", (3.58, 1.15, 3.57), 0.48, 0.035, M["vinyl"], vertices=64, interaction="music", group=group)
    add_cylinder("vinyl_label", (3.58, 1.15, 3.595), 0.14, 0.012, M["red"], vertices=48, group=group)
    for groove in (0.21, 0.29, 0.37, 0.44):
        add_torus("vinyl_groove", (3.58, 1.15, 3.61), groove, 0.008, M["ink"], group=group)
    add_curve("turntable_needle", [(4.63, 1.52, 3.57), (4.42, 1.35, 3.82), (4.14, 1.20, 3.60)], 0.028, M["metal"], group=group)
    for x in (4.58, 4.75):
        add_cylinder("turntable_button", (x, 0.70, 3.52), 0.07, 0.045, M["gold"], vertices=32, group=group)
    add_box("turntable_display", (4.52, 0.72, 3.52), (0.18, 0.08, 0.10), M["screen"], bevel=0.02, group=group)
    # Headphones suspended on an arm.
    add_curve("headphones_band", [(5.35, 2.32, 3.7), (5.35, 1.70, 4.35), (5.35, 1.08, 3.7)], 0.08, M["ink"], group=group)
    add_uv_sphere("headphones_left", (5.35, 1.05, 3.48), (0.20, 0.16, 0.28), M["ink"], group=group)
    add_uv_sphere("headphones_right", (5.35, 1.05, 3.92), (0.20, 0.16, 0.28), M["ink"], group=group)
    add_focus("focus_music", (4.0, -0.1, 4.0), (3.9, 1.1, 3.4))


def photography_corner():
    # Camera body and lens on desk edge.
    group = "camera"
    add_box("camera_body", (0.0, 2.12, 3.42), (1.28, 0.62, 0.56), M["ink"], bevel=0.10, interaction="photos", group=group)
    add_cylinder("camera_lens", (0.0, 1.77, 3.43), 0.30, 0.42, M["metal"], vertices=48, rotation=(math.radians(90), 0, 0), group=group)
    add_cylinder("camera_lens_glass", (0.0, 1.55, 3.43), 0.22, 0.035, M["glass"], vertices=48, rotation=(math.radians(90), 0, 0), group=group)
    for radius in (0.25, 0.29):
        ring = add_torus("camera_lens_ring", (0.0, 1.54, 3.43), radius, 0.018, M["gold"], group=group)
        ring.rotation_euler = (math.radians(90), 0, 0)
    add_box("camera_viewfinder", (0.0, 2.12, 3.78), (0.42, 0.28, 0.16), M["metal"], bevel=0.04, group=group)
    add_cylinder("camera_shutter", (0.46, 2.12, 3.75), 0.075, 0.05, M["red"], vertices=24, group=group)
    add_focus("focus_photos", (-0.25, 0.3, 4.1), (0.0, 1.8, 3.4))


def bookshelf_and_books():
    group = "books"
    # Shelf silhouette with ten independent books.
    add_box("bookshelf_left", (-5.95, 4.95, 2.7), (0.22, 0.45, 4.7), M["wood"], bevel=0.04, interaction="about", group=group)
    add_box("bookshelf_right", (-2.35, 4.95, 2.7), (0.22, 0.45, 4.7), M["wood"], bevel=0.04, interaction="about", group=group)
    add_box("bookshelf_top", (-4.15, 4.95, 4.98), (3.82, 0.45, 0.24), M["wood"], bevel=0.04, interaction="about", group=group)
    for z in (1.25, 2.4, 3.55):
        add_box("bookshelf_shelf", (-4.15, 4.95, z), (3.82, 0.45, 0.16), M["wood_light"], bevel=0.025, interaction="about", group=group)
    book_colors = ["red", "teal", "gold", "blue", "cream", "ink", "teal_light", "red", "gold", "blue"]
    for i, color in enumerate(book_colors):
        level = i // 4
        x = -5.55 + (i % 4) * 0.74
        z = 1.83 + level * 1.15
        height = 0.76 + (i % 3) * 0.15
        add_box("book%02d_outer" % (i + 1), (x, 4.66, z), (0.52, 0.28, height), M[color], bevel=0.025, group=group, rotation=(0, 0, math.radians((-1 + i % 3) * 4)))
        add_box("book%02d_pages" % (i + 1), (x, 4.50, z), (0.39, 0.018, height * 0.86), M["paper"], bevel=0.008, group=group, rotation=(0, 0, math.radians((-1 + i % 3) * 4)))
    add_focus("focus_books", (-4.35, 2.3, 3.3), (-4.15, 4.7, 2.8))


def chair_guitar_lamp_and_decor():
    # Chair
    group = "chair"
    add_cylinder("chair_stem", (2.8, -1.55, 1.45), 0.13, 1.65, M["metal"], vertices=32, group=group)
    add_cylinder("chair_base", (2.8, -1.55, 0.66), 0.95, 0.10, M["metal"], vertices=32, group=group)
    add_uv_sphere("chair_seat", (2.8, -1.55, 2.05), (1.15, 1.0, 0.28), M["teal"], group=group)
    add_uv_sphere("chair_back", (2.8, -0.88, 3.00), (1.16, 0.20, 1.12), M["teal"], group=group)

    # Desk lamp with a warm emissive shade.
    add_cylinder("lampstand", (4.95, 2.10, 3.45), 0.22, 0.08, M["metal"], vertices=32, group="lamp")
    add_cylinder("lamp_stem", (4.95, 2.10, 4.12), 0.065, 1.30, M["metal"], vertices=24, interaction="lamp", group="lamp")
    add_cylinder("lamp_shade", (4.95, 2.10, 4.88), 0.42, 0.46, M["lamp"], vertices=48, interaction="lamp", group="lamp")
    add_uv_sphere("lamp_glow", (4.95, 2.10, 4.74), (0.22, 0.22, 0.12), M["lamp"], group="lamp")

    # Plant gives the silhouette a living edge.
    add_cylinder("plant_pot", (6.15, 4.78, 1.18), 0.38, 0.56, M["cream"], vertices=32, group="env")
    for i, angle in enumerate(range(0, 360, 45)):
        radius = math.radians(angle)
        leaf = add_uv_sphere("plant_leaf_%02d" % i, (6.15 + math.cos(radius) * 0.40, 4.78 + math.sin(radius) * 0.12, 1.86 + (i % 2) * 0.18), (0.20, 0.08, 0.52), M["plant"], group="env")
        leaf.rotation_euler = (math.radians(35), 0, radius)

    # Freestanding photo frames keep the photography interaction legible
    # without relying on a wall.
    for i, (x, z, color) in enumerate(((5.85, 3.95, "teal"),)):
        add_box("photo_frame", (x, 4.78, z), (0.92, 0.12, 1.16), M["wood"], bevel=0.05, interaction="photos", group="photos")
        add_box("photo_frame_image", (x, 4.70, z), (0.72, 0.022, 0.89), M[color], bevel=0.02, group="photos")
        add_box("photo_frame_leg", (x, 4.92, z - 0.93), (0.12, 0.16, 0.92), M["wood_light"], bevel=0.025, group="photos", rotation=(math.radians(-17), 0, 0))


def open_studio_furnishings():
    """Build the restrained wall, music, photography and seating composition."""
    # Wall drawing surface.
    add_box("whiteboard_paper", (-3.72, 5.24, 5.18), (2.42, 0.045, 2.72), M["paper"], bevel=0.025, interaction="research", group="research")
    add_box("whiteboard_top_rail", (-3.72, 5.16, 6.58), (2.62, 0.12, 0.10), M["ink"], bevel=0.025, interaction="research", group="research")
    add_box("whiteboard_bottom_rail", (-3.72, 5.17, 3.78), (2.52, 0.08, 0.07), M["metal"], bevel=0.018, group="research")
    add_curve("whiteboard_mark_left", [(-4.28, 5.14, 5.30), (-4.03, 5.12, 5.62), (-3.78, 5.14, 5.30)], 0.018, M["metal"], group="research")
    add_curve("whiteboard_mark_right", [(-3.62, 5.14, 5.30), (-3.37, 5.12, 5.62), (-3.12, 5.14, 5.30)], 0.018, M["metal"], group="research")
    add_focus("focus_research", (-3.70, 0.5, 5.5), (-3.72, 5.18, 5.18))

    # Floating shelf, a few neutral books, and one Qianyu-owned image slot.
    add_box("wall_shelf", (-0.45, 5.08, 5.72), (2.75, 0.54, 0.14), M["wood_light"], bevel=0.045, group="wall")
    book_colors = ["ink", "cream", "metal", "paper", "blue"]
    for index, color in enumerate(book_colors):
        height = 0.70 + (index % 3) * 0.12
        x = -1.25 + index * 0.34
        add_box("wall_book_%02d" % index, (x, 4.87, 6.13 + (height - 0.70) * 0.5), (0.25, 0.25, height), M[color], bevel=0.018, group="wall", rotation=(0, 0, math.radians((index - 2) * 1.5)))

    add_box("about_frame", (2.02, 5.18, 5.42), (1.62, 0.10, 2.28), M["ink"], bevel=0.045, interaction="about", group="about")
    add_image_plane("about_image_upper", (2.02, 5.105, 5.92), 1.42, 1.12, M["photo_sea"], group="about")
    add_image_plane("about_image_lower", (2.02, 5.100, 4.90), 1.42, 0.74, M["photo_snow"], group="about")
    add_focus("focus_about", (2.0, 0.7, 5.7), (2.02, 5.12, 5.42))

    # Three wall records create one clean vertical rhythm.
    for index, (z, label) in enumerate(((6.15, "gold"), (4.95, "blue"), (3.75, "red"))):
        record = add_cylinder("wall_record_%02d" % index, (4.25, 5.10, z), 0.47, 0.045, M["vinyl"], vertices=64, rotation=(math.radians(90), 0, 0), interaction="music", group="music")
        record.rotation_euler = (math.radians(90), 0, 0)
        label_disc = add_cylinder("wall_record_label_%02d" % index, (4.25, 5.065, z), 0.13, 0.018, M[label], vertices=32, rotation=(math.radians(90), 0, 0), group="music")
        label_disc.rotation_euler = (math.radians(90), 0, 0)

    # A physical rocker on the wall is the primary light switch.  Its shallow
    # profile and dark centre make the interaction readable without adding a
    # floating UI control to the room.
    add_box("wall_switch_plate", (5.62, 5.10, 3.92), (0.42, 0.075, 0.58), M["cream"], bevel=0.055, interaction="lamp", group="lamp")
    add_box("wall_switch_rocker", (5.62, 5.045, 3.92), (0.22, 0.055, 0.34), M["metal"], bevel=0.035, interaction="lamp", group="lamp", rotation=(math.radians(-7), 0, 0))

    # Camera and film on the left side of the desk.
    add_box("camera_body", (-1.55, 1.30, 3.24), (0.90, 0.42, 0.40), M["ink"], bevel=0.045, interaction="photos", group="camera")
    add_box("camera_grip", (-1.18, 1.27, 3.18), (0.22, 0.46, 0.44), M["ink"], bevel=0.038, group="camera")
    add_box("camera_top_plate", (-1.55, 1.30, 3.465), (0.66, 0.34, 0.045), M["metal"], bevel=0.014, group="camera")
    add_cylinder("camera_lens", (-1.55, 1.01, 3.24), 0.225, 0.32, M["metal"], vertices=48, rotation=(math.radians(90), 0, 0), group="camera")
    add_cylinder("camera_lens_glass", (-1.55, 0.84, 3.24), 0.165, 0.020, M["glass"], vertices=48, rotation=(math.radians(90), 0, 0), group="camera")
    for radius in (0.18, 0.215):
        lens_ring = add_torus("camera_lens_ring", (-1.55, 0.827, 3.24), radius, 0.010, M["metal"], group="camera")
        lens_ring.rotation_euler = (math.radians(90), 0, 0)
    add_box("camera_viewfinder", (-1.55, 1.30, 3.505), (0.30, 0.20, 0.10), M["metal"], bevel=0.020, group="camera")
    add_cylinder("camera_shutter", (-1.24, 1.30, 3.50), 0.050, 0.030, M["metal"], vertices=24, group="camera")
    add_cylinder("camera_mode_dial", (-1.79, 1.30, 3.515), 0.078, 0.035, M["metal"], vertices=36, group="camera")
    add_box("camera_lug_left", (-2.02, 1.28, 3.32), (0.035, 0.08, 0.10), M["metal"], bevel=0.010, group="camera")
    add_box("camera_lug_right", (-1.08, 1.28, 3.32), (0.035, 0.08, 0.10), M["metal"], bevel=0.010, group="camera")
    add_cylinder("film_canister", (-2.24, 1.34, 3.14), 0.12, 0.28, M["gold"], vertices=32, group="camera")
    add_focus("focus_photos", (-1.55, -2.0, 4.45), (-1.55, 1.05, 3.30))

    # Record player and headphones on the right side of the desk.
    add_box("turntable_body", (2.42, 1.15, 3.03), (2.02, 1.44, 0.12), M["ink"], bevel=0.035, interaction="music", group="music")
    for x in (1.62, 3.18):
        for y in (0.64, 1.66):
            add_cylinder("turntable_foot", (x, y, 2.94), 0.050, 0.055, M["metal"], vertices=24, group="music")
    add_cylinder("turntable_platter", (2.10, 1.15, 3.13), 0.54, 0.045, M["metal"], vertices=64, group="music")
    add_cylinder("vinyl", (2.10, 1.15, 3.17), 0.50, 0.022, M["vinyl"], vertices=64, interaction="music", group="music")
    add_cylinder("vinyl_label", (2.10, 1.15, 3.187), 0.13, 0.008, M["red"], vertices=48, interaction="music", group="music")
    add_box("vinyl_label_mark", (2.19, 1.15, 3.198), (0.065, 0.020, 0.012), M["paper"], bevel=0.004, interaction="music", group="music", rotation=(0, 0, math.radians(18)))
    add_cylinder("turntable_spindle", (2.10, 1.15, 3.22), 0.014, 0.065, M["metal"], vertices=20, group="music")
    for groove in (0.24, 0.34, 0.44):
        add_torus("vinyl_groove", (2.10, 1.15, 3.195), groove, 0.004, M["metal"], interaction="music", group="music")
    add_curve("turntable_needle", [(3.10, 1.52, 3.14), (2.96, 1.36, 3.36), (2.61, 1.18, 3.20)], 0.018, M["metal"], group="music")
    add_cylinder("turntable_button", (3.08, 0.60, 3.13), 0.052, 0.030, M["gold"], vertices=32, group="music")
    add_box("turntable_dust_lid", (2.42, 1.80, 3.82), (1.98, 0.028, 1.20), M["glass"], bevel=0.018, interaction="music", group="music", rotation=(math.radians(-11), 0, 0))
    add_curve("headphones_band", [(0.98, 1.47, 3.10), (1.17, 1.18, 3.34), (1.38, 0.94, 3.10)], 0.038, M["ink"], interaction="music", group="music")
    add_uv_sphere("headphones_left", (0.96, 1.48, 3.08), (0.10, 0.075, 0.145), M["ink"], group="music")
    add_uv_sphere("headphones_right", (1.40, 0.92, 3.08), (0.10, 0.075, 0.145), M["ink"], group="music")
    add_focus("focus_music", (2.35, -2.2, 4.7), (2.38, 1.15, 3.18))

    # Black swivel chair, deliberately centred but not blocking the laptop.
    chair_x, chair_y = 1.35, -1.22
    add_cylinder("chair_stem", (chair_x, chair_y, 1.04), 0.075, 1.24, M["metal"], vertices=32, group="chair")
    add_cylinder("chair_hub", (chair_x, chair_y, 0.39), 0.16, 0.09, M["metal"], vertices=32, group="chair")
    for index in range(5):
        angle = math.radians(index * 72)
        spoke_x = chair_x + math.cos(angle) * 0.36
        spoke_y = chair_y + math.sin(angle) * 0.36
        add_box("chair_spoke_%02d" % index, (spoke_x, spoke_y, 0.39), (0.72, 0.075, 0.060), M["metal"], bevel=0.022, group="chair", rotation=(0, 0, angle))
        add_cylinder("chair_wheel_%02d" % index, (chair_x + math.cos(angle) * 0.72, chair_y + math.sin(angle) * 0.72, 0.28), 0.085, 0.070, M["ink"], vertices=24, rotation=(math.radians(90), 0, angle), group="chair")
    add_uv_sphere("chair_seat", (chair_x, chair_y, 1.67), (0.72, 0.60, 0.15), M["ink"], group="chair")
    add_uv_sphere("chair_back", (chair_x, chair_y + 0.48, 2.48), (0.70, 0.11, 0.72), M["ink"], group="chair")
    add_curve("chair_back_support_left", [(chair_x - 0.40, chair_y + 0.13, 1.70), (chair_x - 0.55, chair_y + 0.31, 2.31), (chair_x - 0.44, chair_y + 0.42, 2.94)], 0.032, M["metal"], group="chair")
    add_curve("chair_back_support_right", [(chair_x + 0.40, chair_y + 0.13, 1.70), (chair_x + 0.55, chair_y + 0.31, 2.31), (chair_x + 0.44, chair_y + 0.42, 2.94)], 0.032, M["metal"], group="chair")

    # Left-side floor lamp and guitar balance the wall without another shelf.
    add_cylinder("floor_lamp_base", (-5.15, 3.55, 0.15), 0.34, 0.070, M["metal"], vertices=48, group="lamp")
    add_cylinder("floor_lamp_stem", (-5.15, 3.55, 2.18), 0.040, 4.00, M["metal"], vertices=24, interaction="lamp", group="lamp")
    add_cone("floor_lamp_shade", (-5.15, 3.55, 4.32), 0.43, 0.30, 0.56, M["cream"], vertices=48, interaction="lamp", group="lamp")
    add_uv_sphere("floor_lamp_bulb", (-5.15, 3.55, 4.15), (0.10, 0.10, 0.13), M["lamp"], group="lamp")

    guitar_lower = add_uv_sphere("guitar_lower_body", (-4.22, 2.68, 1.18), (0.50, 0.14, 0.64), M["wood"], group="guitar")
    guitar_lower.rotation_euler = (0, math.radians(-8), 0)
    guitar_upper = add_uv_sphere("guitar_upper_body", (-4.22, 2.67, 1.68), (0.39, 0.13, 0.46), M["wood"], group="guitar")
    guitar_upper.rotation_euler = (0, math.radians(-8), 0)
    add_cylinder("guitar_sound_hole", (-4.22, 2.525, 1.46), 0.15, 0.014, M["ink"], vertices=32, rotation=(math.radians(90), 0, 0), group="guitar")
    add_box("guitar_bridge", (-4.21, 2.515, 1.06), (0.32, 0.025, 0.075), M["ink"], bevel=0.018, group="guitar")
    add_box("guitar_neck", (-4.02, 2.64, 2.52), (0.15, 0.085, 1.66), M["wood_light"], bevel=0.020, group="guitar", rotation=(0, math.radians(8), 0))
    add_box("guitar_fretboard", (-4.02, 2.565, 2.52), (0.105, 0.020, 1.58), M["ink"], bevel=0.010, group="guitar", rotation=(0, math.radians(8), 0))
    add_box("guitar_head", (-3.88, 2.62, 3.37), (0.24, 0.11, 0.38), M["wood"], bevel=0.032, group="guitar", rotation=(0, math.radians(8), 0))
    for string_index in range(4):
        string_x = -4.235 + string_index * 0.010
        add_curve("guitar_string_%02d" % string_index, [(string_x, 2.492, 1.08), (string_x + 0.08, 2.542, 2.40), (string_x + 0.19, 2.590, 3.46)], 0.004, M["cream"], group="guitar")
    add_curve("guitar_stand", [(-4.58, 2.82, 0.24), (-4.35, 2.74, 0.64), (-4.22, 2.72, 1.02)], 0.028, M["metal"], group="guitar")
    add_curve("guitar_stand_left", [(-4.36, 2.75, 0.32), (-4.64, 2.68, 0.17)], 0.028, M["metal"], group="guitar")
    add_curve("guitar_stand_right", [(-4.36, 2.75, 0.32), (-4.08, 2.79, 0.17)], 0.028, M["metal"], group="guitar")

    # Small articulated task lamp on the desk.
    add_cylinder("lamp_stand", (-2.72, 1.70, 3.04), 0.19, 0.05, M["ink"], vertices=36, group="lamp")
    add_curve("lamp_stem", [(-2.72, 1.70, 3.07), (-2.46, 1.72, 3.72), (-2.16, 1.46, 4.00)], 0.032, M["ink"], interaction="lamp", group="lamp")
    shade = add_cone("lamp_shade", (-2.08, 1.36, 3.96), 0.22, 0.12, 0.34, M["ink"], vertices=36, rotation=(0, math.radians(58), 0), interaction="lamp", group="lamp")
    shade.rotation_euler = (0, math.radians(58), 0)


def lighting_and_camera():
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Qianyu Room World") if not bpy.data.worlds else bpy.data.worlds[0]
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.88, 0.87, 0.83, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.50

    def area(name, location, energy, size, color, target):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = location
        look_at(obj, target)
        return obj

    # The broad key supplies the large soft wall/floor shadow. Neutral fill
    # keeps black objects readable without introducing decorative colour.
    area("studio_key", (-5.5, -4.5, 11.5), 1450, 6.5, (1.0, 0.96, 0.88), (0.0, 1.6, 2.3))
    area("studio_fill", (7.5, -2.0, 7.0), 390, 5.5, (0.90, 0.92, 0.93), (0.0, 1.8, 2.7))
    area("studio_rim", (-4.0, 4.0, 8.0), 260, 4.5, (0.78, 0.83, 0.84), (-1.0, 2.5, 3.0))

    bpy.ops.object.camera_add(location=(11.0, -16.8, 10.2))
    camera = bpy.context.object
    camera.name = "room_camera"
    camera.data.lens = 52
    camera.data.sensor_width = 36
    look_at(camera, (0.0, 2.0, 3.15))
    scene.camera = camera
    camera["initial_position"] = list(camera.location)
    camera["initial_target"] = [0.0, 2.0, 3.15]

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1440
    scene.render.resolution_y = 960
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    # Preview is a source-review artifact, not a visitor-facing site asset.
    scene.render.filepath = str(PREVIEW / "qianyu-room-preview.png")


def prepare_uvs():
    """Give every renderable mesh an explicit, non-overlapping UV layout."""
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.get("preserve_uv"):
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.025)
        bpy.ops.object.mode_set(mode="OBJECT")
        obj["uv_layout"] = "smart_project_v1"


def batch_static_meshes():
    """Collapse non-interactive detail meshes by material before export.

    The scene keeps named, independent meshes only for primary click targets.
    Everything else is visually identical but becomes a small set of material
    batches, which removes a large number of WebGL draw calls.
    """
    buckets = {}
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH" or obj.name in ("studio_floor", "studio_wall", "studio_baseboard") or obj.get("interaction"):
            continue
        if len(obj.data.materials) != 1 or obj.data.materials[0] is None:
            continue
        # Apply bevels before joining so the combined mesh matches the preview.
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        for modifier in list(obj.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            except RuntimeError:
                pass
        buckets.setdefault(obj.data.materials[0].name, []).append(obj)

    for material_name, objects in buckets.items():
        if len(objects) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        combined = bpy.context.object
        combined.name = "static_" + material_name.lower().replace(" ", "_")
        combined["room_group"] = "static"
        combined["static_batch"] = material_name


def bake_static_ao():
    """Bake AO into the base colour of each static material batch.

    Interactive and animated meshes retain clean runtime materials. Photo
    planes keep their authored UVs and image textures. Every other static mesh
    receives a small, dedicated AO texture which is embedded in the GLB.
    """
    scene = bpy.context.scene
    previous_engine = scene.render.engine
    static_objects = [obj for obj in scene.objects if obj.type == "MESH" and obj.name.startswith("static_")]
    for old_map in TEXTURES.glob("ao_*.png"):
        old_map.unlink()
    legacy_map = TEXTURES / "studio-floor-ao.png"
    if legacy_map.exists():
        legacy_map.unlink()
    try:
        scene.render.engine = "CYCLES"
        scene.cycles.samples = 64
        scene.cycles.bake_type = "AO"
        for obj in static_objects:
            if len(obj.data.materials) != 1 or obj.data.materials[0] is None:
                continue
            original = obj.data.materials[0]
            baked = original.copy()
            baked.name = original.name + "_" + obj.name + "_baked"
            obj.data.materials[0] = baked
            baked.use_nodes = True
            nodes = baked.node_tree.nodes
            links = baked.node_tree.links
            bsdf = nodes.get("Principled BSDF")
            if not bsdf or bsdf.inputs["Base Color"].is_linked:
                continue

            safe_name = obj.name.lower().replace(".", "_").replace(" ", "_")
            size = 256
            bake_image = bpy.data.images.new("ao_" + safe_name, width=size, height=size, alpha=False)
            bake_image.colorspace_settings.name = "Non-Color"
            bake_node = nodes.new("ShaderNodeTexImage")
            bake_node.name = "AO Bake"
            bake_node.image = bake_image
            nodes.active = bake_node

            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.bake(type="AO", margin=8, use_clear=True)

            bake_image.filepath_raw = str(TEXTURES / ("ao_" + safe_name + ".png"))
            bake_image.file_format = "PNG"
            bake_image.save()

            multiply = nodes.new("ShaderNodeMixRGB")
            multiply.name = "Baked AO Multiply"
            multiply.blend_type = "MULTIPLY"
            multiply.inputs[0].default_value = 0.45
            multiply.inputs[1].default_value = bsdf.inputs["Base Color"].default_value
            links.new(bake_node.outputs["Color"], multiply.inputs[2])
            links.new(multiply.outputs["Color"], bsdf.inputs["Base Color"])
            obj["ao_baked"] = True
    finally:
        scene.render.engine = previous_engine


def export_scene():
    scene = bpy.context.scene
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "qianyu-room.blend"))
    bpy.ops.render.render(write_still=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT / "qianyu-room.glb"),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_cameras=True,
        # Runtime lighting is authored separately and reacts to day/night.
        export_lights=False,
        export_extras=True,
        # Keep the web export self-contained.  The model stays lightweight,
        # while browsers can load it without a separate Draco decoder asset.
        export_draco_mesh_compression_enable=False,
    )


clear_scene()
M = initialize_materials()
room_shell()
desk_and_computer()
open_studio_furnishings()
lighting_and_camera()
batch_static_meshes()
prepare_uvs()
bake_static_ao()
export_scene()
print("Qianyu room source, preview, and GLB exported successfully.")
