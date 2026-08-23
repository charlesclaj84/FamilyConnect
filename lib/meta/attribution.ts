/**
 * Remembering where somebody came from, for long enough to say so when they buy.
 *
 * ── THE PROBLEM THIS SOLVES ─────────────────────────────────────────────────────────
 * An advertising click and a paying family are separated by days: land on Home, read
 * /pricing, register, create a family, come back on a laptop a week later, subscribe. The
 * Pixel's own `_fbc` cookie carries Meta's click id across that gap in the BROWSER, and it
 * is enough right up until the conversion is confirmed by a payment provider on a server,
 * with no browser in the request at all — which is precisely where the most valuable event
 * in the funnel is produced. So the identifiers have to be readable from the server, and
 * the campaign context has to be readable by GENORRA independently of Meta.
 *
 * Two stores, deliberately, because they answer to different rules:
 *
 *   `_fbp` / `_fbc`     WRITTEN BY META'S PIXEL, as first-party cookies on our origin.
 *                       We never write them and never invent them; a server event reads
 *                       them off the request. Absent when the Pixel never ran — which is
 *                       the correct behaviour when consent was refused, not a gap to fill.
 *   `genorra_attribution`  OURS. UTM parameters, landing path, referrer host, and the raw
 *                       `fbclid` when consent allows. First touch and last touch, kept
 *                       apart. This is what lets GENORRA answer "which campaign produced
 *                       this paying family?" without asking Meta.
 *
 * ── FIRST TOUCH IS IMMUTABLE ────────────────────────────────────────────────────────
 * `mergeTouch` never overwrites the first-touch fields once they exist. The whole value of
 * a first touch is that it names the campaign that FOUND this person, and the commonest
 * implementation bug is to rewrite it on every visit — after which every conversion is
 * attributed to whatever the customer last clicked, which for most customers is a brand
 * search or a direct visit, and the campaign that actually did the work reports zero.
 *
 * ── PRIVACY ─────────────────────────────────────────────────────────────────────────
 * The landing PATH is kept and the query string is not; the referrer HOST is kept and the
 * rest of the referring URL is not. Both for the same reason: a path in this product names
 * a feature, whereas a query string can hold a search term or an invitation token, and a
 * full referrer URL can hold whatever the referring site put in its own address bar. Every
 * field is length-capped, so a crafted URL cannot inflate the cookie or the payload.
 *
 * PURE. No environment, no network, no `document`. Tested under `npm test` (§7b).
 */

/** Our own cookie. The Meta ones are `_fbp` and `_fbc`, written by the Pixel. */
export const ATTRIBUTION_COOKIE = 'genorra_attribution'
export const FBP_COOKIE = '_fbp'
export const FBC_COOKIE = '_fbc'

/**
 * A year. Long enough to cover the gap between an ad click and a family that finally
 * decides to pay, which for a purchase this considered is measured in weeks.
 */
export const ATTRIBUTION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

/** Nothing stored here needs more than this, and a cap is what keeps a crafted URL cheap. */
const MAX_FIELD = 200

/** One arrival. */
export interface AttributionTouch {
  at: number
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  landing_path?: string
  referrer_host?: string
  fbclid?: string
}

/** What the cookie holds: the arrival that found them, and the most recent one. */
export interface AttributionRecord {
  first: AttributionTouch
  last: AttributionTouch
}

function clip(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, MAX_FIELD)
}

/**
 * Read one arrival out of a URL and a referrer.
 *
 * `url` is the full landing URL; `referrer` is `document.referrer` or the `Referer` header,
 * either of which may be empty for a direct visit — which is a fact worth recording as
 * absence rather than as "direct", since "direct" is a conclusion and this is a reading.
 */
export function captureTouch(url: string, referrer: string | null | undefined, now: number): AttributionTouch {
  let parsed: URL | null = null
  try {
    parsed = new URL(url)
  } catch {
    parsed = null
  }

  const q = parsed?.searchParams
  const touch: AttributionTouch = { at: now }

  const utm = (name: string) => clip(q?.get(name))
  const assign = <K extends keyof AttributionTouch>(key: K, value: AttributionTouch[K]) => {
    if (value !== undefined) touch[key] = value
  }

  assign('utm_source', utm('utm_source'))
  assign('utm_medium', utm('utm_medium'))
  assign('utm_campaign', utm('utm_campaign'))
  assign('utm_content', utm('utm_content'))
  assign('utm_term', utm('utm_term'))
  assign('fbclid', clip(q?.get('fbclid')))
  assign('landing_path', clip(parsed?.pathname) ?? '/')

  // Host only. A referring URL's path and query belong to somebody else's site and can
  // hold anything at all; the host is the whole of what "where did they come from" needs.
  if (referrer) {
    try {
      assign('referrer_host', clip(new URL(referrer).host))
    } catch {
      /* An unparseable referrer is recorded as none rather than stored raw. */
    }
  }

  return touch
}

/** Did this arrival carry anything worth recording, or was it an ordinary page load? */
export function isMeaningfulTouch(touch: AttributionTouch): boolean {
  return Boolean(
    touch.utm_source || touch.utm_medium || touch.utm_campaign
    || touch.utm_content || touch.utm_term || touch.fbclid || touch.referrer_host,
  )
}

/**
 * Fold a new arrival into what is already stored.
 *
 * First touch is written once and never again — see the header. Last touch is replaced
 * only by an arrival that actually carries campaign context: without that test, opening
 * the dashboard would overwrite the campaign that brought somebody back with an empty
 * internal navigation, and last-touch attribution would report every conversion as direct.
 */
export function mergeTouch(
  existing: AttributionRecord | null,
  incoming: AttributionTouch,
): AttributionRecord {
  if (!existing) return { first: incoming, last: incoming }
  if (!isMeaningfulTouch(incoming)) return existing
  return { first: existing.first, last: incoming }
}

/** Cookie value. URL-encoded JSON — small, and readable in devtools by whoever it is about. */
export function serializeAttribution(record: AttributionRecord): string {
  return encodeURIComponent(JSON.stringify(record))
}

/** The inverse. Returns null for anything it cannot make an `AttributionRecord` out of. */
export function parseAttribution(raw: string | null | undefined): AttributionRecord | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const decoded = JSON.parse(decodeURIComponent(raw)) as unknown
    if (!decoded || typeof decoded !== 'object') return null
    const record = decoded as Partial<AttributionRecord>
    if (!record.first || !record.last) return null
    if (typeof record.first.at !== 'number' || typeof record.last.at !== 'number') return null
    return { first: record.first, last: record.last }
  } catch {
    return null
  }
}

/**
 * Strip the Meta click id when consent has not been given.
 *
 * The UTM half is our own campaign labelling — parameters we put on our own links, read
 * back on our own origin — and it is kept, because GENORRA answering "which campaign
 * produced this family?" is first-party analytics of our own marketing. `fbclid` is
 * different in kind: it is an identifier minted by Meta for the purpose of identifying a
 * person to Meta, so it is held only where the visitor has agreed to that.
 */
export function forConsent(touch: AttributionTouch, granted: boolean): AttributionTouch {
  if (granted) return touch
  const { fbclid: _dropped, ...rest } = touch
  void _dropped
  return rest
}

/* ────────────────────────────────────────────────────────────────────────────────────
 * META'S OWN IDENTIFIERS
 * ──────────────────────────────────────────────────────────────────────────────────── */

/**
 * `fb.<subdomainIndex>.<creationTimeMs>.<payload>` — the shape of both `_fbp` and `_fbc`.
 *
 * Validated rather than trusted because both arrive as cookies, which are writable by
 * anything running on this origin and by the person sitting in front of it. A malformed
 * value is a documented Events Manager diagnostic ("invalid fbp/fbc"), and the fix is to
 * send nothing rather than to send something shaped wrongly — an omitted parameter costs
 * match quality, a malformed one is reported as an integration error.
 */
const FB_ID = /^fb\.\d+\.\d+\..+$/

export function isValidFbp(value: string | null | undefined): boolean {
  return typeof value === 'string' && FB_ID.test(value) && value.length <= 256
}

export function isValidFbc(value: string | null | undefined): boolean {
  return typeof value === 'string' && FB_ID.test(value) && value.length <= 512
}

/**
 * Build `fbc` from a raw `fbclid`, which Meta's specification explicitly permits when
 * there is no `_fbc` cookie to read.
 *
 * `fb.1.<ms>.<fbclid>`, where the `1` is the subdomain index Meta names for a value
 * generated server-side without a cookie being stored, and the timestamp is MILLISECONDS —
 * seconds is the mistake to avoid, since a seconds value is accepted, looks fine, and dates
 * the click to 1970, which puts it outside every attribution window.
 *
 * NOTHING IS INVENTED HERE. It returns null without a real `fbclid`: there is no such thing
 * as a plausible click id, and fabricating one would attach our conversions to somebody
 * else's click. `creationTimeMs` is when the `fbclid` was first SEEN, which is what Meta
 * asks for when the cookie was not stored — so callers pass the recorded touch's `at`
 * rather than "now", or the click ages backwards to zero every time an event is sent.
 */
export function fbcFromFbclid(fbclid: string | null | undefined, creationTimeMs: number): string | null {
  if (typeof fbclid !== 'string') return null
  const clean = fbclid.trim()
  if (!clean || clean.length > 400) return null
  if (!Number.isFinite(creationTimeMs) || creationTimeMs <= 0) return null
  return `fb.1.${Math.floor(creationTimeMs)}.${clean}`
}

/**
 * The `fbc` to send: the cookie the Pixel wrote, or one built from a remembered `fbclid`.
 *
 * The cookie wins whenever it is valid, because the Pixel wrote it with the subdomain
 * index and creation time that actually applied.
 */
export function resolveFbc(
  cookieValue: string | null | undefined,
  remembered: { fbclid?: string; at: number } | null,
): string | null {
  if (isValidFbc(cookieValue)) return cookieValue as string
  if (remembered?.fbclid) return fbcFromFbclid(remembered.fbclid, remembered.at)
  return null
}
