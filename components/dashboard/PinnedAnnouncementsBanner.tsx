'use client'

import { useState, useEffect } from 'react'
import { X, Pin } from 'lucide-react'
import type { Announcement } from '@/app/actions/announcements'
import { formatDate } from '@/lib/date-utils'

const STORAGE_KEY = 'dismissed_announcements'

function getDismissed(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function addDismissed(id: string): void {
  const current = getDismissed()
  if (!current.includes(id)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, id]))
  }
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
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    setDismissed(getDismissed())
  }, [])

  const visible = announcements.filter(a => !dismissed.includes(a.id))
  if (visible.length === 0) return null

  function dismiss(id: string) {
    addDismissed(id)
    setDismissed(prev => [...prev, id])
  }

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
