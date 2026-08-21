/**
 * PostgREST, spoken to directly, as the current actor.
 *
 * ── WHY THIS EXISTS: THE SUITE HAS A STRUCTURAL BLIND SPOT ──────────────────────────
 * `run.mjs` calls exported server actions — the same functions Next.js publishes as HTTP
 * endpoints — and that is the right subject for almost everything. But it means the suite
 * can only reach a policy some action happens to exercise, and the largest single sweep of
 * policies in this database is reachable by no action at all.
 *
 * `20260806000011` §6 added `auth_membership_approved()` to every policy on the tables
 * where family scoping was the ONLY conjunct — the family tree, the permission grid, the
 * family's own restrictions, the notification table. What that conjunct closes is an
 * applicant, inside the family boundary, reading or writing rows every other test admits
 * them to. And the sharpest of those, `notifications` INSERT, is deliberately written
 * only by `lib/notifications.ts`, a PLAIN module with no URL — precisely so no action
 * exposes it. So the action-shaped suite structurally cannot reach the thing that protects
 * it. AGENTS.md §7 and TODO.md have both recorded that gap since Phase 3; this closes it.
 *
 * ── IT IS NOT A FOURTH SUBSTITUTION ─────────────────────────────────────────────────
 * `hooks.mjs` says it has "three jobs and deliberately no more than three — every extra
 * substitution is a place where the code under test stops being the code that ships". This
 * adds none. It substitutes nothing: it is the TEST speaking PostgREST, which is what a
 * policy is enforced by, using the same JWT the stub already builds. The rule is about not
 * replacing shipped code with a stand-in; there is no shipped code here to replace, and
 * that is the whole point — the probe reaches past the app on purpose.
 *
 * The client comes from `stubs/supabase-server.mjs` rather than being built here, so the
 * cookie-to-JWT plumbing stays in exactly one place. The token is real, issued by the real
 * local GoTrue by `seed.mjs`'s `signIn`, so `auth.uid()` inside every policy resolves to a
 * genuine user.
 *
 * ── THE ERROR IS THE ASSERTION, SO IT IS NEVER DISCARDED ─────────────────────────────
 * AGENTS.md §8's rule with the stakes reversed. In app code an empty result and a refused
 * query are indistinguishable in `data` and that is the bug; here the DIFFERENCE between
 * `42501` (the policy refused the write) and `[]` (the policy matched no rows) is the
 * finding, and a probe that returned only rows would report a refusal and a leak
 * identically. Every function below returns `{ rows, error }` or `{ data, error }` with
 * the error object intact, and `error.code` is what a case asserts on.
 */
import { createClient } from './stubs/supabase-server.mjs'

/**
 * SELECT, as the current actor.
 *
 * `rows` is `[]` on a refusal as well as on an empty match, which is exactly why `error`
 * comes back beside it. A case that cares about the difference must read both.
 */
export async function rawSelect(table, columns = '*') {
  const supabase = await createClient()
  const { data, error } = await supabase.from(table).select(columns)
  return { rows: data ?? [], error: error ?? null, count: (data ?? []).length }
}

/**
 * INSERT, as the current actor. `error.code` says why a refusal was a refusal.
 *
 * ── NO `.select()`, AND THAT IS THE WHOLE CORRECTNESS OF THIS FUNCTION ──────────────
 * PostgreSQL ANDs the SELECT policy into any INSERT carrying a RETURNING clause, and
 * supabase-js's `.select()` is what adds one. `20260812000000` records the same fact from
 * the useful direction — `renameFamily`'s `.select()` turns out to confine its UPDATE to
 * rows the caller may read, which is a second layer nobody asked for.
 *
 * Here it is a hazard rather than a bonus, and it was measured: the notifications probe
 * writes a row addressed to ANOTHER member, and `notifications`' SELECT policy admits only
 * rows addressed to the caller. So with `.select()` the statement failed on the RETURNING
 * even after the INSERT policy had been deliberately neutered — the probe reported a
 * refusal, the case passed, and the mutation check said the case was not evidence for the
 * conjunct. It was not evidence for anything: the SELECT policy was doing the work.
 *
 * Without `.select()` there is no RETURNING, so the INSERT policy decides alone, which is
 * the policy the case is about. The row itself is judged by the case's `probe`, which reads
 * through the SERVICE ROLE and sees past every policy — so nothing is lost by not asking
 * PostgREST to hand the row back.
 */
export async function rawInsert(table, row) {
  const supabase = await createClient()
  const { error, status } = await supabase.from(table).insert(row)
  return { data: null, error: error ?? null, status }
}

/**
 * DELETE by an arbitrary column filter, as the current actor.
 *
 * BY FILTER RATHER THAN BY ID, because the tables worth reaching this way do not all have
 * one: `election_nomination_supporters` is keyed (nomination_id, person_id) and has no `id`
 * column at all.
 *
 * NO `.select()`, for `rawInsert`'s stated reason applied to the other verb. PostgreSQL ANDs
 * the SELECT policy into any statement carrying a RETURNING clause, and supabase-js's
 * `.select()` is what adds one — so on a table whose SELECT policy is narrower than its
 * DELETE policy, a probe with `.select()` reports a refusal that came from the wrong policy
 * and the case is not evidence for the conjunct it names. The row's fate is judged by the
 * case's `probe`, which reads through the SERVICE ROLE and sees past every policy.
 *
 * `count: 'exact'` is what makes a refusal distinguishable from a match of nothing: RLS
 * refusing a DELETE is zero rows and `{ error: null }` (AGENTS.md §8b), so `count` is the
 * only thing in the response that moves.
 */
export async function rawDelete(table, filter) {
  const supabase = await createClient()
  let q = supabase.from(table).delete({ count: 'exact' })
  for (const [col, val] of Object.entries(filter)) q = q.eq(col, val)
  const { error, count, status } = await q
  return { error: error ?? null, count: count ?? 0, status }
}

/** UPDATE by id, as the current actor. Used to reach a guard TRIGGER rather than a policy. */
export async function rawUpdate(table, id, patch) {
  const supabase = await createClient()
  const { data, error } = await supabase.from(table).update(patch).eq('id', id).select()
  return { data: data ?? null, error: error ?? null }
}

/**
 * Call a SECURITY DEFINER function through PostgREST, as the current actor.
 *
 * For `auth_permission()`, which is the only way to observe a RESOLUTION rather than a
 * row. It is granted to `authenticated` because the composed policies reference it
 * (`20260806000015` derives those grants from `pg_policies`), so the browser can genuinely
 * make this call — which means asserting on it is asserting on something real rather than
 * on an internal.
 */
export async function rawRpc(fn, args) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(fn, args)
  return { data: data ?? null, error: error ?? null }
}
