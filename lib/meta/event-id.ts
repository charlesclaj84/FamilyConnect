/**
 * The one identifier the browser and the server must agree on.
 *
 * ── WHAT IT IS FOR ──────────────────────────────────────────────────────────────────
 * Meta deduplicates a Pixel event against a Conversions API event when the Pixel's
 * `eventID` equals the server's `event_id` AND the Pixel's `event` equals the server's
 * `event_name`, within 48 hours of the first of the pair arriving. Both halves matter:
 * matching ids under different event names do not deduplicate, so `CompleteRegistration`
 * on one side and `Registration` on the other produces two conversions from one
 * registration. That is why `MetaEventName` is a closed union used by both transports
 * rather than a string typed twice.
 *
 * ── DETERMINISTIC, NOT RANDOM, WHEREVER A BUSINESS KEY EXISTS ───────────────────────
 * The obvious implementation is a random id generated once and threaded from server to
 * browser. It works and it is fragile: the thread breaks the moment a retry, a webhook
 * redelivery or a page refresh re-enters the same code path, and each break is a duplicate
 * conversion that nothing in this product can detect.
 *
 * A deterministic id derived from the business fact removes the class:
 *
 *     registration  → the account id            → one registration, one id, forever
 *     family        → the family code           → one workspace, one id
 *     purchase      → the payment transaction   → a webhook redelivered five times is
 *                                                 five requests carrying one id
 *
 * So idempotency is a property of the identifier rather than of the caller's care. The
 * ledger in `lib/meta/dispatch.ts` is the second line, not the first.
 *
 * ── AND THE KEY IS HASHED ───────────────────────────────────────────────────────────
 * `purchase_<transaction-id>` in the clear would put a payment reference, and
 * `family_<code>` would put a family's join code, into a third party's event log. Neither
 * is a secret exactly — a family code is meant to be shared — but neither has any reason
 * to be in an ad platform, and the identifier works identically as a digest. What is kept
 * readable is the PREFIX, because a human reading Events Manager's raw event view should
 * be able to tell a purchase id from a registration id at a glance while learning nothing
 * about who it belongs to.
 *
 * The digest is truncated to 32 hex characters. Meta's limit is comfortably above that,
 * and 128 bits of a SHA-256 has no realistic collision risk across the number of events
 * this product will ever send.
 *
 * PURE apart from `node:crypto`. Tested under `npm test` (AGENTS.md §7b).
 */

import { createHash } from 'node:crypto'
import type { MetaEventName } from '@/lib/meta/events'

/**
 * The readable half of an event id.
 *
 * One per event that has a natural business key. `PageView` and `ViewContent` have none —
 * a page view is not a thing that happens once — and are Pixel-only in this product, so
 * they never need an id at all.
 */
export const EVENT_ID_PREFIX = {
  CompleteRegistration: 'registration',
  CreateFamily: 'family',
  Lead: 'lead',
  InitiateCheckout: 'checkout',
  Purchase: 'purchase',
  Subscribe: 'subscribe',
  SubscriptionRenewal: 'renewal',
} as const satisfies Partial<Record<MetaEventName, string>>

export type KeyedEvent = keyof typeof EVENT_ID_PREFIX

/**
 * The id for one business event.
 *
 * `key` is whatever makes that event unique and unrepeatable — an account id, a family
 * code, a payment transaction reference. It is folded together with the event name before
 * hashing, so the same key under two events (an account id used for both
 * `CompleteRegistration` and `CreateFamily`) yields two different ids rather than one that
 * would make Meta discard the second event as a duplicate of the first.
 *
 * Returns null for an empty key rather than hashing the empty string. A caller with no key
 * has nothing to be idempotent about, and `<prefix>_e3b0c442…` — the digest of nothing —
 * would be one shared id that made every such event a duplicate of the first one ever sent.
 */
export function metaEventId(event: KeyedEvent, key: string | null | undefined): string | null {
  if (typeof key !== 'string' || !key.trim()) return null
  const digest = createHash('sha256')
    .update(`${event}:${key.trim()}`, 'utf8')
    .digest('hex')
    .slice(0, 32)
  return `${EVENT_ID_PREFIX[event]}_${digest}`
}

/**
 * A renewal needs a PERIOD, not just a subscription.
 *
 * Every renewal of one subscription shares the subscription id, so hashing that alone
 * would give every month the same event id — and Meta would discard the second month's
 * event as a duplicate if it arrived inside 48 hours, while our own ledger would discard
 * it forever. The payment transaction is what differs per charge, so it is the key; the
 * subscription is carried in `custom_data` where it belongs.
 *
 * Stated as its own function rather than left to each caller to remember, because the
 * failure — renewals silently stopping after the first one — looks like the feature
 * working correctly.
 */
export function renewalEventId(transactionId: string | null | undefined): string | null {
  return metaEventId('SubscriptionRenewal', transactionId)
}
