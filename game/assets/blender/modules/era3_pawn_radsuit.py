"""
E3-5 Radiation suit pawn: 1x1 cells. Based on the radiation vests NASA has tested.

The Era 1 astronaut wearing a grey padded vest with a dark chest plate, and a gold visor. The
belt, collar and cuffs stay TINT_MASK, so each astronaut keeps their own accent colour. It is
built from the Era 1 script's own shapes (era1_pawn.parts).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import era1_pawn as pawn  # noqa: E402

kit.begin(era=3, name="pawn_radsuit")
pawn.parts(visor="FOIL_GOLD", vest=True)
pawn.finish(era=3, crew_pictures=True)
