import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * WHO IS CALLING — resolved ONCE per request.
 *
 * ── WHY THIS EXISTS: `getUser()` IS A NETWORK CALL ──────────────────────────────────
 * `supabase.auth.getUser()` does not read a cookie and decode it; it asks GoTrue to verify the
 * JWT, which is exactly why it is the function to use on a server and `getSession()` is not.
 * The cost is a round trip, every time, and this codebase was making a lot of them: 135
 * identical call sites, none deduplicated, so ONE page render asked "who is this?" eight to
 * fifteen times and got the same answer every time.
 *
 * Measured 2026-08-26 against the hosted project from a laptop: ~150 ms per call, ~240 ms for a
 * PostgREST select, against ~8 ms and ~10 ms on the local stack. The three SERIAL ones on a page
 * load — the layout, `TopBar`, the page itself — were about 450 ms of that on their own. In
 * production the app and the database sit in one region, so the per-call figure is more like
 * 5–20 ms; the win is smaller there and still worth having, and it is a floor that scales with
 * however many guards a screen ends up behind.
 *
 * ── IT IS ALSO A CORRECTNESS FIX, WHICH IS THE BETTER ARGUMENT ──────────────────────
 * Ten independent `getUser()` calls in one render can disagree. A token rotating mid-request or
 * a single GoTrue blip meant the layout could resolve one caller and the page another — or one
 * of them `null` — and every gate downstream would then be answering about a different person
 * from the one the shell had already drawn. Deduplicating makes one request have one caller, by
 * construction, which is a property no amount of care at 135 call sites could provide.
 *
 * That extends to the FAILURE too: the error is cached with the answer, so a request that could
 * not verify the session fails the same way everywhere in it rather than half-succeeding.
 * `lib/auth/guard.ts` deliberately does not retry, for the reason its own header gives; this
 * keeps that decision from being quietly undone by the next caller trying again.
 *
 * ── `cache()` IS PER REQUEST. A MODULE-LEVEL MEMO HERE WOULD BE A SECURITY HOLE ──────
 * React's `cache()` is scoped to one request through Next's AsyncLocalStorage — that is the
 * whole reason it is safe to memoise an IDENTITY at all. A `let cachedUser` at module scope, or
 * a `Map` keyed on anything, would hand one member's identity to the next request the same
 * server process happened to handle. **Never replace this with anything that outlives a
 * request**, and never add a parameter to it: an argument would make it a lookup keyed on
 * caller-supplied data, which is §2b's rule about never taking an identity as a parameter.
 *
 * The precedent is already here — `getMyPermissionSet`, `getMyFamilies`, `resolveLocale` and
 * `staffGrant` are all `cache()`d the same way and are all reached from server actions as well
 * as from renders, so the mechanism is established rather than being tried out on this.
 *
 * ── AND IT WAS MEASURED, NOT ASSUMED ────────────────────────────────────────────────
 * A green run is not evidence (AGENTS.md §7), and "React dedupes this" is exactly the kind
 * of claim that is true of the library and false of your wiring. Verified 2026-08-26 against
 * the local stack with a throwaway route calling this three times and a probe on the GoTrue
 * call, all three numbers taken from the dev server's own log:
 *
 *   three calls in one render, WITH `cache()`      1 round trip
 *   the same route on a SECOND request            1 more, never shared with the first
 *   three calls in one render, `cache()` REMOVED  3 round trips
 *
 * The middle line is the security half and is the one worth re-checking if this file ever
 * changes: two requests must never see each other's caller. The last line is the negative
 * control — without it the first would be evidence of nothing.
 *
 * ── WHAT IS NOT CACHED, AND WHY ─────────────────────────────────────────────────────
 * `createClient()` is left alone. It awaits `cookies()` and constructs an object — no network,
 * so there is nothing to save — and its `setAll` closure writes cookies, which is not a thing to
 * start sharing between callers in one request on a performance argument worth nothing.
 *
 * ── USING IT ────────────────────────────────────────────────────────────────────────
 *     const { user } = await currentUser()
 *     if (!user) redirect('/login')
 *
 * Callers that still need a client for their queries keep their own `createClient()`; this
 * replaces the `getUser()` call, not the client.
 */
export const currentUser = cache(async (): Promise<{
  user: User | null
  /** GoTrue's message when the session could not be VERIFIED — distinct from being signed out. */
  error: string | null
}> => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user: user ?? null, error: error?.message ?? null }
})
