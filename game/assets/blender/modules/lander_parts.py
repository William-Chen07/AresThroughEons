"""
Shapes the lander scripts share. A lander stands on the same 3x3 cells in every era
(LANDER_CELLS in the game), so the middle of the footprint is (1.5, 1.5).

Landers have no doors and no TINT_MASK: each is a vehicle the game draws as one picture.
"""

import math

import kit

MIDDLE = (1.5, 1.5)
FOOTPRINT_PX = 48


def stair_leg(side_x, side_y, start, steps, size, rise):
    """
    A leg from a corner of the footprint up to the hull, built as a staircase of blocks so
    every piece sits on the pixel grid. `side_x` and `side_y` are -1 or 1 (which corner);
    `start` is how many pixels in from the corner the footpad is; each of the `steps` blocks is
    `size` pixels square and `rise` layers higher than the last.
    """

    def place(inset):
        x = inset if side_x < 0 else FOOTPRINT_PX - inset - size
        y = inset if side_y < 0 else FOOTPRINT_PX - inset - size
        return x, y

    pad_x, pad_y = place(start)
    kit.block("HULL_SHADE", pad_x - 1, pad_y - 1, size + 2, size + 2, 0, 1)
    for step in range(steps):
        x, y = place(start + step * size)
        kit.block("METAL_GREY", x, y, size, size, 1 + step * rise, 2 + (step + 1) * rise)


def strut_leg(angle, pad_radius, hull_radius, hull_z, thick=0.16):
    """A straight leg running from the hull down and outward to a round footpad, at `angle` degrees round the lander."""
    turn = math.radians(angle)
    pad = (1.5 + pad_radius * math.cos(turn), 1.5 + pad_radius * math.sin(turn))
    kit.cylinder("HULL_SHADE", pad, 0.16, 0.0, 0.09, sides=12)
    run = pad_radius - hull_radius
    length = math.hypot(run, hull_z)
    mid_radius = (pad_radius + hull_radius) / 2
    x = 1.5 + mid_radius * math.cos(turn)
    y = 1.5 + mid_radius * math.sin(turn)
    z = hull_z / 2 + 0.04
    kit.box(
        "METAL_GREY",
        (x - length / 2, y - thick / 2, z - thick / 2),
        (x + length / 2, y + thick / 2, z + thick / 2),
        rotation=(0, math.degrees(math.atan2(hull_z, run)), angle),
    )


def window(x_from, x_to, y_face, z_from, z_to, depth=0.18):
    """A window on the south face: a dark frame with the glass standing just proud of it. `y_face` is where the hull's surface is."""
    kit.box("DARK_TRIM", (x_from - 0.06, y_face - 0.04, z_from - 0.04), (x_to + 0.06, y_face + depth, z_to + 0.04))
    kit.box("GLASS_TEAL", (x_from, y_face - 0.08, z_from), (x_to, y_face + depth, z_to))
