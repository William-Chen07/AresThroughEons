"""
E2-6 Fuel Generator: 2x2 cells, 22 layers. Based on NASA's MOXIE (oxygen from Mars air) and
on making fuel from water ice.

Two upright tanks side by side, white for oxygen and orange for methane, with a grey
compressor box between them and dark pipes joining all three. Mars soil is banked up behind
as shielding.

It has no doors: it is tanks and a machine on a pad, not a room.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=2, name="fuel_generator")
TANK_Y = 1.05

# The pad.
kit.box("METAL_GREY", (0.06, 0.3, 0.0), (1.94, 1.9, 0.12))

# Mars soil banked up behind the tanks.
kit.sphere("REGOLITH_TAN", (1.0, 1.66, 0.1), 1.0, stretch=(0.92, 0.26, 0.46), detail=12)

# The two tanks: a drum with a domed top and two grey titanium bands.
for x, material in ((0.5, "HULL_WHITE"), (1.5, "ACCENT_ORANGE")):
    kit.cylinder("DARK_TRIM", (x, TANK_Y), 0.4, 0.1, 0.2, sides=24)
    kit.cylinder(material, (x, TANK_Y), 0.36, 0.16, 1.12, sides=24)
    kit.sphere(material, (x, TANK_Y, 1.12), 0.36, squash=0.55)
    kit.cylinder("METAL_GREY", (x, TANK_Y), 0.39, 0.36, 0.44, sides=24)
    kit.cylinder("METAL_GREY", (x, TANK_Y), 0.39, 0.86, 0.94, sides=24)
    kit.cylinder("DARK_TRIM", (x, TANK_Y), 0.08, 1.28, 1.36, sides=8)

# The compressor box between the tanks, with dark vents on the front and a yellow light on top.
kit.box("METAL_GREY", (0.8, 0.66, 0.1), (1.2, 1.4, 0.72))
kit.box("DARK_TRIM", (0.86, 0.63, 0.22), (1.14, 0.7, 0.3))
kit.box("DARK_TRIM", (0.86, 0.63, 0.4), (1.14, 0.7, 0.48))
kit.box("LIGHT_YELLOW", (0.94, 0.72, 0.72), (1.06, 0.84, 0.8))

# The pipes: one across the front low down, one over the top from tank to tank, and a drop to the compressor.
kit.box("DARK_TRIM", (0.42, 0.56, 0.5), (1.58, 0.66, 0.6))
kit.box("DARK_TRIM", (0.42, 0.58, 0.16), (0.52, 0.72, 0.6))
kit.box("DARK_TRIM", (1.48, 0.58, 0.16), (1.58, 0.72, 0.6))
kit.box("DARK_TRIM", (0.5, 1.0, 1.0), (1.5, 1.1, 1.1))
kit.box("DARK_TRIM", (0.95, 1.0, 0.7), (1.05, 1.1, 1.1))

kit.finish(era=2, cells_x=2, cells_y=2, layers=22)
