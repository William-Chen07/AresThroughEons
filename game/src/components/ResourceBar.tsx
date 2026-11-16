import { useState } from "react";
import { ResourceIcon } from "@/components/ResourceIcon";
import {
  RESOURCE_TYPES,
  type ResourceId,
  type Resources,
} from "@/content/resources";

/*
 * The base's resources in one row along the top right of the base map. It
 * only shows the amounts kept in the save; nothing
 * makes or uses resources yet. Resting the pointer on a resource (or moving to
 * it with the Tab key) opens a short card: what it is and why it matters on a
 * NASA mission to Mars. The card is opened from code, not with a CSS hover
 * rule, so that a tap opens it on a touch screen too. The look copies the
 * other map panels. The minerals mined from deposits (see sim/deposits.ts) get a
 * row of their own under the supplies.
 */

const SUPPLIES = RESOURCE_TYPES.filter((type) => !("mineral" in type));
const MINERALS = RESOURCE_TYPES.filter((type) => "mineral" in type);
export function ResourceBar({ resources }: { resources: Resources }) {
  /** The resource whose card is open. */
  const [openId, setOpenId] = useState<ResourceId | null>(null);
  const close = (id: ResourceId) =>
    setOpenId((current) => (current === id ? null : current));

  const row = (types: typeof RESOURCE_TYPES[number][], label: string) => (
    <ul
      aria-label={label}
      className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1"
    >
      {types.map((type, i) => (
        <li
          key={type.id}
          tabIndex={0}
          aria-describedby={`resource-${type.id}-about`}
          onPointerEnter={() => setOpenId(type.id)}
          onPointerLeave={() => close(type.id)}
          onFocus={() => setOpenId(type.id)}
          onBlur={() => close(type.id)}
          className="relative flex cursor-help items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
        >
          <ResourceIcon id={type.id} color={type.color} />
          <span
            className={`text-xs font-semibold uppercase tracking-[0.15em] ${openId === type.id ? "text-white/90" : "text-white/50"} transition`}
          >
            {type.name}
          </span>
          <span className="text-xs font-semibold tabular-nums">
            {Math.ceil(resources[type.id])}
          </span>
          {/* The card hangs under the resource; the ones on the right open leftwards so they stay on screen. */}
          <div
            id={`resource-${type.id}-about`}
            role="tooltip"
            className={`pointer-events-none absolute top-full z-20 mt-4 w-72 border border-white/15 bg-neutral-950/95 p-4 text-left ${openId === type.id ? "" : "hidden"} ${i < types.length / 2 ? "left-0" : "right-0"}`}
          >
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-orange-300/90">
              <ResourceIcon id={type.id} color={type.color} />
              {type.name}
            </p>
            <p className="mt-2 text-sm text-white/90">{type.what}</p>
            <p className="mt-2 text-xs leading-relaxed text-white/60">
              {type.why}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-1 border border-white/15 bg-neutral-950/80 px-3 py-2 backdrop-blur-sm">
      {row(SUPPLIES, "Resources")}
      {row(MINERALS, "Minerals")}
    </div>
  );
}
