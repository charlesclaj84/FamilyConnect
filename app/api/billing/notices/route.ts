import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

import { drainBillingNotices } from '@/lib/billing/notices'

/**
 * The mail half of the billing ladder — the only thing that can send a dunning or retention
 * notice.
 *
 * ── WHY THIS EXISTS AT ALL, AND WHY IT IS NOT `pg_cron` ────────────────────────────
 * `20260901000002` §E argues it: the sweep owns the STATE and cannot send email, because that
 * would need `http` or `pg_net` and neither is installed (TODO.md carries both, and putting an
 * outbound HTTP call inside a transaction that also deletes a family tree is not something to
 * do casually). So the queue sits between them, and this drains it.
 *
 * It DECIDES NOTHING. Every row it sends was queued by the sweep, on a date the sweep
 * computed, and this route cannot make a family delinquent, move a tier or delete a row.
 *
 * ── THE CONSEQUENCE OF IT NEVER RUNNING IS SAFE, AND THAT IS DELIBERATE ───────────
 * Both deletion paths refuse to act unless the notices they owed are recorded as `sent`. So an
 * unset secret, a missed schedule or a mail outage DELAYS a deletion indefinitely — it never
 * causes one. A family tree is not destroyed on the strength of an email nobody received.
 *
 * ── AUTHORIZATION IS A BEARER SECRET, AND THE REASON IT IS NOT A SIGNATURE ────────
 * `/api/stripe/*` verifies a Stripe signature because Stripe is the sender and signs. Here the
 * sender is a scheduler with no signing scheme, so the check is a shared secret in
 * `CRON_SECRET` — which is the variable Vercel Cron sets on its own requests, so the scheduled
 * caller needs no configuration beyond the variable existing.
 *
 * COMPARED IN CONSTANT TIME, because a naive `===` on a secret leaks its prefix to anybody
 * willing to time a few thousand requests. `timingSafeEqual` refuses mismatched lengths, so
 * the length is checked first and a mismatch answers the same 401 as a wrong secret.
 *
 * ── WITH NO SECRET SET, IT REFUSES RATHER THAN RUNNING OPEN ───────────────────────
 * A deployment that has not been configured must not have a mail-sending endpoint reachable by
 * anybody. The failure is a 503 that names the variable, so the GO LIVE step is discoverable
 * from the endpoint itself rather than only from a checklist.
 *
 * ── RUNTIME AND CACHE, FOR THE STRIPE ROUTES' REASONS ─────────────────────────────
 * `nodejs` because `@supabase/supabase-js` and the mail path want it; `force-dynamic` because a
 * cached response is a drain that never ran and would look exactly like one that succeeded.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  const offered = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (offered.length !== secret.length) return false
  // Constant time over equal-length strings. `crypto` rather than a comparison operator, for
  // the reason in the header — and `Buffer` because this route is `nodejs`.
  const a = Buffer.from(offered)
  const b = Buffer.from(secret)
  return timingSafeEqual(a, b)
}

async function drain(request: NextRequest): Promise<Response> {
  if (!process.env.CRON_SECRET) {
    console.error('[billing] CRON_SECRET is not set; the notice drain is refusing to run')
    return Response.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }
  if (!authorized(request)) {
    return Response.json({ error: 'Not authorized' }, { status: 401 })
  }

  try {
    const result = await drainBillingNotices()
    // LOGGED EVEN WHEN IT DID NOTHING. A quiet queue and a broken drain look identical from
    // outside, and this is the only line that tells them apart.
    console.log(
      `[billing] drained ${result.claimed} notice(s): ${result.sent} sent, ${result.failed} failed`,
    )
    return Response.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[billing] the notice drain failed: ${message}`)
    // 500 SO THE SCHEDULER RECORDS A FAILURE. Every claimed row is already back to `pending`
    // or `failed` through `finish_platform_billing_notice`, and the stale-claim window in
    // `claim_platform_billing_notices` recovers anything this died holding.
    return Response.json({ error: 'drain failed' }, { status: 500 })
  }
}

/**
 * GET, because that is what Vercel Cron issues.
 *
 * POST is offered as well so the endpoint can be driven by hand during a GO LIVE check without
 * a scheduler — the same body, the same secret, the same result. There is nothing unsafe about
 * a GET here despite the side effect: the request is authenticated, and a scheduler that
 * retried it would find an empty queue, which is what the claim makes idempotent.
 */
export async function GET(request: NextRequest): Promise<Response> {
  return drain(request)
}

export async function POST(request: NextRequest): Promise<Response> {
  return drain(request)
}
