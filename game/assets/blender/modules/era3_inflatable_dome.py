"""
E3-2 Inflatable Dome Habitat: 4x4 cells, 32 layers. Based on Lockheed Martin's inflatable
habitats, which fold up for launch and inflate on arrival.

A big soft white dome on a short rigid grey ring, with an orange band at its foot, shallow
grooves every four layers so the fabric looks quilted, two round glass windows, and a rigid
dark collar round each of its four doors.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=3, name="inflatable_dome")
PIXEL = 1 / 16
MIDDLE = (2.0, 2.0)
# The dome is a ball squashed a little: how far it reaches sideways and upward from its middle.
DOME_Z, REACH, RISE = 0.25, 1.82, 1.65


def dome_radius(z):
    """How wide the dome is at height z."""
    return REACH * math.sqrt(max(0.0, 1 - ((z - DOME_Z) / RISE) ** 2))


# The rigid ring base and the orange band where the fabric meets it.
kit.cylinder("METAL_GREY", MIDDLE, 1.92, 0.0, 0.3, sides=24)
kit.cylinder("ACCENT_ORANGE", MIDDLE, 1.88, 0.3, 0.44, sides=24)

# The dome: a low-detail ball, so it stays well under the triangle limit.
kit.dome("HULL_WHITE", (2.0, 2.0, DOME_Z), 1.0, stretch=(REACH, REACH, RISE))

# The quilting: a groove every four layers, one layer thick, standing just proud of the fabric.
for layer in (10, 14, 18, 22, 26):
    z = layer * PIXEL
    kit.cylinder("HULL_SHADE", MIDDLE, dome_radius(z + PIXEL / 2) + 0.04, z, z + PIXEL, sides=24)

# Two round windows bulging out of the south face.
for angle in (-128, -52):
    x = 2.0 + 1.5 * math.cos(math.radians(angle))
    y = 2.0 + 1.5 * math.sin(math.radians(angle))
    kit.sphere("GLASS_TEAL", (x, y, 0.98), 0.38, detail=12)

# A rigid dark collar round each door, joining it to the soft dome, then the four doors
# themselves, one in the middle of each side, where the game puts the doorways.
kit.box("DARK_TRIM", (2.1, 0.1, 0.0), (2.9, 0.62, 1.02))
kit.box("DARK_TRIM", (2.1, 3.38, 0.0), (2.9, 3.9, 1.02))
kit.box("DARK_TRIM", (0.1, 1.1, 0.0), (0.62, 1.9, 1.02))
kit.box("DARK_TRIM", (3.38, 1.1, 0.0), (3.9, 1.9, 1.02))
kit.doors(4, 4, reach=0.22, z_low=0.08, height=0.84, frame="HULL_SHADE")

# No edge dimming: on a shape this round it breaks the smooth fabric into speckles, and the
# quilting grooves already give the dome its shading.
kit.finish(era=3, cells_x=4, cells_y=4, layers=32, edge_darken=1.0)
