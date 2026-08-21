/**
 * The two-family fixture.
 *
 * ALPHA is the victim: it holds one row of every kind the RLS-path actions read.
 * BRAVO is the attacker's family.
 *
 * The attacker of record is BRAVO's *administrator* — a user holding scope 'any'
 * on every resource and every action. That is deliberate. A test where the
 * attacker has no permissions proves very little: it would pass even if family
 * scoping were absent, because the permission layer alone would refuse them.
 * Giving them every grant their own family can confer strips the permission
 * layer out of the result, so anything they can still reach in ALPHA is reachable
 * purely because family isolation failed.
 *
 * ALPHA also has a second member, so ownership can be tested inside one family:
 * "may a member touch a row belonging to a different member of the same family?"
 * is a different question from cross-family, and own_expr is what answers it.
 *
 * TWO THINGS THE DATABASE NOW DOES TO THIS FIXTURE
 * (20260806000008, rewritten for templates by 20260807000000)
 *
 * 1. Inserting a family seeds the Administrators and General TEMPLATES with their
 *    grids, and 'restricted' visibility for every admin resource. So the
 *    Administrators template below already exists by the time this asks for it —
 *    hence the upsert — and a plain member no longer sees admin pages by default,
 *    which previously happened only because no resource_visibility row existed.
 *
 * 2. Inserting a user-linked person stamps people.permission_template_id with
 *    General. Every member here therefore holds General's grid (view on the
 *    community pages, chat and photos scoped to 'own') where before they held
 *    nothing. That is the shape a real member has, so the controls that run as
 *    alphaMember are testing the real thing rather than a permission vacuum.
 *
 * What the trigger deliberately does NOT do is promote anyone to Administrators:
 * it recognises the founder as `families.created_by`, and the two families below
 * are inserted without one. A "first member wins" rule would have made
 * `alphaMember` an administrator and quietly deleted the ownership axis above.
 *
 * THE ADMIN ASSIGNMENT IS AN UPDATE TO `people`, NOT A MEMBERSHIP ROW
 *
 * user_group_members is gone. Making somebody an administrator is now one column on
 * their people row — and that column is guarded: people_guard_permission_template
 * refuses a change made by the 'authenticated' role, so only the service role (this
 * fixture) and apply_permission_template() may move it. The service role is what the
 * harness uses, so the UPDATE below goes through for the same reason the
 * membership_status UPDATE does.
 *
 * A THIRD THING THE DATABASE NOW DOES, AND IT WOULD BREAK THIS FIXTURE SILENTLY
 * (20260806000011)
 *
 * A BEFORE INSERT trigger on `people` decides founder-vs-applicant for itself and
 * OVERRIDES whatever the caller supplied — deliberately, because register.ts writes
 * with the service role and a rule it had to opt into would be one `?mode=join`
 * could skip. Applied to the loop below that means: the FIRST person inserted into
 * each family comes out 'approved' and EVERY ONE AFTER IT comes out 'pending'.
 *
 * Left alone, this suite would go green while testing almost nothing. A pending
 * member resolves to no person at all (auth_person_id() gates on the column), so
 * auth_permission() returns 'none' for every resource — and the isolation assertion
 * "BRAVO's admin saw none of ALPHA's data" would pass because BRAVO's admin is not a
 * member of anywhere, not because family scoping works. Worse, it would pass for the
 * ALPHA controls too, which is the one thing meant to catch exactly this.
 *
 * So the statuses are set EXPLICITLY, after the loop, by UPDATE — see the section
 * marked "membership status". An UPDATE, not an insert value, because the trigger
 * would discard the insert value; and it works because the service role is allowed to
 * move this column (people_guard_membership_status refuses only the 'authenticated'
 * role, which is what stops a member self-approving through the profile endpoint).
 *
 * THE FOUR APPLICANTS
 *   alphaPending / bravoPending  stay pending for the life of the run. They are
 *                                ATTACKING ACTORS: cases that ask what an
 *                                unapproved member of ALPHA can see of ALPHA.
 *   alphaApplicant               the row approveApplicant decides.
 *   alphaRejectable              the row rejectApplicant decides.
 *
 * The last two exist separately for `deletableChild`'s reason: a positive control
 * that consumes a row a later case depends on turns that later case into a vacuous
 * pass. approveApplicant's control really does approve somebody, so it must not be
 * allowed to approve the actor the pending cases are asserting about.
 */
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { API_URL, SERVICE_ROLE_KEY } from './env.mjs'

/**
 * Invitation tokens are stored only as a SHA-256, so the fixture has to hash the same
 * way create_family_invitation() does — `encode(digest(token,'sha256'),'hex')`.
 * Seeding a known plaintext is what lets a case try to redeem another family's token.
 */
const tokenHash = (token) => createHash('sha256').update(token).digest('hex')

export const ALPHA = 'ALPHATEST'
export const BRAVO = 'BRAVOTEST'

/**
 * A THIRD FAMILY, and it exists for one case: the family that actually gets removed.
 *
 * `removeFamily`'s positive control has to genuinely remove something, and it must not be
 * ALPHA. That is `deletableChild`'s rule stated at the level of a whole family — a control
 * that mutates a row later cases depend on turns those cases into vacuous passes, and
 * ALPHA's `families` row is read by `admin/family.getFamilySettings`, by both `renameFamily`
 * cases and by every marker in this fixture. A family removed halfway through the run would
 * take all of that with it.
 *
 * It is seeded ACTIVE, and ends the run REMOVED. That sequence is deliberate: the removal
 * cases restore it in their own `setup` (each half of a write case re-snapshots, so the
 * control has to have something left to remove), and nothing after them reads it.
 *
 * It holds one person — its own approved administrator — and none of the twenty-odd rows
 * ALPHA and BRAVO get. Nothing about removal reads a fund or a photograph, and seeding
 * them would only slow every run down.
 *
 * NEVER USE `charlieAdmin` AS AN ATTACKING ACTOR. They belong to a family whose whole
 * purpose is to be destroyed by a positive control, so an isolation assertion resting on
 * them would be resting on a moving fixture.
 */
export const CHARLIE = 'CHARLTEST'

const PASSWORD = 'rls-harness-pw-2026!'

/**
 * When the declined applicants below were refused: an hour ago.
 *
 * One constant, because two things are compared against it and they must not drift — the
 * re-open invitation is dated after it, the superseded one before it, and
 * redeem_family_invitation permits a re-open only when the invitation postdates the
 * refusal it would reverse (20260811000001).
 */
const DECLINED_AT = new Date(Date.now() - 60 * 60 * 1000).toISOString()

/**
 * A date `n` days from now, as `YYYY-MM-DD`.
 *
 * THE GATHERINGS DATES ARE RELATIVE AND HAVE TO BE. `getPremierGathering` filters on the
 * server's own `todayLocal()` — "the span has not finished" — so a hard-coded 2026-09-05
 * would give that case a positive control until that morning and a silent, permanent
 * failure afterwards, on a fixture nobody had touched. Every other date in this file is
 * hard-coded because nothing reads it against the clock; these are read against it.
 *
 * UTC, via the ISO slice, and deliberately not `todayLocal()`: these are +20 to +45 days
 * out, so a one-day disagreement with the local zone changes no assertion, and importing a
 * lib module here would be the fixture depending on the code under test.
 */
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

/**
 * The gathering's span, its task deadline, and the spare gathering's day.
 *
 * Module-level rather than computed inside the loop so ALPHA's and BRAVO's gatherings share
 * a month: `calendar.getCalendarMonth`'s case asks for the month ALPHA's gathering is in,
 * and a BRAVO gathering in a different month would make the attack half pass because the
 * month happened to be empty rather than because the query was scoped.
 */
const GATHERING_STARTS_ON = inDays(30)
const GATHERING_ENDS_ON = inDays(32)
const GATHERING_DUE_ON = inDays(20)
const SPARE_GATHERING_STARTS_ON = inDays(45)

/**
 * A DATE OF BIRTH WHOSE NEXT ANNIVERSARY IS INSIDE THE BIRTHDAYS PANE'S 60-DAY HORIZON.
 *
 * `announcements.getUpcomingBirthdays` (20260819000002) reads the roster and hands it to
 * `upcomingBirthdays(roster, todayLocal())`, which keeps only the people whose next birthday
 * falls in the next `BIRTHDAY_HORIZON_DAYS`. EVERY OTHER `date_of_birth` IN THIS FIXTURE IS A
 * HARD-CODED LITERAL — 2015-04-04, 1950-02-02, 1971-04-04 and the rest — and not one of them
 * is inside that window today, which means the case's positive control would answer `[]` and
 * pass the isolation assertion by returning nothing at all. That is AGENTS.md §7's decoration
 * failure exactly: an action that answers empty for everybody satisfies "BRAVO saw none of
 * ALPHA's data" trivially.
 *
 * SO IT IS RELATIVE, FOR `inDays`' OWN REASON ONE STEP FURTHER ON. A literal inside the window
 * would work this month and rot silently the moment the calendar moved past it — a fixture
 * nobody had touched, a control that had quietly stopped controlling anything, and a green run.
 * The MONTH AND DAY come from the clock and only the YEAR is fixed.
 *
 * 1980 IS THE YEAR AND IT IS A LEAP YEAR ON PURPOSE. `inDays(10)` can land on 29 February —
 * only ever in a year that has one, so `1980-02-29` is a date `date_of_birth` accepts, whereas
 * a common birth year would make the fixture refuse its own insert one February in four.
 * `lib/birthdays.ts` then clamps that anniversary to 28 February in a common year, which moves
 * `onDate` and never removes the person, so the assertions below (which are about WHO is
 * listed) hold either way.
 *
 * The UTC-versus-local slop `inDays` describes is harmless here for the same reason it is
 * there: +10 and +12 days are nowhere near either end of a 60-day window, so a one-day
 * disagreement with the server's `todayLocal()` changes no assertion.
 */
const BIRTHDAY_SOON = `1980${inDays(10).slice(4)}`

/**
 * The same, two days later, for the relative who is DEAD.
 *
 * A different day from `BIRTHDAY_SOON` so a probe reading a list of dates can tell the two
 * rows apart, and inside the horizon for the assertion to mean anything: the point of this row
 * is that `getUpcomingBirthdays` withholds it because of `sunset_date`, and a birthday outside
 * the window would be withheld by the arithmetic instead and prove nothing.
 */
const SUNSET_BIRTHDAY_SOON = `1935${inDays(12).slice(4)}`

/**
 * When that relative died. A fixed literal, because nothing reads it against the clock — only
 * `IS NULL` is ever asked of it.
 */
const SUNSET_DATE = '1998-11-04'

/**
 * When the approved task was ruled on. A TIMESTAMPTZ, not a DATE — `gathering_tasks.decided_at`
 * and `gathering_task_submissions.reviewed_at` both are — and in the PAST, because a decision
 * that has been taken is in the past by definition and `reopenGatheringTask`'s setup writes this
 * value back on every run. A fixed literal rather than `new Date()`: the setup has to restore the
 * row to a state a probe can compare against, and a clock read there would make the probe's
 * before-and-after differ by the run's own duration on a column nothing under test wrote.
 */
const APPROVED_DECIDED_AT = '2026-08-01T12:00:00.000Z'

export const USERS = {
  alphaMember: { email: 'alpha.member@rls.test', family: ALPHA, admin: false },
  alphaOther: { email: 'alpha.other@rls.test', family: ALPHA, admin: false },
  // ALPHA's administrator exists to make the comparison symmetric. Several write
  // policies require a grant, so a plain member's own write is refused and the
  // positive control would fail for a reason that has nothing to do with family
  // isolation. Running the control as ALPHA's admin against the attack by BRAVO's
  // admin holds permissions constant and leaves family as the only difference.
  alphaAdmin: { email: 'alpha.admin@rls.test', family: ALPHA, admin: true },
  bravoAdmin: { email: 'bravo.admin@rls.test', family: BRAVO, admin: true },
  bravoMember: { email: 'bravo.member@rls.test', family: BRAVO, admin: false },
  // Fresh registration stubs: created_by = self, no relationships. That is the
  // exact shape getLinkPersonBannerData requires before it will show anything.
  alphaNewcomer: { email: 'alpha.newcomer@rls.test', family: ALPHA, admin: false, newcomer: true },
  bravoNewcomer: { email: 'bravo.newcomer@rls.test', family: BRAVO, admin: false, newcomer: true },
  // Joined by family code and not yet admitted. `pending: true` is read by the
  // membership-status section below, not by the insert — see the header.
  alphaPending: { email: 'alpha.pending@rls.test', family: ALPHA, admin: false, pending: true },
  bravoPending: { email: 'bravo.pending@rls.test', family: BRAVO, admin: false, pending: true },
  // Two more of ALPHA's applicants, kept apart so the approve and reject controls each
  // have their own row to consume.
  alphaApplicant: { email: 'alpha.applicant@rls.test', family: ALPHA, admin: false, pending: true },
  alphaRejectable: { email: 'alpha.rejectable@rls.test', family: ALPHA, admin: false, pending: true },
  // An approved ALPHA member who exists to be re-templated and switched off. Separate
  // from alphaMember and alphaOther for `deletableChild`'s reason: applyTemplate and
  // setMemberEnabled both have positive controls that really do change their target,
  // and a later case asserting about a member whose access an earlier control revoked
  // would pass for the wrong reason. Nothing else in the fixture reads this row.
  alphaSpare: { email: 'alpha.spare@rls.test', family: ALPHA, admin: false },
  // THREE DECLINED ALPHA APPLICANTS, for 20260811000001. They are separate rows for
  // `deletableChild`'s reason — each is consumed by its own case, and a control that
  // re-opened or re-admitted a row another case asserts about would turn that case into a
  // vacuous pass. What each is for:
  //
  //   alphaDeclinedAsk    only ever an invite TARGET. Proves a PLAIN member (no
  //                       admin/approvals grant) may ask a declined person back, which is
  //                       the policy chosen for this change.
  //   alphaDeclinedBack   redeems an invitation minted AFTER their refusal, and must land
  //                       'pending' rather than 'approved' even though that invitation is
  //                       pre_approved. That is the whole security property.
  //   alphaDeclinedStale  holds an invitation minted BEFORE their refusal and must not be
  //                       able to reverse it. The refused person is the ATTACKER here.
  //
  // 'rejected' is applied by the membership-status section below, keyed on `declined`.
  alphaDeclinedAsk: { email: 'alpha.declined.ask@rls.test', family: ALPHA, admin: false, declined: true },
  alphaDeclinedBack: { email: 'alpha.declined.back@rls.test', family: ALPHA, admin: false, declined: true },
  alphaDeclinedStale: { email: 'alpha.declined.stale@rls.test', family: ALPHA, admin: false, declined: true },
  // A fourth, for 20260811000002's appeal. Its own row because the appeal control really
  // does move the row to 'pending', and the three above must stay 'rejected' for their own
  // cases — an appeal that consumed one of them would make those pass for the wrong reason.
  alphaDeclinedAppeal: { email: 'alpha.declined.appeal@rls.test', family: ALPHA, admin: false, declined: true },
  // The one account that can give redeemInvitation a positive control, and the reason it
  // is a BRAVO member rather than an ALPHA one: redemption is by definition an OUTSIDER
  // joining, so the redeemer must have an auth.users row (or the email conjunct at
  // 20260806000013:292 refuses them) and NO ALPHA people row (or the already-belongs
  // check at :297 refuses them). Only somebody in the other family satisfies both.
  //
  // IT ENDS THE RUN HOLDING MEMBERSHIPS IN BOTH FAMILIES. A bridging account is the one
  // fixture shape that can make a cross-family assertion pass for the wrong reason, so
  // NEVER reuse it as an attacking actor or as a positive control for anything else —
  // an "attacker in BRAVO" who is also in ALPHA proves nothing about isolation.
  //
  // Deliberately NOT in alphaMarkers (cases.mjs): the address belongs to a BRAVO people
  // row, so BRAVO-side callers legitimately see it and marking it would report leaks
  // that are not leaks.
  outsideInvitee: { email: 'outside.invitee@rls.test', family: BRAVO, admin: false },
  // CHARLIE's administrator, and its only member — the actor whose family a removal
  // control is allowed to destroy. Approved, and holding scope 'any' on everything its own
  // family can confer, exactly like the other two administrators: a positive control that
  // failed for want of a grant would prove nothing about removal.
  charlieAdmin: { email: 'charlie.admin@rls.test', family: CHARLIE, admin: true },
  // ── FOUR GENORRA STAFF ACCOUNTS, AND THEY BELONG TO NO FAMILY AT ALL ───────────────────
  //
  // `noPerson: true` is the only flag in this map that changes the LOOP rather than a column:
  // these four get an `auth.users` row and NO `people` row anywhere. Three reasons, and the
  // third is the one that makes them worth the four extra sign-ins.
  //
  //   1. IT IS WHAT A STAFF MEMBER IS. `app/actions/staff/access.ts` says so in its own words
  //      — "a staff member need not be a member of any family at all", which is why nothing in
  //      that module writes a `notifications` row. A fixture that made them customers would be
  //      fixturing something the product does not claim.
  //   2. IT KEEPS THEM OUT OF EVERY OTHER ASSERTION IN THIS SUITE. `people` rows are counted
  //      exactly in several places — `getPendingApprovalCount` asserts 3 in ALPHA and 1 in
  //      BRAVO, `getScopeUsage` asserts one member in the occupied chapter — and a roster row
  //      added to ALPHA or BRAVO for a reason that has nothing to do with families is how one
  //      of those numbers comes to be wrong for a reason nobody can find.
  //   3. IT IS A REGRESSION GUARD ON THE MODULE UNDER TEST. All four staff actions run on the
  //      service role against a table with no `family_code` column, and their positive control
  //      is a caller with no family — so if a future edit ever adds `requireMember()`, an
  //      `auth_family_code()` lookup or a family conjunct to `app/actions/staff/access.ts`,
  //      every control in STAFF_CASES fails loudly instead of the console quietly refusing
  //      GENORRA's own employees.
  //
  // WHAT SEEDING A `genorra_staff` ROW MEANS FOR THE REST OF THIS FILE: nothing, and that is
  // checked rather than assumed. `is_genorra_staff()` is named by NO RLS policy in the schema
  // (20260817000005 says so and `grep is_genorra_staff supabase/migrations` confirms it), the
  // table has no `family_code`, and nothing else in cases.mjs reads it — so a staff grant
  // widens no read, and these four accounts are invisible to every family-scoped query in the
  // suite because they have no row in `people` to be found by one.
  //
  //   staffOwner    role 'owner'. The POSITIVE CONTROL for all four actions, and the only
  //                 actor that can legitimately succeed at any of them.
  //   staffSupport  role 'support'. THE CRUX ATTACKER: genuinely staff, and so past
  //                 `requireStaff()`, refused only by `requireStaffOwner()`'s one comparison.
  //                 No other attacker in this suite can reach that line.
  //   staffSpare    role 'engineer'. The TARGET of `setStaffRole` and `revokeStaffAccess`, so
  //                 neither control consumes an actor. `deletableChild`'s rule.
  //   staffGrantee  no staff row. The account `grantStaffAccess`'s control grants to, so that
  //                 control creates a row rather than colliding with one.
  staffOwner: { email: 'staff.owner@rls.test', noPerson: true, staffRole: 'owner' },
  staffSupport: { email: 'staff.support@rls.test', noPerson: true, staffRole: 'support' },
  staffSpare: { email: 'staff.spare@rls.test', noPerson: true, staffRole: 'engineer' },
  staffGrantee: { email: 'staff.grantee@rls.test', noPerson: true },
}

const admin = () => createClient(API_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Delete anything a previous run left behind, so the suite is re-runnable. */
async function teardown(db) {
  // CHARLIE is swept like the other two. It ends every run REMOVED, and `families` has no
  // guard on DELETE — `families_guard_removal` is a BEFORE UPDATE trigger about the
  // `authenticated` role, and this sweep is the service role deleting the row outright —
  // so a removed family needs no special handling here.
  const codes = [ALPHA, BRAVO, CHARLIE]

  // Children that carry no family_code, reached through their parent.
  const { data: rooms } = await db.from('chat_rooms').select('id').in('family_code', codes)
  const roomIds = (rooms ?? []).map(r => r.id)
  if (roomIds.length) {
    await db.from('chat_messages').delete().in('room_id', roomIds)
    await db.from('chat_participants').delete().in('room_id', roomIds)
  }

  const { data: elections } = await db.from('elections').select('id').in('family_code', codes)
  const electionIds = (elections ?? []).map(e => e.id)
  if (electionIds.length) {
    await db.from('election_votes').delete().in('election_id', electionIds)
    await db.from('election_nominations').delete().in('election_id', electionIds)
    await db.from('election_positions').delete().in('election_id', electionIds)
  }

  const { data: collections } = await db.from('photo_collections').select('id').in('family_code', codes)
  const collectionIds = (collections ?? []).map(c => c.id)
  if (collectionIds.length) {
    const { data: photos } = await db.from('photos').select('id').in('collection_id', collectionIds)
    if (photos?.length) await db.from('photo_tags').delete().in('photo_id', photos.map(p => p.id))
  }

  // Templates: their grid first, then the assignment on `people`, or the RESTRICT
  // foreign key refuses the delete below. The people rows themselves go with the
  // family-scoped sweep that follows.
  const { data: templates } = await db.from('permission_templates').select('id').in('family_code', codes)
  const templateIds = (templates ?? []).map(t => t.id)
  if (templateIds.length) {
    await db.from('template_permissions').delete().in('template_id', templateIds)
    await db.from('people').update({ permission_template_id: null }).in('family_code', codes)
  }

  // Family-scoped tables, children before parents.
  const scoped = [
    // FIRST, and it has to be. The Donations fund cannot be deleted while its family
    // still exists (funds_protect_system, 20260807000003) — the one path that trigger
    // permits is the family_code no longer being there, since `funds` has no foreign key
    // to `families` and so nothing cascades it. Nothing depends on `families` by key, so
    // removing it up front costs nothing and is what lets `funds` go below.
    'families',
    'chat_rooms', 'elections', 'photos', 'photo_collections',
    // ── GATHERINGS (20260819000000), AND THEY HAVE TO BE BEFORE `funds` ─────────────
    // Not "children before parents" as a habit — `funds` genuinely cannot be deleted while
    // a gathering carries a budget drawn on it, and the mechanism is not the obvious one.
    // `gatherings.fund_id` is ON DELETE SET NULL, and Postgres carries a SET NULL out as an
    // ordinary UPDATE on the referencing row, so every constraint on that row is enforced
    // against it — including `gatherings_budget_needs_fund` (a budget must name a fund).
    // The fixture seeds exactly that state, so with these six listed after `funds` the
    // sweep dies on 23514 naming a constraint nobody touched. `lib/money-attached.ts`
    // counts this as the fifth thing attached to a fund for the same reason.
    //
    // Among themselves: submissions cascade from tasks, tasks and uses cascade from
    // `gatherings`, steps cascade from `gathering_templates` — and
    // `gathering_template_uses.template_id` is NO ACTION, which is what forces `uses`
    // ahead of `gathering_templates` rather than merely making it tidy.
    //
    // None of the six is append-only: no trigger refuses a DELETE, so each of these sweeps
    // does real work rather than documenting a cascade.
    'gathering_task_submissions', 'gathering_tasks', 'gathering_template_uses',
    'gatherings', 'gathering_template_steps', 'gathering_templates',
    'fund_contributions', 'fund_milestones', 'fund_allocations', 'funds',
    // AFTER `funds`. Second table in this list to go append-only (20260807000002, after
    // dues_payments below), and the rule is the same: a direct DELETE is refused, and the
    // ONE path the trigger permits is the cascade from a parent that is already gone —
    // here the fund the money came out of. Deleting funds first makes the cascade do the
    // work and leaves this sweep as a no-op that documents the ordering.
    //
    // GENERAL RULE for anything added here: if a table is append-only, it belongs after
    // whichever parent cascades it away, never before. Getting it wrong does not fail
    // loudly on a fresh database — the sweep matches zero rows and passes — it fails on
    // the SECOND run, in teardown, before a single case executes.
    'fund_disbursements',
    // AFTER `funds`, for the reason stated above it: fund_transfers is append-only
    // (20260812000002) and the one delete its trigger permits is the cascade from a
    // fund that is already gone. Both of its foreign keys point at `funds`, so deleting
    // the funds first does the work and leaves this a documented no-op. Listed BEFORE
    // `people`, because a transfer's only other foreign key is recorded_by and that one
    // is ON DELETE SET NULL — it would leave the row behind rather than remove it.
    'fund_transfers',
    'dues_member_plans', 'dues_schedules',
    'notifications', 'documents', 'announcements',
    'person_relationships', 'user_roles', 'family_invitations',
    // THIRTEEN `event_*` LINES WERE HERE AND THE TABLES ARE DROPPED (20260819000006). What
    // they recorded is worth keeping as a rule for anything added below: the ORDER is not
    // "children first" as a habit, it is that an append-only table belongs after whichever
    // parent cascades it away, and a table whose only inbound references are SET NULL has to
    // be listed on its own because nothing removes the row for it.
    // Written by 20260806000008's families trigger, and keyed on family_code with no
    // FK to families — so nothing else here removes it, and a stale 'restricted' row
    // would outlive the family it was created for.
    'resource_visibility',
    // Keyed on family_code with no foreign key to `families`, like resource_visibility
    // above it, so nothing else here removes it. Listed BEFORE `people`, because
    // `requested_by` REFERENCES people(id) — ON DELETE SET NULL, so leaving it would
    // silently blank the column rather than fail, and a challenge row belonging to nobody
    // would outlive the run it was seeded for.
    'family_removal_challenges',
    'people',
    // AFTER `people`, and it has to be. dues_payments is append-only — 20260806000002
    // refuses a DELETE even to the service role — with ONE exception: the ON DELETE
    // CASCADE from a `people` row that is already gone. Deleting the payments directly
    // hits the refusal, so this ran only against tables the previous reset had already
    // emptied, and the suite was quietly single-use: the first run after
    // `npx supabase db reset` passed, and every run after it died in teardown before a
    // single case executed. Removing the people first makes the cascade do the work,
    // and leaves this sweep as a no-op that says so.
    'dues_payments',
    // AFTER `people` for a different reason: permission_template_id is ON DELETE
    // RESTRICT, and the null-out above only covers rows in these families. Deleting the
    // people first means there is provably nothing left pointing here.
    'permission_templates',
    // AFTER `people` for the same reason as the two above: `people.chapter_id`
    // REFERENCES chapters(id), so the rows pointing here have to go first.
    //
    // Added 2026-08-12, and it is the third instance of the failure this list's own
    // comment describes: the chapter seeded per family below has a UNIQUE
    // (family_code, name), so leaving it behind made the suite single-use again —
    // green on a fresh database, and dead in teardown on the very next run with
    // "duplicate key value violates unique constraint chapters_family_code_name_key",
    // before a single case executed. Seeding a row means sweeping it.
    'chapters',
    // The family's own CUSTOM board positions. Its global rows carry a NULL family_code and
    // are product data no migration will re-seed (AGENTS.md, "Four tables in `public` are
    // product data"), so this sweep must never reach them — `.in('family_code', codes)`
    // cannot match NULL, which is what keeps it safe. Listed after `user_roles` above,
    // whose role_id cascades from here.
    'family_roles',
    // AFTER `chapters`, and it has to be: `chapters.region_id` REFERENCES regions(id), and
    // since 20260817000008 `dues_schedules.region_id` does too — so the rows pointing here
    // go first. Added 2026-08-18 with the region seeded below, for the reason the note on
    // `chapters` gives: a seeded row with a UNIQUE (family_code, name) that is not swept
    // makes the whole suite single-use, green on a fresh database and dead in teardown on
    // the very next run.
    'regions',
  ]
  for (const table of scoped) {
    const { error } = await db.from(table).delete().in('family_code', codes)
    // A table without family_code, or not yet migrated, is not a failure here.
    if (error && !/column .* does not exist|does not exist/i.test(error.message)) {
      throw new Error(`teardown ${table}: ${error.message}`)
    }
  }

  // Auth users last — people rows FK to them.
  for (const { email } of Object.values(USERS)) {
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const hit = (list?.users ?? []).find(u => u.email === email)
    if (hit) {
      await db.from('user_family_settings').delete().eq('user_id', hit.id)
      // `genorra_staff` CANNOT GO IN THE `scoped` SWEEP ABOVE: it has no `family_code` column,
      // so `.in('family_code', codes)` errors with "column does not exist" — which that loop
      // deliberately tolerates, meaning the line would look present and delete nothing.
      //
      // `user_id` is ON DELETE CASCADE from `auth.users` (20260817000005: "a staff grant
      // belonging to no account is not a record worth keeping"), so `deleteUser` below would
      // take the row anyway. This is here regardless, and not as belt-and-braces: it is the one
      // statement standing between this suite and being SINGLE-USE if that cascade is ever
      // changed to RESTRICT. `user_id` is the PRIMARY KEY, so a row left behind fails the next
      // run's INSERT on a duplicate key — in teardown, before a single case executes, which is
      // the failure this file's `scoped` comments describe three separate times.
      //
      // It also sweeps what a CASE created: `grantStaffAccess`'s positive control writes a row
      // for `staffGrantee`, which no seed statement would replace.
      await db.from('genorra_staff').delete().eq('user_id', hit.id)
      await db.auth.admin.deleteUser(hit.id)
    }
  }
}

const must = (label, { data, error }) => {
  if (error) throw new Error(`seed ${label}: ${error.message}`)
  return data
}

export async function seed() {
  const db = admin()
  await teardown(db)

  const fx = { alpha: {}, bravo: {}, charlie: {}, users: {} }

  // The `families` row ids are KEPT, which they were not before: the raw PATCH probe that
  // reaches `families_guard_removal` addresses the row by primary key (rawUpdate is
  // `.eq('id', …)`), and that trigger is reachable no other way.
  for (const code of [ALPHA, BRAVO, CHARLIE]) {
    const row = must(`family ${code}`, await db.from('families')
      .insert({ family_code: code, family_name: `${code} Family` }).select().single())
    const side = code === ALPHA ? 'alpha' : code === BRAVO ? 'bravo' : 'charlie'
    fx[side].familyCode = code
    fx[side].familyRowId = row.id
  }

  // ── users + their people rows ──────────────────────────────────────────────
  for (const [key, spec] of Object.entries(USERS)) {
    const { data: created, error } = await db.auth.admin.createUser({
      email: spec.email, password: PASSWORD, email_confirm: true,
    })
    if (error) throw new Error(`seed user ${spec.email}: ${error.message}`)
    const userId = created.user.id

    // `noPerson` — the four GENORRA staff accounts. An `auth.users` row and nothing else, for
    // the reasons stated on them in USERS. `personId` is null rather than absent, so every
    // filter below can test for it rather than discovering `undefined` in a `.in()` list.
    if (spec.noPerson) {
      fx.users[key] = { ...spec, userId, personId: null, password: PASSWORD }
      continue
    }

    const person = must(`person ${spec.email}`, await db.from('people').insert({
      user_id: userId,
      family_code: spec.family,
      first_name: key,
      last_name: spec.family,
      primary_email: spec.email,
      // A newcomer's row must look self-created for the link-person banner to fire.
      created_by: spec.newcomer ? userId : null,
    }).select().single())

    fx.users[key] = { ...spec, userId, personId: person.id, password: PASSWORD }
  }

  // ── membership status, stated rather than inherited ────────────────────────
  // See the header for why this cannot be an insert value. Two statements, in this
  // order, so the result does not depend on the iteration order of USERS: everyone is
  // approved, then the applicants are pended back.
  // `.filter(Boolean)` for the `noPerson` staff accounts, which have no `people` row to have a
  // membership status. Without it this is `.in('id', [ … , null, null, null, null])`, which
  // PostgREST turns into `id=in.(…,null)` — a request for a row whose id IS the string "null",
  // matching nothing and erroring on nothing. The whole UPDATE would still land for everybody
  // else, so the damage would be invisible here and would surface only in the assertion below.
  const everyone = Object.values(fx.users).map(u => u.personId).filter(Boolean)
  must('approve seeded members', await db.from('people')
    .update({ membership_status: 'approved', membership_decided_at: new Date().toISOString() })
    .in('id', everyone))

  const applicants = Object.values(fx.users).filter(u => u.pending).map(u => u.personId)
  must('pend seeded applicants', await db.from('people')
    .update({
      membership_status: 'pending',
      membership_requested_at: new Date().toISOString(),
      membership_decided_at: null,
      membership_decided_by: null,
    })
    .in('id', applicants))

  // ...and the declined ones are refused, with a note and a DECIDED-AT IN THE PAST.
  //
  // The timestamp is load-bearing rather than decorative: redeem_family_invitation only
  // lets an invitation re-open a refusal it POSTDATES, so a fixture that stamped
  // membership_decided_at at NOW() would make the re-open case a coin-toss against the
  // invitation seeded microseconds later. An hour back is unambiguous in both directions.
  const declined = Object.values(fx.users).filter(u => u.declined).map(u => u.personId)
  must('decline seeded applicants', await db.from('people')
    .update({
      membership_status: 'rejected',
      membership_requested_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      membership_decided_at: DECLINED_AT,
      membership_decided_by: fx.users.alphaAdmin.userId,
      // Read by the re-open case's probe: it asserts the note SURVIVES being asked back,
      // which is what stops the "erase the record while reversing it" regression.
      membership_note: 'declined by the harness',
    })
    .in('id', declined))

  // Assert it, rather than trusting two UPDATEs to have matched. Getting this wrong in
  // either direction makes the whole suite meaningless and does so silently: everyone
  // approved erases the pending axis, and anyone accidentally pending makes their
  // isolation assertions pass for the wrong reason.
  const statuses = must('verify statuses', await db.from('people')
    .select('id, membership_status').in('id', everyone))
  for (const [key, u] of Object.entries(fx.users)) {
    // The staff accounts have no `people` row, so there is no status to state and none to
    // check. Skipped explicitly rather than by `u.personId &&`, so a person row that failed to
    // seed still trips the assertion below instead of being read as a deliberate omission.
    if (u.noPerson) continue
    const want = u.pending ? 'pending' : u.declined ? 'rejected' : 'approved'
    const got = statuses.find(s => s.id === u.personId)?.membership_status
    if (got !== want) {
      throw new Error(`seed membership_status: ${key} is '${got}', expected '${want}'`)
    }
  }

  // ── GENORRA staff, which is not a family fact and so sits outside the loops ──────────────
  //
  // Three rows, from the `staffRole` on each spec in USERS. `granted_by` is stated per row
  // rather than left null everywhere, because `StaffTeamRow.grantedByEmail` has three different
  // meanings for null and the fixture should exercise both branches:
  //
  //   * the OWNER's own row carries null — the bootstrap shape, a row
  //     `supabase/scripts/grant_staff.sql` wrote before this screen existed;
  //   * the other two carry the owner's `auth.users` id, so `listStaffTeam` has a real address
  //     to resolve through the admin API and its `emailsFor` lookup is actually exercised.
  //
  // `genorra_staff` is service-role-only by construction — RLS is ENABLED with ZERO policies —
  // so this insert works for the reason every other write in this file does, and no user client
  // could perform it at all. That is the property STAFF_CASES is about.
  const staffRows = Object.values(fx.users).filter(u => u.staffRole)
  must('genorra staff', await db.from('genorra_staff').insert(staffRows.map(u => ({
    user_id: u.userId,
    role: u.staffRole,
    note: `seeded by the RLS harness as ${u.staffRole}`,
    granted_by: u.staffRole === 'owner' ? null : fx.users.staffOwner.userId,
  }))))

  // Asserted, for the reason the membership-status block above is asserted: every STAFF_CASES
  // control runs as `staffOwner` and every attack half rests on `staffSupport` being staff but
  // NOT an owner. A fixture that silently seeded the wrong roles would make both halves pass
  // for the wrong reason — the controls because nobody could act, the attacks because the
  // attacker was never staff at all.
  const staffCheck = must('verify staff roles', await db.from('genorra_staff')
    .select('user_id, role').in('user_id', staffRows.map(u => u.userId)))
  for (const u of staffRows) {
    const got = staffCheck.find(s => s.user_id === u.userId)?.role
    if (got !== u.staffRole) {
      throw new Error(`seed genorra_staff: ${u.email} is '${got}', expected '${u.staffRole}'`)
    }
  }
  if (staffCheck.filter(s => s.role === 'owner').length !== 1) {
    throw new Error('seed genorra_staff: expected exactly one owner')
  }

  // ── an administrator in each family: scope 'any' on everything ────────────
  const resources = must('resources', await db.from('permission_resources').select('key'))
  for (const [code, who] of [[ALPHA, 'alphaAdmin'], [BRAVO, 'bravoAdmin'], [CHARLIE, 'charlieAdmin']]) {
    // Upsert, not insert: the families trigger created this template when the family
    // row went in. Claiming it here rather than reading it keeps the harness's
    // description on the row, so it is obvious which one this is.
    const template = must(`${who} template`, await db.from('permission_templates').upsert({
      family_code: code, name: 'Administrators', description: 'seeded by the RLS harness',
    }, { onConflict: 'family_code,name' }).select().single())

    // Still every resource × every action at 'any', stated here and not inherited.
    // The trigger seeds Administrators from permission_resources.actions, which omits
    // create/delete on the two Accounting sections that declare only view+edit — and
    // the attacker of record has to hold everything their own family can confer, or
    // an attack that fails proves the permission layer refused it rather than family
    // isolation. Upsert so the rows the trigger already wrote are not a conflict.
    const grants = []
    for (const { key } of resources) {
      for (const action of ['view', 'create', 'edit', 'delete']) {
        grants.push({ template_id: template.id, resource_key: key, action, scope: 'any' })
      }
    }
    must(`${who} grants`, await db.from('template_permissions')
      .upsert(grants, { onConflict: 'template_id,resource_key,action' }))

    // One column, not a membership row — see the header.
    //
    // THE TRIGGER FIRES; IT DOES NOT RAISE. This comment said "does not fire" and that is
    // the wrong mental model, which matters because the distinction is the whole of Phase
    // 3's third leftover. Triggers are unaffected by RLS and by role, so
    // `people_guard_permission_template` runs for this UPDATE like any other — it simply
    // finds `current_user = 'service_role'` rather than `'authenticated'` and returns. The
    // boundary is around the ROLE, not around the column, and a comment that blurs the two
    // is how the next reader concludes the column is guarded outright.
    // `npm run audit:people` is what keeps that boundary honest on the app side.
    must(`${who} template assignment`, await db.from('people')
      .update({ permission_template_id: template.id })
      .eq('id', fx.users[who].personId))
  }

  // Assert it, for the reason the membership_status block below states: a fixture
  // whose attacker silently ended up on General would make every attack assertion
  // pass because the permission layer refused it, which is the one thing the
  // administrator-as-attacker design exists to rule out.
  for (const who of ['alphaAdmin', 'bravoAdmin', 'charlieAdmin']) {
    const { data: check } = await db.from('people')
      .select('permission_template_id, permission_templates(name)')
      .eq('id', fx.users[who].personId).single()
    const name = check?.permission_templates?.name
    if (name !== 'Administrators') {
      throw new Error(`seed ${who}: template is '${name ?? 'none'}', expected 'Administrators'`)
    }
  }

  const typeRows = must('relationship types', await db.from('relationship_types').select('id, name'))
  const types = Object.fromEntries(typeRows.map(t => [t.name.replace(/\W/g, ''), t.id]))

  // ── one row of every kind, in BOTH families ───────────────────────────────
  // BRAVO gets its own copy so a leak is unambiguous: the attacker legitimately
  // sees BRAVO rows, so a non-empty result is not itself a failure — the test
  // asserts on ALPHA's specific ids.
  for (const [side, code] of [['alpha', ALPHA], ['bravo', BRAVO]]) {
    const owner = side === 'alpha' ? fx.users.alphaMember : fx.users.bravoMember
    const other = side === 'alpha' ? fx.users.alphaOther : fx.users.bravoAdmin
    // The family's ADMINISTRATOR. Note this is NOT `other` — that is `alphaOther` on the
    // ALPHA side and only coincides with the administrator on BRAVO. The board position
    // seeded below goes to this one, which is why that sweep case's control is `alphaAdmin`.
    const familyAdmin = side === 'alpha' ? fx.users.alphaAdmin : fx.users.bravoAdmin
    const f = fx[side]
    f.familyCode = code
    f.ownerPersonId = owner.personId
    f.otherPersonId = other.personId
    // The applicant rows, named so a case can pass ALPHA's ids while calling as BRAVO.
    f.pendingPersonId = side === 'alpha' ? fx.users.alphaPending.personId : fx.users.bravoPending.personId
    if (side === 'alpha') {
      f.applicantPersonId = fx.users.alphaApplicant.personId
      f.rejectablePersonId = fx.users.alphaRejectable.personId
      f.sparePersonId = fx.users.alphaSpare.personId
    }

    // The two seeded templates, so a case can hand BRAVO's administrator one of
    // ALPHA's template ids and watch it be refused.
    const seeded = must(`${code} templates`, await db.from('permission_templates')
      .select('id, name').eq('family_code', code))
    f.adminTemplateId = seeded.find(t => t.name === 'Administrators')?.id ?? null
    f.generalTemplateId = seeded.find(t => t.name === 'General')?.id ?? null
    if (!f.adminTemplateId || !f.generalTemplateId) {
      throw new Error(`seed ${code}: the families trigger did not seed both templates`)
    }

    // A CHAPTER IN EACH FAMILY. Seeded for the `people.chapter_id` cases: that column
    // is `REFERENCES chapters(id)`, which constrains existence and not ownership, so
    // every action writing it owes the §4 reference check and the suite needs a real
    // foreign id to hand them. Before this the fixture had none, and
    // `announcements.getChapters` was carrying `positive: 'not-applicable'` saying so.
    // A REGION IN EACH FAMILY, and the chapter below sits in it. Seeded 2026-08-18, when
    // 20260817000008 gave `dues_schedules` a `region_id` and `chapter_id`: those are two more
    // ids a caller can supply, so the §4 cases need a real foreign one to hand across the
    // family boundary. It is also what makes `deleteRegion`'s control meaningful — a region
    // with a chapter in it is the case where the delete SUCCEEDS and the chapter moves to
    // National, which is the one reference in `lib/scope-attached.ts` that permits a delete.
    f.region = must('region', await db.from('regions').insert({
      family_code: code, name: `${code} region`,
    }).select().single())

    f.chapter = must('chapter', await db.from('chapters').insert({
      family_code: code, name: `${code} chapter`, region_id: f.region.id,
    }).select().single())

    // A SECOND REGION, with nothing in it, so a control that DELETES one does not remove a
    // row every case after it depends on. Same reason `deletableChild` exists, and AGENTS.md
    // §7 names this failure mode explicitly: a positive control that mutates a row a later
    // case reads turns a real finding into a pass.
    f.deletableRegion = must('deletable region', await db.from('regions').insert({
      family_code: code, name: `${code} spare region`,
    }).select().single())

    // AND A SECOND CHAPTER, empty, for the same reason on the chapter side.
    f.deletableChapter = must('deletable chapter', await db.from('chapters').insert({
      family_code: code, name: `${code} spare chapter`,
    }).select().single())

    // AND `other` GOES INTO THE FIRST CHAPTER, which is inside the first region. That is
    // what gives the scope rule a positive control: the member with no chapter is under
    // National and must NOT be offered the regional due, and somebody whose chapter is in
    // that region MUST be — one assertion is worthless without the other.
    //
    // `alphaOther`/`bravoOther` rather than the default member, because the personal-info
    // chapter cases null and re-set the default member's `chapter_id` in their own setup and
    // two cases must not depend on each other's order.
    {
      const { error } = await db.from('people')
        .update({ chapter_id: f.chapter.id }).eq('id', other.personId)
      if (error) throw new Error(`seed ${code}: placing other in a chapter: ${error.message}`)
    }

    // A THIRD CHAPTER, WITH SOMEBODY IN IT — the state `lib/scope-attached.ts` exists to
    // refuse a delete over. It gets `f.child` (a recorded person with no account, seeded
    // below) rather than a member, so nothing else in the suite reads the row it occupies:
    // the personal-info chapter cases null and re-set `alphaMember`'s chapter themselves,
    // and pointing this at that row would make two cases depend on each other's order.
    f.occupiedChapter = must('occupied chapter', await db.from('chapters').insert({
      family_code: code, name: `${code} occupied chapter`,
    }).select().single())

    // A SCHEDULE THAT EXISTS TO BE RE-SCOPED, and nothing else reads it. `f.schedule` has a
    // payment against it, so 20260807000001's freeze refuses every term change including the
    // scope — a control pointed there would fail for a reason that is not a bug — and
    // re-scoping `f.optionalSchedule` would silently drop it out of `getMyDuesSummary` for
    // every actor with no chapter, which is most of them. AGENTS.md §7's first fixture
    // failure mode, avoided by giving the case its own row.
    f.scopableSchedule = must('scopable dues schedule', await db.from('dues_schedules').insert({
      family_code: code, label: `${code} scopable dues`, amount_cents: 2500, active: true,
    }).select().single())

    // AND ONE ALREADY SCOPED TO THE REGION, which is what makes that region undeletable.
    // Seeded in that state rather than arranged by a case, because the case asserting it is
    // read-shaped: `lib/scope-attached.ts`'s refusal is a SENTENCE, a before/after probe
    // cannot tell it from the foreign key refusing the same delete, and a read case has no
    // `setup` hook to arrange the world with.
    f.regionalSchedule = must('regional dues schedule', await db.from('dues_schedules').insert({
      family_code: code, label: `${code} regional dues`, amount_cents: 3500, active: true,
      scope: 'regional', region_id: f.region.id,
    }).select().single())

    // A BOARD POSITION, AND SINCE 20260819000004 THAT IS THE ONLY KIND THERE IS.
    //
    // `family_roles` was the hybrid table AGENTS.md warns about — NULL-`family_code` rows
    // seeded by migrations as product data, beside each family's own — and that migration
    // retired the hybrid: the 25 built-ins are gone, `is_global` is DROPPED, and a family
    // starts with no positions and configures its own. So this row is no longer "a CUSTOM
    // position beside the globals", it is simply the family's position.
    //
    // `is_global: false` WAS HERE AND HAD TO GO IN THE SAME COMMIT AS THE DROP. supabase-js
    // sends the key to PostgREST, which answers "Could not find the 'is_global' column of
    // 'family_roles' in the schema cache" — the seed dies before a single case runs, which is
    // what happened the moment that migration was applied locally. A fixture naming a column
    // is a fixture that has to move when the column does.
    //
    // The name stays `${code} Historian` although the reason it needed a prefix has gone:
    // `family_roles_name_key` was `UNIQUE (name)` ACROSS EVERY FAMILY, so two families could
    // not both seed "Historian", and 20260819000004's own header cites this fixture as the
    // standing evidence of it. It is per-family now and a bare 'Historian' would work — kept
    // because the prefix is also what makes the row identifiable as ALPHA's in a probe.
    f.customRole = must('custom role', await db.from('family_roles').insert({
      family_code: code, name: `${code} Historian`, category: 'appointed_position',
      scope: 'national', sort_order: 900,
    }).select().single())

    f.announcement = must('announcement', await db.from('announcements').insert({
      family_code: code, title: `${code} announcement`, body: `secret body ${code}`,
      author_id: owner.personId, pinned: true,
    }).select().single())

    f.document = must('document', await db.from('documents').insert({
      family_code: code, name: `${code} document`, file_path: `${code}/secret.pdf`,
      uploaded_by: owner.personId, category: 'bylaws',
    }).select().single())

    // ── THE EVENT FIXTURE WAS HERE: ELEVEN ROWS ACROSS SEVEN TABLES ────────────────
    // `f.event`, `f.deletableEvent`, `f.eventPhoto`, `f.budgetItem`, `f.deletableBudgetItem`,
    // `f.expense`, `f.rsvp`, `f.eventType`, `f.blueprintItem`, `f.assignment`. Every one of
    // those tables is dropped (20260819000006), so the rows have nowhere to go and the cases
    // that used them are deleted with them.
    //
    // TWO THINGS THEY TAUGHT SURVIVE ELSEWHERE AND ARE WORTH NOT RE-LEARNING. A money case
    // needs a SPARE row with no money on it as well as a funded one, or the guard refuses the
    // attacker first and the case goes green under the mutation it exists to catch — that is
    // why `f.deletableFund`, `f.deletableSchedule` and `f.deletableMilestone` are all still
    // here. And a fixture row whose NAME a marker matches on must not be a substring of an
    // unrelated row's name: `f.eventType` was called `${code} gathering`, which
    // `alphaMarkers()` would have matched inside every Gatherings response.

    // A board position HELD BY THE ADMINISTRATOR — which is why the `raw:user_roles SELECT`
    // sweep case's control is `alphaAdmin` rather than `alphaMember`.
    //
    // IT SEEDS ITS OWN POSITION SINCE 20260819000004, and the change is not cosmetic. This
    // used to read the GLOBAL 'President' row —
    // `.eq('name', 'President').is('family_code', null).single()` — with a comment saying the
    // insert would "fail loudly here rather than the case going green over a missing row" if
    // `seed_global_lookups()` had not run. That was the right design for a hybrid table and it
    // did exactly what it promised: the moment 20260819000004 deleted the 25 built-ins, this
    // line failed with "JSON object requested, multiple (or no) rows returned" and the whole
    // suite stopped at the seed.
    //
    // A family now starts with NO positions and configures its own, so the fixture configures
    // one. The name is prefixed like every other row here, so `user_roles`' subject is
    // identifiably ALPHA's — and it is a SECOND position rather than reusing `f.customRole`
    // for `deletableChild`'s reason: the board-position delete case removes that row, and a
    // `user_roles` row hanging off it would be swept away with it by
    // `user_roles_role_id_fkey`'s ON DELETE CASCADE, silently emptying the table the sweep
    // case asserts about.
    const presidentRole = must('president role', await db.from('family_roles').insert({
      family_code: code, name: `${code} President`, category: 'executive_officer',
      scope: 'national', sort_order: 100,
    }).select().single())
    f.userRole = must('user role', await db.from('user_roles').insert({
      family_code: code, user_id: familyAdmin.userId, role_id: presidentRole.id,
    }).select().single())

    f.collection = must('photo collection', await db.from('photo_collections').insert({
      family_code: code, name: `${code} album`, created_by: owner.personId,
    }).select().single())

    f.photo = must('photo', await db.from('photos').insert({
      collection_id: f.collection.id, family_code: code, uploader_id: owner.personId,
      file_path: `${code}/photo.jpg`, caption: `${code} photo`,
    }).select().single())

    f.room = must('chat room', await db.from('chat_rooms').insert({
      kind: 'family', family_code: code, name: `${code} room`, created_by: owner.userId,
    }).select().single())

    must('chat participant', await db.from('chat_participants').insert([
      { room_id: f.room.id, user_id: owner.userId },
      { room_id: f.room.id, user_id: other.userId },
    ]))

    f.message = must('chat message', await db.from('chat_messages').insert({
      room_id: f.room.id, sender_id: owner.userId, body: `confidential ${code} message`,
    }).select().single())

    // ── A GROUP ROOM, FOR addGroupMember / removeGroupMember ────────────────────────
    // `f.room` above is `kind: 'family'` and those two actions demand `kind: 'group'`, so
    // without this the cases for them would be refused by the KIND filter and prove nothing
    // about the family conjunct they exist to pin. Created by the same `owner`, which is what
    // makes the positive control possible: both actions require `created_by = auth.uid()`.
    f.groupRoom = must('chat group room', await db.from('chat_rooms').insert({
      kind: 'group', family_code: code, name: `${code} group`, created_by: owner.userId,
    }).select().single())

    must('chat group participant', await db.from('chat_participants').insert([
      { room_id: f.groupRoom.id, user_id: owner.userId },
    ]))

    f.schedule = must('dues schedule', await db.from('dues_schedules').insert({
      family_code: code, label: `${code} dues`, amount_cents: 5000, active: true,
    }).select().single())

    // recorded_by is REQUIRED on insert since 20260807000002 — a manually recorded
    // payment must name who recorded it, and the trigger enforces that against the
    // service role this fixture writes through. Without it the whole suite dies here.
    // An OPTIONAL due, so setMyDuesOptOut has something it is actually allowed to
    // decline. The schedule above is required (the column defaults to true), and opting
    // out of a required due is refused by 20260807000003 — so a case pointed at it would
    // pass its isolation assertion for the wrong reason.
    f.optionalSchedule = must('optional dues schedule', await db.from('dues_schedules').insert({
      family_code: code, label: `${code} optional dues`, amount_cents: 1500,
      required: false, active: true,
    }).select().single())

    f.payment = must('dues payment', await db.from('dues_payments').insert({
      family_code: code, person_id: owner.personId, schedule_id: f.schedule.id,
      amount_cents: 5000, status: 'paid', payment_date: '2026-07-01',
      recorded_by: owner.personId,
    }).select().single())

    // A SCHEDULE WITH NO MONEY AGAINST IT, so `deleteDuesSchedule` has a subject it is
    // allowed to remove. `f.schedule` has the payment above and is therefore permanently
    // undeletable, and every other schedule here is read by a case that would then be
    // asserting over a row that had gone — `deletableChild`'s rule again.
    //
    // `active: false` on purpose. Nothing about the delete path reads the column, and an
    // inactive row stays out of `getMyDuesSummary` and `getDuesProjection`, both of which
    // filter on it — so adding this cannot move a figure another case asserts.
    f.deletableSchedule = must('deletable dues schedule', await db.from('dues_schedules').insert({
      family_code: code, label: `${code} spare dues`, amount_cents: 1000, active: false,
    }).select().single())

    // ── A drive the family's ADMINISTRATOR is the beneficiary of ──────────────
    // The surprise-gift case from 20260811000000, and the actor is the administrator
    // on purpose. They hold scope 'any' on every resource their family can confer, so
    // a drive they still cannot see is a claim about the RESTRICTIVE policies and
    // nothing else. Seeded against a member with no grants, the same assertion would
    // pass whether or not those policies existed.
    f.hiddenDonation = must('beneficiary-hidden donation', await db.from('dues_schedules').insert({
      family_code: code, label: `${code} secret gift`, amount_cents: 0,
      kind: 'donation', goal_cents: 200000, required: false, frequency: 'one-time',
      active: true,
    }).select().single())

    must('donation beneficiary', await db.from('donation_beneficiaries').insert({
      family_code: code, schedule_id: f.hiddenDonation.id, person_id: familyAdmin.personId,
    }).select().single())

    // A gift to it, so the payment and fund-contribution exclusions have a row to hide
    // and not merely a drive. Without this the two policies below the schedule one
    // would be asserted against an empty set and prove nothing.
    f.hiddenDonationPayment = must('gift to the hidden drive', await db.from('dues_payments').insert({
      family_code: code, person_id: owner.personId, schedule_id: f.hiddenDonation.id,
      amount_cents: 25000, status: 'paid', payment_date: '2026-07-04',
      recorded_by: owner.personId,
    }).select().single())

    // The owner's own enrolment — what clearMyDuesPlan must not be able to destroy
    // from another family.
    f.plan = must('dues plan', await db.from('dues_member_plans').insert({
      family_code: code, person_id: owner.personId, schedule_id: f.schedule.id,
      cadence: 'monthly', created_by: owner.personId,
    }).select().single())

    f.fund = must('fund', await db.from('funds').insert({
      family_code: code, name: `${code} fund`, goal_cents: 100000,
      created_by: owner.personId, active: true,
    }).select().single())

    f.milestone = must('milestone', await db.from('fund_milestones').insert({
      fund_id: f.fund.id, family_code: code, name: `${code} milestone`, amount_cents: 25000,
    }).select().single())

    // A SECOND MILESTONE THAT NOTHING HAS BEEN PAID AGAINST, for `deleteMilestone`'s
    // control. `f.milestone` is what the disbursement below is attributed to, so the guard
    // refuses that one for good — this is the row that proves the action can still delete.
    f.deletableMilestone = must('deletable milestone', await db.from('fund_milestones').insert({
      fund_id: f.fund.id, family_code: code, name: `${code} spare milestone`,
      amount_cents: 5000, sort_order: 2,
    }).select().single())

    f.contribution = must('contribution', await db.from('fund_contributions').insert({
      fund_id: f.fund.id, family_code: code, amount_cents: 7500,
      contributor_person_id: owner.personId, recorded_by: owner.personId,
      contributed_date: '2026-07-02',
    }).select().single())

    // `milestone_id` ADDED 2026-08-18, and it is what gives `f.milestone` money against it
    // — `moneyAttachedTo('fund_milestone', …)` counts disbursements by this column and
    // nothing else in the fixture wrote it. Attributing the EXISTING payout rather than
    // seeding a second one is deliberate: the amount is load-bearing further down (see the
    // note on `f.transfer`), and another disbursement would move the fund's balance and
    // break `transferBetweenFunds`'s control for a reason that is not a bug.
    //
    // fund_disbursements is APPEND-ONLY (20260807000002) and permits no UPDATE at all, so
    // this has to be set at insert. A case cannot arrange it in `setup`.
    f.disbursement = must('disbursement', await db.from('fund_disbursements').insert({
      fund_id: f.fund.id, family_code: code, person_id: owner.personId,
      milestone_id: f.milestone.id,
      amount_cents: 2500, disbursed_date: '2026-07-03', recorded_by: owner.personId,
    }).select().single())

    f.allocation = must('allocation', await db.from('fund_allocations').insert({
      family_code: code, fund_id: f.fund.id, basis_points: 10000, created_by: owner.personId,
    }).select().single())

    // A SECOND FUND, and it exists only so there is somewhere to transfer TO. It takes
    // no share of dues — fund_allocations gives 100% to f.fund above, and a fund with
    // no allocation row is 0% — so adding it changes nothing about routing.
    f.secondFund = must('second fund', await db.from('funds').insert({
      family_code: code, name: `${code} second fund`,
      created_by: owner.personId, active: true,
    }).select().single())

    // THE AMOUNT IS LOAD-BEARING, small as it is. The fund holds 7500 contributed less
    // 2500 disbursed; moving 2000 leaves it at 3000, which is what lets the write case
    // for transferBetweenFunds have a positive control at all — that action refuses to
    // move money a fund does not have, so a fixture transfer large enough to empty the
    // source would make the control fail for a reason that is not a bug.
    f.transfer = must('fund transfer', await db.from('fund_transfers').insert({
      family_code: code, from_fund_id: f.fund.id, to_fund_id: f.secondFund.id,
      amount_cents: 2000, transferred_date: '2026-07-05',
      reason: `${code} transfer`, recorded_by: owner.personId,
    }).select().single())

    // A THIRD FUND WITH NO MONEY OF ANY KIND, for `deleteFund`'s control — and it has to be
    // a third, because `f.fund` and `f.secondFund` are both ends of the transfer above and
    // `moneyAttachedTo('fund', …)` counts a transfer from EITHER side.
    //
    // NO ALLOCATION ROW, deliberately: `fund_allocations` is UNIQUE (family_code, fund_id)
    // and gives 100% to `f.fund`, and a fund with no row is 0%, so this changes nothing
    // about dues routing. NO `system_key` either — `funds_protect_system` (20260807000003)
    // makes such a fund permanently undeletable while its family exists, which would make
    // the control fail for a reason that is not the guard.
    f.deletableFund = must('deletable fund', await db.from('funds').insert({
      family_code: code, name: `${code} spare fund`,
      created_by: owner.personId, active: true,
    }).select().single())

    // ── ELECTIONS RUN ON DATES NOW, SO THE FIXTURE HAS TO STATE THEM ──────────────
    // 20260821000001 replaced the four-state `status` machine with `draft | published` plus
    // four DATE windows, and the two INSERT policies test `election_window_open()` — which
    // reads CURRENT_DATE — rather than a stored word. So `status: 'voting'` is not a state
    // any more, it is a window that has to contain today.
    //
    // COMPUTED FROM `inDays`, NOT LITERALS, and that is forced rather than tidy: a fixed
    // date would put this suite's whole nominations half outside its window on some future
    // afternoon, and the failure would be every write case going green over an action that
    // refuses everybody. `inDays` already exists here for the dues schedules.
    //
    // The constraint chain is `nominations_close_on > nominations_open_on`,
    // `voting_open_on > nominations_close_on`, `voting_close_on > voting_open_on`, so the
    // two elections below are laid out to satisfy it with today inside the intended window.

    // NATIONAL, and currently VOTING. National on purpose: most cases here use `alphaMember`
    // as the positive control and that actor is in NO CHAPTER (see the note above `other`'s
    // chapter placement), so a scoped election would fail every control for an area reason
    // rather than an isolation one. `f.chapterElection` below is where the area rule is
    // tested deliberately.
    f.election = must('election', await db.from('elections').insert({
      family_code: code, title: `${code} election`, status: 'published',
      nominations_open_on: inDays(-20), nominations_close_on: inDays(-10),
      voting_open_on: inDays(-5), voting_close_on: inDays(25),
      created_by: owner.personId,
    }).select().single())

    f.position = must('election position', await db.from('election_positions').insert({
      election_id: f.election.id, title: 'President', max_winners: 1,
    }).select().single())

    f.nomination = must('nomination', await db.from('election_nominations').insert({
      election_id: f.election.id, position_id: f.position.id,
      nominee_id: other.personId, nominated_by: owner.personId, accepted: true,
    }).select().single())

    f.vote = must('vote', await db.from('election_votes').insert({
      election_id: f.election.id, position_id: f.position.id,
      voter_id: owner.personId, nominee_id: other.personId,
    }).select().single())

    // A second election whose NOMINATIONS window contains today. The INSERT policy on
    // election_nominations requires `election_window_open(election_id, 'nominations')`, so
    // submitNomination cannot be exercised against the voting election above — it would be
    // refused for a reason unrelated to family isolation.
    f.nominationElection = must('nomination election', await db.from('elections').insert({
      family_code: code, title: `${code} nomination election`, status: 'published',
      nominations_open_on: inDays(-2), nominations_close_on: inDays(10),
      voting_open_on: inDays(15), voting_close_on: inDays(25),
      created_by: owner.personId,
    }).select().single())

    f.nominationPosition = must('nomination position', await db.from('election_positions').insert({
      election_id: f.nominationElection.id, title: 'Secretary', max_winners: 1,
    }).select().single())

    // ── FIVE MORE OFFICES ON THAT ELECTION, ONE PER RETRACTION CASE ────────────────
    // `retractNomination`'s positive control DELETES a supporter row, and the last supporter
    // leaving takes the candidacy with it (`election_nomination_supporters_drop_orphan`,
    // 20260821000004 §3b). So the retraction cases cannot share one row: that is AGENTS.md
    // §7's warning about "a case whose positive control mutates a row a later case depends
    // on", and `deletableChild` is the precedent for giving each its own.
    //
    // THEY ARE SEPARATE OFFICES RATHER THAN SEPARATE NOMINATIONS, because
    // UNIQUE (election_id, position_id, nominee_id) is exactly the thing that forbids three
    // nominations of one person for one office — which is the constraint the supporters table
    // exists to work around, so the fixture cannot pretend otherwise.
    //
    // NO SUPPORTER ROWS ARE INSERTED HERE. `election_nominations_seed_supporter` writes one
    // from `nominated_by` on every insert, service role included, so the fixture states the
    // nominator once and the supporter row follows. A fixture that wrote both by hand would
    // pass with that trigger deleted, which is the whole thing the migration's §9 is about.
    const nominateOn = async (title, nomineeId, accepted) => {
      const position = must(`position ${title}`, await db.from('election_positions').insert({
        election_id: f.nominationElection.id, title, max_winners: 1,
      }).select().single())
      const nomination = must(`nomination for ${title}`,
        await db.from('election_nominations').insert({
          election_id: f.nominationElection.id, position_id: position.id,
          nominee_id: nomineeId, nominated_by: owner.personId, accepted,
        }).select().single())
      return { position, nomination }
    }

    // Three interchangeable candidacies, `owner` the nominator and `other` the nominee, each
    // consumed by one retraction case's control.
    f.retractCross   = await nominateOn('Treasurer', other.personId, null)
    f.retractOutsider = await nominateOn('Historian', other.personId, null)
    f.retractPending = await nominateOn('Parliamentarian', other.personId, null)

    // ACCEPTED, which is what blocks the nominator from retracting it — and, on the SAME
    // office, `owner`'s own accepted self-nomination, which the carve-out says they may still
    // withdraw. Two nominees on one position, so the unique constraint is satisfied and the
    // attack and the control differ in exactly one thing: whether the caller is the nominee.
    f.retractAccepted = await nominateOn('Chaplain', other.personId, true)
    f.retractOwnSelf = must('self nomination', await db.from('election_nominations').insert({
      election_id: f.nominationElection.id, position_id: f.retractAccepted.position.id,
      nominee_id: owner.personId, nominated_by: owner.personId, accepted: true,
    }).select().single())

    // A candidacy for the SECOND-NOMINATOR path: `submitNomination` turns the UNIQUE
    // collision into a supporter row rather than reporting "already nominated". Nominee is
    // `owner` so that `other` can second it without being the nominee themselves.
    f.retractSecond = await nominateOn('Sergeant at Arms', owner.personId, null)

    // And one for the RAW probe, which attacks the DELETE policy's `person_id` pin directly.
    // Its own row for the same reason as the four above: the raw case's positive control
    // deletes the supporter row and the candidacy goes with it.
    f.retractRaw = await nominateOn('Recording Secretary', other.personId, null)

    // ── AND ONE ON THE ELECTION WHOSE NOMINATIONS HAVE CLOSED ─────────────────────
    // `f.election`'s nominations closed ten days ago and its poll is open now, so this is the
    // only row in the fixture the DELETE policy's window conjunct can be tested against.
    //
    // IT IS DELIBERATELY *NOT ACCEPTED*, and that is the whole point of it existing beside
    // `f.nomination`, which is. Found by a mutation: aiming the case at `f.nomination` passed
    // with the window conjunct deleted, because that row is accepted and nominated by
    // somebody who is not the nominee — so the ACCEPTANCE conjunct was refusing it and the
    // window was never consulted. A case has to be refused by ONE thing to be evidence about
    // that thing.
    const closedPosition = must('closed-window position',
      await db.from('election_positions').insert({
        election_id: f.election.id, title: 'Assistant Treasurer', max_winners: 1,
      }).select().single())
    f.retractClosed = must('closed-window nomination',
      await db.from('election_nominations').insert({
        election_id: f.election.id, position_id: closedPosition.id,
        nominee_id: other.personId, nominated_by: owner.personId, accepted: null,
      }).select().single())

    // ── AND ONE SCOPED TO A CHAPTER, WHICH IS WHAT MAKES THE AREA RULE TESTABLE ────
    // The area boundary is a rule INSIDE one family, and this suite's attack is normally
    // cross-family — so it needs an attacker and a control who are both in ALPHA and differ
    // only in where they are filed. The fixture already provides exactly that pair:
    //
    //   `other`  (alphaOther)  is in `f.chapter`     -> the positive control
    //   `owner`  (alphaMember) is in NO chapter      -> under National, and so the attacker
    //
    // `bravoAdmin` still cannot reach it either, and the cross-family cases cover that; what
    // these rows add is the assertion that a chapter election is invisible to the rest of its
    // OWN family. Nominations are open on it, so a nominee list can be asserted too.
    f.chapterElection = must('chapter election', await db.from('elections').insert({
      family_code: code, title: `${code} chapter election`, status: 'published',
      scope: 'chapter', chapter_id: f.chapter.id,
      nominations_open_on: inDays(-2), nominations_close_on: inDays(10),
      voting_open_on: inDays(15), voting_close_on: inDays(25),
      created_by: owner.personId,
    }).select().single())

    f.chapterPosition = must('chapter election position', await db.from('election_positions').insert({
      election_id: f.chapterElection.id, title: 'Chapter Chair', max_winners: 1,
    }).select().single())

    // A DRAFT, so `publishElection` and `updateElection` have something to be exercised on.
    // All four windows are set and ordered, because `elections_published_has_windows` refuses
    // to publish without them and a publish case that failed on a missing date would be
    // asserting the constraint rather than the family boundary.
    f.draftElection = must('draft election', await db.from('elections').insert({
      family_code: code, title: `${code} draft election`, status: 'draft',
      nominations_open_on: inDays(5), nominations_close_on: inDays(15),
      voting_open_on: inDays(20), voting_close_on: inDays(30),
      created_by: owner.personId,
    }).select().single())

    f.draftPosition = must('draft election position', await db.from('election_positions').insert({
      election_id: f.draftElection.id, title: 'Treasurer', max_winners: 1,
    }).select().single())

    // A SECOND DRAFT, for `updateElection`, and it has to be its own row — `publishElection`'s
    // positive control runs first and publishes the one above, after which `updateElection`
    // refuses it and its control fails with "owner's own write did nothing". Same shape, and
    // the same reason, as `deletableChild` and `deletableFund`: a control that mutates a row a
    // later case depends on turns that case's attack assertion into decoration.
    f.editableElection = must('editable election', await db.from('elections').insert({
      family_code: code, title: `${code} editable election`, status: 'draft',
      nominations_open_on: inDays(5), nominations_close_on: inDays(15),
      voting_open_on: inDays(20), voting_close_on: inDays(30),
      created_by: owner.personId,
    }).select().single())

    // Two notifications: one for the owner, one for the other member. The second
    // is what makes the within-family ownership test possible.
    f.notification = must('notification', await db.from('notifications').insert({
      family_code: code, recipient_id: owner.personId, type: 'test',
      title: `${code} notification`, body: `private ${code} note`,
    }).select().single())

    f.otherNotification = must('other notification', await db.from('notifications').insert({
      family_code: code, recipient_id: other.personId, type: 'test',
      title: `${code} notification for other`, body: `private ${code} note 2`,
    }).select().single())

    // ── relatives + relationships ───────────────────────────────────────────
    // People with NO ACCOUNT, attached to `owner`. The tree is built out of these and
    // `editPersonRecord` / `invitePersonRecord` are defined over exactly them, so a
    // fixture without any would let both of those pass while touching nothing.
    //
    // THEY WERE `child` ROWS WITH `is_minor: true` until 2026-08-13. The column went in
    // 20260813000006 and the concept went with it — a child is a person nobody has
    // claimed yet, which is what `user_id IS NULL` already said. The names are kept so
    // the diff stays readable; what they now fixture is "a record", not "a minor".
    //
    // The birthday stays and is load-bearing in a new way: `computeIsMinor` derives from
    // it now, so a row with no date would make the Directory's Minor badge untestable.
    f.child = must('child', await db.from('people').insert({
      family_code: code, first_name: `${code}Child`, last_name: code,
      date_of_birth: '2015-04-04', created_by: familyAdmin.userId,
      // IN THE OCCUPIED CHAPTER, which is what makes that chapter undeletable — the state
      // `admin/chapters.deleteChapter (a chapter somebody is in)` asserts. Set here rather
      // than by an UPDATE afterwards because `people.chapter_id` has no trigger overriding
      // it, unlike `membership_status`.
      chapter_id: f.occupiedChapter.id,
    }).select().single())

    // A SECOND ONE, so a destructive positive control has its own row to ruin. Without it
    // a control that deletes or rewrites `child` pulls the ground out from under every
    // later case, and those cases then "pass" against a row that is no longer what they
    // think it is — a vacuous green that hides a real finding.
    f.deletableChild = must('deletable child', await db.from('people').insert({
      family_code: code, first_name: `${code}SpareChild`, last_name: code,
      date_of_birth: '2016-05-05', created_by: familyAdmin.userId,
    }).select().single())

    f.ancestor = must('ancestor', await db.from('people').insert({
      family_code: code, first_name: `${code}Father`, last_name: code,
      date_of_birth: '1950-02-02',
    }).select().single())

    // ── two more records, for the three states on Dues Projections ───────────
    // That screen counts EVERY approved person, account or not, and reports each as Active,
    // Invited or Pending Invite. Two of those three are states a record can hold, and they
    // need a row each — `deletableChild`'s reason, applied to a read rather than a write:
    // borrowing `child` would tie this case to whatever `invitePersonRecord`'s attack half
    // left behind, and borrowing `ancestor` would tie it to `linkPersonToCurrentUser`'s.
    //
    // DELIBERATELY UNATTACHED to the tree. They are about the roster, not about the graph,
    // and giving them edges would move `leafIds` for every family-tree case to buy nothing.
    f.invitedRecord = must('invited record', await db.from('people').insert({
      family_code: code, first_name: `${code}Invited`, last_name: code,
      date_of_birth: '1970-03-03', created_by: familyAdmin.userId,
      primary_email: `invited.record.${side}@rls.test`,
    }).select().single())

    f.uninvitedRecord = must('uninvited record', await db.from('people').insert({
      family_code: code, first_name: `${code}Uninvited`, last_name: code,
      date_of_birth: '1971-04-04', created_by: familyAdmin.userId,
      // A REAL ADDRESS ON A ROW NOBODY HAS ASKED, which is what makes the attack half of
      // `dues.getDuesProjection` sharp: ALPHA seeds an open invitation to BRAVO's address
      // below, so a projection that read invitations without `.eq('family_code', …)` would
      // report this person as Invited in the family that never asked them.
      primary_email: `uninvited.record.${side}@rls.test`,
    }).select().single())

    // ── THREE BIRTHDAYS INSIDE THE 60-DAY HORIZON, one per thing that decides the pane ─────
    //
    // `announcements.getUpcomingBirthdays` (20260819000002) applies three conjuncts and then
    // hands what survives to `lib/birthdays.ts`. Two of them can only be tested by a row that
    // WOULD be listed but for that conjunct, which is why these exist rather than the case
    // borrowing `f.child` or `f.ancestor`: every hard-coded birthday in this fixture is months
    // away, so a case built on one would assert about an empty list (AGENTS.md §7).
    //
    //   f.birthdayPerson        the row that MUST be listed. Living, approved, +10 days.
    //   f.sunsetBirthdayPerson  the row that must NOT be, and the conjunct the action's own
    //                           header calls "the single most important line in this function":
    //                           `sunset_date IS NULL`. A great-uncle who died in 1998 is an
    //                           ordinary `people` row with an ordinary birthday (AGENTS.md
    //                           §4b), and `lib/birthdays.ts` deliberately does not know about
    //                           the column — so if the FETCH stops withholding him, the pane
    //                           says "12 days away, turning 91" about a dead man and nothing
    //                           else in the stack objects.
    //   the family's APPLICANT  the third conjunct, `membership_status = 'approved'`, given a
    //                           birthday below rather than a row of its own — see there.
    //
    // BOTH ARE ACCOUNT-LESS RECORDS, which is also the §4b decision being asserted: the pane
    // counts every approved PERSON and not only every ACCOUNT, because a grandmother who never
    // registered has a birthday exactly as much as her son who signed in this morning. A
    // fixture that gave these rows accounts would let an accounts-only filter creep back in
    // with every case still green.
    //
    // The stamp trigger returns early for `user_id IS NULL`, so both keep the column default
    // 'approved' and neither needs the explicit UPDATE the members above do.
    f.birthdayPerson = must('birthday person', await db.from('people').insert({
      family_code: code, first_name: `${code}Birthday`, last_name: code,
      date_of_birth: BIRTHDAY_SOON, created_by: familyAdmin.userId,
    }).select().single())

    f.sunsetBirthdayPerson = must('sunset birthday person', await db.from('people').insert({
      family_code: code, first_name: `${code}Departed`, last_name: code,
      date_of_birth: SUNSET_BIRTHDAY_SOON, sunset_date: SUNSET_DATE,
      created_by: familyAdmin.userId,
    }).select().single())

    // AND A BIRTHDAY ON THE FAMILY'S UNADMITTED APPLICANT, which is an UPDATE to an existing
    // actor rather than a new row, deliberately, and the reason is a count:
    // `getPendingApprovalCount` asserts EXACTLY 3 pending in ALPHA and 1 in BRAVO, so a fourth
    // pending row would break two cases that have nothing to do with birthdays. Adding a date
    // to a row that is already counted changes no count at all.
    //
    // `pendingPersonId` and not `applicantPersonId`/`rejectablePersonId`: those two are
    // CONSUMED by `approveApplicant`'s and `rejectApplicant`'s controls, and an approved one
    // would then legitimately appear on the pane — making the assertion depend on which cases
    // had already run. The header promises `alphaPending` stays pending for the life of the run,
    // which is the only guarantee that makes this stable.
    //
    // The cost is stated where it lands: that person's id is deliberately NOT in
    // `alphaMarkers()` (they are an attacking actor and RLS correctly lets them read their own
    // row), so the exclusion is asserted BY ID in the case's `expectPositive` rather than by the
    // marker scan.
    {
      const { error } = await db.from('people')
        .update({ date_of_birth: BIRTHDAY_SOON }).eq('id', f.pendingPersonId)
      if (error) throw new Error(`seed ${code}: applicant birthday: ${error.message}`)
    }

    const rels = must('relationships', await db.from('person_relationships').insert([
      { person_id: owner.personId, related_person_id: other.personId,
        relationship_type_id: types.Wife, family_code: code, is_step: false,
        created_by: owner.userId },
      // Matches the child row's creator, for the same reason.
      { person_id: owner.personId, related_person_id: f.child.id,
        relationship_type_id: types.Son, family_code: code, is_step: false,
        created_by: familyAdmin.userId },
      { person_id: owner.personId, related_person_id: f.deletableChild.id,
        relationship_type_id: types.Son, family_code: code, is_step: false,
        created_by: familyAdmin.userId },
      { person_id: owner.personId, related_person_id: f.ancestor.id,
        relationship_type_id: types.Father, family_code: code, is_step: false,
        created_by: owner.userId },
    ]).select())

    // ── invitations ─────────────────────────────────────────────────────────
    // TWO of them, for deletableChild's reason: revokeInvitation's positive control
    // really does revoke one, so the case that reads the list must not be looking at
    // the row another case consumed.
    f.invitation = must('invitation', await db.from('family_invitations').insert({
      family_code: code,
      email: `invited.${side}@rls.test`,
      first_name: 'Invited', last_name: 'Person',
      token_hash: tokenHash(`rls-invite-token-${code}`),
      pre_approved: true,
      invited_by: familyAdmin.personId,
    }).select().single())

    f.revocableInvitation = must('revocable invitation', await db.from('family_invitations').insert({
      family_code: code,
      email: `revocable.${side}@rls.test`,
      first_name: 'Revocable', last_name: 'Person',
      token_hash: tokenHash(`rls-revocable-token-${code}`),
      pre_approved: false,
      invited_by: familyAdmin.personId,
    }).select().single())

    // A FOURTH, and the only one that NAMES A PERSON — `invited_person_id`, which is what
    // `invitePersonRecord` writes (20260813000004). Every other invitation here is addressed
    // to somebody with no `people` row at all, so without this the 'invited' state on Dues
    // Projections would be unreachable and its case could not tell it from 'pending-invite'.
    f.recordInvitation = must('record invitation', await db.from('family_invitations').insert({
      family_code: code,
      email: `invited.record.${side}@rls.test`,
      first_name: `${code}Invited`, last_name: code,
      token_hash: tokenHash(`rls-record-invite-token-${code}`),
      pre_approved: false,
      invited_by: familyAdmin.personId,
      invited_person_id: f.invitedRecord.id,
    }).select().single())

    // A THIRD one, ALPHA only, addressed to somebody who actually has an account —
    // see `outsideInvitee` in USERS. Both other invitations name addresses with no
    // auth.users row, which is why redeemInvitation has never had a positive control
    // and has been carrying `positive: 'not-applicable'` instead.
    //
    // pre_approved: false deliberately. The conjunct under test is the EMAIL binding,
    // and a pre-approved invitation would additionally flip the new row to 'approved',
    // putting a second mechanism inside the assertion for no gain.
    if (side === 'alpha') {
      f.outsideInvitation = must('outside invitation', await db.from('family_invitations').insert({
        family_code: code,
        email: 'outside.invitee@rls.test',
        first_name: 'Outside', last_name: 'Invitee',
        token_hash: tokenHash(`rls-outside-invite-token-${code}`),
        pre_approved: false,
        invited_by: familyAdmin.personId,
      }).select().single())

      // ── the two re-invitation tokens (20260811000001) ────────────────────
      //
      // ONE OPEN INVITATION PER ADDRESS. family_invitations_open_uniq is a UNIQUE index
      // on (family_code, email) WHERE accepted_at IS NULL AND revoked_at IS NULL, so two
      // open rows for one address raise 23505 and the whole seed throws before a single
      // case runs. Hence two addresses, one invitation each.
      //
      // pre_approved: TRUE, deliberately. The property under test is that a re-open
      // IGNORES pre-approval and lands the person back in the queue — an invitation that
      // asked for nothing could not tell that apart from the clamp being deleted.
      f.reopenInvitation = must('reopen invitation', await db.from('family_invitations').insert({
        family_code: code,
        email: fx.users.alphaDeclinedBack.email,
        first_name: 'Declined', last_name: 'Back',
        token_hash: tokenHash(`rls-reopen-token-${code}`),
        pre_approved: true,
        invited_by: familyAdmin.personId,
      }).select().single())

      // Its own invitation for resendInvitation to re-mint, addressed to somebody with no
      // account and no people row. Separate from the two above for `deletableChild`'s
      // reason twice over: a resend REVOKES the row it resends and inserts a replacement,
      // so pointing it at f.invitation would break the peek case (which needs that token
      // valid) and at f.revocableInvitation would collide with the revoke case.
      f.resendInvitation = must('resend invitation', await db.from('family_invitations').insert({
        family_code: code,
        email: 'resend.alpha@rls.test',
        first_name: 'Resend', last_name: 'Target',
        token_hash: tokenHash(`rls-resend-token-${code}`),
        pre_approved: false,
        invited_by: familyAdmin.personId,
      }).select().single())

      // ONE FAMILY'S INVITATION TO THE OTHER FAMILY'S ADDRESS, which is legal and ordinary:
      // two families can both know somebody, and `create_family_invitation` puts no
      // constraint between the address and anybody's `people` row. It is the detector for
      // the `.eq('family_code', …)` on the invitations read in `getDuesProjection` — without
      // it, BRAVO's projection reports BRAVOTESTUninvited as Invited on the strength of a row
      // ALPHA wrote.
      //
      // `invited_person_id` is deliberately NULL. The id branch could not reach across
      // families through the app anyway — the RPC checks the row is in the target family — so
      // seeding one would test a row the product cannot produce. The ADDRESS branch can.
      f.crossFamilyInvitation = must('cross-family invitation', await db.from('family_invitations').insert({
        family_code: code,
        email: 'uninvited.record.bravo@rls.test',
        first_name: 'Uninvited', last_name: 'Record',
        token_hash: tokenHash(`rls-cross-family-invite-token-${code}`),
        pre_approved: false,
        invited_by: familyAdmin.personId,
      }).select().single())

      // Minted BEFORE the refusal it would reverse, which is the sequence a hostile
      // review used to refute the first draft of this change. created_at is set
      // explicitly; expires_at is left to its default (NOW() + 14 days, NOT
      // created_at + 14 days), so this row is stale WITHOUT being expired — otherwise the
      // case would pass on the expiry branch and prove nothing about the guard.
      f.staleInvitation = must('stale invitation', await db.from('family_invitations').insert({
        family_code: code,
        email: fx.users.alphaDeclinedStale.email,
        first_name: 'Declined', last_name: 'Stale',
        token_hash: tokenHash(`rls-stale-token-${code}`),
        pre_approved: true,
        invited_by: familyAdmin.personId,
        created_at: new Date(Date.parse(DECLINED_AT) - 60 * 60 * 1000).toISOString(),
      }).select().single())
    }

    // -- GATHERINGS (20260819000000) --------------------------------------------
    //
    // "ASSEMBLY", NEVER "GATHERING", in every string here - and it is not a style choice,
    // though the row it was avoiding is gone.
    //
    // `f.eventType` used to be named `${code} gathering`, and `alphaMarkers()` matches on
    // SUBSTRINGS - so a marker of 'ALPHATEST gathering' would have been found in that
    // pre-existing event-type row and reported a leak in a response that never touched this
    // feature. That table is dropped (20260819000006) and the collision cannot happen any
    // more, so this convention is now a GUARD RATHER THAN A FIX: 'gathering' is the one word
    // certain to appear in some unrelated row's free text sooner or later, and a marker that
    // generic is a false positive waiting for a schema. Keep saying "assembly".
    //
    // WHAT EACH ROW IS FOR, because five of the fourteen exist only so a destructive control
    // has its own subject (AGENTS.md 7's first fixture failure mode):
    //
    //   f.template            the family's one template. Two steps of DIFFERENT kinds, which
    //                         is what makes `submitGatheringTask`'s `parseAnswer` branch and
    //                         the budget default both reachable. `who_may_schedule: 'family'`,
    //                         so `getSchedulableTemplates` has something to offer a member.
    //   f.templateStep1/2     'text' (required) and 'money' (with a suggested line).
    //   f.deletableStep       a third step, on `f.template`, for `deleteTemplateStep`. On the
    //                         MAIN template deliberately: `f.deletableTemplate` is deleted by
    //                         its own control, and a step living there would vanish with it.
    //   f.deletableTemplate   a template with NO `gathering_template_uses` row, which is the
    //                         only kind `deleteGatheringTemplate` will remove. `'admin'`, so
    //                         both `who_may_schedule` branches are represented.
    //   f.deletableTemplateStep  one step on it, so `addGatheringTemplate` instantiates real
    //                         work rather than linking an empty template.
    //   f.gathering           the family's gathering. PREMIER and FUTURE, because
    //                         `getPremierGathering` filters on both; a fund and a budget,
    //                         because `gatherings/budget` and `setGatheringBudget` need them.
    //   f.deletableGathering  no fund, no budget, no tasks - `deleteGathering`'s subject, and
    //                         the one the add/remove-template cases link and unlink.
    //   f.templateUse         the junction row `getGatheringDetail` groups the task list by.
    //   f.assignedTask        assigned to `owner` and left 'open' for the whole run: it is
    //                         the subject of every READ control, so no write case may touch
    //                         it. `submitGatheringTask` gets `f.submittableTask` instead.
    //   f.unassignedTask      the one nobody holds - `assignGatheringTask`'s subject, and the
    //                         one `setGatheringTaskBudget` moves.
    //   f.submittableTask     assigned to `owner`, 'open', and nothing reads its status.
    //   f.submittedTask       'submitted' with a pending submission behind it, which is what
    //                         `getGatheringReviewQueue` lists and `reviewGatheringTask` rules
    //                         on. Its own row because that control moves it off 'submitted'.
    //   f.submission          that pending submission. Its `answer` is `{ items: [...] }`,
    //                         the shape `parseAnswer('list', ...)` produces, so the row is one
    //                         the product could actually have written.
    //   f.approvedTask        'approved', with `decided_at`/`decided_by` set - the ONLY state
    //                         `reopenGatheringTask` accepts, and its own row for exactly the
    //                         reason `f.queuedTask` is: that control moves it OFF 'approved',
    //                         so sharing `f.submittedTask` would make the two decisions race
    //                         (a reopen would leave nothing for a review to rule on, and a
    //                         review would leave nothing for a reopen to take back).
    //   f.approvedSubmission  the approved submission behind it. Kept untouched by a reopen -
    //                         which is the fact its probe is there to assert, because a reopen
    //                         that quietly rewrote the audit trail would look identical on the
    //                         task alone.
    //
    // THE FUND IS `f.fund` AND NEVER `f.deletableFund`. `moneyAttachedTo('fund', ...)` counts
    // gatherings since this migration, so pointing a gathering at the spare fund would make
    // `funds.deleteFund`'s positive control fail - and fail with a message about a gathering,
    // which reads as a bug in the money guard rather than as a fixture collision. `f.fund`
    // already has a transfer against it and is undeletable for good.
    f.template = must('gathering template', await db.from('gathering_templates').insert({
      family_code: code, name: `${code} assembly plan`,
      description: `${code} assembly plan notes`,
      // NO `default_location`. That column was the template's USUAL place, copied onto a
      // segment that stated none; `20260819000007` drops it, and a step of kind `'location'`
      // asks a named relative instead. `f.templateStep3` below is that step, seeded so the new
      // kind is exercised by every read that publishes a step.
      // A people id, not an auth id, and it is this table's whole `own_expr`.
      created_by: owner.personId,
      who_may_schedule: 'family',
    }).select().single())

    f.templateStep1 = must('template step (text)', await db.from('gathering_template_steps').insert({
      family_code: code, template_id: f.template.id, position: 0,
      label: `${code} bring the assembly banner`, kind: 'text', required: true,
      help_text: `${code} assembly banner note`,
    }).select().single())

    f.templateStep2 = must('template step (money)', await db.from('gathering_template_steps').insert({
      family_code: code, template_id: f.template.id, position: 1,
      label: `${code} assembly catering line`, kind: 'money', required: false,
      budget_default_cents: 5000,
    }).select().single())

    // A `location` STEP (20260819000007), which is what replaced the template's own
    // `default_location`. Seeded on the LIVE template rather than the spare so it is in the
    // projection of every step read a case checks, and `required: false` so it does not change
    // what `taskProgress` says about the gathering built from this template.
    f.templateStep3 = must('template step (location)', await db.from('gathering_template_steps').insert({
      family_code: code, template_id: f.template.id, position: 2,
      label: `${code} assembly venue`, kind: 'location', required: false,
      help_text: `${code} assembly venue note`,
    }).select().single())

    f.deletableStep = must('deletable template step', await db.from('gathering_template_steps').insert({
      family_code: code, template_id: f.template.id, position: 3,
      label: `${code} spare assembly step`, kind: 'long_text',
    }).select().single())

    f.deletableTemplate = must('deletable gathering template', await db.from('gathering_templates').insert({
      family_code: code, name: `${code} spare assembly plan`,
      // NO `default_location` — the column is dropped (20260819000007). `addGatheringTemplate`
      // no longer copies anything onto a segment that states no place, so a segment linked
      // from this template comes out with `location` NULL, which is what "not stated" is.
      created_by: owner.personId, who_may_schedule: 'admin',
    }).select().single())

    f.deletableTemplateStep = must('deletable template step (spare plan)',
      await db.from('gathering_template_steps').insert({
        family_code: code, template_id: f.deletableTemplate.id, position: 0,
        label: `${code} spare plan assembly step`, kind: 'text',
      }).select().single())

    f.gathering = must('gathering', await db.from('gatherings').insert({
      family_code: code, title: `${code} spring assembly`,
      summary: `${code} assembly summary`,
      // `location` is deliberately NOT in `alphaMarkers()`: `updateGathering`'s control
      // rewrites a field on this row, and a marker a case overwrites is a marker that stops
      // being found for every case ordered after it.
      location: `${code} assembly hall`,
      starts_on: GATHERING_STARTS_ON, ends_on: GATHERING_ENDS_ON,
      status: 'planning', is_premier: true,
      fund_id: f.fund.id, budget_cents: 50000,
      created_by: owner.personId,
    }).select().single())

    f.deletableGathering = must('deletable gathering', await db.from('gatherings').insert({
      family_code: code, title: `${code} spare assembly`,
      starts_on: SPARE_GATHERING_STARTS_ON,
      // NO fund and NO budget, so nothing in `lib/money-attached.ts` counts it and
      // `deleteGathering` has a subject it is allowed to remove.
      status: 'planning', created_by: owner.personId,
    }).select().single())

    // A SEGMENT WITH A DAY AND A PLACE (20260819000001), not a bare junction row.
    //
    // `occurs_on` is the gathering's own first day, so the segment is INSIDE the span and
    // `segmentSpanWarning` has nothing to say about it — a fixture that seeded an out-of-span
    // segment would make every read of this gathering carry a warning nobody asked for, and
    // `setGatheringSegment`'s probe would then be comparing two states that both need
    // explaining.
    //
    // `location` IS DELIBERATELY NOT IN `alphaMarkers()`, exactly as `gatherings.location` is
    // not: `setGatheringSegment`'s positive control rewrites this column, and a marker a case
    // overwrites is a marker that silently stops being found for every case ordered after it.
    // The row's id (`f.templateUse.id`) is not published by any read either — the detail screens
    // group by `template_id` — so what marks this segment in a leak is the TEMPLATE's name,
    // which is already on the list.
    f.templateUse = must('gathering template use', await db.from('gathering_template_uses').insert({
      family_code: code, gathering_id: f.gathering.id, template_id: f.template.id, position: 0,
      occurs_on: GATHERING_STARTS_ON, location: `${code} assembly pavilion`,
    }).select().single())

    f.assignedTask = must('assigned gathering task', await db.from('gathering_tasks').insert({
      family_code: code, gathering_id: f.gathering.id,
      template_id: f.template.id, step_id: f.templateStep1.id,
      label: `${code} bring the assembly banner`, help_text: `${code} assembly banner note`,
      kind: 'text', required: true, position: 0,
      assignee_id: owner.personId, due_on: GATHERING_DUE_ON, status: 'open',
    }).select().single())

    f.unassignedTask = must('unassigned gathering task', await db.from('gathering_tasks').insert({
      family_code: code, gathering_id: f.gathering.id,
      template_id: f.template.id, step_id: f.templateStep2.id,
      label: `${code} assembly catering line`, kind: 'money', required: false, position: 1,
      budget_cents: 5000, status: 'open',
    }).select().single())

    // `step_id` IS NULL ON THESE TWO, deliberately. `deleteTemplateStep`'s control removes
    // `f.deletableStep`, and a task pointing at it would have its `step_id` nulled by the
    // SET NULL underneath - harmless in itself, but it would make two unrelated cases depend
    // on each other's order for no gain. The column is nullable and nothing these cases
    // exercise reads it.
    f.submittableTask = must('submittable gathering task', await db.from('gathering_tasks').insert({
      family_code: code, gathering_id: f.gathering.id, template_id: f.template.id,
      label: `${code} assembly seating plan`, kind: 'long_text', required: false, position: 2,
      assignee_id: owner.personId, status: 'open',
    }).select().single())

    f.submittedTask = must('submitted gathering task', await db.from('gathering_tasks').insert({
      family_code: code, gathering_id: f.gathering.id, template_id: f.template.id,
      label: `${code} assembly photograph list`, kind: 'list', required: true, position: 3,
      assignee_id: owner.personId, due_on: GATHERING_DUE_ON, status: 'submitted',
    }).select().single())

    f.submission = must('gathering task submission', await db.from('gathering_task_submissions').insert({
      family_code: code, task_id: f.submittedTask.id,
      answer: { items: [`${code} assembly photograph`] },
      note: `${code} assembly submission note`,
      submitted_by: owner.personId, decision: 'pending',
    }).select().single())

    // A SECOND SUBMITTED TASK, AND NOTHING WRITES TO IT — `deletableChild`'s rule applied to a
    // READ rather than to a write, which is the reason `f.invitedRecord` exists a hundred lines
    // above. `getGatheringReviewQueue`'s control has to find something waiting for review, and
    // pointing it at `f.submittedTask` made that assertion depend on whether
    // `reviewGatheringTask`'s control had already run: it had, in the pending block, so the
    // queue was correctly empty of that task and the control reported "owner saw none of their
    // own data". OBSERVED, not predicted — it is the failure the runner is built to report, and
    // the fix is a row of its own rather than a laxer assertion.
    f.queuedTask = must('queued gathering task', await db.from('gathering_tasks').insert({
      family_code: code, gathering_id: f.gathering.id, template_id: f.template.id,
      label: `${code} assembly transport list`, kind: 'list', required: false, position: 4,
      assignee_id: owner.personId, status: 'submitted',
    }).select().single())

    f.queuedSubmission = must('queued task submission', await db.from('gathering_task_submissions').insert({
      family_code: code, task_id: f.queuedTask.id,
      answer: { items: [`${code} assembly minibus`] },
      note: `${code} assembly transport note`,
      submitted_by: owner.personId, decision: 'pending',
    }).select().single())

    // ── AN APPROVED TASK, WHICH NOTHING ELSE IN THE FIXTURE HAD ────────────────────────
    // `reopenGatheringTask` accepts only `status = 'approved'` and refuses every other value
    // with a sentence, so without this row its positive control would be refused by the
    // FIXTURE rather than by the boundary — a control that fails for a reason with nothing to
    // do with isolation, which is the failure mode AGENTS.md 7 says a control exists to catch
    // in the other direction. Its own row for `f.queuedTask`'s reason: it is the one row a
    // control moves off 'approved', and reusing `f.submittedTask` would put a reopen and a
    // review in a race over one status column.
    //
    // NOT ON `f.deletableGathering`. `deleteGathering` refuses a gathering once any of its
    // answers is approved, and that refusal is a case's positive control — an approved task
    // there would make it fail with a message about answers, which reads as a bug in the
    // delete guard rather than as a fixture collision. Same trap, one table across, as the
    // note above about `f.fund` and `f.deletableFund`.
    //
    // `decided_at`/`decided_by` are set because they are what a reopen CLEARS, and a probe
    // cannot see a field being cleared that was never filled. Two columns, two directions.
    f.approvedTask = must('approved gathering task', await db.from('gathering_tasks').insert({
      family_code: code, gathering_id: f.gathering.id, template_id: f.template.id,
      label: `${code} assembly hall booking`, kind: 'text', required: false, position: 6,
      assignee_id: owner.personId, status: 'approved',
      answer: { text: `${code} assembly parish hall` },
      decided_at: APPROVED_DECIDED_AT, decided_by: owner.personId,
    }).select().single())

    f.approvedSubmission = must('approved task submission', await db.from('gathering_task_submissions').insert({
      family_code: code, task_id: f.approvedTask.id,
      answer: { text: `${code} assembly parish hall` },
      note: `${code} assembly hall booking note`,
      submitted_by: owner.personId, decision: 'approved',
      reviewed_by: owner.personId, reviewed_at: APPROVED_DECIDED_AT,
    }).select().single())

    // ── A TASK HELD BY THE FAMILY'S APPLICANT, and it is what makes two pending cases
    // MEAN something. This row was added after measuring, not before: with `requireMember()`
    // neutered, `gatherings.getMyGatheringTasks (pending member)` and
    // `submitGatheringTask (pending member)` both still passed, because every task in the
    // fixture was held by `owner` and both actions key on the CALLER's own person id. Their
    // attack halves were refused by the fixture rather than by the gate — the vacuous pass
    // AGENTS.md 7 exists to name, arriving through the shape of the data instead of through
    // an empty table.
    //
    // An applicant CAN be handed one in the product: `assignGatheringTask` refuses a
    // non-approved assignee, but nothing takes a task back when an administrator later
    // switches a member off, and `membership_status` has four values. So this is a real state
    // and the question it poses is a real one — may somebody the family has not admitted do
    // the family's work? The answer has to be no, and now something asks.
    //
    // ITS LABEL IS IN `alphaMarkers()` even though its holder is an ATTACKING ACTOR. The rule
    // that keeps `fx.users.alphaPending`'s own PERSON id off that list does not reach this: a
    // people row is theirs and RLS rightly lets them read it, whereas a task is the FAMILY's
    // work — `perm:gathering_tasks:select`'s `self_expr` is `assignee_id = auth_person_id()`
    // and `auth_person_id()` is NULL for an applicant, so the database refuses them this row
    // deliberately. Finding it in their response is a finding.
    f.pendingTask = must('applicant-held gathering task', await db.from('gathering_tasks').insert({
      family_code: code, gathering_id: f.gathering.id, template_id: f.template.id,
      label: `${code} assembly welcome table`, kind: 'text', required: false, position: 5,
      assignee_id: f.pendingPersonId, status: 'open',
    }).select().single())

    // `childRelId` and `deletableChildRelId` were here and went with the children cases
    // on 2026-08-13: updateChild and deleteChild addressed a relationship row by id, and
    // their successors (editPersonRecord, invitePersonRecord) address the PERSON. The
    // relationship rows themselves are still seeded above — the tree needs the edges.
    f.spouseRelId = rels.find(r => r.related_person_id === other.personId).id
    f.ancestorRelId = rels.find(r => r.related_person_id === f.ancestor.id).id
  }

  return fx
}

/** Sign in as a seeded user and return an actor the stub can use. */
export async function signIn(user) {
  const anon = createClient(API_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await anon.auth.signInWithPassword({
    email: user.email, password: user.password,
  })
  if (error) throw new Error(`sign in ${user.email}: ${error.message}`)
  return {
    label: user.email,
    userId: data.user.id,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  }
}
