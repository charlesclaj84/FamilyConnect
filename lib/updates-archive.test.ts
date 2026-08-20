import { describe, it, expect } from 'vitest'
import {
  UPDATES_PAGE_SIZE, UPDATES_MAX_PAGES, UPDATES_FETCH_SLACK,
  clampPages, archiveWantCount, archiveFetchCount, mergeArchivePage,
  sanitizeUpdatesQuery, UPDATES_QUERY_MAX,
} from './updates-archive'

/**
 * `lib/updates-archive.ts` decides which rows a page of `/community/updates` shows, and it is the one
 * part of that feature no database can check: the merge happens in TypeScript because a
 * merged page of a union cannot be produced by two PostgREST range requests.
 *
 * CHECKED BY MUTATION, 2026-08-19, as AGENTS.md §7b requires — a green run is not evidence
 * until it has been seen to fail. Each of these trips a different set:
 *
 *   m1  `mergeArchivePage`: `merged.length >= want` instead of `>` — "hasMore is false when
 *       the merge exactly fills the page" fails. That is the off-by-one that shows a
 *       "Show older" button with nothing behind it.
 *   m2  `mergeArchivePage`: drop the `.sort` — "interleaves two sources strictly by date"
 *       fails. Without it a page is announcements-then-notifications, which looks plausible
 *       on a fixture where one source happens to be newer.
 *   m3  `mergeArchivePage`: sort ascending — the same test fails, and so does "takes the
 *       NEWEST rows", which is the one that matters: an oldest-first slice renders a page of
 *       the family's earliest news under a heading that says newest.
 *   m4  `clampPages`: drop the `Math.max(1, …)` — "page 0 and negatives are page 1" fails,
 *       and `archiveWantCount(0)` becomes 0, which is an empty archive over a family that
 *       has forty rows.
 *   m5  `clampPages`: drop the `UPDATES_MAX_PAGES` clamp — "browsing is bounded" fails.
 *       Unbounded, a `?pages=999` in the URL asks each source for 24,995 rows and PostgREST
 *       silently truncates at `max_rows = 1000`, which is the exact silent cap this module's
 *       header is about.
 *   m6  `archiveFetchCount`: return `archiveWantCount(pages)` — "asks for more than it
 *       shows" fails. With no slack the audience filter leaves the last page short and
 *       `hasMore` goes false while older rows exist.
 */

const at = (iso: string) => ({ at: iso })

describe('clampPages', () => {
  it('defaults to page 1', () => {
    expect(clampPages(undefined)).toBe(1)
    expect(clampPages(NaN)).toBe(1)
    expect(clampPages(Infinity)).toBe(1)
  })

  it('treats page 0 and negatives as page 1', () => {
    expect(clampPages(0)).toBe(1)
    expect(clampPages(-4)).toBe(1)
  })

  it('floors a fraction rather than asking for 62.5 rows', () => {
    expect(clampPages(2.9)).toBe(2)
  })

  it('bounds browsing at UPDATES_MAX_PAGES', () => {
    expect(clampPages(UPDATES_MAX_PAGES)).toBe(UPDATES_MAX_PAGES)
    expect(clampPages(UPDATES_MAX_PAGES + 1)).toBe(UPDATES_MAX_PAGES)
    expect(clampPages(999)).toBe(UPDATES_MAX_PAGES)
  })
})

describe('the fetch window', () => {
  it('wants a whole number of pages', () => {
    expect(archiveWantCount(1)).toBe(UPDATES_PAGE_SIZE)
    expect(archiveWantCount(3)).toBe(3 * UPDATES_PAGE_SIZE)
  })

  it('asks each source for MORE than it shows, so the audience filter cannot empty a page', () => {
    expect(archiveFetchCount(1)).toBe(UPDATES_PAGE_SIZE + UPDATES_FETCH_SLACK)
    expect(archiveFetchCount(1)).toBeGreaterThan(archiveWantCount(1))
  })

  it('stays under PostgREST max_rows (1000) at the deepest page', () => {
    expect(archiveFetchCount(UPDATES_MAX_PAGES)).toBeLessThan(1000)
  })
})

describe('mergeArchivePage', () => {
  it('interleaves two sources strictly by date, newest first', () => {
    const announcements = [at('2026-08-10T00:00:00Z'), at('2026-08-06T00:00:00Z')]
    const notifications = [at('2026-08-08T00:00:00Z'), at('2026-08-04T00:00:00Z')]
    const { items } = mergeArchivePage([announcements, notifications], 10)
    expect(items.map(i => i.at)).toEqual([
      '2026-08-10T00:00:00Z',
      '2026-08-08T00:00:00Z',
      '2026-08-06T00:00:00Z',
      '2026-08-04T00:00:00Z',
    ])
  })

  it('takes the NEWEST rows when it has to choose', () => {
    const rows = ['2026-08-01', '2026-08-05', '2026-08-03'].map(d => at(`${d}T00:00:00Z`))
    const { items } = mergeArchivePage([rows], 2)
    expect(items.map(i => i.at)).toEqual(['2026-08-05T00:00:00Z', '2026-08-03T00:00:00Z'])
  })

  it('reports hasMore when the merge overflows the page', () => {
    const rows = Array.from({ length: 7 }, (_, i) => at(`2026-08-0${i + 1}T00:00:00Z`))
    expect(mergeArchivePage([rows], 5).hasMore).toBe(true)
  })

  it('reports hasMore false when the merge exactly fills the page', () => {
    const rows = Array.from({ length: 5 }, (_, i) => at(`2026-08-0${i + 1}T00:00:00Z`))
    const page = mergeArchivePage([rows], 5)
    expect(page.items).toHaveLength(5)
    expect(page.hasMore).toBe(false)
  })

  it('reports hasMore false for an empty feed', () => {
    expect(mergeArchivePage([[], []], UPDATES_PAGE_SIZE)).toEqual({ items: [], hasMore: false })
  })

  it('keeps group order for rows sharing a timestamp, so a page is deterministic', () => {
    const a = [{ at: '2026-08-08T00:00:00Z', which: 'announcement' }]
    const n = [{ at: '2026-08-08T00:00:00Z', which: 'notification' }]
    expect(mergeArchivePage([a, n], 10).items.map(i => i.which))
      .toEqual(['announcement', 'notification'])
  })

  it('never returns a negative slice for a nonsense want', () => {
    const rows = [at('2026-08-08T00:00:00Z')]
    expect(mergeArchivePage([rows], -3)).toEqual({ items: [], hasMore: true })
  })
})

describe('sanitizeUpdatesQuery', () => {
  it('passes ordinary words through', () => {
    expect(sanitizeUpdatesQuery('hotel block')).toBe('hotel block')
  })

  it('keeps the two websearch operators that survive PostgREST', () => {
    expect(sanitizeUpdatesQuery('hotel -motel')).toBe('hotel -motel')
    expect(sanitizeUpdatesQuery('hotel or motel')).toBe('hotel or motel')
  })

  it('strips every character PostgREST reads as filter syntax', () => {
    // m7: widen the class to allow any of these and this fails. A comma or a parenthesis in
    // a filter value is how a search becomes a second condition.
    expect(sanitizeUpdatesQuery('hotel,block')).toBe('hotelblock')
    expect(sanitizeUpdatesQuery('a(b)c:d')).toBe('abcd')
    expect(sanitizeUpdatesQuery('title.ilike.%x%')).toBe('title.ilike.x')
    expect(sanitizeUpdatesQuery('"a phrase"')).toBe('a phrase')
  })

  it('keeps accents and apostrophes, which are ordinary in a family name', () => {
    expect(sanitizeUpdatesQuery("José O'Connor")).toBe("José O'Connor")
  })

  it('is empty for nothing, whitespace, or nothing but punctuation', () => {
    expect(sanitizeUpdatesQuery(undefined)).toBe('')
    expect(sanitizeUpdatesQuery(null)).toBe('')
    expect(sanitizeUpdatesQuery('   ')).toBe('')
    expect(sanitizeUpdatesQuery('(),:;!')).toBe('')
  })

  it('caps the length', () => {
    expect(sanitizeUpdatesQuery('x'.repeat(500))).toHaveLength(UPDATES_QUERY_MAX)
  })
})
