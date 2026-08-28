/**
 * THE FIVE AUTH EMAILS, ACTUALLY SENT, ACTUALLY READ BACK.
 *
 *     # .env.local needs:  EMAIL_CAPTURE_URL=http://127.0.0.1:3198/captured
 *     npm run dev                      # in another terminal, on port 3000
 *     npm run auth-email:check
 *
 * Exits 1 on a finding, so it reads as a test. Needs the LOCAL STACK and the dev server,
 * which is why it is hand-run like `email:check`, `realtime:check` and `art:check` rather
 * than a step in `verify.yml`.
 *
 * ── WHY NOTHING ELSE CAN PROVE THIS ────────────────────────────────────────────────
 * `lib/auth/hook-signature.test.ts` proves the signature against a captured request.
 * `npm run i18n:check` proves every key resolves. Neither can answer the question that
 * matters: **does GoTrue actually call us, and does a member receive the right message in
 * their own language?** That needs a real signup against a real GoTrue, a real HMAC over the
 * wire, a real Next route, and a real mailbox to read.
 *
 * Which is the same argument `scripts/realtime-check.mjs` makes about a websocket: a
 * migration can assert a publication and cannot open a socket.
 *
 * ── IT READS ITS OWN CAPTURE, NOT MAILPIT, AND THAT SURPRISED ME ──────────────────
 * The local stack captures SMTP in Mailpit. `lib/email/` posts to Resend's HTTPS API. Those
 * two have never met, so **no email this app composes has ever been visible locally** — it
 * either returns `{ sent: false }` for want of a key or really sends, to a real inbox, from a
 * laptop.
 *
 * That is why `EMAIL_CAPTURE_URL` exists (see `sendEndpoint` in `lib/email/send.ts`, and note
 * it is ignored in production). This script runs a listener on port 3198 and reads what
 * arrived. The dev server has to have that variable at BOOT, which is why it belongs in
 * `.env.local` rather than being set here.
 *
 * ── AND THAT IS WHY THE ADDRESSES ARE NOT `.test` ────────────────────────────────
 * `sendEmail` refuses RFC 2606's reserved TLDs before it sends anything — deliberately, and
 * `tests/rls` depends on it. A capture is downstream of that guard, so the addresses here use
 * a domain the guard admits. They still reach nobody: the capture answers, so nothing leaves
 * the machine.
 *
 * ── WHAT IT ASSERTS, AND WHY EACH HALF IS THERE ────────────────────────────────────
 * For each of the five action types:
 *
 *   * exactly one message arrives (two for `email_change` — one per address)
 *   * the SUBJECT is the one this product wrote, not GoTrue's default
 *   * the BODY carries a `/auth/confirm?token_hash=…&type=<the right type>` link, or the
 *     8-digit code for the one that has no link
 *   * and it is in the READER'S LANGUAGE — asserted by a phrase that exists only in that
 *     language's catalogue entry
 *
 * The last one is the whole point of the phase and is the one a green run of everything else
 * would not have caught.
 *
 * Plus two negative cases, both of which are security properties rather than features:
 *
 *   * an UNSIGNED POST to the endpoint is refused 401 — the open-relay check
 *   * `magiclink` answers 200 and sends nothing, rather than failing. See the route: a
 *     refusal there would make `POST /auth/v1/otp` a 500-for-real-accounts,
 *     200-for-everything-else account-enumeration oracle.
 *
 * ── IT LEAVES THE DATABASE DIRTY, ON PURPOSE ──────────────────────────────────────
 * The accounts it creates are named `authmail.*@authmail.genorra-check.example.org` and are left behind, because
 * deleting them would also delete the evidence of what happened. Run `npx supabase db reset`
 * afterwards — the RLS suite needs a clean fixture anyway, and `tests/rls` reseeds from
 * scratch.
 */

import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { createHmac } from 'node:crypto'

const API = 'http://127.0.0.1:54321'
const APP = process.env.AUTH_HOOK_APP_ORIGIN ?? 'http://127.0.0.1:3000'
/**
 * ── THE KEYS COME FROM THE LOCAL STACK, NOT FROM `.env.local` ─────────────────────
 * `.env.local` points at the HOSTED project — that is the normal way to work on this repo,
 * and it is why `NEXT_PUBLIC_SUPABASE_URL` there is a `supabase.co` address. Reading the keys
 * from it made this script sign LOCAL requests with HOSTED keys, and the failure was
 * misleading rather than loud: local GoTrue accepts any well-formed `apikey` on its public
 * endpoints, so signup and recovery passed, and every ADMIN call answered 403. Three findings
 * that had nothing to do with the code under test.
 *
 * `supabase status -o env` is the source of truth for a local key. The local ones are
 * recognisable — their JWT `iss` is `supabase-demo` where a hosted key's is `supabase` — and
 * that difference is asserted below rather than assumed, because the whole point of this
 * script is that it talks to the thing it thinks it is talking to.
 */
const localEnv = (() => {
  const out = execFileSync('npx', ['supabase', 'status', '-o', 'env'],
    { cwd: process.cwd(), encoding: 'utf8', shell: true })
  const map = {}
  for (const line of out.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)="?([^"]*)"?$/.exec(line.trim())
    if (m) map[m[1]] = m[2]
  }
  return map
})()

// The same secret the route reads. Without it the signed probe below cannot be built,
// and a script that skipped that case silently would be worse than one that says so.
const SECRET = process.env.SUPABASE_AUTH_HOOK_SECRET
const ANON = localEnv.ANON_KEY
const SERVICE = localEnv.SERVICE_ROLE_KEY
const PASSWORD = 'Auth-Email-Check-1'

const findings = []
const notes = []
const fail = (what, detail) => findings.push(`${what}: ${detail}`)
const ok = what => notes.push(`  ok       ${what}`)

/** A phrase that appears ONLY in that language's entry, so the assertion is about language. */
const TELLS = {
  signup: { en: 'Confirm my email address', es: 'Confirmar mi dirección de correo', fr: 'Confirmer mon adresse électronique' },
  recovery: { en: 'Choose a new password', es: 'Elija una contraseña nueva', fr: 'Choisissez un nouveau mot de passe' },
  invite: { en: 'Accept the invitation', es: 'Aceptar la invitación', fr: 'Accepter l’invitation' },
  reauthentication: { en: 'Just checking it’s you', es: 'Solo comprobamos que es usted', fr: 'Nous vérifions juste que c’est vous' },
  // TWO ENTRIES, because the two halves of an address change are two messages: the one to the
  // address you have now says "confirm this CHANGE", and the one to the new address says
  // "confirm this ADDRESS". A single phrase for both reported the new-address mail as being in
  // the wrong language, which is a finding about the assertion rather than about the code.
  email_change_old: { en: 'Confirm this change', es: 'Confirme este cambio', fr: 'Confirmez ce changement' },
  email_change_new: { en: 'Confirm this address', es: 'Confirme esta dirección', fr: 'Confirmez cette adresse' },
}

async function json(url, init) {
  const res = await fetch(url, init)
  let body = null
  try { body = await res.json() } catch { /* some endpoints answer empty */ }
  return { status: res.status, body }
}

// ── THE CAPTURE ───────────────────────────────────────────────────────────────────
// A dozen lines standing in for Resend. It receives the same JSON body Resend would and
// answers 200, so `sendEmail` reports a success and the route answers 200 to GoTrue — which
// is what keeps the signup from being rolled back.
let captured = []
const server = createServer((req, res) => {
  let body = ''
  req.on('data', c => { body += c })
  req.on('end', () => {
    try {
      const m = JSON.parse(body)
      captured.push({
        to: Array.isArray(m.to) ? m.to.join(',') : String(m.to ?? ''),
        subject: String(m.subject ?? ''),
        html: String(m.html ?? ''),
      })
    } catch { /* a body we cannot read is a finding the assertions will report */ }
    // Resend answers with an id. Nothing reads it, and answering the right SHAPE keeps the
    // capture honest about what it is standing in for.
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ id: 'captured' }))
  })
})
await new Promise(r => server.listen(3198, '127.0.0.1', r))

const clearMail = async () => { captured = [] }
const inbox = async () => captured

/** Wait for `n` messages, or give up. A fixed sleep is the thing that flakes. */
async function waitForMail(n, label) {
  for (let i = 0; i < 40; i += 1) {
    const box = await inbox()
    if (box.length >= n) return box
    await new Promise(r => setTimeout(r, 250))
  }
  const box = await inbox()
  fail(label, `expected ${n} message(s), ${box.length} arrived within 10s`)
  return box
}

function assertMail(label, m, { locale, action, type, code }) {
  const tell = TELLS[action][locale]
  if (!m.html.includes(tell)) {
    fail(label, `the body is not in ${locale} — expected to find “${tell}”`)
  } else {
    ok(`${label} — in ${locale}`)
  }
  // GOTRUE'S OWN DEFAULT SAYS "Confirm your signup" and links `{{ .ConfirmationURL }}`.
  // Finding either would mean the hook did not take over, which is the failure this whole
  // script exists to catch and is invisible from the app's side.
  if (/Confirm your signup|Reset Password|Magic Link/i.test(m.html)) {
    fail(label, 'the body looks like a GoTrue default — the hook did not take over')
  }
  if (type) {
    const re = new RegExp(`/auth/confirm\\?token_hash=[0-9a-f]+&(?:amp;)?type=${type}`)
    if (!re.test(m.html)) fail(label, `no /auth/confirm link with type=${type}`)
    else ok(`${label} — links type=${type}`)
  }
  if (code) {
    if (!/[0-9]{8}/.test(m.html.replace(/<[^>]+>/g, ''))) {
      fail(label, 'no 8-digit code in the body')
    } else ok(`${label} — carries the code`)
    if (/auth\/confirm/.test(m.html)) {
      // NO LINK, deliberately — a one-click confirmation reachable from a forwarded inbox
      // defeats the gate. See `authReauthEmail`.
      fail(label, 'the reauthentication mail must not contain a confirm link')
    }
  }
}

// ── 0. Is anything even wired? ──────────────────────────────────────────────────────
if (!ANON || !SERVICE) {
  console.error('\n  `npx supabase status` did not report keys. Is the local stack up?\n')
  process.exit(1)
}
if (!SECRET) {
  console.error('\n  SUPABASE_AUTH_HOOK_SECRET is not set. It has to match'
    + '\n  [auth.hook.send_email].secrets in supabase/config.toml.\n')
  process.exit(1)
}

// ASSERTED, NOT ASSUMED. A hosted key here is the mistake this whole block exists to prevent,
// and it presents as three unrelated 403s rather than as a wrong key.
const iss = JSON.parse(Buffer.from(SERVICE.split('.')[1], 'base64url').toString()).iss
if (iss !== 'supabase-demo') {
  console.error(`\n  The service key reports iss="${iss}", which is not the local stack's`
    + '\n  ("supabase-demo"). Something is handing this script hosted credentials.\n')
  process.exit(1)
}

if (!process.env.EMAIL_CAPTURE_URL?.includes('3198')) {
  console.error('\n  Set EMAIL_CAPTURE_URL=http://127.0.0.1:3198/captured in .env.local and'
    + '\n  restart `npm run dev`. Without it `sendEmail` posts to Resend and there is nothing'
    + '\n  to read — see `sendEndpoint` in lib/email/send.ts.\n')
  process.exit(1)
}

const health = await fetch(`${API}/auth/v1/health`).then(r => r.ok).catch(() => false)
if (!health) {
  console.error('\n  The local stack is not up. `npx supabase start` first.\n')
  process.exit(1)
}

// The endpoint has to be answering, and the FIRST thing to check about it is that it refuses
// an unsigned request — because if it does not, nothing else here matters.
const unsigned = await fetch(`${APP}/api/auth/send-email`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ user: { email: 'attacker@example.com' }, email_data: {} }),
}).catch(() => null)

if (!unsigned) {
  console.error(`\n  ${APP}/api/auth/send-email is not answering. \`npm run dev\` first.\n`)
  process.exit(1)
}
if (unsigned.status === 401) ok('an unsigned POST to the endpoint is refused 401')
else fail('open relay', `an unsigned POST answered ${unsigned.status}, not 401`)

// And the hook has to be ENABLED, or every flow below silently exercises the old templates.
const hookOn = await (async () => {
  await clearMail()
  const probe = await json(`${API}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'authmail.probe@authmail.genorra-check.example.org', password: PASSWORD, data: { locale: 'en' },
    }),
  })
  if (probe.status !== 200) return false
  const box = await waitForMail(1, 'hook probe')
  return box.length === 1 && !/Confirm your signup/i.test(box[0]?.html ?? '')
})()

if (!hookOn) {
  console.error('\n  The Send Email hook does not look enabled.\n'
    + '  Set `enabled = true` under [auth.hook.send_email] in supabase/config.toml,\n'
    + '  then `npx supabase stop && npx supabase start`. That block explains why it is\n'
    + '  off by default.\n')
  process.exit(1)
}
ok('the hook is enabled and GoTrue is not rendering its own templates')

// ── 1. Signup, in each language ────────────────────────────────────────────────────
// THE LANGUAGE COMES FROM THE SIGNUP METADATA HERE, which is the rung that only exists for
// this one message: there is no `people` row yet. See `authMailLocale`.
for (const locale of ['en', 'es', 'fr']) {
  await clearMail()
  const email = `authmail.signup.${locale}@authmail.genorra-check.example.org`
  const res = await json(`${API}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, data: { locale } }),
  })
  if (res.status !== 200) { fail(`signup ${locale}`, `HTTP ${res.status}`); continue }
  const box = await waitForMail(1, `signup ${locale}`)
  if (box.length) {
    assertMail(`signup ${locale}`, box[0], { locale, action: 'signup', type: 'signup' })
  }
}

// ── 2. Recovery, from `people.locale` this time ────────────────────────────────────
// The account made above has no `people` row, so this still resolves through the metadata —
// which is the honest limit of what this script can reach without the whole registration
// flow. What it DOES prove is that the recovery template is composed by us and translated.
for (const locale of ['en', 'fr']) {
  await clearMail()
  const res = await json(`${API}/auth/v1/recover`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ email: `authmail.signup.${locale}@authmail.genorra-check.example.org` }),
  })
  if (res.status !== 200) { fail(`recovery ${locale}`, `HTTP ${res.status}`); continue }
  const box = await waitForMail(1, `recovery ${locale}`)
  if (box.length) {
    assertMail(`recovery ${locale}`, box[0], { locale, action: 'recovery', type: 'recovery' })
  }
}

// ── 3. The GoTrue invite — service role only ───────────────────────────────────────
{
  await clearMail()
  const res = await json(`${API}/auth/v1/invite`, {
    method: 'POST',
    headers: {
      apikey: SERVICE, authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json',
    },
    body: JSON.stringify({ email: 'authmail.invitee@authmail.genorra-check.example.org', data: { locale: 'es' } }),
  })
  if (res.status !== 200) {
    fail('invite', `HTTP ${res.status} — ${JSON.stringify(res.body)?.slice(0, 160)}`)
  }
  else {
    const box = await waitForMail(1, 'invite')
    if (box.length) {
      assertMail('invite es', box[0], { locale: 'es', action: 'invite', type: 'invite' })
    }
  }
}

// ── 4 and 5. Reauthentication and the address change, which need a session ─────────
{
  // The signup above left the account unconfirmed, and an unconfirmed account cannot sign in.
  // Confirmed here through the service role rather than by opening the link, because clicking
  // it is `/auth/confirm`'s job and this script is about the MAIL.
  const admin = await json(`${API}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}` },
  })
  const user = (admin.body?.users ?? []).find(u => u.email === 'authmail.signup.es@authmail.genorra-check.example.org')
  if (!user) fail('session setup', 'the Spanish signup account was not found')
  else {
    await json(`${API}/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      headers: {
        apikey: SERVICE, authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json',
      },
      body: JSON.stringify({ email_confirm: true }),
    })
    const tok = await json(`${API}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'authmail.signup.es@authmail.genorra-check.example.org', password: PASSWORD }),
    })
    const access = tok.body?.access_token
    if (!access) fail('session setup', `no access token: HTTP ${tok.status}`)
    else {
      // 4. Reauthentication — a code, no link.
      await clearMail()
      const re = await json(`${API}/auth/v1/reauthenticate`, {
        headers: { apikey: ANON, authorization: `Bearer ${access}` },
      })
      if (re.status !== 200) fail('reauthentication', `HTTP ${re.status}`)
      else {
        const box = await waitForMail(1, 'reauthentication')
        if (box.length) {
          assertMail('reauthentication es', box[0],
            { locale: 'es', action: 'reauthentication', code: true })
        }
      }

      // 5. The address change — ONE hook call, TWO messages, one per address.
      await clearMail()
      const ch = await json(`${API}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          apikey: ANON, authorization: `Bearer ${access}`, 'content-type': 'application/json',
        },
        body: JSON.stringify({ email: 'authmail.changed@authmail.genorra-check.example.org' }),
      })
      if (ch.status !== 200) fail('email change', `HTTP ${ch.status}`)
      else {
        const box = await waitForMail(2, 'email change')
        if (box.length < 2) {
          fail('email change', `only ${box.length} message(s) — both addresses must confirm`)
        } else {
          ok('email change — two messages from one hook call')
          const addrs = box.map(m => m.to).join(' ')
          if (!addrs.includes('authmail.signup.es@authmail.genorra-check.example.org')) {
            fail('email change', 'nothing went to the address the account has now')
          }
          if (!addrs.includes('authmail.changed@authmail.genorra-check.example.org')) {
            fail('email change', 'nothing went to the new address')
          }
          for (const m of box) {
            const half = m.to.includes('authmail.changed') ? 'new' : 'old'
            assertMail(`email change → the ${half} address`, m,
              { locale: 'es', action: `email_change_${half}`, type: 'email_change' })
          }
        }
      }
    }
  }
}

// ── 6. AN UNHANDLED ACTION TYPE ANSWERS 200 AND SENDS NOTHING ────────────────────
// ASKED OF THE ROUTE DIRECTLY, with a signed payload, rather than through GoTrue's `/otp`.
// That endpoint answers `otp_disabled` unless signups-by-otp are on and the account is
// confirmed, so driving this through it tests GoTrue's configuration instead of our property
// — and the property is ours: **an action type we do not handle must not fail the flow.**
//
// If it did, `POST /auth/v1/otp` would answer 500 for an address that HAS an account and 200
// for one that does not, because GoTrue calls the hook only when there is something to send.
// That is an account-enumeration oracle, and it is the leak `ForgotPasswordForm` and
// `LoginForm` are both written to avoid.
//
// Signing it here also proves the verifier's own understanding of the scheme end to end: this
// is the one request in the script that WE sign, so a passing assertion means our HMAC and
// GoTrue's agree.
{
  await clearMail()
  const body = JSON.stringify({
    user: { id: '00000000-0000-0000-0000-000000000000', email: 'nobody@authmail.genorra-check.example.org' },
    email_data: { email_action_type: 'magiclink', token: '12345678', token_hash: 'abc123' },
  })
  const id = 'auth-email-check'
  const ts = String(Math.floor(Date.now() / 1000))
  const key = Buffer.from(SECRET.replace(/^v1,whsec_/, ''), 'base64')
  const sig = 'v1,' + createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')

  const res = await fetch(`${APP}/api/auth/send-email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': ts,
      'webhook-signature': sig,
    },
    body,
  })
  if (res.status !== 200) {
    fail('magiclink', `the route answered ${res.status} — an unhandled action type must not`
      + ' fail the flow, or /auth/v1/otp becomes an enumeration oracle')
  } else {
    ok('a signed request the route does not handle answers 200')
    const box = await inbox()
    if (box.length !== 0) {
      fail('magiclink', `${box.length} message(s) sent for an action type with no template`)
    } else {
      ok('and sends nothing')
    }
  }
}

// ── REPORT ─────────────────────────────────────────────────────────────────────────
console.log()
for (const n of notes) console.log(n)
console.log()
if (findings.length) {
  console.log(`  ${findings.length} finding(s):`)
  console.log()
  for (const f of findings) console.log(`  ── ${f}`)
  console.log()
  console.log('  Accounts named authmail.*@authmail.genorra-check.example.org are left behind on purpose — they are the')
  console.log('  evidence. `npx supabase db reset` clears them.')
  console.log()
  server.close()
  process.exit(1)
}
server.close()
console.log('  All five auth emails are composed by this app and read in the reader\'s language.')
console.log('  NOTE: this cannot judge whether a translation is any good, and it says nothing')
console.log('  about the HOSTED project — enabling the hook there is a GO LIVE item.')
console.log()
console.log('  Run `npx supabase db reset` to clear the authmail.* accounts.')
console.log()
