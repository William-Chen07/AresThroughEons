"""
E1-6 Pipe and corridor tiles: four pieces, each 1x1 cells and 6 layers.

  pipe_straight  joins west and east
  pipe_corner    joins south and east
  pipe_t         joins west, east and south
  pipe_cross     joins all four sides

Every arm ends exactly at the middle of its cell edge, so tiles join without a gap. The tube
is 0.5 wide. At this size (8 pixels across, 6 layers tall) a true round tube turns to mush, so
it is drawn the pixel-art way: a flat-sided tube with a raised pale crown along the top, which
reads as round.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402


def slab(material, side, start, end, half_width, z_low, z_high):
    """A length of one arm, from `start` to `end` cells out from the middle of the tile."""
    sign = 1 if side in ("east", "north") else -1
    low, high = sorted((0.5 + sign * start, 0.5 + sign * end))
    if side in ("east", "west"):
        kit.box(material, (low, 0.5 - half_width, z_low), (high, 0.5 + half_width, z_high))
    else:
        kit.box(material, (0.5 - half_width, low, z_low), (0.5 + half_width, high, z_high))


def build(name, sides, preview=False):
    kit.begin(era=1, name=name)
    # The hub in the middle, so corners and junctions join squarely.
    kit.box("HULL_SHADE", (0.25, 0.25, 0.0), (0.75, 0.75, 0.3))
    kit.box("HULL_WHITE", (0.375, 0.375, 0.28), (0.625, 0.625, 0.37))
    for side in sides:
        slab("HULL_SHADE", side, 0.0, 0.5, 0.25, 0.0, 0.3)
        slab("HULL_WHITE", side, 0.0, 0.5, 0.125, 0.28, 0.37)
        # A dark joint ring, one pixel wide, wrapped over the tube.
        slab("DARK_TRIM", side, 0.3125, 0.375, 0.28, 0.0, 0.375)
    kit.finish(era=1, cells_x=1, cells_y=1, layers=6, icon=preview)


build("pipe_straight", ("west", "east"))
build("pipe_corner", ("south", "east"))
build("pipe_t", ("west", "east", "south"))
build("pipe_cross", ("west", "east", "south", "north"), preview=True)
