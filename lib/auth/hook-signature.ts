import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verifying that a Send Email hook request really came from GoTrue.
 *
 * ── WHY THIS IS THE WHOLE SECURITY BOUNDARY ─────────────────────────────────────────
 * `app/api/auth/send-email/route.ts` is a PUBLIC HTTP ENDPOINT that composes and sends
 * email from GENORRA's authenticated domain, carrying our SPF and DKIM. That is precisely
 * the open relay `lib/email/README.md` is written to prevent — *"any signed-in user could
 * POST an arbitrary recipient, subject and body and have it delivered… That is phishing with
 * the product's reputation attached"* — except worse, because this one does not even need a
 * session.
 *
 * Nothing else stands in front of it. There is no cookie to check, no `requireMember()` to
 * call, and no permission to consult: the caller is a Go process in another container. So
 * this signature IS the gate, and every one of the rules below is load-bearing rather than
 * defence in depth.
 *
 * ── THE SCHEME, MEASURED AGAINST GoTrue v2.195.0 RATHER THAN READ ABOUT ─────────────
 * Standard Webhooks. Three headers arrive and the signed content is all three joined:
 *
 *     webhook-id          70519ba2-d3a2-44c7-a061-53e3cd7d2323
 *     webhook-timestamp   1787860501            (seconds, not milliseconds)
 *     webhook-signature   v1,+Aw7f0GT3mN2lCDDtjLIcTDfCE+NgYE9xfC9tcgc/Ss=
 *
 *     signed  = `${id}.${timestamp}.${rawBody}`
 *     key     = base64-decode(secret after `whsec_`)
 *     expect  = 'v1,' + base64(HMAC-SHA256(key, signed))
 *
 * Every one of those was found by sweeping five key derivations × four content shapes ×
 * three encodings against a captured request, because getting any of them wrong produces a
 * verifier that rejects everything — which looks exactly like a misconfigured hook and is
 * the sort of thing that gets "fixed" by removing the check.
 *
 * ── THE RAW BODY, NOT THE PARSED ONE ───────────────────────────────────────────────
 * The HMAC is over the bytes GoTrue sent. `JSON.parse` then `JSON.stringify` does not round
 * trip — key order, whitespace and number formatting all move — so the route must read
 * `await request.text()` FIRST and parse afterwards, from the same string it verified. A
 * verifier handed a re-serialized body rejects every request.
 *
 * ── WHY A PURE MODULE ──────────────────────────────────────────────────────────────
 * §7b: this is exactly the "real edge cases" that paragraph is about — a truncated header, a
 * secret with the wrong prefix, a signature of the right shape and the wrong bytes, a
 * timestamp from last week. None of it is reachable through the route in either runner this
 * repo has, and all of it is one function call away here.
 */

/** How far out of date a timestamp may be. Five minutes, in each direction. */
export const HOOK_TIMESTAMP_TOLERANCE_SECONDS = 300

export interface HookHeaders {
  id: string | null
  timestamp: string | null
  signature: string | null
}

export type HookVerdict =
  | { ok: true }
  /**
   * `reason` is for the SERVER LOG and never for the response body. A verifier that tells a
   * caller which of its headers was wrong is a verifier being used as an oracle to find the
   * right one — the same argument `guard.notAuthorized` makes about naming a missing grant.
   */
  | { ok: false; reason: string }

/**
 * The signing key, from a `v1,whsec_…` secret.
 *
 * Returns null rather than throwing, so a misconfigured deployment is a refused request with
 * a logged reason instead of a 500 with a stack trace — and so that the route can tell the
 * two apart, because a missing secret is an operator error and a bad signature is an attack.
 */
export function hookKey(secret: string | undefined | null): Buffer | null {
  if (!secret) return null
  // The `v1,` is a VERSION on the secret, and `whsec_` a type tag. Both are stripped; only
  // what follows is base64. A secret pasted without either is refused rather than silently
  // hashed as text, because a key derived a second way is a verifier that agrees with
  // nothing.
  const m = /^v1,whsec_(.+)$/.exec(secret.trim())
  if (!m) return null
  const key = Buffer.from(m[1], 'base64')
  // A base64 decode never fails in Node — it stops at the first invalid character and
  // returns what it got, so `Buffer.from('!!!', 'base64')` is zero bytes rather than an
  // error. An empty or near-empty key would verify almost nothing, so it is refused here.
  return key.length >= 16 ? key : null
}

/**
 * Is this request GoTrue's?
 *
 * `rawBody` must be the exact string the request arrived with. See the header.
 */
export function verifyHookSignature(o: {
  headers: HookHeaders
  rawBody: string
  secret: string | undefined | null
  /** Seconds since the epoch. A parameter so §7b can test the window without a clock. */
  nowSeconds: number
}): HookVerdict {
  const key = hookKey(o.secret)
  if (!key) return { ok: false, reason: 'no usable signing secret is configured' }

  const { id, timestamp, signature } = o.headers
  if (!id || !timestamp || !signature) {
    return { ok: false, reason: 'a webhook-* header is missing' }
  }

  // ── THE TIMESTAMP, BEFORE THE HMAC ───────────────────────────────────────────────
  // A captured request replays perfectly forever without this: the signature stays valid
  // because the body has not changed. The window is what makes a stolen request expire.
  //
  // Checked in BOTH directions. A far-future timestamp is as much a sign of a forged
  // request as an old one, and allowing it would let a captured request be replayed
  // whenever its far-future window came around.
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || !Number.isInteger(ts)) {
    return { ok: false, reason: 'webhook-timestamp is not an integer' }
  }
  const skew = Math.abs(o.nowSeconds - ts)
  if (skew > HOOK_TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, reason: `webhook-timestamp is ${skew}s out of date` }
  }

  // ── THE HMAC ─────────────────────────────────────────────────────────────────────
  const expected = 'v1,' + createHmac('sha256', key)
    .update(`${id}.${timestamp}.${o.rawBody}`)
    .digest('base64')

  // MORE THAN ONE SIGNATURE MAY ARRIVE, space-separated, which is how Standard Webhooks
  // rotates a secret: both the old and the new are sent for a window. Any one matching is a
  // pass. GoTrue sends one today; accepting a list costs nothing and is what makes a future
  // rotation not an outage.
  for (const candidate of signature.split(' ')) {
    if (equalConstantTime(candidate, expected)) return { ok: true }
  }
  return { ok: false, reason: 'signature does not match' }
}

/**
 * `===` on a signature leaks its prefix through timing, and `timingSafeEqual` THROWS on a
 * length mismatch — which leaks the length through an exception. Both are handled here so no
 * call site has to remember either.
 *
 * The length check is not itself a leak worth worrying about: the expected length is a
 * constant of the scheme, not a secret.
 */
function equalConstantTime(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
