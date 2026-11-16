"""
E2-2 Med Bay: 2x2 cells, 18 layers. Based on the medical station of NASA's Mars Dune Alpha.

A rounded white box with grey titanium panels round its foot, a glass roof panel showing a
white plus sign, and a row of sandbags along the roof edge as radiation shielding.

The sign is a white plus on teal glass, NOT a red cross: the red cross is a protected emblem.
The collection is called "medbay" (the game's id for this module).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=2, name="medbay")
PIXEL = 1 / 16


def rounded(material, low, high, corner, z_from, z_to):
    """A box with rounded corners, seen from above: two crossed boxes and a cylinder in each corner."""
    kit.box(material, (low + corner, low, z_from), (high - corner, high, z_to))
    kit.box(material, (low, low + corner, z_from), (high, high - corner, z_to))
    for x in (low + corner, high - corner):
        for y in (low + corner, high - corner):
            kit.cylinder(material, (x, y), corner, z_from, z_to, sides=12)


# A grey footing, the white hull, and a band of grey titanium panels round its foot.
kit.box("DARK_TRIM", (0.06, 0.06, 0.0), (1.94, 1.94, 0.1))
rounded("HULL_WHITE", 0.16, 1.84, 0.26, 0.08, 0.8)
rounded("METAL_GREY", 0.12, 1.88, 0.28, 0.1, 0.34)
rounded("ACCENT_ORANGE", 0.13, 1.87, 0.28, 0.62, 0.7)

# The roof sign: a dark frame, four squares of glass, and the white plus between them. The
# glass and the plus are side by side at the same height, so the plus stays clean white.
kit.box("DARK_TRIM", (7 * PIXEL, 7 * PIXEL, 0.8), (25 * PIXEL, 25 * PIXEL, 0.85))
for x in (8 * PIXEL, 18 * PIXEL):
    for y in (8 * PIXEL, 18 * PIXEL):
        kit.box("GLASS_TEAL", (x, y, 0.8), (x + 6 * PIXEL, y + 6 * PIXEL, 0.9))
kit.box("HULL_WHITE", (14 * PIXEL, 8 * PIXEL, 0.8), (18 * PIXEL, 24 * PIXEL, 0.9))
kit.box("HULL_WHITE", (8 * PIXEL, 14 * PIXEL, 0.8), (14 * PIXEL, 18 * PIXEL, 0.9))
kit.box("HULL_WHITE", (18 * PIXEL, 14 * PIXEL, 0.8), (24 * PIXEL, 18 * PIXEL, 0.9))

# Sandbags along the roof edge: three pixels of bag, one pixel of gap.
for bag in range(4):
    along = (9 + bag * 4) * PIXEL
    kit.box("REGOLITH_TAN", (along, 3 * PIXEL, 0.8), (along + 3 * PIXEL, 5 * PIXEL, 0.92))
    kit.box("REGOLITH_TAN", (along, 27 * PIXEL, 0.8), (along + 3 * PIXEL, 29 * PIXEL, 0.92))
    kit.box("REGOLITH_TAN", (3 * PIXEL, along, 0.8), (5 * PIXEL, along + 3 * PIXEL, 0.92))
    kit.box("REGOLITH_TAN", (27 * PIXEL, along, 0.8), (29 * PIXEL, along + 3 * PIXEL, 0.92))

# Four doors, one in the middle of each side, where the game puts the doorways.
kit.doors(2, 2, reach=0.3, height=0.66)

kit.finish(era=2, cells_x=2, cells_y=2, layers=18)
