/**
 * Every service-role write to `public.people` is on a reviewed list.
 *
 *     npm run audit:people
 *
 * Exits 1 on a finding, so it reads as a test. No database, no network — it is a static
 * sweep of `app/` and it answers one question: has somebody added a write to `people`
 * through the admin client without anybody looking at it?
 *
 * ── WHY THIS EXISTS, AND WHY IT IS A SCRIPT AND NOT A SENTENCE ──────────────────────
 * Phase 3's third leftover. `people_guard_membership_status` and
 * `people_guard_permission_template` both test `current_user = 'authenticated'` — a
 * boundary around the ROLE THE BROWSER SPEAKS AS, not around the column. That is
 * deliberate: `link-person.ts` needs to carry a membership across rows, and
 * `tests/rls/seed.mjs` needs to state the statuses explicitly (the stamp trigger overrides
 * insert values, so without those UPDATEs the whole suite would go green testing nothing).
 * Postgres offers nothing better inside a trigger — a SECURITY DEFINER trigger sees its own
 * owner as `current_user` for every caller alike, which is why `20260806000011` chose
 * INVOKER and asserts `NOT prosecdef`.
 *
 * So the service role can move those columns, and TODO.md's answer was a rule: "any new
 * service-role write to `people` owes the same look `updateUserProfile` just got". A rule
 * like that is only ever as good as the next person having read AGENTS.md, which is the
 * failure mode this repo documents everywhere else. This turns it into a gate: a new write
 * fails CI until somebody adds it below with a verdict against the three questions.
 *
 * ── THE THREE QUESTIONS, which are `updateUserProfile`'s own ────────────────────────
 * The service role bypasses RLS entirely, so a write through it must re-apply by hand
 * everything a policy would have done (AGENTS.md §3):
 *
 *   1. FAMILY-SCOPED?   `.eq('family_code', familyCode)` beside `.eq('id', …)`. Without
 *                       it, a user manager in one family rewrites a member of another by
 *                       passing their id.
 *   2. COLUMNS ALLOW-LISTED?  `pickProfileColumns(data)`. A `Partial<T>` annotation is
 *                       erased at runtime and the action is a public HTTP endpoint, so
 *                       unfiltered it could set `user_id`, `family_code` or
 *                       `membership_status`.
 *   3. REFERENCED IDS VERIFIED?  `belongsToFamily(table, id, familyCode)` for every id
 *                       written ONTO the row (AGENTS.md §4) — the one hole RLS
 *                       structurally cannot close.
 *
 * ── WHAT IT CANNOT CHECK ───────────────────────────────────────────────────────────
 * Whether a verdict below is TRUE. It matches call sites, not reasoning — so a wrong
 * verdict passes. The value is that a NEW site cannot pass silently, which is the failure
 * this is aimed at; judging the three questions stays a person's job, and the verdicts
 * below are where that judgement is written down.
 *
 * It also only sees `.from('people')`. Two DATABASE functions move `membership_status`
 * under a service-role call and neither is a `.from('people')` grep —
 * `redeem_family_invitation()` and `set_membership_status()`. They are named at the bottom
 * of the allow-list so their absence is a recorded decision rather than an oversight.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SCAN = ['app', 'lib', 'components']

/**
 * Every reviewed service-role write to `people`, with its verdict.
 *
 * Keyed by `file::function`, because a file often holds several and the function is what a
 * reviewer reasons about. `writes` names the columns the site can set — the answer to
 * question 2 — and `verdict` is the sentence somebody would otherwise have had to
 * reconstruct.
 *
 * ADDING A ROW HERE IS A REVIEW, not a formality. Answer the three questions in the header
 * for the new site, and if the answer to any of them is "no", say why that is safe.
 */
const REVIEWED = {
  'app/actions/admin/users.ts::setMemberChapter': {
    op: 'update',
    writes: "chapter_id, on one member of the caller's own family",
    verdict:
      "THE THREE QUESTIONS. (1) Family-scoped: `.eq('family_code', familyCode)` beside "
      + "`.eq('id', peopleId)`, with the code from the caller's own membership — and the write "
      + "ends in `.select('id')`, so a `peopleId` outside this family is reported rather than "
      + 'answered as a success. There is no RLS under this at all, so that conjunct is the whole '
      + 'boundary. (2) Columns allow-listed: ONE column, written as a literal, from a normalised '
      + 'parameter — `chapter_id` is deliberately NOT on WRITABLE_PROFILE_COLUMNS, which is why '
      + 'this action exists separately from updateUserProfile. There is no caller-supplied object '
      + 'to filter. (3) Referenced ids verified: `chapterId` is checked with '
      + "belongsToFamily('chapters', …) before the write — §4 exactly, since "
      + '`people.chapter_id` REFERENCES chapters(id), which constrains existence and not '
      + 'ownership. An empty string is normalised to null first so the check is never asked '
      + 'about it, which is a legitimate value meaning National. '
      + 'GATED on `admin/members:edit` at canAny — canAny and not can, because the row is '
      + "somebody ELSE's and scope 'own' on `people` means the caller's own row, which is "
      + "saveChapterAndPropagate's job. "
      + 'THE CHILDREN are moved by lib/chapter-propagation.ts, reviewed on its own entry.',
  },
  'lib/chapter-propagation.ts::propagateChapterToChildren': {
    op: 'update',
    writes: 'chapter_id, on the account-less children of one member',
    verdict:
      'THE THREE QUESTIONS, in order. (1) Family-scoped: `.eq(\'family_code\', familyCode)` on '
      + 'the write AND on the `person_relationships` read that produces the id list — the '
      + 'second matters as much as the first, because without it a `personId` from another '
      + 'family would return that family\'s children and their ids would go straight into the '
      + '`.in()`. (2) Columns allow-listed: ONE column, `chapter_id`, written as a literal. '
      + 'There is no caller-supplied object to filter. (3) Referenced ids verified: the only '
      + 'id written is `chapterId`, and both callers check it with belongsToFamily BEFORE '
      + 'calling — stated as a precondition in the module header rather than re-checked here, '
      + 'because a helper that re-read it would hide which layer refused. '
      + 'WHY THE SERVICE ROLE AT ALL: the rows are people with no `user_id`, and the `people` '
      + 'UPDATE policy admits only the caller\'s own row — so the user client matched ZERO ROWS '
      + 'for any member without `community/directory:edit` at scope \'any\', silently, which is '
      + 'the defect this module was extracted to fix (AGENTS.md \u00a78b, and TODO.md carried it '
      + 'as open). Same shape and same reasoning as `editPersonRecord`. '
      + 'AND IT NARROWS ON `user_id IS NULL`, which is the rule rather than an optimisation: a '
      + 'relative who has claimed an account sets their own chapter.',
  },
  'app/actions/register.ts::registerUser': {
    op: 'insert',
    writes: 'the whole new person row',
    verdict:
      'The row is created, not amended, and its family comes from the validated code or the '
      + 'invitation rather than from a parameter. membership_status is READ BACK from the '
      + 'insert rather than supplied — the stamp trigger decides founder-vs-applicant, '
      + 'deliberately overriding any insert value, so this site cannot set it however it '
      + 'is called.',
  },
  'app/actions/link-person.ts::linkPersonToCurrentUser': {
    op: 'update/delete',
    writes: 'user_id, membership_status',
    verdict:
      'THE ONE DOCUMENTED EXCEPTION, and the only site in the tree that writes '
      + 'membership_status through this client. It fails question 2 on purpose: approval '
      + 'attaches to a MEMBERSHIP rather than to a row, and this action moves a membership '
      + 'between two rows, so the status has to be carried across by hand — the stamp '
      + 'trigger is BEFORE INSERT and this is an UPDATE. Bounded by isApprovedMember() '
      + 'above the write, family-scoped, and currently unreachable: '
      + 'LINK_EXISTING_PERSON_ENABLED is false and is checked at the endpoint rather than '
      + 'in the JSX. If that flag is ever flipped, this verdict is the thing to re-argue.',
  },
  // KEYED ON `addRelative`, THE EXPORTED ENDPOINT, although the insert itself is in the
  // private `createPerson` helper it calls. That is `enclosing()` working as intended: an
  // endpoint is the unit that gets reviewed, because it is the thing with a URL and the
  // thing whose guards decide whether the write happens at all. A private helper's own
  // name would move with a refactor and tell a reviewer less.
  'app/actions/family-tree.ts::addRelative': {
    op: 'insert',
    writes: 'a new account-less record (family_code, created_by, and the caller\'s fields)',
    verdict:
      'Creates a row with no user_id, family-scoped from the caller rather than from a '
      + 'parameter, behind requireMember(). The stamp trigger returns early for '
      + 'user_id IS NULL, so the row keeps the approved default and no membership decision '
      + 'is being made here. Question 3 is the live one and it is answered: the action takes '
      + 'TWO ids from the client (the anchor and, in link mode, an existing person) and '
      + 'belongsToFamily checks both — the shape AGENTS.md §4 cites upsertSpouse and '
      + 'upsertAncestor for, which this action inherited when they were deleted. '
      + 'tests/rls covers each id with its own case.',
  },
  'app/actions/family-tree.ts::setPersonBloodline': {
    op: 'update',
    writes: 'is_bloodline, and nothing else',
    verdict:
      'All three answered, and the column is the reason to read them carefully: '
      + 'dues_schedules.bloodline_only prices against people.is_bloodline, so this write '
      + 'decides whether somebody owes money. (1) .eq(family_code) from the caller\'s own '
      + 'membership beside .eq(id), never the id alone. (2) One column, named as a literal — '
      + 'there is no client-supplied object to allow-list, and the value is coerced with '
      + 'Boolean() rather than passed through. (3) personId is verified with '
      + 'belongsToFamily before the write. '
      + 'THE ADMIN CLIENT IS THE ONLY CLIENT THAT CAN DO THIS, which is deliberate rather '
      + 'than convenient: people_guard_bloodline (20260902000000) refuses any change to the '
      + 'column made by the `authenticated` role, so there is no policy underneath this and '
      + 'the three answers above are the whole boundary. That guard is what closes '
      + 'saveProfileSection, which writes a member\'s own people row through a policy with '
      + 'no opinion about which column changed — without it, a member could exempt '
      + 'themselves from a blood-only due. '
      + 'THE GRANT IS canAny, NOT can: there is no coherent "own" version of this, and a '
      + 'member editing their own row is precisely the abuse case. requireTreeEditor() '
      + 'resolves community/family-tree:edit at canAny, the same as every other write on '
      + 'that canvas.',
  },
  'app/actions/family-tree.ts::editPersonRecord': {
    op: 'update',
    writes: 'pickProfileColumns only',
    verdict:
      'All three answered, and it is the sharpest case in the tree because no policy is '
      + 'underneath it at all — the people UPDATE policy admits only a member\'s own row, '
      + 'so the user client cannot touch a record belonging to nobody. pickProfileColumns '
      + 'for the allow-list, primary_email deleted from the patch on top of that, '
      + 'belongsToFamily for the id, .eq(family_code) AND .is(user_id, null) on the write.',
  },
  'app/actions/admin/users.ts::updateUserProfile': {
    op: 'update',
    writes: 'pickProfileColumns only',
    verdict:
      'THE WORKED EXAMPLE the other verdicts are measured against. Family-scoped, '
      + 'pickProfileColumns on the payload, and belongsToFamily on chapter_id — kept as a '
      + 'second layer even though that column came off the allow-list, because re-adding a '
      + 'column to a list is a one-line change nobody thinks of as a security decision.',
  },
}

/**
 * Named, deliberately unmatched by the grep, so their absence is recorded rather than
 * assumed. Both move `membership_status` under a service-role call and neither is a
 * `.from('people')` expression, so no static sweep of this shape can see them.
 */
const NOT_GREPPABLE = {
  'redeem_family_invitation()':
    'A SECURITY DEFINER function called with the admin client and an explicit p_user_id '
    + '(lib/invitations.ts). It writes membership_status on a re-open and on a pre-approved '
    + 'invitation, and honours p_user_id only for service_role — for anyone else the '
    + 'argument is ignored, per AGENTS.md §2b. Its `AND NOT v_reopen` conjunct is the whole '
    + 'security argument of 20260811000001: without it an invitation reverses a refusal.',
  'set_membership_status() / set_member_enabled()':
    'The legitimate writers, called on the USER client from admin/approvals and '
    + 'admin/permissions. They refuse a NULL auth.uid() outright, so an admin-client call '
    + 'fails loudly rather than sailing past their own checks.',
}

// ---------------------------------------------------------------- the sweep

const findings = []
const notes = []

function files(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      files(full, out)
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/**
 * The enclosing `export ... function NAME` for a byte offset.
 *
 * Deliberately crude — the nearest preceding declaration, not a parse. A `.from('people')`
 * inside a nested closure attributes to the exported function containing it, which is the
 * unit a reviewer reasons about anyway. It cannot be wrong in a way that HIDES a site: an
 * unrecognised name is a finding, not a pass.
 */
function enclosing(source, at) {
  const before = source.slice(0, at)
  const matches = [...before.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm)]
  return matches.length ? matches[matches.length - 1][1] : '<top level>'
}

/**
 * A `.from('people')` whose chain reaches a write, on the ADMIN client.
 *
 * The client is decided by whether the file imports `createAdminClient` at all, which is
 * coarse in one direction only: a file holding both clients reports its user-client writes
 * too. That is the safe direction — an extra row to review, never a missing one — and no
 * file in the tree does it today for `people`.
 */
// ONE CHAIN, and the two exclusions are what make this usable rather than noisy.
//
// `[^;]` stops the match crossing a statement boundary, and the `.from(` re-check below
// stops it crossing from a `people` READ into an unrelated table's WRITE later in the same
// statement. Without both, the first version reported five sites that do not write to
// `people` at all — `recordFundContribution`, `tagPersonInPhoto`, two in photos.ts — each
// of which reads `people` and then inserts somewhere else. An audit that cries wolf five
// times gets an allow-list of five false verdicts, which is worse than no audit.
const WRITE = /\.from\((['"`])people\1\)([^;]{0,400}?)\.(insert|update|upsert|delete)\(/g

/** Every `(file::function, op)` in the tree that writes to `people` on the admin client. */
function findWrites() {
  const out = []
  for (const file of SCAN.flatMap(d => files(join(ROOT, d)))) {
    const source = readFileSync(file, 'utf8')
    if (!source.includes('createAdminClient')) continue

    const rel = relative(ROOT, file).replace(/\\/g, '/')
    for (const match of source.matchAll(WRITE)) {
      // The gap must not contain another `.from(` — that would mean the write belongs to a
      // different table and this match walked past the end of the `people` chain.
      if (/\.from\(/.test(match[2])) continue
      out.push({ key: `${rel}::${enclosing(source, match.index)}`, op: match[3] })
    }
  }
  return out
}

const writes = findWrites()
const seen = new Set(writes.map(w => w.key))

for (const { key, op } of writes) {
  if (REVIEWED[key]) continue
  findings.push({
    key,
    message: `${op} on public.people through the service role, with no review entry`,
    detail: [
      'The service role bypasses RLS, so this write re-applies nothing unless it does so',
      'by hand. Answer the three questions in this script\'s header — family-scoped?',
      'columns allow-listed? every referenced id verified? — then add an entry to',
      'REVIEWED in scripts/people-writes.mjs with the verdict.',
    ],
  })
}

// The mirror finding: an entry for a site that has moved or gone. Left alone it would
// quietly excuse a future write in the same file and function.
for (const key of Object.keys(REVIEWED)) {
  if (!seen.has(key)) {
    findings.push({
      key,
      message: 'reviewed site no longer exists',
      detail: ['The write has moved or gone. Remove the entry, or point it at the new site.'],
    })
  }
}

// ---------------------------------------------------------------- report

function main() {
  const line = (ok, label) => console.log(`  ${ok ? 'ok      ' : 'FAIL    '} ${label}`)

  console.log(`\n  scanned  ${SCAN.join(', ')} for service-role writes to public.people`)
  console.log(`  reviewed ${Object.keys(REVIEWED).length} site(s) · ${seen.size} found in the tree\n`)

  line(findings.length === 0, 'every service-role write to public.people has a reviewed verdict')

  notes.push('Not reachable by this sweep, and recorded rather than assumed:')
  for (const [name, why] of Object.entries(NOT_GREPPABLE)) notes.push(`  ${name} — ${why}`)

  for (const note of notes) console.log(`\n  note     ${note}`)

  if (!findings.length) {
    console.log('\n  Clean. NOTE: this checks that a verdict EXISTS, never that it is true.\n')
    return 0
  }

  console.log(`\n  ${findings.length} finding(s):\n`)
  for (const f of findings) {
    console.log(`  ── ${f.key}: ${f.message}`)
    for (const d of f.detail ?? []) console.log(`       ${d}`)
    console.log('')
  }
  return 1
}

// `process.exitCode`, never `process.exit()` — the reason scripts/migrations.mjs gives.
try {
  process.exitCode = main()
} catch (error) {
  console.error(`\n  ${error.message}\n`)
  process.exitCode = 2
}
