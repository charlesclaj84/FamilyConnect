'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Pin, PinOff, Trash2 } from 'lucide-react'
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
import { useT } from '@/components/layout/LocaleProvider'

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
 *
 * ── AND THEY NO LONGER WEAR THE SAME GLYPH, 2026-08-22 ─────────────────────────────
 * Both were `Pin`/`PinOff` in the same corner, one tinted accent and one `on-soft`, which was
 * reported as indistinguishable and was: two pins side by side read as one control drawn
 * twice, and the only thing telling them apart was a `title` nobody hovers on a phone.
 *
 * THE ADMINISTRATOR'S KEEPS THE PIN, because pinning is what it does — it moves a flag on the
 * row and every member's copy of the board moves with it. THE MEMBER'S IS AN EYE, because
 * showing and hiding is what it does: `announcement_unpins` records that THIS reader has taken
 * a notice off the top of their own updates, and nothing about the family's flag changes.
 *
 * That reframing also answers the second half of the same report — "pinning for myself only
 * appears after pinning for everybody". It is not a second pin that goes missing; it is a
 * per-reader HIDE, and there is nothing to hide from the top of your updates until the family
 * has put something there. Said as a pin the absence looks like a bug, said as an eye it is
 * the only thing it could be. The board says it in words too, under any pinned notice.
 *
 * A REAL PERSONAL PIN — one that lifts a notice nobody pinned to the top of your own updates —
 * is a different feature and is deliberately not this. `announcement_unpins` can only record a
 * dismissal, so it would take a table, and it would put a member's own ordering in front of an
 * administrator's on a board whose whole point is that the family decides what rides at the
 * top.
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
  const t = useT()
  const router = useRouter()
  const confirm = useConfirm()
  const [announcements, setAnnouncements] = useServerState(initialAnnouncements)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const mayDelete = (a: Announcement): boolean =>
    deleteScope === 'any' || (deleteScope === 'own' && Boolean(myPersonId) && a.author_id === myPersonId)

  async function handleDelete(a: Announcement) {
    const ok = await confirm({
      title: t('ann.deleteTitle'),
      description: t('ann.deleteNamedBody', { title: a.title }),
      confirmLabel: t('action.delete'),
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const r = await deleteAnnouncement(a.id)
      if (!r.success) { setError(r.message ?? t('ann.deleteFailed')); return }
      setAnnouncements(prev => prev.filter(x => x.id !== a.id))
      router.refresh()
    })
  }

  async function handleTogglePin(a: Announcement) {
    const ok = await confirm({
      title: a.pinned ? t('ann.unpinAll') : t('ann.pinAll'),
      description: a.pinned
        ? t('ann.unpinNamedBody', { title: a.title })
        : t('ann.pinNamedBody', { title: a.title }),
      confirmLabel: t(a.pinned ? 'ann.unpin' : 'ann.pin'),
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const r = await togglePinAnnouncement(a.id, !a.pinned)
      if (!r.success) { setError(r.message ?? t('ann.pinFailed')); return }
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
        setError(r.message ?? t('ann.pinFailed'))
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
        <p className="py-8 text-center text-sm text-muted-foreground">{t('ann.none')}</p>
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
                    {/* ── EVERY MEMBER'S OWN VIEW OF A PINNED NOTICE ────────────────
                        Offered whenever the FAMILY has it pinned and in date, which is what
                        `pin_active` answers — there is nothing to hide from the top of your
                        updates until the family has put something there, and a client cannot
                        decide "still in date" without reading the clock during render.

                        The same control, the same two captions and the same glyphs as
                        `RecentUpdates`, deliberately: it is one act and a member should not
                        have to learn it twice. Change one and change the other. */}
                    {a.pin_active && (
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        disabled={isPending}
                        onClick={() => handlePinForMe(a)}
                        aria-label={t(a.pinnedForMe
                          ? 'ann.hideFromMyUpdates'
                          : 'ann.showInMyUpdates', { title: a.title })}
                        title={a.pinnedForMe
                          ? t('dash.updates.unpin')
                          : t('dash.updates.pin')}
                      >
                        {a.pinnedForMe
                          ? <Eye className="h-3.5 w-3.5 text-brand-accent" />
                          : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                      </Button>
                    )}
                    {/* ── THE FAMILY'S PIN, AND IT KEEPS THE PIN GLYPH ─────────────
                        Filled and accent-coloured while it is ON, plain while it is off, so the
                        state is readable without hovering — and so it can never be mistaken for
                        the eye beside it. */}
                    {showPin && (
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        disabled={isPending}
                        onClick={() => handleTogglePin(a)}
                        aria-label={t(a.pinned
                          ? 'ann.unpinForEveryone'
                          : 'ann.pinForEveryone', { title: a.title })}
                        title={a.pinned ? t('ann.unpinAll') : t('ann.pinAll')}
                      >
                        {a.pinned
                          ? <PinOff className="h-3.5 w-3.5 text-brand-accent" />
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
                        title={t('action.delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                </div>

                {/* WHAT THE TWO CONTROLS HAVE DONE, said out loud, and now in BOTH states.
                    It said the dismissed half only, so a member who had NOT hidden a notice saw
                    two similar glyphs in the corner with nothing anywhere explaining that one
                    was the family's decision and the other was their own — which is half of why
                    they read as one control drawn twice. */}
                {a.pin_active && (
                  <p className="mt-1.5 px-1 text-xs text-muted-foreground">
                    {a.pinnedForMe
                      ? t('ann.pinnedRides')
                      : t('ann.pinnedHidden')}
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
