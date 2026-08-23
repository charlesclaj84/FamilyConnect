/**
 * Moving the acquisition context out of a cookie and into GENORRA's own records, at the one
 * moment an anonymous visitor becomes an account.
 *
 * NOT A SERVER ACTION. Plain module, called by `registerUser`.
 *
 * ── WHY THIS IS WORTH A TABLE ───────────────────────────────────────────────────────
 * Everything else in `lib/meta/` sends data TO Meta. This is the half that keeps GENORRA
 * able to answer its own questions: which campaign produced this registration, and — once
 * a payment provider exists and a subscription joins to an account — which campaign
 * produced this paying family. An ad platform's own reporting cannot answer that
 * impartially about itself, and it stops answering it at all the day the platform changes.
 *
 * ── FIRST TOUCH IS INSERTED ONCE; LAST TOUCH IS UPDATED ─────────────────────────────
 * Two statements rather than one upsert, and the split is the whole behaviour. PostgREST's
 * upsert replaces every column it is given, so a single call would rewrite the first touch
 * with whatever brought the visitor back — which is the standard way attribution ends up
 * reporting every conversion as direct. So: INSERT the first-touch columns, which loses
 * harmlessly if a row already exists, then UPDATE only the last-touch ones.
 *
 * The race between the two is real and benign: two concurrent registrations for one account
 * cannot happen, and the worst interleaving writes the same last touch twice.
 *
 * ── FAIL-SOFT ───────────────────────────────────────────────────────────────────────
 * Never throws, exactly like the rest of `lib/meta/`. It runs immediately after an account
 * has been created, and losing a campaign label must not be able to fail a registration.
 */

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { ATTRIBUTION_COOKIE, parseAttribution, type AttributionTouch } from '@/lib/meta/attribution'

/**
 * Only these fields are copied out of a touch, and the column names are written out.
 *
 * The same allow-list discipline as `lib/meta/events.ts`, applied to our own database
 * rather than to Meta's API — the cookie is client-writable, so anything spread out of it
 * unchecked is a column set chosen by whoever last edited their own browser storage.
 */
function firstColumns(touch: AttributionTouch): Record<string, string | null> {
  return {
    first_utm_source: touch.utm_source ?? null,
    first_utm_medium: touch.utm_medium ?? null,
    first_utm_campaign: touch.utm_campaign ?? null,
    first_utm_content: touch.utm_content ?? null,
    first_utm_term: touch.utm_term ?? null,
    first_landing_path: touch.landing_path ?? null,
    first_referrer_host: touch.referrer_host ?? null,
    first_fbclid: touch.fbclid ?? null,
  }
}

function lastColumns(touch: AttributionTouch): Record<string, string | null> {
  return {
    last_utm_source: touch.utm_source ?? null,
    last_utm_medium: touch.utm_medium ?? null,
    last_utm_campaign: touch.utm_campaign ?? null,
    last_utm_content: touch.utm_content ?? null,
    last_utm_term: touch.utm_term ?? null,
    last_landing_path: touch.landing_path ?? null,
    last_referrer_host: touch.referrer_host ?? null,
    last_fbclid: touch.fbclid ?? null,
  }
}

/** A cookie timestamp turned into something the column will accept, or now. */
function isoOrNow(ms: number | undefined): string {
  return Number.isFinite(ms) && (ms as number) > 0
    ? new Date(ms as number).toISOString()
    : new Date().toISOString()
}

/**
 * Record where this account came from.
 *
 * Does nothing at all when the visitor carries no attribution cookie, which is the ordinary
 * case for somebody who typed the address in — an empty row would say "direct" as a
 * positive claim, and absence is the more honest record of "we do not know".
 *
 * NO CONSENT GATE HERE, and that is deliberate rather than an omission. What reaches this
 * function is whatever survived `forConsent()` in the browser: UTM parameters — labels this
 * product put on its own links and reads back on its own origin, which is first-party
 * analytics of our own marketing — and, only where consent was granted, the `fbclid`. A
 * visitor who declined has no `fbclid` in the cookie, so there is none to store.
 */
export async function persistAttributionForUser(userId: string): Promise<void> {
  try {
    const store = await cookies()
    const record = parseAttribution(store.get(ATTRIBUTION_COOKIE)?.value)
    if (!record) return

    const admin = createAdminClient()

    // Loses harmlessly when a row already exists — that is the point. An existing row's
    // first touch is the one that found this person and must not be rewritten.
    await admin.from('marketing_attribution').insert({
      user_id: userId,
      first_touch_at: isoOrNow(record.first.at),
      ...firstColumns(record.first),
      last_touch_at: isoOrNow(record.last.at),
      ...lastColumns(record.last),
    })

    await admin
      .from('marketing_attribution')
      .update({
        last_touch_at: isoOrNow(record.last.at),
        ...lastColumns(record.last),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  } catch {
    // See the header. A campaign label is not worth a failed registration.
  }
}
