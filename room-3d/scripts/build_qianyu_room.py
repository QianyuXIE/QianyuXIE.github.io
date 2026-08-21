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
OUTPUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
TEXTURES.mkdir(parents=True, exist_ok=True)


PALETTE = {
    "wall": (0.72, 0.64, 0.51, 1),
    "space": (0.93, 0.92, 0.88, 1),
    "wall_dark": (0.18, 0.26, 0.25, 1),
    "floor": (0.35, 0.17, 0.09, 1),
    "wood": (0.30, 0.12, 0.055, 1),
    "wood_light": (0.55, 0.28, 0.12, 1),
    "cream": (0.91, 0.84, 0.70, 1),
    "paper": (0.97, 0.90, 0.75, 1),
    "ink": (0.03, 0.06, 0.06, 1),
    "teal": (0.06, 0.23, 0.22, 1),
    "teal_light": (0.16, 0.44, 0.40, 1),
    "red": (0.55, 0.10, 0.08, 1),
    "gold": (0.75, 0.42, 0.08, 1),
    "vinyl": (0.008, 0.01, 0.012, 1),
    "glass": (0.03, 0.14, 0.14, 1),
    "sky": (0.23, 0.64, 0.72, 1),
    "screen": (0.01, 0.045, 0.045, 1),
    "lamp": (1.0, 0.51, 0.10, 1),
    "plant": (0.05, 0.23, 0.10, 1),
    "metal": (0.19, 0.22, 0.21, 1),
    "blue": (0.08, 0.23, 0.44, 1),
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
    materials["screen"] = material("screen", PALETTE["screen"], roughness=0.25, metallic=0.15, emission=(0.01, 0.20, 0.17, 1))
    materials["lamp"] = material("lamp", PALETTE["lamp"], roughness=0.4, metallic=0.05, emission=(1.0, 0.20, 0.02, 1))
    materials["metal"] = material("metal", PALETTE["metal"], roughness=0.30, metallic=0.85)
    materials["glass"] = material("glass", PALETTE["glass"], roughness=0.14, metallic=0.35)
    materials["sky"] = material("sky", PALETTE["sky"], roughness=0.35, emission=(0.11, 0.48, 0.56, 1))
    materials["space"] = material("space", PALETTE["space"], roughness=0.82)
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


def look_at(obj, point):
    direction = Vector(point) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def room_shell():
    # A single, oversized studio floor gives the scene an infinite white-world
    # feeling. No room walls, window, or box geometry remain.
    add_box("studio_floor", (0, 0, -0.12), (42, 42, 0.16), M["space"], bevel=0.10, group="environment")


def desk_and_computer():
    group = "computer"
    # Desk
    add_box("desk_top", (2.25, 1.2, 3.05), (7.0, 2.55, 0.26), M["wood"], bevel=0.11, group="desk")
    for x in (-0.75, 5.25):
        for y in (0.32, 2.08):
            add_box("desk_leg", (x, y, 1.48), (0.26, 0.26, 3.0), M["wood_dark"] if "wood_dark" in M else M["wood"], bevel=0.06, group="desk")
    add_box("desk_drawer", (4.45, 1.2, 2.45), (1.52, 1.48, 0.92), M["wood_light"], bevel=0.07, group="desk")
    add_box("drawer_handle", (4.45, -0.02, 2.46), (0.52, 0.12, 0.10), M["gold"], bevel=0.03, group="desk")
    add_box("desk_apron", (2.25, 0.08, 2.72), (6.45, 0.16, 0.42), M["wood_light"], bevel=0.05, group="desk")
    for x in (-0.35, 4.85):
        add_box("desk_foot", (x, 1.18, 0.18), (1.00, 1.92, 0.12), M["wood_light"], bevel=0.06, group="desk")

    # MacBook: screen tilted backward around its hinge.
    add_box("macbook_base", (1.2, 1.18, 3.30), (2.35, 1.52, 0.12), M["metal"], bevel=0.07, interaction="cv", group=group)
    screen = add_box("macbook_screen", (1.2, 1.87, 4.33), (2.35, 0.10, 1.65), M["metal"], bevel=0.07, interaction="cv", group=group, rotation=(math.radians(-18), 0, 0))
    add_box("screen", (1.2, 1.80, 4.33), (2.12, 0.035, 1.40), M["screen"], bevel=0.03, interaction="cv", group=group, rotation=(math.radians(-18), 0, 0))
    add_box("terminal_line_1", (0.65, 1.765, 4.60), (0.72, 0.012, 0.035), M["teal_light"], bevel=0.01, group=group, rotation=(math.radians(-18), 0, 0))
    add_box("terminal_line_2", (0.93, 1.77, 4.39), (1.18, 0.012, 0.035), M["cream"], bevel=0.01, group=group, rotation=(math.radians(-18), 0, 0))
    for row in range(4):
        for column in range(10):
            add_box("macbook_key_%02d_%02d" % (row, column), (-0.04 + column * 0.25, 0.69 + row * 0.19, 3.39), (0.16, 0.11, 0.035), M["ink"], bevel=0.012, interaction="cv", group=group)
    add_box("macbook_trackpad", (1.20, 1.28, 3.39), (0.56, 0.40, 0.022), M["cream"], bevel=0.02, interaction="cv", group=group)
    add_box("macbook_logo", (1.20, 1.93, 4.33), (0.24, 0.013, 0.24), M["cream"], bevel=0.04, interaction="cv", group=group, rotation=(math.radians(-18), 0, 0))
    add_focus("focus_cv", (1.2, 0.5, 4.2), (1.2, 1.2, 3.6))


def research_corner():
    # One refined, compact research easel — the only left-side narrative prop.
    # Shift the freestanding research board entirely left of the bookcase.
    center = (-7.30, 3.86, 3.95)
    add_box("research_easel_frame", center, (2.45, 0.12, 1.86), M["paper"], bevel=0.07, interaction="research", group="research")
    add_box("research_easel_face", (-7.30, 3.77, 3.95), (2.19, 0.026, 1.58), M["cream"], bevel=0.035, interaction="research", group="research")
    for x in (-8.23, -6.37):
        add_box("research_easel_leg", (x, 3.89, 1.26), (0.10, 0.10, 3.05), M["wood_light"], bevel=0.035, interaction="research", group="research")
    add_box("research_easel_tray", (-7.30, 3.64, 2.95), (2.02, 0.22, 0.10), M["wood_light"], bevel=0.025, interaction="research", group="research")
    for x, z, width, color in [(-7.85, 4.45, 0.52, "red"), (-7.17, 4.15, 0.76, "teal_light"), (-7.09, 3.67, 0.62, "gold")]:
        add_box("research_easel_note", (x, 3.72, z), (width, 0.020, 0.06), M[color], bevel=0.018, interaction="research", group="research")
    for offset in range(2):
        add_box("research_paper_%02d" % offset, (-1.30 + offset * 0.03, 1.13 + offset * 0.02, 3.25 + offset * 0.018), (0.82, 0.62, 0.024), M["paper"], bevel=0.018, interaction="research", group="research", rotation=(0, 0, math.radians(-8)))
    add_focus("focus_research", (-6.85, 0.3, 4.3), (-7.30, 3.8, 3.7))


def music_corner():
    group = "music"
    # Turntable body, platter, vinyl and needle.
    add_box("turntable_body", (3.95, 1.15, 3.34), (2.12, 1.60, 0.22), M["cream"], bevel=0.08, interaction="music", group=group)
    add_cylinder("turntable_platter", (3.58, 1.15, 3.50), 0.54, 0.075, M["metal"], vertices=64, interaction="music", group=group)
    add_cylinder("vinyl", (3.58, 1.15, 3.57), 0.48, 0.035, M["vinyl"], vertices=64, interaction="music", group=group)
    add_cylinder("vinyl_label", (3.58, 1.15, 3.595), 0.14, 0.012, M["red"], vertices=48, interaction="music", group=group)
    for groove in (0.21, 0.29, 0.37, 0.44):
        add_torus("vinyl_groove", (3.58, 1.15, 3.61), groove, 0.008, M["ink"], interaction="music", group=group)
    add_curve("turntable_needle", [(4.63, 1.52, 3.57), (4.42, 1.35, 3.82), (4.14, 1.20, 3.60)], 0.028, M["metal"], interaction="music", group=group)
    for x in (4.58, 4.75):
        add_cylinder("turntable_button", (x, 0.70, 3.52), 0.07, 0.045, M["gold"], vertices=32, interaction="music", group=group)
    add_box("turntable_display", (4.52, 0.72, 3.52), (0.18, 0.08, 0.10), M["screen"], bevel=0.02, interaction="music", group=group)
    # Headphones suspended on an arm.
    add_curve("headphones_band", [(5.35, 2.32, 3.7), (5.35, 1.70, 4.35), (5.35, 1.08, 3.7)], 0.08, M["ink"], interaction="music", group=group)
    add_uv_sphere("headphones_left", (5.35, 1.05, 3.48), (0.20, 0.16, 0.28), M["ink"], interaction="music", group=group)
    add_uv_sphere("headphones_right", (5.35, 1.05, 3.92), (0.20, 0.16, 0.28), M["ink"], interaction="music", group=group)
    add_focus("focus_music", (4.0, -0.1, 4.0), (3.9, 1.1, 3.4))


def photography_corner():
    # Camera body and lens on desk edge.
    group = "camera"
    add_box("camera_body", (0.0, 2.12, 3.42), (1.28, 0.62, 0.56), M["ink"], bevel=0.10, interaction="photos", group=group)
    add_cylinder("camera_lens", (0.0, 1.77, 3.43), 0.30, 0.42, M["metal"], vertices=48, rotation=(math.radians(90), 0, 0), interaction="photos", group=group)
    add_cylinder("camera_lens_glass", (0.0, 1.55, 3.43), 0.22, 0.035, M["glass"], vertices=48, rotation=(math.radians(90), 0, 0), interaction="photos", group=group)
    for radius in (0.25, 0.29):
        ring = add_torus("camera_lens_ring", (0.0, 1.54, 3.43), radius, 0.018, M["gold"], interaction="photos", group=group)
        ring.rotation_euler = (math.radians(90), 0, 0)
    add_box("camera_viewfinder", (0.0, 2.12, 3.78), (0.42, 0.28, 0.16), M["metal"], bevel=0.04, interaction="photos", group=group)
    add_cylinder("camera_shutter", (0.46, 2.12, 3.75), 0.075, 0.05, M["red"], vertices=24, interaction="photos", group=group)
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
        add_box("book%02d_outer" % (i + 1), (x, 4.66, z), (0.52, 0.28, height), M[color], bevel=0.025, interaction="about", group=group, rotation=(0, 0, math.radians((-1 + i % 3) * 4)))
        add_box("book%02d_pages" % (i + 1), (x, 4.50, z), (0.39, 0.018, height * 0.86), M["paper"], bevel=0.008, interaction="about", group=group, rotation=(0, 0, math.radians((-1 + i % 3) * 4)))
    add_focus("focus_books", (-4.35, 2.3, 3.3), (-4.15, 4.7, 2.8))


def chair_guitar_lamp_and_decor():
    # Chair
    group = "chair"
    add_cylinder("chair_stem", (2.8, -1.55, 1.45), 0.13, 1.65, M["metal"], vertices=32, group=group)
    add_cylinder("chair_base", (2.8, -1.55, 0.66), 0.95, 0.10, M["metal"], vertices=32, group=group)
    add_uv_sphere("chair_seat", (2.8, -1.55, 2.05), (1.15, 1.0, 0.28), M["teal"], group=group)
    add_uv_sphere("chair_back", (2.8, -0.88, 3.00), (1.16, 0.20, 1.12), M["teal"], group=group)

    # Desk lamp with a warm emissive shade.
    add_cylinder("lampstand", (4.95, 2.10, 3.45), 0.22, 0.08, M["metal"], vertices=32, interaction="lamp", group="lamp")
    add_cylinder("lamp_stem", (4.95, 2.10, 4.12), 0.065, 1.30, M["metal"], vertices=24, interaction="lamp", group="lamp")
    add_cylinder("lamp_shade", (4.95, 2.10, 4.88), 0.42, 0.46, M["lamp"], vertices=48, interaction="lamp", group="lamp")
    add_uv_sphere("lamp_glow", (4.95, 2.10, 4.74), (0.22, 0.22, 0.12), M["lamp"], interaction="lamp", group="lamp")

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
        add_box("photo_frame_image", (x, 4.70, z), (0.72, 0.022, 0.89), M[color], bevel=0.02, interaction="photos", group="photos")
        add_box("photo_frame_leg", (x, 4.92, z - 0.93), (0.12, 0.16, 0.92), M["wood_light"], bevel=0.025, interaction="photos", group="photos", rotation=(math.radians(-17), 0, 0))


def lighting_and_camera():
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Qianyu Room World") if not bpy.data.worlds else bpy.data.worlds[0]
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.93, 0.92, 0.88, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.42

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

    # A broad white key, warm practical fill, and faint cool rim create soft
    # grounded shadows without constructing any enclosing walls.
    area("studio_key", (-4.5, -4.0, 11.0), 1600, 6.0, (1.0, 0.96, 0.88), (0.4, 1.0, 2.1))
    area("studio_fill", (7.0, -1.5, 7.0), 720, 5.0, (1.0, 0.72, 0.48), (2.2, 1.1, 2.5))
    area("studio_rim", (-7.0, 5.0, 6.0), 520, 4.0, (0.68, 0.84, 0.88), (-2.0, 2.5, 2.4))

    bpy.ops.object.camera_add(location=(15.8, -17.2, 12.6))
    camera = bpy.context.object
    camera.name = "room_camera"
    camera.data.lens = 35
    camera.data.sensor_width = 36
    look_at(camera, (0.0, 1.2, 2.75))
    scene.camera = camera
    camera["initial_position"] = list(camera.location)
    camera["initial_target"] = [0.0, 1.2, 2.75]

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1440
    scene.render.resolution_y = 960
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.filepath = str(OUTPUT / "qianyu-room-preview.png")


def prepare_uvs():
    """Give every renderable mesh an explicit, non-overlapping UV layout."""
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.025)
        bpy.ops.object.mode_set(mode="OBJECT")
        obj["uv_layout"] = "smart_project_v1"


def bake_floor_ao():
    """Bake static ambient occlusion onto the studio floor for the source asset."""
    floor = bpy.data.objects.get("studio_floor")
    if not floor:
        return
    scene = bpy.context.scene
    previous_engine = scene.render.engine
    floor_material = M["space"]
    nodes = floor_material.node_tree.nodes
    bake_node = nodes.get("Floor AO Bake") or nodes.new("ShaderNodeTexImage")
    bake_node.name = "Floor AO Bake"
    bake_image = bpy.data.images.get("qianyu-floor-ao") or bpy.data.images.new("qianyu-floor-ao", width=768, height=768, alpha=False)
    bake_node.image = bake_image
    nodes.active = bake_node
    bpy.ops.object.select_all(action="DESELECT")
    floor.select_set(True)
    bpy.context.view_layer.objects.active = floor
    try:
        scene.render.engine = "CYCLES"
        scene.cycles.samples = 16
        scene.cycles.bake_type = "AO"
        bpy.ops.object.bake(type="AO", margin=10, use_clear=True)
        bake_image.filepath_raw = str(TEXTURES / "studio-floor-ao.png")
        bake_image.file_format = "PNG"
        bake_image.save()
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
        export_lights=True,
        export_extras=True,
        # Keep the web export self-contained.  The model stays lightweight,
        # while browsers can load it without a separate Draco decoder asset.
        export_draco_mesh_compression_enable=False,
    )


clear_scene()
M = initialize_materials()
room_shell()
desk_and_computer()
research_corner()
music_corner()
photography_corner()
chair_guitar_lamp_and_decor()
lighting_and_camera()
prepare_uvs()
bake_floor_ao()
export_scene()
print("Qianyu room source, preview, and GLB exported successfully.")
