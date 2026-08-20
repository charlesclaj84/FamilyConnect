import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Where a member sits in the family's geography — one chapter, and the region above it.
 *
 * ── WHY THIS IS A MODULE AND NOT A FUNCTION IN AN ACTION FILE ───────────────────────
 * Because two server actions need the same answer and neither can export it to the other.
 * `getMembers` (app/actions/members.ts) feeds Member Directory; `searchMembers`
 * (app/actions/admin/permissions.ts) feeds Members & Access. AGENTS.md's "A table is a
 * table" says those two screens "list the same people and answer the same question", and
 * since 2026-08-19 two of the four columns they agree on are Region and Chapter — so an
 * answer that differed between them would be the exact drift that section exists to stop.
 *
 * Both files are `'use server'`, and everything exported from one of those gets a URL. A
 * chapter/region lookup published as a public HTTP endpoint is not a catastrophe, but it is
 * an endpoint nobody asked for, taking a `familyCode` and a list of ids as parameters —
 * which is the shape §2b tells you not to build. So it could not live in either file and be
 * shared; for one day it lived in BOTH, verbatim, with a comment in each promising the two
 * would be changed together. `lib/money-attached.ts` and `lib/scope-attached.ts` are the
 * house pattern for exactly this ("one rule, in one place, consulted by every action that
 * can reach it"), and this is the same shape for the same reason.
 *
 * ── THE ADMIN CLIENT, AND THAT IS A DECISION WITH TWO PRECEDENTS ────────────────────
 * The composed SELECT policies on `chapters` and `regions` both demand
 * `admin/chapters:view = 'any'` — `permission_table_map` gives each of them
 * `own_expr = 'false'`, and 20260618000001 composed the rest — so through the USER client an
 * ordinary member reads NO chapter and NO region. That is not hypothetical: it is what
 * `getMembers` did until 2026-08-19, with a bare `chapters(name)` embed, which is why the
 * Directory's Chapter column was blank for every reader without the administrator grant and
 * its chapter filter was offering an empty list. A column empty for almost every reader is
 * not a column — and a Region column built the same way would print "National" over a member
 * of the Eastern region, which is a WRONG answer rather than a missing one.
 *
 * Two things in the tree already answer this exact question the same way, on the same two
 * tables, and both argue it out loud: `familyChapterRegions` in app/actions/dues.ts ("a
 * half-visible read produces a half-billed member") and `getDuesScopeOptions` in the same
 * file ("names of regions and chapters are family structure rather than PII, and a treasurer
 * setting up a regional due has to be able to see which regions exist"). What
 * `admin/chapters` protects is EDITING the family's shape, and every write in
 * app/actions/admin/chapters.ts still demands it.
 *
 * ── AND IT PUBLISHES NOTHING THE CALLER DID NOT ALREADY HAVE (§5) ───────────────────
 * That is the test to apply before widening any projection — "moving a value into a dialog is
 * not a reason to start fetching it for somebody who could not see it before" — and a NAME
 * resolved from an id is the one case where it is answered by construction rather than by
 * judgement:
 *
 *   * `chapter_id` is already in both callers' projections and already on `MemberRecord`, for
 *     every person in the family, for every caller. The id was never withheld.
 *   * Every approved member can already read every chapter name in the family, by name,
 *     through `getChapters()` — which is `requireMember()` and nothing else, because
 *     /personal-info cannot offer a member a chapter to belong to without the list.
 *
 * So a client holding either action's output could already have joined the two by hand. Doing
 * the join on the server changes who can know what by exactly nothing; it changes only
 * whether the screen has to.
 *
 * ── §3, AND IT IS THE CALLER'S OBLIGATION TOO ──────────────────────────────────────
 * The service role applies no RLS, so `.eq('family_code', …)` is here by hand — and it is not
 * only the rule, it is what makes a `chapter_id` pointing outside this family resolve to
 * NOTHING rather than naming another family's chapter on this family's screen. `.in('id', …)`
 * narrows to the rows already released to the caller; the family conjunct is what makes that
 * safe.
 *
 * THE `familyCode` MUST BE THE CALLER'S OWN, resolved from their membership — never a
 * parameter that reached a server action from a client. This module cannot check that and
 * does not pretend to: it is a plain function, not a guard, and both call sites pass a code
 * off their own guard. `tests/rls/cases.mjs` asserts the outcome from the far end, on both
 * actions, with an `expectPositive` naming ALPHA's own region — which is the only assertion
 * that catches this returning an EMPTY map, since a wrong constraint name and a family
 * conjunct that matches nothing both render as "National" for everybody (§8).
 *
 * ── WIRED UP 2026-08-19, AND CHECKED BY MUTATION ────────────────────────────────────
 * This module existed for a day with nothing importing it, while both actions kept their own
 * verbatim copy — so the deduplication it was written for had not actually happened. Both call
 * sites import it now, and the evidence that they are both covered is a mutation: making this
 * function return the empty map immediately fails exactly two assertions,
 * `members.getMembers (control)` and `admin/permissions.searchMembers (control)`, one per
 * member table, and nothing else in the suite. That is the pair AGENTS.md's "A table is a
 * table" is about.
 */

/** One chapter, as the two member tables name it. `regionName` null = National. */
export interface ChapterPlace {
  chapterName: string
  regionName: string | null
}

/** The embed's shape. Supabase types the nested row loosely, hence the cast at the read. */
interface ChapterRow {
  id: string
  name: string
  regions: { name: string } | null
}

/**
 * What each of these chapters is called, and which region it sits in — id -> both names.
 *
 * Returns a MAP, so a `chapter_id` that resolves to nothing is a miss rather than a throw: a
 * member whose chapter was deleted, or whose id points outside the family, gets the same "—"
 * and "National" a member with no chapter gets. That is the right answer for a screen and the
 * wrong one to build a bill from — see `familyChapterRegions` in app/actions/dues.ts, which
 * deliberately does not share this.
 *
 * Skipped entirely for a family with no chapters — which is most of them, `/admin/members/organization`
 * being `tier: 'plus'` — so the two member tables cost no extra round trip to gain two
 * columns they will render as "—" and "National".
 */
export async function chapterPlaces(
  familyCode: string,
  chapterIds: readonly string[],
): Promise<ReadonlyMap<string, ChapterPlace>> {
  const places = new Map<string, ChapterPlace>()
  if (!familyCode || chapterIds.length === 0) return places

  const { data, error } = await createAdminClient()
    .from('chapters')
    // THE CONSTRAINT IS NAMED, following `getChapters()` in app/actions/admin/chapters.ts,
    // which measured this after 20260817000008 and recorded the answer: the bare embed still
    // resolves, because PostgREST infers a many-to-many path only where the junction's two
    // foreign-key columns ARE its primary key, and both tables pointing at `chapters` and
    // `regions` together (`dues_schedules`, `user_roles`) have a surrogate `id`.
    // `chapters.region_id` is the only direct path either way — re-checked against
    // `pg_constraint` for this batch, and 20260819000000-…0005 added no third. Naming it
    // costs nothing, and what it forecloses is PGRST201: AGENTS.md §8's failure, where the
    // whole query dies and the screen renders "no region" over a family that has four.
    .select('id, name, regions!chapters_region_id_fkey(name)')
    .eq('family_code', familyCode)
    .in('id', chapterIds)

  // §8. `data` alone cannot tell a refused query from a family with no chapters, and those
  // are very different facts to be printing in a Region column. The log names the family so
  // a support engineer can tell "this family has no chapters" from "this query is broken".
  if (error) {
    console.error(`[chapter-places] could not resolve chapter regions for ${familyCode}: ${error.message}`)
    return places
  }

  for (const c of (data ?? []) as unknown as ChapterRow[]) {
    places.set(c.id, { chapterName: c.name, regionName: c.regions?.name ?? null })
  }
  return places
}
