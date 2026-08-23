/**
 * Whether this visitor has agreed to be measured for advertising.
 *
 * ── ONE DECISION, READ BY BOTH TRANSPORTS ───────────────────────────────────────────
 * GENORRA had no consent mechanism before the Meta integration, and the integration is
 * what needs one — so this is deliberately the SMALLEST thing that answers the question,
 * not a consent-management platform. It is one cookie with two values, read in three
 * places: the layout (should the Pixel load?), `lib/meta/dispatch.ts` (may a server event
 * be sent?), and the banner (should it be shown?).
 *
 * THE SECOND OF THOSE IS THE POINT. Server-side tracking is not a privacy bypass. A
 * Conversions API call made from our own servers is invisible to an ad blocker, to the
 * browser's cookie controls and to the visitor — which is exactly why it must obey the
 * same decision the Pixel obeys rather than quietly making up the difference. If the
 * answer here is 'denied', nothing is sent by either route.
 *
 * ── OPT-IN BY DEFAULT, AND THE DEFAULT IS A BUSINESS DECISION ───────────────────────
 * With no cookie set, `resolveConsent` answers whatever `fallback` says, and the caller
 * gets that from `META_CONSENT_DEFAULT`. It is `'denied'` unless configured otherwise, so
 * an unconfigured deployment collects nothing until somebody chooses — which is the right
 * way round for a product holding family records, and the only defensible default for a
 * decision that turns on jurisdiction. Setting it to `'granted'` produces the opt-out
 * model common for US-only advertisers, and the banner then reads as a notice with a
 * decline control rather than as a gate. Both are implemented; which is lawful where is
 * not a question this file can answer.
 *
 * ── WHY A COOKIE AND NOT `localStorage` ─────────────────────────────────────────────
 * The server has to read it. A server action deciding whether to send a Conversions API
 * event has `cookies()` and has no access to the browser's storage at all, and a decision
 * the two halves cannot both see is the decision that drifts.
 *
 * PURE apart from the two clearly-marked browser helpers at the bottom. Tested under
 * `npm test` (AGENTS.md §7b).
 */

/**
 * The cookie name. First-party, on our own origin.
 *
 * Prefixed like the idle-timeout keys and for the same reason — a bare `consent` in a
 * shared browser namespace is a name somebody else's script will also pick.
 */
export const MARKETING_CONSENT_COOKIE = 'genorra_marketing_consent'

export type ConsentDecision = 'granted' | 'denied'

/**
 * How long a recorded choice lasts: six months.
 *
 * Not "forever". A consent that never expires is one the visitor cannot practically
 * revisit, and six months is the interval common guidance settles on. It is short enough
 * that a person who declined is asked again eventually and long enough that somebody who
 * agreed is not nagged every visit.
 */
export const CONSENT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 182

/** A stored value, or null when it is absent or not one of the two we write. */
export function parseConsent(raw: string | null | undefined): ConsentDecision | null {
  if (raw === 'granted' || raw === 'denied') return raw
  return null
}

/**
 * The effective answer: what was stored, or the deployment's default when nothing was.
 *
 * `fallback` is REQUIRED rather than defaulted to `'denied'` here, so that every call site
 * has to name the default it is applying. A default buried in a signature is one that gets
 * read as "the system decided"; passing it makes it a configured choice all the way down.
 */
export function resolveConsent(
  raw: string | null | undefined,
  fallback: ConsentDecision,
): ConsentDecision {
  return parseConsent(raw) ?? fallback
}

/** Has the visitor actually chosen? Distinct from what the effective answer is. */
export function hasChosen(raw: string | null | undefined): boolean {
  return parseConsent(raw) !== null
}

/**
 * Pull one cookie out of a raw `Cookie:` header.
 *
 * Exists so the pure half can be tested without a request. Server callers should prefer
 * `cookies()` from `next/headers`, which parses properly; this is for the browser helper
 * below and for tests.
 */
export function readConsentFromCookieHeader(header: string | null | undefined): string | null {
  if (typeof header !== 'string' || !header) return null
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === MARKETING_CONSENT_COOKIE) return decodeURIComponent(rest.join('='))
  }
  return null
}

/**
 * The cookie string to write.
 *
 * `SameSite=Lax` rather than `Strict`: an ad click arrives as a cross-site navigation, and
 * `Strict` would withhold the cookie on exactly that first request — the one where the
 * Pixel most needs to know whether it may fire. `Secure` is omitted on localhost because a
 * `Secure` cookie is silently dropped over plain HTTP, which would make the banner
 * un-dismissable in development.
 */
export function consentCookieString(decision: ConsentDecision, secure: boolean): string {
  const parts = [
    `${MARKETING_CONSENT_COOKIE}=${decision}`,
    'path=/',
    `max-age=${CONSENT_COOKIE_MAX_AGE_SECONDS}`,
    'samesite=lax',
  ]
  if (secure) parts.push('secure')
  return parts.join('; ')
}

/* ────────────────────────────────────────────────────────────────────────────────────
 * BROWSER HELPERS — the only two things here that touch `document`.
 * ──────────────────────────────────────────────────────────────────────────────────── */

/** What the browser currently has, or null. Safe to call during SSR: answers null. */
export function readBrowserConsent(): ConsentDecision | null {
  if (typeof document === 'undefined') return null
  return parseConsent(readConsentFromCookieHeader(document.cookie))
}

/**
 * Record a choice.
 *
 * Written from the browser rather than through a server action deliberately: a consent
 * choice is not a mutation of family data, it needs no authorization, and routing it
 * through `'use server'` would create a public HTTP endpoint whose whole purpose is to set
 * a cookie the browser can already set. `lib/email/send.ts`'s rule about not wrapping
 * something that is already reachable, applied to a much smaller thing.
 *
 * WITHDRAWING CONSENT DELETES META'S OWN COOKIES. `_fbp` and `_fbc` are first-party
 * cookies on our origin — the Pixel wrote them, but they are ours to remove, and leaving
 * them behind would mean a visitor who declined still carried a browser identifier that
 * every subsequent server event could read. The Pixel script itself cannot be unloaded from
 * a page that already has it; clearing the identifiers is what makes the withdrawal take
 * effect immediately rather than on the next navigation.
 */
export function writeBrowserConsent(decision: ConsentDecision): void {
  if (typeof document === 'undefined') return
  const secure = location.protocol === 'https:'
  document.cookie = consentCookieString(decision, secure)
  if (decision === 'denied') {
    for (const name of ['_fbp', '_fbc']) {
      document.cookie = `${name}=; path=/; max-age=0; samesite=lax${secure ? '; secure' : ''}`
    }
  }
  notifyConsentChanged()
}

/* ────────────────────────────────────────────────────────────────────────────────────
 * REACTING TO A CHANGE WITHOUT A RELOAD
 *
 * The consent value lives outside React, in a cookie, and two components need to re-render
 * when it moves: the Pixel (which must start loading) and the banner (which must go away).
 * `useSyncExternalStore` is the instrument for exactly that — the same one `ThemeToggle`
 * uses, and for the reasons its header sets out: reading a browser store during render is a
 * hydration mismatch, and correcting it from an effect is a cascading render.
 *
 * There is no `cookiechange` event in any shipping browser, so the notification is ours: a
 * choice is only ever made through `writeBrowserConsent`, which announces it. The `storage`
 * event is listened for as well, so a second tab that records a choice updates this one.
 * ──────────────────────────────────────────────────────────────────────────────────── */

const CONSENT_CHANGED_EVENT = 'genorra:consent-changed'

function notifyConsentChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT))
  // Cross-tab. The value is the announcement; nothing reads it back out of localStorage.
  try {
    localStorage.setItem('genorra:consent-broadcast', String(Date.now()))
  } catch {
    /* Private browsing, or storage disabled. One tab updating is better than none. */
  }
}

/** For `useSyncExternalStore`. Returns the unsubscribe function it requires. */
export function subscribeToConsent(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CONSENT_CHANGED_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CONSENT_CHANGED_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
