'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pin, PinOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { useServerState } from '@/lib/use-server-state'
import { AnnouncementCard } from '@/components/announcements/AnnouncementCard'
import { NewAnnouncementForm } from '@/components/announcements/NewAnnouncementForm'
import {
  deleteAnnouncement, togglePinAnnouncement,
  type Announcement, type Chapter,
} from '@/app/actions/announcements'
import type { PermissionScope } from '@/lib/auth/permissions'

/**
 * The board: compose at the top, then every post with the controls the caller may use.
 *
 * IT REPLACES `AdminAnnouncementsClient`, which is deleted. That component was a second
 * composer and a second list over the same rows, and the two had already drifted — the
 * admin one could set a pin expiry and the member one could not, while the member one
 * had the audience segmented control and the admin one a plain `<select>`. One screen
 * cannot drift from itself.
 *
 * THE THREE RIGHTS ARRIVE AS PROPS and are resolved on the server (see the page). They
 * decide affordances only: `togglePinAnnouncement` runs `requireEdit` and
 * `deleteAnnouncement` runs `requireOwn` against the author id the DATABASE holds, so
 * nothing here is load-bearing for authorization. What it is load-bearing for is not
 * showing somebody a button that will refuse them.
 *
 * `useServerState`, not `useState`: a plain initializer reads the prop once and then
 * ignores every later server render — including the `router.refresh()` this component
 * triggers itself after a delete.
 */
export function AnnouncementBoard({
  initialAnnouncements, chapters, canPost, canPin, deleteScope, myPersonId,
}: {
  initialAnnouncements: Announcement[]
  chapters: Chapter[]
  /** May post at all. A family can switch this off for ordinary members. */
  canPost: boolean
  /** May pin family-wide — `announcements:edit` at scope 'any'. */
  canPin: boolean
  /** 'none', 'own' (their own posts) or 'any'. */
  deleteScope: PermissionScope
  /** The caller's people.id in this family, for the 'own' case. */
  myPersonId: string
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [announcements, setAnnouncements] = useServerState(initialAnnouncements)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const mayDelete = (a: Announcement): boolean =>
    deleteScope === 'any' || (deleteScope === 'own' && Boolean(myPersonId) && a.author_id === myPersonId)

  async function handleDelete(a: Announcement) {
    const ok = await confirm({
      title: 'Delete announcement',
      description: `Delete “${a.title}”? Members will no longer see it, on the board or in their updates. This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const r = await deleteAnnouncement(a.id)
      if (!r.success) { setError(r.message ?? 'Could not delete that announcement.'); return }
      setAnnouncements(prev => prev.filter(x => x.id !== a.id))
      router.refresh()
    })
  }

  async function handleTogglePin(a: Announcement) {
    const ok = await confirm({
      title: a.pinned ? 'Unpin for everyone' : 'Pin for everyone',
      description: a.pinned
        ? `Unpin “${a.title}”? It stays on this board and stops riding at the top of everyone’s Recent Updates.`
        : `Pin “${a.title}” to the top of every member’s Recent Updates? Each of them can dismiss it for themselves afterwards.`,
      confirmLabel: a.pinned ? 'Unpin' : 'Pin',
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const r = await togglePinAnnouncement(a.id, !a.pinned)
      if (!r.success) { setError(r.message ?? 'Could not change that pin.'); return }
      setAnnouncements(prev => prev.map(x => x.id === a.id ? { ...x, pinned: !a.pinned } : x))
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {canPost && <NewAnnouncementForm canPin={canPin} chapters={chapters} />}

      <FormError message={error} />

      {announcements.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No announcements yet.</p>
      ) : (
        <div className="space-y-4">
          {announcements.map(a => {
            const showPin = canPin
            const showDelete = mayDelete(a)
            return (
              <div key={a.id} className="relative">
                <AnnouncementCard announcement={a} />

                {a.chapter_name && (
                  <span className="absolute left-3 top-3 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-on-soft">
                    {a.chapter_name}
                  </span>
                )}

                {(showPin || showDelete) && (
                  <div className="absolute right-3 top-3 flex gap-1">
                    {showPin && (
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        disabled={isPending}
                        onClick={() => handleTogglePin(a)}
                        aria-label={a.pinned ? `Unpin “${a.title}” for everyone` : `Pin “${a.title}” for everyone`}
                        title={a.pinned ? 'Unpin for everyone' : 'Pin for everyone'}
                      >
                        {a.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    {showDelete && (
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        disabled={isPending}
                        onClick={() => handleDelete(a)}
                        aria-label={`Delete “${a.title}”`}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
