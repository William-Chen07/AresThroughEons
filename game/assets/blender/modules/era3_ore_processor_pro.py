"""
E3-3 Ore Processor Pro: 2x2 cells, 24 layers. The Era 1 Ore Processor, upgraded: faster, and
it also yields titanium and sulfur.

The same furnace made four layers taller, with red trim, a second smaller hopper, and a
stubby chimney with a yellow glow at the top. It is built from the Era 1 script's own shapes
(era1_ore_processor.parts), so a change to the original carries over to the upgrade.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import era1_ore_processor  # noqa: E402

kit.begin(era=3, name="ore_processor_pro")
era1_ore_processor.parts(lift=0.25, trim="ACCENT_RED", pro=True)
kit.finish(era=3, cells_x=2, cells_y=2, layers=24)
