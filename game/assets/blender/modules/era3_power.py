"""
E3-1 Power Plant: 2x2 cells, 26 layers. A fission reactor, based on NASA's Fission Surface Power.
It is the one power source that keeps working through a dust storm.

A tall narrow reactor core with a dark cap, four flat grey radiator fins standing out from it
like a plus sign, and a yellow-and-dark hazard ring painted on the ground around the base.

It has no doors (the Power Plant is the standing exception to the four-door rule).
The collection is called "power" (the game's id for this module).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=3, name="power")
PIXEL = 1 / 16
MIDDLE = (1.0, 1.0)

# The hazard ring on the ground: a yellow disc one layer tall, with dark blocks lying on it
# every other eighth of the way round. (The dark ones sit a layer higher, so the two colours
# never fight over the same pixel.)
kit.cylinder("LIGHT_YELLOW", MIDDLE, 0.95, 0.0, PIXEL, sides=32)
for step in range(8):
    angle = math.radians(step * 45 + 22.5)
    x = 1.0 + 0.86 * math.cos(angle)
    y = 1.0 + 0.86 * math.sin(angle)
    kit.box("DARK_TRIM", (x - 0.1, y - 0.17, PIXEL), (x + 0.1, y + 0.17, 2 * PIXEL), rotation=(0, 0, step * 45 + 22.5))

# The base pad the reactor stands on.
kit.cylinder("DARK_TRIM", MIDDLE, 0.74, PIXEL, 0.2, sides=24)
kit.cylinder("METAL_GREY", MIDDLE, 0.5, 0.2, 0.3, sides=24)

# The four radiator fins, two pixels thick and as tall as the core.
FIN_LOW, FIN_HIGH = 0.26, 1.38
for low, high in ((0.12, 0.76), (1.24, 1.88)):
    kit.box("METAL_GREY", (low, 15 * PIXEL, FIN_LOW), (high, 17 * PIXEL, FIN_HIGH))
    kit.box("METAL_GREY", (15 * PIXEL, low, FIN_LOW), (17 * PIXEL, high, FIN_HIGH))

# The reactor core: a pale column with an orange band, a dark cap and a yellow warning light on top.
kit.cylinder("HULL_SHADE", MIDDLE, 0.3, 0.26, 1.44, sides=24)
kit.cylinder("ACCENT_ORANGE", MIDDLE, 0.33, 1.12, 1.25, sides=24)
kit.cylinder("DARK_TRIM", MIDDLE, 0.34, 1.44, 1.56, sides=24)
kit.cylinder("LIGHT_YELLOW", MIDDLE, 0.12, 1.56, 1.62, sides=12)

kit.finish(era=3, cells_x=2, cells_y=2, layers=26)
