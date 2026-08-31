#!/usr/bin/env node
/**
 * WHAT A READER ACTUALLY SEES, IN TWO LANGUAGES, DIFFED. The only honest measure of how
 * much of this product is still English.
 *
 * ── WHY THE OTHER TWO i18n GATES CANNOT ANSWER THIS ────────────────────────────────
 * `npm run i18n:check` asks whether every KEY is defined, used and current. It is
 * structurally blind to a string nobody keyed. `npm run i18n:literals` closes half of that
 * gap by sweeping the source for prose — and a source sweep can only ever recognise the
 * SHAPES it was taught, so on 2026-08-29, with both of them clean and the ceiling at zero,
 * this probe found **399 runs of text identical in English and Spanish** across 43 routes.
 *
 * The shapes `i18n:literals` misses, each of which was a real finding:
 *
 *   a readable attribute written as a template literal   `aria-label={`Delete ${name}`}`
 *   a single capitalised word as JSX text                `<Label>Amount</Label>`
 *   an English fallback after `??`                       `?? 'Unknown fund'`
 *   a caption under a key it does not know               `dues: 'Dues'` in a registry
 *   a ternary inside JSX braces                          `{p ? 'Recording…' : 'Record'}`
 *   a formatter called without the reader's locale       `monthLabel(month)` → "August 2026"
 *   an English plural built by appending a letter        `member{n === 1 ? '' : 's'}`
 *
 * The last two are the ones that matter most, because they are not "untranslated" — they
 * are UNTRANSLATABLE as written. No catalogue can hold a third of a word.
 *
 * ── AND WHY IT IS NOT IN `verify.yml` ──────────────────────────────────────────────
 * It needs the local Supabase stack, a seeded fixture and a running dev server, which is
 * the same reason `realtime:check` and `email:check` are hand-run. It also UNDER-reports by
 * construction and says so below, so it is a worklist rather than a gate.
 *
 * ── WHAT IT CANNOT SEE, SAID PLAINLY ───────────────────────────────────────────────
 *   * Anything behind a control. A dialog's field labels are not in the HTML until the
 *     dialog is open, so the whole Transactions record form read as clean while every
 *     label in it was English.
 *   * Anything an empty fixture does not render — an empty ledger has no rows and no row
 *     captions.
 *   * A string that is genuinely the same in both languages. `India (IST)` is correct and
 *     is reported; so is a family's own data. `EXPECTED_SAME` filters the obvious ones and
 *     the rest are for a person to read past.
 *
 * ── RUNNING IT ─────────────────────────────────────────────────────────────────────
 *     npx supabase start
 *     npm run test:rls                  # seeds the two-family fixture
 *     npm run dev                       # against the LOCAL stack, port 3100
 *     npm run i18n:onscreen
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const API = process.env.SUPABASE_API_URL ?? 'http://127.0.0.1:54321'
const APP = process.env.APP_URL ?? 'http://localhost:3100'
const EMAIL = process.env.PROBE_EMAIL ?? 'alpha.admin@rls.test'
const PASSWORD = 'rls-harness-pw-2026!'

const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!ANON || !SERVICE) {
  console.error('\n  Set NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to the LOCAL stack\'s keys.')
  console.error('  `npx supabase status` prints them.\n')
  process.exit(1)
}

const db = createClient(API, SERVICE, { auth: { persistSession: false } })

const registry = readFileSync('lib/features.ts', 'utf8')
const routes = [...new Set([...registry.matchAll(/href:\s*'(\/[^']*)'/g)].map(m => m[1]))]
  .filter(r => !r.includes('[') && r !== '/admin')
  .concat(['/personal-info', '/my-families'])

const signIn = await (await fetch(`${API}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})).json()
if (!signIn.access_token) {
  console.error(`\n  Could not sign in as ${EMAIL}. Run \`npm run test:rls\` to seed the fixture.\n`)
  process.exit(1)
}

// `@supabase/ssr` stores the whole session as `base64-` + base64url(JSON), chunked at 3180
// encoded characters, under `sb-<first hostname label>-auth-token`.
const value = 'base64-' + Buffer.from(JSON.stringify(signIn), 'utf8').toString('base64url')
const NAME = `sb-${new URL(API).hostname.split('.')[0]}-auth-token`
const MAX = 3180
let cookie
if (encodeURIComponent(value).length <= MAX) {
  cookie = `${NAME}=${encodeURIComponent(value)}`
} else {
  const parts = []
  let rest = value, i = 0
  while (rest.length) {
    let head = rest, enc = encodeURIComponent(head)
    while (enc.length > MAX) { head = head.slice(0, -1); enc = encodeURIComponent(head) }
    parts.push(`${NAME}.${i}=${enc}`); rest = rest.slice(head.length); i++
  }
  cookie = parts.join('; ')
}

/** Visible runs of text, in order. Attributes are not what a reader reads. */
function visibleText(html) {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
  const out = []
  for (const m of body.matchAll(/>([^<]+)</g)) {
    const text = m[1]
      .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .trim().replace(/\s+/g, ' ')
    if (text.length >= 3 && /[A-Za-z]{2}/.test(text)) out.push(text)
  }
  return out
}

async function setLocale(code) {
  const { error } = await db.from('people').update({ locale: code }).eq('primary_email', EMAIL)
  if (error) { console.error('could not set the probe locale:', error.message); process.exit(1) }
}

async function grab(path) {
  const r = await fetch(`${APP}${path}`, { headers: { cookie }, redirect: 'manual' })
  return r.status === 200 ? visibleText(await r.text()) : null
}

// Warm every route once, so a first-compile miss does not read as a difference.
await setLocale('en')
for (const p of routes) await grab(p)

const en = new Map()
for (const p of routes) en.set(p, await grab(p))
await setLocale('es')
const es = new Map()
for (const p of routes) es.set(p, await grab(p))
await setLocale('en')

/** Identical in both languages BY DESIGN — proper nouns, figures, and the family's own data. */
const EXPECTED_SAME = [
  /^GENORRA$/, /^(Free|Standard|Plus|Premium)$/, /^(Español|Français|English)$/,
  /^(EN|ES|FR)( · .*)?$/, /^[\d\s.,:$%+\-–—/()]+$/, /^[A-Z]{2,5}$/,
  // The two-family fixture's own rows. A family's data is not copy.
  /ALPHATEST|BRAVOTEST|CHARLIETEST|Chap Test|Probe|Movable|rls\.test|^alpha|^bravo/,
  /^Renamed by an applicant$|^Outside Invitee$|^scope-case /,
]

const findings = new Map()
for (const p of routes) {
  const a = en.get(p), b = es.get(p)
  if (!a || !b) continue
  const spanish = new Set(b)
  for (const line of a) {
    if (!spanish.has(line)) continue
    if (EXPECTED_SAME.some(re => re.test(line))) continue
    if (!findings.has(line)) findings.set(line, new Set())
    findings.get(line).add(p)
  }
}

const ranked = [...findings].sort((a, b) => b[1].size - a[1].size)
const occurrences = ranked.reduce((n, [, pages]) => n + pages.size, 0)

console.log('')
console.log('  ON-SCREEN ENGLISH — text that did not change when the reader did.')
console.log('')
for (const [line, pages] of ranked) {
  console.log(`  ${String(pages.size).padStart(3)}×  ${line.length > 96 ? line.slice(0, 93) + '…' : line}`)
  console.log(`        ${[...pages].sort().slice(0, 4).join(' ')}${pages.size > 4 ? ' …' : ''}`)
}
console.log('')
console.log(`  ${ranked.length} distinct run(s), ${occurrences} occurrence(s), across ${routes.length} route(s).`)
console.log('')
console.log('  NOTE: this UNDER-reports. It sees only what is on screen in the default state —')
console.log('  nothing behind a dialog, and nothing an empty fixture does not render. See the')
console.log('  header for the full list of what it cannot see.')
console.log('')
