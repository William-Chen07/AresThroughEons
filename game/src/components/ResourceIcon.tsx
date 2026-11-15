import { Apple, Droplet, Mountain, Smile, Snowflake, Wind, Zap, type LucideIcon } from "lucide-react"
import type { ResourceId } from "@/content/resources"

/*
 * The icon for each resource, tinted with its colour from content/resources.ts.
 * Typed against ResourceId, so adding a resource there without an icon here is
 * a type error. Icons are from Lucide (ISC licence), already a dependency.
 */
const ICONS: Record<ResourceId, LucideIcon> = {
  oxygen: Wind, // air to breathe
  water: Droplet,
  food: Apple,
  power: Zap,
  ice: Snowflake,
  regolith: Mountain, // the soil and rock of Mars
  morale: Smile,
}

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`

export function ResourceIcon({ id, color, className = "size-4" }: { id: ResourceId; color: number; className?: string }) {
  const Icon = ICONS[id]
  return <Icon aria-hidden className={`shrink-0 ${className}`} style={{ color: hex(color) }} strokeWidth={2.25} />
}
