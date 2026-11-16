"""
E3-5 Radiation suit pawn: 1x1 cells. Based on the radiation vests NASA has tested.

The Era 1 astronaut wearing a thick padded vest over the body (pale, with a dark seam) and a
gold visor. The arms and legs stay TINT_MASK, so each astronaut keeps their own colour. It is
built from the Era 1 script's own shapes (era1_pawn.parts).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import era1_pawn as pawn  # noqa: E402

kit.begin(era=3, name="pawn_radsuit")
pawn.parts(visor="FOIL_GOLD", chest=False)

# The vest: a pixel thicker than the body, front and back, in two padded bands with a dark
# seam between them. The bands are stacked, never overlapping, so each pixel has one clear
# colour, and the vest stands a hair proud of the body all round so it always wins over it.
kit.block("HULL_SHADE", 4.9, 4.9, 6.2, 6.2, 2.9, 5)
kit.block("DARK_TRIM", 4.9, 4.9, 6.2, 6.2, 5, 6)
kit.block("HULL_SHADE", 4.9, 4.9, 6.2, 6.2, 6, 8)

pawn.finish(era=3)
