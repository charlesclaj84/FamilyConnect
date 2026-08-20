'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Megaphone, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormError } from '@/components/ui/form-message'
import { useServerState } from '@/lib/use-server-state'
import { timeAgo } from '@/lib/date-utils'
import { UPDATES_PAGE_SIZE } from '@/lib/updates-archive'
import type { UpdatesArchive } from '@/app/actions/updates'

/**
 * `/updates` — the archive of the dashboard's Recent Updates feed.
 *
 * ── IT RENDERS WHAT IT IS HANDED, AND NAVIGATES TO CHANGE IT ────────────────────────
 * No `useState` seeded from the rows, and no client-side accumulation of pages. The server
 * decides the whole list — the merge of two tables in date order is the feature, and a second
 * implementation in the browser would be free to disagree with `lib/updates-archive.ts`. So
 * searching and showing more are LINKS: `?q=` and `?pages=`, resolved on the server.
 *
 * That is also what keeps this out of the stale-prop trap AGENTS.md describes for a family
 * switch. There is no `useState` in this component at all: the one piece of client state is the
 * text in the search box, and it is `useServerState` seeded from the query the SERVER ran
 * rather than from the raw URL — so a sanitised query shows what was actually searched, and the
 * back button walks back through searches instead of leaving the newest one in the box.
 *
 * ── NOT A `<table>`, ON PURPOSE ─────────────────────────────────────────────────────
 * The table rules apply to tabular data with columns worth naming. These rows are one thing
 * each, exactly as on the dashboard card — same reasoning, same shape, and the two are meant
 * to look like the same feed.
 *
 * ── EVERY ABSENCE IS EXPLAINED RATHER THAN LEFT BLANK ───────────────────────────────
 * Four different empty screens are reachable here and they are four different facts, which is
 * the whole reason this component is longer than the list it draws:
 *
 *   * a family with nothing in it yet;
 *   * a search that matched nothing — and it says what it searched for, because a sanitised
 *     query can differ from what was typed;
 *   * a read that was REFUSED, which is not "no news" and is reported as itself (§8);
 *   * a caller with no `announcements:view`, whose archive is their own notifications and who
 *     is told the board is not in it — rather than being shown a list that quietly omits it.
 *
 * And the browsing ceiling is stated when it is reached, never silently: the search is what
 * reaches older rows, because it filters in the database before the limit.
 */
interface Props {
  archive: UpdatesArchive
  /**
   * Where `?q=` and `?pages=` are pushed to. Defaults to `/updates`, which is what this
   * component was written against; the Announcements rail passes `/announcements` because
   * the archive is a PANE there and `/updates` merely redirects to it. Hard-coding the old
   * route here would have made every search and every "Show older" go through that redirect.
   */
  basePath?: string
  /**
   * Query params that must survive a search — `{ pane: 'updates' }` on the Announcements
   * rail, so the navigation lands back on this pane rather than on the board.
   *
   * Rebuilt from scratch beside `q` and `pages` rather than merged out of the live URL: this
   * is a real navigation, and the only params that should survive one are the ones the caller
   * names. Anything else on the URL belongs to a pane this list is not.
   */
  keepParams?: Record<string, string>
}

export function UpdatesArchiveClient({
  archive, basePath = '/updates', keepParams,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // `useServerState`, not `useState`: the box has to ADOPT the query the server actually ran, or
  // the back button walks back through searches while the box keeps showing the newest one. It
  // compares by identity, which for a string is equality — so a re-render that did not change
  // the query leaves half-typed text alone, and only a real navigation replaces it.
  const [draft, setDraft] = useServerState(archive.query)

  const {
    items, hasMore, atCeiling, pages, query, announcementsIncluded, failed,
  } = archive

  function go(next: { q?: string; pages?: number }) {
    const params = new URLSearchParams(keepParams)
    const q = next.q ?? query
    if (q) params.set('q', q)
    if (next.pages && next.pages > 1) params.set('pages', String(next.pages))
    const suffix = params.toString()
    startTransition(() => {
      // `scroll: false` — "Show older" appends to the bottom of the list, and jumping to the
      // top of the page is the opposite of what somebody pressing it asked for.
      router.push(suffix ? `${basePath}?${suffix}` : basePath, { scroll: false })
    })
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    // A new search starts at page one. Keeping the depth would show 200 rows of results with
    // no indication that the first press had asked for that.
    go({ q: draft.trim(), pages: 1 })
  }

  return (
    <div className="space-y-4">
      {/* A real <form>, so Enter submits and the browser's own search affordances work. */}
      <form onSubmit={onSearch} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search titles and messages…"
            aria-label="Search updates"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>Search</Button>
          {query && (
            <Button type="button" variant="outline" onClick={() => { setDraft(''); go({ q: '', pages: 1 }) }}>
              Clear
            </Button>
          )}
        </div>
      </form>

      <p className="text-xs text-muted-foreground">
        Whole words, in any order — searching <strong>hotel block</strong> finds &ldquo;the block
        at the hotel&rdquo;, and <strong>rooms</strong> finds &ldquo;room&rdquo;. Put a
        <strong> -</strong> in front of a word to leave it out. Part of a word does not match.
      </p>

      <FormError
        message={failed
          ? 'Something went wrong reading your updates, so this list may be incomplete. Try again in a moment.'
          : ''}
      />

      {!announcementsIncluded && (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          This list is what has been sent to you. Family announcements are not included, because
          your family has not given you the board — see{' '}
          <Link href="/help/who-can-do-what#missing">Who can do what</Link>.
        </p>
      )}

      {items.length === 0 ? (
        // NOT "nothing matches" WHEN THE READ FAILED. `failed` and empty are two different
        // facts and this is where they were being conflated: the alert above said the read
        // broke and this line then asserted, immediately underneath it, that there is nothing
        // to find — which is exactly the §8 conflation the header claims to avoid. When the
        // read failed the alert IS the message and nothing more is drawn.
        failed ? null : (
          <p className="text-sm text-muted-foreground">
            {query
              ? <>Nothing matches <strong>{query}</strong>.</>
              : 'Nothing yet. Announcements your family posts and anything sent to you will appear here.'}
          </p>
        )
      ) : (
        <>
          <ul className="divide-y rounded-lg border">
            {items.map(item => (
              <li key={`${item.kind}:${item.id}`} className="flex gap-3 px-3 py-3">
                <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">
                  {item.kind === 'announcement'
                    ? <Megaphone className="h-4 w-4" />
                    : <Bell className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-sm font-medium">
                      {item.link
                        ? <Link href={item.link} className="hover:underline">{item.title}</Link>
                        : item.title}
                    </p>
                    {/* Unread is a dot in the accent colour — the same non-text accent use the
                        bell and the dashboard card make. It is the only state a notification
                        has, and an announcement has none. */}
                    {item.unread && (
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-accent"
                        aria-label="Unread"
                      />
                    )}
                  </div>
                  {item.body && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.kind === 'announcement' ? 'Announcement' : 'Sent to you'}
                    {item.author && <> · {item.author}</>}
                    {' · '}{timeAgo(item.at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-col items-start gap-2">
            <p className="text-xs text-muted-foreground">
              Showing {items.length} {items.length === 1 ? 'update' : 'updates'}
              {query && <> matching <strong>{query}</strong></>}.
            </p>
            {hasMore && !atCeiling && (
              <Button variant="outline" disabled={pending} onClick={() => go({ pages: pages + 1 })}>
                {pending ? 'Loading…' : `Show ${UPDATES_PAGE_SIZE} older`}
              </Button>
            )}
            {/* THE CEILING IS SAID OUT LOUD. A list that stops while looking complete is how
                somebody concludes their family's older news is gone — and it is not: a search
                filters in the database, so it reaches every row there has ever been. */}
            {hasMore && atCeiling && (
              <p className="text-xs text-muted-foreground">
                That is as far as scrolling goes. There are older updates — search for a word in
                one to find it.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
