'use client'

// ── A CLIENT COMPONENT, AND THE DIRECTIVE WAS MISSING UNTIL 2026-08-29 ──────────────────
// Its one caller is `AnnouncementBoard`, which is `'use client'` because it owns the pin and
// dismiss state — so this was already in the browser bundle and `useT()` worked. The line is
// here to keep it that way: without it, the first Server Component to render this card gets a
// client reference for `useT` and throws. The seven cards fixed alongside it took a `t` prop
// instead, because each of those genuinely renders from both sides; this one does not.
// `npm run audit:client-hooks` is the gate.

import Link from 'next/link'
import { ChevronRight, Pin, Vote } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { Announcement } from '@/app/actions/announcements'
import { formatDate } from '@/lib/date-utils'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

// TAKES `t` AND `intl` rather than reading a hook: it is a plain helper, not a component.
function formatRelative(iso: string, t: T, intl: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return t('common.today')
  if (days === 1) return t('common.yesterday')
  if (days < 7) return t('common.daysAgo', { n: days })
  return formatDate(iso, intl) ?? ''
}

/**
 * One announcement on the board.
 *
 * ── AN ELECTION NOTICE HAS SOMEWHERE TO GO, SINCE 2026-08-22 ──────────────
 * `announceElection` posts one of these on every publication and it was a dead end: it named
 * a ballot, said when nominations opened, and left the reader to find the election themselves
 * in Community > Elections. `announcements.election_id` (20260822000016) is what it now
 * carries, and the title is the link, because the title is what the reader is already reading.
 *
 * THE PROP IS THE AFFORDANCE AND NOT THE GATE. `withElectionLink` nulls the id for any reader
 * who may not open Elections, so this component renders a plain heading for them rather than a
 * way through to a 404. It decides nothing itself — AGENTS.md §5, the same contract
 * `AtAGlance` states.
 *
 * THE TITLE IS THE ANCHOR, AND THE ROW IS NOT. A click handler on the card would be
 * unreachable by keyboard and invisible to a screen reader, and it would fire underneath the
 * pin and delete buttons in the corner on their way up — the same argument
 * `MemberDetailsTrigger` makes on the members table, answered the same way. The explicit
 * `text-foreground` is the `a { color: var(--brand-accent) }` trap in `globals.css`: without
 * it a linked title comes out terracotta and reads as a different KIND of announcement.
 */
export function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const t = useT()
  const intl = useIntlTag()
  const electionHref = announcement.election_id
    ? `/community/elections/${announcement.election_id}`
    : null

  return (
    <Card className={announcement.pinnedForMe ? 'border-primary/40 bg-primary/5' : ''}>
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-start justify-between gap-2">
          {electionHref ? (
            <h3 className="font-semibold text-sm leading-tight">
              <Link href={electionHref}
                className="inline-flex items-start gap-1.5 text-foreground hover:underline underline-offset-4">
                <Vote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-accent" aria-hidden="true" />
                <span>{announcement.title}</span>
              </Link>
            </h3>
          ) : (
            <h3 className="font-semibold text-sm leading-tight">{announcement.title}</h3>
          )}
          {announcement.pinnedForMe && <Pin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {announcement.author_name && <span>{announcement.author_name}</span>}
          <span>·</span>
          <span>{formatRelative(announcement.published_at, t, intl)}</span>
          {announcement.scope !== 'national' && (
            <>
              <span>·</span>
              <span className="capitalize">{announcement.scope}</span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{announcement.body}</p>
        {/* SAID AGAIN AT THE FOOT, in words. The linked title is discoverable only by hovering
            it, and this is a notice a member reads once and acts on — so the way through is
            stated where the reading finishes. Both go to the same place; there is no second
            destination to keep in step. */}
        {electionHref && (
          <Link href={electionHref}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-accent hover:underline underline-offset-4">
            {t('ann.openElection')} <ChevronRight className="h-3 w-3 rtl:-scale-x-100" aria-hidden="true" />
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
