"""
E2-3 Big Lounge: 3x2 cells, 20 layers. The Era 1 Lounge grown up: shared living space.

Two white domes joined by a short tube, each with a large bubble window, orange door frames,
two potted plants by the front door, and Mars soil heaped over the back half as radiation
shielding.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=2, name="big_lounge")
DOMES = ((0.9, 1.05), (2.1, 1.05))

# A grey titanium footing under each dome and under the tube between them.
for middle in DOMES:
    kit.cylinder("METAL_GREY", middle, 0.84, 0.0, 0.14)
kit.box("METAL_GREY", (0.9, 0.5, 0.0), (2.1, 1.6, 0.14))

# The two domes, and the short tube that joins them (a rounded tunnel lying along X).
for x, y in DOMES:
    kit.dome("HULL_WHITE", (x, y, 0.1), 0.78, stretch=(1, 1, 0.95))
tube = kit.cylinder("HULL_WHITE", (1.5, 1.05), 1.0, 0.36 - 0.35, 0.36 + 0.35)
tube.rotation_euler = (0, 1.5707963, 0)
tube.scale = (0.44, 0.5, 1)
kit.box("FOIL_GOLD", (1.38, 0.53, 0.1), (1.62, 1.57, 0.82))

# A large bubble window on the south face of each dome.
kit.sphere("GLASS_TEAL", (0.86, 0.52, 0.42), 0.36, squash=0.9, detail=12)
kit.sphere("GLASS_TEAL", (2.14, 0.52, 0.42), 0.36, squash=0.9, detail=12)

# Mars soil heaped over the back half of each dome. It stays north of the east and west doors.
kit.dome("REGOLITH_TAN", (0.9, 1.5, 0.1), 1.0, stretch=(0.8, 0.48, 0.84), detail=12)
kit.dome("REGOLITH_TAN", (2.1, 1.5, 0.1), 1.0, stretch=(0.8, 0.48, 0.84), detail=12)

# The walls are round, so each door gets a short white porch joining it to the building.
kit.box("HULL_WHITE", (1.2, 0.2, 0.1), (1.8, 0.62, 0.6))
kit.box("HULL_WHITE", (1.2, 1.4, 0.1), (1.8, 1.8, 0.6))
kit.box("HULL_WHITE", (0.2, 0.2, 0.1), (0.56, 0.8, 0.6))
kit.box("HULL_WHITE", (2.44, 0.2, 0.1), (2.8, 0.8, 0.6))
# Four doors with orange frames, one in the middle of each side, where the game puts the doorways.
kit.doors(3, 2, reach=0.22, height=0.62, frame="ACCENT_ORANGE")

# Two potted plants, one each side of the front door.
for x in (0.98, 2.02):
    kit.cylinder("REGOLITH_TAN", (x, 0.13), 0.1, 0.0, 0.22, sides=12)
    kit.sphere("PLANT_GREEN", (x, 0.13, 0.36), 0.15, detail=8)

kit.finish(era=2, cells_x=3, cells_y=2, layers=20)
