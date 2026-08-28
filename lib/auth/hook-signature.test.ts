import { describe, expect, it } from 'vitest'
import {
  HOOK_TIMESTAMP_TOLERANCE_SECONDS,
  hookKey,
  verifyHookSignature,
} from '@/lib/auth/hook-signature'

/**
 * The gate in front of `app/api/auth/send-email/route.ts`.
 *
 * ── WHY THIS IS THE MOST IMPORTANT TEST FILE IN `lib/` ─────────────────────────────
 * That route sends email from GENORRA's authenticated domain and has no session, no cookie
 * and no permission in front of it. This signature is the whole boundary, so every case
 * below is about a way a forged request could get past it.

 *
 * ── CHECKED BY MUTATION, per §7b. Six, all tripped ────────────────────────────────
 *   * the key taken as utf8 instead of base64                            6 failed
 *   * the signed content reduced to the body alone                       4 failed
 *   * the timestamp window removed                                       2 failed
 *   * the window made one-sided (future timestamps allowed)              1 failed
 *   * `hookKey`'s 16-byte floor removed                                  1 failed
 *   * the multi-signature split dropped                                  1 failed
 *
 * The first two are the ones the captured fixture buys. Under a derived fixture — one signed
 * by this module's own scheme — both would have gone green, because the derivation would have
 * moved with the code.
 */

/**
 * ── A REAL GoTrue v2.195.0 REQUEST, CAPTURED OFF THE WIRE ──────────────────────────
 * Taken on 2026-08-27 with a throwaway hook server, and independently re-verified by a
 * separate Python HMAC implementation before being written here — so this fixture does not
 * rest on the module it is testing.
 *
 * DO NOT REGENERATE IT BY SIGNING THE BODY WITH OUR OWN CODE. That would make every case
 * below a tautology: the code would be proving it agrees with itself, and the four things
 * this capture actually established — that the key is BASE64 rather than utf8, that the
 * signed content is `id.ts.body` rather than the body alone, that the digest is base64
 * rather than hex, and that the prefix is `v1,` — would all be unpinned. They were found by
 * sweeping five key derivations by four content shapes by three encodings against exactly
 * this pair.
 *
 * The `locale: "es"` in `user_metadata` is not incidental: it is what `registerUser` writes
 * at signup, and it is the language the confirmation email is composed in.
 */
const CAPTURED = {
  secret: 'v1,whsec_cHJvYmVzZWNyZXRwcm9iZXNlY3JldHByb2JlMTI=',
  id: 'ff2d969e-3de6-4006-8d76-30095c3681c6',
  timestamp: '1787861045',
  signature: 'v1,Rehoq7Y7R1PoXzqdtX6eHkNV/CEgKWgL9NZF6iGCNG0=',
  body:
    '{"metadata":{"uuid":"4308da91-704e-41a2-972e-aa3d27e4c0e1","time":"2026-08-27T20:04:05.37827'
    + '9948Z","name":"send-email","ip_address":"172.23.0.1"},"user":{"id":"cad63ac1-80bf-4d9f-b4a7-'
    + '4abaf2de9041","aud":"authenticated","role":"authenticated","email":"fixture.capture@rls.test'
    + '","phone":"","app_metadata":{"provider":"email","providers":["email"]},"user_metadata":{"ema'
    + 'il":"fixture.capture@rls.test","email_verified":false,"locale":"es","phone_verified":false,"'
    + 'sub":"cad63ac1-80bf-4d9f-b4a7-4abaf2de9041"},"identities":[{"identity_id":"1938f4f3-c23c-414'
    + 'd-9a58-224591765254","id":"cad63ac1-80bf-4d9f-b4a7-4abaf2de9041","user_id":"cad63ac1-80bf-4d'
    + '9f-b4a7-4abaf2de9041","identity_data":{"email":"fixture.capture@rls.test","email_verified":f'
    + 'alse,"locale":"es","phone_verified":false,"sub":"cad63ac1-80bf-4d9f-b4a7-4abaf2de9041"},"pro'
    + 'vider":"email","last_sign_in_at":"2026-08-27T20:04:05.375821018Z","created_at":"2026-08-27T2'
    + '0:04:05.375838Z","updated_at":"2026-08-27T20:04:05.375838Z","email":"fixture.capture@rls.tes'
    + 't"}],"created_at":"2026-08-27T20:04:05.372323Z","updated_at":"2026-08-27T20:04:05.377051Z","'
    + 'is_anonymous":false},"email_data":{"token":"12452975","token_hash":"ae8923b3a65731bcb8362a3d'
    + '6e57f84918630dd0538f4dff17d5ff85","redirect_to":"https://genorra.com","email_action_type":"s'
    + 'ignup","site_url":"http://127.0.0.1:54321/auth/v1","token_new":"","token_hash_new":"","old_e'
    + 'mail":"","old_phone":"","provider":"","factor_type":""}}',
}

const NOW = Number(CAPTURED.timestamp)

function verify(over: Partial<{
  id: string | null
  timestamp: string | null
  signature: string | null
  rawBody: string
  secret: string | null
  nowSeconds: number
}> = {}) {
  return verifyHookSignature({
    headers: {
      id: 'id' in over ? over.id! : CAPTURED.id,
      timestamp: 'timestamp' in over ? over.timestamp! : CAPTURED.timestamp,
      signature: 'signature' in over ? over.signature! : CAPTURED.signature,
    },
    rawBody: over.rawBody ?? CAPTURED.body,
    secret: 'secret' in over ? over.secret : CAPTURED.secret,
    nowSeconds: over.nowSeconds ?? NOW,
  })
}

describe('hookKey', () => {
  it('takes the base64 after whsec_ and nothing else', () => {
    // 29 bytes, measured off the real secret. The `v1,` and the `whsec_` are a version and a
    // type tag, not key material.
    expect(hookKey(CAPTURED.secret)?.length).toBe(29)
  })

  it('refuses a secret with no whsec_ prefix', () => {
    // A secret pasted without it would otherwise be hashed as TEXT, producing a verifier
    // that agrees with nothing and rejects every real request — which reads as a broken hook
    // rather than as a misconfigured secret.
    expect(hookKey('whsec_abcdefghijklmnopqrstuvwxyz012345')).toBeNull()
    expect(hookKey('v1,abcdefghijklmnopqrstuvwxyz012345')).toBeNull()
    expect(hookKey('plaintextsecretplaintextsecret')).toBeNull()
  })

  it('refuses a key too short to verify anything', () => {
    // Node's base64 decode NEVER FAILS — it stops at the first invalid character and returns
    // what it got. So `whsec_!!!!` is zero bytes, and a zero-byte HMAC key is a signature
    // anybody can compute. This is the case that makes the floor necessary.
    expect(hookKey('v1,whsec_!!!!')).toBeNull()
    expect(hookKey('v1,whsec_' + Buffer.from('short').toString('base64'))).toBeNull()
  })

  it('accepts a 16-byte key, which is the floor', () => {
    expect(hookKey('v1,whsec_' + Buffer.alloc(16, 7).toString('base64'))?.length).toBe(16)
  })

  it('answers null for nothing at all', () => {
    expect(hookKey(undefined)).toBeNull()
    expect(hookKey(null)).toBeNull()
    expect(hookKey('')).toBeNull()
  })
})

describe('verifyHookSignature', () => {
  it('accepts the captured request', () => {
    expect(verify()).toEqual({ ok: true })
  })

  it('refuses a body that changed by one character', () => {
    // THE POINT OF THE WHOLE MECHANISM. An attacker who can rewrite the recipient can send
    // mail from our domain to anybody.
    const tampered = CAPTURED.body.replace('fixture.capture@rls.test', 'victim@example.com')
    expect(tampered).not.toBe(CAPTURED.body)
    expect(verify({ rawBody: tampered }).ok).toBe(false)
  })

  it('refuses a re-serialized body that means the same thing', () => {
    // Not pedantry — this is the mistake the route is written to avoid. `JSON.parse` then
    // `JSON.stringify` does not round trip, so a route that verified against its own
    // re-serialization would reject every real request and a route that verified against the
    // parsed object could not verify at all.
    const same = JSON.stringify(JSON.parse(CAPTURED.body), Object.keys(
      JSON.parse(CAPTURED.body) as Record<string, unknown>).reverse())
    expect(verify({ rawBody: same }).ok).toBe(false)
  })

  it('refuses a signature of the right shape and the wrong bytes', () => {
    expect(verify({ signature: 'v1,' + Buffer.alloc(32, 3).toString('base64') }).ok).toBe(false)
  })

  it('refuses a signature with no version prefix', () => {
    expect(verify({ signature: CAPTURED.signature.replace('v1,', '') }).ok).toBe(false)
  })

  it('accepts one good signature among several, which is how a rotation works', () => {
    // Standard Webhooks sends the old and the new secret's signatures space-separated for the
    // window of a rotation. Refusing a list would make rotating the secret an outage.
    const decoy = 'v1,' + Buffer.alloc(32, 9).toString('base64')
    expect(verify({ signature: `${decoy} ${CAPTURED.signature}` })).toEqual({ ok: true })
    expect(verify({ signature: `${CAPTURED.signature} ${decoy}` })).toEqual({ ok: true })
  })

  it('refuses a list of only bad signatures', () => {
    const a = 'v1,' + Buffer.alloc(32, 9).toString('base64')
    const b = 'v1,' + Buffer.alloc(32, 8).toString('base64')
    expect(verify({ signature: `${a} ${b}` }).ok).toBe(false)
  })

  it('refuses a stale request, which is what stops a replay', () => {
    // The signature of a captured request stays valid forever — the body has not changed.
    // The window is the only thing that expires it.
    expect(verify({ nowSeconds: NOW + HOOK_TIMESTAMP_TOLERANCE_SECONDS + 1 }).ok).toBe(false)
    expect(verify({ nowSeconds: NOW + HOOK_TIMESTAMP_TOLERANCE_SECONDS })).toEqual({ ok: true })
  })

  it('refuses a FUTURE timestamp too, and that is not symmetry for its own sake', () => {
    // A one-sided window lets a captured request be held and replayed when its far-future
    // moment arrives. Both directions or neither.
    expect(verify({ nowSeconds: NOW - HOOK_TIMESTAMP_TOLERANCE_SECONDS - 1 }).ok).toBe(false)
    expect(verify({ nowSeconds: NOW - HOOK_TIMESTAMP_TOLERANCE_SECONDS })).toEqual({ ok: true })
  })

  it('refuses a timestamp that is not an integer number of seconds', () => {
    // MILLISECONDS ARE THE LIKELY MISTAKE and they fail the window rather than the parse, so
    // this is really about the other shapes: an empty header, a float, a word.
    expect(verify({ timestamp: '' }).ok).toBe(false)
    expect(verify({ timestamp: 'now' }).ok).toBe(false)
    expect(verify({ timestamp: '1787860501.5' }).ok).toBe(false)
    expect(verify({ timestamp: String(NOW * 1000) }).ok).toBe(false)
  })

  it('refuses a missing header rather than treating it as empty', () => {
    expect(verify({ id: null }).ok).toBe(false)
    expect(verify({ timestamp: null }).ok).toBe(false)
    expect(verify({ signature: null }).ok).toBe(false)
  })

  it('refuses everything when no secret is configured', () => {
    // The deployment-error case, and it must not be a pass. A hook enabled with no secret on
    // our side would otherwise accept anything that POSTed.
    expect(verify({ secret: null }).ok).toBe(false)
    expect(verify({ secret: '' }).ok).toBe(false)
  })

  it('refuses a request signed with a different secret', () => {
    const other = 'v1,whsec_' + Buffer.alloc(29, 1).toString('base64')
    expect(verify({ secret: other }).ok).toBe(false)
  })

  it('keeps its reason out of the caller´s reach only by convention', () => {
    // The verdict CARRIES a reason, because the server log needs one. This asserts it is
    // there and says out loud that the route must not return it — see the type's own note:
    // a verifier that says which header was wrong is an oracle for finding the right one.
    const v = verify({ signature: 'v1,nope' })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toBeTruthy()
  })
})
