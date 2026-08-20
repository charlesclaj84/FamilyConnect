/**
 * How `/community/updates` pages a feed that is two tables.
 *
 * ── THE PROBLEM THIS EXISTS FOR ─────────────────────────────────────────────────────
 * The archive is announcements and notifications interleaved by date, and **a merged page
 * of a union cannot be produced by two `.range()` calls.** Rows 26–50 of the merge are not
 * rows 26–50 of either table: three of them might be the 40th announcement and the rest the
 * 12th notification, and no offset either query could be given knows that in advance.
 *
 * So the answer is over-fetch and merge, and the shape below is chosen so that being wrong
 * about it is impossible rather than unlikely:
 *
 *   page N asks each source for the newest (N × PAGE_SIZE) + SLACK rows, merges them,
 *   sorts by date and takes the first N × PAGE_SIZE.
 *
 * It re-fetches what page N−1 already had, which is the cost, and it buys three properties
 * that the obvious alternative does not have. A timestamp cursor (`.lt(oldest)`) skips a row
 * when two straddle the boundary with the same `created_at`; `.lte` plus de-duplication
 * fixes the skip and can then STALL, if a whole page shares one timestamp; and neither can
 * state an honest total. This can be wrong in only one direction — showing a row twice — and
 * it cannot, because every page is computed from scratch rather than appended.
 *
 * ── THE SLACK IS NOT DECORATION ─────────────────────────────────────────────────────
 * Announcements are filtered by AUDIENCE after they arrive: chapter-scoped rows are dropped
 * for a member of another chapter (`lib/announcement-audience.ts`). The database narrows
 * first — that filter exists precisely so a LIMIT is applied to rows the reader may see —
 * but the TypeScript rule stays the authority and is applied again, so a page must be able
 * to lose a few rows and still be full.
 *
 * ── AND THERE IS A CEILING, WHICH IS SAID OUT LOUD ON SCREEN ────────────────────────
 * `UPDATES_MAX_PAGES` caps browsing. Two reasons, and the second is the one that decides the
 * number: PostgREST is configured with `max_rows = 1000` (supabase/config.toml), so an
 * over-fetch is silently truncated past that with no error and no marker — the exact failure
 * this module exists to avoid. 20 pages × 25 rows + slack per source stays comfortably under
 * it.
 *
 * SEARCH IS NOT CAPPED BY THE CEILING, and that is the point of having one. A search filters
 * in the DATABASE before the limit, so it reaches every row a family has ever had; only
 * scrolling is bounded. The screen says so rather than letting somebody conclude their oldest
 * news is gone — AGENTS.md on silent caps, which is the same rule `PersonMultiSelect` follows.
 *
 * Pure, and no `Date.now()`: everything here takes what it needs as an argument, which is
 * what makes `lib/updates-archive.test.ts` able to check the boundaries at all (AGENTS.md §7b).
 */

/** Rows per page. The archive's own number, unrelated to `RECENT_UPDATES_LIMIT` (6). */
export const UPDATES_PAGE_SIZE = 25

/**
 * How many pages deep browsing goes. See the header: the real constraint is PostgREST's
 * `max_rows = 1000`, and the over-fetch is per source.
 */
export const UPDATES_MAX_PAGES = 20

/**
 * Extra rows asked of each source, so the audience filter cannot leave a page short.
 *
 * 20 rather than 5: a family that posts mostly to chapters could otherwise lose most of a
 * page to the filter. `getAnnouncementFeed` picked the same number for the same reason, and
 * this is the one place the two agree by coincidence rather than by import.
 */
export const UPDATES_FETCH_SLACK = 20

/** Pages, clamped to something a query can honour. Anything unparseable is page 1. */
export function clampPages(pages: number | undefined): number {
  if (!Number.isFinite(pages) || pages === undefined) return 1
  return Math.min(UPDATES_MAX_PAGES, Math.max(1, Math.floor(pages)))
}

/** How many rows this page wants, once merged. */
export function archiveWantCount(pages: number): number {
  return clampPages(pages) * UPDATES_PAGE_SIZE
}

/** How many rows to ask EACH source for, to be sure of filling it. */
export function archiveFetchCount(pages: number): number {
  return archiveWantCount(pages) + UPDATES_FETCH_SLACK
}

/**
 * Merge already-sorted groups into one page.
 *
 * `hasMore` is "the merge had more rows than the page took", which is the honest answer:
 * every source was asked for more than the page needs, so a merge that overflows means there
 * is at least one older row somewhere, and a merge that does not means there is not.
 *
 * The sort is by `at` descending. `Array.prototype.sort` is stable, so rows sharing a
 * timestamp keep the order the groups were given in — which makes the page deterministic
 * without inventing a tie-breaker across two tables that have no comparable second key.
 */
export function mergeArchivePage<T extends { at: string }>(
  groups: readonly (readonly T[])[],
  want: number,
): { items: T[]; hasMore: boolean } {
  const merged = groups.flat()
  merged.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  return {
    items: merged.slice(0, Math.max(0, want)),
    hasMore: merged.length > Math.max(0, want),
  }
}

/**
 * A search box's contents, made safe to put in a PostgREST filter value.
 *
 * ── WHY IT IS AN ALLOW-LIST AND NOT AN ESCAPE ───────────────────────────────────────
 * `safeQuery` in `app/actions/admin/permissions.ts` is the precedent and the reason is the
 * same one, one operator over: PostgREST's filter syntax is a comma-, colon- and
 * parenthesis-delimited mini-language, and a raw string could break the filter or add a
 * condition to it. The character class here is `safeQuery`'s, and the two should stay in
 * step — a third search in this codebase should import one of them rather than write a
 * fourth.
 *
 * The cap is 120 rather than 60 because this searches PROSE. A name is short; "what did
 * they say about the hotel block" is not.
 *
 * ── WHAT THE STRIPPED CHARACTERS COST, WHICH IS LESS THAN IT LOOKS ──────────────────
 * `websearch_to_tsquery` understands `"a phrase"`, `-excluded` and `or`. Of those, only the
 * double quote is stripped — PostgREST treats a leading quote as value quoting, so it cannot
 * be transported. The degradation is graceful rather than broken: `"hotel block"` arrives as
 * two required words, which still finds the row and also finds it where the words are apart.
 * `-` and `or` survive and work.
 *
 * IT NEVER THROWS AND NEVER PRODUCES A SYNTAX ERROR, which is the other half of why the
 * search is `websearch_to_tsquery` rather than `to_tsquery`: that function is total over its
 * input, so a query of nothing but punctuation matches nothing instead of failing a query.
 */
export const UPDATES_QUERY_MAX = 120

export function sanitizeUpdatesQuery(raw: string | undefined | null): string {
  if (!raw) return ''
  return raw.trim().replace(/[^\p{L}\p{N}\s@._'-]/gu, '').slice(0, UPDATES_QUERY_MAX).trim()
}
