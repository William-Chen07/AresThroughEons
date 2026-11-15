import { useRef, type ReactNode } from "react"
import { Hammer, Rocket, RotateCcw, ShieldAlert, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { CODEX } from "@/content/codex"
import { useSettings } from "@/lib/settings"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function MenuDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: DialogProps & { title: string; description?: string; children: ReactNode }) {
  // Focus the title on open so long dialogs start at the top, not scrolled to the Close button.
  const titleRef = useRef<HTMLHeadingElement>(null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus={titleRef}
        className="max-h-[calc(100dvh-2rem)] [&>[data-slot=dialog-close]]:size-11 overflow-y-auto border border-border p-6 sm:max-w-lg sm:p-8">
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1} className="text-3xl font-semibold text-mars outline-none">
            {title}
          </DialogTitle>
          {description && <DialogDescription className="text-base">{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter>
          <DialogClose render={<Button size="lg" className="h-12 px-6 font-heading text-base" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Rocket, title: "Land", text: "Pick a landing spot on Mars and set down your lander." },
  {
    icon: Hammer,
    title: "Build",
    text: "Drill ice for water, grow food and make oxygen to breathe. All three need water, so every choice costs something!",
  },
  {
    icon: ShieldAlert,
    title: "Stay safe",
    text: "Dust storms and solar flares can strike. A solar flare sends out radiation, invisible energy from the Sun that can hurt your body, so your crew must take cover.",
  },
  {
    icon: RotateCcw,
    title: "Come back stronger",
    text: "When a mission ends, your crew flies home with what fits in the ship. Next time, in a new era, you return with new tech.",
  },
]

export function HowToPlayDialog(props: DialogProps) {
  return (
    <MenuDialog
      {...props}
      title="How to Play"
      description="You lead a team of astronauts on Mars. Keep them safe, learn about Mars and get ready for the next mission!"
    >
      <ol className="grid gap-4">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="flex gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Icon className="size-6" aria-hidden />
            </span>
            <div>
              <p className="font-heading text-lg font-semibold">
                {i + 1}. {title}
              </p>
              <p className="text-base text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="rounded-2xl bg-muted p-4 text-base">
        <strong className="font-heading">Did you know?</strong> A day on Mars is called a <em>sol</em>. It
        is about 40 minutes longer than a day on Earth.
      </p>
    </MenuDialog>
  )
}

export function SettingsDialog(props: DialogProps) {
  const muted = useSettings((s) => s.muted)
  const musicVolume = useSettings((s) => s.musicVolume)
  const sfxVolume = useSettings((s) => s.sfxVolume)
  const setSettings = useSettings((s) => s.setSettings)
  const toNumber = (value: number | readonly number[]) => (Array.isArray(value) ? value[0] : value) as number

  return (
    <MenuDialog {...props} title="Settings">
      <div className="grid gap-6 text-base">
        <label className="flex items-center justify-between gap-4 font-heading text-lg">
          Sound
          <Switch checked={!muted} onCheckedChange={(on) => setSettings({ muted: !on })} />
        </label>
        <div className="grid gap-3">
          <span className="font-heading text-lg" id="music-volume">
            Music volume
          </span>
          <Slider
            aria-labelledby="music-volume"
            disabled={muted}
            value={[Math.round(musicVolume * 100)]}
            onValueChange={(v) => setSettings({ musicVolume: toNumber(v) / 100 })}
          />
        </div>
        <div className="grid gap-3">
          <span className="font-heading text-lg" id="sfx-volume">
            Button sounds
          </span>
          <Slider
            aria-labelledby="sfx-volume"
            disabled={muted}
            value={[Math.round(sfxVolume * 100)]}
            onValueChange={(v) => setSettings({ sfxVolume: toNumber(v) / 100 })}
          />
        </div>
      </div>
    </MenuDialog>
  )
}

const linkClass = "text-primary underline underline-offset-2"

export function CreditsDialog(props: DialogProps) {
  // TODO(team): confirm the exact credit lines for each audio file.
  return (
    <MenuDialog {...props} title="Credits">
      <ul className="grid gap-3 text-base text-muted-foreground">
        <li>Made by our team for the 2026 NASA Space Apps Challenge.</li>
        <li>
          Mars globe: Viking MDIM 2.1 colour mosaic, NASA/JPL/USGS, from{" "}
          <a href="https://trek.nasa.gov/mars/" target="_blank" rel="noreferrer" className={linkClass}>
            NASA Mars Trek
          </a>
          .
        </li>
        <li>
          Mars facts:{" "}
          <a href="https://science.nasa.gov/mars/" target="_blank" rel="noreferrer" className={linkClass}>
            NASA Science
          </a>
          , plus the Perseverance and Curiosity mission pages.
        </li>
        <li>Space sounds: NASA sonifications, which turn real space images (like nebula NGC 2392) into sound.</li>
        <li>Music: tracks by leberch and jonasblakewood on Pixabay.</li>
      </ul>
    </MenuDialog>
  )
}

export function CodexDialog({ codexIds, ...props }: DialogProps & { codexIds: string[] }) {
  const found = CODEX.filter((entry) => codexIds.includes(entry.id))
  return (
    <MenuDialog
      {...props}
      title="Mars Codex"
      description={`Real NASA facts your crew has discovered: ${found.length} of ${CODEX.length}.`}
    >
      {found.length === 0 ? (
        <p className="text-base text-muted-foreground">
          No facts yet. Explore Mars on your missions to fill your Codex!
        </p>
      ) : (
        <ul className="grid gap-4">
          {found.map((entry) => (
            <li key={entry.id} className="rounded-2xl bg-muted p-4">
              <p className="font-heading text-lg font-semibold">{entry.title}</p>
              <p className="text-base text-muted-foreground">{entry.text}</p>
              <a href={entry.source.url} target="_blank" rel="noreferrer" className={`text-sm ${linkClass}`}>
                Source: {entry.source.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </MenuDialog>
  )
}
