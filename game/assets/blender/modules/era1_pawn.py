"""
E1-0 Astronaut pawns: 1x1 cells, facing south. One astronaut per crew colour, each in two
versions, named after the colour of their suit:

  pawn_orange   pawn_indoor_orange
  pawn_green    pawn_indoor_green
  pawn_blue     pawn_indoor_blue
  pawn_black    pawn_indoor_black

Outdoors, the astronaut has a big round white helmet, its face filled by a dark visor with a
glint, over a small body in a white suit. The collar, the cuffs and the belt are the crew colour.

Indoors, the same astronaut wears a jumpsuit in that crew colour, with no helmet. Each of the
four has their own complexion, so they can be told apart by more than their suit. All four
share one figure, one short dark haircut and one outfit, so none reads as a boy or a girl.

The colours are painted into the sprites (there is no tint mask), so the game just shows the
sprite with the right name.

The figure is drawn like a cut-out standing up: only three pixels thick, with the picture on
its front. A sprite stack shows one row of the front for each layer, so the game sees the
front view almost exactly as it is drawn here, with a little of the top of the head above it.
Each layer is a row of blocks side by side, never overlapping, so every pixel has one colour.

parts() builds the shapes, so the Era 3 radiation suit (era3_pawn_radsuit.py) can dress the
same astronauts instead of copying them.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

# The suited figure is 14 layers tall; the strip is cut at 20 to match the sprite table.
LAYERS = 20
# Where the cut-out stands in its cell: its front is 6 pixels up from the south edge, and it is 3 thick.
FRONT, THICK = 6, 3

# The crew: the name in the sprite's file name, the colour of their suit, and their complexion.
# To change who has which complexion, swap the last column.
CREW = (
    ("orange", "CREW_ORANGE", "REGOLITH_TAN"),
    ("green", "CREW_GREEN", "SKIN_TAN"),
    ("blue", "CREW_BLUE", "SKIN_FAIR"),
    ("black", "CREW_BLACK", "SKIN_DEEP"),
)
# Colours this script needs that older .blend files may not have yet (see PALETTE in step0_setup.py).
NEW_COLORS = {
    "SKIN_TAN": "#DBA574",
    "SKIN_FAIR": "#F3D2B4",
    "SKIN_DEEP": "#8D5A3B",
    "CREW_ORANGE": "#F97316",
    "CREW_GREEN": "#22C55E",
    "CREW_BLUE": "#3B82F6",
    "CREW_BLACK": "#1E2127",
}
# Earlier names for these sprites, cleared out of the .blend when it is next built.
OLD_NAMES = ("pawn", "pawn_indoor", "pawn_indoor_tan", "pawn_indoor_fair")

WHITE, SHADE, DARK = "HULL_WHITE", "HULL_SHADE", "DARK_TRIM"
YELLOW, GREY = "LIGHT_YELLOW", "METAL_GREY"


def begin(era, name):
    """Opens the era's .blend for one astronaut sprite, with the colours it needs."""
    kit.begin(era=era, name=name)
    for color, hex_color in NEW_COLORS.items():
        kit.material(color, hex_color)


def draw(rows):
    """Builds the figure from its front view: `rows` lists, bottom row first, the (colour, from, to) runs of pixels in each layer."""
    for layer, runs in enumerate(rows):
        for material, x_from, x_to in runs:
            kit.block(material, x_from, FRONT, x_to - x_from, THICK, layer, layer + 1)


def parts(accent, visor=DARK, vest=False):
    """
    The astronaut outdoors. `accent` is the crew colour of the collar, cuffs and belt, `visor`
    is the visor's colour, and `vest` puts a grey padded vest over the body.
    """
    if vest:
        body = [
            [(accent, 4, 5), (GREY, 5, 11), (accent, 11, 12)],
            [(WHITE, 4, 5), (GREY, 5, 7), (DARK, 7, 9), (GREY, 9, 11), (WHITE, 11, 12)],
        ]
    else:
        body = [
            [(accent, 4, 5), (WHITE, 5, 11), (accent, 11, 12)],
            [(WHITE, 4, 12)],
        ]
    draw(
        [
            [(SHADE, 5, 7), (SHADE, 9, 11)],  # boots
            [(WHITE, 5, 7), (WHITE, 9, 11)],  # legs
            [(DARK, 4, 5), (accent, 5, 11), (DARK, 11, 12)],  # gloves and belt
            *body,  # cuffs and body, then shoulders
            [(accent, 5, 11)],  # collar
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


def indoor_parts(suit, skin):
    """The astronaut indoors: the same body in a jumpsuit of the crew colour `suit`, with a bare head and hands of colour `skin`."""
    draw(
        [
            [(DARK, 5, 7), (DARK, 9, 11)],  # shoes
            [(suit, 5, 7), (suit, 9, 11)],  # legs
            [(skin, 4, 5), (suit, 5, 11), (skin, 11, 12)],  # hands
            [(suit, 4, 12)],
            [(suit, 4, 9), (YELLOW, 9, 10), (suit, 10, 12)],  # the mission patch
            [(WHITE, 5, 11)],  # collar
            [(skin, 6, 10)],  # chin
            [(skin, 5, 11)],
            [(skin, 5, 6), (DARK, 6, 7), (skin, 7, 9), (DARK, 9, 10), (skin, 10, 11)],  # eyes
            [(skin, 5, 11)],
            [(DARK, 5, 11)],  # hair
            [(DARK, 6, 10)],
        ]
    )


def finish(era):
    # No edge dimming: every pixel of a figure this small is an edge, so dimming would just
    # make the whole astronaut grey (and dull every crew colour).
    # flat=True also saves the whole figure as one picture, which is what the game draws.
    kit.finish(era=era, cells_x=1, cells_y=1, layers=LAYERS, edge_darken=1.0, flat=True)


if __name__ == "__main__":
    for name, accent, skin in CREW:
        begin(1, f"pawn_{name}")
        for old in OLD_NAMES:
            kit.discard(old)
        parts(accent)
        finish(era=1)
        begin(1, f"pawn_indoor_{name}")
        indoor_parts(accent, skin)
        finish(era=1)
