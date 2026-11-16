"""
E1-5 Storage: 2x2 cells, 16 layers. Based on the logistics module of NASA's Common Habitat.

A grey pallet holding three strapped crates and an upright water tank. It has no walls, so
its four doors are low gates at the pallet's edge, where the game's doorways are.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=1, name="storage")

# The pallet, with a darker deck so the cargo stands out.
kit.box("METAL_GREY", (0.06, 0.06, 0.0), (1.94, 1.94, 0.12))
kit.box("DARK_TRIM", (0.3, 0.3, 0.1), (1.7, 1.7, 0.15))

# Three crates of different heights, each with an orange strap over the top and down both sides.
kit.box("HULL_SHADE", (0.34, 0.36, 0.12), (0.98, 0.92, 0.72))
kit.box("ACCENT_ORANGE", (0.6, 0.33, 0.12), (0.72, 0.95, 0.75))
kit.box("HULL_SHADE", (0.34, 1.04, 0.12), (0.92, 1.66, 0.56))
kit.box("ACCENT_ORANGE", (0.31, 1.29, 0.12), (0.95, 1.41, 0.59))
kit.box("HULL_SHADE", (1.08, 0.36, 0.12), (1.66, 0.86, 0.48))
kit.box("ACCENT_ORANGE", (1.31, 0.33, 0.12), (1.43, 0.89, 0.51))

# The water tank: a glass cylinder on a grey foot, with a grey collar and a dark valve on top.
kit.cylinder("METAL_GREY", (1.32, 1.3), 0.38, 0.12, 0.22)
kit.cylinder("GLASS_TEAL", (1.32, 1.3), 0.33, 0.2, 0.92)
kit.cylinder("METAL_GREY", (1.32, 1.3), 0.36, 0.6, 0.68)
kit.cylinder("DARK_TRIM", (1.32, 1.3), 0.12, 0.9, 1.0, sides=12)

# Four low gates, one in the middle of each side, where the game puts the doorways.
kit.doors(2, 2, reach=0.24, z_low=0.0, height=0.5)

kit.finish(era=1, cells_x=2, cells_y=2, layers=16)
