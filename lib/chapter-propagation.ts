import { createAdminClient } from '@/lib/supabase/admin'
import { minorCutoff } from '@/lib/age-utils'
import { todayLocal } from '@/lib/date-utils'

/*
 * NO `import 'server-only'`, and that is deliberate rather than an omission. Nothing in this
 * tree uses it — `lib/auth/family.ts` holds the service-role client with no such guard — and
 * the first draft of this file did, which broke `npm run test:rls`: that harness loads action
 * modules through a plain Node import, where `server-only` is not resolvable at all, so every
 * case touching this module failed with "Cannot find package" rather than an assertion.
 *
 * What keeps it off the client is the import below. `@/lib/supabase/admin` reads the
 * service-role key from the environment, so a component that pulled this in would fail at
 * build rather than ship a key — which is the boundary that actually holds.
 */

/**
 * Carrying a member's account-less children UNDER EIGHTEEN into the chapter they just moved to.
 *
 * ── THERE IS NO HOUSEHOLD IN THIS PRODUCT, AND THIS IS THE WHOLE OF WHAT MOVES ──────
 * Every member is their own person. `people` has one kind of row (AGENTS.md §4b), nothing is
 * filed under anybody else, and setting your chapter changes exactly one thing about the
 * family: your own row, plus the rows of children who are too young to have a say and have no
 * account to say it with. The three conjuncts below ARE that sentence, and every one of them
 * is doing work:
 *
 *   a Son or Daughter edge   they are your child, which a person recorded — never derived
 *   `user_id IS NULL`        they cannot set their own chapter, so somebody has to
 *   under eighteen           they are a minor TODAY, derived from `date_of_birth`
 *
 * The copy on both surfaces says this in those words. It said "everyone in your household
 * moves with you" until 2026-08-22, which described a concept this product does not have and
 * over-promised what the function did in the same breath.
 *
 * ── WHY THIS IS A MODULE OF ITS OWN, AND NOT A THIRD COPY ───────────────────────────
 * Two surfaces set somebody's chapter and both owe this: `saveChapterAndPropagate` (a member
 * setting their own, on My Profile) and `setMemberChapter` (an administrator setting anybody's,
 * from Members & Access). The second arrived on 2026-08-21, and writing the propagation into it
 * would have made two implementations of one rule — with the first one BROKEN, which is the
 * part that decided this.
 *
 * ── THE BUG IT FIXES, WHICH AGENTS.md §8b AND TODO.md BOTH NAMED ────────────────────
 * `saveChapterAndPropagate` ran the child UPDATE on the USER client — an update of `chapter_id`
 * over the children's ids, narrowed to those with no `user_id`, with its result discarded.
 *
 * (Written out in prose rather than quoted, and that is not squeamishness: `npm run
 * audit:people` is a TEXT sweep with no comment stripping — its own header calls it
 * "deliberately crude" — so a verbatim sample of a `people` write in a comment is reported as
 * an unreviewed write site. It found this one. An allow-list entry for a code sample is
 * exactly the false verdict that script's header warns an audit dies of.)
 *
 * `people` maps to `community/directory` with `user_id = (SELECT auth.uid())` as both its own-
 * and self-expression, so **a member without `community/directory:edit` at `'any'` matched zero
 * rows, every time** — and the result was discarded, so nothing noticed. A parent changed their
 * chapter, was correctly told it saved, and their account-less children stayed where they were,
 * which is the whole feature the function is named after.
 *
 * `confirmWrite` is the WRONG tool for it, which is why it sat open: the caller's own save DID
 * work, so reporting a failure would have been worse than the silence. The repair is the ADMIN
 * client with §3 scoping by hand — exactly what `editPersonRecord` does, and for the same
 * reason: the rows being written belong to nobody, so no policy can admit them.
 *
 * ── AND WHY IT IS IN `lib/` RATHER THAN BESIDE EITHER CALLER ────────────────────────
 * `npm run audit:people` decides which client a `people` write uses by whether the FILE imports
 * `createAdminClient` at all. Putting this in `app/actions/personal-info.ts` would put all six
 * of that file's `people` writes on the review list, each needing its own verdict against the
 * three questions — a cost AGENTS.md names by name when it describes this repair. Here there is
 * ONE write and one verdict, which is the honest accounting.
 *
 * ── THE THREE QUESTIONS (AGENTS.md, "A service-role write to `people`") ─────────────
 *   1. FAMILY-SCOPED?  `.eq('family_code', familyCode)` on the read AND the write. The read
 *      needs it because `person_relationships` rows are per-family but a `people.id` from
 *      another family could be handed in; the write needs it because `.in('id', …)` alone would
 *      match those rows.
 *   2. COLUMNS ALLOW-LISTED?  One column, `chapter_id`, written as a literal. There is no
 *      caller-supplied object to filter.
 *   3. EVERY REFERENCED ID VERIFIED?  `chapterId` is the caller's, and it is verified by BOTH
 *      callers with `belongsToFamily` before they get here — stated as a precondition rather
 *      than re-checked, because a helper that re-reads it would hide which layer refused.
 */

/**
 * The relationship names that mean "my child".
 *
 * Read from `relationship_types` by NAME rather than by id, because those ids are per-database
 * (the table is product reference data seeded by migrations — AGENTS.md, "Three tables in
 * `public` are product data") and an id hard-coded here would be right on one machine.
 *
 * IT IS ALSO WHY AN EMPTY `relationship_types` IS SURVIVABLE HERE: no matching rows means no
 * children to move, which is the same answer as a member with none. That table was empty for
 * weeks once and `/family-tree` drew a canvas with no edges at all; this function would have
 * gone quiet rather than wrong.
 */
const CHILD_RELATIONSHIPS = ['Son', 'Daughter'] as const

export interface ChapterPropagation {
  /**
   * How many children under eighteen with no account of their own were moved. ZERO IS AN
   * ORDINARY ANSWER — most members have none, and a member whose children's birthdays are not
   * recorded has none this function can see.
   */
  moved: number
  /** Set when the propagation itself failed, having already saved the member's own row. */
  error?: string
}

/**
 * Move every account-less child of `personId` who is under eighteen into `chapterId`.
 *
 * ── WHO FOLLOWS THE PARENT: `user_id IS NULL` **AND** UNDER EIGHTEEN ───────────────
 * BOTH, and the second half arrived on 2026-08-22. The history is worth keeping because the
 * two conjuncts answer different questions and each was once thought to be the whole answer:
 *
 *   * It was `.eq('is_minor', true)` until `20260813000006` dropped that column — a STORED
 *     boolean about age, written once by the retired `addChild`, wrong from the morning the
 *     child turned eighteen until somebody noticed.
 *   * It became `user_id IS NULL` alone, on the argument that the rule is really "somebody who
 *     cannot set their own chapter". That is necessary and it is not sufficient: a
 *     twenty-five-year-old cousin recorded on the tree with no email address has no account
 *     either, and moving THEIR chapter because their father moved his is the household concept
 *     this product does not have.
 *
 * So the age test is back and it is a DERIVATION rather than a column — `minorCutoff` from
 * `lib/age-utils.ts`, which is the same rule `computeIsMinor` applies one row at a time. AN
 * UNRECORDED BIRTHDAY DOES NOT MOVE: `> NULL` is never true in SQL, exactly as
 * `computeIsMinor(null)` is false, so somebody nobody has recorded a birthday for stays where
 * they are. That is the honest direction — "under 18" is something the family has said about a
 * person, not something to assume about a row with a blank field — and `moved` is reported to
 * the caller, so a family that records no birthdays sees zero rather than being told nothing.
 *
 * ── IT REPORTS, AND THE CALLER DECIDES WHAT THAT MEANS ─────────────────────────────
 * `moved` and an optional `error`, rather than a thrown exception or a swallowed one. The
 * member's own row has already been written by the time this runs, so a failure here is a
 * PARTIAL success and neither caller may report it as an outright one — which is the §8b shape
 * with the stakes reversed: what was silent was the propagation not happening, so the fix has
 * to make it sayable.
 *
 * `.select('id')` on the write is what makes `moved` a fact rather than a guess: PostgREST
 * answers an UPDATE that matched nothing with `{ error: null }`, so a count is the only thing
 * in the response that moves.
 */
export async function propagateChapterToChildren(
  personId: string,
  familyCode: string,
  chapterId: string | null,
): Promise<ChapterPropagation> {
  if (!personId || !familyCode) return { moved: 0 }

  const admin = createAdminClient()

  const { data: types, error: typesError } = await admin
    .from('relationship_types')
    .select('id')
    .in('name', CHILD_RELATIONSHIPS)
  if (typesError) {
    return { moved: 0, error: `Could not read relationship types: ${typesError.message}` }
  }
  const typeIds = (types ?? []).map(t => (t as { id: string }).id)
  if (!typeIds.length) return { moved: 0 }

  // §3 by hand on the read as well as the write. `person_relationships` carries a
  // `family_code` of its own, and without this conjunct a `personId` from another family would
  // return that family's children — whose ids then go into the `.in()` below.
  const { data: rels, error: relsError } = await admin
    .from('person_relationships')
    .select('related_person_id')
    .eq('person_id', personId)
    .eq('family_code', familyCode)
    .in('relationship_type_id', typeIds)
  if (relsError) {
    return { moved: 0, error: `Could not read children: ${relsError.message}` }
  }

  const childIds = (rels ?? []).map(r => (r as { related_person_id: string }).related_person_id)
  if (!childIds.length) return { moved: 0 }

  const { data: moved, error } = await admin
    .from('people')
    .update({ chapter_id: chapterId })
    .in('id', childIds)
    // §3: the ids came from a family-scoped read, so this is belt on that brace — and it is
    // the conjunct that matters if that read is ever widened.
    .eq('family_code', familyCode)
    // The rule, both halves. A child who has claimed an account sets their own chapter; an
    // adult child sets their own whether they have one or not.
    .is('user_id', null)
    // UNDER EIGHTEEN, as one filter rather than a sieve in TypeScript — and NULL is excluded
    // by the comparison itself, which is the same answer `computeIsMinor` gives for a birthday
    // nobody has recorded. `todayLocal()` is read here rather than taken as a parameter
    // because this function already reaches the network and is not the pure module §7b is
    // about; the arithmetic that IS testable lives in `minorCutoff`.
    .gt('date_of_birth', minorCutoff(todayLocal()))
    .select('id')
  if (error) return { moved: 0, error: error.message }

  return { moved: (moved ?? []).length }
}
