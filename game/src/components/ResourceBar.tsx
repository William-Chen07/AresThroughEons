import { useState } from "react";
import { ResourceIcon } from "@/components/ResourceIcon";
import {
  BASE_RESOURCES,
  type ResourceId,
  type Resources,
} from "@/content/resources";

/*
 * The base's supplies in one row along the top right of the base map (the
 * raw materials dug out of Mars are in the backpack instead). It
 * only shows the amounts kept in the save; nothing
 * makes or uses resources yet. Resting the pointer on a resource (or moving to
 * it with the Tab key) opens a short card: what it is and why it matters on a
 * NASA mission to Mars. The card is opened from code, not with a CSS hover
 * rule, so that a tap opens it on a touch screen too. The look copies the
 * other map panels.
 */
/** Oxygen is left off the bar: the base still has it and the crew still breathe it, it just isn't shown here. */
const SHOWN = BASE_RESOURCES.filter((type) => type.id !== "oxygen");

export function ResourceBar({ resources }: { resources: Resources }) {
  /** The resource whose card is open. */
  const [openId, setOpenId] = useState<ResourceId | null>(null);
  const close = (id: ResourceId) =>
    setOpenId((current) => (current === id ? null : current));

  return (
    <ul
      aria-label="Resources"
      className="pointer-events-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1 holo-surface holo-frame border border-cyan-300/25 px-3 py-2 backdrop-blur-sm"
    >
      {SHOWN.map((type, i) => (
        <li
          key={type.id}
          tabIndex={0}
          aria-describedby={`resource-${type.id}-about`}
          onPointerEnter={() => setOpenId(type.id)}
          onPointerLeave={() => close(type.id)}
          onFocus={() => setOpenId(type.id)}
          onBlur={() => close(type.id)}
          className="relative flex cursor-help items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
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
            className={`pointer-events-none absolute top-full z-20 mt-4 w-72 border border-cyan-300/25 holo-surface p-4 text-left ${openId === type.id ? "" : "hidden"} ${i < SHOWN.length / 2 ? "left-0" : "right-0"}`}
          >
            <p className="flex items-center gap-2 holo-text text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/90">
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
}
