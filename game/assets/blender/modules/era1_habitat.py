"""
E1-1 Habitat: 3x3 cells, 28 layers. Based on the crew quarters of NASA's Mars Dune Alpha.

Era 1 look: a white rigid drum off the lander, a band of gold foil, orange accents.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=1, name="habitat")
MIDDLE = (1.5, 1.5)

# The drum: a grey footing, the white hull, a gold foil band low down and an orange stripe near the top.
kit.cylinder("METAL_GREY", MIDDLE, 1.44, 0.0, 0.14)
kit.cylinder("HULL_WHITE", MIDDLE, 1.34, 0.1, 1.15)
kit.cylinder("FOIL_GOLD", MIDDLE, 1.39, 0.2, 0.46)
kit.cylinder("ACCENT_ORANGE", MIDDLE, 1.39, 0.92, 1.05)

# The roof: a shallow white cone up to a dark ring that holds a glass skylight.
kit.cylinder("HULL_SHADE", MIDDLE, 1.34, 1.15, 1.22)
kit.cylinder("HULL_WHITE", MIDDLE, 1.26, 1.22, 1.45, top_radius=0.72)
kit.cylinder("DARK_TRIM", MIDDLE, 0.6, 1.4, 1.5)
kit.sphere("GLASS_TEAL", (1.5, 1.5, 1.47), 0.48, squash=0.5)

# Four doors, one in the middle of each side, where the game puts the doorways.
kit.doors(3, 3)

# A porthole between each pair of doors, turned to sit flat against the round wall.
for angle in (-135, -45, 45, 135):
    x = 1.5 + 1.31 * math.cos(math.radians(angle))
    y = 1.5 + 1.31 * math.sin(math.radians(angle))
    kit.box("GLASS_TEAL", (x - 0.2, y - 0.07, 0.56), (x + 0.2, y + 0.07, 0.84), rotation=(0, 0, angle + 90))

# On the roof: an equipment box and a radio mast with an orange tip.
kit.box("HULL_SHADE", (0.62, 1.86, 1.2), (0.98, 2.2, 1.46))
kit.box("DARK_TRIM", (0.68, 1.92, 1.46), (0.92, 2.14, 1.5))
kit.cylinder("METAL_GREY", (2.22, 2.22), 0.07, 1.2, 1.66, sides=8)
kit.sphere("ACCENT_ORANGE", (2.22, 2.22, 1.67), 0.1)

kit.finish(era=1, cells_x=3, cells_y=3, layers=28)
