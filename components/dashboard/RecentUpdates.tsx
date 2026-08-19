'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Megaphone, Pin, PinOff } from 'lucide-react'
import { timeAgo } from '@/lib/date-utils'
import { unpinAnnouncementForMe, repinAnnouncementForMe } from '@/app/actions/announcements'
import type { UpdateItem } from '@/components/dashboard/updates'

/**
 * The Golden Master's "Recent Activity" card, renamed to what it can honestly show —
 * and, since 2026-08-13, the only place announcements reach the dashboard.
 *
 * THE RENAME IS STILL THE DESIGN DECISION HERE. The kit draws a FAMILY FEED: an avatar,
 * somebody else's name, and what they did. There is no table behind that — nothing
 * records "who did what", and `notifications` is per-RECIPIENT with no actor column — so
 * the card answers the question the data CAN answer, "what has happened that concerns
 * me", and is titled accordingly.
 *
 * WHAT CHANGED. Announcements used to render as their own banner above the grid, with
 * the dismissed set in `localStorage`. Two things were wrong with that and only the
 * first was visible: a family's news competed with the metric tiles for the top of the
 * page and usually lost, and the dismissal was per BROWSER — dismiss on a laptop and the
 * phone still shows it, with no way to put it back on either. Both are gone. An
 * announcement is a row here like everything else; a pinned one rides at the top until
 * this reader dismisses it, and then falls into date order rather than vanishing.
 *
 * ORDERING LIVES IN `updates.ts`, not here, because it is the feature rather than the
 * markup. This component renders a list it is handed.
 *
 * Consequences carried over from the original card, all still deliberate:
 *
 *   * **No avatars.** The kit's rows lead with the actor's face. There is no actor.
 *   * **Unread is marked, and it is the only state a notification has.** A dot, in
 *     `--brand-accent`, the same non-text accent use the bell makes.
 *   * **It does not mark anything read.** Reading a row here is not opening it; the bell
 *     owns that transition, and two surfaces competing over `read_at` would make the
 *     badge disagree with itself. Dismissing a PIN is not the same act and is why that
 *     one has an explicit button.
 *
 * NOT A `<table>`, on purpose. AGENTS.md's table rules apply to tabular data with
 * columns worth naming; these rows are one thing each.
 */
export function RecentUpdates({
  items, mayViewArchive = false,
}: {
  items: UpdateItem[]
  /** Whether to offer the archive. Resolved on the dashboard; see the link below. */
  mayViewArchive?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // No optimistic state and no `useState` seeded from `items`. The server already sorts
  // this list, and re-deriving the order in the browser would be a second implementation
  // of `mergeUpdates` free to disagree with the first. `router.refresh()` re-runs the
  // real one. It also sidesteps the stale-prop trap AGENTS.md describes for a family
  // switch, which a seeded `useState` here would walk straight into.
  function setPinned(id: string, pinned: boolean) {
    startTransition(async () => {
      await (pinned ? repinAnnouncementForMe(id) : unpinAnnouncementForMe(id))
      router.refresh()
    })
  }

  return (
    <section className="flex flex-col rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-4 text-lg">Recent Updates</h2>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <Bell className="h-6 w-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nothing new right now.</p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {items.map(item => (
            <li
              key={`${item.kind}:${item.id}`}
              className="flex items-start gap-3 border-b border-border/60 py-3 last:border-0"
            >
              <UpdateBody item={item} />

              {/* THE PIN CONTROL IS OUTSIDE THE LINK, and has to be: an anchor may not
                  contain a button, and nesting one produces markup a screen reader
                  cannot describe and a browser may reparent. */}
              {item.kind === 'announcement' && item.familyPinned && (
                <button
                  type="button"
                  onClick={() => setPinned(item.id, !item.pinnedForMe)}
                  disabled={isPending}
                  title={item.pinnedForMe ? 'Stop pinning this to the top' : 'Pin this back to the top'}
                  aria-label={
                    item.pinnedForMe
                      ? `Stop pinning “${item.title}” to the top of your updates`
                      : `Pin “${item.title}” back to the top of your updates`
                  }
                  className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
                >
                  {item.pinnedForMe
                    ? <PinOff className="h-3.5 w-3.5" />
                    : <Pin className="h-3.5 w-3.5" />}
                </button>
              )}

              <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">{timeAgo(item.at)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* THE "View all updates" LINK, and it took a page to earn. This card carried a
          comment where the link is for six days, saying there was nothing at the other end
          of one: the bell held the full notification list and `/announcements` held the full
          board, and nothing rendered the two together, which is what this card is.
          `/updates` (20260819000005) is that archive — the same merged feed, paged and
          searchable — so the caption now describes something that does what it says.

          IT IS GATED, because the archive is a permissioned screen and a link to a page
          that 404s is worse than no link. `mayViewArchive` is resolved on the dashboard
          beside every other grant it resolves; absent, the card renders exactly as before.
          The row LINKS are untouched: an announcement still goes to the board, which is
          where its full text and its controls are. */}
      {/* NOT GATED ON `items.length`, and it was for an afternoon. An empty card is exactly
          when somebody wants to look back at what was said about the hotel block, so hiding
          the archive there hid it in the one state it is most useful in. */}
      {mayViewArchive && (
        <p className="mt-4 text-sm">
          <Link href="/updates" className="hover:underline">View all updates</Link>
        </p>
      )}
    </section>
  )
}

/**
 * The text of one row, wrapped in a link when it has somewhere to go.
 *
 * `link` is nullable on `notifications`, so half those rows genuinely have nowhere to
 * go — and an anchor to nothing is worse than plain text, because it takes focus,
 * invites a click and does not move. Announcements always link to the board, which is
 * the only place their full text exists.
 */
function UpdateBody({ item }: { item: UpdateItem }) {
  const pinnedForMe = item.kind === 'announcement' && item.pinnedForMe

  const inner = (
    <>
      {/* Rendered on every branch so rows are the same height whatever their state —
          the marker changes glyph and colour, never the layout. Same reasoning as the
          sidebar's active pill. */}
      <span aria-hidden="true" className="mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        {item.kind === 'announcement'
          ? <Megaphone className={pinnedForMe ? 'h-3.5 w-3.5 text-brand-accent' : 'h-3.5 w-3.5 text-muted-foreground'} />
          : <span className={`h-2 w-2 rounded-full ${item.unread ? 'bg-brand-accent' : 'bg-transparent'}`} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${highlighted(item) ? 'font-semibold text-card-foreground' : 'text-card-foreground'}`}>
          {item.title}
        </span>
        {item.body && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.body}</span>
        )}
        {item.kind === 'announcement' && item.author && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.author}</span>
        )}
      </span>
    </>
  )

  return item.link ? (
    <Link
      href={item.link}
      className="flex min-w-0 flex-1 items-start gap-3 text-card-foreground transition-colors hover:text-brand-accent"
    >
      {inner}
    </Link>
  ) : (
    <span className="flex min-w-0 flex-1 items-start gap-3">{inner}</span>
  )
}

/** Bold for the rows that are asking for attention: unread news, and a live pin. */
function highlighted(item: UpdateItem): boolean {
  return item.kind === 'announcement' ? item.pinnedForMe : item.unread
}
