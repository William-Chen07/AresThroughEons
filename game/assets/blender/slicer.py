"""
Sprite-stack slicer for the Mars outpost modules.

Lives in mars_outpost_base.blend as the text block "slicer.py". To use it in a
Blender session, run:

    exec(bpy.data.texts["slicer.py"].as_string())

Scale: 1 Blender unit = 1 grid cell = 16 px. 1 layer = 1/16 unit.
A module's footprint starts at the origin: x from 0 to cells_x, y from 0 to
cells_y, z from 0 up. South is -Y and ends up at the bottom of each slice.
"""

import json
import math
import os

import bpy
from mathutils import Euler, Vector
from mathutils.bvhtree import BVHTree

PX_PER_CELL = 16
PALETTE_PREFIX = "MARS_PALETTE_"
TINT_MATERIAL = PALETTE_PREFIX + "TINT_MASK"
EDGE_DARKEN = 0.75
# Shown where a face has no palette material, so the mistake is easy to spot.
MISSING_COLOR = (1.0, 0.0, 1.0)
# Sample points are nudged off the pixel centre so rays never run exactly along a mesh edge.
# How far around a voxel to look for the surface that shows, where parts overlap (2 px).
SEARCH_RADIUS = 0.125
NUDGE_X = 0.000137
NUDGE_Y = 0.000071


def _hex_to_rgb(text):
    text = text.strip().lstrip("#")
    return tuple(int(text[i : i + 2], 16) / 255 for i in (0, 2, 4))


def _material_color(material):
    """(r, g, b, is_tint) for a face's material."""
    if material is None or "slice_color" not in material:
        return (*MISSING_COLOR, False)
    return (*_hex_to_rgb(material["slice_color"]), material.name == TINT_MATERIAL)


def _mesh_objects(collection_name):
    collection = bpy.data.collections.get(collection_name)
    if collection is None:
        raise ValueError(f'No collection named "{collection_name}"')
    objects = [obj for obj in collection.all_objects if obj.type == "MESH"]
    if not objects:
        raise ValueError(f'Collection "{collection_name}" has no mesh objects')
    return objects


def _build_trees(objects):
    """One (BVHTree, colour per face) pair per mesh, in world space with modifiers applied."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    trees = []
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        matrix = evaluated.matrix_world
        vertices = [matrix @ vertex.co for vertex in mesh.vertices]
        polygons = [tuple(polygon.vertices) for polygon in mesh.polygons]
        slots = evaluated.material_slots
        colors = [
            _material_color(slots[polygon.material_index].material if polygon.material_index < len(slots) else None)
            for polygon in mesh.polygons
        ]
        evaluated.to_mesh_clear()
        if polygons:
            trees.append((obj.name, BVHTree.FromPolygons(vertices, polygons), colors))
    return trees


def _column_crossings(tree, x, y):
    """Heights where a ray going straight up through (x, y) crosses the mesh."""
    up = Vector((0, 0, 1))
    # Start just under the ground: starting far away costs precision and the same face gets hit twice.
    origin = Vector((x, y, -1.0))
    heights = []
    last_index = None
    for _ in range(512):
        location, _normal, index, _distance = tree.ray_cast(origin, up)
        if location is None:
            break
        # Rounding can land the next ray just below the face it came from; don't count it again.
        if not (index == last_index and heights and location.z - heights[-1] < 1e-3):
            heights.append(location.z)
        last_index = index
        origin = Vector((x, y, location.z + 1e-4))
    return heights


def _inside(tree, point):
    """Whether a point is inside a closed mesh: a ray from it crosses the surface an odd number of times."""
    up = Vector((0, 0, 1))
    origin = point.copy()
    count = 0
    last_index = None
    last_z = None
    for _ in range(512):
        location, _normal, index, _distance = tree.ray_cast(origin, up)
        if location is None:
            break
        if not (index == last_index and last_z is not None and location.z - last_z < 1e-3):
            count += 1
        last_index, last_z = index, location.z
        origin = Vector((point.x, point.y, location.z + 1e-4))
    return count % 2 == 1


def _save_png(path, width, height, pixels):
    image = bpy.data.images.new("slicer_output", width, height, alpha=True)
    try:
        image.alpha_mode = "STRAIGHT"
        image.pixels.foreach_set(pixels)
        image.filepath_raw = path
        image.file_format = "PNG"
        image.save()
    finally:
        bpy.data.images.remove(image)


def slice_module(collection_name, cells_x, cells_y, layers, out_dir):
    """
    Cuts a collection into `layers` horizontal slices and writes:
      <name>_stack.png   one strip, layer 0 (the bottom) on the left
      <name>_stack.json  {name, w, h, layers, cells}
      <name>_tint.png    only if any TINT_MASK faces exist: just those pixels
    Returns the list of files written.
    """
    width = cells_x * PX_PER_CELL
    height = cells_y * PX_PER_CELL
    name = collection_name.lower()
    trees = _build_trees(_mesh_objects(collection_name))

    # voxels[layer][y][x] = (r, g, b, is_tint) or None. y counts up from the south edge.
    voxels = [[[None] * width for _ in range(height)] for _ in range(layers)]
    open_meshes = set()
    for py in range(height):
        for px in range(width):
            x = (px + 0.5) / PX_PER_CELL + NUDGE_X
            y = (py + 0.5) / PX_PER_CELL + NUDGE_Y
            columns = []
            for object_name, tree, colors in trees:
                crossings = _column_crossings(tree, x, y)
                # An odd count usually means the ray grazed an edge: try again a hair to the side.
                for retry in range(1, 4):
                    if len(crossings) % 2 == 0:
                        break
                    crossings = _column_crossings(tree, x + retry * 0.0011, y + retry * 0.0007)
                if not crossings:
                    continue
                if len(crossings) % 2:
                    open_meshes.add(object_name)
                columns.append((tree, colors, crossings))
            for layer in range(layers):
                point = Vector((x, y, (layer + 0.5) / PX_PER_CELL))
                # Every part this voxel is inside, with the nearest spot on that part's surface.
                found = []
                for tree, colors, crossings in columns:
                    if sum(1 for crossing in crossings if crossing < point.z) % 2 == 0:
                        continue
                    location, _normal, index, distance = tree.find_nearest(point)
                    if index is not None:
                        found.append((distance, tree, colors[index], location))
                if not found:
                    continue
                found.sort(key=lambda entry: entry[0])
                chosen = found[0]
                if len(found) > 1:
                    # Where parts overlap, take the colour of the nearest surface that can be seen
                    # from outside: one that isn't buried inside another part. Every nearby face of
                    # every part is tried, nearest first (a thin stripe's nearest face may be buried
                    # while its outer face, a little further off, is the one that shows).
                    nearby = []
                    for _distance, tree, _color, _location in found:
                        colors = next(c for t, c, _crossings in columns if t is tree)
                        for location, _normal, index, distance in tree.find_nearest_range(point, SEARCH_RADIUS):
                            nearby.append((distance, tree, colors[index], location))
                    nearby.sort(key=lambda entry: entry[0])
                    for entry in nearby:
                        _distance, tree, _color, location = entry
                        outward = location - point
                        if outward.length < 1e-9:
                            continue
                        probe = location + outward.normalized() * 1e-3
                        if not any(_inside(other, probe) for _name, other, _colors in trees if other is not tree):
                            chosen = entry
                            break
                voxels[layer][py][px] = (chosen[2], chosen[0])

    strip_width = width * layers
    stack = [0.0] * (strip_width * height * 4)
    tint = [0.0] * (strip_width * height * 4)
    has_tint = False
    filled = 0
    for layer in range(layers):
        grid = voxels[layer]
        for py in range(height):
            for px in range(width):
                voxel = grid[py][px]
                if voxel is None:
                    continue
                filled += 1
                r, g, b, is_tint = voxel[0]
                on_edge = (
                    px == 0
                    or py == 0
                    or px == width - 1
                    or py == height - 1
                    or grid[py][px - 1] is None
                    or grid[py][px + 1] is None
                    or grid[py - 1][px] is None
                    or grid[py + 1][px] is None
                )
                if on_edge:
                    r, g, b = r * EDGE_DARKEN, g * EDGE_DARKEN, b * EDGE_DARKEN
                # Blender images start at the bottom row, which is the south edge here too.
                offset = (py * strip_width + layer * width + px) * 4
                stack[offset : offset + 4] = (r, g, b, 1.0)
                if is_tint:
                    has_tint = True
                    tint[offset : offset + 4] = (r, g, b, 1.0)

    folder = bpy.path.abspath(out_dir)
    os.makedirs(folder, exist_ok=True)
    written = []

    stack_path = os.path.join(folder, f"{name}_stack.png")
    _save_png(stack_path, strip_width, height, stack)
    written.append(stack_path)

    if has_tint:
        tint_path = os.path.join(folder, f"{name}_tint.png")
        _save_png(tint_path, strip_width, height, tint)
        written.append(tint_path)

    json_path = os.path.join(folder, f"{name}_stack.json")
    with open(json_path, "w") as file:
        json.dump({"name": name, "w": width, "h": height, "layers": layers, "cells": [cells_x, cells_y]}, file)
        file.write("\n")
    written.append(json_path)

    if open_meshes:
        print(f"slicer: WARNING these meshes are not closed, slices may have holes: {sorted(open_meshes)}")
    if filled == 0:
        print("slicer: WARNING nothing was inside the footprint. Is the module at x>=0, y>=0, z>=0?")
    print(f"slicer: {name} {width}x{height} px, {layers} layers, {filled} filled pixels")
    for path in written:
        print(f"slicer: wrote {path}")
    return written


def preview_module(collection_name, out_dir):
    """
    Renders <name>_preview.png (256 px) and <name>_icon.png (64 px) with the Workbench
    engine: flat lighting, transparent background, orthographic camera at (60, 0, 45) degrees.
    Returns the list of files written.
    """
    objects = _mesh_objects(collection_name)
    name = collection_name.lower()
    scene = bpy.context.scene

    corners = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    low = Vector([min(corner[axis] for corner in corners) for axis in range(3)])
    high = Vector([max(corner[axis] for corner in corners) for axis in range(3)])
    center = (low + high) / 2
    span = max((high - low).length, 0.1)

    rotation = Euler((math.radians(60), 0, math.radians(45)), "XYZ")
    camera_data = bpy.data.cameras.new("slicer_preview_camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = span * 1.1
    camera_data.clip_end = span * 10 + 100
    camera = bpy.data.objects.new("slicer_preview_camera", camera_data)
    camera.rotation_euler = rotation
    camera.location = center + rotation.to_matrix() @ Vector((0, 0, span * 3 + 10))
    scene.collection.objects.link(camera)

    keep = set(objects)
    hidden = [obj for obj in scene.objects if obj not in keep and obj is not camera and not obj.hide_render]
    for obj in hidden:
        obj.hide_render = True

    render = scene.render
    shading = scene.display.shading
    saved = (
        scene.camera,
        render.engine,
        render.film_transparent,
        render.resolution_x,
        render.resolution_y,
        render.resolution_percentage,
        render.filepath,
        render.image_settings.file_format,
        render.image_settings.color_mode,
        shading.light,
        shading.color_type,
        scene.display.render_aa,
        shading.show_object_outline,
        shading.show_cavity,
    )

    folder = bpy.path.abspath(out_dir)
    os.makedirs(folder, exist_ok=True)
    written = []
    try:
        scene.camera = camera
        render.engine = "BLENDER_WORKBENCH"
        render.film_transparent = True
        render.resolution_percentage = 100
        render.image_settings.file_format = "PNG"
        render.image_settings.color_mode = "RGBA"
        shading.light = "FLAT"
        shading.color_type = "MATERIAL"
        scene.display.render_aa = "OFF"
        # Flat lighting alone turns a one-colour shape into a blob; outlines and edge shading keep it readable.
        shading.show_object_outline = True
        shading.show_cavity = True
        for suffix, size in (("preview", 256), ("icon", 64)):
            path = os.path.join(folder, f"{name}_{suffix}.png")
            render.resolution_x = size
            render.resolution_y = size
            render.filepath = path
            bpy.ops.render.render(write_still=True)
            written.append(path)
            print(f"slicer: wrote {path}")
    finally:
        (
            scene.camera,
            render.engine,
            render.film_transparent,
            render.resolution_x,
            render.resolution_y,
            render.resolution_percentage,
            render.filepath,
            render.image_settings.file_format,
            render.image_settings.color_mode,
            shading.light,
            shading.color_type,
            scene.display.render_aa,
            shading.show_object_outline,
            shading.show_cavity,
        ) = saved
        for obj in hidden:
            obj.hide_render = False
        bpy.data.objects.remove(camera)
        bpy.data.cameras.remove(camera_data)
    return written
