"""
E3-4 Advanced Research Lab: 3x2 cells, 26 layers. The Era 1 Research Lab, upgraded for faster
research.

The same capsule with a second, smaller capsule stacked on top, a large gold dish in place
of the small grey one, and a gold trim line along its side. It is built from the Era 1
script's own shapes (era1_research.parts), so a change to the original carries over.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import era1_research as lab  # noqa: E402

kit.begin(era=3, name="research_pro")
lab.parts(pro=True)

# The second capsule, resting on the first, with its own window and gold rings at its ends.
UPPER_Z, UPPER_Y, UPPER_TALL = 1.3, 0.46, 0.22
lab.capsule(0.95, 2.05, 0.3, mid_z=UPPER_Z, reach_y=UPPER_Y, reach_z=UPPER_TALL, detail=8)
lab.hoop("FOIL_GOLD", 0.9, 1.02, grow=0.03, mid_z=UPPER_Z, reach_y=UPPER_Y, reach_z=UPPER_TALL)
lab.hoop("FOIL_GOLD", 1.98, 2.1, grow=0.03, mid_z=UPPER_Z, reach_y=UPPER_Y, reach_z=UPPER_TALL)
kit.box("GLASS_TEAL", (1.14, 0.56, 1.32), (1.86, 0.76, 1.45))

# The gold trim line along the lower capsule's south side.
kit.box("FOIL_GOLD", (0.62, 0.17, 0.5), (2.38, 0.32, 0.58))

# The large gold dish on top, looking up at the sky.
kit.cylinder("METAL_GREY", (1.5, 1.0), 0.07, 1.48, 1.54, sides=8)
kit.cylinder("FOIL_GOLD", (1.5, 1.0), 0.08, 1.5, 1.61, top_radius=0.36, sides=16)
kit.cylinder("DARK_TRIM", (1.5, 1.0), 0.06, 1.56, 1.62, sides=8)

kit.finish(era=3, cells_x=3, cells_y=2, layers=26)
