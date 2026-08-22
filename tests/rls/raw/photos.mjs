/**
 * The photo WRITE policies, reached straight through PostgREST — and what they turn out to be
 * held shut BY, which is not what they say.
 *
 * ── THE POLICIES THESE PROBE, AND WHAT WAS WRONG WITH THEM ──────────────────────────
 * Until `20260822000013` the five write policies on `photos`, `photo_collections` and
 * `photo_tags` all began with a dead conjunct:
 *
 *     USING (((uploader_id IN (SELECT id FROM people WHERE user_id = auth.uid())) OR true)
 *            AND <permission predicate>)
 *
 * `X OR true` is `true`, so what those five actually said was a permission check with no
 * `family_code` in it at all. Any caller holding `review/photos:delete` at scope 'any' — which
 * every family's own administrator holds by default — matched every row in the product.
 *
 * ── AND YET THESE PROBES CANNOT SEE THE DIFFERENCE. THAT IS THE FINDING ─────────────
 * Written expecting them to go red under the old policy, they did not: all five stayed green
 * with the `OR true` form restored, and the reason is the rule that makes this module worth
 * reading before writing any other write probe.
 *
 * **PostgreSQL applies the SELECT policies to an UPDATE or DELETE whose WHERE clause
 * references the table's columns**, because reading those rows to find them requires SELECT
 * rights on them. PostgREST cannot express an unfiltered UPDATE or DELETE. So for any caller
 * coming through the API, the SELECT policy is the FLOOR of every UPDATE and DELETE, and a
 * write policy can never be wider in practice than the read policy on the same table.
 *
 * Measured rather than reasoned, as BRAVO's administrator with a real JWT (2026-08-22):
 *
 *   `auth_permission('review/photos','delete')`      ->  'any'   (so the write policy admitted them)
 *   DELETE ?id=eq.<an ALPHA photo>, mutated policy   ->  204, and the row SURVIVES
 *   the same request, `photos` SELECT widened to true ->  204, and the photograph is GONE
 *
 * The third line is the control: nothing changed but the READ policy, and the write landed.
 *
 * ── SO WHAT THESE FIVE CASES ARE EVIDENCE FOR ───────────────────────────────────────
 * The SELECT-policy floor — which nothing in this suite tested before, and which is now the
 * only thing standing between another family's administrator and these five write policies if
 * anybody ever widens a photo read (a shared album, a public gallery). They are NOT evidence
 * for the family conjunct `20260822000013` adds to the write policies: no client-side probe can
 * be, because no client can send the unfiltered statement that would isolate it. That conjunct
 * is asserted in SQL, in the migration's own verify block, which also refuses any policy in the
 * schema containing `OR true`.
 *
 * Said out loud rather than left looking like proof, per AGENTS.md §7 — the same labelling
 * `SWEEP_CASES` uses for the four cases that turned out to be evidence for a different layer
 * than the one they were written for.
 *
 * ── WHY NO `.select()` AND NO `count` ───────────────────────────────────────────────
 * `count: 'exact'` was in the first draft, on `raw.mjs`'s reasoning that a count is the only
 * moving part of a refused write. It is worse than useless here: PostgREST computes the count
 * from a RETURNING clause, which brings the SELECT policy in a second way and makes the
 * response indistinguishable for two different reasons. These probes return the error alone and
 * let the case's `probe` — a service-role snapshot, taken before and after — say what happened
 * to the row. A refusal and a no-op look identical in the response either way; only the row's
 * fate distinguishes them, and only the service role can see it.
 *
 * ── THE FIXTURE ROWS ARE THIS MODULE'S OWN ──────────────────────────────────────────
 * `f.rawCollection`, `f.rawPhoto` and `f.rawPhotoTag`, and both halves of that matter.
 * `photos.deletePhoto`'s positive control genuinely deletes `f.photo`, and these cases are
 * appended after it — so a probe aimed at `f.photo` would be reading a row that is GONE rather
 * than a row it was refused, which is a pass proving nothing. And the UPDATE probes change a
 * caption, so they must not touch a value another case's marker scan reads.
 */
import { createClient } from '../stubs/supabase-server.mjs'

/**
 * UPDATE by id with NO returning clause and NO count, as the current actor.
 *
 * Deliberately not `raw.mjs`'s `rawUpdate`, which DOES call `.select()` — that one exists to
 * reach a guard TRIGGER, where the trigger raises and the returning clause is harmless. Here a
 * returning clause would bring the SELECT policy in twice over (see the header) and leave the
 * response saying nothing at all about which policy refused.
 */
async function updateNoReturn(table, id, patch) {
  const supabase = await createClient()
  const { error } = await supabase.from(table).update(patch).eq('id', id)
  return { error: error ?? null }
}

async function deleteNoReturn(table, filter) {
  const supabase = await createClient()
  let q = supabase.from(table).delete()
  for (const [col, val] of Object.entries(filter)) q = q.eq(col, val)
  const { error } = await q
  return { error: error ?? null }
}

/** DELETE a photograph by id. The sharpest of the five: it destroys a family's record. */
export async function deletePhotoRow(photoId) {
  return deleteNoReturn('photos', { id: photoId })
}

/** UPDATE a photograph's caption. Same policy family, and it rewrites rather than removes. */
export async function updatePhotoCaption(photoId, caption) {
  return updateNoReturn('photos', photoId, { caption })
}

/** UPDATE a collection's name. `photo_collections` carried the identical dead conjunct. */
export async function updateCollectionName(collectionId, name) {
  return updateNoReturn('photo_collections', collectionId, { name })
}

/** DELETE a collection outright — which cascades its photographs. */
export async function deleteCollectionRow(collectionId) {
  return deleteNoReturn('photo_collections', { id: collectionId })
}

/**
 * DELETE a tag. `photo_tags` has no `family_code` of its own, so its repaired policy scopes
 * through the photograph — which makes it the one of the five where the fix could have been
 * written against the wrong column and still looked right.
 */
export async function deletePhotoTag(tagId) {
  return deleteNoReturn('photo_tags', { id: tagId })
}
