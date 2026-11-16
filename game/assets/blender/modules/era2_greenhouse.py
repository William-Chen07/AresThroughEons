"""
E2-1 Potato Greenhouse: 3x2 cells, 18 layers. Based on the food-growing stations of NASA's
Mars Dune Alpha.

A half-round tunnel along X made of grey ribs only: there is no solid roof (the game is meant
to draw a see-through cover), so the plants show between the ribs. Inside are three soil beds
of leafy potato plants, with a yellow grow-light bar along the top. The end walls are solid white.

The collection is called "greenhouse" (the game's id for this module).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=2, name="greenhouse")
PIXEL = 1 / 16
MID_Y, FLOOR, RADIUS = 1.0, 0.1, 0.8


def rib(x):
    """One arch of the tunnel, one pixel thick, built from short straight pieces along the curve."""
    pieces = 8
    for piece in range(pieces):
        angle = math.radians((piece + 0.5) * 180 / pieces)
        y = MID_Y + (RADIUS - 0.05) * math.cos(angle)
        z = FLOOR + (RADIUS - 0.05) * math.sin(angle)
        kit.box(
            "METAL_GREY",
            (x, y - 0.18, z - 0.05),
            (x + PIXEL, y + 0.18, z + 0.05),
            rotation=(math.degrees(angle) + 90, 0, 0),
        )


# The floor slab, and a low grey rail along each side for the ribs to stand on.
kit.box("METAL_GREY", (0.06, 0.1, 0.0), (2.94, 1.9, FLOOR))
kit.box("METAL_GREY", (0.25, 0.16, FLOOR), (2.75, 0.26, 0.26))
kit.box("METAL_GREY", (0.25, 1.74, FLOOR), (2.75, 1.84, 0.26))

# Three soil beds, each with a row of leafy mounds.
for bed_y in (0.56, 1.0, 1.44):
    kit.box("REGOLITH_TAN", (0.42, bed_y - 0.15, FLOOR), (2.58, bed_y + 0.15, 0.2))
    for plant in range(6):
        kit.sphere("PLANT_GREEN", (0.62 + plant * 0.352, bed_y, 0.27), 0.15, squash=0.8, detail=8)

# The solid white end walls: an arch at each end of the tunnel, three pixels thick, built in
# steps (a stepped arch is how pixel art draws a curve).
for x in (0.19, 2.625):
    for half_width, z_from, z_to in ((0.78, FLOOR, 0.42), (0.68, 0.42, 0.62), (0.52, 0.62, 0.78), (0.3, 0.78, 0.9)):
        kit.box("HULL_WHITE", (x, MID_Y - half_width, z_from), (x + 3 * PIXEL, MID_Y + half_width, z_to))

# The ribs, and the top rib that runs the length of the tunnel with the grow-light bar on it.
for x in (0.75, 1.25, 1.75, 2.25):
    rib(x)
kit.box("METAL_GREY", (0.25, MID_Y - 1.5 * PIXEL, 0.82), (2.75, MID_Y + 1.5 * PIXEL, 0.9))
kit.box("LIGHT_YELLOW", (0.4, MID_Y - 0.5 * PIXEL, 0.88), (2.6, MID_Y + 0.5 * PIXEL, 0.96))

# Four doors, one in the middle of each side, where the game puts the doorways. They are a
# little lower than usual, to sit under the curve of the tunnel.
kit.doors(3, 2, reach=0.3, height=0.62)

kit.finish(era=2, cells_x=3, cells_y=2, layers=18)
