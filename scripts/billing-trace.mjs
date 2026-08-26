#!/usr/bin/env node
/**
 * Where did a family's platform payment stop?
 *
 *   npm run billing:trace -- --local ALPHATEST
 *   npm run billing:trace -- --url=https://<ref>.supabase.co --key=<service-role> 4BEZ2S
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────
 * "The payment went green and nothing changed" is the one billing failure a screen cannot
 * explain, because every surface that would report it reads the rows that were never written.
 * The family sees Free, the Billing panel sees no payments, and the checkout genuinely
 * succeeded — Stripe took the money. Everything after that happens in a webhook nobody was
 * watching.
 *
 * There are five places it can stop and they need completely different fixes:
 *
 *   1. Stripe never delivered           the endpoint is not wired to this deployment
 *   2. Delivered, signature refused     STRIPE_PLATFORM_WEBHOOK_SECRET is the wrong one
 *   3. Claimed, handler failed          `last_error` says which handler and why
 *   4. Handled, money recorded          but the tier did not move — `promoteTier`
 *   5. Everything applied               the problem is on a screen, not in the money
 *
 * The first two look identical from inside the database — no row — so this reports them
 * together and says where to look, rather than guessing between them. That is the honest
 * boundary of what a query can answer.
 *
 * ── READ-ONLY, WHICH IS WHAT MAKES IT SAFE AGAINST PRODUCTION ──────────────────────
 * It issues SELECTs and nothing else. The same reasoning as
 * `supabase/scripts/audit_cross_family_refs.sql`, which NOTICEs rather than RAISEs and repairs
 * nothing: the repair for a stuck payment is a judgement about one family's money, and a
 * script that made it automatically would be the worst thing in this directory.
 *
 * ── IT IS NOT A GATE, AND MUST NOT BECOME ONE ──────────────────────────────────────
 * No `verify.yml` step and no non-zero exit for a finding — it exits 1 only when it could not
 * ASK (no credentials, no such family). "This family has not paid" is the ordinary state of
 * every family, so failing on it would make the script useless for the case it exists for.
 */
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const GREEN = s => `\x1b[32m${s}\x1b[0m`
const RED = s => `\x1b[31m${s}\x1b[0m`
const YELLOW = s => `\x1b[33m${s}\x1b[0m`
const DIM = s => `\x1b[2m${s}\x1b[0m`

const args = process.argv.slice(2)
const flag = name => {
  const hit = args.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

const familyCode = args.find(a => !a.startsWith('--'))
if (!familyCode) {
  console.error('Usage: npm run billing:trace -- --local <FAMILY_CODE>')
  process.exit(2)
}

// ── Where to point ──────────────────────────────────────────────────────────
// The same rule `scripts/drop-retired-bucket.mjs` states: nothing is inherited from the
// environment. This one only reads, so the stake is lower — but a trace printed from the
// wrong database is worse than no trace, because it looks like an answer.
let url = flag('url')
let key = flag('key')

if (args.includes('--local')) {
  const raw = execFileSync('npx', ['supabase', 'status', '-o', 'env', '--workdir', ROOT],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true })
  const status = {}
  for (const line of raw.split('\n')) {
    const m = /^([A-Z0-9_]+)="(.*)"\s*$/.exec(line.trim())
    if (m) status[m[1]] = m[2]
  }
  url = status.API_URL
  key = status.SERVICE_ROLE_KEY
}

if (!url || !key) {
  console.error('Need --local, or both --url= and --key= (the service-role key).')
  process.exit(2)
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const money = cents => `$${(cents / 100).toFixed(2)}`

console.log(`\n  family    ${familyCode}`)
console.log(`  database  ${url}\n`)

// ── 1. The family, and what every gate in the product currently reads ───────
const { data: family, error: familyError } = await db
  .from('families')
  .select('family_code, family_name, tier, status')
  .eq('family_code', familyCode)
  .maybeSingle()

if (familyError) {
  console.error(RED(`  Could not read families: ${familyError.message}`))
  process.exit(1)
}
if (!family) {
  console.error(RED(`  No family with code ${familyCode} in this database.`))
  console.error(DIM('  A trace against the wrong project looks exactly like a missing family.'))
  process.exit(1)
}

console.log(`  ${'families.tier'.padEnd(26)} ${GREEN(family.tier)}   ${DIM('← what every gate reads')}`)
console.log(`  ${'families.status'.padEnd(26)} ${family.status}`)

// ── 2. The billing record ───────────────────────────────────────────────────
const { data: account } = await db
  .from('platform_billing_accounts')
  .select('mode, paid_tier, paid_through, subscription_status, cancel_at_period_end, '
    + 'scheduled_tier, scheduled_tier_on, stripe_customer_id, stripe_subscription_id, delinquent_since')
  .eq('family_code', familyCode)
  .maybeSingle()

console.log('')
if (!account) {
  console.log(`  ${YELLOW('platform_billing_accounts')}  no row — nothing has ever been recorded for this family`)
} else {
  for (const [k, v] of Object.entries(account)) {
    console.log(`  ${k.padEnd(26)} ${v === null ? DIM('null') : String(v)}`)
  }
}

// ── 3. The receipts ─────────────────────────────────────────────────────────
const { data: payments } = await db
  .from('platform_payments')
  .select('paid_at, kind, tier, months, amount_cents, covers_from, covers_through, stripe_ref')
  .eq('family_code', familyCode)
  .order('paid_at', { ascending: false })
  .limit(10)

console.log('')
if (!payments?.length) {
  console.log(`  ${YELLOW('platform_payments')}          no rows — no payment has been recorded`)
} else {
  console.log(`  platform_payments          ${payments.length} row(s), newest first`)
  for (const p of payments) {
    console.log(`    ${String(p.paid_at).slice(0, 19)}  ${money(p.amount_cents).padStart(9)}  `
      + `${p.tier}/${p.kind}  covers ${p.covers_from ?? '?'} → ${p.covers_through ?? '?'}  ${DIM(p.stripe_ref)}`)
  }
}

// ── 4. What Stripe actually delivered ───────────────────────────────────────
// NOT family-scoped, because the table is not: a platform event is about GENORRA's own Stripe
// account and belongs to no family (see AGENTS.md, "A TABLE WITH NO `family_code`"). So this
// is the recent tail, and reading it means matching timestamps by eye — which is still the
// difference between "the webhook never ran" and "the webhook ran and failed".
const { data: events } = await db
  .from('stripe_webhook_events')
  .select('event_type, endpoint, claimed_at, processed_at, attempts, last_error')
  .order('claimed_at', { ascending: false })
  .limit(15)

console.log('')
if (!events?.length) {
  console.log(`  ${RED('stripe_webhook_events')}      EMPTY — Stripe has never reached this deployment.`)
} else {
  console.log(`  stripe_webhook_events      ${events.length} most recent (all families)`)
  for (const e of events) {
    const state = e.processed_at ? GREEN('done') : RED('FAILED')
    console.log(`    ${String(e.claimed_at).slice(0, 19)}  ${state.padEnd(16)} ${e.endpoint}/${e.event_type}`
      + (e.attempts > 1 ? ` ${DIM(`×${e.attempts}`)}` : ''))
    if (e.last_error) console.log(`      ${RED(e.last_error)}`)
  }
}

// ── 5. The verdict ──────────────────────────────────────────────────────────
console.log('')
const unfinished = (events ?? []).filter(e => !e.processed_at)

if (!events?.length) {
  console.log(RED('  STOPPED AT DELIVERY.') + ' Nothing has ever been claimed here, and the database')
  console.log('  cannot tell the three causes apart — none of them reaches the claim. Stripe\'s own')
  console.log('  delivery log (Developers → Webhooks → the endpoint) separates them in one look:')
  console.log('')
  console.log('    no attempts   The endpoint is not pointed at this deployment. It must be')
  console.log('                  <this deployment>/api/stripe/platform, subscribed to')
  console.log('                  checkout.session.completed, invoice.paid, invoice.payment_failed')
  console.log('                  and customer.subscription.created|updated|deleted.')
  console.log('    401           VERCEL DEPLOYMENT PROTECTION, on a preview deployment. The body')
  console.log('                  says "Protected deployment" and Vercel refuses at the edge, so no')
  console.log('                  code in this repo ever sees it. Turn on Protection Bypass for')
  console.log('                  Automation and append the secret to the endpoint URL as a query')
  console.log('                  parameter: ?x-vercel-protection-bypass=<secret>. Stripe cannot')
  console.log('                  set headers, and the signature covers the body, not the URL.')
  console.log('    400           STRIPE_PLATFORM_WEBHOOK_SECRET does not match that endpoint\'s')
  console.log('                  signing secret. Each endpoint has its own.')
  console.log('')
  console.log('  In all three the money moved and nothing here knows. Stripe retries for three')
  console.log('  days, so fixing it within that window replays every event on its own.')
} else if (unfinished.length) {
  console.log(RED('  STOPPED IN A HANDLER.') + ' The errors above say which. Stripe is still retrying')
  console.log('  those (three days from first delivery), so a fix deployed inside that window')
  console.log('  applies them with nothing to replay by hand.')
} else if (!payments?.length) {
  console.log(YELLOW('  DELIVERED, NOTHING RECORDED.') + ' Every event processed, and no payment row exists.')
  console.log('  If the checkout was recent, the money event is `invoice.paid` for a subscription')
  console.log('  and `checkout.session.completed` for a prepaid term — check the list above for')
  console.log('  one of those, and the endpoint\'s subscribed events if it is missing entirely.')
} else if (account?.paid_tier && family.tier !== account.paid_tier) {
  console.log(RED('  PAID BUT NOT GRANTED.') + ` Recorded as ${account.paid_tier}, `
    + `families.tier says ${family.tier}.`)
  console.log('  `promoteTier` logs this exact phrase when the write is refused — search the')
  console.log('  deployment logs for "PAID BUT NOT GRANTED". Note it only ever moves a tier UP:')
  console.log('  a family recorded at a LOWER tier than they hold is not this bug.')
} else {
  console.log(GREEN('  APPLIED.') + ' The money is recorded and the tier matches what was paid for.')
  console.log('  If a screen still says otherwise, it is a caching or a read problem, not a')
  console.log('  billing one — the rows are right.')
}
console.log('')
