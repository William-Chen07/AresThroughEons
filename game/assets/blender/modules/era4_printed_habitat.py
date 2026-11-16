"""
E4-1 Printed Habitat: 4x3 cells, 24 layers. Based on NASA's Mars Dune Alpha, a habitat that
was 3D-printed.

Thick rounded walls printed from Mars soil, with a ridge on every other layer the way a
printer lays one bead on top of another, a flat pale roof with two glass skylights, and four
dark door openings.

The palette has no second, darker tan, so the print lines come from the shape itself: every
other layer stands one pixel proud, and the shading turns those steps into light and dark bands.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

PIXEL = 1 / 16


def rounded(material, x_from, y_from, x_to, y_to, corner, z_from, z_to, sides=6):
    """A slab with rounded corners, seen from above: two crossed boxes and a cylinder in each corner."""
    kit.box(material, (x_from + corner, y_from, z_from), (x_to - corner, y_to, z_to))
    kit.box(material, (x_from, y_from + corner, z_from), (x_to, y_to - corner, z_to))
    for x in (x_from + corner, x_to - corner):
        for y in (y_from + corner, y_to - corner):
            kit.cylinder(material, (x, y), corner, z_from, z_to, sides=sides)


kit.begin(era=4, name="printed_habitat")

# The printed wall: one solid block, and a ridge one pixel proud on every other layer.
WALL_TOP = 22
rounded("REGOLITH_TAN", 0.25, 0.25, 3.75, 2.75, 0.5, 0.0, WALL_TOP * PIXEL, sides=8)
for layer in range(1, WALL_TOP, 2):
    rounded("REGOLITH_TAN", 0.19, 0.19, 3.81, 2.81, 0.56, layer * PIXEL, (layer + 1) * PIXEL)

# The flat roof, set in from the wall's edge, with two round skylights standing a layer above it.
ROOF = WALL_TOP * PIXEL
rounded("HULL_SHADE", 0.46, 0.46, 3.54, 2.54, 0.36, ROOF, ROOF + PIXEL)
for x in (1.3, 2.7):
    kit.cylinder("DARK_TRIM", (x, 1.5), 0.4, ROOF, ROOF + 0.085, sides=16)
    kit.cylinder("GLASS_TEAL", (x, 1.5), 0.32, ROOF, ROOF + 2 * PIXEL, sides=16)

# Four door openings framed in dark trim, one in the middle of each side, where the game puts the doorways.
kit.doors(4, 3, reach=0.35, z_low=0.0, height=0.82, frame="DARK_TRIM")

# The usual edge shading is what draws the print lines here: each proud ridge gets a dark rim.
kit.finish(era=4, cells_x=4, cells_y=3, layers=24)
