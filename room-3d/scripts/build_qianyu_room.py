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
OUTPUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)


PALETTE = {
    "wall": (0.72, 0.64, 0.51, 1),
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
    add_box("floor", (0, 0, -0.16), (16, 12, 0.32), M["floor"], bevel=0.02, group="env")
    # The rear wall is built around a real window opening, not a painted panel.
    add_box("back_wall_left", (-6.95, 5.85, 4.7), (2.10, 0.24, 9.4), M["wall"], bevel=0.01, group="env")
    add_box("back_wall_right", (3.55, 5.85, 4.7), (8.90, 0.24, 9.4), M["wall"], bevel=0.01, group="env")
    add_box("back_wall_top", (-3.40, 5.85, 8.78), (4.90, 0.24, 1.84), M["wall"], bevel=0.01, group="env")
    add_box("back_wall_bottom", (-3.40, 5.85, 1.74), (4.90, 0.24, 3.48), M["wall"], bevel=0.01, group="env")
    add_box("left_wall", (-7.85, 0, 4.7), (0.24, 12, 9.4), M["wall_dark"], bevel=0.01, group="env")
    add_box("baseboard_back", (0, 5.68, 0.42), (15.9, 0.16, 0.22), M["wood_light"], bevel=0.02, group="env")
    add_box("baseboard_left", (-7.68, 0, 0.42), (0.16, 11.9, 0.22), M["wood_light"], bevel=0.02, group="env")
    # Luminous exterior is set behind the opening rather than covering it.
    add_box("window_exterior", (-3.4, 6.02, 5.8), (4.70, 0.05, 4.48), M["sky"], bevel=0.01, group="env")
    add_cylinder("window_sun", (-4.50, 5.98, 6.72), 0.34, 0.04, M["cream"], vertices=48, rotation=(math.radians(90), 0, 0), group="env")
    # A physical wall switch replaces the floating toolbar controls on Home.
    add_box("wall_switch_plate", (5.85, 5.64, 4.15), (0.48, 0.07, 0.68), M["cream"], bevel=0.05, interaction="lamp", group="lamp")
    add_box("wall_switch_toggle", (5.85, 5.57, 4.17), (0.12, 0.07, 0.30), M["red"], bevel=0.03, interaction="lamp", group="lamp", rotation=(math.radians(-14), 0, 0))
    for x, z, sx, sz in [(-3.4, 5.8, 0.16, 4.9), (-5.75, 5.8, 0.16, 4.9), (-1.05, 5.8, 0.16, 4.9), (-3.4, 8.1, 4.9, 0.16), (-3.4, 3.5, 4.9, 0.16)]:
        add_box("window_frame", (x, 5.54, z), (sx, 0.18, sz), M["cream"], bevel=0.015, group="env")
    add_box("rug", (1.7, 0.45, 0.03), (7.2, 5.0, 0.07), M["cream"], bevel=0.24, group="env", rotation=(0, 0, math.radians(-7)))


def desk_and_computer():
    group = "computer"
    # Desk
    add_box("desk_top", (2.25, 1.2, 3.05), (7.0, 2.55, 0.26), M["wood"], bevel=0.11, group="desk")
    for x in (-0.75, 5.25):
        for y in (0.32, 2.08):
            add_box("desk_leg", (x, y, 1.48), (0.26, 0.26, 3.0), M["wood_dark"] if "wood_dark" in M else M["wood"], bevel=0.06, group="desk")
    add_box("desk_drawer", (4.45, 1.2, 2.45), (1.52, 1.48, 0.92), M["wood_light"], bevel=0.07, group="desk")
    add_box("drawer_handle", (4.45, -0.02, 2.46), (0.52, 0.12, 0.10), M["gold"], bevel=0.03, group="desk")

    # MacBook: screen tilted backward around its hinge.
    add_box("macbook_base", (1.2, 1.18, 3.30), (2.35, 1.52, 0.12), M["metal"], bevel=0.07, interaction="cv", group=group)
    screen = add_box("macbook_screen", (1.2, 1.87, 4.33), (2.35, 0.10, 1.65), M["metal"], bevel=0.07, interaction="cv", group=group, rotation=(math.radians(-18), 0, 0))
    add_box("screen", (1.2, 1.80, 4.33), (2.12, 0.035, 1.40), M["screen"], bevel=0.03, interaction="cv", group=group, rotation=(math.radians(-18), 0, 0))
    add_box("terminal_line_1", (0.65, 1.765, 4.60), (0.72, 0.012, 0.035), M["teal_light"], bevel=0.01, group=group, rotation=(math.radians(-18), 0, 0))
    add_box("terminal_line_2", (0.93, 1.77, 4.39), (1.18, 0.012, 0.035), M["cream"], bevel=0.01, group=group, rotation=(math.radians(-18), 0, 0))
    add_focus("focus_cv", (1.2, 0.5, 4.2), (1.2, 1.2, 3.6))


def research_corner():
    # Whiteboard wall piece and pen
    add_box("whiteboard", (-5.25, 5.50, 4.1), (3.2, 0.11, 2.35), M["paper"], bevel=0.06, interaction="research", group="whiteboard")
    add_box("whiteboard_face", (-5.25, 5.43, 4.1), (2.94, 0.025, 2.08), M["cream"], bevel=0.03, interaction="research", group="whiteboard")
    for x, z, width, color in [(-5.95, 4.7, 0.78, "red"), (-5.15, 4.35, 1.30, "teal_light"), (-4.85, 3.82, 0.95, "gold"), (-5.75, 3.55, 0.52, "ink")]:
        add_box("whiteboard_note", (x, 5.38, z), (width, 0.018, 0.08), M[color], bevel=0.02, group="whiteboard")
    add_cylinder("pen", (-5.9, 1.2, 3.31), 0.055, 1.2, M["red"], vertices=16, rotation=(0, math.radians(78), math.radians(15)), interaction="writing", group="writing")
    for offset in range(4):
        add_box("paper_%02d" % offset, (-3.10 + offset * 0.035, 1.25 + offset * 0.015, 3.26 + offset * 0.024), (1.28, 0.95, 0.028), M["paper"], bevel=0.018, interaction="writing", group="writing", rotation=(0, 0, math.radians(-7)))
    add_focus("focus_research", (-4.4, 0.3, 4.5), (-4.1, 2.2, 3.8))


def music_corner():
    group = "music"
    # Turntable body, platter, vinyl and needle.
    add_box("turntable_body", (3.95, 1.15, 3.34), (2.12, 1.60, 0.22), M["cream"], bevel=0.08, interaction="music", group=group)
    add_cylinder("turntable_platter", (3.58, 1.15, 3.50), 0.54, 0.075, M["metal"], vertices=64, interaction="music", group=group)
    add_cylinder("vinyl", (3.58, 1.15, 3.57), 0.48, 0.035, M["vinyl"], vertices=64, interaction="music", group=group)
    add_cylinder("vinyl_label", (3.58, 1.15, 3.595), 0.14, 0.012, M["red"], vertices=48, interaction="music", group=group)
    add_curve("turntable_needle", [(4.63, 1.52, 3.57), (4.42, 1.35, 3.82), (4.14, 1.20, 3.60)], 0.028, M["metal"], interaction="music", group=group)
    for x in (4.58, 4.75):
        add_cylinder("turntable_button", (x, 0.70, 3.52), 0.07, 0.045, M["gold"], vertices=32, interaction="music", group=group)
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
    add_box("camera_viewfinder", (0.0, 2.12, 3.78), (0.42, 0.28, 0.16), M["metal"], bevel=0.04, interaction="photos", group=group)
    for i, x in enumerate((-0.72, -0.36, 0.0)):
        add_cylinder("film_roll_%02d" % i, (x, 2.18, 3.31), 0.15, 0.32, M["gold"] if i == 1 else M["red"], vertices=32, rotation=(math.radians(90), 0, 0), interaction="photos", group="film")
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
    add_cylinder("chair_stem", (2.8, -1.55, 1.45), 0.13, 1.65, M["metal"], vertices=32, interaction="whale", group=group)
    add_cylinder("chair_base", (2.8, -1.55, 0.66), 0.95, 0.10, M["metal"], vertices=32, interaction="whale", group=group)
    add_uv_sphere("chair_seat", (2.8, -1.55, 2.05), (1.15, 1.0, 0.28), M["teal"], interaction="whale", group=group)
    add_uv_sphere("chair_back", (2.8, -0.88, 3.00), (1.16, 0.20, 1.12), M["teal"], interaction="whale", group=group)

    # Guitar, intentionally simplified to keep web geometry light.
    add_uv_sphere("guitar_body_lower", (-0.75, 4.65, 1.65), (0.48, 0.18, 0.62), M["red"], interaction="about", group="guitar")
    add_uv_sphere("guitar_body_upper", (-0.75, 4.65, 2.35), (0.38, 0.16, 0.48), M["red"], interaction="about", group="guitar")
    add_box("guitar_neck", (-0.75, 4.68, 3.25), (0.16, 0.09, 1.55), M["wood_light"], bevel=0.025, interaction="about", group="guitar")
    add_box("guitar_head", (-0.75, 4.68, 4.10), (0.32, 0.12, 0.30), M["wood"], bevel=0.04, interaction="about", group="guitar")

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

    # Posters: original blank visual blocks, later replaced with Qianyu imagery.
    add_text_panel("poster_research", (4.15, 5.46, 6.65), (2.15, 0.045, 2.55), "teal", "poster")
    add_text_panel("poster_photo", (6.35, 5.46, 6.20), (1.62, 0.045, 2.05), "red", "poster")
    add_box("poster_label_1", (4.15, 5.41, 6.70), (1.38, 0.018, 0.14), M["cream"], bevel=0.01, group="poster")
    add_box("poster_label_2", (6.35, 5.41, 6.20), (0.96, 0.018, 0.13), M["paper"], bevel=0.01, group="poster")


def lighting_and_camera():
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Qianyu Room World") if not bpy.data.worlds else bpy.data.worlds[0]
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.025, 0.045, 0.05, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.32

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

    area("window_key", (-4.0, 2.0, 8.1), 1150, 5.0, (0.48, 0.72, 0.82), (1.0, 1.2, 2.0))
    area("warm_fill", (6.0, -2.4, 6.2), 880, 4.0, (1.0, 0.44, 0.15), (2.0, 1.0, 2.6))
    area("shelf_bounce", (-6.5, 2.5, 5.5), 460, 2.4, (0.85, 0.52, 0.24), (-3.8, 3.0, 2.0))

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
bookshelf_and_books()
chair_guitar_lamp_and_decor()
lighting_and_camera()
export_scene()
print("Qianyu room source, preview, and GLB exported successfully.")
