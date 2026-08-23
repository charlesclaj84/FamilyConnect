/**
 * `next/server` outside a Next.js runtime.
 *
 * `next/server` cannot be resolved by bare Node at all — its package export map is
 * conditioned on a runtime Next sets, so importing it here fails with
 * "Cannot find module .../next/server", which surfaces as a HARNESS error rather than as a
 * test failure. That is how this stub came to exist: `lib/meta/dispatch.ts` imports `after`
 * to take the Conversions API call off the critical path, and three `my-families` cases
 * turned red the moment it did.
 *
 * ── THE CALLBACK IS RUN, NOT DISCARDED ──────────────────────────────────────────────
 * Discarding it would be the easier stub and would quietly hide anything the deferred work
 * does — which for `dispatch` includes claiming a row in the conversion ledger and settling
 * it. The suite calls real actions against a real database precisely so that the parts
 * nobody looks at still run; a stub that swallowed them would be testing a shorter function
 * than the one that ships.
 *
 * Errors are swallowed, because that is what the real `after` does with them: it runs after
 * the response has been sent, so a throw there cannot reach the caller. A stub that
 * propagated one would fail an action that succeeds in production.
 *
 * Calls are recorded, following `next-cache.mjs`: a test can then assert that an action
 * reached its deferred work at all.
 */
export const calls = []

export function after(callback) {
  calls.push({ fn: 'after' })
  try {
    const result = typeof callback === 'function' ? callback() : callback
    // `after` accepts a promise as well as a function. Neither is awaited by the real
    // implementation from the caller's point of view, so a rejection is absorbed here the
    // same way it is there.
    if (result && typeof result.catch === 'function') result.catch(() => {})
  } catch {
    /* See above. */
  }
}

/**
 * `connection()` is the other export an action might reach for. Present so that adding one
 * does not produce the same harness error this file was written to fix.
 */
export async function connection() {}

export function reset() {
  calls.length = 0
}
