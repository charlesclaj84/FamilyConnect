/**
 * A write that changed nothing is a failed write, and must be reported as one.
 *
 * ── THE DEFECT THIS CLOSES ──────────────────────────────────────────────────────────
 * `create`, `edit` and `delete` default to scope `'none'` on a permission template, and the
 * composed RLS policies (`20260618000001`) honour that — so a plain member's UPDATE or
 * DELETE matches **zero rows**. PostgREST does not treat an empty match as an error, and
 * supabase-js therefore hands back `{ error: null }`. An action whose only failure signal is
 * `error` then returns `{ success: true }` over a write that did not happen:
 *
 *     const { error } = await supabase.from('photos').delete().eq('id', id)
 *     if (error) return { success: false, message: error.message }
 *     return { success: true }                      // ← a lie whenever 0 rows matched
 *
 * The member-visible version of that is somebody deleting a photograph, being told it went,
 * and finding it still there on reload — with nothing anywhere to explain why, because from
 * the database's point of view nothing went wrong. Verified against a local database: the
 * same calls work once the caller is granted the resource at scope `'any'`, so the cause is
 * the missing grant and not the action.
 *
 * ── WHY IT IS NOT ENOUGH TO ASK FOR AN ERROR ────────────────────────────────────────
 * `.select()` on a mutation is what turns the no-op into an answer: it asks PostgREST for
 * `Prefer: return=representation`, so `data` is the rows the statement actually touched and
 * `data.length === 0` is the thing to test. That is the whole mechanism, and the reason it
 * lives in one module rather than at each call site is the reason `pickProfileColumns` does:
 * a rule applied by hand at five sites is applied at three of them within a year.
 *
 * ── THE RETRY, AND WHY IT IS ONE AND NOT A LOOP ─────────────────────────────────────
 * The write is attempted a second time before anybody is told it failed. That is not
 * optimism about permissions — an RLS refusal will refuse again identically, and one wasted
 * round trip on an already-failing path costs nothing. It is aimed at the OTHER reason a
 * write comes back empty: a transient PostgREST error, a dropped connection, a pooler
 * hiccup. Those are indistinguishable from a refusal at this layer and they recover on a
 * retry, so retrying makes the failure message mean "this really will not save" rather than
 * "something happened once".
 *
 * One retry, not a loop with a backoff: a server action is a request somebody is waiting on,
 * and the second identical answer is already conclusive for the permission case, which is
 * the common one.
 *
 * ── THIS IS FOR UPDATE AND DELETE. NEVER FOR INSERT ─────────────────────────────────
 * The retry is only safe because the writes it repeats are idempotent — an UPDATE writes the
 * same values twice, and a second DELETE of the same row matches nothing. An INSERT is not:
 * a retry after a first attempt that actually succeeded but was reported badly would create
 * a second row. Nothing enforces that boundary at the type level, so it is a rule:
 *
 *   * UPDATE / DELETE  → route through `confirmWrite`.
 *   * INSERT           → do not. An INSERT refused by RLS raises 42501 and is already
 *                        surfaced honestly, which is why `tagPersonInPhoto` was the one row
 *                        in TODO.md's table that reported the truth while its two
 *                        neighbours did not.
 *
 * ── THE ONE FALSE-NEGATIVE, STATED RATHER THAN DISCOVERED ───────────────────────────
 * `return=representation` reads the affected rows back THROUGH the SELECT policy. So a
 * caller who may write a row and may not read it gets `[]` from a write that genuinely
 * landed, and is told it did not — plus one redundant (idempotent) repeat.
 *
 * That inverse is rare here and worth knowing why: `view` falls back to `'everyone'` for a
 * non-admin resource while `create`/`edit`/`delete` fall back to `'none'`, so the ordinary
 * shape is read-without-write. A family would have to positively grant edit and positively
 * withhold view on the same resource to produce it. If a surface ever needs to work under
 * exactly that grid, the answer is not to widen this helper — it is for that action to check
 * its own permission before writing, which is what a guard is for.
 */

/**
 * One attempt at a write, as a thunk.
 *
 * A thunk rather than a builder, because a supabase-js query builder is a thenable that
 * resolves once — awaiting the same object twice does not re-issue the statement, so the
 * retry has to be able to build a fresh one.
 */
export type WriteAttempt<T> = () => PromiseLike<{
  data: T[] | null
  error: { message: string } | null
}>

/**
 * `rows` is the representation PostgREST returned — the rows the statement actually touched.
 *
 * Handed back rather than counted, because on a DELETE it is the last chance to read the row
 * that has just gone. `deletePhoto` uses it for exactly that: the object path it then removes
 * from Storage comes from the deleted row itself, so a mismatched `filePath` from the client
 * cannot aim the delete at a different photograph's file — the shape `deleteDocument` fixed by
 * ignoring its `filePath` parameter outright.
 */
export type WriteOutcome<T> =
  | { ok: true; rows: T[] }
  | { ok: false; message: string }

/**
 * What a caller is told when two attempts both changed nothing.
 *
 * ── WHY IT NAMES PERMISSION WITHOUT ASSERTING IT ────────────────────────────────────
 * At this layer the two causes are genuinely indistinguishable: a scope of `'none'` and a
 * row that is not there both come back as zero rows. So the sentence says what is certainly
 * true ("not saved"), gives the action that fixes the transient case ("try again"), and
 * names the likely cause without claiming it. "Not authorized" would be a guess, and would
 * read as an accusation on the day the real cause was a deleted row.
 *
 * It is exported so the RLS suite can assert on the outcome rather than on a string it
 * retypes, which is the same argument `SWEEP_NOTIFICATION_TITLE` makes in that fixture.
 */
export const WRITE_NOT_SAVED =
  'That change was not saved. Try again — if it keeps happening, you may not have '
  + 'permission to change this, and a family administrator can grant it.'

/**
 * Run a write, confirm it touched something, and retry once before reporting failure.
 *
 * `attempt` must end in `.select(...)` — without it PostgREST returns no representation,
 * `data` is null, and every call would report a failure. There is no way to check that from
 * here, so it is asserted at the call sites by convention and caught by the positive control
 * in `tests/rls`: an action whose own family's member can no longer perform it fails loudly.
 */
export async function confirmWrite<T>(attempt: WriteAttempt<T>): Promise<WriteOutcome<T>> {
  const first = await attempt()
  if (!first.error && (first.data?.length ?? 0) > 0) {
    return { ok: true, rows: first.data! }
  }

  const second = await attempt()
  if (!second.error && (second.data?.length ?? 0) > 0) {
    return { ok: true, rows: second.data! }
  }

  // The SECOND attempt's error is the one reported, deliberately. If the first failed
  // transiently and the second failed for a real reason, the real reason is the useful one;
  // and where both are the same refusal the two messages are identical anyway.
  return { ok: false, message: second.error?.message ?? WRITE_NOT_SAVED }
}
