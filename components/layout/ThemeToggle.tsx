'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { THEME_STORAGE_KEY, type Theme } from '@/lib/theme'

const ORDER: readonly Theme[] = ['light', 'dark', 'system']

const META: Record<Theme, { icon: typeof Sun; label: string }> = {
  light: { icon: Sun, label: 'Light' },
  dark: { icon: Moon, label: 'Dark' },
  system: { icon: Monitor, label: 'System' },
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** Fired when THIS tab changes the theme; `storage` only notifies OTHER tabs. */
const THEME_EVENT = 'genorra:themechange'

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

function readPreference(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : 'system'
  } catch {
    // localStorage throws outright in Safari private mode and some webviews.
    return 'system'
  }
}

/**
 * The store snapshot: preference AND resolved appearance, in one string.
 *
 * Both halves are needed and the string keeps them referentially stable, which
 * `useSyncExternalStore` requires — returning a fresh object here would re-render
 * forever. The resolved half is what makes "System" live: when the OS flips at
 * sunset the preference is still `system`, so a snapshot of the preference alone
 * would not change and nothing would repaint.
 */
function getSnapshot(): string {
  const preference = readPreference()
  const dark =
    preference === 'dark' ||
    (preference === 'system' && window.matchMedia(DARK_QUERY).matches)
  return `${preference}|${dark ? 'dark' : 'light'}`
}

/** The server has no OS and no storage; `system`/light is the honest default. */
function getServerSnapshot(): string {
  return 'system|light'
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(DARK_QUERY)
  window.addEventListener('storage', onChange)
  window.addEventListener(THEME_EVENT, onChange)
  mq.addEventListener('change', onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(THEME_EVENT, onChange)
    mq.removeEventListener('change', onChange)
  }
}

/**
 * The appearance control: Light → Dark → System, one click apart.
 *
 * THREE states rather than a two-way switch, because "system" is a real answer
 * and a binary toggle cannot express it. A member whose OS is on a sunrise
 * schedule wants the app to follow; collapsing that to on/off would pin them to
 * whichever one they last touched.
 *
 * Built on `useSyncExternalStore` rather than `useState` + `useEffect`. The
 * theme lives outside React — in `localStorage`, in the OS, and on the `<html>`
 * element that the boot script already set before React existed — and this is
 * the hook for exactly that. It also avoids the two traps of the obvious
 * implementation: reading `localStorage` during render is a hydration mismatch
 * (the server cannot know it), and correcting it from an effect is a cascading
 * render that React Compiler rejects.
 *
 * The size is fixed across all three states so the row beside it never jumps.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [preference, resolved] = snapshot.split('|') as [Theme, 'light' | 'dark']

  // Push the resolved appearance onto the document. This is the legitimate use
  // of an effect — syncing an external system to React state — and it is what
  // keeps "System" honest after an OS flip. It re-runs only when `resolved`
  // actually changes, and it is idempotent, so agreeing with the boot script on
  // first mount costs nothing.
  useEffect(() => {
    const dark = resolved === 'dark'
    document.documentElement.classList.toggle('dark', dark)
    // Keeps native UI — scrollbars, date pickers, autofill — in the same theme
    // as the page. Without it a dark page renders a bright white scrollbar.
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [resolved])

  const cycle = useCallback(() => {
    const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length]
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Not persisting is survivable; the event below still applies it now.
    }
    // `storage` does not fire in the tab that wrote it, so tell ourselves.
    window.dispatchEvent(new Event(THEME_EVENT))
  }, [preference])

  const Icon = META[preference].icon
  const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length]

  return (
    <button
      type="button"
      onClick={cycle}
      // The label names the CURRENT state and the destination, because an icon
      // button that only says "Dark" is ambiguous about whether that is what it
      // is or what it does.
      aria-label={`Appearance: ${META[preference].label}. Switch to ${META[next].label}.`}
      title={`Appearance: ${META[preference].label}`}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
        'text-brand-ink transition-colors hover:bg-brand-primary/10',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  )
}
