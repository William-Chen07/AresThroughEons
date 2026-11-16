"""
Step 0: builds mars_outpost_base.blend next to this file. Run it once:

    /Applications/Blender.app/Contents/MacOS/Blender --background --python step0_setup.py

It makes the MARS_PALETTE materials, stores slicer.py inside the .blend as a
text block, tests the slicer on a 1x1x1 cube, and saves. Change the colours in
PALETTE and run it again to rebuild the base file (do this before building
modules: it starts from an empty file).
"""

import os
import shutil
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
BLEND_PATH = os.path.join(HERE, "mars_outpost_base.blend")
SLICER_PATH = os.path.join(HERE, "slicer.py")

# Keep the names the same when changing colours, so the module prompts still work.
PALETTE = {
    "HULL_WHITE": "#E8E4DA",
    "HULL_SHADE": "#B8B2A6",
    "FOIL_GOLD": "#D9A441",
    "SOLAR_BLUE": "#2C4F7C",
    "GLASS_TEAL": "#5FB3B3",
    "ACCENT_ORANGE": "#E8743B",
    "ACCENT_RED": "#C8463D",
    "METAL_GREY": "#7A7F87",
    "DARK_TRIM": "#3A3F47",
    "PLANT_GREEN": "#6DBE45",
    "REGOLITH_TAN": "#C47A4A",
    "LIGHT_YELLOW": "#FFD966",
    # Pure white: the game recolours these parts with a PixiJS tint.
    "TINT_MASK": "#FFFFFF",
}


def srgb_to_linear(value):
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def make_material(name, hex_color):
    srgb = [int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [srgb_to_linear(channel) for channel in srgb]
    material = bpy.data.materials.new(f"MARS_PALETTE_{name}")
    material["slice_color"] = hex_color
    material.diffuse_color = (*linear, 1.0)
    material.roughness = 1.0
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    if shader is not None:
        shader.inputs["Base Color"].default_value = (*linear, 1.0)
        shader.inputs["Roughness"].default_value = 1.0
    # Keep the material in the file even while no module uses it yet.
    material.use_fake_user = True
    return material


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "FLAT"
    scene.display.shading.color_type = "MATERIAL"
    # Colours come out exactly as picked, with no filmic tone curve.
    scene.view_settings.view_transform = "Standard"

    for name, hex_color in PALETTE.items():
        make_material(name, hex_color)

    text = bpy.data.texts.new("slicer.py")
    with open(SLICER_PATH) as file:
        text.write(file.read())
    text.use_fake_user = True

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

    # Test: a cube filling one cell must give a 256x16 strip (16 layers of 16x16).
    namespace = {}
    exec(text.as_string(), namespace)
    collection = bpy.data.collections.new("TEST")
    scene.collection.children.link(collection)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.5, 0.5, 0.5))
    cube = bpy.context.active_object
    for owner in list(cube.users_collection):
        owner.objects.unlink(cube)
    collection.objects.link(cube)
    cube.data.materials.append(bpy.data.materials["MARS_PALETTE_HULL_WHITE"])

    out_dir = os.path.join(HERE, "out", "test")
    written = namespace["slice_module"]("TEST", 1, 1, 16, out_dir)
    strip = bpy.data.images.load(written[0])
    size = tuple(strip.size)
    pixels = list(strip.pixels)
    bpy.data.images.remove(strip)
    solid = all(alpha == 1.0 for alpha in pixels[3::4])
    try:
        written += namespace["preview_module"]("TEST", out_dir)
        preview_ok = True
    except Exception as error:  # A machine with no GPU can still slice.
        print(f"step0: preview render failed: {error}")
        preview_ok = False

    mesh = cube.data
    bpy.data.objects.remove(cube)
    bpy.data.meshes.remove(mesh)
    bpy.data.collections.remove(collection)
    if "--keep-test-output" not in sys.argv:
        shutil.rmtree(out_dir, ignore_errors=True)

    bpy.ops.wm.save_mainfile()

    ok = size == (256, 16) and solid
    print(f"step0: test strip is {size[0]}x{size[1]}, fully filled: {solid} -> {'PASS' if ok else 'FAIL'}")
    print(f"step0: preview render: {'PASS' if preview_ok else 'FAIL'}")
    print(f"step0: saved {BLEND_PATH}")
    print(f"step0: materials: {', '.join(sorted(m.name for m in bpy.data.materials))}")
    if not ok:
        sys.exit(1)


main()
