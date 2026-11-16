"""
E1-10 Observatory: 2x2 cells, 24 layers. Home of the nebula-sound feature.

A white drum with a dome on top, a dark slit across the dome, and a small gold telescope
poking out of the slit toward the southern sky.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=1, name="observatory")
MIDDLE = (1.0, 1.0)

# The drum: a grey footing, the white wall, a gold foil band low down and an orange stripe near the top.
kit.cylinder("METAL_GREY", MIDDLE, 0.9, 0.0, 0.14)
kit.cylinder("HULL_WHITE", MIDDLE, 0.8, 0.1, 0.8)
kit.cylinder("FOIL_GOLD", MIDDLE, 0.84, 0.2, 0.36)
kit.cylinder("ACCENT_ORANGE", MIDDLE, 0.84, 0.66, 0.76)
kit.cylinder("HULL_SHADE", MIDDLE, 0.8, 0.78, 0.84)

# The dome, and the dark slit that runs over it from south to north.
kit.sphere("HULL_WHITE", (1.0, 1.0, 0.8), 0.66)
kit.sphere("DARK_TRIM", (1.0, 1.0, 0.8), 0.7, stretch=(0.2, 1, 1))

# The telescope: a fat gold tube tipped well over toward the south, with a glass lens at its end.
kit.cylinder("FOIL_GOLD", (1.0, 0.62), 0.12, 0.8, 1.5, sides=12, rotation=(50, 0, 0))
kit.sphere("GLASS_TEAL", (1.0, 0.33, 1.38), 0.1)

# The drum is round, so each door gets a short white porch joining it to the wall.
kit.box("HULL_WHITE", (1.2, 0.2, 0.1), (1.8, 0.6, 0.78))
kit.box("HULL_WHITE", (1.2, 1.4, 0.1), (1.8, 1.8, 0.78))
kit.box("HULL_WHITE", (0.2, 0.2, 0.1), (0.6, 0.8, 0.78))
kit.box("HULL_WHITE", (1.4, 0.2, 0.1), (1.8, 0.8, 0.78))
# Four doors, one in the middle of each side, where the game puts the doorways.
kit.doors(2, 2, reach=0.22, height=0.7)

kit.finish(era=1, cells_x=2, cells_y=2, layers=24)
