"""
E1-7 Ore Processor: 2x2 cells, 20 layers. Turns rock into metal.

A boxy grey furnace with a funnel-shaped hopper full of ore on top, a glowing orange window
on the front, dark vents and a chimney on the roof, and a short chute on the east side that
drops gold ingots into a bin.

parts() builds the shapes, so the Era 3 upgrade (era3_ore_processor_pro.py) can build on the
same furnace instead of copying it.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402


def hopper(center, low, bottom_radius, top_radius, tall):
    """A funnel, wide at the top, with a dark rim and a heap of ore inside."""
    kit.cylinder("HULL_SHADE", center, bottom_radius, low, low + tall, top_radius=top_radius)
    kit.cylinder("DARK_TRIM", center, top_radius, low + tall - 0.02, low + tall + 0.04)
    kit.cylinder("REGOLITH_TAN", center, top_radius - 0.1, low + tall - 0.02, low + tall + 0.07)


def parts(lift=0.0, trim="ACCENT_ORANGE", pro=False):
    """
    The furnace. `lift` makes it that much taller, `trim` is the colour of the stripe round it,
    and `pro` swaps the roof vents for a second hopper and a stubby glowing chimney.
    """
    roof = 0.86 + lift

    # The footing and the furnace: a main block, with two lower blocks on the east that leave a notch for the chute.
    kit.box("DARK_TRIM", (0.06, 0.16, 0.0), (1.94, 1.84, 0.12))
    kit.box("METAL_GREY", (0.15, 0.25, 0.1), (1.5, 1.75, roof))
    kit.box("METAL_GREY", (1.5, 0.25, 0.1), (1.85, 0.86, roof))
    kit.box("METAL_GREY", (1.5, 1.44, 0.1), (1.85, 1.75, roof))
    kit.box(trim, (0.12, 0.22, roof - 0.14), (1.53, 1.78, roof - 0.06))

    hopper((0.9, 0.95), roof, 0.22, 0.5, 0.32)

    # The glowing window on the front.
    kit.box("DARK_TRIM", (0.34, 0.2, 0.26), (0.98, 0.3, 0.64))
    kit.box("ACCENT_ORANGE", (0.4, 0.17, 0.32), (0.92, 0.3, 0.58))
    kit.box("LIGHT_YELLOW", (0.52, 0.15, 0.38), (0.8, 0.3, 0.52))

    if pro:
        # A second, smaller hopper, and a stubby chimney with a yellow glow at its mouth.
        hopper((0.38, 1.5), roof, 0.1, 0.22, 0.2)
        kit.cylinder("DARK_TRIM", (1.66, 1.6), 0.15, roof, roof + 0.2, sides=12)
        kit.cylinder("LIGHT_YELLOW", (1.66, 1.6), 0.09, roof + 0.16, roof + 0.26, sides=12)
        # A second stripe lower down, so the upgrade shows from the side as well.
        kit.box(trim, (0.12, 0.22, 0.7), (1.53, 1.78, 0.78))
    else:
        # Vents and a chimney on the roof.
        kit.box("DARK_TRIM", (0.24, 1.5, roof), (0.6, 1.58, roof + 0.06))
        kit.box("DARK_TRIM", (0.24, 1.62, roof), (0.6, 1.7, roof + 0.06))
        kit.cylinder("DARK_TRIM", (1.66, 1.6), 0.1, roof, roof + 0.3, sides=12)

    # The chute, sloping down to the east, and the bin of ingots under its end.
    kit.box("HULL_SHADE", (1.42, 0.98, 0.34), (1.96, 1.34, 0.46), rotation=(0, 25, 0))
    kit.box("DARK_TRIM", (1.6, 0.92, 0.1), (1.94, 1.4, 0.2))
    kit.box("FOIL_GOLD", (1.68, 1.0, 0.18), (1.9, 1.12, 0.27))
    kit.box("FOIL_GOLD", (1.68, 1.2, 0.18), (1.9, 1.32, 0.25))

    # Four doors, one in the middle of each side, where the game puts the doorways.
    kit.doors(2, 2)


if __name__ == "__main__":
    kit.begin(era=1, name="ore_processor")
    parts()
    kit.finish(era=1, cells_x=2, cells_y=2, layers=20)
