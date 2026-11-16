"""
Spaceship, edition 4 (Era 4): 3x3 cells, 32 layers. Based on Artemis IV, the crewed landing.

The full crew lander, and the biggest of the four: a wide gold-foil stage on four heavy
legs, a tall round white cabin with a wide window and a domed roof, a hatch with a porch
and a ladder down to the ground, a solar panel on each side and a gold dish on top.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import lander_parts as ship  # noqa: E402

kit.begin(era=4, name="lander")
C = ship.MIDDLE

# Four heavy legs, one to each corner.
for side_x in (-1, 1):
    for side_y in (-1, 1):
        ship.stair_leg(side_x, side_y, start=1, steps=4, size=4, rise=2)

# The engine bell and the wide gold-foil stage, with a titanium band and an orange band.
kit.cylinder("DARK_TRIM", C, 0.44, 0.1, 0.44, top_radius=0.22, sides=12)
kit.cylinder("FOIL_GOLD", C, 0.98, 0.42, 0.94, sides=8)
kit.cylinder("METAL_GREY", C, 1.0, 0.42, 0.52, sides=8)
kit.cylinder("ACCENT_ORANGE", C, 1.0, 0.86, 0.94, sides=8)

# The hatch in the front of the stage, a porch under it, and a ladder stepping down to the ground.
kit.box("DARK_TRIM", (1.3, 0.5, 0.52), (1.7, 0.64, 0.84))
kit.box("LIGHT_YELLOW", (1.44, 0.48, 0.78), (1.56, 0.62, 0.84))
kit.block("METAL_GREY", 21, 5, 6, 4, 7, 8)
for step in range(3):
    kit.block("METAL_GREY", 22, 2 + step, 4, 1, 1 + step * 2, 3 + step * 2)

# The crew cabin: a tall white drum with a wide window, a teal light band and a domed roof.
kit.cylinder("HULL_WHITE", C, 0.64, 0.94, 1.5, sides=16)
kit.cylinder("GLASS_TEAL", C, 0.66, 0.98, 1.04, sides=16)
ship.window(1.14, 1.86, 0.88, 1.18, 1.36, depth=0.2)
kit.dome("HULL_WHITE", (1.5, 1.5, 1.5), 0.64, stretch=(1, 1, 0.5))

# A solar panel on each side of the cabin: one layer thick, with dark lines between its cells.
for x in (2, 35):
    kit.block("SOLAR_BLUE", x, 19, 11, 10, 19, 20)
    for line in (3, 7):
        kit.block("DARK_TRIM", x + line, 19, 1, 10, 20, 21)

# On the roof: a gold dish and a mast with a light.
kit.cylinder("FOIL_GOLD", (1.72, 1.62), 0.06, 1.72, 1.9, top_radius=0.26, sides=16)
kit.cylinder("DARK_TRIM", (1.72, 1.62), 0.06, 1.86, 1.94, sides=8)
kit.block("METAL_GREY", 19, 23, 2, 2, 28, 31)
kit.block("LIGHT_YELLOW", 19, 23, 2, 2, 31, 32)

kit.finish(era=4, cells_x=3, cells_y=3, layers=32, flat=True, shade="walls")
