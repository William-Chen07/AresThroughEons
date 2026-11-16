"""
E1-7 Ore Processor: 2x2 cells, 20 layers. Turns rock into metal.

A boxy grey furnace with a funnel-shaped hopper full of ore on top, a glowing orange window
on the front, dark vents and a chimney on the roof, and a short chute on the east side that
drops gold ingots into a bin.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=1, name="ore_processor")

# The footing and the furnace: a main block, with two lower blocks on the east that leave a notch for the chute.
kit.box("DARK_TRIM", (0.06, 0.16, 0.0), (1.94, 1.84, 0.12))
kit.box("METAL_GREY", (0.15, 0.25, 0.1), (1.5, 1.75, 0.86))
kit.box("METAL_GREY", (1.5, 0.25, 0.1), (1.85, 0.86, 0.86))
kit.box("METAL_GREY", (1.5, 1.44, 0.1), (1.85, 1.75, 0.86))
kit.box("ACCENT_ORANGE", (0.12, 0.22, 0.72), (1.53, 1.78, 0.8))

# The hopper: a funnel, wide at the top, with a dark rim and a heap of ore inside.
kit.cylinder("HULL_SHADE", (0.9, 0.95), 0.22, 0.86, 1.18, top_radius=0.5)
kit.cylinder("DARK_TRIM", (0.9, 0.95), 0.5, 1.16, 1.22)
kit.cylinder("REGOLITH_TAN", (0.9, 0.95), 0.4, 1.16, 1.25)

# The glowing window on the front.
kit.box("DARK_TRIM", (0.34, 0.2, 0.26), (0.98, 0.3, 0.64))
kit.box("ACCENT_ORANGE", (0.4, 0.17, 0.32), (0.92, 0.3, 0.58))
kit.box("LIGHT_YELLOW", (0.52, 0.15, 0.38), (0.8, 0.3, 0.52))

# Vents and a chimney on the roof.
kit.box("DARK_TRIM", (0.24, 1.5, 0.86), (0.6, 1.58, 0.92))
kit.box("DARK_TRIM", (0.24, 1.62, 0.86), (0.6, 1.7, 0.92))
kit.cylinder("DARK_TRIM", (1.66, 1.6), 0.1, 0.86, 1.16, sides=12)

# The chute, sloping down to the east, and the bin of ingots under its end.
kit.box("HULL_SHADE", (1.42, 0.98, 0.34), (1.96, 1.34, 0.46), rotation=(0, 25, 0))
kit.box("DARK_TRIM", (1.6, 0.92, 0.1), (1.94, 1.4, 0.2))
kit.box("FOIL_GOLD", (1.68, 1.0, 0.18), (1.9, 1.12, 0.27))
kit.box("FOIL_GOLD", (1.68, 1.2, 0.18), (1.9, 1.32, 0.25))

# Four doors, one in the middle of each side, where the game puts the doorways.
kit.doors(2, 2)

kit.finish(era=1, cells_x=2, cells_y=2, layers=20)
