import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode } from '@/lib/auth/family'

/**
 * Who an announcement is addressed to, and how the caller's own chapter is resolved.
 *
 * ── WHY THIS IS A PLAIN MODULE AND NOT PART OF THE ACTION ───────────────────────────
 * Both halves were module-private in `app/actions/announcements.ts` until 2026-08-19, and the
 * comment on `addressedTo` there already recorded the reason they should not be: *"declared
 * once because it was written out three times and the three copies had already begun to
 * differ."* `/community/updates` is the fourth reader, and a `'use server'` file cannot share a helper —
 * everything exported from one gets a URL, and only async functions may be exported at all. So
 * the rule moves here, where two actions import it and there is still one copy.
 *
 * Same shape, and the same argument, as `lib/notifications.ts` and `lib/invitations.ts`: the
 * logic lives in a plain module and the actions import it.
 *
 * ── THE AUDIENCE RULE HAS A SQL TWIN, AND THE TWO MUST MOVE TOGETHER ────────────────
 * `getUpdatesArchive` PAGES, so it cannot filter after the fetch: a page of 25 that then drops
 * four chapter-scoped rows is a page of 21 with four missing and no marker, and "no results"
 * over matching rows is the next thing that happens. It therefore narrows in the database with
 * `announcementAudienceFilter` below, and applies this function afterwards anyway.
 *
 * That is two expressions of one rule, which this codebase normally forbids — the exception is
 * the one AGENTS.md already makes for `resolveScope` / `auth_permission` / `scopeInFamilies`:
 * three copies of one fall-through that must move together, because they live on different
 * sides of a boundary no single definition can cross. Here the boundary is PostgREST. The
 * TypeScript version stays the AUTHORITY — it decides what is rendered — and the filter is an
 * optimisation that is allowed to be no narrower than it. If they ever disagree, the SQL half
 * showing too much is caught by this function; the SQL half showing too little would drop rows
 * silently, which is why the filter is written as the same three disjuncts and nothing more.
 */

/** The two columns the audience rule reads. Anything with these can be tested by it. */
export type AnnouncementAudience = {
  scope: string | null
  chapter_id: string | null
}

/**
 * Announcements addressed to this reader.
 *
 * Chapter-scoped rows are dropped for a member of a different chapter. National and regional
 * reach everybody, and a chapter announcement with no chapter named is treated as family-wide
 * rather than as invisible — an author who chose "Chapter" and left the picker empty meant to
 * publish something, and silently showing it to nobody is the worse failure.
 */
export function addressedTo(myChapterId: string | null) {
  return (a: AnnouncementAudience) => {
    if (a.scope === 'chapter') return !a.chapter_id || a.chapter_id === myChapterId
    return true
  }
}

/**
 * The same rule as a PostgREST `or` filter, for a query that has to narrow before its LIMIT.
 *
 * Read the header above before touching it. `chapterId` is a uuid resolved on the server from
 * the caller's own `people` row — never a value from the client — so nothing here interpolates
 * anything a caller chose into PostgREST's filter language.
 *
 * A reader with no chapter gets the two-disjunct form: everything not chapter-scoped, plus
 * chapter-scoped rows naming no chapter. `chapter_id.eq.` with an empty value is not a filter
 * that matches nothing, it is a malformed one.
 */
export function announcementAudienceFilter(chapterId: string | null): string {
  const base = 'scope.neq.chapter,chapter_id.is.null'
  return chapterId ? `${base},chapter_id.eq.${chapterId}` : base
}

/**
 * THERE IS NO SHARED CONSTANT FOR THE `people` EMBED, AND THAT IS FORCED.
 *
 * `announcements` has exactly one foreign key to `people` (`author_id`), so a bare
 * `people(...)` embed read as unambiguous for a year — and then `announcement_unpins`
 * (20260813000001) arrived with foreign keys to BOTH tables, PostgREST began reporting a second
 * many-to-many path, and the bare embed became PGRST201: the WHOLE query refused, returning `[]`
 * from an action that discarded the error. AGENTS.md §8 is written about exactly that pair, and
 * every projection over `announcements` must therefore name the constraint —
 * `people!announcements_author_id_fkey(...)`.
 *
 * The obvious way to enforce that is a constant here, and it does not work: supabase-js parses
 * the select at the TYPE level, so a select built by concatenation has type `string`, the row
 * resolves to `GenericStringError` and every cast downstream stops compiling. The comment above
 * `SELECT_COLUMNS` in app/actions/announcements.ts records that, having been the file it broke.
 * So each projection is one literal, and this paragraph is the shared part.
 */

/**
 * The caller's chapter IN THE FAMILY BEING VIEWED — `chapter_id` is per-family.
 *
 * §8: the error is read, and here it is not a courtesy. `null` from this function means "this
 * member belongs to no chapter", which `addressedTo` treats as "addressed by nothing
 * chapter-scoped" — so a refused read does not narrow the feed, it WIDENS the exclusion and
 * silently hides every chapter announcement from the one member it was written for. There is
 * nothing better to return (guessing a chapter would show them somebody else's post), so the
 * value is unchanged and the fact is logged.
 */
export async function readMyChapterId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('people').select('chapter_id')
    .eq('user_id', user.id)
    .eq('family_code', await getMyFamilyCode(user.id))
    .maybeSingle()
  if (error) {
    console.error(
      `[announcements] could not read the caller's chapter: ${error.message}`
      + ' — chapter-scoped announcements will be hidden from them until this is fixed.',
    )
    return null
  }
  return (data as { chapter_id: string | null } | null)?.chapter_id ?? null
}
