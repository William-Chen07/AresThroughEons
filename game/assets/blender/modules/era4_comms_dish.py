"""
E4-2 Comms Relay Dish: 2x2 cells, 30 layers. Based on the Mars relay network in NASA's
long-term Mars plan. It is where the game can teach the delay in talking to Earth.

A simple grey lattice tower holding a big white dish tilted 40 degrees toward the south, with
a gold feed horn in the middle of the dish and a small red beacon on its top edge.

It has no doors: it is a machine on a tower, not a room.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.begin(era=4, name="comms_dish")
TILT = 40
# The way the dish faces: up and toward the south.
AIM = (0.0, -math.sin(math.radians(TILT)), math.cos(math.radians(TILT)))
DISH = (1.0, 1.02, 1.3)
DISH_RADIUS, DISH_DEEP = 0.62, 0.2


def along(distance):
    """A point `distance` out from the dish's middle, the way it faces."""
    return tuple(DISH[axis] + AIM[axis] * distance for axis in range(3))


# A dark footing, and the lattice tower: four posts two pixels square, two rings of braces and a platform.
kit.block("DARK_TRIM", 8, 8, 16, 16, 0, 1)
for x in (10, 20):
    for y in (10, 20):
        kit.block("METAL_GREY", x, y, 2, 2, 1, 16)
for layer in (6, 11):
    kit.block("METAL_GREY", 10, 10, 12, 2, layer, layer + 1)
    kit.block("METAL_GREY", 10, 20, 12, 2, layer, layer + 1)
    kit.block("METAL_GREY", 10, 12, 2, 8, layer, layer + 1)
    kit.block("METAL_GREY", 20, 12, 2, 8, layer, layer + 1)
kit.block("METAL_GREY", 9, 9, 14, 14, 16, 17)

# The mount on the platform, and the dish, tilted to face south. It is a flat round plate, not a
# true bowl: a bowl thins to nothing at its rim, and the slices of that rim come out ragged.
kit.block("DARK_TRIM", 13, 14, 6, 6, 17, 20)
x, y, z = DISH
kit.cylinder("HULL_WHITE", (x, y), DISH_RADIUS, z - DISH_DEEP / 2, z + DISH_DEEP / 2, sides=24, rotation=(TILT, 0, 0))

# The gold feed horn, standing out from the middle of the dish.
hx, hy, hz = along(DISH_DEEP / 2 + 0.14)
kit.cylinder("FOIL_GOLD", (hx, hy), 0.1, hz - 0.16, hz + 0.16, sides=12, rotation=(TILT, 0, 0))

# The red beacon on the dish's top edge.
kit.block("ACCENT_RED", 15, 23, 2, 2, 27, 30)

kit.finish(era=4, cells_x=2, cells_y=2, layers=30, shade="walls")
