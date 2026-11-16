"""
E1-2 Airlock: 2x1 cells, 18 layers. Based on the external airlock of NASA's Common Habitat.

Era 1 look: a white box off the lander with a gold foil band and orange accents. The round
hatch and the air tank on the roof say "this is where the air is kept in".
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=1, name="airlock")

# The body: a grey footing, the white hull, a gold foil band low down and an orange stripe near the top.
kit.box("METAL_GREY", (0.04, 0.06, 0.0), (1.96, 0.94, 0.14))
kit.box("HULL_WHITE", (0.12, 0.14, 0.1), (1.88, 0.86, 0.95))
kit.box("FOIL_GOLD", (0.09, 0.11, 0.2), (1.91, 0.89, 0.4))
kit.box("ACCENT_ORANGE", (0.09, 0.11, 0.8), (1.91, 0.89, 0.88))

# The roof: a shaded rim around a raised white panel.
kit.box("HULL_SHADE", (0.12, 0.14, 0.95), (1.88, 0.86, 1.0))
kit.box("HULL_WHITE", (0.2, 0.22, 1.0), (1.8, 0.78, 1.04))

# On the roof: a round glass hatch, and a gold air tank lying on its side with grey end caps.
kit.cylinder("DARK_TRIM", (0.55, 0.5), 0.22, 1.0, 1.1, sides=16)
kit.cylinder("GLASS_TEAL", (0.55, 0.5), 0.13, 1.0, 1.125, sides=16)
kit.cylinder("FOIL_GOLD", (1.3, 0.5), 0.08, 0.84, 1.24, sides=12, rotation=(0, 90, 0))
kit.box("METAL_GREY", (1.04, 0.4, 1.0), (1.1, 0.6, 1.11))
kit.box("METAL_GREY", (1.5, 0.4, 1.0), (1.56, 0.6, 1.11))
kit.box("LIGHT_YELLOW", (1.66, 0.44, 1.0), (1.76, 0.56, 1.1))

# Four doors, one in the middle of each side, where the game puts the doorways.
kit.doors(2, 1)

kit.finish(era=1, cells_x=2, cells_y=1, layers=18)
