/**
 * `next/headers` outside a Next.js runtime.
 *
 * Like `next/server`, this module cannot be RESOLVED by bare Node — its package export map
 * is conditioned on a runtime Next sets — so an import of it fails as a harness error rather
 * than as a test failure. `lib/meta/dispatch.ts` and `lib/meta/attribution-store.ts` both
 * import it, which is what made this stub necessary.
 *
 * ── IT THROWS, DELIBERATELY, RATHER THAN ANSWERING EMPTY ────────────────────────────
 * That is what the real `cookies()` and `headers()` do when there is no request in scope,
 * and it is what the code under test is written against: `trackServerEvent` wraps both in a
 * try/catch precisely so that a call made from a background context — a payment webhook
 * processed out of band — still sends its event with the identity the caller supplied and
 * no browser signals.
 *
 * Returning empty stores would be the easier stub and would silently take that branch out
 * of the suite: every action would take the "there is a request, it just has no cookies"
 * path, and the branch that actually runs in production for a webhook would never execute
 * here. A stub should not turn a code path this suite is meant to exercise into one it
 * cannot reach.
 *
 * `@/lib/supabase/server` is stubbed separately (see hooks.mjs) and does not come through
 * here, so nothing that needs a session is affected by this throwing.
 */
function noRequestScope(fn) {
  return () => {
    throw new Error(
      `\`${fn}()\` was called outside a request scope. In tests/rls there is no request; `
      + 'the code under test is expected to handle this.',
    )
  }
}

export const cookies = noRequestScope('cookies')
export const headers = noRequestScope('headers')
export const draftMode = noRequestScope('draftMode')
