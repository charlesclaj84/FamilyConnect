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
}

const admin = () => createClient(API_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Delete anything a previous run left behind, so the suite is re-runnable. */
async function teardown(db) {
  const codes = [ALPHA, BRAVO]

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
    'chat_rooms', 'elections', 'photos', 'photo_collections', 'event_photos',
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
    'person_relationships', 'events', 'user_roles', 'family_invitations',
    // ADDED 2026-08-17 with the three sweep rows. event_rsvp and event_assignments
    // cascade from `events` above and need no line of their own; event_types does NOT
    // (it is family-scoped configuration, not a child of an event) and
    // event_blueprint_items cascades from it. Listed AFTER `events`, because an
    // assignment points at a blueprint item and the event is what takes it away.
    'event_blueprint_items', 'event_types',
    // Written by 20260806000008's families trigger, and keyed on family_code with no
    // FK to families — so nothing else here removes it, and a stale 'restricted' row
    // would outlive the family it was created for.
    'resource_visibility',
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

  const fx = { alpha: {}, bravo: {}, users: {} }

  for (const code of [ALPHA, BRAVO]) {
    must(`family ${code}`, await db.from('families')
      .insert({ family_code: code, family_name: `${code} Family` }).select().single())
  }

  // ── users + their people rows ──────────────────────────────────────────────
  for (const [key, spec] of Object.entries(USERS)) {
    const { data: created, error } = await db.auth.admin.createUser({
      email: spec.email, password: PASSWORD, email_confirm: true,
    })
    if (error) throw new Error(`seed user ${spec.email}: ${error.message}`)
    const userId = created.user.id

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
  const everyone = Object.values(fx.users).map(u => u.personId)
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
    const want = u.pending ? 'pending' : u.declined ? 'rejected' : 'approved'
    const got = statuses.find(s => s.id === u.personId)?.membership_status
    if (got !== want) {
      throw new Error(`seed membership_status: ${key} is '${got}', expected '${want}'`)
    }
  }

  // ── an administrator in each family: scope 'any' on everything ────────────
  const resources = must('resources', await db.from('permission_resources').select('key'))
  for (const [code, who] of [[ALPHA, 'alphaAdmin'], [BRAVO, 'bravoAdmin']]) {
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
  for (const who of ['alphaAdmin', 'bravoAdmin']) {
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
    f.chapter = must('chapter', await db.from('chapters').insert({
      family_code: code, name: `${code} chapter`,
    }).select().single())

    f.announcement = must('announcement', await db.from('announcements').insert({
      family_code: code, title: `${code} announcement`, body: `secret body ${code}`,
      author_id: owner.personId, pinned: true,
    }).select().single())

    f.document = must('document', await db.from('documents').insert({
      family_code: code, name: `${code} document`, file_path: `${code}/secret.pdf`,
      uploaded_by: owner.personId, category: 'bylaws',
    }).select().single())

    f.event = must('event', await db.from('events').insert({
      family_code: code, name: `${code} reunion`, status: 'approved',
      created_by: owner.userId, event_date: '2026-09-01',
    }).select().single())

    f.eventPhoto = must('event photo', await db.from('event_photos').insert({
      event_id: f.event.id, family_code: code, uploader_id: owner.personId,
      file_path: `${code}/event.jpg`, caption: `${code} event photo`,
    }).select().single())

    // ── THREE ROWS ADDED 2026-08-17, FOR THE SWEEP CASES ──────────────────────────
    // `event_rsvp`, `event_assignments` and `user_roles` are three of the nine tables
    // `20260806000011` §6 added `auth_membership_approved()` to, and until now the fixture
    // seeded none of them. That cost nothing while nothing tested them — and the moment
    // `SWEEP_CASES` did, all three positive controls failed and the runner said so:
    // "owner saw none of their own data — this case proves nothing".
    //
    // That is the failure mode AGENTS.md §7 exists to name, caught by the mechanism built
    // to catch it. These rows are what turn three vacuous attack assertions into real ones.
    // They are NOT marked `positive: 'not-applicable'`: a control genuinely applies here —
    // a member really may read their own family's RSVPs — the fixture simply had no row.
    // AUTH USER IDS, NOT people ids, on all three of these — checked against
    // pg_constraint rather than assumed, and the first attempt got it wrong.
    // `event_rsvp.submitted_by`, `event_assignments.assigned_to/assigned_by` and
    // `user_roles.user_id` all reference auth.users(id). AGENTS.md §8 notes the same fact
    // from the other direction: event_rsvp has no foreign key to `people` at all, which is
    // why `event_rsvp(people(...))` answers PGRST200.
    f.rsvp = must('event rsvp', await db.from('event_rsvp').insert({
      event_id: f.event.id, submitted_by: owner.userId, is_attending: true,
    }).select().single())

    // An assignment needs a blueprint item to point at, and a blueprint item needs an
    // event type. Both are seeded here rather than reused because nothing else in the
    // fixture creates either.
    f.eventType = must('event type', await db.from('event_types').insert({
      family_code: code, name: `${code} gathering`, created_by: owner.userId,
    }).select().single())

    f.blueprintItem = must('blueprint item', await db.from('event_blueprint_items').insert({
      event_type_id: f.eventType.id, title: `${code} bring the cake`, sort_order: 1,
    }).select().single())

    f.assignment = must('event assignment', await db.from('event_assignments').insert({
      event_id: f.event.id, blueprint_item_id: f.blueprintItem.id,
      assigned_to: owner.userId, assigned_by: owner.userId,
    }).select().single())

    // A board position, given to the ADMINISTRATOR — which is why that sweep case's
    // control is `alphaAdmin` rather than `alphaMember`. `role_id` comes from the global
    // `family_roles` lookup (the 25 built-in positions), so this depends on
    // `seed_global_lookups()` having run: if it is empty the insert fails loudly here
    // rather than the case going green over a missing row.
    const presidentRole = must('president role', await db.from('family_roles')
      .select('id').eq('name', 'President').is('family_code', null).single())
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

    f.contribution = must('contribution', await db.from('fund_contributions').insert({
      fund_id: f.fund.id, family_code: code, amount_cents: 7500,
      contributor_person_id: owner.personId, recorded_by: owner.personId,
      contributed_date: '2026-07-02',
    }).select().single())

    f.disbursement = must('disbursement', await db.from('fund_disbursements').insert({
      fund_id: f.fund.id, family_code: code, person_id: owner.personId,
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

    f.election = must('election', await db.from('elections').insert({
      family_code: code, title: `${code} election`, status: 'voting',
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

    // A second election still taking nominations. The INSERT policy on
    // election_nominations requires elections.status = 'nominations', so
    // submitNomination cannot be exercised against the voting election above —
    // it would be refused for a reason unrelated to family isolation.
    f.nominationElection = must('nomination election', await db.from('elections').insert({
      family_code: code, title: `${code} nomination election`, status: 'nominations',
      created_by: owner.personId,
    }).select().single())

    f.nominationPosition = must('nomination position', await db.from('election_positions').insert({
      election_id: f.nominationElection.id, title: 'Secretary', max_winners: 1,
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
