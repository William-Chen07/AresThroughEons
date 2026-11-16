"""
E1-0 Astronaut pawn: 1x1 cells, facing south, in two versions:

  pawn         outdoors, in a Mars suit and helmet
  pawn_indoor  indoors (inside a module), in a jumpsuit with no helmet

The outdoor astronaut has a big round white helmet, its face filled by a dark visor with a
glint, over a small body in a white suit. Only the collar, the cuffs and the belt are
TINT_MASK, so the game gives each astronaut their own accent colour (orange, green, blue,
black) from one sprite.

The indoor astronaut has the same body in a jumpsuit that is all TINT_MASK. The palette has no
skin colour, so skin is REGOLITH_TAN and hair is DARK_TRIM, the same for everyone.

The figure is drawn like a cut-out standing up: only three pixels thick, with the picture on
its front. A sprite stack shows one row of the front for each layer, so the game sees the
front view almost exactly as it is drawn here, with a little of the top of the head above it.
Each layer is a row of blocks side by side, never overlapping, so every pixel has one colour.

parts() builds the shapes, so the Era 3 radiation suit (era3_pawn_radsuit.py) can dress the
same astronaut instead of copying it.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

# The suited figure is 14 layers tall; the strip is cut at 20 to match the sprite table.
LAYERS = 20
# Where the cut-out stands in its cell: its front is 6 pixels up from the south edge, and it is 3 thick.
FRONT, THICK = 6, 3
# The four crew colours, for the review pictures only (the sprite itself stays white where it is tinted).
CREW = {
    "orange": (0.976, 0.451, 0.086),
    "green": (0.133, 0.773, 0.369),
    "blue": (0.231, 0.510, 0.965),
    "black": (0.12, 0.13, 0.16),
}

WHITE, SHADE, DARK, TINT = "HULL_WHITE", "HULL_SHADE", "DARK_TRIM", "TINT_MASK"
SKIN, YELLOW, GREY = "REGOLITH_TAN", "LIGHT_YELLOW", "METAL_GREY"


def draw(rows):
    """Builds the figure from its front view: `rows` lists, bottom row first, the (colour, from, to) runs of pixels in each layer."""
    for layer, runs in enumerate(rows):
        for material, x_from, x_to in runs:
            kit.block(material, x_from, FRONT, x_to - x_from, THICK, layer, layer + 1)


def parts(visor=DARK, vest=False):
    """The astronaut outdoors. `visor` is the visor's colour; `vest` puts a grey padded vest over the body."""
    if vest:
        body = [
            [(TINT, 4, 5), (GREY, 5, 11), (TINT, 11, 12)],
            [(WHITE, 4, 5), (GREY, 5, 7), (DARK, 7, 9), (GREY, 9, 11), (WHITE, 11, 12)],
        ]
    else:
        body = [
            [(TINT, 4, 5), (WHITE, 5, 11), (TINT, 11, 12)],
            [(WHITE, 4, 12)],
        ]
    draw(
        [
            [(SHADE, 5, 7), (SHADE, 9, 11)],  # boots
            [(WHITE, 5, 7), (WHITE, 9, 11)],  # legs
            [(DARK, 4, 5), (TINT, 5, 11), (DARK, 11, 12)],  # gloves and belt
            *body,  # cuffs and body, then shoulders
            [(TINT, 5, 11)],  # collar
            [(WHITE, 5, 11)],  # helmet: the narrow bottom
            [(WHITE, 4, 6), (visor, 6, 10), (WHITE, 10, 12)],
            [(WHITE, 4, 5), (visor, 5, 11), (WHITE, 11, 12)],
            [(WHITE, 4, 5), (visor, 5, 11), (WHITE, 11, 12)],
            [(WHITE, 4, 5), (visor, 5, 11), (WHITE, 11, 12)],
            [(WHITE, 4, 5), (visor, 5, 6), (WHITE, 6, 8), (visor, 8, 11), (WHITE, 11, 12)],  # the glint
            [(WHITE, 4, 6), (visor, 6, 10), (WHITE, 10, 12)],
            [(WHITE, 5, 11)],  # helmet: the narrow top
        ]
    )


def indoor_parts():
    """The astronaut indoors: the same body in a jumpsuit, with a bare head and hands and a mission patch."""
    draw(
        [
            [(DARK, 5, 7), (DARK, 9, 11)],  # shoes
            [(TINT, 5, 7), (TINT, 9, 11)],  # legs
            [(SKIN, 4, 5), (TINT, 5, 11), (SKIN, 11, 12)],  # hands
            [(TINT, 4, 12)],
            [(TINT, 4, 9), (YELLOW, 9, 10), (TINT, 10, 12)],  # the mission patch
            [(WHITE, 5, 11)],  # collar
            [(SKIN, 6, 10)],  # chin
            [(SKIN, 5, 11)],
            [(SKIN, 5, 6), (DARK, 6, 7), (SKIN, 7, 9), (DARK, 9, 10), (SKIN, 10, 11)],  # eyes
            [(SKIN, 5, 11)],
            [(DARK, 5, 11)],  # hair
            [(DARK, 6, 10)],
        ]
    )


def finish(era, crew_pictures=False):
    # No edge dimming: every pixel of a figure this small is an edge, so dimming would just
    # make the whole astronaut grey (and dull every team colour).
    kit.finish(era=era, cells_x=1, cells_y=1, layers=LAYERS, edge_darken=1.0, review_tints=CREW if crew_pictures else None)


if __name__ == "__main__":
    kit.begin(era=1, name="pawn")
    parts()
    finish(era=1, crew_pictures=True)
    kit.begin(era=1, name="pawn_indoor")
    indoor_parts()
    finish(era=1, crew_pictures=True)
