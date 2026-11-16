"""
E3-5 Radiation suit pawns: 1x1 cells. Based on the radiation vests NASA has tested.

Each of the four astronauts wearing a grey padded vest with a dark chest plate, and a gold
visor: pawn_radsuit_orange, pawn_radsuit_green, pawn_radsuit_blue, pawn_radsuit_black. The
belt, collar and cuffs stay the crew colour. They are built from the Era 1 script's own
shapes (era1_pawn.parts).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import era1_pawn as pawn  # noqa: E402

for name, accent, _skin in pawn.CREW:
    pawn.begin(3, f"pawn_radsuit_{name}")
    kit.discard("pawn_radsuit")
    pawn.parts(accent, visor="FOIL_GOLD", vest=True)
    pawn.finish(era=3)
