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
  unpinAnnouncementForMe, repinAnnouncementForMe,
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
 *
 * ── TWO PIN CONTROLS, AND THEY ARE TWO DIFFERENT ACTS ──────────────────────────────
 * Added 2026-08-21, because this screen and the Dashboard's Recent Updates were reported as
 * out of sync — and they were, three ways:
 *
 *   * the board sorted and highlighted on `pinned`, the FAMILY's flag, while Recent Updates
 *     banded on `pinnedForMe`. A member who dismissed a notice saw it drop out of the band on
 *     one screen and stay at the top with a pin on the other. Same rows, same reader, two
 *     answers.
 *   * the only pin control here was the administrator's "for everyone". A member could dismiss
 *     a notice from the Dashboard and had no way to do it, or undo it, from the board — and an
 *     administrator pressing the one button they had was changing it for the whole family
 *     while believing they were tidying their own view.
 *   * `unpinAnnouncementForMe` revalidated `/dashboard` alone, so even a correct render here
 *     would have been stale until something else invalidated the page.
 *
 * All three are fixed, and the two acts are now two buttons with two captions. The
 * administrator's says "for everyone" and moves `announcements.pinned`; every member's says
 * "for me" and writes a row in `announcement_unpins`. They are deliberately not merged: one is
 * a decision about the family and the other is a preference, and a single toggle that meant
 * either depending on your grants is the thing that was confusing.
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

  /**
   * Dismiss a pinned notice from MY top, or put it back.
   *
   * No confirmation, unlike the family-wide toggle: this changes one reader's own ordering and
   * the same button undoes it. `useConfirm` is for a decision somebody else lives with.
   *
   * OPTIMISTIC, and then `router.refresh()`. The optimistic flip is what makes the button feel
   * like a toggle rather than a request; the refresh is what re-sorts the list, since pinned
   * rows ride at the top and this changes which ones do. `useServerState` is what lets the
   * server's answer land on top of the optimistic one instead of being ignored.
   */
  function handlePinForMe(a: Announcement) {
    const next = !a.pinnedForMe
    setAnnouncements(prev => prev.map(x => x.id === a.id ? { ...x, pinnedForMe: next } : x))
    setError('')
    startTransition(async () => {
      const r = next ? await repinAnnouncementForMe(a.id) : await unpinAnnouncementForMe(a.id)
      if (!r.success) {
        setError(r.message ?? 'Could not change that pin.')
        // Rolled back, because the refusal is not always transient — the announcement may
        // have been unpinned family-wide since this page rendered, and leaving the marker
        // flipped would tell the reader something that is not true of their own list.
        setAnnouncements(prev => prev.map(x => x.id === a.id ? { ...x, pinnedForMe: !next } : x))
        return
      }
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

                <div className="absolute right-3 top-3 flex gap-1">
                    {/* ── EVERY MEMBER'S OWN PIN ─────────────────────────────────────
                        Offered whenever the FAMILY has it pinned and in date, which is what
                        `pin_active` answers — there is nothing to dismiss or restore on a
                        notice nobody pinned, and a client cannot decide "still in date"
                        without reading the clock during render.

                        The same control, the same two captions and the same glyphs as
                        `RecentUpdates`, deliberately: it is one act and a member should not
                        have to learn it twice. */}
                    {a.pin_active && (
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        disabled={isPending}
                        onClick={() => handlePinForMe(a)}
                        aria-label={a.pinnedForMe
                          ? `Stop pinning “${a.title}” to the top of your updates`
                          : `Pin “${a.title}” back to the top of your updates`}
                        title={a.pinnedForMe
                          ? 'Stop pinning this to the top — for me'
                          : 'Pin this back to the top — for me'}
                      >
                        {a.pinnedForMe
                          ? <PinOff className="h-3.5 w-3.5" />
                          : <Pin className="h-3.5 w-3.5 text-brand-accent" />}
                      </Button>
                    )}
                    {showPin && (
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        disabled={isPending}
                        onClick={() => handleTogglePin(a)}
                        aria-label={a.pinned ? `Unpin “${a.title}” for everyone` : `Pin “${a.title}” for everyone`}
                        title={a.pinned ? 'Unpin for everyone' : 'Pin for everyone'}
                      >
                        {a.pinned
                          ? <PinOff className="h-3.5 w-3.5 text-brand-on-soft" />
                          : <Pin className="h-3.5 w-3.5 text-brand-on-soft" />}
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

                {/* WHY IT IS NOT AT THE TOP, said out loud. Without this a member who
                    dismissed a notice sees an ordinary card and no explanation, and the pin
                    button beside it reads as broken. */}
                {a.pin_active && !a.pinnedForMe && (
                  <p className="mt-1.5 px-1 text-xs text-muted-foreground">
                    Pinned for the family — you have dismissed it from the top of your updates.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
