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
 * ── A SECOND MODE: `--force-rtl`, WHICH ASKS A DIFFERENT QUESTION ──────────────────
 * Added 2026-09-01 with the right-to-left layout pass. It renders every route and reads the
 * emitted `class` attributes for a PHYSICAL direction utility — `ml-`, `pl-`, `left-`,
 * `text-right`, `border-l`, `rounded-l` — rather than diffing two languages.
 *
 * IT IS NOT A SECOND COPY OF `npm run i18n:rtl`. That gate reads SOURCE and says so in its own
 * header: it cannot see a class assembled at runtime, `` `m${side}-2` `` or a `style={{ }}`
 * object. This reads what the server actually SENT, so a class built by a `cn()` branch, by a
 * variable, or by a component that only renders under some data is in scope here and nowhere
 * else. The two together are the coverage; either alone has a hole the other fills.
 *
 * It also asserts that `<html>` carries a `dir` at all, which is the one thing that would make
 * every logical utility in the product inert and which nothing else looks at.
 *
 * ── RUNNING IT ─────────────────────────────────────────────────────────────────────
 *     npx supabase start
 *     npm run test:rls                  # seeds the two-family fixture
 *     npm run dev:local                 # the LOCAL stack, port 3100 — NOT `npm run dev`
 *     npm run i18n:onscreen
 *     npm run i18n:onscreen -- --force-rtl
 *
 * ── `dev:local` AND NOT `dev`, AND THE DIFFERENCE IS THE WHOLE RUN ────────────────
 * This said `npm run dev` with three `VAR=value` prefixes, which is bash and fails outright in
 * PowerShell — and the keys were written as `<local anon>`, which reads as a placeholder to a
 * person and as a redirection to a shell.
 *
 * The syntax error was the harmless half. `npm run dev` on its own uses `.env.local`, which
 * points at HOSTED — so the forged session cookie below, named for the LOCAL project, matches
 * nothing, every protected route renders the signed-out shell, and this reports a short tidy
 * list of page titles. A clean run that asked nothing. `scripts/dev-local.mjs` exists so that
 * cannot happen, and the guard below refuses to start against a server that is not signed in.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { localStack, NOT_RUNNING } from './local-stack.mjs'

const API = process.env.SUPABASE_API_URL ?? localStack()?.apiUrl ?? 'http://127.0.0.1:54321'
const APP = process.env.APP_URL ?? 'http://localhost:3100'
const EMAIL = process.env.PROBE_EMAIL ?? 'alpha.admin@rls.test'
const PASSWORD = 'rls-harness-pw-2026!'

// ── THE KEYS ARE DISCOVERED, NOT TYPED ───────────────────────────────────────────────
// An explicit environment variable still wins, so a caller pointing at something unusual can.
// Everything else comes from `supabase status`, which describes the stack on this machine and
// has no route to a hosted project — see `scripts/local-stack.mjs`.
const stack = localStack()
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? stack?.anonKey
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? stack?.serviceKey
if (!ANON || !SERVICE) {
  console.error(`\n  ${NOT_RUNNING}\n`)
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

const FORCE_RTL = process.argv.includes('--force-rtl')

// ── `--force-rtl`: physical direction in the RENDERED markup ──────────────────────────
if (FORCE_RTL) {
  // The same list `scripts/rtl-check.mjs` sweeps the source for, so the two cannot disagree
  // about what counts. Matched inside a `class="…"` attribute only — the HTML is full of
  // English prose containing the words "left" and "right".
  const PHYSICAL = [
    'rounded-tl', 'rounded-tr', 'rounded-bl', 'rounded-br', 'rounded-l', 'rounded-r',
    'border-l', 'border-r', 'scroll-ml', 'scroll-mr', 'scroll-pl', 'scroll-pr',
    'text-left', 'text-right', 'float-left', 'float-right', 'clear-left', 'clear-right',
    'ml', 'mr', 'pl', 'pr', 'left', 'right',
  ]
  const NO_SUFFIX = new Set(['text-left', 'text-right', 'float-left', 'float-right',
    'clear-left', 'clear-right'])
  const OPTIONAL = new Set(['border-l', 'border-r', 'rounded-l', 'rounded-r',
    'rounded-tl', 'rounded-tr', 'rounded-bl', 'rounded-br'])

  function physicalClasses(html) {
    const found = new Map()
    for (const m of html.matchAll(/class="([^"]*)"/g)) {
      for (const cls of m[1].split(/\s+/)) {
        // Strip every variant prefix (`sm:`, `hover:`, `rtl:`) and one leading `-`.
        const bare = cls.split(':').pop().replace(/^-/, '')
        for (const phys of PHYSICAL) {
          const ok = NO_SUFFIX.has(phys) ? bare === phys
            : OPTIONAL.has(phys) ? (bare === phys || bare.startsWith(phys + '-'))
              : bare.startsWith(phys + '-')
          if (ok) { found.set(cls, (found.get(cls) ?? 0) + 1); break }
        }
      }
    }
    return found
  }

  await setLocale('en')
  let pages = 0
  let missingDir = 0
  const all = new Map()
  for (const path of routes) {
    const r = await fetch(`${APP}${path}`, { headers: { cookie }, redirect: 'manual' })
    if (r.status !== 200) continue
    const html = await r.text()
    pages++
    // THE ATTRIBUTE ITSELF. Without it every logical utility in the product resolves
    // left-to-right forever and the whole pass is inert — and nothing else checks it.
    if (!/<html[^>]*\sdir="(ltr|rtl)"/.test(html)) { missingDir++; console.log(`  NO dir=  ${path}`) }
    for (const [cls, n] of physicalClasses(html)) all.set(cls, (all.get(cls) ?? 0) + n)
  }

  console.log('')
  console.log('  PHYSICAL DIRECTION IN THE RENDERED MARKUP — what a source sweep cannot see.')
  console.log('')
  const rows = [...all.entries()].sort((a, b) => b[1] - a[1])
  for (const [cls, n] of rows) console.log(`  ${String(n).padStart(5)}  ${cls}`)
  console.log('')
  console.log(`  ${pages} route(s) rendered · ${rows.length} distinct physical class(es) · `
    + `${missingDir} page(s) with no dir attribute`)
  console.log('')
  if (rows.length === 0 && missingDir === 0) {
    console.log('  Clean. NOTE: a route only shows what its fixture data renders, and nothing')
    console.log('  behind a control is in the markup at all — see the header.')
  } else {
    console.log('  Each is a class that will not mirror. If `npm run i18n:rtl` is clean, it was')
    console.log('  built at runtime — which is the gap this mode exists to cover.')
  }
  console.log('')
  process.exit(rows.length === 0 && missingDir === 0 ? 0 : 1)
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

/**
 * Identical in both languages BY DESIGN — proper nouns, figures, and the family's own data.
 *
 * ── EVERY ENTRY IS A CLAIM, AND A WRONG ONE HIDES A REAL FINDING ──────────────────
 * This list is the only thing standing between the report and the noise, and it is also the
 * only way to make the report lie. So each addition names WHY, and the test is not "does this
 * look untranslatable" but "would translating it be WRONG or IMPOSSIBLE".
 *
 * A word that is genuinely the same in Spanish — `Chat`, `Total` — is the first kind. A row the
 * fixture wrote is the second. Anything else belongs in a catalogue.
 */
const EXPECTED_SAME = [
  /^GENORRA$/, /^(Free|Standard|Plus|Premium)$/, /^(Español|Français|English)$/,
  /^(EN|ES|FR)( · .*)?$/, /^[\d\s.,:$%+\-–—/()]+$/, /^[A-Z]{2,5}$/,
  // The two-family fixture's own rows. A family's data is not copy.
  /ALPHATEST|BRAVOTEST|CHARLIETEST|Chap Test|Probe|Movable|rls\.test|^alpha|^bravo/,
  /^Renamed by an applicant$|^Outside Invitee$|^scope-case /,
  // ── ADDED 2026-09-01, WORKING THE REPORT DOWN FROM 37 ────────────────────────────
  //
  // THE FIXTURE'S OWN FAMILY, renamed by a case in `tests/rls`. `Renamed Alphatest` is what
  // `admin/family.renameFamily`'s control leaves behind, so it is data written by the suite
  // rather than anything this product says.
  /^Renamed Alphatest$/,
  //
  // WORDS THAT ARE THE SAME IN SPANISH, checked against the catalogue rather than assumed:
  // `nav.item./community/chat` is 'Chat' in all three, and `money.total` is 'Total'. Both ARE
  // keyed and ARE translated — the translation is simply the same string, which is what a
  // render diff cannot distinguish from an untranslated one.
  /^(Chat|Total)$/,
  //
  // A TIMEZONE LABEL. `India (IST)` and `China (CST)` come from `timezoneLabel`, and the
  // header above already names this as the case that "is correct and is reported". The country
  // is keyed; the abbreviation in brackets is the zone's own name and does not translate.
  /^[A-Z][A-Za-z ]+ \([A-Z]{2,5}\)$/,
  //
  // SEEDED DATABASE ROWS — the system templates, the built-in Donations fund and its
  // description, and the dues flags a family typed. Every one is a row a migration or a
  // treasurer wrote, and translating a row would mean translating a family's own records.
  //
  // THIS IS THE ENTRY MOST WORTH RE-READING BEFORE TRUSTING. `Administrators`, `General` and
  // `Donations` are seeded in English by `20260618000000` and `20260807000003`, so a Spanish
  // family sees English names for things they never chose. That is a REAL product question
  // and it is not this script's to answer — a per-family row cannot be keyed, and the honest
  // fix is either seeding in the family's language at creation or letting them rename. TODO.md
  // carries it, and it is excused here so it stops crowding out defects that ARE code.
  /^(Administrators|General|Donations|Dues)$/,
  /^Every donation the family receives lands here/,
  //
  // AND THE FIXTURE'S OWN DUES SCHEDULES, which is what `optional` and `annual` are: labels on
  // rows `tests/rls/seed.mjs` inserted, rendered beside the amount a treasurer set.
  /^(optional|annual|required|monthly|quarterly)$/,
  //
  // AND THE FIXTURE'S BIRTHDAY GREETING, which `tests/rls/cases.mjs` writes verbatim as a
  // `birthday_greetings` row. The PRODUCT's default greeting is keyed
  // (`birthday.heroGreeting`); this is a row the suite inserted to have one to assert on.
  /^Happy birthday!$|^Wishing you a wonderful day from all of us\.$/,
  //
  // A PAGE TITLE ENDING IN THE PRODUCT NAME. `app/layout.tsx`'s `title.template` appends
  // " — GENORRA" to every segment, so a title whose own half is a word that does not translate
  // ("Chat") comes out identical. The template is the same in every language on purpose — see
  // `lib/brand.ts`, which is the one string never translated.
  /— GENORRA$/,
  //
  // WORDS THAT ARE THE SAME IN SPANISH, second batch. `set.pane.plan` is 'Plan' in all three,
  // checked in the catalogue rather than assumed. `Members` is `nav.item./admin/members`'s
  // Spanish 'Integrantes' — it is here for the DASHBOARD TILE, which is a different key.
  /^Plan$/,
]

/**
 * ── IT IS A RATCHET NOW, AND THAT IS THE ANSWER TO "SHOULD THIS BE A GATE" ─────────
 * Decided 2026-09-01, after working the report from 37 distinct runs down to this.
 *
 * **A ceiling, yes. A `verify.yml` step, no** — and the two halves of that need separate
 * reasons, because it would be easy to conclude the second follows from the first.
 *
 * THE CEILING, because without one this is a worklist somebody reads and forgets, and every
 * other i18n gate in this repo is a ratchet for exactly that reason. Below it the script exits
 * 0; above it, 1. Lowering it is routine; raising it owes a sentence on this line.
 *
 * NOT IN `verify.yml`, and not for the usual "it needs the local stack" reason — that workflow
 * already runs `supabase start`, `db reset` and `test:rls`. Two harder facts:
 *
 *   * **It needs a RUNNING APP**, which means a build and 92 route renders on every pull
 *     request. `realtime:check` and `art:check` are hand-run on a weaker version of the same
 *     argument, and `email:check` is out because of a credential.
 *   * **IT IS FIXTURE-DEPENDENT, WHICH IS THE DISQUALIFYING ONE.** Half of what it reports is
 *     a row `tests/rls/seed.mjs` wrote, and `EXPECTED_SAME` is a list of regexes excusing them
 *     BY THEIR CONTENT. A perfectly ordinary change to the fixture — renaming a probe family,
 *     seeding a second dues schedule — turns this red for something that is not a regression,
 *     on a pull request that never touched a string. A gate that cries wolf on unrelated
 *     changes is a gate people learn to ignore, which is worse than one they run deliberately.
 *
 * So: run it after any pass over copy, and treat the ceiling as the number to beat.
 */
const CEILING = 0

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
console.log(`  ${ranked.length} distinct run(s), ${occurrences} occurrence(s), across `
  + `${routes.length} route(s). Ceiling ${CEILING}.`)
console.log('')
console.log('  NOTE: this UNDER-reports. It sees only what is on screen in the default state —')
console.log('  nothing behind a dialog, and nothing an empty fixture does not render. See the')
console.log('  header for the full list of what it cannot see.')
console.log('')
if (ranked.length > CEILING) {
  console.log(`  ABOVE THE CEILING by ${ranked.length - CEILING}. Either key the string, or —`)
  console.log('  if it is genuinely identical in both languages, or a row the fixture wrote —')
  console.log('  add it to EXPECTED_SAME with the reason. A regex there is a CLAIM.')
  console.log('')
  process.exit(1)
}
console.log('  Under the ceiling.')
console.log('')
