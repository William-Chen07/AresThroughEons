"""
E1-4 Solar Array: 2x2 cells, 8 layers, in two versions. Dust on its panels is what ended
NASA's InSight lander.

  solar        clean: two rows of blue panels tilted 20 degrees toward the south
  solar_dusty  the same array under a layer of Mars dust (the storm state, when power drops to zero)

It has no doors: it is an open frame, not a room, so there is nothing to walk into.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

TILT = 20
# Straight up out of a tilted panel's face.
UP = (0.0, -math.sin(math.radians(TILT)), math.cos(math.radians(TILT)))
PANEL_Z = 0.25


def tilted(material, x_from, x_to, y_mid, depth, thickness, lift=0.0):
    """A flat slab tilted like the panels, `lift` above the middle of the panel it sits on."""
    y, z = y_mid + UP[1] * lift, PANEL_Z + UP[2] * lift
    kit.box(
        material,
        (x_from, y - depth / 2, z - thickness / 2),
        (x_to, y + depth / 2, z + thickness / 2),
        rotation=(TILT, 0, 0),
    )


def build(name, dusty):
    kit.begin(era=1, name=name)

    # The frame: two skids on the ground, a post under the high edge of each panel, a cable box.
    for x in (0.2, 1.7):
        kit.box("METAL_GREY", (x, 0.06, 0.0), (x + 0.1, 1.94, 0.08))
    kit.box("ACCENT_ORANGE", (0.86, 0.9, 0.0), (1.14, 1.06, 0.14))

    for y_mid in (0.5, 1.46):
        for x in (0.2, 1.7):
            kit.box("METAL_GREY", (x, y_mid + 0.26, 0.0), (x + 0.1, y_mid + 0.36, 0.36))
        # A slanted slab is cut into thin strips, and each strip shows a little of the slab's
        # underside. So the glass is the whole thickness of the panel: no grey backing to peek out.
        if dusty:
            # Dust lies thick over the glass; only thin lines of blue still show.
            tilted("SOLAR_BLUE", 0.1, 1.9, y_mid, 0.8, 0.04, lift=-0.03)
            tilted("REGOLITH_TAN", 0.17, 1.83, y_mid, 0.8, 0.08, lift=0.03)
        else:
            tilted("SOLAR_BLUE", 0.1, 1.9, y_mid, 0.8, 0.1)
        # Thin grid lines between the cells, proud enough to show through the dust.
        for x in (0.53, 1.03, 1.47):
            tilted("DARK_TRIM", x - 0.03, x + 0.03, y_mid, 0.8, 0.16)

    kit.finish(era=1, cells_x=2, cells_y=2, layers=8)


build("solar", dusty=False)
build("solar_dusty", dusty=True)
