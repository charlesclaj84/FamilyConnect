'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { readBrowserConsent, subscribeToConsent, type ConsentDecision } from '@/lib/consent'
import {
  ATTRIBUTION_COOKIE, ATTRIBUTION_COOKIE_MAX_AGE_SECONDS, captureTouch, forConsent,
  isMeaningfulTouch, mergeTouch, parseAttribution, serializeAttribution,
} from '@/lib/meta/attribution'

/**
 * Remember which campaign brought this visitor, in GENORRA's own first-party cookie.
 *
 * Mounted once by the root layout, beside the Pixel. It is NOT part of the Pixel and does
 * not depend on it: an ad click that arrives with tracking switched off, or with consent
 * refused, still deposits the UTM parameters this product uses to answer its own questions
 * about its own marketing.
 *
 * ── WHAT IT WRITES, AND WHAT IT REFUSES TO WRITE ────────────────────────────────────
 * UTM parameters, the landing path, and the referring HOST are written unconditionally.
 * They are labels this product put on its own links, read back on its own origin, and they
 * are what `/reporting` would need to answer "which campaign produced this paying family?"
 * without asking Meta.
 *
 * `fbclid` — Meta's click identifier, minted by Meta to identify a person to Meta — is
 * written only when consent has been granted, and is stripped from the stored record the
 * moment consent is withdrawn. That asymmetry is the point of the split, and it is enforced
 * in `forConsent` rather than here so it is testable without a browser.
 *
 * ── IT NEVER OVERWRITES THE FIRST TOUCH ─────────────────────────────────────────────
 * `mergeTouch` keeps the arrival that FOUND this person and updates only the most recent
 * one — and updates that only for an arrival carrying real campaign context, so an ordinary
 * internal navigation cannot overwrite the campaign that brought somebody back with
 * nothing. Both rules live in the pure module; this component is the browser plumbing.
 *
 * ── WHY IT RUNS ON EVERY NAVIGATION AND NOT ONLY ON MOUNT ───────────────────────────
 * The layout is not re-rendered on a client-side navigation, so a mount-only effect would
 * see the first URL of the session and no other. That is usually right — an ad lands on one
 * page — but not always: a visitor already on the site can follow a campaign link from an
 * email into a second page, and `usePathname()` is what makes that arrival visible. The
 * meaningfulness test above is what stops the extra runs from costing anything.
 */
export function MetaAttributionCapture({ defaultConsent }: { defaultConsent: ConsentDecision }) {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof document === 'undefined') return

    const record = () => {
      const consent = (readBrowserConsent() ?? defaultConsent) === 'granted'
      const touch = forConsent(captureTouch(location.href, document.referrer, Date.now()), consent)
      const existing = parseAttribution(readCookie(ATTRIBUTION_COOKIE))

      // Nothing to say and nothing stored: leave the visitor without a cookie at all. A
      // record whose every field is empty is a cookie set for no reason, and this one is
      // set on the public marketing site where a visitor may never come back.
      if (!existing && !isMeaningfulTouch(touch)) return

      const next = mergeTouch(existing, touch)
      // Consent may have been withdrawn since the record was written, in which case the
      // stored `fbclid` has to go too — not merely be omitted from new writes.
      const cleaned = consent
        ? next
        : { first: forConsent(next.first, false), last: forConsent(next.last, false) }

      writeCookie(ATTRIBUTION_COOKIE, serializeAttribution(cleaned))
    }

    record()
    // Re-run on a consent change so that accepting on the banner captures the `fbclid` from
    // the URL that is still in the address bar — the landing page IS the ad click, and
    // waiting for the next navigation would lose it.
    return subscribeToConsent(record)
  }, [pathname, defaultConsent])

  return null
}

function readCookie(name: string): string | null {
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return null
}

/**
 * `SameSite=Lax` for the reason lib/consent.ts gives: an ad click is a cross-site
 * navigation, and `Strict` withholds the cookie on exactly the request that carries the
 * campaign. `Secure` is omitted on plain HTTP so this works in development, where a
 * `Secure` cookie is silently dropped.
 */
function writeCookie(name: string, value: string): void {
  const secure = location.protocol === 'https:' ? '; secure' : ''
  document.cookie =
    `${name}=${value}; path=/; max-age=${ATTRIBUTION_COOKIE_MAX_AGE_SECONDS}; samesite=lax${secure}`
}
