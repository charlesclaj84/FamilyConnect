'use client'

import { useSyncExternalStore } from 'react'
import { X, Pin } from 'lucide-react'
import type { Announcement } from '@/app/actions/announcements'
import { formatDate } from '@/lib/date-utils'

const STORAGE_KEY = 'dismissed_announcements'

/**
 * The dismissed set lives in localStorage, which is outside React — so it is read with
 * `useSyncExternalStore`, not with `useState` plus an effect.
 *
 * Same reasoning as `ThemeToggle`, and AGENTS.md states it for that file: reading
 * localStorage during render is a hydration mismatch, and correcting it from an effect is
 * a cascading render that React Compiler rejects as an error. This is the third option —
 * React subscribes to the store and re-reads it when it changes.
 *
 * THE SNAPSHOT IS THE RAW STRING, deliberately. `useSyncExternalStore` compares snapshots
 * by identity, so returning `JSON.parse(...)` would hand back a new array on every call and
 * spin forever. The string is stable while the value is unchanged; parsing happens after.
 */
const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  // `storage` fires in OTHER tabs, so a dismissal on one dashboard reaches the rest.
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

const getSnapshot = (): string => localStorage.getItem(STORAGE_KEY) ?? '[]'

/** The server cannot know what this browser dismissed, so it renders everything. */
const getServerSnapshot = (): string => '[]'

function parseIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

function addDismissed(id: string): void {
  const current = parseIds(getSnapshot())
  if (!current.includes(id)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, id]))
  }
  // `storage` does not fire in the tab that wrote, so tell this one by hand.
  for (const listener of listeners) listener()
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return formatDate(iso) ?? ''
}

interface Props {
  announcements: Announcement[]
}

export function PinnedAnnouncementsBanner({ announcements }: Props) {
  const dismissed = parseIds(useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot))

  const visible = announcements.filter(a => !dismissed.includes(a.id))
  if (visible.length === 0) return null

  // No setState: the store is the state, and addDismissed notifies this tab's subscriber.
  const dismiss = (id: string) => addDismissed(id)

  return (
    <section className="space-y-3">
      {visible.map(a => (
        <div key={a.id} className="relative rounded-xl border border-primary/40 bg-primary/5 px-5 py-4">
          <div className="pr-6">
            <div className="flex items-start gap-1.5 mb-1">
              <Pin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <h3 className="font-semibold text-sm leading-tight">{a.title}</h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              {a.author_name && <span>{a.author_name}</span>}
              <span>·</span>
              <span>{formatRelative(a.published_at)}</span>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>
          </div>
          <button
            onClick={() => dismiss(a.id)}
            className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Dismiss announcement"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </section>
  )
}
