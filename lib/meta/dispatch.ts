/**
 * The one way a server event reaches Meta. Everything product code calls goes through
 * `trackServerEvent`.
 *
 * NOT A SERVER ACTION — see the header of lib/meta/capi.ts. Product code imports it.
 *
 * ── WHAT IT DOES, IN ORDER, AND WHY THE ORDER IS THAT ───────────────────────────────
 *   1. IS THIS DEPLOYMENT ALLOWED TO SEND?   `metaMode()`. A laptop and a preview build
 *      answer 'off', so nothing below runs and the production dataset stays clean.
 *   2. HAS THE VISITOR AGREED?               The same cookie the Pixel obeys. Checked
 *      BEFORE any identity is assembled, so a refused visitor's email is never hashed,
 *      never held in memory alongside a Meta payload, and never logged.
 *   3. IS THIS EVENT ALREADY SENT?           The ledger claim. Atomic, so a webhook
 *      delivered five times produces one conversion.
 *   4. ASSEMBLE.                             Allow-listed identity, allow-listed custom
 *      data, request signals.
 *   5. SCHEDULE.                             `after()`, so the send happens once the
 *      response has gone and cannot delay or fail the business transaction.
 *
 * ── `after()` IS WHAT MAKES REQUIREMENT "DO NOT BREAK THE TRANSACTION" STRUCTURAL ───
 * Awaiting a fetch to graph.facebook.com inside `registerUser` would put Meta's latency on
 * the critical path of creating an account, and Meta's availability on the critical path of
 * whether registration works. `after` runs the callback once the response is finished, so
 * the worst a total Meta outage can do is take four seconds of background time and log a
 * failure. The request APIs are read BEFORE scheduling rather than inside the callback,
 * which keeps this function callable from anywhere on the server — including a background
 * context with no request at all, where `cookies()` would throw.
 *
 * ── THE LEDGER IS THE SECOND LINE, NOT THE FIRST ────────────────────────────────────
 * `event_id` is derived from the business fact (lib/meta/event-id.ts), so idempotency is
 * mostly a property of the identifier: Meta discards a duplicate id within 48 hours by
 * itself. The ledger closes the rest — a payment webhook redelivered a week later is
 * outside Meta's window and would otherwise be counted as a second purchase — and it is
 * what makes "did this conversion go?" answerable at all, since a fire-and-forget call
 * otherwise leaves no trace anywhere in this product.
 */

import { after } from 'next/server'
import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveConsent, MARKETING_CONSENT_COOKIE } from '@/lib/consent'
import {
  ATTRIBUTION_COOKIE, FBC_COOKIE, FBP_COOKIE, parseAttribution, resolveFbc,
} from '@/lib/meta/attribution'
import { sendMetaEvents, type MetaServerEvent } from '@/lib/meta/capi'
import { consentDefault, metaEventSourceUrl, metaMode } from '@/lib/meta/config'
import { buildCustomData, requiresValue, type MetaCustomData, type MetaEventName } from '@/lib/meta/events'
import {
  buildUserData, clientIpFromHeaders, hasMatchableIdentity, type MetaAccountHolder,
} from '@/lib/meta/identity'

export interface TrackServerEventInput {
  event: MetaEventName
  /**
   * From `metaEventId()`. Required for anything the browser also fires, because it is the
   * only thing that stops one conversion being counted twice.
   *
   * Null is legitimate for a server-only event with no natural key, and then no ledger
   * claim is made — there is nothing to be idempotent about.
   */
  eventId: string | null
  /** Path only. Becomes `event_source_url`; the query string is dropped (see config). */
  sourcePath: string
  holder?: MetaAccountHolder | null
  customData?: MetaCustomData | null
  /** Unix MILLISECONDS. Defaults to now. Meta rejects a batch containing anything >7 days old. */
  occurredAtMs?: number
}

export interface TrackServerEventResult {
  /**
   * The id the BROWSER must fire with, or null when nothing should be fired at all.
   *
   * Null whenever the event was suppressed — tracking off, consent refused, already sent.
   * Returning the id in those cases and relying on the Pixel being absent would work today
   * and would be a trap: it makes the browser's silence depend on a second mechanism
   * agreeing, rather than on this one answer.
   */
  eventId: string | null
  /** True when a send was scheduled. */
  queued: boolean
  /** Why not, for logs and tests. Never shown to a user. */
  reason?: 'disabled' | 'no-consent' | 'duplicate' | 'unmatchable' | 'invalid-value' | 'ledger-error'
}

const SUPPRESSED = (reason: TrackServerEventResult['reason']): TrackServerEventResult => ({
  eventId: null, queued: false, reason,
})

/**
 * Claim an event id, atomically.
 *
 * `INSERT … ON CONFLICT DO NOTHING RETURNING` in one statement — the same shape
 * `claim_distribution_recipients()` uses and for the same reason: a read-then-write from
 * the application races itself, and two concurrent webhook deliveries would both find no
 * row and both send. One statement, and the loser gets zero rows back.
 *
 * A FAILURE HERE SUPPRESSES THE SEND rather than falling through to it. That is the
 * conservative direction on purpose: if the ledger is unreachable we cannot tell a first
 * delivery from a fifth, and inventing conversions is a worse failure than missing one.
 *
 * SERVICE ROLE, and AGENTS.md §3's obligation does not apply: `marketing_conversion_events`
 * has no `family_code` and holds no family data — it is a send ledger keyed on an event id.
 * The table has RLS enabled and NO policies, so the browser can neither read nor write it
 * by any route (§2c).
 */
async function claimEventId(eventId: string, event: MetaEventName, userId: string | null): Promise<'claimed' | 'duplicate' | 'error'> {
  try {
    const { data, error } = await createAdminClient()
      .from('marketing_conversion_events')
      .insert({ event_id: eventId, event_name: event, user_id: userId ?? null })
      .select('event_id')

    // 23505 cannot normally arrive — the insert has no ON CONFLICT clause in PostgREST, so
    // a duplicate surfaces as this error code rather than as zero rows. Both are handled:
    // supabase-js RETURNS errors rather than throwing them, so `error` is read (AGENTS.md's
    // note on lib/notifications.ts), and a unique violation is a duplicate, not a failure.
    if (error) return error.code === '23505' ? 'duplicate' : 'error'
    return data && data.length > 0 ? 'claimed' : 'duplicate'
  } catch {
    return 'error'
  }
}

/** Record how it went, so a dropped conversion leaves a trace. Never throws. */
async function settleEventId(eventId: string, delivery: 'sent' | 'failed', detail: string | null): Promise<void> {
  try {
    await createAdminClient()
      .from('marketing_conversion_events')
      .update({ delivery, detail: detail?.slice(0, 500) ?? null, settled_at: new Date().toISOString() })
      .eq('event_id', eventId)
  } catch {
    /* A ledger that cannot be updated must not fail anything. The log line below stands. */
  }
}

/**
 * Send one event to Meta's Conversions API, after the response has gone.
 *
 * Returns the `event_id` the browser should use so the pair deduplicates, or null when
 * nothing should be fired.
 */
export async function trackServerEvent(input: TrackServerEventInput): Promise<TrackServerEventResult> {
  if (metaMode() === 'off') return SUPPRESSED('disabled')

  // Request state, read here rather than inside the `after` callback — see the header.
  let cookieStore: Awaited<ReturnType<typeof cookies>> | null = null
  let headerStore: Awaited<ReturnType<typeof headers>> | null = null
  try {
    cookieStore = await cookies()
    headerStore = await headers()
  } catch {
    // No request in scope. Legitimate — a webhook processed out of band, a scheduled job —
    // and the event still goes, with the identity the caller supplied and no browser
    // signals. It cannot be deduplicated against a Pixel event, but there is no browser to
    // have fired one.
  }

  const consent = resolveConsent(cookieStore?.get(MARKETING_CONSENT_COOKIE)?.value, consentDefault())
  if (consent !== 'granted') return SUPPRESSED('no-consent')

  // Value events are checked BEFORE the ledger is claimed, so a malformed purchase does not
  // burn its own event id and thereby suppress the corrected retry.
  const customData = buildCustomData(input.customData)
  if (requiresValue(input.event) && customData.value === undefined) {
    console.error(`[meta] ${input.event} suppressed: value and currency are required`)
    return SUPPRESSED('invalid-value')
  }

  if (input.eventId) {
    const claim = await claimEventId(input.eventId, input.event, input.holder?.userId ?? null)
    if (claim === 'duplicate') return SUPPRESSED('duplicate')
    if (claim === 'error') {
      console.error(`[meta] ${input.event} suppressed: conversion ledger unavailable`)
      return SUPPRESSED('ledger-error')
    }
  }

  const attribution = parseAttribution(cookieStore?.get(ATTRIBUTION_COOKIE)?.value)
  const userData = buildUserData(input.holder, {
    clientIpAddress: headerStore ? clientIpFromHeaders(headerStore) : null,
    clientUserAgent: headerStore?.get('user-agent') ?? null,
    fbp: cookieStore?.get(FBP_COOKIE)?.value ?? null,
    fbc: resolveFbc(cookieStore?.get(FBC_COOKIE)?.value, attribution?.last ?? attribution?.first ?? null),
  })

  if (!hasMatchableIdentity(userData)) {
    // Nothing to match on. Sending anyway would file an unattributable event against the
    // dataset and lower its reported match rate for no gain. The ledger row stays claimed:
    // this event genuinely had its chance, and a retry would be no more matchable.
    if (input.eventId) after(() => settleEventId(input.eventId!, 'failed', 'no matchable identity'))
    return SUPPRESSED('unmatchable')
  }

  const event: MetaServerEvent = {
    event_name: input.event,
    // SECONDS, not milliseconds. Meta reads this as seconds and a milliseconds value dates
    // the event tens of thousands of years into the future, which fails the whole batch.
    event_time: Math.floor((input.occurredAtMs ?? Date.now()) / 1000),
    action_source: 'website',
    event_source_url: metaEventSourceUrl(input.sourcePath),
    user_data: userData,
    ...(input.eventId ? { event_id: input.eventId } : {}),
    ...(Object.keys(customData).length > 0 ? { custom_data: customData } : {}),
  }

  after(async () => {
    const result = await sendMetaEvents([event])
    if (!result.sent) {
      // The event NAME and ID only. Never `user_data`, never `custom_data` — one is hashed
      // personal data and the other carries the transaction amount, and neither belongs in
      // a log line that a platform aggregates.
      console.error(`[meta] ${input.event} (${input.eventId ?? 'no id'}) not delivered: ${result.error}`)
    }
    if (input.eventId) await settleEventId(input.eventId, result.sent ? 'sent' : 'failed', result.error ?? null)
  })

  return { eventId: input.eventId, queued: true }
}
