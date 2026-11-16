"""
E2-5 Rover: 2x1 cells, 14 layers. A vehicle, built in the Rover Bay. It runs on fuel, not food.

Six chunky dark wheels under a white pressurized cabin, with a glass windscreen facing east
(+X), a small mast with a dish on the back, and a TINT_MASK stripe along the side and the roof
that the game recolours to the team's colour.

It has no doors: it is a vehicle. It is drawn facing east only.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=2, name="rover")
PIXEL = 1 / 16

# Six wheels, three each side, each with a grey hub that shows on its outer face.
for x in (0.4, 1.0, 1.6):
    for y in (0.2, 0.8):
        kit.cylinder("DARK_TRIM", (x, y), 0.19, 0.19 - 0.09, 0.19 + 0.09, sides=12, rotation=(90, 0, 0))
        kit.cylinder("METAL_GREY", (x, y), 0.07, 0.19 - 0.11, 0.19 + 0.11, sides=8, rotation=(90, 0, 0))

# The chassis, with a flat deck at the back carrying a gold equipment box.
kit.box("METAL_GREY", (0.16, 0.29, 0.2), (1.88, 0.71, 0.36))
kit.box("FOIL_GOLD", (0.36, 0.56, 0.36), (0.56, 0.7, 0.5))

# The cabin, and the windscreen wrapped over its front edge so it shows from above.
kit.box("HULL_WHITE", (0.6, 0.25, 0.32), (1.8, 0.75, 0.72))
kit.box("DARK_TRIM", (1.44, 0.28, 0.5), (1.86, 0.72, 0.75))
kit.box("GLASS_TEAL", (1.5, 0.31, 0.46), (1.9, 0.69, 0.78))
kit.box("LIGHT_YELLOW", (1.86, 0.3, 0.36), (1.93, 0.4, 0.44))
kit.box("LIGHT_YELLOW", (1.86, 0.6, 0.36), (1.93, 0.7, 0.44))

# The team-colour stripe: along the south side, and along the roof where it shows from above.
kit.box("TINT_MASK", (0.66, 0.2, 0.44), (1.4, 0.26, 0.56))
kit.box("TINT_MASK", (0.66, 0.74, 0.44), (1.4, 0.8, 0.56))
kit.box("TINT_MASK", (0.66, 7 * PIXEL, 0.7), (1.38, 9 * PIXEL, 0.76))

# A small mast on the back deck, one pixel square, holding a dish that looks up.
kit.box("METAL_GREY", (4 * PIXEL, 6 * PIXEL, 0.36), (5 * PIXEL, 7 * PIXEL, 0.76))
kit.cylinder("HULL_SHADE", (4.5 * PIXEL, 6.5 * PIXEL), 0.05, 0.72, 0.85, top_radius=0.16, sides=12)

kit.finish(era=2, cells_x=2, cells_y=1, layers=14)
