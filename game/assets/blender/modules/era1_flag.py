"""
E1-11 Mission flag: 1x1 cells, 20 layers. Cosmetic.

A thin grey pole with a bar along the top to hold the flag out (flags don't wave on Mars: there
is hardly any air). The flag is white TINT_MASK, so the game can colour it, with a plain orange
circle in the middle as a placeholder for the team patch. No real logos.

It has no doors: it is a flag.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=1, name="flag")
PIXEL = 1 / 16

# A dark foot, the pole (exactly one pixel square) and the bar along the top.
kit.box("DARK_TRIM", (3 * PIXEL, 7 * PIXEL, 0.0), (6 * PIXEL, 10 * PIXEL, 0.08))
kit.box("METAL_GREY", (4 * PIXEL, 8 * PIXEL, 0.0), (5 * PIXEL, 9 * PIXEL, 1.22))
kit.box("METAL_GREY", (4 * PIXEL, 8 * PIXEL, 1.13), (14.5 * PIXEL, 9 * PIXEL, 1.2))

# The flag hangs from the bar, facing south, with the circle in the middle of it.
kit.box("TINT_MASK", (5 * PIXEL, 8 * PIXEL, 0.62), (14 * PIXEL, 9 * PIXEL, 1.13))
kit.cylinder("ACCENT_ORANGE", (9.5 * PIXEL, 8.5 * PIXEL), 0.14, 0.82, 0.93, sides=16, rotation=(90, 0, 0))

kit.finish(era=1, cells_x=1, cells_y=1, layers=20)
