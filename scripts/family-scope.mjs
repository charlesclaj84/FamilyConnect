/**
 * Every service-role query on a family-scoped table either carries a family conjunct or is
 * on a reviewed list.
 *
 *     npm run audit:family-scope
 *
 * Exits 1 on a finding, so it reads as a test. No database and no network — it is a static
 * sweep of `app/` and `lib/`, and it answers one question: has somebody reached a
 * family-scoped table through `createAdminClient()` without a `family_code` filter and
 * without anybody looking at it?
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────────────
 * AGENTS.md §3 is the rule: the service role bypasses RLS, so every query through it must
 * re-apply by hand what a policy would have done. That rule has been broken repeatedly and
 * always the same way — not by somebody disagreeing with it, but by a query written in a file
 * nobody was thinking of as part of the feature:
 *
 *   * `deleteRegion` and `deleteChapter` had `.eq('id', id)` as the ENTIRE predicate, so any
 *     signed-in user could delete another family's regions by id. Both sat behind a
 *     `status: 'future'` route for months, which withholds a PAGE and not an endpoint.
 *   * `revokeRoleByAssignmentId` was the same hole in a different file, found a day later.
 *   * `createCustomRole` took `MAX(sort_order)` across every family in the product.
 *   * `addGroupMember` — found by THIS script on 2026-08-20 — read a chat room by id alone
 *     and gated on `created_by === user.id`, which authorizes the ACTION and says nothing
 *     about which family's room it acts on. A member of two families could add a BRAVO
 *     relative to an ALPHA room with every check in the function satisfied.
 *
 * `npm run audit:people` already does exactly this for writes to one table. The pattern
 * generalises, and the last bullet is the reason to generalise it: a rule in a document is
 * only ever as good as the next person having read the document, whereas a red pipeline is
 * read by everybody.
 *
 * ── WHAT COUNTS AS A FINDING ────────────────────────────────────────────────────────
 * A `.from('<table>')` where all three hold:
 *
 *   1. the receiver is an ADMIN client — a variable assigned `createAdminClient()`, a
 *      parameter typed `AdminClient`, or the inline `createAdminClient().from(...)` form. A
 *      user-client query has RLS underneath it and is not this script's business.
 *   2. the table has a `family_code` column (SCOPED_TABLES below).
 *   3. the chained statement contains no `family_code` anywhere.
 *
 * ── AND WHAT A VERDICT MEANS ───────────────────────────────────────────────────────
 * A query with no family conjunct is not automatically wrong. Three shapes are legitimate and
 * all three appear below:
 *
 *   TRANSITIVE  the filter is an id that came out of a family-scoped read in the same
 *               function, or a parent id already checked with `belongsToFamily`. The scope is
 *               real; it just is not on this line.
 *   SELF        the filter is the caller's OWN person_id / user_id, which is narrower than
 *               the family.
 *   STAFF       `app/actions/staff/**` reads across families BY DESIGN (AGENTS.md's third
 *               product), gated by the staff guard rather than by a family.
 *
 * Anything else is a finding. Like `audit:people`, this checks that a verdict EXISTS and never
 * that it is TRUE — judging the scope stays a person's job, and the list below is where that
 * judgement is written down.
 *
 * ── WHAT IT CANNOT SEE ─────────────────────────────────────────────────────────────
 * A query built by string interpolation or issued through `.rpc()`, and a SECURITY DEFINER
 * function that does its own reading. It also cannot see a table nobody added to
 * SCOPED_TABLES — see the note there, which is the honest weak point.
 *
 * AND IT CANNOT TELL A FILTER FROM A PROJECTION, which is a FALSE NEGATIVE rather than a
 * false positive and so is the more dangerous of the two. The test is whether the string
 * `family_code` appears anywhere in the chained statement, so
 *
 *     .from('family_stripe_accounts').select('family_code').eq('stripe_account_id', acct)
 *
 * passes — the conjunct it found is a COLUMN BEING READ, and the query is scoped by nothing.
 * Measured 2026-08-23 on `familyForAccount` in lib/stripe/connect-events.ts, which is that
 * exact shape and is deliberately unscoped: it is the resolver that answers *which family owns
 * this Stripe account*, so it cannot filter by its own answer — the same position
 * lib/auth/family.ts is in and is exempted for.
 *
 * Narrowing the match to `.eq('family_code'` / `.in('family_code'` was the obvious fix and was
 * NOT taken here: several legitimate call sites carry the conjunct in an insert PAYLOAD rather
 * than in a filter (see the lib/notifications.ts verdict), and tightening the pattern would
 * turn those into findings while this class stayed invisible. Both directions want a real
 * parse. Until then, a read whose only `family_code` is in its projection is on the reviewer.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments } from './strip-code.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SCAN = ['app', 'lib']

/**
 * Every `public` table with a `family_code` column, as of 2026-08-23 — 53 of them.
 *
 * HAND-MAINTAINED, AND THAT IS THE WEAK POINT — stated rather than hidden. A new
 * family-scoped table nobody adds here is invisible to this sweep, which is the same class of
 * gap `audit_global_lookups.sql` has and is answered the same way: derive what you can, name
 * what you cannot. Refresh it with
 *
 *     SELECT table_name FROM information_schema.columns
 *      WHERE table_schema='public' AND column_name='family_code' ORDER BY 1;
 *
 * ── THE WEAK POINT WAS MEASURED ON 2026-08-22, AND IT HAD COST TEN TABLES ──────────
 * That is the whole argument for running the query rather than appending to the list. Between
 * 2026-08-20 and 2026-08-22 the product gained Meeting Minutes (five tables), Officer Notes
 * (two), Bylaws (one) and Distributions (two), and NOT ONE of them was here — so this sweep
 * reported "Clean" about three whole features it could not see. A green run over an
 * incomplete list is exactly the "green suite is not evidence" failure AGENTS.md §7 is about,
 * arriving through a hand-maintained constant instead of through a test.
 *
 * So: after any migration that adds a table with a `family_code`, run the query. Do not add
 * the one table you were thinking about — the reason this list goes stale is that everybody
 * adds their own and nobody checks the others.
 *
 * ── AND IT WENT STALE AGAIN WITHIN ONE DAY, WHICH IS THE PARAGRAPH ABOVE MEASURED ───
 * Refreshed 2026-08-23 while adding the Stripe tables, and the query answered NINE missing
 * rather than the four this commit introduced: Safety Check-Ins (two) and SMS consent (three)
 * had shipped earlier the same day and were not here either. So the sweep was reporting
 * "Clean" about two more whole features on the day the warning above was written about the
 * last three.
 *
 * That is the strongest available argument for running the query rather than appending: the
 * person adding four tables is exactly the person in a position to notice the other five, and
 * they only notice by DIFFING. The command is one line and it is in the block above.
 *
 * `families` is deliberately ABSENT. Its `family_code` IS the primary key rather than a scope,
 * so every read of it filters by id and would report as a finding for doing the one thing that
 * table cannot get wrong.
 */
const SCOPED_TABLES = new Set([
  'announcement_unpins', 'announcements', 'bylaws', 'chapters', 'chat_rooms',
  'distribution_recipients', 'distributions', 'documents', 'donation_beneficiaries',
  'dues_autopay', 'dues_member_plans', 'dues_payments', 'dues_schedules', 'elections',
  'family_invitations', 'family_action_challenges', 'family_roles',
  'family_stripe_accounts', 'fund_allocations', 'fund_contributions',
  'fund_disbursements', 'fund_milestones', 'fund_transfers', 'funds',
  'gathering_occurrences', 'gathering_task_submissions', 'gathering_tasks',
  'gathering_template_steps',
  'gathering_template_uses', 'gathering_templates', 'gatherings', 'meeting_attendees',
  'meeting_sessions', 'meeting_topic_notes', 'meeting_topics', 'meeting_votes',
  'notifications', 'people', 'permission_templates', 'person_relationships',
  'person_notification_prefs', 'person_sms', 'phone_verifications', 'photo_collections', 'photos',
  'platform_billing_accounts', 'platform_payments', 'position_journal_entries',
  'position_journal_notes', 'regions', 'resource_visibility', 'safety_check_in_people',
  'safety_check_ins', 'sms_consent_events', 'user_roles',
])

/**
 * Reviewed queries, keyed `file:table`, with one verdict covering every occurrence of that
 * pair in that file.
 *
 * KEYED ON THE PAIR AND NOT THE LINE, deliberately: a line number is invalidated by the next
 * edit anywhere above it, and an allow-list that goes stale on every commit is one people
 * start regenerating without reading. The cost is real and is the thing to keep in mind — a
 * SECOND query on the same table in the same file inherits the first one's verdict, so a
 * verdict has to be written about the file's use of that table rather than about one call.
 */
const REVIEWED = {
  'app/actions/admin/permissions.ts:people':
    "TRANSITIVE — `.in('permission_template_id', ids)` where `ids` are the family's own "
    + 'templates, read family-scoped a few lines above. A template id from another family '
    + 'cannot be in that list.',

  'app/actions/chat.ts:chat_rooms':
    'TRANSITIVE — each filters on a room id that arrived from a family-scoped read, from '
    + "`chat_participants` rows keyed on the caller's own user id, or (since 2026-08-20) from "
    + 'a read that now carries the conjunct itself. The two that did NOT — addGroupMember and '
    + 'removeGroupMember — are why this script exists.',
  'app/actions/chat.ts:notifications':
    "SELF — `.eq('recipient_id', person.id)` where `person` is the caller's own row, which is "
    + 'narrower than the family.',

  'lib/stripe/fee-settlement.ts:fund_contributions':
    'STAMPED — this is the INSERT of the fee contra-entries, and every row in it carries '
    + '`family_code: input.familyCode`. The sweep cannot see it because the rows are built in '
    + 'a `rows` variable a few lines above rather than inline in the chained statement, which '
    + "is the script's own stated blind spot about a query it cannot read end to end. The "
    + 'family comes from `settleChargeFee`, which resolved it from the `acct_…` on the event '
    + 'through the UNIQUE `family_stripe_accounts.stripe_account_id` — the only scoping key a '
    + 'webhook has, since there is no session and no caller. The SELECT immediately above it '
    + "does carry `.eq('family_code', …)`, so the fund ids being written to came out of a "
    + 'family-scoped read as well.',

  'lib/auth/locale.ts:people':
    "SELF — `.eq('user_id', userId)`, the caller's own rows, which is narrower than a family. "
    + 'Identical shape and identical reasoning to lib/auth/zone.ts:people below: the column '
    + 'read is `locale`, which `people_sync_shared_profile` propagates across every family a '
    + 'user belongs to (20260826000002), so every one of the caller\'s own rows holds the same '
    + 'answer and there is nothing for a family conjunct to disambiguate.',

  'lib/auth/zone.ts:people':
    "SELF — `.eq('user_id', userId)`, the caller's own rows, which is narrower than a family. "
    + 'The column read is `time_zone`, one of the columns `people_sync_shared_profile` '
    + 'propagates across every family a user belongs to, so every one of the caller\'s own '
    + 'rows holds the same answer and there is nothing for a family conjunct to '
    + 'disambiguate. It is on the admin client rather than the user one because this resolver '
    + 'is called from layouts that have not resolved a family yet — the same reason '
    + 'lib/auth/family.ts is exempt as a whole file.',

  'app/actions/dues.ts:dues_payments':
    'TRANSITIVE — payment ids from family-scoped reads in the same function: the routing pass '
    + 'reads the payments it is routing, and `reverses_id` is matched against a payment already '
    + 'resolved inside the family.',
  'lib/dues-routing.ts:dues_payments':
    'TRANSITIVE — the `routed_at` stamp, on a payment row the caller already holds. Both '
    + 'occurrences are `.eq(\'id\', payment.id)` where `payment` came out of the insert or read '
    + 'that produced it, inside the family. This verdict MOVED here from '
    + 'app/actions/dues.ts:dues_payments on 2026-08-23 when the waterfall was extracted so the '
    + 'Stripe webhook could share it — the code did not change, and a verdict has to move with '
    + 'the lines it is about or the sweep reports a new finding for a line nobody wrote.',

  'app/actions/family-tree.ts:people':
    "TRANSITIVE — `.eq('id', o.anchorPersonId)` reading `gender` to choose an inverse "
    + 'relationship label, where the anchor was verified with `belongsToFamily` before the call '
    + 'that produced it.',

  'app/actions/link-person.ts:people':
    'TRANSITIVE — the stub-linking flow resolves ONE `people` row by invitation token first '
    + '(family-scoped) and then works from `stub.id`. The row is established before any of '
    + 'these run.',
  'app/actions/link-person.ts:person_relationships':
    'TRANSITIVE — every filter is a person id from the resolved stub or its parents, all of '
    + 'which came out of the token-scoped read above.',

  'app/actions/staff/accounts.ts:people':
    'STAFF — the GENORRA console reads across families by design (AGENTS.md, "Three words that '
    + 'name three different products"), gated by the staff guard rather than by a family.',
  'lib/gathering-when-write.ts:gathering_occurrences':
    'SCOPED IN THE PAYLOAD, NOT IN A FILTER — the same shape as `lib/notifications.ts` below, '
    + 'and it is the INSERT rather than the DELETE beside it (which does carry the conjunct). '
    + 'Every row `writeOccurrences` inserts is built with `family_code: familyCode` from the '
    + 'caller’s own guard, and the rows are assembled above the `.from()` call, so the conjunct '
    + 'is behind the window the sweep reads. `gathering_occurrences_guard_family` refuses a '
    + 'cross-family `gathering_id` underneath it in any case (§4), which the trigger tests '
    + 'against the parent rather than against the argument. '
    + 'FOUND 2026-08-26, and only because the sweep started stripping comments: the window ran '
    + 'forward into `readOccurrences`’ own header, whose §3 sentence contains the words '
    + '`family_code`. A doc comment for the NEXT function was excusing this query.',

  'lib/notifications.ts:notifications':
    'SCOPED IN THE PAYLOAD, NOT IN A FILTER — and it is the one shape this script structurally '
    + 'cannot see. Every row `notifyAllMembers` inserts carries `family_code: opts.familyCode` '
    + 'explicitly, but the rows are BUILT above the `.from()` call, so the conjunct is outside '
    + 'the window the sweep reads. Widening the window backwards was the alternative and was '
    + 'rejected: it would pick up an unrelated conjunct from whatever happened to precede the '
    + 'query and turn a real finding into a silent pass, which is the failure mode this whole '
    + 'script is aimed at. A verdict is the honest answer.',
}

/** Whole files whose every query is exempt, with the reason. */
const REVIEWED_FILES = {
  'lib/auth/family.ts':
    'THE RESOLVER ITSELF. This module answers "which family is the caller in?", so it cannot '
    + 'filter by the answer it is computing. It is scoped by `user_id` throughout, which is '
    + "narrower, and `belongsToFamily` here is the function every other file's §4 check calls.",
  'lib/auth/permissions.ts':
    'THE PERMISSION RESOLVER. Same shape as lib/auth/family.ts — scoped by the caller\'s own '
    + 'user id and person id while resolving which family they are in and what they may do. '
    + 'Its header states that it mirrors `auth_permission()` in SQL exactly.',
}

// ── the sweep ───────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.ts$/.test(entry)) out.push(full)
  }
  return out
}

const findings = []
const used = new Set()
let scanned = 0
let queries = 0

for (const root of SCAN) {
  for (const file of walk(join(ROOT, root))) {
    const rel = relative(ROOT, file).split(sep).join('/')
    // ── COMMENTS BLANKED, STRING CONTENTS KEPT — AND THIS IS NOT COSMETIC ────────────
    // The statement window below runs from one `.from(` to the NEXT one, so every comment
    // between two queries is inside the FIRST query's window. A doc comment that merely MENTIONS
    // `family_code` therefore silences a real finding on the query above it.
    //
    // Measured 2026-08-26: `localesOfPeople` was added to `lib/auth/locale.ts` with a header
    // explaining its own `.eq('family_code', …)`, and `resolveLocale` — which is genuinely
    // unscoped, deliberately, and carries a SELF verdict — stopped reporting. The verdict was
    // then flagged as stale, which is the only reason anybody noticed. Without the ratchet on
    // unused verdicts this would have been a silent hole: a `family_code` in prose is worth
    // nothing at runtime, and every §3 explanation in this codebase contains one.
    //
    // String contents are KEPT because they are what the sweep matches — `.from('people')` and
    // `.eq('family_code', …)` are both string literals. `scripts/strip-code.mjs` carries the
    // argument for one stripper with a flag rather than two scanners; `audit:time` takes the
    // other setting for the opposite reason.
    const src = stripComments(readFileSync(file, 'utf8'))
    scanned += 1

    if (rel in REVIEWED_FILES) { used.add(rel); continue }

    const admins = new Set(['createAdminClient()'])
    for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*(?:await\s+)?createAdminClient\(\)/g)) {
      admins.add(m[1])
    }
    for (const m of src.matchAll(/(\w+)\s*:\s*AdminClient/g)) admins.add(m[1])

    for (const m of src.matchAll(/([\w.()]+)\s*\n?\s*\.from\('([a-z_]+)'\)/g)) {
      const receiver = m[1].replace(/^await\s+/, '')
      const table = m[2]
      if (!SCOPED_TABLES.has(table)) continue
      if (!admins.has(receiver)) continue
      queries += 1

      // The chained statement: from this `.from(` to the NEXT one, capped so a long function
      // body cannot swallow an unrelated conjunct and report a false pass.
      const fromAt = m.index + m[0].length
      const next = src.indexOf(".from('", fromAt)
      const end = next === -1 ? Math.min(src.length, fromAt + 2000) : Math.min(next, fromAt + 2000)
      if (/family_code/.test(src.slice(m.index, end))) continue

      const key = `${rel}:${table}`
      if (key in REVIEWED) { used.add(key); continue }
      findings.push({ key, line: src.slice(0, m.index).split('\n').length, table, rel })
    }
  }
}

// The mirror failure: a verdict for a query that is now scoped, or for a file that is gone.
// Left alone it would quietly excuse a future finding on the same pair.
const stale = [
  ...Object.keys(REVIEWED).filter(k => !used.has(k)),
  ...Object.keys(REVIEWED_FILES).filter(k => !used.has(k)),
]

console.log(`\n  scanned  ${scanned} file(s) in ${SCAN.join(', ')} · ${queries} admin-client query/queries on a family-scoped table`)
console.log(`  reviewed ${Object.keys(REVIEWED).length} file/table pair(s) and ${Object.keys(REVIEWED_FILES).length} whole file(s), by explicit verdict:\n`)
for (const [key, why] of Object.entries(REVIEWED)) console.log(`  note     ${key}\n           ${why}\n`)
for (const [key, why] of Object.entries(REVIEWED_FILES)) console.log(`  note     ${key} (whole file)\n           ${why}\n`)

if (findings.length === 0 && stale.length === 0) {
  console.log('  Clean. NOTE: this checks that a verdict EXISTS, never that it is true.\n')
  process.exit(0)
}

console.log(`  ${findings.length + stale.length} finding(s):\n`)
for (const f of findings) {
  console.log(`  ── ${f.rel}:${f.line}: admin-client query on \`${f.table}\` with no family_code conjunct`)
  console.log(`       add .eq('family_code', …), or add '${f.key}' to REVIEWED with a verdict\n`)
}
for (const key of stale) {
  console.log(`  ── ${key}: reviewed here but no longer reports — remove the stale verdict\n`)
}
process.exit(1)
