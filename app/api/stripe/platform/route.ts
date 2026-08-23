import type { NextRequest } from 'next/server'

import { handlePlatformEvent } from '@/lib/stripe/platform-events'
import { handleStripeWebhookRequest } from '@/lib/stripe/webhook-route'
import { applyDuePlatformTierChanges } from '@/lib/stripe/tier-sweep'

/**
 * Stripe's deliveries about GENORRA's OWN account — a family paying for its plan.
 *
 * Point the endpoint at `https://genorra.com/api/stripe/platform` and subscribe it to
 * `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
 * `checkout.session.async_payment_failed`, `invoice.paid`, `invoice.payment_failed` and
 * `customer.subscription.created|updated|deleted`. Its signing secret is
 * `STRIPE_PLATFORM_WEBHOOK_SECRET`, and it is NOT the Connect endpoint's — see
 * `lib/stripe/webhook.ts` for why one shared secret would make the two indistinguishable.
 *
 * ── THIS IS THE FIRST `app/api` ROUTE IN THE PRODUCT, AND `proxy.ts` HAD TO LEARN ───
 * That matcher used to run for every path but static assets, which meant a webhook delivery
 * did a GoTrue `getUser()` round trip before reaching this file — pointless for a request that
 * carries no cookie, and one more thing between Stripe's three-day retry window and a payment
 * being recorded. `/api` is excluded there now, with the reason written beside it.
 *
 * ── THE RUNTIME AND THE CACHE ARE BOTH LOAD-BEARING ────────────────────────────────
 * `nodejs`, because `stripe` and `@supabase/supabase-js` both want it and because signature
 * verification here reads the raw body through Node's own crypto path. `force-dynamic`, because
 * a cached webhook response is a delivery that never ran — and it would look exactly like one
 * that succeeded.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return handleStripeWebhookRequest(request, 'platform', async event => {
    const outcome = await handlePlatformEvent(event)

    // ── THE POOR MAN'S SCHEDULER, AND IT SAYS SO ─────────────────────────────────────
    // Two things come due with nobody watching: a scheduled downgrade, and a prepaid term
    // running out. There is no cron in this product — TODO.md carries `pg_cron` as one
    // migration's work — so the sweep is called here, at the end of every delivery.
    //
    // For the RECURRING case that is exact rather than approximate: the renewal invoice IS the
    // period boundary, so the event that would apply a scheduled change is the event that
    // arrives on the day. For a PREPAID term it is a genuine gap — it fires only when some
    // other family's payment happens to arrive, and a product with no families paying would
    // never sweep at all. Stated rather than hidden, because the failure is a family keeping a
    // tier they stopped paying for, which nothing on any screen would report.
    //
    // AFTER the handler and never before: the handler may have just cleared the very schedule
    // this would otherwise apply, and it must not be able to run against a half-applied
    // payment. Its result does not affect the response — a sweep failure is not a reason for
    // Stripe to redeliver a payment that has already been recorded.
    await applyDuePlatformTierChanges()

    return outcome
  })
}
