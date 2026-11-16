"""
E1-0 Astronaut pawn: 1x1 cells. The astronaut in a Mars suit, facing south.

The suit (legs, body and arms) is white TINT_MASK, so the game can give every astronaut their
own colour from one sprite. The helmet is white with a dark visor, like the placeholder the
game draws now. The figure is 12 layers tall, so it fits under a door frame.

It is built on the pixel grid: at this size a part half a pixel off simply vanishes.

parts() builds the shapes, so the Era 3 radiation suit (era3_pawn_radsuit.py) can dress the
same astronaut instead of copying it.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

# The figure itself is 12 layers tall; the strip is cut at 20 to match the sprite table.
LAYERS = 20


def parts(visor="DARK_TRIM", chest=True):
    """The astronaut. `visor` is the visor's colour; `chest=False` leaves off the chest pack."""
    # Boots, then legs with a gap between them.
    for x in (5, 9):
        kit.block("DARK_TRIM", x, 6, 2, 4, 0, 1)
        kit.block("TINT_MASK", x, 6, 2, 4, 1, 3)
    # Body and arms.
    kit.block("TINT_MASK", 5, 6, 6, 4, 3, 7)
    kit.block("TINT_MASK", 4, 7, 1, 2, 3, 7)
    kit.block("TINT_MASK", 11, 7, 1, 2, 3, 7)
    kit.block("DARK_TRIM", 4, 7, 1, 2, 2, 3)
    kit.block("DARK_TRIM", 11, 7, 1, 2, 2, 3)
    # The life-support pack on the back.
    kit.block("HULL_SHADE", 6, 10, 4, 1, 3, 8)
    if chest:
        # The chest pack: a small control box with an orange light.
        kit.block("HULL_SHADE", 7, 5, 2, 1, 4, 6)
        kit.block("ACCENT_ORANGE", 8, 5, 1, 1, 5, 6)
    # The helmet, a little rounded on top, with the visor on its south face.
    kit.block("HULL_WHITE", 5, 6, 6, 4, 7, 11)
    kit.block("HULL_WHITE", 6, 7, 4, 2, 11, 12)
    kit.block(visor, 6, 5, 4, 1, 8, 10)


def finish(era):
    # No edge dimming: every pixel of a figure this small is an edge, so dimming would just
    # make the whole astronaut grey (and dull every team colour).
    kit.finish(era=era, cells_x=1, cells_y=1, layers=LAYERS, edge_darken=1.0)


if __name__ == "__main__":
    kit.begin(era=1, name="pawn")
    parts()
    finish(era=1)
