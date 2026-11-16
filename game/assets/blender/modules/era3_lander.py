"""
Spaceship, edition 3 (Era 3): 3x3 cells, 28 layers. Based on Artemis III, the flight that
tests a Moon lander.

A compact test lander: a gold-foil stage on four legs, with a boxy grey cabin on top that
has two small windows, a round fuel tank on each side, a hatch and a small dish.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import lander_parts as ship  # noqa: E402

kit.begin(era=3, name="lander")
C = ship.MIDDLE

# Four legs, one to each corner.
for side_x in (-1, 1):
    for side_y in (-1, 1):
        ship.stair_leg(side_x, side_y, start=3, steps=5, size=3, rise=2)

# The engine bell and the eight-sided gold-foil stage, with an orange band round its top.
kit.cylinder("DARK_TRIM", C, 0.36, 0.1, 0.44, top_radius=0.18, sides=12)
kit.cylinder("FOIL_GOLD", C, 0.84, 0.42, 0.88, sides=8)
kit.cylinder("ACCENT_ORANGE", C, 0.86, 0.8, 0.88, sides=8)

# The boxy cabin, with a stepped-out front that carries two small windows.
kit.box("HULL_SHADE", (1.02, 1.12, 0.88), (1.98, 1.98, 1.42))
kit.box("METAL_GREY", (1.12, 0.94, 0.88), (1.88, 1.14, 1.3))
ship.window(1.18, 1.4, 0.94, 1.04, 1.18)
ship.window(1.6, 1.82, 0.94, 1.04, 1.18)

# A round fuel tank on each side of the cabin.
kit.sphere("HULL_WHITE", (0.94, 1.55, 1.08), 0.23, detail=12)
kit.sphere("HULL_WHITE", (2.06, 1.55, 1.08), 0.23, detail=12)

# On the cabin roof: a dark hatch, and a small dish on a short mast.
kit.cylinder("DARK_TRIM", (1.5, 1.5), 0.18, 1.42, 1.48, sides=12)
kit.block("METAL_GREY", 28, 28, 2, 2, 22, 25)
kit.cylinder("HULL_WHITE", (1.8125, 1.8125), 0.06, 1.54, 1.68, top_radius=0.2, sides=12)
kit.cylinder("ACCENT_ORANGE", (1.8125, 1.8125), 0.05, 1.64, 1.72, sides=8)

kit.finish(era=3, cells_x=3, cells_y=3, layers=28, flat=True, shade="walls")
