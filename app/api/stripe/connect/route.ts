import { NextResponse, type NextRequest } from 'next/server'

import { handleConnectEvent } from '@/lib/stripe/connect-events'
import { connectAccountOf } from '@/lib/stripe/webhook'
import { handleStripeWebhookRequest } from '@/lib/stripe/webhook-route'

/**
 * Stripe's deliveries about a FAMILY's own connected account — a relative paying their dues.
 *
 * Point a **Connect** endpoint (not an account endpoint) at
 * `https://genorra.com/api/stripe/connect` and subscribe it to
 * `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
 * `checkout.session.async_payment_failed`, `invoice.paid`,
 * `customer.subscription.updated|deleted`, `account.updated` and — since 2026-08-31 —
 * `charge.succeeded` and `charge.updated`. Its signing secret is
 * `STRIPE_CONNECT_WEBHOOK_SECRET`.
 *
 * ── THE TWO CHARGE EVENTS ARE WHAT RECORD THE PROCESSING FEE, AND FORGETTING THEM IS SILENT ──
 * `settleChargeFee` is the only thing that ever writes `stripe_charge_fees`, and it runs only
 * from those two. An endpoint that is not subscribed to them keeps working perfectly: members
 * pay, dues are credited, funds are routed — and the family's fee is never recorded, their
 * fund balances stay overstated by it forever, and the P&L's processing-fee line reads $0.00
 * over money Stripe demonstrably took. Nothing errors and nothing logs, because from this
 * app's side no event ever arrived.
 *
 * BOTH, not one. The balance transaction — the only place the real fee lives — can be absent
 * on `succeeded` and present on `updated`, so subscribing to one of them records the fee for
 * some charges and not others, for a reason nobody could see from here.
 *
 * ── THE `account` FIELD IS THE FAMILY-SCOPING KEY, SO ITS ABSENCE IS FATAL ──────────
 * Every Connect delivery carries `account` — the `acct_…` the thing happened on — and
 * `family_stripe_accounts.stripe_account_id` is UNIQUE so it maps to exactly one family. That
 * is the whole of how AGENTS.md §3's obligation is discharged on a path with no session and no
 * caller: there is nothing else here that could say which family a charge belongs to.
 *
 * So an event with no `account` is REFUSED rather than processed as though it were about
 * GENORRA's own account. It should be impossible — a Connect endpoint receives connected-account
 * events by definition — and the one way it becomes possible is somebody pointing the PLATFORM
 * endpoint's events at this URL, which is precisely the mix-up that must not silently credit a
 * family's ledger with our own revenue.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return handleStripeWebhookRequest(request, 'connect', async event => {
    const accountId = connectAccountOf(event)
    if (!accountId) {
      // 500 through the `handled: false` path, so Stripe redelivers. A misconfiguration is
      // worth being noisy about, and this is the one shape where being quiet would mean a
      // platform event being interpreted as a family's.
      return {
        handled: false,
        detail: `${event.type} arrived on the Connect endpoint with no account — check which endpoint this URL is bound to`,
      }
    }
    return handleConnectEvent(event, accountId)
  })
}

/**
 * A GET here is somebody pasting the URL into a browser, which happens while wiring an
 * endpoint up. Answering 405 rather than 404 says the route exists and wants a POST, which is
 * a materially more useful thing to see at that moment.
 */
export function GET() {
  return NextResponse.json({ error: 'This endpoint accepts POST from Stripe only.' }, { status: 405 })
}
