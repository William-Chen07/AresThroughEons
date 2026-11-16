"""
E1-3 Research Lab: 3x2 cells, 22 layers. Based on the workstations of NASA's Mars Dune Alpha.

A capsule lying on its side on a low grey base, with one long window strip, a sensor mast with
a small dish on the roof, and a stubby sample arm folded against the north side.

The collection is called "research" (the game's id for this module), so the files come out as
research_stack.png, which is the name the game looks for.

parts() builds the shapes, so the Era 3 upgrade (era3_research_pro.py) can build on the same
lab instead of copying it.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

# The capsule's middle line, and how far it reaches sideways (y) and up and down (z).
MID_Y, MID_Z = 1.0, 0.62
REACH_Y, REACH_Z = 0.8, 0.5


def hoop(material, x_from, x_to, grow=0.0, mid_z=MID_Z, reach_y=REACH_Y, reach_z=REACH_Z):
    """A slice of a capsule's round body between two x positions. `grow` makes it stand proud."""
    part = kit.cylinder(material, ((x_from + x_to) / 2, MID_Y), 1.0, mid_z - (x_to - x_from) / 2, mid_z + (x_to - x_from) / 2)
    # Tipped onto its side, the cylinder's own x points up and its y points across.
    part.rotation_euler = (0, 1.5707963, 0)
    part.scale = (reach_z + grow, reach_y + grow, 1)
    return part


def capsule(x_from, x_to, cap, mid_z=MID_Z, reach_y=REACH_Y, reach_z=REACH_Z, detail=16):
    """A white capsule lying along X: a round body from x_from to x_to with a rounded cap on each end."""
    hoop("HULL_WHITE", x_from, x_to, mid_z=mid_z, reach_y=reach_y, reach_z=reach_z)
    for x in (x_from, x_to):
        end = kit.sphere("HULL_WHITE", (x, MID_Y, mid_z), 1.0, detail=detail)
        end.scale = (cap, reach_y, reach_z)


def parts(pro=False):
    """The lab. `pro` leaves the roof clear of the small dish and box, for the upgrade to build on."""
    # The base: a grey slab, and a shaded cradle the capsule rests in.
    kit.box("METAL_GREY", (0.06, 0.16, 0.0), (2.94, 1.84, 0.12))
    kit.box("HULL_SHADE", (0.5, 0.45, 0.1), (2.5, 1.55, 0.4))

    # The capsule: a white body with a rounded cap on each end and an orange ring where they join.
    capsule(0.55, 2.45, 0.45)
    hoop("ACCENT_ORANGE", 0.5, 0.62, grow=0.04)
    hoop("ACCENT_ORANGE", 2.38, 2.5, grow=0.04)
    hoop("FOIL_GOLD", 1.38, 1.62, grow=0.03)

    # One long window strip along the south shoulder, in a dark frame.
    kit.box("DARK_TRIM", (0.72, 0.4, 0.84), (2.28, 0.66, 1.03))
    kit.box("GLASS_TEAL", (0.78, 0.37, 0.87), (2.22, 0.63, 1.06))

    if not pro:
        # On the roof: a sensor mast holding a small dish that looks up at the sky.
        kit.cylinder("METAL_GREY", (2.05, 1.15), 0.06, 1.05, 1.26, sides=8)
        kit.cylinder("HULL_SHADE", (2.05, 1.15), 0.06, 1.24, 1.34, top_radius=0.2, sides=16)
        kit.cylinder("ACCENT_ORANGE", (2.05, 1.15), 0.05, 1.3, 1.37, sides=8)
        kit.box("HULL_SHADE", (0.85, 0.9, 1.08), (1.15, 1.2, 1.18))
        kit.box("DARK_TRIM", (0.91, 0.96, 1.18), (1.09, 1.14, 1.22))

    # The sample arm, folded against the north side: a post, an upper arm, a forearm and an orange grabber.
    kit.box("METAL_GREY", (0.42, 1.68, 0.1), (0.56, 1.82, 1.0))
    kit.box("METAL_GREY", (0.42, 1.68, 0.88), (1.0, 1.82, 1.0))
    kit.box("METAL_GREY", (0.88, 1.68, 0.6), (1.0, 1.82, 1.0))
    kit.box("ACCENT_ORANGE", (0.74, 1.66, 0.54), (1.02, 1.84, 0.66))

    # Four doors, one in the middle of each side, where the game puts the doorways.
    # The capsule is round, so each door gets a short white porch joining it to the hull.
    kit.box("HULL_WHITE", (1.2, 0.18, 0.1), (1.8, 0.6, 0.86))
    kit.box("HULL_WHITE", (1.2, 1.4, 0.1), (1.8, 1.82, 0.86))
    kit.box("HULL_WHITE", (0.18, 0.2, 0.1), (0.7, 0.8, 0.86))
    kit.box("HULL_WHITE", (2.3, 0.2, 0.1), (2.82, 0.8, 0.86))
    kit.doors(3, 2, reach=0.22)


if __name__ == "__main__":
    kit.begin(era=1, name="research")
    parts()
    kit.finish(era=1, cells_x=3, cells_y=2, layers=22)
