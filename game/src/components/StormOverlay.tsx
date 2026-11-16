import { useMemo, type CSSProperties } from "react"
import type { WeatherId } from "@/content/weather"
import { stormCloudTile } from "@/map/stormClouds"

/*
 * What a storm looks like on the base map: a glow pulsing in from the edges of
 * the screen, and two layers of blocky cloud drifting across at different
 * speeds. A radiation storm is green; a solar storm is yellow and orange, like
 * the Sun that sent it. When the storm starts, all of it sweeps in from the
 * left. It sits over the map and under the panels, and lets clicks through.
 * The styles are in index.css (.storm-*).
 */

/** Each layer: how big one repeat of the cloud picture is on screen, how long one repeat takes to drift past, and which way. */
const LAYERS = [
  { tile: 768, seconds: 46, down: 0.5, opacity: 1 },
  { tile: 1248, seconds: 80, down: -0.25, opacity: 0.6 },
]

export function StormOverlay({ storm }: { storm: WeatherId }) {
  // Drawn once, when the storm starts.
  const clouds = useMemo(() => stormCloudTile(storm), [storm])
  return (
    <div aria-hidden className="storm-overlay" data-storm={storm}>
      {LAYERS.map((layer) => (
        <div
          key={layer.tile}
          className="storm-clouds"
          style={
            {
              "--storm-tile": `${layer.tile}px`,
              "--storm-down": `${layer.tile * layer.down}px`,
              backgroundImage: `url(${clouds})`,
              animationDuration: `${layer.seconds}s`,
              opacity: layer.opacity,
            } as CSSProperties
          }
        />
      ))}
      <div className="storm-glow" />
    </div>
  )
}
