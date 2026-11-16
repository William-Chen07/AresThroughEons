"""
E1-8 Lounge: 2x2 cells, 18 layers. Based on the shared living space of NASA's Mars Dune Alpha.

A low white dome with one big bubble window, orange door frames, and a potted plant by the
front door.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=1, name="lounge")
MIDDLE = (1.0, 1.0)

# A grey footing ring and the low white dome on it, with a gold band round its foot.
kit.cylinder("METAL_GREY", MIDDLE, 0.96, 0.0, 0.12)
kit.dome("HULL_WHITE", (1.0, 1.0, 0.1), 0.92, stretch=(1, 1, 0.82))
kit.cylinder("FOIL_GOLD", MIDDLE, 0.94, 0.12, 0.25)

# One big window: a glass bubble bulging out of the south-west of the dome.
kit.sphere("GLASS_TEAL", (0.66, 0.7, 0.42), 0.46, squash=0.85)

# The dome slopes away from each door, so a short white porch joins the door to it.
kit.box("HULL_WHITE", (1.2, 0.2, 0.1), (1.8, 0.6, 0.6))
kit.box("HULL_WHITE", (1.2, 1.4, 0.1), (1.8, 1.8, 0.6))
kit.box("HULL_WHITE", (0.2, 0.2, 0.1), (0.6, 0.8, 0.6))
kit.box("HULL_WHITE", (1.4, 0.2, 0.1), (1.8, 0.8, 0.6))
# Four doors with orange frames, one in the middle of each side, where the game puts the doorways.
kit.doors(2, 2, reach=0.22, height=0.62, frame="ACCENT_ORANGE")

# A potted plant next to the front door.
kit.cylinder("REGOLITH_TAN", (0.96, 0.13), 0.1, 0.0, 0.22, sides=12)
kit.sphere("PLANT_GREEN", (0.96, 0.13, 0.36), 0.15)

kit.finish(era=1, cells_x=2, cells_y=2, layers=18)
