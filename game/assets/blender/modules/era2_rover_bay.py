"""
E2-4 Rover Bay: 3x2 cells, 20 layers. Based on the pressurized rovers of NASA's Common Habitat.

A low grey titanium garage, set back so the yellow charging pad in front of it stays inside
the footprint. A wide roll-up door of dark slats faces south, a white control box stands on
the east side, and Mars soil is heaped on the back of the roof as shielding.

The roll-up door is the south door: it spans the game's south doorway. The other three sides
have ordinary doors.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=2, name="rover_bay")
PIXEL = 1 / 16

# The garage: a dark footing, the grey body, and a wing each side of the pad (the east one is the control box).
kit.box("DARK_TRIM", (0.08, 0.55, 0.0), (2.92, 1.92, 0.1))
kit.box("METAL_GREY", (0.15, 0.6, 0.08), (2.85, 1.85, 0.8))
kit.box("METAL_GREY", (0.15, 0.2, 0.0), (0.5, 0.6, 0.66))
kit.box("HULL_WHITE", (2.5, 0.2, 0.0), (2.85, 0.6, 0.6))
kit.box("GLASS_TEAL", (2.56, 0.17, 0.3), (2.79, 0.3, 0.48))
kit.box("LIGHT_YELLOW", (2.62, 0.34, 0.6), (2.74, 0.46, 0.68))

# The roll-up door: dark slats with a paler line between them, standing just proud of the wall.
SLAT_LINES = (3, 6, 9)
for layer in range(1, 11):
    material = "METAL_GREY" if layer in SLAT_LINES else "DARK_TRIM"
    kit.box(material, (0.56, 0.55, layer * PIXEL), (2.44, 0.66, (layer + 1) * PIXEL))
kit.box("ACCENT_ORANGE", (0.5, 0.54, 11 * PIXEL), (2.5, 0.68, 12 * PIXEL))

# The roof: a paler panel, and Mars soil heaped over the back half.
kit.box("HULL_SHADE", (0.25, 0.7, 0.8), (2.75, 1.75, 0.85))
kit.sphere("REGOLITH_TAN", (1.5, 1.4, 0.78), 1.0, stretch=(1.2, 0.42, 0.3), detail=12)

# The charging pad on the ground in front: a dark pad inside a yellow outline, one layer tall.
kit.box("DARK_TRIM", (11 * PIXEL, 3 * PIXEL, 0.0), (37 * PIXEL, 8 * PIXEL, PIXEL))
kit.box("LIGHT_YELLOW", (10 * PIXEL, 2 * PIXEL, 0.0), (38 * PIXEL, 3 * PIXEL, PIXEL))
kit.box("LIGHT_YELLOW", (10 * PIXEL, 8 * PIXEL, 0.0), (38 * PIXEL, 9 * PIXEL, PIXEL))
kit.box("LIGHT_YELLOW", (10 * PIXEL, 3 * PIXEL, 0.0), (11 * PIXEL, 8 * PIXEL, PIXEL))
kit.box("LIGHT_YELLOW", (37 * PIXEL, 3 * PIXEL, 0.0), (38 * PIXEL, 8 * PIXEL, PIXEL))

# Doors on the north, east and west sides (the roll-up door is the south one).
for side in ("north", "east", "west"):
    kit.door(side, 3, 2, reach=0.3, z_low=0.08, height=0.62)

kit.finish(era=2, cells_x=3, cells_y=2, layers=20)
