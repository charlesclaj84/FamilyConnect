import Link from 'next/link'
import { Bell } from 'lucide-react'
import { timeAgo } from '@/lib/date-utils'
import type { Notification } from '@/app/actions/notifications'

/**
 * The Golden Master's "Recent Activity" card, renamed to what it can honestly show.
 *
 * THE RENAME IS THE WHOLE DESIGN DECISION HERE, so it is worth being precise. The kit
 * draws a FAMILY FEED: an avatar, somebody else's name, and what they did — "Jasmine
 * Allen RSVP'd to Allen Family Reunion 2026", "Marcus Allen paid annual dues". That is
 * four rows about four other people.
 *
 * There is no table behind it. Not a feature flag — a schema gap: nothing in the database
 * records "who did what", and `notifications` is per-RECIPIENT with no actor column, so
 * it cannot answer the question the kit's card asks. Building the feed would mean
 * inventing an activity log, and inventing one to fill a card is the wrong order.
 *
 * So this card answers the question the data CAN answer — "what has happened that
 * concerns me" — and it is titled accordingly. The alternatives were both worse:
 * rendering `notifications` under the heading "Recent Activity" would quietly claim to be
 * a family feed while showing a private inbox, and dropping the card entirely would lose
 * a real, useful surface because a different one is unbuildable.
 *
 * Consequences of that decision, all deliberate:
 *
 *   * **No avatars.** The kit's rows lead with the actor's face. There is no actor. A
 *     row led by the RECIPIENT's own face — the only person these rows are about — would
 *     be four copies of the reader's own photograph.
 *   * **Unread is marked, and it is the only state.** A dot, in `--brand-accent`, the
 *     same non-text accent use the bell makes.
 *   * **It does not mark anything read.** Reading a row here is not opening it; the bell
 *     owns that transition, and having two surfaces silently competing over `read_at`
 *     would make the badge disagree with itself.
 *
 * When a real `family_activity` table exists, this card is where that feed belongs and
 * the heading goes back to the kit's.
 *
 * NOT A `<table>`, on purpose. AGENTS.md's table rules — `COLLAPSING_CELL`, `<RowMeta>`,
 * no sideways scroll — apply to tabular data with columns worth naming. These rows are a
 * list of one thing each, and rendering them as a table would owe all of that machinery
 * to gain nothing.
 */
export function RecentUpdates({ notifications }: { notifications: Notification[] }) {
  return (
    <section className="flex flex-col rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-4 text-lg">Recent Updates</h2>

      {notifications.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <Bell className="h-6 w-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nothing new right now.</p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {notifications.map(n => {
            const unread = !n.read_at
            const row = (
              <>
                {/* Rendered on both branches so an unread row and a read one are the
                    same height — the marker changes colour, never the layout. Same
                    reasoning as the sidebar's active pill. */}
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? 'bg-brand-accent' : 'bg-transparent'}`}
                />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${unread ? 'font-semibold text-card-foreground' : 'text-card-foreground'}`}>
                    {n.title}
                  </span>
                  {n.body && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.body}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
              </>
            )

            return (
              <li key={n.id} className="border-b border-border/60 last:border-0">
                {/* `link` is nullable on the table, so half these rows genuinely have
                    nowhere to go. An anchor to nothing is worse than plain text — it
                    takes focus, invites a click and does not move. */}
                {n.link ? (
                  <Link
                    href={n.link}
                    className="flex items-start gap-3 py-3 text-card-foreground transition-colors hover:text-brand-accent"
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 py-3">{row}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* NO "View all updates" LINK, and its absence is a decision rather than an
          omission. The Golden Master ends this card with "View all activity →". There is
          no page at the other end of that: the bell in the navbar already holds the full
          list (`getNotifications()` caps at 30, and this card shows the first few of the
          same rows), and no route renders more. Shipping the affordance would have meant
          either inventing a page or pointing the link at something that does not do what
          its caption says. When a real activity feed exists, this is where its link
          goes. */}
    </section>
  )
}
