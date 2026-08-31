/**
 * COPY THAT WAS NEVER KEYED — the half `npm run i18n:check` structurally cannot see.
 *
 *     npm run i18n:literals
 *
 * Exits 1 above the ceiling, so it reads as a test. No database and no network.
 *
 * ── WHY THIS EXISTS BESIDE `i18n:check` RATHER THAN INSIDE IT ───────────────────────
 * That script proves every KEY is defined, used, fingerprinted and still a translation of
 * what it says it is. Every one of its seven findings is about a key. It is therefore
 * completely blind to a string nobody keyed — which is not a corner case, it is the whole
 * of the work: an English literal in a component renders English to every reader, in
 * silence, and passes every gate in the repo including the type checker.
 *
 * How that was found is worth recording, because it is the argument for a ratchet rather
 * than a review. On 2026-08-27 the public site was believed finished — four bundles, 3,900
 * keys, `i18n:check` clean. A probe rendered all nine public pages in three languages and
 * diffed the visible text: **224 lines came back identical in all three.** The sign-in
 * page, the sign-up page, the quote carousel's chrome, the three pillar drawings and every
 * page title on the auth flow. Nothing in the tree could say so.
 *
 * That probe cannot be a gate — it needs a built server and three HTTP requests per page,
 * and it cannot see a screen behind a login at all. This is the static half: it counts what
 * a reader would see in English, and the count is the thing that ratchets.
 *
 * ── WHAT IT LOOKS AT, AND WHAT IT DELIBERATELY DOES NOT ────────────────────────────
 * FOUR SHAPES, chosen because each is a string a reader reads and none of them can be
 * anything else:
 *
 *   1. A JSX TEXT NODE that reads as prose — `<p>Sign in to your account</p>`.
 *   2. The four USER-FACING ATTRIBUTES — `placeholder`, `aria-label`, `title`, `alt`.
 *   3. `message:` in a server action's return value, which is what a form shows on refusal.
 *   4. `label:`/`heading:`/`lede:`/`blurb:` in a registry object, which is how this codebase
 *      writes a screen's captions.
 *   5. A TEMPLATE LITERAL whose literal parts read as prose — `` `Actions for ${name}` ``.
 *   6. A MIXED JSX TEXT NODE — prose with an expression inside it, which shape 1 cannot see
 *      because its regex forbids `{` in the run.
 *
 * ── SHAPE 5 WAS EXCLUDED ON A COST THAT TURNED OUT TO BE WRONG ─────────────────────
 * Shapes 3 and 4 carried this for a fortnight: *"Single-quoted only, because a template
 * literal is almost always interpolating an id or a count and the false-positive rate on
 * those is not worth the handful it would add."* Reasonable when the backlog was 1,027 and
 * a handful was noise. **Measured 2026-08-31, with the count at zero: it is not a handful,
 * it is ~300** — every `aria-label={`Actions for ${x}`}`, every confirm-dialog sentence, and
 * every `message:` a form shows that happens to name a fund or a count. So the whole of
 * `TransactionsClient` could be keyed to the last string and a Spanish reader would still be
 * told "Transfer that or less."
 *
 * The false positives are real and they are handled the way this file already says to handle
 * them: `NOT_COPY`, with a reason each. What made that affordable is the exclusion below.
 *
 * ── THE CALLEE IS RESOLVED, AND `console.*` IS NOT COPY ────────────────────────────
 * Half of the raw hits were diagnostics — `console.error(`fund names read failed for ${code}`)`.
 * Those are addressed to whoever reads a server log and translating them would be absurd, so
 * the scanner walks back to the enclosing CALL and drops the literal when the callee is a
 * `console` method or an `Error` constructor. That is a judgement about the POSITION rather
 * than about the words, which is the same discipline the four shapes above are built on.
 *
 * NOT looked at, each for a reason:
 *
 *   * `lib/` — the catalogues live there, so their English IS the source. `lib/help/content.ts`
 *     is 79KB of English prose whose translation is DERIVED, and `lib/testimonials.ts` must
 *     never be translated at all (rule 4, and the FTC's rule on fake testimonials).
 *   * `className`, `href`, `src`, `id`, `key`, `type`, `role`, `name`, `value` — technical.
 *   * COMMENTS. This codebase argues at length in prose and the arguments are not copy.
 *   * A single word with no lower-case letter after it — `{APP_NAME}`, `USD`, an initial.
 *   * Anything in `PROPER_NOUNS` below.
 *
 * ── IT IS A RATCHET, NOT A PASS/FAIL ──────────────────────────────────────────────
 * `CEILING` is the number of literals in the tree on the day it was written. Lower it
 * freely; raising it is a deliberate act needing a sentence, exactly as
 * `BACKLOG_CEILING` in `scripts/rls-coverage.mjs` is. Without a ceiling a new screen could
 * ship un-keyed in the same commit that adds it, which is the rule broken with the audit's
 * blessing.
 *
 * ── WHAT IT CANNOT DO ─────────────────────────────────────────────────────────────
 * It cannot tell prose from a technical string in every case, and it does not try to be
 * exact — a heuristic with a stable count is a working ratchet, and a heuristic that
 * insists on being right is a rewrite every time somebody formats a file differently. So
 * treat the NUMBER as the signal and the per-file list as a work queue, and if a false
 * positive is genuinely not copy, add it to `NOT_COPY` with a reason rather than widening a
 * regex.
 *
 * It also cannot tell whether a string a reader never reaches matters. A `message:` on an
 * action nobody can call is still counted, because deciding otherwise means reading 33
 * files to build a list that goes stale.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()

/**
 * ZERO, as of 2026-08-27. LOWER IT FREELY — there is nowhere left to lower it to, which is
 * the point: from here the ratchet is a real gate rather than a backlog counter, and any
 * finding at all is a screen that shipped in English only.
 *
 * ── RAISING IT IS A DELIBERATE ACT AND NEEDS A SENTENCE HERE ──────────────────────
 * The honest reason to raise it is a scanner false positive, and the better answer to one of
 * those is `NOT_COPY` below — a named entry with a reason, which is diffable, rather than a
 * number that quietly admits an unknown quantity of English.
 *
 * ── WHAT IT WAS, AND HOW LONG IT TOOK ────────────────────────────────────────────
 * 1,027 when this script was written. 325 three hours later, once `app/actions/**` was swept
 * — 702 call sites over 397 sentences, every refusal a form can show. 0 that evening, once
 * the Dashboard's own 305 strings were keyed.
 *
 * WHAT IS DELIBERATELY OUT OF ITS SIGHT, so nobody goes looking: `lib/` is not swept at all.
 * The catalogues live there and their English IS the source; `lib/help/content.ts` is the
 * manual, whose translation is DERIVED; and `lib/testimonials.ts` must never be translated
 * (rule 4 in that file, and the FTC's rule on fabricated testimonials).
 *
 * ── RAISED TO 413 AND BACK TO 0 ON 2026-08-31 ────────────────────────────────────
 * Three shapes arrived that day — 5 (a template literal), 6 (a mixed JSX text node) and the
 * caption PROPS on shape 2 — plus `error` on `CAPTION_KEYS`. Together they found **413 strings
 * the four original shapes could not see**, which is worth stating plainly: "0 unkeyed
 * literals" had been a true statement about four shapes and a false impression about the
 * product. A Spanish reader was still being told "Transfer that or less.", "Only 3 days are
 * left this month", "Error reference:" and "Region not found".
 *
 * All 413 are keyed, and the ceiling is 0 again. Twenty-two batches; roughly 900 catalogue keys
 * across the three languages. What each new shape was worth, measured as it went in:
 *
 *   5  template literal          279   aria-labels, confirm dialogs, `message:` with a count
 *   6  mixed JSX text node       134   prose with `{amount}` in the middle of it
 *   2  the caption props          30   `<Figure label="Expected this year">`
 *   3  `error:` beside `message:`  62   half of app/actions/admin/** answers with `error`
 *
 * The lesson for the next shape somebody thinks of: the four original ones were chosen because
 * each is unambiguous, and that is still the right test — but "unambiguous" was doing double
 * duty as "complete", and it is not. Every one of these four was a shape somebody had looked
 * at and decided was too noisy to check.
 *
 * BOTH NEW SHAPES WERE MUTATION-CHECKED, because a filter that ships inert reads exactly like
 * a clean tree — and one of them did, for about ten minutes: the keyword regex below was
 * authored through a shell heredoc, which ate a backslash level and turned `` into 0x08, so
 * it matched nothing and reported a smaller number. The figures, each against 413:
 *
 *   drop `console.*` from `NOT_A_READER`          667   (+254 server-log diagnostics)
 *   drop shape 6's keyword filter                 420   (+7 fragments of TypeScript)
 *   drop `t`/`docTitle` from `NOT_A_READER`       415   (+2 composed catalogue keys)
 *
 * The number is honest rather than aspirational, and every entry is a work item. Ratchet it
 * down; it must not go back up.
 */
const CEILING = 0

/** Directories swept. `lib/` is deliberately absent — see the header. */
const ROOTS = ['app', 'components']

/** Skipped wholesale. */
const SKIP_DIRS = new Set(['node_modules', '.next', 'design', '__snapshots__'])

/**
 * Attributes whose value a person reads. `title` is on the list because it is a tooltip;
 * `name`, `id`, `type` and `role` are not, because they are contracts with the platform.
 *
 * ── THE CAPTION PROPS ARE HERE AS WELL AS IN `CAPTION_KEYS`, AND THAT IS THE POINT ──
 * Shape 4 finds `label: 'Expected this year'` — a caption in an OBJECT. It cannot find
 * `label="Expected this year"` — the same caption passed as a JSX ATTRIBUTE to one of this
 * codebase's own components, which is how most of them are actually written. Measured on
 * `DuesProjectionsClient`: four `<Figure label=… caption=…>` captions and a `prefix="Full year"`,
 * every one of them a heading on the Dues Projections screen, none of them visible to any of
 * the first six shapes.
 *
 * The list is the props THIS codebase names copy with, which is why it is longer than the HTML
 * set: `Figure`, `MetaIf`, `Dialog`, `RowMenu`, `PersonMultiSelect` and `confirm()` all take one.
 * `name`, `id`, `type`, `role`, `value`, `href`, `src` and `key` stay off it.
 */
const READABLE_ATTRS = [
  'placeholder', 'aria-label', 'aria-description', 'title', 'alt',
  'label', 'caption', 'summary', 'hint', 'lede', 'heading', 'blurb', 'note',
  'description', 'confirmLabel', 'emptyMessage', 'empty', 'prefix', 'suffix',
]

/**
 * Object keys this codebase writes a screen's captions under.
 *
 * `error` is on the list as well as `message`, and finding out why took six shapes: about half
 * of `app/actions/admin/*` returns `{ success: false, error }` rather than
 * `{ success: false, message }`, and both are rendered by `FormError`. `deleteRegion`'s
 * `error: 'Region not found'` is the worked example — a refusal a member reads, in English,
 * invisible to every other shape here.
 */
const CAPTION_KEYS = [
  'message', 'error', 'label', 'heading', 'lede', 'blurb', 'summary', 'description',
]

/**
 * Strings that look like prose and are not translated ANYWHERE, so counting them would be
 * asking for a translation that must not happen. Each needs a reason.
 */
const PROPER_NOUNS = new Set([
  'GENORRA',          // lib/brand.ts is the one place the product name lives
  'ClearPath Digital', // the company that built it
  'Stripe', 'Supabase', 'Resend', 'Vercel', 'PostgREST', 'Google',
  'Facebook', 'Instagram', 'X',
  'Free', 'Standard', 'Plus', 'Premium', // plan names — proper nouns, see lib/tiers.ts
  'Español', 'Français', 'English',      // endonyms, identical in every language by design
])

/**
 * Individual literals that are not copy and cannot be told apart by shape. A reason each.
 * Prefer this over widening a regex — a regex change is invisible and this is a list.
 */
const NOT_COPY = new Map([
  // A COMPARATOR AND A REDUCER, both caught because a JSX-text scan cannot tell a `>` that
  // closes a tag from one that is a greater-than sign in an arrow function's body. Both
  // start with a capital and contain a lower-case word, which is the whole test. Listed
  // here rather than answered with a wider regex, per the header: a list is diffable and a
  // regex change is invisible.
  ["ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.email.localeCompare(b.email, 'en') || (a.userId",
    'app/actions/staff/access.ts — a sort comparator, inside a `=>` body'],
  ['Math.max(m, bar.lane + 1), most), 0, ) return (',
    'components/calendar/MonthCalendar.tsx — the lane reducer, same shape'],
  // A RESPONSE BODY TO A MACHINE. `app/api/auth/send-email/route.ts` answers GoTrue, and
  // GoTrue does not pass it on — measured: a refused hook surfaces to the client as its own
  // `Unexpected status code returned from hook: 500`, never as our text. So nothing reads
  // this string, and translating it would be translating a status code.
  ['Not authorized',
    'app/api/auth/send-email/route.ts — the hook response body, read by GoTrue'],

  // ── `priceShapeError`'s SIX DETAILS, WHOSE ONLY READER IS `console.error` ─────────
  // `app/actions/billing.ts` splits that function's return deliberately: `message` is what the
  // family is shown and IS keyed (`bill.priceMisconfigured`), while `detail` names the Stripe
  // price id and goes to the server log — line 342, `console.error(… ${shapeError.detail})`.
  // The scanner's `console.*` exclusion cannot see it, because the literal is an argument to
  // the local `bad()` helper and only the RESULT reaches `console.error`. Listed rather than
  // answered by teaching the scanner about a one-letter local name, which would exclude every
  // `bad(` in the tree forever.
  ['the id does not look like a Stripe Price (expected price_…, got …)',
    'app/actions/billing.ts — priceShapeError detail; log only'],
  ['could not be retrieved:', 'app/actions/billing.ts — priceShapeError detail; log only'],
  ['the recurring interval is', 'app/actions/billing.ts — priceShapeError detail; log only'],
  [', and there is one monthly rate per tier',
    'app/actions/billing.ts — priceShapeError detail; log only'],
  ['the currency is , not usd', 'app/actions/billing.ts — priceShapeError detail; log only'],
  ['Stripe charges and every screen quotes',
    'app/actions/billing.ts — priceShapeError detail; log only'],

  // A FIELD ON A STRIPE OBJECT, not a string in this product. It is the `description` of an
  // invoice item, so its readers are Stripe's own invoice renderer and the Stripe dashboard —
  // both of which localise their chrome and neither of which would translate ours. Writing it
  // in the acting member's language would also make the family's ledger at Stripe a mixture of
  // three languages depending on who happened to press the button.
  ['Unused term carried forward ( )',
    'app/actions/billing.ts — a Stripe invoice-item description, not our UI'],

  // ── FOUR MORE OF THE SAME KINDS, found by shapes 5 and 6 on 2026-08-31 ───────────
  // A DOM ID, which is markup rather than words. `aria-labelledby` points at it and nobody
  // ever reads it: `also-${tier}-heading` in the /features ALSO grid.
  ['also- -heading', 'app/(marketing)/features/page.tsx — an element id for aria-labelledby'],

  // A POSTGREST COLUMN PROJECTION. It is a template literal because the embed is long, and
  // every word in it is a column or a constraint name.
  ['check_in_id, state, note, safety_check_ins!safety_check_in_people_check_in_id_fkey ( id, title, detail, status, raised_by, created_at )',
    'app/actions/safety-check-ins.ts — a .select() projection'],

  // TWO FIELDS ON RECORDS RATHER THAN ON SCREENS, the same call as billing's invoice
  // description. `Dues payment · <family>` is a Stripe line-item name on the family's own
  // Stripe invoice; `Notifications screen · <key>` is the `note` column on an audit row.
  // Writing either in the acting member's language would make one family's records a mixture
  // of three depending on who happened to press the button.
  ['Dues payment ·', 'app/actions/pay-dues.ts — a Stripe line-item name, not our UI'],
  ['Notifications screen ·', 'app/actions/notification-prefs.ts — an audit `note` column'],

  // A LOG REASON. `refuse(status, logReason)` in the GoTrue send-email hook puts its second
  // argument through `console.error` and answers the CALLER a fixed `Not authorized` — which
  // is itself already on this list, two entries up, for the same reason.
  ['no recipient on a', 'app/api/auth/send-email/route.ts — a console.error reason'],

  // ── THE LAST THREE, 2026-08-31, and none of them has a reader ────────────────────
  // A WEBHOOK `detail`. `lib/stripe/webhook-route.ts` puts it through `console.error` and
  // stores it on the `stripe_webhook_events` row; the HTTP answer to Stripe is a status code.
  ['arrived on the Connect endpoint with no account — check which endpoint this URL is bound to',
    'app/api/stripe/connect/route.ts — a webhook detail; log and event ledger only'],

  // A 405 BODY ANSWERING A BROWSER PASTE. Its own comment says what it is for: somebody
  // wiring an endpoint up and checking the URL exists. Stripe never reads it — Stripe POSTs.
  ['This endpoint accepts POST from Stripe only.',
    'app/api/stripe/connect/route.ts — the GET 405 body, read while wiring an endpoint'],

  // A DOMAIN NAME. `yourfamily.genorra.com` in the Premium website mock-up — the product name
  // comes from `lib/brand.ts` and the rest is DNS, which does not translate.
  ['yourfamily. .com', 'components/marketing/LivingSitePreview.tsx — a hostname in a mock-up'],
])

function tsxFiles(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    let s
    try {
      s = statSync(full)
    } catch {
      continue
    }
    if (s.isDirectory()) tsxFiles(full, out)
    else if (/\.(tsx|ts)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/**
 * Comments out, so an argument written in prose is not counted as copy.
 *
 * Replaced by spaces of the same length rather than removed, so every offset and every line
 * number below still points at the real source. A `//` inside a string literal or a URL
 * would be mangled by a naive sweep, so string literals are walked first and skipped.
 */
function stripComments(src) {
  let out = ''
  let i = 0
  while (i < src.length) {
    const two = src.slice(i, i + 2)
    if (two === '//') {
      const end = src.indexOf('\n', i)
      const stop = end === -1 ? src.length : end
      out += ' '.repeat(stop - i)
      i = stop
      continue
    }
    if (two === '/*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      out += src.slice(i, stop).replace(/[^\n]/g, ' ')
      i = stop
      continue
    }
    if (two === '{/') {
      // A JSX comment — `{/* … */}`. The braces are part of it.
      const end = src.indexOf('*/}', i)
      if (end !== -1) {
        const stop = end + 3
        out += src.slice(i, stop).replace(/[^\n]/g, ' ')
        i = stop
        continue
      }
    }
    const ch = src[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      // Copy the literal through untouched, so a `//` inside it survives.
      let j = i + 1
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue }
        if (src[j] === ch) { j += 1; break }
        if (ch !== '`' && src[j] === '\n') break   // an unterminated quote; give up here
        j += 1
      }
      out += src.slice(i, j)
      i = j
      continue
    }
    out += ch
    i += 1
  }
  return out
}

/** Does this run of words read as something a person was meant to read? */
function isProse(text) {
  // WHITESPACE NORMALIZED BEFORE THE TWO LOOKUPS, because a JSX text node is wrapped across
  // lines by whatever the formatter did and the lists below are written as one line. Without
  // this, an entry in `NOT_COPY` silently matches nothing — measured, and it is the sort of
  // no-op that reads as the list being ignored.
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length < 4) return false
  if (PROPER_NOUNS.has(trimmed)) return false
  if (NOT_COPY.has(trimmed)) return false
  // Must open with a capital or an opening punctuation mark a sentence can open with.
  if (!/^[A-Z¿¡“"']/.test(trimmed)) return false
  // Must contain a lower-case word: `USD`, `PGRST201` and `AND` are not copy.
  if (!/[a-z]{2}/.test(trimmed)) return false
  // A single capitalised word is a label at most and usually an identifier. Two or more
  // words, or one word ending in punctuation, is prose.
  if (!/\s/.test(trimmed) && !/[.!?…:]$/.test(trimmed)) return false
  // Reject what is obviously code that happens to start with a capital.
  if (/^[A-Z][A-Za-z]*\(/.test(trimmed)) return false
  if (/^[A-Z][A-Za-z0-9_]*$/.test(trimmed)) return false
  if (/[{}<>$]/.test(trimmed)) return false
  if (/^https?:/.test(trimmed)) return false
  return true
}

/**
 * Does the literal content of a template read as prose?
 *
 * ── THE PARTS ARE JOINED, NOT TESTED ONE BY ONE ───────────────────────────────────
 * `isProse` requires an opening capital, which is right for a JSX text node and wrong here: a
 * run that follows an interpolation legitimately starts lower-case. Testing
 * `` `Only ${n} day${s} are left this month, which is too small a charge` `` run by run gives
 * "Only" (one word, rejected), " day" (no capital, rejected) and " are left this month, …"
 * (no capital, rejected) — so the sentence a member actually reads scores zero. Joining first
 * asks the question that matters: is there prose in here.
 */
function isTemplateProse(parts) {
  const joined = parts.join(' ').trim().replace(/\s+/g, ' ')
  if (joined.length < 5) return false
  if (PROPER_NOUNS.has(joined)) return false
  if (NOT_COPY.has(joined)) return false
  // TECHNICAL SHAPES FIRST, because several of them contain lower-case words.
  if (/^https?:|^\/|^#|^@|^\.\//.test(joined)) return false
  if (/^[a-z-]+:[a-z0-9]/.test(joined)) return false                       // `mailto:`, `sb-…:`
  if (/\b(?:flex|grid|rounded|shrink|inset|absolute|relative|truncate)\b/.test(joined)) return false
  if (/(?:^|\s)(?:text|bg|border|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|gap|w|h|min|max|z|top|left|right|bottom|size|space|ring|opacity|col|row)-/.test(joined)) return false
  if (/(?:^|\s)(?:sm|md|lg|xl|2xl|hover|focus|active|disabled|dark|motion-reduce|peer|group|first|last|odd|even|aria)[:-]/.test(joined)) return false
  // Two or more words, at least one of them lower-case and at least two letters long.
  const words = joined.split(/\s+/).filter(w => /[A-Za-z]/.test(w))
  if (words.length < 2) return false
  if (!words.some(w => /^[a-z][a-z]/.test(w.replace(/[^A-Za-z]/g, '')))) return false
  // An identifier list, a SQL fragment or a column projection — commas with no spaces after.
  if (/^[a-z_]+(?:,\s?[a-z_(]+)+$/.test(joined)) return false
  // AT LEAST ONE ORDINARY WORD. A dotted path splits into "words" that pass every test above —
  // `mkt.also.` and `.title` are two words with lower-case letters in them — so a composed key
  // scores as prose without this. Requiring one run of three or more letters with nothing but
  // letters and sentence punctuation in it is what tells a sentence from a path.
  if (!joined.split(/\s+/).some(w => /^[A-Za-z][A-Za-z'’-]{2,}[.,!?;:)]?$/.test(w))) return false
  return true
}

/**
 * The name of the function whose argument list this offset sits in, or ''.
 *
 * Walks backwards counting parens, then reads the identifier before the unbalanced `(`. Used
 * for one decision only — whether a template literal is a diagnostic rather than copy — so it
 * is deliberately shallow: it does not resolve members beyond `a.b`, and a miss falls through
 * to counting the literal, which is the safe direction for a gate.
 */
function calleeAt(src, offset) {
  let depth = 0
  let i = offset - 1
  const stop = Math.max(0, offset - 400)
  while (i >= stop) {
    const c = src[i]
    if (c === ')') depth++
    else if (c === '(') {
      if (depth === 0) {
        let j = i - 1
        while (j >= 0 && /\s/.test(src[j])) j--
        let end = j + 1
        while (j >= 0 && /[A-Za-z0-9_$.]/.test(src[j])) j--
        return src.slice(j + 1, end)
      }
      depth--
    }
    i--
  }
  return ''
}

/**
 * Callees whose string arguments are never copy.
 *
 * Two kinds, and both are decisions about POSITION rather than about words. `console.*` and the
 * `Error` constructors are addressed to a log or a stack trace. `t` and `docTitle` take a
 * catalogue KEY — so `` t(`mkt.also.${id}.title`) `` is a composed key, and counting it would
 * report the lookup as the thing needing a lookup.
 */
const NOT_A_READER = /(?:^|\.)(?:console\.(?:log|error|warn|info|debug|trace)|Error|TypeError|RangeError|assert|t|docTitle)$/

const findings = []

function scan(file) {
  const rel = relative(ROOT, file).split(sep).join('/')
  const raw = readFileSync(file, 'utf8')
  const src = stripComments(raw)
  const lineOf = offset => src.slice(0, offset).split('\n').length

  const seen = new Set()
  const add = (offset, text, shape) => {
    const line = lineOf(offset)
    const dedupe = `${line}:${text}`
    if (seen.has(dedupe)) return
    seen.add(dedupe)
    findings.push({
      file: rel,
      line,
      // NORMALIZED, for the report. A multi-line JSX text node reads as one line here.
      text: text.trim().replace(/\s+/g, ' '),
      // AND THE RAW RUN, exactly as it sits in the file. `--list` emits it with its
      // newlines escaped, because a sweep has to match the source and not the report —
      // that distinction cost a whole batch of silent misses the first time.
      raw: text,
      shape,
    })
  }

  // 1 — a JSX text node. Between a `>` that closes a tag and the `<` that opens the next.
  //     Requiring the run to be free of `{`, `}` and `<` is what keeps an interpolated
  //     expression out; a mixed node like `Sign in to your {APP_NAME} account` is caught by
  //     its longest literal run instead, which is the right answer for counting.
  for (const m of src.matchAll(/>([^<>{}]{4,})</g)) {
    for (const run of m[1].split(/\s{2,}\n\s*/)) {
      if (isProse(run)) add(m.index + 1, run, 'jsx')
    }
  }

  // 2 — the readable attributes.
  for (const attr of READABLE_ATTRS) {
    const re = new RegExp(`\\b${attr}\\s*=\\s*(["'])((?:(?!\\1)[^\\\\]|\\\\.)*)\\1`, 'g')
    for (const m of src.matchAll(re)) {
      if (isProse(m[2])) add(m.index, m[2], attr)
    }
  }

  // 3 and 4 — a caption or a refusal message in an object literal. Single-quoted; the
  //     template-literal form of the same thing is shape 5, which catches it wherever it sits
  //     rather than only under a known key.
  for (const key of CAPTION_KEYS) {
    const re = new RegExp(`\\b${key}\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'g')
    for (const m of src.matchAll(re)) {
      if (isProse(m[1])) add(m.index, m[1], key)
    }
  }

  // 6 — a MIXED JSX text node: prose with an expression in the middle of it.
  //     Shape 1 requires the run to be free of `{` and `}`, so `Next payment {amount},
  //     covering what has come due so far` matches NOTHING there — the run from `>` to the
  //     next `<` contains a brace, so the regex never fires. Its comment claimed such a node
  //     was "caught by its longest literal run instead", and that is only true when the run
  //     BEFORE the first expression happens to start with a capital.
  //
  //     THE END ANCHOR IS WHAT MAKES THIS SAFE. `>` and `<` are also comparison operators and
  //     generic brackets, and the existing shape already carries two `NOT_COPY` entries for
  //     comparators it cannot tell from tags. Requiring the region to END at something that
  //     starts a TAG — `</` or `<` followed by a letter — plus rejecting a remainder holding
  //     `;` or `=` (statement punctuation that JSX prose does not contain) is what keeps
  //     `Array<string>` and `a > b ? c : d` out of the count.
  //     `[^<>]` already admits braces, so no alternation is needed — and must not be used:
  //     `(?:[^<>]|\{[^{}]*\})+?` is the same language and backtracks exponentially, which
  //     hung the whole sweep on the first file over a few hundred lines.
  for (const m of src.matchAll(/>([^<>]{4,})<(?=\/|[A-Za-z])/g)) {
    const region = m[1]
    if (!region.includes('{')) continue          // shape 1 already owns the pure-text case
    const parts = region.split(/\{[^{}]*\}/)
    const remainder = parts.join(' ')
    //     WHAT KILLS THE GENERICS. `Record<A, B>` and `Promise<Foo>` produce exactly this
    //     shape — a `>` then a run then a `<` followed by a letter — so the end anchor alone
    //     is not enough, and measured on the tree it was not close: 385 hits of which roughly
    //     three in four were fragments of code like `} export function MetaIf( : ) {`.
    //     Statement punctuation and a keyword list are what separate them. JSX prose contains
    //     none of these words; a region of TypeScript almost always contains one.
    if (/[;=(){}[\]]/.test(remainder)) continue
    if (/\b(?:function|return|const|let|var|export|import|interface|type|await|async|null|undefined|Promise|Record|Partial|typeof|extends|implements|readonly|new|class|throw|catch|switch|case|default|void|never|unknown|any|string|number|boolean)\b/.test(remainder)) continue
    if (isTemplateProse(parts)) {
      add(m.index + 1, remainder.trim().replace(/\s+/g, ' '), 'jsx-mixed')
    }
  }

  // 5 — a template literal whose literal parts read as prose. See `isTemplateProse` for why
  //     the parts are joined before the test, and the header for why `console.*` is dropped.
  for (const m of src.matchAll(/`((?:[^`\\]|\\.)*)`/g)) {
    const body = m[1]
    if (!body || body.length < 5) continue
    if (NOT_A_READER.test(calleeAt(src, m.index))) continue
    const parts = body.split(/\$\{[^}]*\}/)
    if (isTemplateProse(parts)) {
      add(m.index, parts.join(' ').trim().replace(/\s+/g, ' '), 'template')
    }
  }
}

for (const root of ROOTS) tsxFiles(join(ROOT, root)).forEach(scan)

// ── THE REPORT ──────────────────────────────────────────────────────────────────────
const byFile = new Map()
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, [])
  byFile.get(f.file).push(f)
}
const ranked = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)

// `--list` prints every finding as `file:line  shape  text`, one per line, for piping into
// a work queue. The default report is ranked and truncated, which is right for a gate and
// useless for actually working through the backlog.
if (process.argv.includes('--list')) {
  for (const f of findings) {
    // JSON.stringify, not a chain of replaces. It escapes the backslash, the
    // newline and the tab in one pass, correctly, and the outer quotes come off
    // with a slice — a hand-written chain of `.replace()` calls on those three
    // is the shape that gets one of them wrong.
    const raw = JSON.stringify(f.raw).slice(1, -1)
    console.log(`${f.file}:${f.line}\t${f.shape}\t${f.text}\t${raw}`)
  }
  process.exit(0)
}

console.log()
console.log('  UNKEYED COPY — strings a reader reads that no catalogue holds.')
console.log()
for (const [file, list] of ranked.slice(0, 25)) {
  console.log(`  ${String(list.length).padStart(4)}  ${file}`)
  for (const f of list.slice(0, 3)) {
    console.log(`        ${f.line}: ${f.text.slice(0, 88)}`)
  }
  if (list.length > 3) console.log(`        … and ${list.length - 3} more`)
}
if (ranked.length > 25) {
  const rest = ranked.slice(25)
  const n = rest.reduce((sum, [, list]) => sum + list.length, 0)
  console.log()
  console.log(`  … and ${n} in ${rest.length} further file(s), not listed.`)
}

console.log()
console.log(`  ${findings.length} unkeyed literal(s) in ${byFile.size} file(s). Ceiling ${CEILING}.`)
console.log()

if (findings.length > CEILING) {
  console.log(`  OVER THE CEILING by ${findings.length - CEILING}.`)
  console.log('  A new screen shipped with English literals, or the ceiling was not lowered')
  console.log('  after a batch was keyed. See this file\'s header — the ceiling is a ratchet.')
  console.log()
  process.exit(1)
}

console.log('  Under the ceiling. NOTE: this cannot see a string it does not recognise as')
console.log('  prose, and it says nothing about whether a translation is any good.')
console.log()
