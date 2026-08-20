/**
 * Supabase Storage, spoken to directly, as the current actor.
 *
 * ── WHY THIS EXISTS: A SECOND ACCESS-CONTROL SYSTEM THE SUITE COULD NOT SEE ─────────
 * `cases.mjs`'s `UNCOVERED` list named the four upload actions from Phase 3 until today,
 * with the right reason: they take a `FormData` carrying a file and write to Storage, whose
 * buckets and policies are a **separate** access-control system from the composed RLS
 * policies this suite was built for. Nothing in `20260618000001`'s sweep touches
 * `storage.objects`, `npm run audit:family-scope` does not look at it, and §2c's whole
 * argument — that RLS is the entire boundary on a `public` table — says nothing about a
 * bucket. So the suite was silent about whether one family could read or overwrite
 * another's files.
 *
 * It was not silent because the question was small. `20260820000002` found that any
 * signed-in user could overwrite any other user's avatar — in a PUBLIC bucket, so not
 * "replace a file" but *choose the picture the whole family sees under somebody else's
 * name* — and that hole had been open since `20260609000000`. It was found by reading a
 * migration, not by a test, and this module is what would have found it.
 *
 * ── IT SUBSTITUTES NOTHING, exactly as raw.mjs does not ─────────────────────────────
 * `hooks.mjs` allows itself three substitutions and no more. This adds none: the client
 * comes from `stubs/supabase-server.mjs`, so the cookie-to-JWT plumbing stays in one place,
 * and the token is a real one issued by the real local GoTrue. `storage.objects` policies
 * are evaluated against a genuine `auth.uid()` — which is the entire subject here, because
 * every avatar policy is written in terms of it.
 *
 * ── WHY SOME PROBES REACH PAST THE ACTIONS ──────────────────────────────────────────
 * `uploadAvatar` always writes `{auth.uid()}/avatar.{ext}`. It CANNOT express the attack
 * that matters — an object aimed at somebody else's folder — because the path is computed
 * from the caller's own id and never from a parameter. That is a good property of the
 * action and it means the policy underneath it is unreachable from an action-shaped test,
 * the same structural blind spot `raw.mjs` was written for. So the cases come in pairs: the
 * ACTION is called for the ordinary path, and these probes are what aim at the other
 * folder.
 *
 * ── THE ERROR IS THE ASSERTION, SO IT IS NEVER DISCARDED ─────────────────────────────
 * And here it matters more than for PostgREST, because Storage's failure modes are less
 * uniform: an RLS refusal on `storage.objects` surfaces as a 403 with
 * `new row violates row-level security policy`, a missing object as a 400 `Object not
 * found`, and — the one that catches people — `remove()` on a path no policy admits
 * answers **200 with an empty array**, not an error. A probe that returned only `error`
 * would report that deletion as a success. So `removeFrom` returns the NAMES it actually
 * removed and a case asserts on the count.
 */
import { createClient } from '../stubs/supabase-server.mjs'

/** A tiny, valid-enough payload. Storage stores bytes; no bucket here inspects them. */
function body(text = 'genorra-rls-probe') {
  return new Blob([text], { type: 'image/jpeg' })
}

/**
 * PUT an object at an exact path, as the current actor.
 *
 * `upsert: true` deliberately: the attack this is mostly used for is OVERWRITING somebody
 * else's file, and with `upsert: false` a refusal would be ambiguous — "the policy said no"
 * and "something is already there" both come back as an error, and the second would let a
 * wide-open bucket look protected purely because the victim already had an avatar.
 */
export async function uploadTo(bucket, path, text) {
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, body(text), { upsert: true, contentType: 'image/jpeg' })
  return { path: data?.path ?? null, error: error ?? null, message: error?.message ?? null }
}

/**
 * GET an object's bytes, as the current actor.
 *
 * For a PUBLIC bucket this says nothing — anybody with the URL can read it, which is what
 * public means, and narrowing that is a product decision `20260820000002` deliberately did
 * not take. It is the assertion that matters for a PRIVATE bucket (`documents`), where the
 * read policy is the only thing standing between one family's files and another's.
 */
export async function downloadFrom(bucket, path) {
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(bucket).download(path)
  return { bytes: data ? (await data.arrayBuffer()).byteLength : 0, error: error ?? null }
}

/**
 * DELETE objects, as the current actor.
 *
 * `removed` is the count Storage says it actually removed, and it is the assertion — see
 * the header. A refused delete is a 200 and an empty array, so `error === null` proves
 * nothing at all here.
 */
export async function removeFrom(bucket, paths) {
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(bucket).remove(paths)
  return { removed: (data ?? []).length, names: (data ?? []).map(o => o.name), error: error ?? null }
}

/**
 * MOVE an object, as the current actor.
 *
 * The one probe with no counterpart in any action, and the reason `20260820000002` put a
 * `WITH CHECK` on its UPDATE policy as well as a `USING`: without the second half an owner
 * may reach their own object (USING) and rename it into somebody else's folder (no CHECK),
 * which is the overwrite hole by another route. Nothing in the app moves an object, so this
 * policy half has no call site and is exactly the kind of thing that rots unnoticed.
 */
export async function moveWithin(bucket, from, to) {
  const supabase = await createClient()
  const { error } = await supabase.storage.from(bucket).move(from, to)
  return { error: error ?? null, message: error?.message ?? null }
}

/**
 * Upload to a path of your own, then try to move it somewhere it should not go.
 *
 * ONE FUNCTION FOR BOTH STEPS, because a case's `setup` runs with no actor and would have to
 * plant the source object as the service role — which leaves `owner` NULL, and then a refused
 * move could be the SOURCE being unreachable rather than the DESTINATION being forbidden. The
 * case would pass for the wrong reason and would go on passing after the `WITH CHECK` half of
 * the policy was deleted.
 *
 * `uploaded` is returned so the case can assert the first step worked. Without that assertion
 * a missing source looks exactly like a working policy.
 */
export async function moveOwnInto(bucket, ownPath, targetPath) {
  const supabase = await createClient()
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(ownPath, body('mine'), { upsert: true, contentType: 'image/jpeg' })
  if (upErr) return { uploaded: false, uploadError: upErr.message, moveError: null }

  const { error } = await supabase.storage.from(bucket).move(ownPath, targetPath)
  return { uploaded: true, uploadError: null, moveError: error ? error.message : null }
}

/**
 * LIST a prefix, as the current actor.
 *
 * `list` is a SELECT on `storage.objects` under the covers, so it is refused the same way a
 * download is — but it returns `[]` rather than an error, so the count is the assertion.
 * Used for the enumeration question a download cannot ask: whether one family can discover
 * what another family has uploaded, which is a smaller leak than reading the files and is
 * still a leak.
 */
export async function listIn(bucket, prefix) {
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(bucket).list(prefix)
  return { count: (data ?? []).length, names: (data ?? []).map(o => o.name), error: error ?? null }
}
