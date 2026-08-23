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
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SCAN = ['app', 'lib']

/**
 * Every `public` table with a `family_code` column, as of 2026-08-22.
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
 * `families` is deliberately ABSENT. Its `family_code` IS the primary key rather than a scope,
 * so every read of it filters by id and would report as a finding for doing the one thing that
 * table cannot get wrong.
 */
const SCOPED_TABLES = new Set([
  'announcement_unpins', 'announcements', 'bylaws', 'chapters', 'chat_rooms',
  'distribution_recipients', 'distributions', 'documents', 'donation_beneficiaries',
  'dues_member_plans', 'dues_payments', 'dues_schedules', 'elections',
  'family_invitations', 'family_removal_challenges', 'family_roles', 'fund_allocations',
  'fund_contributions', 'fund_disbursements', 'fund_milestones', 'fund_transfers',
  'funds', 'gathering_task_submissions', 'gathering_tasks', 'gathering_template_steps',
  'gathering_template_uses', 'gathering_templates', 'gatherings', 'meeting_attendees',
  'meeting_sessions', 'meeting_topic_notes', 'meeting_topics', 'meeting_votes',
  'notifications', 'people', 'permission_templates', 'person_relationships',
  'photo_collections', 'photos', 'position_journal_entries', 'position_journal_notes',
  'regions', 'resource_visibility', 'user_roles',
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

  'app/actions/dues.ts:dues_payments':
    'TRANSITIVE — payment ids from family-scoped reads in the same function: the routing pass '
    + 'reads the payments it is routing, and `reverses_id` is matched against a payment already '
    + 'resolved inside the family.',

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
    const src = readFileSync(file, 'utf8')
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
