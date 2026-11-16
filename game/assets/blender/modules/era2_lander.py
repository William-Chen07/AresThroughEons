"""
Spaceship, edition 2 (Era 2): 3x3 cells, 26 layers. Based on Artemis II, the first flight of
the crew capsule with astronauts on board.

The crew capsule on its white service module, with the four solar wings spread in an X. The
real one never lands, so here it stands on its engine and four short legs.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import lander_parts as ship  # noqa: E402

kit.begin(era=2, name="lander")
C = ship.MIDDLE
PIXEL = 1 / 16

# Four short legs, pointing north, east, south and west so they sit between the wings.
for angle in (0, 90, 180, 270):
    ship.strut_leg(angle, pad_radius=0.88, hull_radius=0.5, hull_z=0.5)

# The engine bell, and the white service module with a dark band and a grey ring where the capsule sits.
kit.cylinder("DARK_TRIM", C, 0.34, 0.12, 0.46, top_radius=0.18, sides=12)
kit.cylinder("HULL_WHITE", C, 0.55, 0.44, 0.98, sides=16)
kit.cylinder("DARK_TRIM", C, 0.57, 0.52, 0.6, sides=16)
kit.cylinder("METAL_GREY", C, 0.6, 0.92, 1.02, sides=16)

# The four solar wings in an X: each a blue panel one layer thick, with dark lines between its cells.
for angle in (45, 135, 225, 315):
    turn = math.radians(angle)
    x = 1.5 + 1.1 * math.cos(turn)
    y = 1.5 + 1.1 * math.sin(turn)
    kit.box("SOLAR_BLUE", (x - 0.56, y - 0.15, 11 * PIXEL), (x + 0.56, y + 0.15, 12 * PIXEL), rotation=(0, 0, angle))
    for step in (-0.28, 0.0, 0.28):
        lx = x + step * math.cos(turn)
        ly = y + step * math.sin(turn)
        kit.box("DARK_TRIM", (lx - 0.035, ly - 0.15, 12 * PIXEL), (lx + 0.035, ly + 0.15, 13 * PIXEL), rotation=(0, 0, angle))

# The capsule: a dark grey cone with two windows, a pale docking ring and a light on top.
kit.cylinder("METAL_GREY", C, 0.56, 1.02, 1.42, top_radius=0.24, sides=16)
kit.cylinder("ACCENT_ORANGE", C, 0.58, 1.02, 1.08, sides=16)
ship.window(1.24, 1.44, 1.08, 1.14, 1.26, depth=0.2)
ship.window(1.56, 1.76, 1.08, 1.14, 1.26, depth=0.2)
kit.cylinder("HULL_SHADE", C, 0.24, 1.42, 1.5, sides=16)
kit.cylinder("DARK_TRIM", C, 0.13, 1.5, 1.56, sides=12)
kit.block("LIGHT_YELLOW", 23, 23, 2, 2, 25, 26)

kit.finish(era=2, cells_x=3, cells_y=3, layers=26, flat=True, shade="walls")
