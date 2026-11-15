import { cn } from "@/lib/utils"

/**
 * Mission-patch style logo, drawn as SVG so it stays crisp at any size.
 * The three stars stand for the game's three eras.
 */
export function MissionPatch({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 260"
      role="img"
      aria-label="Ares Through Eons mission patch"
      className={cn("drop-shadow-[0_8px_30px_rgba(249,115,22,0.35)]", className)}
    >
      <defs>
        <radialGradient id="patch-mars" cx="38%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="45%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </radialGradient>
        <radialGradient id="patch-space" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#0b0a1f" />
        </radialGradient>
        {/* Text arcs: top reads clockwise, bottom counter-clockwise so both stay upright. */}
        <path id="patch-top-arc" d="M 34 130 A 96 96 0 0 1 226 130" />
        <path id="patch-bottom-arc" d="M 22 130 A 108 108 0 0 0 238 130" />
      </defs>

      {/* Border rings */}
      <circle cx="130" cy="130" r="126" fill="#13122a" stroke="#f97316" strokeWidth="6" />
      <circle cx="130" cy="130" r="113" fill="none" stroke="#2dd4bf" strokeWidth="2.5" />
      <circle cx="130" cy="130" r="86" fill="url(#patch-space)" stroke="#2dd4bf" strokeWidth="2" />

      {/* Background stars */}
      {[
        [82, 92, 1.4],
        [176, 84, 1.2],
        [190, 118, 1.6],
        [72, 150, 1.1],
        [160, 196, 1.3],
        [96, 190, 1],
      ].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#fff7ed" opacity="0.8" />
      ))}

      {/* Era stars */}
      {[100, 130, 160].map((x, i) => (
        <polygon
          key={x}
          transform={`translate(${x} ${i === 1 ? 66 : 72}) scale(${i === 1 ? 1.15 : 0.95})`}
          points="0,-9 2.6,-3 9,-2.8 4,1.6 5.6,8 0,4.4 -5.6,8 -4,1.6 -9,-2.8 -2.6,-3"
          fill="#facc15"
        />
      ))}

      {/* Orbit (back half), Mars, orbit (front half) with the lander riding it */}
      <g transform="rotate(-15 130 142)">
        <path d="M 56 142 A 74 20 0 0 1 204 142" fill="none" stroke="#2dd4bf" strokeWidth="3" opacity="0.55" />
      </g>
      <circle cx="130" cy="142" r="44" fill="url(#patch-mars)" />
      <ellipse cx="114" cy="130" rx="8" ry="5" fill="#9a3412" opacity="0.55" />
      <ellipse cx="146" cy="158" rx="11" ry="6" fill="#9a3412" opacity="0.5" />
      <ellipse cx="138" cy="124" rx="4" ry="3" fill="#9a3412" opacity="0.5" />
      <g transform="rotate(-15 130 142)">
        <path d="M 204 142 A 74 20 0 0 1 56 142" fill="none" stroke="#2dd4bf" strokeWidth="3.5" strokeLinecap="round" />
      </g>
      <g transform="translate(170 149) rotate(-24)">
        <path d="M -9 -6 L 6 -6 L 12 0 L 6 6 L -9 6 Z" fill="#f4f1ea" />
        <path d="M -9 -6 L -14 -11 L -6 -6 Z M -9 6 L -14 11 L -6 6 Z" fill="#f97316" />
        <circle cx="3" cy="0" r="2.4" fill="#2dd4bf" />
        <path d="M -9 -3 L -17 0 L -9 3 Z" fill="#facc15" />
      </g>

      <text
        fill="#fff7ed"
        fontSize="24"
        fontWeight="700"
        letterSpacing="3"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        <textPath href="#patch-top-arc" startOffset="50%" textAnchor="middle">
          ARES THROUGH EONS
        </textPath>
      </text>
      <text
        fill="#2dd4bf"
        fontSize="14"
        fontWeight="600"
        letterSpacing="4"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        <textPath href="#patch-bottom-arc" startOffset="50%" textAnchor="middle">
          SPACE APPS · 2026
        </textPath>
      </text>
    </svg>
  )
}
