"""
E2-7 Golf set: 1x1 cells, 6 layers. Cosmetic. Alan Shepard hit golf balls on the Moon during
Apollo 14.

A tiny orange tee with a white ball on it, and a grey club lying flat beside it. Everything
sits exactly on the pixel grid, because at this size a part that is half a pixel off vanishes.

It has no doors and no build-menu icon: it is a decoration.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=2, name="golf_set")
PIXEL = 1 / 16


def block(material, x, y, wide, deep, z_from, z_to):
    """A block placed by pixel: `x`, `y` from the south-west corner, `wide` by `deep` pixels, layers z_from to z_to."""
    kit.box(material, (x * PIXEL, y * PIXEL, z_from * PIXEL), ((x + wide) * PIXEL, (y + deep) * PIXEL, z_to * PIXEL))


# The tee: two layers tall, with the ball on top of it (a little plus shape, so it looks round).
block("ACCENT_ORANGE", 5, 9, 1, 1, 0, 2)
block("HULL_WHITE", 4, 9, 3, 1, 2, 5)
block("HULL_WHITE", 5, 8, 1, 3, 2, 5)
block("HULL_WHITE", 5, 9, 1, 1, 5, 6)

# The club, lying flat on the ground in front: a dark grip, a grey shaft and a dark head.
block("DARK_TRIM", 2, 4, 3, 1, 0, 1)
block("METAL_GREY", 5, 4, 7, 1, 0, 1)
block("DARK_TRIM", 12, 4, 2, 3, 0, 2)

# No edge dimming: every pixel of something this small is an edge, and the ball must stay white.
kit.finish(era=2, cells_x=1, cells_y=1, layers=6, icon=False, edge_darken=1.0)
