/**
 * Every exported server action has an RLS case, or a stated verdict saying why not.
 *
 *     npm run audit:rls-cases
 *
 * WHY THIS EXISTS
 *   AGENTS.md §7 says "adding an action means adding a case", and nothing enforced it. The
 *   cost is invisible by construction: an action with no case does not fail, does not warn,
 *   and reads exactly like one that is covered — so the gap is only ever found by somebody
 *   deciding to go and count, which had happened once, by hand, and produced the wrong
 *   number (FutureFeature.md carried "167 server actions have no RLS case"; the real figure
 *   was 57, because the hand count matched `fn:` and missed the `read(id, mod, fn)` helper
 *   form that most of the suite is written in).
 *
 *   This is the same shape as `npm run audit:people` and `npm run audit:family-scope`, and it
 *   makes the same promise and no more: **it checks that a verdict EXISTS, never that it is
 *   true.** The judgement stays a person's; what this removes is the possibility of a new
 *   action arriving with nobody having made one.
 *
 * WHAT IT ASSERTS
 *   1. every exported action is either named by a case in `tests/rls/cases.mjs` or carries a
 *      verdict in `NO_CASE_YET` below;
 *   2. every case names a module and a function that still exist — a renamed action otherwise
 *      leaves a case pointing at nothing, and `run.mjs` would report that as a harness error
 *      buried in 845 lines of output;
 *   3. no stale verdict, in both directions: a verdict for an action that now HAS a case, and
 *      a verdict for an action that no longer exists. `audit_global_lookups.sql`'s lesson —
 *      a one-way assertion cannot see the half where the list itself went out of date;
 *   4. the backlog does not GROW. `BACKLOG_CEILING` is a ratchet; see the note above it.
 *
 * WHAT IT CANNOT ASSERT, said first so a green run is never read as more than it is:
 *   * THAT A CASE IS ANY GOOD. A case whose positive control is vacuous, or whose attack
 *     passes because the action answers `[]` to everybody, counts here exactly as much as a
 *     mutation-checked one. AGENTS.md §7's "a green suite is not evidence until you have seen
 *     it fail" is addressed to a person and still is.
 *   * THAT AN ACTION IS THE RIGHT SUBJECT. Some of what a case would test cannot be reached
 *     through the action at all — a write narrowed by hand, a child table read through its
 *     parent — and those belong in `tests/rls/raw/`. A `raw/` probe registered against
 *     `mod: 'tests/rls/raw/*.mjs'` does NOT count as coverage of the action it stands in for,
 *     deliberately: the two answer different questions and conflating them would let a raw
 *     probe retire an action's case.
 *   * ANYTHING ABOUT `lib/`. A plain module has no URL and is not the subject of this rule.
 *
 * ── HOW IT READS THE SUITE ──────────────────────────────────────────────────────────────
 * By TEXT, not by import, and that is deliberate rather than lazy. `cases.mjs` imports
 * `seed.mjs`, which reads the local stack's keys — so importing it would make this check
 * need a running database, and it belongs with `db:check`, `help:check` and
 * `marketing:check` at the cheap end of `verify.yml` where nothing is running yet.
 *
 * Comments are stripped from both sides first. `cases.mjs` quotes module paths in its prose
 * constantly (every mutation note names the file it mutated), and an action module's own
 * header often names its neighbours; counting either as a case would be coverage invented out
 * of a paragraph.
 *
 * ── CHECKED BY MUTATION, per AGENTS.md §7 ───────────────────────────────────────────────
 * Four, each tripping its own check and only its own (2026-08-22):
 *
 *   1. `getBylaws` renamed in `cases.mjs` only    -> unknown case targets AND uncovered
 *                                                    actions. BOTH, which is the right answer
 *                                                    and worth stating: a renamed action is a
 *                                                    dead case and an untested function, and
 *                                                    it is reported as two findings because it
 *                                                    is two problems. Reported ONCE rather
 *                                                    than three times, which is what the
 *                                                    dedupe in the loop below is for — most
 *                                                    actions carry several cases.
 *   2. a `NO_CASE_YET` entry for `documents.getDocuments`,
 *      which has a case                           -> stale verdicts
 *   3. a `NO_CASE_YET` entry for `documents.noSuchAction`
 *                                                 -> stale verdicts, by name
 *   4. `BACKLOG_CEILING` lowered by one           -> backlog ceiling
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

const ACTIONS_DIR = join('app', 'actions')
const CASES_FILE = 'tests/rls/cases.mjs'

// ---------------------------------------------------------------- the verdicts

/**
 * Three verdicts, and there are three on purpose.
 *
 * The temptation with a list this long is a bespoke sentence per entry, and it is the wrong
 * shape here: 57 hand-written excuses is 57 things to read once and never again, and the
 * `createDuesSchedule` lesson in `cases.mjs`'s UNCOVERED note is what a narrative exemption
 * costs — it expired silently the day a migration gave that table two foreign ids, because a
 * reason is not diffable and a name is.
 *
 * So the verdict says which KIND of gap it is, the entry says WHICH action, and both are one
 * line in a diff.
 */
const VERDICTS = {
  BACKLOG:
    'Owed a case and nobody has written one. Not an exemption — the honest state, listed by '
    + 'name so it cannot grow silently.',
  'RIGHTS-ONLY':
    'The whole return value is booleans about the CALLER\'s own grants, so no family row is '
    + 'in it and the marker scan would pass over an action that returned anything. A case is '
    + 'still possible and worth having — `bylaws.getBylawRights` is the worked example — but '
    + 'it asserts grant resolution rather than family isolation, which is a different claim.',
  STAFF:
    'app/actions/staff/** reads across families by design, so the shape every other case in '
    + 'the suite asserts is inverted here. What is worth asserting is that a NON-STAFF caller '
    + 'is refused; `cases.mjs`\'s UNCOVERED note records that gap and what closing it costs.',
  'STRIPE-INERT':
    'The action resolves a Stripe credential BEFORE it issues any query, and this harness has '
    + 'no STRIPE_SECRET_KEY — so it returns a refusal without touching the database. An '
    + 'action-shaped case would therefore be evidence about the credential check and nothing '
    + 'else: every family conjunct underneath could be deleted with the suite staying green, '
    + 'which is AGENTS.md §7\'s "A GUARD HIDES A POLICY EXACTLY AS A HAND-WRITTEN FILTER DOES" '
    + 'exactly. NOT an exemption in principle — the two actions in these modules that read '
    + 'BEFORE checking a credential (billing.getPlatformBilling, '
    + 'processing.getProcessorStatus) DO have mutation-checked cases, and they are the ones '
    + 'where an assertion means something. Setting a test key in the harness would make the '
    + 'rest reachable and is the way to close this; the cost is a suite that talks to Stripe.',
}

/**
 * Every exported action with no case, and which kind of gap it is.
 *
 * ── HOW TO USE THIS LIST ────────────────────────────────────────────────────────────────
 * Write the case, delete the line. That is the whole intended direction of travel, and
 * `BACKLOG_CEILING` below is what keeps it pointing that way.
 *
 * A NEW ACTION DOES NOT BELONG HERE. It belongs in `cases.mjs` — that is AGENTS.md §7, and
 * the ceiling is set so that adding a line here for a new action fails the build rather than
 * quietly enlarging the debt somebody else will inherit.
 */
const NO_CASE_YET = {
  'app/actions/admin/chapters.ts': { createBoardPosition: 'BACKLOG' },
  'app/actions/admin/family.ts': { setFamilyTier: 'BACKLOG' },
  'app/actions/admin/permissions.ts': { renameTemplate: 'BACKLOG', deleteTemplate: 'BACKLOG' },
  'app/actions/admin/users.ts': { getMyRoles: 'BACKLOG' },
  'app/actions/announcements.ts': {
    createAnnouncement: 'BACKLOG', deleteAnnouncement: 'BACKLOG',
    togglePinAnnouncement: 'BACKLOG',
  },
  // THE LARGEST SINGLE GAP IN THE PRODUCT, and worth naming as one rather than leaving as
  // eight lines. Chat is the only feature here whose SELECT policy calls
  // `auth_uid_is_room_participant()` — a SECURITY DEFINER function with no other call site,
  // load-bearing for the realtime subscription as well as for the query — and not one of
  // these eight exercises it. `20260822000011` found that hosted was carrying a `chat_messages`
  // INSERT policy MISSING that conjunct, which is a cross-family write path into another
  // family's conversation that no test in this repo could have seen.
  'app/actions/chat.ts': {
    getOrCreateFamilyRoom: 'BACKLOG', getOrCreateDmRoom: 'BACKLOG', deleteDm: 'BACKLOG',
    createGroupRoom: 'BACKLOG', getRoomList: 'BACKLOG', getSenderMap: 'BACKLOG',
    markRoomRead: 'BACKLOG', sendMessage: 'BACKLOG',
  },
  'app/actions/distributions.ts': { getDistributionRights: 'RIGHTS-ONLY' },
  'app/actions/documents.ts': { deleteDocument: 'BACKLOG' },
  'app/actions/dues.ts': {
    recordPayment: 'BACKLOG', reversePayment: 'BACKLOG', getFamilyPnL: 'BACKLOG',
  },
  'app/actions/elections.ts': { createElection: 'BACKLOG', unpublishElection: 'BACKLOG' },
  'app/actions/family-tree.ts': { getFamilyTreeSummary: 'BACKLOG' },
  'app/actions/family.ts': { switchActiveFamily: 'BACKLOG', setDefaultFamily: 'BACKLOG' },
  'app/actions/funds.ts': {
    createFund: 'BACKLOG', updateFund: 'BACKLOG', createMilestone: 'BACKLOG',
    updateMilestone: 'BACKLOG', recordDisbursement: 'BACKLOG',
    saveFundAllocations: 'BACKLOG', recordFundContribution: 'BACKLOG',
  },
  'app/actions/gallery.ts': {
    getGalleryRights: 'RIGHTS-ONLY', createCollection: 'BACKLOG',
    updatePhotoCaption: 'BACKLOG', deleteCollection: 'BACKLOG',
  },
  // TEN OF THE SEVENTEEN, on a feature that shipped on 2026-08-22 with five guard triggers and
  // a `meeting_votes_are_final` trigger that refuses UPDATE for every role including
  // `service_role`. None of that is exercised from here; `20260822000019`'s own verify block
  // is the only thing that has ever probed it, which is a point-in-time assertion.
  'app/actions/meetings.ts': {
    mayScheduleMeeting: 'RIGHTS-ONLY', updateMeeting: 'BACKLOG', setMeetingClosed: 'BACKLOG',
    deleteMeeting: 'BACKLOG', addMeetingTopic: 'BACKLOG', updateMeetingTopic: 'BACKLOG',
    deleteMeetingTopic: 'BACKLOG', updateMeetingNote: 'BACKLOG', deleteMeetingNote: 'BACKLOG',
    setTopicVoting: 'BACKLOG',
  },
  'app/actions/membership.ts': { resendConfirmationEmail: 'BACKLOG' },
  'app/actions/my-families.ts': { validateFamilyCode: 'BACKLOG' },
  'app/actions/personal-info.ts': { upsertPersonalInfo: 'BACKLOG' },
  'app/actions/register.ts': { registerUser: 'BACKLOG' },
  // ── THE STRIPE ACTIONS, 2026-08-23 ──────────────────────────────────────────────────────
  // Thirteen of the fifteen actions across these three modules. Every one refuses on a missing
  // credential before it queries anything; the two that do not — `getPlatformBilling` and
  // `getProcessorStatus` — have cases in `cases.mjs` and are deliberately absent from this list.
  // See the `STRIPE-INERT` verdict above for why a case for the rest would be worse than none.
  'app/actions/admin/processing.ts': {
    startProcessorOnboarding: 'STRIPE-INERT', refreshProcessorStatus: 'STRIPE-INERT',
    disconnectProcessor: 'STRIPE-INERT',
    // `getFullStripeBill` resolves `stripeClient()` before it reads anything, so with no key
    // in the harness it returns a messageKey and never touches the database. Note that the
    // account id it works with is read off the CALLER'S OWN family through the guard rather
    // than taken as an argument, so there is no id here for a case to point at another
    // family — the shape a case would assert does not exist.
    getFullStripeBill: 'STRIPE-INERT',
  },
  'app/actions/billing.ts': {
    startPlanCheckout: 'STRIPE-INERT', changePlanTier: 'STRIPE-INERT',
    cancelPlanRenewal: 'STRIPE-INERT', openBillingPortal: 'STRIPE-INERT',
  },
  'app/actions/pay-dues.ts': {
    getDuesOnlineStatus: 'STRIPE-INERT', startDuesCheckout: 'STRIPE-INERT',
    startDuesAutopay: 'STRIPE-INERT', cancelDuesAutopay: 'STRIPE-INERT',
    startDonationCheckout: 'STRIPE-INERT',
  },
  'app/actions/staff/accounts.ts': {
    listStaffAccounts: 'STAFF', lookupStaffAccount: 'STAFF', getStaffMembershipCount: 'STAFF',
  },
  'app/actions/staff/families.ts': {
    listStaffFamilies: 'STAFF', getStaffFamilyCounts: 'STAFF', restoreFamily: 'STAFF',
  },
}

/**
 * A RATCHET. It may be LOWERED freely — that is what writing a case looks like from here —
 * and raising it is a deliberate act that needs a sentence beside it in the commit.
 *
 * Without it this file is an inventory rather than a gate: a new action could be added to
 * `NO_CASE_YET` in the same commit that introduces it, which is the exact behaviour AGENTS.md
 * §7 forbids, performed with the audit's blessing. With it, the only way a new action ships is
 * with a case, or with somebody explicitly deciding in public that the debt should grow.
 *
 * ── RAISED FROM 57 TO 68 ON 2026-08-23, AND HERE IS THE SENTENCE IT ASKS FOR ────────────
 * Eleven `STRIPE-INERT` entries: the Stripe actions across `billing.ts`, `admin/processing.ts`
 * and `pay-dues.ts` that refuse on a missing credential before they query anything. A case for
 * one of those would assert the credential check and pass with every family conjunct deleted,
 * which is worse than no case because it LOOKS like coverage — so the verdict is the honest
 * answer and the ceiling has to move to admit it.
 *
 * IT IS NOT A FREE PASS FOR THE FEATURE. The two actions in those modules that read before
 * checking anything — `getPlatformBilling` and `getProcessorStatus` — got real,
 * mutation-checked cases in the same commit, and they are the ones where a cross-family
 * assertion is evidence.
 *
 * ── RAISED FROM 68 TO 69 ON 2026-08-26, AND HERE IS ITS SENTENCE ───────────────────────
 * One entry: `pay-dues.startDonationCheckout`, which is how a member gives to a drive by card.
 * It is the twelfth `STRIPE-INERT` action and inert for exactly the same reason as the four
 * beside it — `stripeUnavailableReason()` and `readyAccount()` both answer before it reads a
 * drive, so with no key in the harness it refuses without touching the database. A case would
 * assert the credential check and stay green with `getDonationProgress`'s family conjunct
 * deleted, which is worse than no case because it LOOKS like coverage.
 *
 * ── RAISED FROM 69 TO 70 ON 2026-09-03, AND HERE IS ITS SENTENCE ───────────────────────
 * One entry: `admin/processing.getFullStripeBill`, which totals the family's own Stripe fees
 * from Stripe on demand. The thirteenth `STRIPE-INERT` action, and inert first: `stripeClient()`
 * answers before it reads a row, so with no key in the harness it returns a message key and
 * never touches the database.
 *
 * IT IS ALSO THE ONE ENTRY WHERE THE SHAPE A CASE WOULD ASSERT DOES NOT EXIST. Every other
 * verdict here is "unreachable without a key"; this one is additionally parameterless — the
 * account id it works with is read off the CALLER'S OWN family through the guard, so there is
 * no id for an attacker to pass and no cross-family reference to check (§4's rule satisfied by
 * having nothing to validate, the way `open_default_family` satisfies §2b's).
 *
 * HOW TO LOWER IT BY TWELVE: give the harness a Stripe TEST key and a stub or sandbox to talk
 * to. The actions become reachable, their family conjuncts become assertable, and every one of
 * these verdicts turns into a case. That is a real piece of work — a suite that makes network
 * calls is a slower and flakier suite — and TODO.md carries it rather than this comment
 * pretending it is a five-minute job.
 */
const BACKLOG_CEILING = 70

// ---------------------------------------------------------------- reading both sides

const strip = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const posix = p => p.split(sep).join('/')

function walk(dir, out = []) {
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, entry)
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (entry.endsWith('.ts')) out.push(posix(rel))
  }
  return out
}

/**
 * The exported actions, per module.
 *
 * `export async function` ONLY, and that is checked rather than assumed: every action in the
 * tree is written that way today, and a `export const x = async () => {}` would be invisible
 * here. The assertion below is what says so if that ever stops being true — a form this
 * cannot see is a hole in the audit rather than an action that happens to be exempt.
 */
function exportsOf(file) {
  const src = strip(readFileSync(join(ROOT, file), 'utf8'))
  const named = [...src.matchAll(/^export async function ([A-Za-z0-9_]+)/gm)].map(m => m[1])
  const unseen = [...src.matchAll(/^export (?:const|let) ([A-Za-z0-9_]+)\s*[:=][^=]*=>/gm)]
    .map(m => m[1])
  return { named, unseen }
}

/**
 * Every (module, function) pair a case names.
 *
 * TWO FORMS, because the suite has two: the `read(id, mod, fn)` helper, where the module path
 * is followed by the function as the next string literal, and the object literal, where it is
 * followed by `fn: '…'`. One pattern covers both because the module path is IMMEDIATELY
 * followed by the function name in each — which is a property of the file rather than a law,
 * and check 2 below is what notices if a third form appears and this stops seeing it.
 */
function casesIn(file) {
  const src = strip(readFileSync(join(ROOT, file), 'utf8'))
  const re = /'(app\/actions\/[A-Za-z0-9_/-]+\.ts)'\s*,\s*(?:fn:\s*)?'([A-Za-z0-9_]+)'/g
  return [...src.matchAll(re)].map(m => ({ mod: m[1], fn: m[2] }))
}

// ---------------------------------------------------------------- findings

const findings = []
const fail = (check, message) => findings.push({ check, message })

const modules = walk(ACTIONS_DIR).sort()
const exported = new Map()
for (const mod of modules) {
  const { named, unseen } = exportsOf(mod)
  exported.set(mod, named)
  for (const name of unseen) {
    fail(
      'unreadable export form',
      `${mod} exports ${name} as an arrow function. This audit only sees `
        + `\`export async function\`, so that action is invisible to it — rewrite it as a `
        + `function declaration, or teach exportsOf() the form. An action this cannot see is `
        + `a hole in the audit, not an exemption.`,
    )
  }
}

const covered = new Set()
for (const { mod, fn } of casesIn(CASES_FILE)) {
  // DEDUPED, because most actions carry several cases — a cross-family one, a pending one, a
  // §4 one — and a renamed action would otherwise report the same finding once per case.
  if (covered.has(`${mod}::${fn}`)) continue
  covered.add(`${mod}::${fn}`)
  // 2 — the case names something that still exists
  if (!exported.has(mod)) {
    fail('unknown case targets',
      `${CASES_FILE} has a case on ${mod}, which is not a module under ${posix(ACTIONS_DIR)}/.`)
  } else if (!exported.get(mod).includes(fn)) {
    fail('unknown case targets',
      `${CASES_FILE} has a case on ${mod} :: ${fn}, which that module does not export. A `
        + `renamed action leaves a dead case, and run.mjs reports that as a harness error `
        + `buried in hundreds of lines.`)
  }
}

// 1 — every action is covered or has a verdict
const backlog = []
for (const mod of modules) {
  for (const fn of exported.get(mod)) {
    if (covered.has(`${mod}::${fn}`)) continue
    const verdict = NO_CASE_YET[mod]?.[fn]
    if (!verdict) {
      fail('uncovered actions',
        `${mod} :: ${fn} has no case in ${CASES_FILE} and no verdict in this file. A server `
          + `action is a public HTTP endpoint (AGENTS.md §2); add a case, or add a verdict `
          + `saying which kind of gap this is.`)
      continue
    }
    if (!VERDICTS[verdict]) {
      fail('unknown verdict',
        `${mod} :: ${fn} carries the verdict '${verdict}', which is not one of `
          + `${Object.keys(VERDICTS).join(', ')}.`)
      continue
    }
    backlog.push({ mod, fn, verdict })
  }
}

// 3 — no stale verdict, in both directions
for (const [mod, entries] of Object.entries(NO_CASE_YET)) {
  for (const fn of Object.keys(entries)) {
    if (covered.has(`${mod}::${fn}`)) {
      fail('stale verdicts',
        `${mod} :: ${fn} has a verdict AND a case. Delete the verdict — an excuse standing `
          + `beside the thing it excused is how the list stops being read.`)
    } else if (!exported.get(mod)?.includes(fn)) {
      fail('stale verdicts',
        `${mod} :: ${fn} has a verdict and ${exported.has(mod) ? 'that module no longer '
          + 'exports it' : 'that module no longer exists'}. Delete it: a verdict for an action `
          + `nobody can call excuses nothing and reads as inventory.`)
    }
  }
}

// 4 — the ratchet
if (backlog.length > BACKLOG_CEILING) {
  fail('backlog ceiling',
    `${backlog.length} actions have no case; BACKLOG_CEILING is ${BACKLOG_CEILING}. A new `
      + `action belongs in ${CASES_FILE}, not in NO_CASE_YET. If the debt genuinely has to `
      + `grow, raise the ceiling in the same commit and say why.`)
}

// ---------------------------------------------------------------- report

const total = [...exported.values()].reduce((n, fns) => n + fns.length, 0)
const byVerdict = v => backlog.filter(b => b.verdict === v).length
console.log(
  `Walked ${total} exported actions across ${modules.length} modules; `
    + `${total - backlog.length} named by a case, ${backlog.length} with a stated verdict `
    + `(ceiling ${BACKLOG_CEILING}).`,
)

// PRINTED, not merely counted, exactly as `help:check` and `marketing:check` print theirs. A
// backlog that scrolls past as a number is a backlog nobody reads, and this list is the whole
// of what the check declines to judge.
for (const verdict of Object.keys(VERDICTS)) {
  const rows = backlog.filter(b => b.verdict === verdict)
  if (!rows.length) continue
  console.log(`\n  ${verdict}  (${rows.length})  ${VERDICTS[verdict].replace(/\s+/g, ' ')}`)
  const byMod = new Map()
  for (const r of rows) {
    if (!byMod.has(r.mod)) byMod.set(r.mod, [])
    byMod.get(r.mod).push(r.fn)
  }
  for (const [mod, fns] of [...byMod].sort()) {
    console.log(`    ${mod.replace('app/actions/', '').padEnd(28)} ${fns.sort().join(', ')}`)
  }
}

if (findings.length === 0) {
  console.log(
    `\nEvery server action is tested or accounted for. `
      + `${byVerdict('BACKLOG')} still owe a case.`,
  )
  process.exit(0)
}

console.error(`\n${findings.length} finding${findings.length === 1 ? '' : 's'}:\n`)
for (const f of findings) console.error(`  [${f.check}] ${f.message}`)
process.exit(1)
