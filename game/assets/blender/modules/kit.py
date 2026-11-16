"""
Shared helpers for the module build scripts in this folder. Each script builds ONE module:

    /Applications/Blender.app/Contents/MacOS/Blender --background --python modules/era1_habitat.py

A script opens its era's .blend (made from mars_outpost_base.blend the first time), rebuilds its
own collection from scratch, slices it into game/public/sprites/eraN/, and saves the .blend.

Scale: 1 Blender unit = 1 grid cell = 16 px. A module's footprint starts at the origin
(x from 0 to cells_x, y from 0 to cells_y, z from 0 up). South is -Y.

House rule: every module has FOUR doors, one in the middle of each side, where the game's
doorways are (use doors()). The only exception is the Power Plant, which has none.
"""

import math
import os
import shutil

import bpy

BLENDER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME_DIR = os.path.dirname(os.path.dirname(BLENDER_DIR))
PREVIEW_DIR = os.path.join(BLENDER_DIR, "out")
# How much the "in game" picture is blown up, so the pixels are easy to see.
INGAME_SCALE = 6

_slicer = {}
_collection = None


def begin(era, name):
    """Opens eraN.blend and gives the module an empty collection called `name`."""
    global _collection
    era_path = os.path.join(BLENDER_DIR, f"era{era}.blend")
    if os.path.exists(era_path):
        bpy.ops.wm.open_mainfile(filepath=era_path)
    else:
        bpy.ops.wm.open_mainfile(filepath=os.path.join(BLENDER_DIR, "mars_outpost_base.blend"))
        bpy.ops.wm.save_as_mainfile(filepath=era_path)
    with open(os.path.join(BLENDER_DIR, "slicer.py")) as file:
        exec(file.read(), _slicer)

    old = bpy.data.collections.get(name)
    if old is not None:
        for obj in list(old.all_objects):
            mesh = obj.data
            bpy.data.objects.remove(obj)
            if mesh.users == 0:
                bpy.data.meshes.remove(mesh)
        bpy.data.collections.remove(old)
    _collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(_collection)


def _adopt(material, rotation):
    obj = bpy.context.active_object
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    _collection.objects.link(obj)
    obj.data.materials.append(bpy.data.materials["MARS_PALETTE_" + material])
    if rotation is not None:
        obj.rotation_euler = [math.radians(angle) for angle in rotation]
    return obj


def box(material, low, high, rotation=None):
    """A box from corner `low` to corner `high`. `rotation` is in degrees, about its middle."""
    center = [(a + b) / 2 for a, b in zip(low, high)]
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = _adopt(material, rotation)
    obj.scale = [b - a for a, b in zip(low, high)]
    return obj


def cylinder(material, center, radius, z_low, z_high, top_radius=None, sides=32, rotation=None):
    """An upright cylinder at `center` (x, y). Give `top_radius` for a cone or a tapered roof."""
    location = (center[0], center[1], (z_low + z_high) / 2)
    if top_radius is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=z_high - z_low, location=location)
    else:
        bpy.ops.mesh.primitive_cone_add(
            vertices=sides, radius1=radius, radius2=top_radius, depth=z_high - z_low, location=location
        )
    return _adopt(material, rotation)


def sphere(material, center, radius, squash=1.0, stretch=None, detail=16):
    """
    A ball at `center` (x, y, z). `squash` below 1 flattens it into a dome shape; `stretch`
    (x, y, z) scales each direction on its own instead. `detail` is how many sides it has round
    the middle: use 8 or 12 for small or many balls, to keep the triangle count down.
    """
    bpy.ops.mesh.primitive_uv_sphere_add(segments=detail, ring_count=detail // 2, radius=radius, location=center)
    obj = _adopt(material, None)
    obj.scale = stretch if stretch is not None else (1, 1, squash)
    return obj


def door(side, cells_x, cells_y, reach=0.3, z_low=0.1, height=0.82, frame="METAL_GREY"):
    """
    A door on one side ("north", "east", "south" or "west"), where the game puts that side's
    doorway: the middle cell, or the eastern/southern of the two middle cells on an even side.
    `reach` is how far in from the footprint's edge the door runs, so it meets the hull.
    `height` is how tall the frame is: lower it for a gate on something with no walls.
    """
    across_x = cells_x // 2 + 0.5
    across_y = cells_y - (cells_y // 2 + 0.5)

    def part(material, half_width, out, z_from, z_to):
        # `out` is how far from the footprint's edge the part starts.
        if side == "south":
            low, high = (across_x - half_width, out, z_from), (across_x + half_width, reach, z_to)
        elif side == "north":
            low, high = (across_x - half_width, cells_y - reach, z_from), (across_x + half_width, cells_y - out, z_to)
        elif side == "west":
            low, high = (out, across_y - half_width, z_from), (reach, across_y + half_width, z_to)
        else:
            low, high = (cells_x - reach, across_y - half_width, z_from), (cells_x - out, across_y + half_width, z_to)
        box(material, low, high)

    part(frame, 0.34, 0.06, z_low, z_low + height)
    part("DARK_TRIM", 0.25, 0.02, z_low, z_low + height - 0.1)
    part("LIGHT_YELLOW", 0.06, 0.03, z_low + height - 0.08, z_low + height - 0.02)


def doors(cells_x, cells_y, reach=0.3, z_low=0.1, height=0.82, frame="METAL_GREY"):
    """The four doors every building has (not the Power Plant, Solar Array or other open frames)."""
    for side in ("north", "east", "south", "west"):
        door(side, cells_x, cells_y, reach, z_low, height, frame)


def finish(era, cells_x, cells_y, layers, icon=True, edge_darken=None):
    """
    Slices the module, writes its icon and review pictures, saves the .blend. Returns the files.
    `icon=False` is for pieces that never appear in the build menu: no icon or 3D preview.
    `edge_darken=1.0` turns off the dimming of each layer's outer edge, for tiny pieces that are
    all edge and would come out grey.
    """
    name = _collection.name
    triangles = 0
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in _collection.all_objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        triangles += sum(len(polygon.vertices) - 2 for polygon in mesh.polygons)
        evaluated.to_mesh_clear()

    sprite_dir = os.path.join(GAME_DIR, "public", "sprites", f"era{era}")
    options = {} if edge_darken is None else {"edge_darken": edge_darken}
    written = _slicer["slice_module"](name, cells_x, cells_y, layers, sprite_dir, **options)

    # Only the icon ships with the game; the big preview is just for looking at.
    for path in _slicer["preview_module"](name, PREVIEW_DIR) if icon else []:
        if path.endswith("_icon.png"):
            icon = os.path.join(sprite_dir, os.path.basename(path))
            shutil.move(path, icon)
            written.append(icon)

    # A picture of the stack as the game draws it: each slice one pixel above the last.
    width, height = cells_x * 16, cells_y * 16
    strip = bpy.data.images.load(written[0])
    source = list(strip.pixels)
    bpy.data.images.remove(strip)
    tall = height + layers - 1
    flat = [0.0] * (width * tall * 4)
    for layer in range(layers):
        for y in range(height):
            for x in range(width):
                at = (y * width * layers + layer * width + x) * 4
                if source[at + 3] > 0:
                    to = ((y + layer) * width + x) * 4
                    flat[to : to + 4] = source[at : at + 4]
    big_w, big_h = width * INGAME_SCALE, tall * INGAME_SCALE
    big = [0.0] * (big_w * big_h * 4)
    for y in range(big_h):
        row = (y // INGAME_SCALE) * width
        for x in range(big_w):
            at = (row + x // INGAME_SCALE) * 4
            to = (y * big_w + x) * 4
            big[to : to + 4] = flat[at : at + 4]
    ingame = os.path.join(PREVIEW_DIR, f"{name}_ingame.png")
    _slicer["_save_png"](ingame, big_w, big_h, big)

    bpy.ops.wm.save_mainfile()
    print(f"kit: {name}: {triangles} triangles (limit about 2,000)")
    print(f"kit: review pictures: {ingame} and {os.path.join(PREVIEW_DIR, name + '_preview.png')}")
    print(f"kit: saved {bpy.data.filepath}")
    return written
