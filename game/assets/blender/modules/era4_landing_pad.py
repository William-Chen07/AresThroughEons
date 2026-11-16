"""
E4-3 Landing Pad: 4x4 cells, 4 layers. It lets supply ships land without blasting dust over
the base.

A flat eight-sided slab of printed Mars soil, slightly raised, with a yellow ring, a white H
in the middle and a small landing light at each of four corners.

With only four layers, each part gets whole layers of its own, so two colours never share a
height: the slab is layers 0-1, the ring and the inner deck layer 2, the H and the lights layer 3.
It has no doors.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=4, name="landing_pad")
PIXEL = 1 / 16
MIDDLE = (2.0, 2.0)

# The slab: an octagon with a flat side facing each way.
kit.cylinder("REGOLITH_TAN", MIDDLE, 2.05, 0.0, 2 * PIXEL, sides=8, rotation=(0, 0, 22.5))

# The yellow ring: a yellow disc with a slightly taller tan deck inside it, so only the rim shows.
kit.cylinder("LIGHT_YELLOW", MIDDLE, 1.5, 2 * PIXEL, 3 * PIXEL, sides=32)
kit.cylinder("REGOLITH_TAN", MIDDLE, 1.32, 0.12, 0.2, sides=32)

# The H, one layer up, in white.
kit.block("HULL_WHITE", 23, 22, 4, 20, 3, 4)
kit.block("HULL_WHITE", 37, 22, 4, 20, 3, 4)
kit.block("HULL_WHITE", 27, 30, 10, 4, 3, 4)

# A landing light at four corners of the octagon: a dark housing with a yellow lamp on top.
for x in (9, 52):
    for y in (9, 52):
        kit.block("DARK_TRIM", x, y, 3, 3, 2, 3)
        kit.block("LIGHT_YELLOW", x + 1, y + 1, 1, 1, 3, 4)

kit.finish(era=4, cells_x=4, cells_y=4, layers=4, shade="walls")
