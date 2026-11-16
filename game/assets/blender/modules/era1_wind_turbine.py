"""
E1-9 Wind Turbine: 1x1 cells, 32 layers. Weak but steady: Mars air is very thin.

A vertical-axis turbine, not a propeller: three white blades standing round a grey mast between
two hub plates, with an orange tip. Each blade is built in steps that creep round the mast, so
the drum looks twisted, and the game can spin it by turning the layers.

It has no doors: it is a machine on a mast, not a room.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=1, name="wind_turbine")
MIDDLE = (0.5, 0.5)

# A dark foot, a tapered grey base and the mast.
kit.cylinder("DARK_TRIM", MIDDLE, 0.32, 0.0, 0.1, sides=16)
kit.cylinder("METAL_GREY", MIDDLE, 0.22, 0.08, 0.42, top_radius=0.09, sides=16)
kit.cylinder("DARK_TRIM", MIDDLE, 0.07, 0.4, 1.9, sides=8)

# The twisted drum: a hub plate below and above, and three blades between them. Each blade
# climbs in four steps, every step turned 12 degrees further round the mast.
kit.cylinder("METAL_GREY", MIDDLE, 0.3, 0.56, 0.64, sides=16)
STEPS, STEP_TALL, RADIUS = 4, 0.28, 0.3
for blade in range(3):
    for step in range(STEPS):
        angle = math.radians(blade * 120 + step * 12 + 20)
        x = 0.5 + RADIUS * math.cos(angle)
        y = 0.5 + RADIUS * math.sin(angle)
        z = 0.62 + step * STEP_TALL
        kit.box("HULL_WHITE", (x - 0.1, y - 0.1, z), (x + 0.1, y + 0.1, z + STEP_TALL + 0.02))
kit.cylinder("METAL_GREY", MIDDLE, 0.3, 1.74, 1.82, sides=16)

# The orange tip.
kit.sphere("ACCENT_ORANGE", (0.5, 0.5, 1.9), 0.09)

kit.finish(era=1, cells_x=1, cells_y=1, layers=32)
