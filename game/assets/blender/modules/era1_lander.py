"""
Spaceship, edition 1 (Era 1): 3x3 cells, 24 layers. Based on Artemis I, the uncrewed test of
the big rocket with the crew capsule on top.

A rocket standing on a launch platform: an orange core, a white booster on each side, a
white upper stage, and the capsule with its escape tower on the very top. It is squashed
much shorter and fatter than the real thing so it reads at this size, and it is the plainest
of the four, so each later edition can outdo it.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import lander_parts as ship  # noqa: E402

kit.begin(era=1, name="lander")
C = ship.MIDDLE

# The launch platform it stands on, with a dark blast pit under the engines.
kit.box("METAL_GREY", (0.6, 0.85, 0.0), (2.4, 2.15, 0.12))
kit.box("DARK_TRIM", (0.95, 1.15, 0.1), (2.05, 1.85, 0.16))

# The orange core, with a dark engine section at its foot.
kit.cylinder("DARK_TRIM", C, 0.33, 0.14, 0.26, sides=16)
kit.cylinder("ACCENT_ORANGE", C, 0.3, 0.24, 1.0, sides=16)

# A white booster on each side: a dark skirt, the tube, a dark band and a pointed nose.
for x in (1.04, 1.96):
    kit.cylinder("DARK_TRIM", (x, 1.5), 0.18, 0.14, 0.24, sides=12)
    kit.cylinder("HULL_WHITE", (x, 1.5), 0.15, 0.22, 0.86, sides=12)
    kit.cylinder("DARK_TRIM", (x, 1.5), 0.17, 0.5, 0.57, sides=12)
    kit.cylinder("HULL_WHITE", (x, 1.5), 0.15, 0.86, 1.04, top_radius=0.03, sides=12)

# The white upper stage, the capsule, and the escape tower on top.
kit.cylinder("HULL_WHITE", C, 0.27, 1.0, 1.2, sides=16)
kit.cylinder("DARK_TRIM", C, 0.29, 1.0, 1.06, sides=16)
kit.cylinder("HULL_SHADE", C, 0.25, 1.2, 1.36, top_radius=0.1, sides=16)
kit.block("METAL_GREY", 23, 23, 2, 2, 21, 24)

kit.finish(era=1, cells_x=3, cells_y=3, layers=24, flat=True, shade="walls")
