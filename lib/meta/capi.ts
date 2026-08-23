/**
 * The Conversions API transport. One function that puts events on the wire, and nothing
 * else — no consent logic, no identity assembly, no idempotency. Those are
 * `lib/meta/dispatch.ts`'s job, and keeping them out of here is what makes this file
 * testable and its failure modes small.
 *
 * NOT A SERVER ACTION, and must never become one — the same rule `lib/email/send.ts` and
 * `lib/notifications.ts` are built on. An export of a `'use server'` file gets a URL, so a
 * `sendMetaEvents` export there would let any signed-in visitor post arbitrary events into
 * GENORRA's advertising dataset: fabricated purchases, fabricated registrations, and an
 * optimisation model trained on them. A plain module has no URL.
 *
 * ── FAIL-SOFT, ALWAYS, AND THAT IS THE WHOLE CONTRACT ───────────────────────────────
 * Nothing here throws. Every call site sits AFTER a business decision has been committed —
 * an account created, a family established, a payment settled — and an advertising
 * measurement call must never be able to fail one of those. The cost is stated plainly
 * rather than hidden: a dropped event is invisible to everybody, so the return value says
 * what happened and the caller logs it.
 *
 * ── THE ACCESS TOKEN GOES IN THE BODY, NOT THE QUERY STRING ─────────────────────────
 * Meta documents both. The query string is the half of a URL that lands in access logs, in
 * proxy logs, in exception reporters and in the `url` field of every fetch trace — so the
 * body is the only one of the two that keeps a long-lived credential out of places nobody
 * audits. Nothing in this file ever interpolates the token into a string that could be
 * logged, and the error paths below carry Meta's message, never the request.
 */

import { META_GRAPH_API_VERSION, metaAccessToken, metaPixelId, metaTestEventCode } from '@/lib/meta/config'
import type { MetaEventName } from '@/lib/meta/events'

/** How long one attempt may take. A conversion event is not worth a hanging request. */
const TIMEOUT_MS = 4_000

/**
 * One retry, and only for failures that a retry can actually fix.
 *
 * A 4xx from Meta is a verdict on the payload — a malformed `user_data`, an unknown field,
 * an `event_time` older than seven days — and sending the identical bytes again produces
 * the identical rejection while doubling the latency. A timeout, a socket error, a 429 or a
 * 5xx are transient, and those are retried. The same distinction `lib/confirmed-write.ts`
 * makes about a refusal versus a blip.
 *
 * Retrying is SAFE here for the reason `confirmed-write` is careful about: an event carries
 * a stable `event_id`, so a retry after a request that in fact landed is deduplicated by
 * Meta rather than counted twice.
 */
const RETRY_DELAY_MS = 400

/** What Meta is sent. Assembled by `lib/meta/dispatch.ts`; this file only serialises it. */
export interface MetaServerEvent {
  event_name: MetaEventName
  /** Unix SECONDS. Meta rejects the whole batch if any event is more than 7 days old. */
  event_time: number
  event_id?: string
  /** Every event this product sends originates on the website. */
  action_source: 'website'
  event_source_url?: string
  user_data: Record<string, string | string[]>
  custom_data?: Record<string, string | number>
}

export interface MetaSendResult {
  /** True only when Meta accepted the batch. */
  sent: boolean
  /** How many events Meta reported receiving. */
  received?: number
  /** Server-side diagnostics. Never shown to a user, never contains the access token. */
  error?: string
  /** True when nothing was attempted because this deployment is not configured to send. */
  skipped?: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * POST a batch to the Conversions API.
 *
 * Meta accepts up to 1,000 events per request and rejects the WHOLE batch if any single
 * event is invalid. This product sends one event per call in practice, so that is a
 * property to remember rather than a risk being run — but it is why a future batching
 * change must validate per event rather than trusting the batch.
 */
export async function sendMetaEvents(events: MetaServerEvent[]): Promise<MetaSendResult> {
  if (events.length === 0) return { sent: true, received: 0 }

  const pixelId = metaPixelId()
  const token = metaAccessToken()

  // A dataset id with no token, or the reverse, is a half-configured deployment. Reported
  // rather than attempted: a POST with no credential is a guaranteed 401 whose message
  // ("Invalid OAuth access token") reads as a rotated key rather than as a missing one.
  if (!pixelId || !token) {
    return {
      sent: false,
      skipped: true,
      error: pixelId ? 'META_CONVERSIONS_API_ACCESS_TOKEN is not set' : 'META_PIXEL_ID is not set',
    }
  }

  const testEventCode = metaTestEventCode()
  const body: Record<string, unknown> = { data: events, access_token: token }
  if (testEventCode) body.test_event_code = testEventCode

  const endpoint = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${pixelId}/events`

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        // Never cached, never revalidated. This is a write.
        cache: 'no-store',
      })

      if (response.ok) {
        const json = (await response.json().catch(() => null)) as { events_received?: number } | null
        return { sent: true, received: json?.events_received ?? events.length }
      }

      // Meta puts a usable explanation in the body. Read it, cap it — an error string is
      // going into a log line, and Meta's error payloads can run long.
      const detail = (await response.text().catch(() => '')).slice(0, 500)
      const message = `HTTP ${response.status}${detail ? `: ${detail}` : ''}`

      const retryable = response.status === 429 || response.status >= 500
      if (!retryable || attempt === 1) return { sent: false, error: message }
    } catch (cause) {
      // A timeout or a socket failure. `cause` here is our own error object, never the
      // request — so the token cannot reach a log through this path.
      const message = cause instanceof Error ? cause.message : 'network error'
      if (attempt === 1) return { sent: false, error: message }
    }

    await sleep(RETRY_DELAY_MS)
  }

  // Unreachable: both branches above return on `attempt === 1`. Kept so the function has a
  // total return type rather than relying on the loop bound to prove it.
  return { sent: false, error: 'exhausted retries' }
}
