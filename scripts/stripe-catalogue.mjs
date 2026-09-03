#!/usr/bin/env node
/**
 * Does the Stripe catalogue say what this repo thinks it says?
 *
 *   npm run stripe:check          report; exit 1 on a finding
 *   npm run stripe:fix            report, and repair the ones that are safely repairable
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────
 * `lib/stripe/config.ts` has said since it was written that the catalogue lives in Stripe
 * and *"nothing in this repo can check that — the figures live in Stripe. It is a GO LIVE
 * item"*. This is that item. Six ids (three tiers x recurring/prepaid) are read from the
 * environment, and everything else about them — the amount, the interval, whether the price
 * is even active, and the NAME a family reads on the hosted page — is data somebody typed
 * into a Dashboard.
 *
 * IT WAS THE NAME THAT MADE THIS URGENT. A real sandbox checkout for Standard rendered its
 * line as `STRIPE_PRICE_STANDARD_RECURRING` — the Product had been named after the
 * environment variable that holds its Price id. Nothing in the product could see it:
 * `priceShapeError` in `app/actions/billing.ts` validates the price's SHAPE, because a wrong
 * shape charges the wrong money, and a wrong name charges the right money while telling the
 * family they are buying a configuration key.
 *
 * ── WHAT IT CHECKS, AND WHY EACH ONE ────────────────────────────────────────────────
 *   ID SHAPE        `price_…`, never `prod_…`. `priceShapeError` catches this at checkout
 *                   time; catching it here means finding it before a family does.
 *   ACTIVE          an archived price is refused by `sessions.create`, at the till.
 *   INTERVAL        recurring must be monthly; prepaid must be one-time. Swapping the two
 *                   env vars is a silent double-charge or a subscription that never renews.
 *   AMOUNT          against `TIER_PRICE[tier].monthlyCents`, which is the figure every screen
 *                   in the product quotes. A mismatch is a hosted page asking for a different
 *                   number than the button promised — the exact drift `lib/plans.ts` argues
 *                   a single source of truth exists to prevent, arriving from outside the repo.
 *   CURRENCY        `usd`, which is what `formatPlatformMoney` assumes.
 *   PRODUCT NAME    what the family reads on the checkout line and on every invoice after it.
 *
 * ── THE NAME, AND WHY IT IS NOT PER TIER ────────────────────────────────────────────
 * `lib/stripe/config.ts` argued for one Product per plan so *"an invoice line says 'GENORRA
 * Plus' rather than the same name for every tier"*, and that reading is overridden here
 * deliberately rather than forgotten. What a family reads at the till should say what they
 * are buying from whom; the TIER is already unambiguous on the same line, in the amount, and
 * reconciliation never depended on the name at all — `tierForPriceId` resolves the tier from
 * the PRICE id (which that function's own header calls the only trustworthy statement of what
 * was bought), and `genorra_tier` rides in the metadata besides.
 *
 * So: one name for the subscription, one for the paid-in-advance shape, and `EXPECTED_NAME`
 * is the single place either is written down. If per-tier names are wanted back it is one
 * edit here plus `npm run stripe:fix`.
 *
 * ── `--fix` RENAMES AND NOTHING ELSE, WHICH IS THE WHOLE SAFETY ARGUMENT ─────────────
 * A wrong NAME is cosmetic and its repair is unambiguous: there is one right answer and this
 * file holds it. A wrong AMOUNT is not — it could be Stripe that is right, and rewriting a
 * live price from a script would change what every subscriber is billed at their next
 * renewal, without their agreeing to it, which is the thing `TIER_PRICE`'s own header spends
 * a paragraph forbidding. So an amount, an interval, an archived price and a mistyped id are
 * REPORTED and never touched; the fix for each is a decision a person makes in the Dashboard.
 *
 * ── IT IS NOT A `verify.yml` STEP, AND MUST NOT BECOME ONE ──────────────────────────
 * Same footing as `email:check` and `realtime:check`: it needs a live secret key, and that
 * workflow holds no secret at all. It also asks a THIRD PARTY, so a Stripe outage would turn
 * every pull request red — a gate that fails for reasons unrelated to the diff is one people
 * learn to ignore. Hand-run, and named in TODO.md's GO LIVE list.
 *
 * ── AND IT READS THE SANDBOX OR LIVE ACCOUNT THE KEY POINTS AT ──────────────────────
 * There is no `--local` here, because there is no local Stripe. Whichever key is in the
 * environment is the account being asked about, and the report says which mode it is in —
 * `sk_test_…` versus `sk_live_…` — because "the price is missing" and "you are pointed at the
 * other account" are the same finding until somebody says which.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const GREEN = s => `\x1b[32m${s}\x1b[0m`
const RED = s => `\x1b[31m${s}\x1b[0m`
const YELLOW = s => `\x1b[33m${s}\x1b[0m`
const DIM = s => `\x1b[2m${s}\x1b[0m`

const FIX = process.argv.slice(2).includes('--fix')

// ── THE EXPECTED CATALOGUE ──────────────────────────────────────────────────────────
// Mirrored from `lib/tiers.ts` and `lib/plans.ts` rather than imported: those are TypeScript
// modules with `server-only` neighbours and an import graph this script has no business
// pulling in. The mirror is checked below against the real files, so it cannot go stale
// silently — which is the same device `scripts/people-writes.mjs` uses for its own list.
const TIERS = ['standard', 'plus', 'premium']
const EXPECTED_NAME = {
  recurring: 'GENORRA Subscription',
  prepaid: 'GENORRA Subscription (paid in advance)',
}
const ENV_FOR = (tier, shape) => `STRIPE_PRICE_${tier.toUpperCase()}_${shape.toUpperCase()}`

/** `TIER_PRICE[tier].monthlyCents`, read out of `lib/plans.ts` so there is one figure. */
function monthlyCentsFromRepo() {
  const src = readFileSync(resolve(ROOT, 'lib/plans.ts'), 'utf8')
  const start = src.indexOf('export const TIER_PRICE')
  if (start < 0) throw new Error('TIER_PRICE not found in lib/plans.ts')
  const out = {}
  for (const tier of TIERS) {
    // `standard: { monthlyCents: 1000, … }` — the tier key, then the first monthlyCents
    // after it. Anchored on the tier so a re-ordering of the record cannot cross the wires.
    const at = src.indexOf(`${tier}:`, start)
    if (at < 0) throw new Error(`no ${tier} in TIER_PRICE`)
    const m = src.slice(at, at + 2000).match(/monthlyCents:\s*(\d+)/)
    if (!m) throw new Error(`no monthlyCents for ${tier}`)
    out[tier] = Number(m[1])
  }
  return out
}

// ── ENV ─────────────────────────────────────────────────────────────────────────────
// `.env.local` is read by hand: this is a plain node script with no Next.js around it, and
// adding a dotenv dependency to read six variables is not worth the supply chain. Real
// process env WINS, so a CI or a shell export overrides the file rather than being ignored.
function envFromFile() {
  const out = {}
  for (const name of ['.env.local', '.env']) {
    let text
    try {
      text = readFileSync(resolve(ROOT, name), 'utf8')
    } catch {
      continue
    }
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (!m) continue
      let value = m[2].trim()
      if ((value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (out[m[1]] === undefined) out[m[1]] = value
    }
  }
  return out
}

const fileEnv = envFromFile()
const env = name => (process.env[name] ?? fileEnv[name] ?? '').trim() || null

const secret = env('STRIPE_SECRET_KEY')
if (!secret) {
  console.error(RED('\n  No STRIPE_SECRET_KEY, in the environment or in .env.local.\n'))
  console.error('  This script asks Stripe; there is no local Stripe to ask instead.\n')
  process.exit(2)
}

const mode = secret.startsWith('sk_live') ? 'LIVE' : secret.startsWith('sk_test') ? 'sandbox' : 'unknown'

// ── THE STRIPE CALLS, BY HAND ───────────────────────────────────────────────────────
// `fetch` rather than the `stripe` SDK, for the reason every script in this directory is
// dependency-light: this reads two endpoints and writes one field, and the SDK would drag a
// pinned API version into a file whose whole job is to compare two catalogues. The version
// header is sent explicitly so a Dashboard-side default cannot change what comes back.
const API = 'https://api.stripe.com/v1'
const auth = { Authorization: `Bearer ${secret}` }

async function stripeGet(path) {
  const res = await fetch(`${API}${path}`, { headers: auth })
  const body = await res.json()
  if (!res.ok) {
    const err = body?.error
    throw new Error(`${err?.code ?? res.status}: ${err?.message ?? 'request failed'}`)
  }
  return body
}

async function stripePost(path, form) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  })
  const body = await res.json()
  if (!res.ok) {
    const err = body?.error
    throw new Error(`${err?.code ?? res.status}: ${err?.message ?? 'request failed'}`)
  }
  return body
}

const money = cents => `$${(cents / 100).toFixed(2)}`

const findings = []
const repaired = []
const finding = (where, detail, fixable = false) => findings.push({ where, detail, fixable })

console.log(`\n  STRIPE CATALOGUE — the six prices this product sells, as Stripe holds them.\n`)
console.log(`  ${DIM(`key: ${mode} (${secret.slice(0, 8)}…)`)}\n`)

const expectedCents = monthlyCentsFromRepo()

for (const tier of TIERS) {
  for (const shape of ['recurring', 'prepaid']) {
    const varName = ENV_FOR(tier, shape)
    const id = env(varName)
    const label = `${tier}/${shape}`

    if (!id) {
      // NOT A FINDING. A tier nobody has wired up yet renders no button — see
      // `platformBillingConfigured`, which is per tier precisely so a partial setup fails
      // visibly rather than at the till. Reported so the run is a complete inventory.
      console.log(`  ${YELLOW('unset')}     ${label.padEnd(20)} ${DIM(varName)}`)
      continue
    }

    if (!id.startsWith('price_')) {
      finding(label, id.startsWith('prod_')
        ? `${varName} holds a PRODUCT id (${id}); it needs the Price id from that product's Pricing section`
        : `${varName} does not look like a Stripe Price id (${id.slice(0, 8)}…)`)
      console.log(`  ${RED('BAD ID')}    ${label.padEnd(20)} ${DIM(id)}`)
      continue
    }

    let price
    try {
      price = await stripeGet(`/prices/${encodeURIComponent(id)}?expand[]=product`)
    } catch (e) {
      finding(label, `${varName} (${id}) could not be retrieved from the ${mode} account — ${e.message}`)
      console.log(`  ${RED('MISSING')}   ${label.padEnd(20)} ${DIM(id)}`)
      continue
    }

    const problems = []
    if (price.active === false) problems.push('the price is ARCHIVED — sessions.create will refuse it')
    if (price.currency !== 'usd') problems.push(`currency is ${price.currency}, expected usd`)

    if (shape === 'recurring') {
      if (!price.recurring) problems.push('a ONE-TIME price is in the _RECURRING slot')
      else if (price.recurring.interval !== 'month' || price.recurring.interval_count !== 1) {
        problems.push(`interval is every ${price.recurring.interval_count} ${price.recurring.interval}(s), expected 1 month`)
      }
    } else if (price.recurring) {
      problems.push('a RECURRING price is in the _PREPAID slot — it is bought quantity: months and must be one-time')
    }

    // THE UNIT IS ONE MONTH IN BOTH SHAPES. `lib/stripe/config.ts`: *"the prepaid price is
    // per-month rather than per-term … a term is a multiple of it"*, so one figure covers
    // both and a prepaid price set to a year's total silently multiplies by `months`.
    if (price.unit_amount !== expectedCents[tier]) {
      problems.push(
        `charges ${money(price.unit_amount ?? 0)} per month, and TIER_PRICE.${tier} says `
        + `${money(expectedCents[tier])} — every screen in the product quotes the second`,
      )
    }

    const product = price.product && typeof price.product === 'object' ? price.product : null
    const want = EXPECTED_NAME[shape]
    let nameWrong = false
    if (!product) {
      problems.push('the product could not be expanded, so its name cannot be checked')
    } else if (product.name !== want) {
      nameWrong = true
    }

    for (const p of problems) finding(label, p)
    if (nameWrong) {
      finding(label, `the checkout line reads "${product.name}" — it should read "${want}"`, true)
    }

    const state = problems.length ? RED('WRONG') : nameWrong ? YELLOW('NAME') : GREEN('ok')
    console.log(
      `  ${state.padEnd(19)}${label.padEnd(20)} ${money(price.unit_amount ?? 0)}`
      + `${shape === 'recurring' ? '/mo' : ' ×n'}   ${DIM(product?.name ?? '?')}`,
    )

    // ── THE ONE REPAIR ────────────────────────────────────────────────────────────
    // Only the name, only under `--fix`, and only when the product was expanded so there is
    // an id to write to. See the header for why nothing else here is repairable.
    if (nameWrong && FIX) {
      try {
        await stripePost(`/products/${encodeURIComponent(product.id)}`, { name: want })
        repaired.push(`${label}: "${product.name}" -> "${want}"`)
      } catch (e) {
        finding(label, `could not rename the product: ${e.message}`)
      }
    }
  }
}

// ── REPORT ──────────────────────────────────────────────────────────────────────────
if (repaired.length) {
  console.log(`\n  ${GREEN('renamed')}`)
  for (const r of repaired) console.log(`    ${r}`)
  console.log(DIM('    A rename is retroactive on the hosted page and on future invoices.'))
  console.log(DIM('    Invoices already issued keep the line they were issued with.'))
}
const left = findings.filter(f => !(f.fixable && FIX && repaired.length))

if (left.length) {
  console.log(`\n  ${left.length} finding(s):\n`)
  for (const f of left) {
    console.log(`  ${RED('──')} ${f.where}`)
    console.log(`       ${f.detail}`)
    if (f.fixable) console.log(DIM('       repairable: npm run stripe:fix'))
  }
  console.log('')
  // `exitCode` rather than `process.exit()`: an abrupt exit while a `fetch` connection is
  // still open aborts the process on Windows before the report is flushed — libuv asserts on
  // a closing handle. Setting the code lets node drain its own handles and exit with it.
  process.exitCode = 1
} else {
  console.log(GREEN('\n  Clean.') + DIM(' NOTE: this checks the catalogue, not whether a'))
  console.log(DIM('  checkout works — for that, start a real one. And it says nothing about'))
  console.log(DIM('  the LIVE account unless the key above says LIVE.\n'))
}
