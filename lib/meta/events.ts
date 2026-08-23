/**
 * The events GENORRA is allowed to send to Meta, and the only fields they may carry.
 *
 * ── THIS FILE IS THE PRIVACY BOUNDARY, and it is a boundary because it is an ALLOW-LIST ─
 * GENORRA holds family trees, children's birthdays, relationships, photographs, private
 * messages, dues balances and health-adjacent notes. None of that may ever reach an
 * advertising platform. The way that guarantee is made here is structural rather than
 * disciplinary: `buildCustomData` copies a FIXED SET OF NAMED KEYS out of its input and
 * ignores everything else, and every value it copies must be a string, a finite number or
 * a boolean. So handing it a `people` row, a gathering, a family or any other application
 * object produces `{}` — not a redacted payload, not a truncated one, an empty one.
 *
 * That inversion is the whole design. A deny-list ("strip `date_of_birth`, strip
 * `relationships`") is only ever as complete as the last person who added a column, and
 * this schema gains columns every week. An allow-list is wrong in the safe direction: the
 * failure mode is a missing marketing parameter, which somebody notices in Events Manager,
 * rather than a child's birthday in an ad platform, which nobody notices at all.
 *
 * ── CONTENT NAMES COME FROM A CATALOGUE, NOT FROM A CALLER ──────────────────────────
 * `ViewContent` is the event most likely to grow a free-text parameter, because the
 * obvious implementation is "pass the page title". `VIEW_CONTENT` below is a closed set of
 * commercial descriptors instead, and callers name an entry rather than composing a
 * string. A page title in this product can be a family's name.
 *
 * ── WHAT IS NOT HERE ────────────────────────────────────────────────────────────────
 * No `content_ids`, no `contents`, no `num_items`. Those describe a product catalogue for
 * dynamic ads, and GENORRA sells four subscription plans, not a catalogue. Adding them
 * would mean deciding what an "item id" is for a family's plan, and the answer nobody
 * should reach for is the family code.
 *
 * PURE. No environment, no network, no request. Tested under `npm test` (AGENTS.md §7b).
 */

/* ────────────────────────────────────────────────────────────────────────────────────
 * THE EVENT LIST
 * ──────────────────────────────────────────────────────────────────────────────────── */

/**
 * Meta STANDARD events, verified against the Pixel reference on 2026-08-22.
 *
 * Standard events are the ones Meta's optimisation and reporting understand natively —
 * a campaign can be optimised for `Purchase` out of the box, whereas a custom event has
 * to be turned into a custom conversion first. So a business action goes here whenever a
 * standard event genuinely describes it, and becomes a custom event only when none does.
 *
 * `PageView` is on this list because `fbq('track', 'PageView')` is how the Pixel reports
 * it, even though Meta's own standard-event TABLE omits it — it is the base-code event
 * rather than a conversion, which is exactly why it is Pixel-only here (see MetaPixel).
 */
export const META_STANDARD_EVENTS = [
  'PageView',
  'ViewContent',
  'Lead',
  'CompleteRegistration',
  'InitiateCheckout',
  'Purchase',
  'Subscribe',
] as const

/**
 * CUSTOM events. Two, and each earns it by describing something no standard event does.
 *
 * `CreateFamily` is the most important signal this product has short of a payment, and
 * there is no standard event for "activated the workspace". It is deliberately NOT
 * `CompleteRegistration` a second time and deliberately not `StartTrial`: a trial implies
 * a paid plan with a clock on it, which this is not.
 *
 * `SubscriptionRenewal` exists to keep renewals OUT of `Purchase` and `Subscribe`. See
 * lib/meta/billing.ts — the distinction between winning a customer and keeping one is the
 * thing that a naive "send Purchase on every successful charge" destroys, and it destroys
 * it in the direction that flatters the numbers.
 */
export const META_CUSTOM_EVENTS = ['CreateFamily', 'SubscriptionRenewal'] as const

export type MetaStandardEvent = (typeof META_STANDARD_EVENTS)[number]
export type MetaCustomEvent = (typeof META_CUSTOM_EVENTS)[number]
export type MetaEventName = MetaStandardEvent | MetaCustomEvent

const ALL_EVENTS: readonly string[] = [...META_STANDARD_EVENTS, ...META_CUSTOM_EVENTS]

/**
 * Is this a name the product is allowed to send?
 *
 * The type system already says so for TypeScript callers. This is the runtime half, and it
 * matters because both transports have an untyped edge: `fbq()` takes a string, and a
 * server action is a public HTTP endpoint whose arguments arrive from the wire.
 */
export function isMetaEventName(name: string): name is MetaEventName {
  return ALL_EVENTS.includes(name)
}

export function isStandardEvent(name: MetaEventName): name is MetaStandardEvent {
  return (META_STANDARD_EVENTS as readonly string[]).includes(name)
}

/* ────────────────────────────────────────────────────────────────────────────────────
 * THE CONTENT CATALOGUE
 * ──────────────────────────────────────────────────────────────────────────────────── */

/**
 * Every `ViewContent` this product may report, as a closed set.
 *
 * `category` groups them for audience building — "everyone who looked at pricing" is the
 * retargeting segment that matters most, so Pricing has a category of its own rather than
 * being lumped in with the feature pages.
 *
 * ADDING AN ENTRY IS THE SUPPORTED WAY TO EXTEND THIS. Passing a string is not, and there
 * is no overload that accepts one.
 */
export const VIEW_CONTENT = {
  pricing: { name: 'Pricing', category: 'Pricing' },
  home: { name: 'Home', category: 'Overview' },
  features: { name: 'Features', category: 'Overview' },
  howItWorks: { name: 'How It Works', category: 'Overview' },
  whyUs: { name: 'Why Us', category: 'Overview' },
  about: { name: 'About', category: 'Overview' },
} as const satisfies Record<string, { name: string; category: string }>

export type ViewContentKey = keyof typeof VIEW_CONTENT

/* ────────────────────────────────────────────────────────────────────────────────────
 * CUSTOM DATA
 * ──────────────────────────────────────────────────────────────────────────────────── */

/**
 * The complete set of `custom_data` fields this product may send. Nothing else is copied.
 *
 * `plan_id` and `billing_interval` are not Meta standard fields; Meta accepts extra keys
 * in `custom_data` and this is the recognised way to carry subscription context. They are
 * SAFE because a plan id is one of four product-wide strings — `free`, `standard`, `plus`,
 * `premium` — identical for every customer and already published on /pricing.
 */
export interface MetaCustomData {
  content_name?: string
  content_category?: string
  content_type?: string
  /** MAJOR units — dollars, not cents. See `valueFromCents`. */
  value?: number
  /** ISO 4217, uppercase. */
  currency?: string
  /** The payment provider's transaction reference. Never a family code or a member id. */
  order_id?: string
  plan_id?: string
  billing_interval?: string
  predicted_ltv?: number
}

/**
 * The keys `buildCustomData` will copy. Kept as a runtime array rather than derived from
 * the interface, because a TypeScript interface is erased at build time and every server
 * action in this product is a public HTTP endpoint — the same argument
 * `lib/profile-columns.ts` makes about `Partial<T>` not being a filter.
 */
const ALLOWED_CUSTOM_DATA_KEYS = [
  'content_name',
  'content_category',
  'content_type',
  'value',
  'currency',
  'order_id',
  'plan_id',
  'billing_interval',
  'predicted_ltv',
] as const

/** ISO 4217: three letters. Anything else is dropped rather than guessed at. */
const CURRENCY = /^[A-Za-z]{3}$/

/**
 * Cents to the major units Meta wants, rounded to two places.
 *
 * Money is stored in cents everywhere in this product (`amount_cents`, `budget_cents`,
 * `monthlyCents`) and Meta's `value` is dollars — so this conversion has to happen exactly
 * once, in one place, or the day arrives when a $5.00 subscription is reported as a $500
 * conversion and every value-optimised campaign in the account is bidding on it.
 *
 * Rounding rather than truncating: `Math.round` on the cents avoids the floating-point
 * residue that `500 / 100` does not produce but `1_234_567 / 100` eventually does.
 */
export function valueFromCents(cents: number): number | null {
  if (!Number.isFinite(cents)) return null
  return Math.round(cents) / 100
}

/**
 * Copy the allowed keys out, drop everything else, and refuse anything that is not a
 * plain scalar.
 *
 * The three rules, in order of what they are protecting against:
 *
 *   1. UNKNOWN KEYS ARE DROPPED — the privacy boundary in the header.
 *   2. NON-SCALARS ARE DROPPED — an object or array under an allowed key is the shape a
 *      nested family record would arrive in, and `JSON.stringify` would happily send it.
 *   3. `value` AND `currency` TRAVEL TOGETHER OR NOT AT ALL. A value with no currency is a
 *      number Meta cannot interpret and reports as a diagnostic; a currency with no value
 *      says nothing. Sending half of the pair is the most common cause of the "missing
 *      currency"/"missing value" warnings in Events Manager, so the pair is enforced here
 *      rather than left to each call site.
 */
export function buildCustomData(input: MetaCustomData | null | undefined): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  if (!input || typeof input !== 'object') return out

  for (const key of ALLOWED_CUSTOM_DATA_KEYS) {
    const raw = (input as Record<string, unknown>)[key]
    if (raw === null || raw === undefined) continue

    if (key === 'value' || key === 'predicted_ltv') {
      if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) continue
      out[key] = Math.round(raw * 100) / 100
      continue
    }

    if (key === 'currency') {
      if (typeof raw !== 'string' || !CURRENCY.test(raw.trim())) continue
      out[key] = raw.trim().toUpperCase()
      continue
    }

    if (typeof raw === 'string') {
      const trimmed = raw.trim()
      if (trimmed) out[key] = trimmed
      continue
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      out[key] = raw
      continue
    }
    // Booleans, objects, arrays, functions, symbols: dropped. See rule 2.
  }

  if (out.value !== undefined && out.currency === undefined) delete out.value
  if (out.currency !== undefined && out.value === undefined) delete out.currency

  return out
}

/**
 * Does this event require a value and a currency to be worth sending?
 *
 * `Purchase` does — Meta lists both as required, and a Purchase without them cannot feed
 * value-based optimisation, which is the entire reason to send a Purchase. `Subscribe` and
 * `SubscriptionRenewal` are held to the same bar here, though Meta marks them optional,
 * because a subscription event whose amount is unknown is one this product should not have
 * been able to produce: it only ever fires from a settled payment.
 */
export function requiresValue(name: MetaEventName): boolean {
  return name === 'Purchase' || name === 'Subscribe' || name === 'SubscriptionRenewal'
}
