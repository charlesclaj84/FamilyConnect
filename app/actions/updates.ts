'use server'

import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { requireRead } from '@/lib/auth/guard'
import { getMyPersonId } from '@/lib/auth/family'
import { notificationText } from '@/lib/notification-text'
import { addressedTo, announcementAudienceFilter, readMyChapterId } from '@/lib/announcement-audience'
import {
  archiveFetchCount, archiveWantCount, clampPages, mergeArchivePage, sanitizeUpdatesQuery,
  UPDATES_MAX_PAGES,
} from '@/lib/updates-archive'
import { currentUser } from '@/lib/auth/current-user'
import { SEARCH_CONFIG } from '@/lib/search-config'

/**
 * `/community/updates` — the archive behind the dashboard's Recent Updates card.
 *
 * ── WHAT IT IS FOR ──────────────────────────────────────────────────────────────────
 * The card shows every pinned announcement plus six other rows and nothing renders row
 * seven; older than that was not merely unseen, it was unfetched. Nothing anywhere searched
 * either table, so "what did they say about the hotel block?" had no answer but scrolling
 * the board, which itself stops at 50. This is one screen over both sources, in date order,
 * with a search box.
 *
 * ── TWO TABLES, ONE OF WHICH HAS A PERMISSION KEY ───────────────────────────────────
 * The awkwardness TODO.md recorded is real and is answered here rather than papered over:
 *
 *   * `announcements` is governed by `announcements`, and this reads it on the USER client
 *     so the composed policy decides which rows come back. `can(…, 'community/announcements', 'view')`
 *     is resolved FIRST and the query skipped when the caller does not hold it — §5, and
 *     also honesty: `announcementsIncluded: false` is what lets the screen say the board is
 *     not part of this list, instead of showing an archive that silently has no
 *     announcements in it.
 *   * `notifications` is governed by nothing. `20260805000007` deleted its resource because
 *     the base policy already restricts every row to its own recipient, so a permission
 *     factor over it was a tautology. They are the caller's own mail and need no grant.
 *
 * So `updates:view` decides whether the SCREEN exists, and the two halves keep their own
 * answers about rows. 20260819000005's header says the same thing at length.
 *
 * ── §7: BOTH READS GO THROUGH THE USER CLIENT, AND THAT IS THE POINT ────────────────
 * No `createAdminClient()` anywhere in this file. Family isolation on both tables is RLS's,
 * which is the §3-preferred path — and it means this action owes `tests/rls` cases, which is
 * the right trade for a screen whose whole content is two families' worth of family data one
 * predicate apart.
 *
 * The consequence to know about: no chapter NAMES. `readChapters` is an admin-client read in
 * app/actions/announcements.ts and this screen does without it. An archive row prints its
 * title, its body, who wrote it and when; a chapter-scoped announcement is in the list for
 * the members it was addressed to and says nothing about which chapter that was. The board
 * is where that is printed.
 *
 * ── THE AUDIENCE FILTER RUNS TWICE, ON PURPOSE ──────────────────────────────────────
 * Once in the database (so the LIMIT applies to rows the reader may see — a page that filters
 * after fetching is a page with holes in it) and once in TypeScript (which stays the
 * authority). `lib/announcement-audience.ts` holds both and argues the duplication.
 *
 * ── AND `read_at` IS NOT TOUCHED ────────────────────────────────────────────────────
 * The bell owns it. Two surfaces competing over it would make the unread badge disagree with
 * itself, which is exactly why the card does not mark anything read either — TODO.md asked
 * the question about an archive and this is the same answer.
 */

/** One row of the archive. Deliberately not `UpdateItem`: there is no pinning here. */
export interface ArchiveItem {
  kind: 'announcement' | 'notification'
  id: string
  title: string
  body: string | null
  /** Where the row goes when opened, or null for a notification that has nowhere. */
  link: string | null
  /** ISO timestamp — `published_at` for an announcement, `created_at` for a notification. */
  at: string
  /** The author's name, for an announcement. Notifications have no author. */
  author: string | null
  /** Unread, for a notification. Always false for an announcement, which has no such state. */
  unread: boolean
}

export interface UpdatesArchive {
  items: ArchiveItem[]
  /** There are older rows than this page shows. */
  hasMore: boolean
  /** ...but browsing stops here. See `UPDATES_MAX_PAGES`; the screen says so. */
  atCeiling: boolean
  /** The pages actually served, after clamping — the client's next request is built on it. */
  pages: number
  /** The query actually run, after sanitising. Echoed so the screen states what it searched. */
  query: string
  /** False when the caller holds no `announcements:view`, so the board is not in this list. */
  announcementsIncluded: boolean
  /** A read was REFUSED, which is a different fact from a family with no news (§8). */
  failed: boolean
}

const EMPTY: UpdatesArchive = {
  items: [], hasMore: false, atCeiling: false, pages: 1, query: '',
  announcementsIncluded: false, failed: false,
}

type RawAnnouncement = {
  id: string
  title: string
  body: string
  scope: string | null
  chapter_id: string | null
  published_at: string
  people: unknown
}

type RawNotification = {
  id: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
  // Since `20260901000004`. `title` is still NOT NULL and is still the fallback — for a row
  // written before that migration, a `type` nobody has keyed, and a key that fails to resolve.
  title_key: string | null
  body_key: string | null
  params: Record<string, string> | null
}

/**
 * One page of the archive.
 *
 * `pages` is a COUNT of pages to show rather than an offset, because the merge of two tables
 * cannot be offset — `lib/updates-archive.ts` explains why at length and is where the
 * arithmetic lives, tested under `npm test`.
 */
export async function getUpdatesArchive(input?: {
  q?: string
  pages?: number
}): Promise<UpdatesArchive> {
  const supabase = await createClient()
  const { user } = await currentUser()
  if (!user) return EMPTY

  // THE ACTION GATES ITSELF, whatever the page did — a `'use server'` export is a public HTTP
  // endpoint (§2). `requireRead` and NOT `requireView`: the tier and removed-family gates
  // belong on the PAGE and deliberately not here (AGENTS.md — "the server actions behind a
  // paid page are deliberately not tier-checked", so a family that downgrades keeps its
  // records), and `notFound()` is a page's way of refusing, not an action's.
  const g = await requireRead('community/updates')
  if (!g.ok) return EMPTY

  const pages = clampPages(input?.pages)
  const query = sanitizeUpdatesQuery(input?.q)
  const want  = archiveWantCount(pages)
  const fetch = archiveFetchCount(pages)

  const [mayViewBoard, personId, chapterId] = await Promise.all([
    can(user.id, 'community/announcements', 'view'),
    getMyPersonId(user.id),
    readMyChapterId(),
  ])

  // A member with no `people` row in this family has no notifications by construction, and
  // the policy would release none anyway. Resolved rather than relied upon, matching
  // `getNotifications`.
  const notificationsQuery = personId
    ? (() => {
        let q = supabase
          .from('notifications')
          // `title_key`, `body_key` and `params` are READ, and the reason is the one
          // `20260901000004` was written for: a notification's words are chosen at EVENT time
          // by whoever triggered it, so `title` is the wrong reader's language. This was the
          // THIRD renderer of a notification and the last one still reading the column
          // directly — `NotificationBell` and the Dashboard's Recent Updates card were both
          // converted; this archive was not, so every entry on /updates stayed English.
          // "Half a fix looks exactly like a whole one", a third time.
          .select('id, title, body, link, read_at, created_at, title_key, body_key, params')
          .eq('recipient_id', personId)
          .order('created_at', { ascending: false })
          .limit(fetch)
        if (query) {
          q = q.textSearch('search_vector', query, { type: 'websearch', config: SEARCH_CONFIG })
        }
        return q
      })()
    : null

  const announcementsQuery = mayViewBoard
    ? (() => {
        // ONE STRING LITERAL, and the constraint on the `people` embed is named. Both are
        // requirements rather than style: supabase-js parses the select at the TYPE level so a
        // concatenation resolves the row to `GenericStringError`, and a BARE `people(...)`
        // embed on this table is PGRST201 — `announcement_unpins` gave PostgREST a second,
        // many-to-many path to `people`, which refuses the WHOLE query and returns `[]`.
        // AGENTS.md §8, and lib/announcement-audience.ts records why there is no shared
        // constant for it.
        let q = supabase
          .from('announcements')
          .select('id, title, body, scope, chapter_id, published_at, people!announcements_author_id_fkey(first_name, last_name)')
          .or(announcementAudienceFilter(chapterId))
          .order('published_at', { ascending: false })
          .limit(fetch)
        if (query) {
          q = q.textSearch('search_vector', query, { type: 'websearch', config: SEARCH_CONFIG })
        }
        return q
      })()
    : null

  const [announcements, notifications] = await Promise.all([
    announcementsQuery ?? Promise.resolve({ data: [], error: null }),
    notificationsQuery ?? Promise.resolve({ data: [], error: null }),
  ])

  // §8, and it is reported rather than swallowed for a specific reason: a refused search and
  // a search with no hits render identically, and this screen exists to answer "did they ever
  // say anything about the hotel". `getNotifications` discards its error and this deliberately
  // does not.
  const failed = Boolean(announcements.error || notifications.error)
  if (failed) {
    console.error('[updates] archive read failed: '
      + (announcements.error?.message ?? notifications.error?.message))
  }

  const announcementItems: ArchiveItem[] = ((announcements.data ?? []) as unknown as RawAnnouncement[])
    // The TypeScript half of the audience rule. The database has already narrowed with the
    // same three disjuncts; this is the authority and runs anyway.
    .filter(addressedTo(chapterId))
    .map(a => ({
      kind: 'announcement' as const,
      id: a.id,
      title: a.title,
      body: a.body,
      // Every announcement has somewhere to go — the board carries the full text, which a
      // truncated row cannot. Notifications are the ones with a nullable link.
      link: '/community/announcements',
      at: a.published_at,
      author: a.people
        ? `${(a.people as { first_name: string; last_name: string }).first_name} ${(a.people as { first_name: string; last_name: string }).last_name}`
        : null,
      unread: false,
    }))

  const notificationItems: ArchiveItem[] = ((notifications.data ?? []) as unknown as RawNotification[])
    .map(n => ({
      kind: 'notification' as const,
      id: n.id,
      // `?? n.title` on the title and not on the body, because `title` is NOT NULL and `body`
      // is nullable — `notificationText` already falls back to the column and answers null
      // only when there was nothing to say. Matches `components/dashboard/updates.ts`.
      title: notificationText(n.title_key, n.title, n.params, g.t) ?? n.title,
      body: notificationText(n.body_key, n.body, n.params, g.t),
      link: n.link,
      at: n.created_at,
      author: null,
      unread: !n.read_at,
    }))

  const { items, hasMore } = mergeArchivePage([announcementItems, notificationItems], want)

  return {
    items,
    hasMore,
    atCeiling: pages >= UPDATES_MAX_PAGES,
    pages,
    query,
    announcementsIncluded: mayViewBoard,
    failed,
  }
}
