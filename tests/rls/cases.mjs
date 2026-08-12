/**
 * One entry per RLS-path server action — the actions that reach the database
 * through the user's client and so depend on Row Level Security, not on code,
 * to keep families apart.
 *
 * THE SHAPE OF A TEST
 *   Each case is run twice with the SAME arguments, changing only who is calling:
 *
 *     positive control  ALPHA's own member  → must see ALPHA's data
 *     attack            BRAVO's ADMIN       → must see none of it
 *
 *   The positive control is not decoration. An action that returns [] for
 *   everybody — because a table was renamed, the fixture did not seed, the JWT
 *   was never attached — passes an isolation assertion trivially. Requiring the
 *   same call to succeed for the rightful owner is what stops this suite from
 *   going green while testing nothing.
 *
 *   Identical arguments across both runs is the other half. The attacker passes
 *   ALPHA's real row ids, so anything they get back came from ALPHA.
 *
 * WHY THE ATTACKER IS AN ADMINISTRATOR
 *   See seed.mjs. A no-permission attacker would be refused by the permission
 *   layer, and the test would pass without family scoping being involved at all.
 */

/** Values that exist only in ALPHA. Finding one in a BRAVO response is a leak. */
export function alphaMarkers(fx) {
  const a = fx.alpha
  return [
    a.announcement.id, a.document.id, a.event.id, a.eventPhoto.id,
    a.collection.id, a.photo.id, a.room.id, a.message.id,
    a.schedule.id, a.optionalSchedule.id, a.payment.id, a.fund.id, a.milestone.id,
    // The beneficiary-hidden drive and the gift to it. These are markers like any
    // other — a BRAVO caller must not see them because they are ALPHA's. That they are
    // ALSO hidden from one caller INSIDE Alpha is a separate claim, asserted by the
    // dedicated cases further down; listing them here does not test it.
    a.hiddenDonation.id, a.hiddenDonationPayment.id, 'ALPHATEST secret gift',
    a.contribution.id, a.disbursement.id, a.allocation.id, a.election.id,
    a.notification.id, a.otherNotification.id,
    a.child.id, a.ancestor.id, a.ownerPersonId, a.otherPersonId,
    a.nominationElection.id, a.plan.id,
    // ALPHA's applicants. Their rows are the PII that admin/approvals unlocks, and the
    // `people` SELECT policy hides them from every caller who cannot view that
    // resource — so finding one in BRAVO's response is a leak like any other.
    //
    // fx.users.alphaPending is deliberately ABSENT from this list, and it is not an
    // oversight: that account is an attacking ACTOR in the cases below, and RLS
    // correctly lets it read its own `people` row. Listing its id would make every
    // pending-member case fail on the applicant seeing themselves.
    a.applicantPersonId, a.rejectablePersonId,
    'alpha.applicant@rls.test', 'alpha.rejectable@rls.test',
    // A declined applicant's row is the same PII as a pending one, and it is now
    // reachable by a new route (they can be asked back), so it is marked like any other.
    //
    // ONLY alphaDeclinedAsk, and the omissions are for the reason stated at
    // fx.users.alphaPending above: alphaDeclinedBack and alphaDeclinedStale are both
    // ACTORS in the cases below — one a positive control, one an attacker — and RLS
    // correctly lets each read its own people row, so listing them would fail those
    // cases on the person seeing themselves. alphaDeclinedAsk is only ever a TARGET.
    'alpha.declined.ask@rls.test',
    // Invitations are a list of email addresses belonging to people who are not yet in
    // the family — PII that only an approver should see, and only for their own family.
    a.invitation.id, a.revocableInvitation.id,
    'invited.alpha@rls.test', 'revocable.alpha@rls.test',
    // ALPHA's permission templates and the member who exists to be re-templated.
    // The template ids are the family's access map; the spare's email is roster PII
    // that Members & Access hands out and the directory does not.
    a.adminTemplateId, a.generalTemplateId, a.sparePersonId,
    'alpha.spare@rls.test',
    // auth user ids too — some actions key on user_id rather than people.id.
    fx.users.alphaMember.userId, fx.users.alphaOther.userId, fx.users.alphaAdmin.userId,
    'secret body ALPHATEST',
    'confidential ALPHATEST message',
    'private ALPHATEST note',
    'ALPHATEST/secret.pdf',
    'ALPHATEST fund',
    'ALPHATEST election',
    'ALPHATEST dues',
    'ALPHATESTChild',
    'ALPHATESTFather',
  ]
}

const read = (id, mod, fn, extra = {}) => ({ kind: 'read', id, mod, fn, args: () => [], ...extra })

export const CASES = [
  // ── directory / identity ──────────────────────────────────────────────────
  read('members.getMembers', 'app/actions/members.ts', 'getMembers'),
  read('ancestors.getFamilyMembers', 'app/actions/ancestors.ts', 'getFamilyMembers'),
  read('ancestors.getMyAncestors', 'app/actions/ancestors.ts', 'getMyAncestors'),
  read('children.getMyChildren', 'app/actions/children.ts', 'getMyChildren'),
  read('children.getSpouseChildren', 'app/actions/children.ts', 'getSpouseChildren', {
    // The spouse has no children of her own in the fixture, so this legitimately
    // returns [] for everyone. Isolation is still asserted; the positive control
    // cannot be, and saying so is better than a green tick that means nothing.
    positive: 'not-applicable',
    why: 'fixture seeds no children under the spouse, so [] is the correct answer for ALPHA too',
  }),
  read('spouse.getMyPartners', 'app/actions/spouse.ts', 'getMyPartners'),
  read('personal-info.getPersonalInfo', 'app/actions/personal-info.ts', 'getPersonalInfo'),
  read('family.getMyFamilyMemberships', 'app/actions/family.ts', 'getMyFamilyMemberships', {
    // Returns the caller's own memberships; ALPHA's member sees ALPHATEST.
    expectPositive: (r) => Array.isArray(r) && r.some(m => m.familyCode === 'ALPHATEST'),
    expectAttack: (r) => Array.isArray(r) && r.every(m => m.familyCode !== 'ALPHATEST'),
  }),

  // ── community ─────────────────────────────────────────────────────────────
  read('announcements.getAnnouncements', 'app/actions/announcements.ts', 'getAnnouncements'),
  read('announcements.getMyAnnouncements', 'app/actions/announcements.ts', 'getMyAnnouncements'),
  read('announcements.getPinnedAnnouncements', 'app/actions/announcements.ts', 'getPinnedAnnouncements'),
  read('announcements.getChapters', 'app/actions/announcements.ts', 'getChapters', {
    positive: 'not-applicable',
    why: 'no chapters seeded; the action is included so a future chapter leak is caught',
  }),
  read('documents.getDocuments', 'app/actions/documents.ts', 'getDocuments'),
  read('photos.getPhotoCollections', 'app/actions/photos.ts', 'getPhotoCollections'),

  // ── actions taking an id: the attacker supplies ALPHA's ───────────────────
  read('chat.getMessages', 'app/actions/chat.ts', 'getMessages', {
    args: fx => [fx.alpha.room.id],
  }),
  read('event-photos.getEventPhotos', 'app/actions/event-photos.ts', 'getEventPhotos', {
    args: fx => [fx.alpha.event.id],
  }),
  read('funds.getDisbursementsForFund', 'app/actions/funds.ts', 'getDisbursementsForFund', {
    args: fx => [fx.alpha.fund.id],
  }),

  // ── money ─────────────────────────────────────────────────────────────────
  // These two ran their control as the ADMIN until 20260808000002, and not because the
  // policy wanted a grant: permission_table_map points dues_schedules at 'admin/account'
  // with own_expr and self_expr both 'false', so the composed SELECT reduced to
  // admin/account:view = 'any' — a key General holds at 'none'. A plain member read
  // ZERO schedules, which meant getMyDuesSummary returned [] and My Summary was blank
  // for every non-administrator in every real family.
  //
  // 20260808000002 adds a second, unwrapped SELECT policy: an approved member reads
  // their own family's schedules. So the control is a plain member again, which is what
  // it should always have been — and that is the assertion that now fails if the policy
  // is dropped. Do not re-pin these to alphaAdmin; that pin was the bug's shadow, and
  // an admin-only control passes whether or not members can see their own dues.
  read('dues.getDuesSchedules', 'app/actions/dues.ts', 'getDuesSchedules'),
  read('dues.getMyDuesSummary', 'app/actions/dues.ts', 'getMyDuesSummary'),
  read('dues.getAllDuesPayments', 'app/actions/dues.ts', 'getAllDuesPayments'),
  read('dues.getMyPaymentHistory', 'app/actions/dues.ts', 'getMyPaymentHistory'),

  // ── My Summary is for me and me only ──────────────────────────────────────
  // A DIFFERENT CLAIM from every other case in this file. The rest ask "can BRAVO
  // reach ALPHA"; these two ask "can a member of ALPHA who holds EVERY grant ALPHA can
  // confer see another ALPHA member through My Summary". The answer must be no, and
  // not because a grant was withheld — alphaAdmin holds scope 'any' on everything.
  //
  // What makes it no is that both actions filter `.eq('person_id', myPersonId)` in the
  // ACTION, before RLS is consulted. That is three easily-deleted lines standing
  // between "what I owe" and "what everybody owes", and until now nothing tested them:
  // the cross-family cases above pass whether or not the filter is there, because
  // BRAVO is refused by family scoping either way.
  //
  // The attacker is alphaAdmin, so `alphaMarkers` cannot be the assertion — every
  // ALPHA id is legitimately theirs to hold. Assert the shape instead: no row may
  // carry another member's person_id. Delete either filter and these fail; that is
  // what they are for.
  read('dues.getMyDuesSummary (own rows only, even for an administrator)',
    'app/actions/dues.ts', 'getMyDuesSummary', {
      attacker: 'alphaAdmin',
      expectAttack: (r, fx) => Array.isArray(r)
        && r.every(row => row.schedule && !JSON.stringify(row).includes(fx.alpha.otherPersonId)),
      positiveActor: 'alphaAdmin',
      positive: 'not-applicable',
      why: 'attacker and owner are the same caller by design — the claim is about scope within one family, not across two; the cross-family control is the getMyDuesSummary case above',
    }),
  read('dues.getMyPaymentHistory (own rows only, even for an administrator)',
    'app/actions/dues.ts', 'getMyPaymentHistory', {
      attacker: 'alphaAdmin',
      // ALPHA's seeded payment belongs to ownerPersonId, not to alphaAdmin — so an
      // unfiltered query returns it and a filtered one does not. That single row is
      // the whole difference between the two behaviours.
      expectAttack: (r, fx) => Array.isArray(r)
        && r.every(row => row.person_id !== fx.alpha.ownerPersonId
                       && row.person_id !== fx.alpha.otherPersonId),
      positive: 'not-applicable',
      why: 'same caller on both halves by design; cross-family isolation for this action is the getMyPaymentHistory case above',
    }),
  // NOT an RLS-path read: getScheduleUsage aggregates dues_payments through the
  // service-role client on purpose, because a member's own RLS view of that table
  // cannot answer "has anyone paid this?" — so its family isolation is a hand-written
  // `.eq('family_code', …)` and nothing else. That makes the attack half more
  // load-bearing here than in the cases around it, not less: there is no policy
  // underneath to catch the scoping if it is ever dropped.
  //
  // The attacker passes no arguments (the action takes none) and must still come back
  // without ALPHA's schedule ids, which are the keys of what it returns. Control runs
  // as the admin for the same reason getDuesSchedules above does — see the note there.
  read('dues.getScheduleUsage', 'app/actions/dues.ts', 'getScheduleUsage', {
    positiveActor: 'alphaAdmin',
  }),
  read('dues.getDonationProgress', 'app/actions/dues.ts', 'getDonationProgress'),

  // ── A drive is hidden from the people it is FOR ───────────────────────────
  // A THIRD KIND OF CLAIM, alongside "can BRAVO reach ALPHA" and "can an ALPHA
  // administrator see another member's own things". This one is: can a caller holding
  // EVERY grant their family can confer see a donation drive that names them as its
  // beneficiary. The answer must be no, and no permission can make it yes — which is
  // why the attacker here is alphaAdmin rather than a plain member. Point these at
  // someone with no grants and they pass whether or not 20260811000000 exists.
  //
  // WHAT MAKES THEM EVIDENCE. Each is three RESTRICTIVE policies away from failing.
  // To watch them fail, flip one to permissive — which is also the exact accident the
  // sweep in 20260618000001 would cause if these policies ever lost their 'perm:'
  // prefix, and is worse than dropping them, because a permissive policy of the same
  // shape GRANTS the hidden rows:
  //
  //   ALTER POLICY "perm:beneficiaries cannot see their own drive"
  //     ON dues_schedules …                       -- (drop and recreate without
  //                                               --  AS RESTRICTIVE)
  //
  // The positive control is alphaMember, who is NOT a beneficiary and must see the
  // drive, its goal and the money in it. Without that half these would pass against a
  // table that failed to seed, a renamed column, or a policy that hid the drive from
  // everybody — which is the failure this feature is one typo away from.
  read('dues.getDuesSchedules (hidden from its beneficiary, who is an administrator)',
    'app/actions/dues.ts', 'getDuesSchedules', {
      attacker: 'alphaAdmin',
      expectAttack: (r, fx) => Array.isArray(r)
        && !r.some(s => s.id === fx.alpha.hiddenDonation.id)
        // The ordinary dues schedule must still come back, or this would also pass on
        // an administrator who could suddenly see no schedules at all.
        && r.some(s => s.id === fx.alpha.schedule.id),
      expectPositive: (r, fx) => Array.isArray(r)
        && r.some(s => s.id === fx.alpha.hiddenDonation.id),
    }),
  read('dues.getDonationProgress (hidden from its beneficiary)',
    'app/actions/dues.ts', 'getDonationProgress', {
      attacker: 'alphaAdmin',
      expectAttack: (r, fx) => Array.isArray(r)
        && !r.some(d => d.schedule?.id === fx.alpha.hiddenDonation.id),
      // Asserts the MONEY, not just the row. getDonationProgress reads its totals
      // through the service-role client, where no policy runs — so a control that only
      // checked the drive was present would say nothing about whether the amounts
      // behind it are reachable at all.
      expectPositive: (r, fx) => Array.isArray(r)
        && r.some(d => d.schedule?.id === fx.alpha.hiddenDonation.id && d.raisedCents === 25000),
    }),
  read('dues.getAllDuesPayments (a gift to the hidden drive is hidden too)',
    'app/actions/dues.ts', 'getAllDuesPayments', {
      attacker: 'alphaAdmin',
      expectAttack: (r, fx) => Array.isArray(r)
        && !r.some(p => p.id === fx.alpha.hiddenDonationPayment.id)
        // Same shape guard as above: the ordinary payment proves the administrator's
        // view of this ledger is otherwise intact.
        && r.some(p => p.id === fx.alpha.payment.id),
      expectPositive: (r, fx) => Array.isArray(r)
        && r.some(p => p.id === fx.alpha.hiddenDonationPayment.id),
    }),
  read('funds.getFunds', 'app/actions/funds.ts', 'getFunds'),
  read('funds.getAllDisbursements', 'app/actions/funds.ts', 'getAllDisbursements'),
  read('funds.getFundContributions', 'app/actions/funds.ts', 'getFundContributions'),
  read('funds.getFundAllocations', 'app/actions/funds.ts', 'getFundAllocations'),

  // ── elections ─────────────────────────────────────────────────────────────
  read('elections.getActiveElections', 'app/actions/elections.ts', 'getActiveElections'),
  read('elections.getAllElections', 'app/actions/elections.ts', 'getAllElections'),

  // ── notifications ─────────────────────────────────────────────────────────
  read('notifications.getNotifications', 'app/actions/notifications.ts', 'getNotifications'),
  read('notifications.getUnreadCount', 'app/actions/notifications.ts', 'getUnreadCount', {
    expectPositive: (r) => r >= 1,
    // BRAVO's admin is the recipient of exactly one BRAVO notification. Any more
    // means the count is reaching across the family boundary.
    expectAttack: (r) => r === 1,
  }),

  // ── writes ────────────────────────────────────────────────────────────────
  // markNotificationRead does `.update().eq('id', id)` with no ownership test in
  // code at all. Whether that is safe is a question only the policy can answer.
  {
    kind: 'write',
    id: 'notifications.markNotificationRead (cross-family)',
    mod: 'app/actions/notifications.ts',
    fn: 'markNotificationRead',
    args: fx => [fx.alpha.notification.id],
    probe: async (db, fx) => probeRead(db, [fx.alpha.notification.id]),
  },
  {
    kind: 'write',
    id: 'notifications.markNotificationRead (same family, another member)',
    mod: 'app/actions/notifications.ts',
    fn: 'markNotificationRead',
    // ALPHA's own member reaching for the OTHER ALPHA member's notification.
    // Family scoping cannot catch this one — only own_expr can.
    attacker: 'alphaMember',
    args: fx => [fx.alpha.otherNotification.id],
    probe: async (db, fx) => probeRead(db, [fx.alpha.otherNotification.id]),
    positiveActor: 'alphaOther',
    positiveArgs: fx => [fx.alpha.otherNotification.id],
  },
  {
    kind: 'write',
    id: 'notifications.markAllNotificationsRead',
    mod: 'app/actions/notifications.ts',
    fn: 'markAllNotificationsRead',
    args: () => [],
    // An earlier case already marked ALPHA's notification read. Without this the
    // owner's own call would have nothing left to do, the probe would not move,
    // and the control would report a failure that is really just test ordering.
    setup: async (db, fx) => {
      const { error } = await db.from('notifications').update({ read_at: null })
        .in('id', [fx.alpha.notification.id, fx.alpha.otherNotification.id])
      if (error) throw new Error(`setup: ${error.message}`)
    },
    probe: async (db, fx) => probeRead(db, [fx.alpha.notification.id, fx.alpha.otherNotification.id]),
  },
]

async function probeRead(db, ids) {
  const { data, error } = await db
    .from('notifications').select('id, read_at').in('id', ids).order('id')
  if (error) throw new Error(`probe: ${error.message}`)
  return JSON.stringify(data)
}

/** Snapshot of a table's rows for a family — the ground truth a write test needs. */
const snapshot = (table, cols, filter) => async (db) => {
  let q = db.from(table).select(cols).order('id')
  for (const [col, val] of Object.entries(filter)) q = q.eq(col, val)
  const { data, error } = await q
  if (error) throw new Error(`probe ${table}: ${error.message}`)
  return JSON.stringify(data)
}

/**
 * One cell of ALPHA's General template.
 *
 * Its own probe rather than snapshot(), because template_permissions is keyed
 * (template_id, resource_key, action) and has no `id` column to order by — snapshot's
 * `.order('id')` would fail the whole case with a probe error rather than a finding.
 */
const templateGrantProbe = (resourceKey, action) => async (db, fx) => {
  const { data, error } = await db
    .from('template_permissions')
    .select('resource_key, action, scope')
    .eq('template_id', fx.alpha.generalTemplateId)
    .eq('resource_key', resourceKey)
    .eq('action', action)
  if (error) throw new Error(`probe template_permissions: ${error.message}`)
  return JSON.stringify(data)
}

/**
 * The remaining RLS-path actions: the writes, and the reads that take an id.
 *
 * The writes are the important half. A read that leaks is a confidentiality
 * failure; a write that lands is an integrity failure, and no code path in these
 * actions checks the family of the id it is handed — RLS is the only thing
 * standing between BRAVO's administrator and ALPHA's records.
 */
export const MORE_CASES = [
  // ── reads taking an ALPHA id ──────────────────────────────────────────────
  read('elections.getElectionDetail', 'app/actions/elections.ts', 'getElectionDetail', {
    args: fx => [fx.alpha.election.id],
  }),
  read('photos.getCollectionDetail', 'app/actions/photos.ts', 'getCollectionDetail', {
    args: fx => [fx.alpha.collection.id],
  }),
  read('funds.getFundWithMilestones', 'app/actions/funds.ts', 'getFundWithMilestones', {
    args: fx => [fx.alpha.fund.id],
  }),
  read('chat.getFamilyMembersWithAccounts', 'app/actions/chat.ts', 'getFamilyMembersWithAccounts'),
  read('link-person.getLinkPersonBannerData', 'app/actions/link-person.ts', 'getLinkPersonBannerData', {
    // Lists people with no account yet — ALPHA's child and ancestor qualify, so a
    // family-blind query here would hand the attacker a roster of real names.
    // Only a fresh self-created stub with no relationships sees the banner at all,
    // so both sides run as newcomers rather than the usual member/admin pair.
    attacker: 'bravoNewcomer',
    positiveActor: 'alphaNewcomer',
    // The control is suspended, NOT deleted, because LINK_EXISTING_PERSON_ENABLED is
    // false (lib/feature-flags.ts) and the action now returns an empty roster to
    // everyone. That makes the attack assertion vacuous for as long as the flag is off —
    // which is exactly the failure mode this suite exists to catch, so it is said out
    // loud here rather than left as a green tick. Flip the flag and restore
    //     expectPositive: (r) => JSON.stringify(r).includes('ALPHATESTChild')
    // in the same commit; the kill-switch case below is what covers it meanwhile.
    positive: 'not-applicable',
    why: 'LINK_EXISTING_PERSON_ENABLED is false, so the action returns [] for everyone and no positive control is possible until it is re-enabled',
  }),
  {
    kind: 'write',
    id: 'link-person.linkPersonToCurrentUser (feature off + cross-family)',
    mod: 'app/actions/link-person.ts', fn: 'linkPersonToCurrentUser',
    // Two assertions in one probe, and both survive the flag being flipped:
    //   * while LINK_EXISTING_PERSON_ENABLED is false, NOBODY moves this row — the
    //     kill switch is in the action, not only in the dashboard that hid the banner.
    //   * whatever the flag says, BRAVO's administrator must never claim an ALPHA
    //     record. That is the assertion that outlives the parking.
    // The ancestor is the target because it is unlinked (user_id IS NULL), which is
    // precisely what this action looks for — aiming at a linked row would be refused
    // for a reason that has nothing to do with either question.
    args: fx => [fx.alpha.ancestor.id],
    probe: (db, fx) => snapshot('people', 'id, user_id',
      { id: fx.alpha.ancestor.id })(db),
    positive: 'not-applicable',
    why: 'a successful link is exactly what the flag exists to prevent, so there is no positive control to run while it is off; re-enable it and the control becomes alphaNewcomer claiming their own family\'s record',
  },
  // Not an RLS-path action — it reads through the service-role client, which sees
  // past every policy. Included because the family scoping RLS would have applied
  // has to be written by hand there, and this is the assertion that proves it was.
  read('elections.getElectionResults (service-role path)', 'app/actions/elections.ts', 'getElectionResults', {
    args: fx => [fx.alpha.election.id],
  }),
  read('admin/permissions.getMyEffectivePermissions', 'app/actions/admin/permissions.ts', 'getMyEffectivePermissions', {
    positive: 'not-applicable',
    why: 'returns only {legacy:false} for everyone — no family data to leak or confirm',
  }),
  read('admin/permissions.canManageAccess', 'app/actions/admin/permissions.ts', 'canManageAccess', {
    positive: 'not-applicable',
    why: 'returns the caller\'s own capability flags; carries no other family\'s data',
  }),

  // ── Members & Access ──────────────────────────────────────────────────────
  // The roster and the family's access map. Both run on the service role, so RLS
  // narrows neither and the family scoping is the action's own work — which is
  // exactly the code these cases are here to check. Controls run as alphaAdmin:
  // admin/users starts 'restricted' in every family, so a plain member holds no
  // view grant and their control would fail for a permission reason rather than an
  // isolation one.
  read('admin/permissions.searchMembers', 'app/actions/admin/permissions.ts', 'searchMembers', {
    positiveActor: 'alphaAdmin',
  }),
  read('admin/permissions.getTemplates', 'app/actions/admin/permissions.ts', 'getTemplates', {
    positiveActor: 'alphaAdmin',
  }),
  read('admin/permissions.getTemplatePolicy', 'app/actions/admin/permissions.ts', 'getTemplatePolicy', {
    // BRAVO's administrator asks for ALPHA's Administrators grid by id.
    args: fx => [fx.alpha.adminTemplateId],
    positiveActor: 'alphaAdmin',
    // A PolicyMap is `resource:action -> scope` and carries no ids, so the marker
    // scan cannot see it either way. Assert on the shape instead: empty for the
    // attacker, and populated for ALPHA's own administrator.
    expectAttack: r => r && typeof r === 'object' && Object.keys(r).length === 0,
    // Both keys Members & Access is built on since 20260808000000 split them. Naming
    // the second one here is what notices if `admin/users/templates` ever falls out of
    // the resource catalog: the grid would silently lose its own row, and the policies
    // on permission_templates would start evaluating a key nothing registers.
    expectPositive: r =>
      r?.['admin/users:edit'] === 'any' && r?.['admin/users/templates:edit'] === 'any',
  }),
  read('admin/permissions.getResources', 'app/actions/admin/permissions.ts', 'getResources', {
    positive: 'not-applicable',
    why: 'the resource catalog is global product data, identical for every family — the attack half is here so that stops being true loudly',
  }),

  // ── writes against ALPHA's rows ───────────────────────────────────────────
  {
    kind: 'write',
    id: 'children.updateChild',
    mod: 'app/actions/children.ts', fn: 'updateChild',
    args: fx => [fx.alpha.child.id, fx.alpha.childRelId,
      { first_name: 'Pwned', last_name: 'Pwned', relationship_type: 'Son', is_step: false }],
    positiveArgs: fx => [fx.alpha.child.id, fx.alpha.childRelId,
      { first_name: 'Renamed', last_name: 'ALPHATEST', relationship_type: 'Son', is_step: false }],
    probe: (db, fx) => snapshot('people', 'id, first_name, last_name', { id: fx.alpha.child.id })(db),
    // people:edit is required by the policy — see the note on alphaAdmin in seed.mjs.
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'children.deleteChild',
    mod: 'app/actions/children.ts', fn: 'deleteChild',
    // Aimed at the spare child, so the control's real deletion does not pull the
    // ground out from under the cases that run after this one.
    args: fx => [fx.alpha.deletableChild.id, fx.alpha.deletableChildRelId],
    probe: (db, fx) => snapshot('people', 'id', { id: fx.alpha.deletableChild.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'children.acceptSpouseChild',
    mod: 'app/actions/children.ts', fn: 'acceptSpouseChild',
    args: fx => [fx.alpha.child.id, 'Son', false],
    probe: (db, fx) => snapshot('person_relationships', 'id, person_id, related_person_id',
      { related_person_id: fx.alpha.child.id })(db),
    positive: 'not-applicable',
    why: 'the owner already has this relationship, so their call is legitimately a no-op',
  },
  {
    kind: 'write',
    id: 'children.convertChildToAdult',
    mod: 'app/actions/children.ts', fn: 'convertChildToAdult',
    args: fx => [fx.alpha.child.id, 'pwned@rls.test'],
    probe: (db, fx) => snapshot('people', 'id, is_minor, primary_email', { id: fx.alpha.child.id })(db),
    positive: 'not-applicable',
    why: 'succeeding would invite a real account into the fixture family; attack side is what matters',
  },
  {
    kind: 'write',
    id: 'dues.setMyDuesPlan',
    mod: 'app/actions/dues.ts', fn: 'setMyDuesPlan',
    // The attacker enrols themselves against ALPHA's schedule. A plan row bound to
    // another family's schedule is the integrity failure to catch.
    args: fx => [fx.alpha.schedule.id, 'monthly'],
    // cadence is in the projection so the control — which changes only the
    // cadence — actually moves the probe.
    probe: (db, fx) => snapshot('dues_member_plans', 'id, person_id, schedule_id, family_code, cadence',
      { schedule_id: fx.alpha.schedule.id })(db),
    // A different cadence from the seeded one — an upsert of identical values
    // changes no bytes, and the control would report a failure that is really
    // just the fixture agreeing with itself.
    positiveArgs: fx => [fx.alpha.schedule.id, 'quarterly'],
  },
  {
    kind: 'write',
    id: 'dues.clearMyDuesPlan',
    mod: 'app/actions/dues.ts', fn: 'clearMyDuesPlan',
    args: fx => [fx.alpha.schedule.id],
    // Probe ALPHA's OWN enrolment specifically. A probe over every plan on the
    // schedule would also catch the attacker deleting the row they themselves
    // created via setMyDuesPlan — their own row, correctly scoped by person_id,
    // and not a cross-family delete at all.
    probe: (db, fx) => snapshot('dues_member_plans', 'id, person_id, cadence',
      { id: fx.alpha.plan.id })(db),
    positiveActor: 'alphaMember',
    positive: 'not-applicable',
    why: 'the owner clearing their own plan is exercised by setMyDuesPlan; here only ALPHA\'s row surviving matters',
  },
  {
    kind: 'write',
    id: 'dues.setMyDuesOptOut',
    mod: 'app/actions/dues.ts', fn: 'setMyDuesOptOut',
    // Pointed at ALPHA's OPTIONAL schedule, not the required one: opting out of a
    // required due is refused outright, so the attack would be turned away by that rule
    // and prove nothing about family isolation.
    //
    // The attacker declines a due in a family they are not in. The plan row this writes
    // is stamped with their OWN family_code, which satisfies every policy — so
    // belongsToFamily() is the only thing standing between BRAVO's admin and a row bound
    // to ALPHA's schedule (AGENTS.md §4).
    args: fx => [fx.alpha.optionalSchedule.id, true],
    probe: (db, fx) => snapshot('dues_member_plans', 'id, person_id, schedule_id, family_code, opted_out',
      { schedule_id: fx.alpha.optionalSchedule.id })(db),
  },
  {
    kind: 'write',
    id: 'elections.castVote',
    mod: 'app/actions/elections.ts', fn: 'castVote',
    args: fx => [fx.alpha.election.id, fx.alpha.position.id, fx.alpha.otherPersonId],
    probe: (db, fx) => snapshot('election_votes', 'id, voter_id, nominee_id',
      { election_id: fx.alpha.election.id })(db),
    positive: 'not-applicable',
    why: 'the owner has already voted; a second call is an upsert no-op, not a signal',
  },
  {
    kind: 'write',
    id: 'elections.submitNomination',
    mod: 'app/actions/elections.ts', fn: 'submitNomination',
    // Against the election that is actually taking nominations — the INSERT policy
    // requires elections.status = 'nominations', so aiming at the voting election
    // would fail for everyone and prove nothing about isolation.
    args: fx => [fx.alpha.nominationElection.id, fx.alpha.nominationPosition.id, fx.alpha.ownerPersonId],
    probe: (db, fx) => snapshot('election_nominations', 'id, nominee_id, nominated_by',
      { election_id: fx.alpha.nominationElection.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'elections.respondToNomination',
    mod: 'app/actions/elections.ts', fn: 'respondToNomination',
    args: fx => [fx.alpha.nomination.id, false, fx.alpha.election.id],
    probe: (db, fx) => snapshot('election_nominations', 'id, accepted',
      { id: fx.alpha.nomination.id })(db),
    // The nominee is ALPHA's other member; they may legitimately answer.
    positiveActor: 'alphaOther',
  },
  {
    kind: 'write',
    id: 'photos.tagPersonInPhoto',
    mod: 'app/actions/photos.ts', fn: 'tagPersonInPhoto',
    args: fx => [fx.alpha.photo.id, fx.alpha.otherPersonId, fx.alpha.collection.id],
    probe: (db, fx) => snapshot('photo_tags', 'id, photo_id, person_id',
      { photo_id: fx.alpha.photo.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'photos.untagPersonFromPhoto',
    mod: 'app/actions/photos.ts', fn: 'untagPersonFromPhoto',
    args: fx => [fx.alpha.photo.id, fx.alpha.otherPersonId, fx.alpha.collection.id],
    probe: (db, fx) => snapshot('photo_tags', 'id, photo_id, person_id',
      { photo_id: fx.alpha.photo.id })(db),
    positive: 'not-applicable',
    why: 'depends on tagPersonInPhoto having tagged the owner first; asserted there instead',
  },
  {
    kind: 'write',
    id: 'photos.deletePhoto',
    mod: 'app/actions/photos.ts', fn: 'deletePhoto',
    args: fx => [fx.alpha.photo.id, fx.alpha.photo.file_path, fx.alpha.collection.id],
    probe: (db, fx) => snapshot('photos', 'id', { id: fx.alpha.photo.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'spouse.upsertSpouse (links ALPHA person)',
    mod: 'app/actions/spouse.ts', fn: 'upsertSpouse',
    // existing_person_id is the vector: naming a person in another family.
    args: fx => [{ my_relationship_type: 'Wife', is_step: false,
      existing_person_id: fx.alpha.otherPersonId }],
    probe: (db, fx) => snapshot('person_relationships', 'id, person_id, related_person_id',
      { related_person_id: fx.alpha.otherPersonId })(db),
    positive: 'not-applicable',
    why: 'the owner already has this partner; re-linking is a no-op',
  },
  {
    kind: 'write',
    id: 'ancestors.upsertAncestor (links ALPHA person)',
    mod: 'app/actions/ancestors.ts', fn: 'upsertAncestor',
    args: fx => [{ relationship_type: 'Father', is_step: false,
      existing_person_id: fx.alpha.ancestor.id }],
    probe: (db, fx) => snapshot('person_relationships', 'id, person_id, related_person_id',
      { related_person_id: fx.alpha.ancestor.id })(db),
    positive: 'not-applicable',
    why: 'the owner already has this ancestor; re-linking is a no-op',
  },
]

/**
 * PHASE 3 — the pending-membership axis.
 *
 * A THIRD KIND OF ATTACKER, and the one this phase exists for. Every case above asks
 * whether BRAVO can reach ALPHA. These ask whether someone who has joined ALPHA by
 * family code, and NOT yet been admitted, can reach ALPHA — a caller who is inside the
 * family boundary by every test the earlier cases apply. `auth_family_code()` resolves
 * ALPHATEST for them, deliberately and permanently (nulling it would hide their own
 * profile from themselves), so the family-scoping conjunct on every policy in the app
 * is SATISFIED. What must stop them is `auth_person_id()` returning NULL, and the
 * handful of policies that reach past it.
 *
 * The shape is the harness's existing one, unchanged: `attacker: 'alphaPending'`, the
 * default positive control, and the same ALPHA markers. The control is doing real work
 * here — it runs as ALPHA's approved member against the same call, so an empty result
 * on the attack side means "denied" rather than "there was nothing to see".
 *
 * A NOTE ON WHAT IS *NOT* ASSERTED. The pending member can read their own `people` row,
 * and should: it is their own profile, the one thing they may fill in while they wait.
 * That is why their id is not a marker.
 *
 * WHICH MECHANISM EACH CASE ACTUALLY EXERCISES — established by MUTATING the database
 * and re-running, not by reading the migration. Removing the single conjunct from
 * auth_person_id() and leaving everything else in place fails the ten cases marked
 * [crux] below, with real leaks and one real row mutation. The three marked otherwise
 * still pass under that mutation, so they are NOT evidence for it, and are labelled
 * individually rather than left to look like they are.
 *
 * Worth doing again after any change to §4 or §6 of 20260806000011:
 *
 *   npx supabase db reset --local
 *   docker exec supabase_db_<project> psql -U postgres -d postgres -c \
 *     "CREATE OR REPLACE FUNCTION public.auth_person_id() RETURNS uuid LANGUAGE sql
 *      STABLE SECURITY DEFINER SET search_path = '' AS \$\$
 *        SELECT p.id FROM public.people p WHERE p.user_id = (SELECT auth.uid())
 *         AND p.family_code = public.auth_family_code() LIMIT 1; \$\$;"
 *   npm run test:rls "pending member"
 *
 * (The reset is not optional between runs — teardown cannot delete dues_payments while
 * the append-only trigger is installed. That is a known gap, recorded in TODO.md.)
 */
export const PENDING_CASES = [
  // [crux] The directory and the family tree — the most direct PII questions.
  read('members.getMembers (pending member)', 'app/actions/members.ts', 'getMembers', {
    attacker: 'alphaPending',
  }),
  read('ancestors.getFamilyMembers (pending member)', 'app/actions/ancestors.ts', 'getFamilyMembers', {
    attacker: 'alphaPending',
  }),
  read('chat.getFamilyMembersWithAccounts (pending member)', 'app/actions/chat.ts', 'getFamilyMembersWithAccounts', {
    attacker: 'alphaPending',
  }),

  // [crux] Tables covered by way of auth_permission() returning 'none'.
  read('announcements.getAnnouncements (pending member)', 'app/actions/announcements.ts', 'getAnnouncements', {
    attacker: 'alphaPending',
  }),
  read('documents.getDocuments (pending member)', 'app/actions/documents.ts', 'getDocuments', {
    attacker: 'alphaPending',
  }),
  read('photos.getPhotoCollections (pending member)', 'app/actions/photos.ts', 'getPhotoCollections', {
    attacker: 'alphaPending',
  }),
  read('funds.getFunds (pending member)', 'app/actions/funds.ts', 'getFunds', {
    attacker: 'alphaPending',
  }),
  read('elections.getActiveElections (pending member)', 'app/actions/elections.ts', 'getActiveElections', {
    attacker: 'alphaPending',
  }),
  read('dues.getAllDuesPayments (pending member)', 'app/actions/dues.ts', 'getAllDuesPayments', {
    attacker: 'alphaPending',
  }),
  // [crux] for 20260808000002's own conjunct, and the reason it is worth having is that
  // this policy is the one place in the schema where a member reads family-wide
  // configuration without holding any grant over it. What keeps the applicant out is
  // `auth_person_id() IS NOT NULL` — auth_person_id() resolves only for
  // membership_status = 'approved' — and NOT a permission check, because there is no
  // longer a permission in the way. Drop that conjunct and these pass for someone who
  // has merely typed the family code; nothing else in the suite would notice, because
  // auth_family_code() resolves ALPHATEST for an applicant deliberately.
  //
  // The control is the default plain member, which is the whole point of the migration:
  // an approved member sees them, an applicant does not.
  // NOT [crux], and labelled so rather than left looking like evidence. An applicant is
  // refused this by holding no admin/approvals grant — which is true of every ordinary
  // member, approved or not — so neuter the approval conjunct and it still passes. It is
  // kept because the count is the one thing about the approvals queue that reaches a
  // NON-approver's browser at all (the navbar renders for everyone), so the guard in
  // front of it is worth a regression test of its own.
  //
  // Control is the ADMIN: alphaMember holds no grant either and would get 0, making the
  // case assert nothing. Same substitution, same reason, as dues.getScheduleUsage above.
  read('admin/approvals.getPendingApprovalCount (pending member)',
    'app/actions/admin/approvals.ts', 'getPendingApprovalCount', {
      attacker: 'alphaPending',
      expectAttack: r => r === 0,
      positiveActor: 'alphaAdmin',
      expectPositive: r => r === 3,
    }),
  read('dues.getDuesSchedules (pending member)', 'app/actions/dues.ts', 'getDuesSchedules', {
    attacker: 'alphaPending',
  }),
  read('dues.getMyDuesSummary (pending member)', 'app/actions/dues.ts', 'getMyDuesSummary', {
    attacker: 'alphaPending',
  }),
  // NOT [crux], and this was established by mutation rather than assumed — both
  // approved-gates in lib/auth/permissions.ts were commented out (resolveScope's
  // `if (!perms.approved) return 'none'` AND the earlier `if (!approved) return EMPTY`)
  // and this case still passed. What actually refuses the applicant is that they do not
  // hold admin/account/dues|donations view — which is true of every ordinary member,
  // approved or not — so this is NOT evidence for the approval gate and should not be
  // read as any.
  //
  // Kept as a regression guard on the grant check itself, which is the only thing
  // standing here: getScheduleUsage aggregates through the service role, so no policy
  // sits underneath it, and auth_family_code() resolves ALPHATEST for an applicant
  // deliberately — the family scoping inside the action would scope TO ALPHA quite
  // happily. Widen that gate to a resource members hold and this case is what notices.
  //
  // The control is the ADMIN, not the default plain member: alphaMember does not hold
  // the grant either, so it would get {} and the case would assert nothing. Same
  // substitution, and the same underlying reason, as dues.getDuesSchedules above.
  read('dues.getScheduleUsage (pending member)', 'app/actions/dues.ts', 'getScheduleUsage', {
    attacker: 'alphaPending',
    positiveActor: 'alphaAdmin',
  }),
  // NOT [crux] — and the mutation run is how that was established rather than assumed.
  // chat_messages' base policy requires membership of the ROOM, and an applicant is not
  // a participant in anything, so this is refused with or without Phase 3. Kept as a
  // regression guard on that base policy, which is the thing actually protecting chat
  // from an unapproved member; it is not evidence for the conjunct.
  read('chat.getMessages (pending member)', 'app/actions/chat.ts', 'getMessages', {
    attacker: 'alphaPending',
    args: fx => [fx.alpha.room.id],
  }),

  // NOT [crux] either, and for a different reason worth writing down: getNotifications
  // narrows to `recipient_id = <own person id>` in the ACTION, so a pending member sees
  // only their own notifications however the policies are configured.
  //
  // What 20260806000011 §6 actually closes on this table is the INSERT policy —
  // `family_code = auth_family_code() AND true`, i.e. any member may write a
  // notification, with any title and any LINK, to any member of their family. An
  // applicant could have put something in every member's bell. No server action exposes
  // that (notifyAllMembers and notifyApprovers are plain modules on the service role
  // precisely so they have no URL), so this action-shaped suite structurally cannot
  // reach it — see UNCOVERED at the foot of this file. The policy TEXT is asserted
  // instead, by §8 of the migration, which fails the deploy if any policy on any swept
  // table is missing the conjunct.
  read('notifications.getNotifications (pending member)', 'app/actions/notifications.ts', 'getNotifications', {
    attacker: 'alphaPending',
  }),

  // [crux] A self-service WRITE. requireMember() is the one line that covers all of
  // them, and castVote is the representative: any member may vote, so there is no grant
  // to withhold — being a member is the whole of the authorization. Under the mutation
  // this one lands a real vote in ALPHA's election, which is the clearest single
  // demonstration of what the conjunct is for.
  {
    kind: 'write',
    id: 'elections.castVote (pending member)',
    mod: 'app/actions/elections.ts', fn: 'castVote',
    attacker: 'alphaPending',
    args: fx => [fx.alpha.election.id, fx.alpha.position.id, fx.alpha.otherPersonId],
    probe: (db, fx) => snapshot('election_votes', 'id, voter_id, nominee_id',
      { election_id: fx.alpha.election.id })(db),
    positive: 'not-applicable',
    why: 'the approved owner has already voted; a second call is an upsert no-op, and their vote is asserted by the cross-family castVote case above',
  },

  // [crux] The family's access map, written by somebody who has joined by family code
  // and not been admitted. auth_family_code() resolves ALPHATEST for them deliberately
  // and permanently, so every family-scoping test in this action passes for them — the
  // only thing standing between an applicant and rewriting what ALPHA's members may do
  // is that resolveScope() denies a non-approved caller everything.
  //
  // A DIFFERENT ACTION from the cross-family case above ('view', not 'edit'), so the
  // control is a real change rather than a repeat of a write that already landed —
  // which would report the owner's write as doing nothing and make the attack
  // assertion above it vacuous.
  {
    kind: 'write',
    id: 'admin/permissions.setTemplatePermission (pending member)',
    mod: 'app/actions/admin/permissions.ts', fn: 'setTemplatePermission',
    attacker: 'alphaPending',
    args: fx => [fx.alpha.generalTemplateId, 'admin/account/bank', 'view', 'any'],
    probe: templateGrantProbe('admin/account/bank', 'view'),
    positiveActor: 'alphaAdmin',
  },

  // THE SELF-APPROVAL REGRESSION TEST. Not [crux] — nothing about the conjunct stops
  // this one, which is the point of it existing separately.
  //
  // `saveProfileSection` is the one write a pending member is deliberately allowed to
  // make, and `membership_status` is a column on the row it writes. The `people` UPDATE
  // policy admits a member's write to their own row — it must, or nobody could edit
  // their own profile — and an RLS policy is a predicate over the ROW, with no opinion
  // about which of its columns changed. So posting the column name to that endpoint was
  // a self-approval that every policy in the database was satisfied by.
  //
  // Two things now refuse it: lib/profile-columns.ts drops the key, and
  // people_guard_membership_status raises if an 'authenticated' caller moves the column
  // at all. This case is aimed at the pair — remove either and it fails.
  {
    kind: 'write',
    id: 'personal-info.saveProfileSection (pending member self-approving)',
    mod: 'app/actions/personal-info.ts', fn: 'saveProfileSection',
    attacker: 'alphaPending',
    args: () => [{ membership_status: 'approved', first_name: 'SelfApproved' }],
    // membership_status ONLY. first_name is in the same payload on purpose — a pending
    // member editing their own name is legitimate and must still work, so projecting it
    // would make a successful, wanted write look like the attack succeeding.
    probe: (db, fx) => snapshot('people', 'id, membership_status',
      { id: fx.users.alphaPending.personId })(db),
    positive: 'not-applicable',
    why: 'the only legitimate way to move this column is set_membership_status(), which admin/approvals.approveApplicant exercises below',
  },
]

/**
 * PHASE 3 — the approvals surface itself.
 *
 * The attacker is BRAVO's administrator as usual, and here they hold `admin/approvals`
 * at scope 'any' in their OWN family — which is the point. Whatever they can still do
 * to ALPHA's applicants, they can do because family isolation failed, not because
 * nobody checked a grant.
 *
 * Controls run as ALPHA's administrator: approving is `canAny`-gated, so a plain member
 * is refused for a reason that has nothing to do with isolation.
 */
export const APPROVAL_CASES = [
  read('admin/approvals.getApplicants', 'app/actions/admin/approvals.ts', 'getApplicants', {
    positiveActor: 'alphaAdmin',
    expectPositive: (r, fx) =>
      r.pending.some(a => a.personId === fx.alpha.applicantPersonId) && r.canDecide === true,
  }),
  // The bell's queue depth. THE DEFAULT ATTACK ASSERTION IS USELESS HERE and that is
  // why both are spelled out: leaks() scans the returned value for ALPHA's marker
  // strings, and a bare number can never contain one — so this case would pass with no
  // family filter at all, reporting every family's applicants to every administrator.
  //
  // The numbers are therefore the assertion. The fixture seeds three pending members in
  // ALPHA and one in BRAVO, so a missing `.eq('family_code', …)` returns the global 4,
  // and reading ALPHA's queue instead of their own returns 3. BRAVO's administrator must
  // see exactly their own 1. If a later fixture change moves these, update the numbers —
  // a failure here is the case working, not rotting.
  read('admin/approvals.getPendingApprovalCount', 'app/actions/admin/approvals.ts', 'getPendingApprovalCount', {
    expectAttack: r => r === 1,
    positiveActor: 'alphaAdmin',
    expectPositive: r => r === 3,
  }),
  {
    kind: 'write',
    id: 'admin/approvals.approveApplicant',
    mod: 'app/actions/admin/approvals.ts', fn: 'approveApplicant',
    args: fx => [fx.alpha.applicantPersonId],
    probe: (db, fx) => snapshot('people', 'id, membership_status',
      { id: fx.alpha.applicantPersonId })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/approvals.rejectApplicant',
    mod: 'app/actions/admin/approvals.ts', fn: 'rejectApplicant',
    // Its own applicant row, for deletableChild's reason: the control really does decide
    // this membership, and consuming the row another case asserts about would turn that
    // case into a vacuous pass.
    args: fx => [fx.alpha.rejectablePersonId, 'not recognised'],
    probe: (db, fx) => snapshot('people', 'id, membership_status',
      { id: fx.alpha.rejectablePersonId })(db),
    positiveActor: 'alphaAdmin',
  },
  // ── Members & Access: the two writes to `people` ──────────────────────────
  // Both go through a SECURITY DEFINER RPC called on the USER client, so the database
  // is the enforcement and these exercise it for real. The attack is the whole point
  // of that design: BRAVO's administrator holds admin/users:edit at 'any' in their own
  // family, and passes ALPHA's ids. Anything that lands, landed because the RPC's own
  // family check failed — there is no grant left to refuse them.
  {
    kind: 'write',
    id: 'admin/permissions.applyTemplate',
    mod: 'app/actions/admin/permissions.ts', fn: 'applyTemplate',
    // ALPHA's spare member, onto ALPHA's Administrators template. If this landed,
    // BRAVO's administrator would have made somebody an administrator of ALPHA.
    args: fx => [fx.alpha.sparePersonId, fx.alpha.adminTemplateId],
    probe: (db, fx) => snapshot('people', 'id, permission_template_id',
      { id: fx.alpha.sparePersonId })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/permissions.setMemberEnabled',
    mod: 'app/actions/admin/permissions.ts', fn: 'setMemberEnabled',
    // Runs AFTER applyTemplate above, which has put the spare on Administrators. That
    // ordering is deliberate rather than incidental: it makes the control disable an
    // administrator, which is the case family_has_other_admin() has to allow (ALPHA
    // still has alphaAdmin) and the one most likely to be wrongly refused.
    args: fx => [fx.alpha.sparePersonId, false],
    probe: (db, fx) => snapshot('people', 'id, membership_status',
      { id: fx.alpha.sparePersonId })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/permissions.setTemplatePermission',
    mod: 'app/actions/admin/permissions.ts', fn: 'setTemplatePermission',
    // The family's access map, written through the SERVICE ROLE — so RLS narrows
    // nothing and the `.eq('family_code', …)` inside the action is the whole of the
    // isolation. Exactly the class AGENTS.md §3 is about, and it had no case until the
    // 20260808000000 audit moved the grant it checks to `admin/users/templates`.
    //
    // The attack is ALPHA's GENERAL template — the one every ordinary member is on. If
    // it landed, BRAVO's administrator would have rewritten what everybody in ALPHA may
    // do, from inside their own family, holding every grant BRAVO can confer.
    //
    // `admin/account/bank` is chosen because nothing else in this suite reads it: it has
    // no permission_table_map row, so no policy is composed from it, and no action
    // consults it. A grant that meant something would make every case after this one
    // depend on the order they run in.
    args: fx => [fx.alpha.generalTemplateId, 'admin/account/bank', 'edit', 'any'],
    // template_permissions has a composite primary key and no `id`, so snapshot()'s
    // .order('id') cannot be used here.
    probe: templateGrantProbe('admin/account/bank', 'edit'),
    positiveActor: 'alphaAdmin',
  },

  // ── invitations ───────────────────────────────────────────────────────────
  // A genuine cross-family READ: the list is email addresses of people who are not in
  // the family yet, and the only thing keeping BRAVO's administrator out of ALPHA's is
  // the policy on family_invitations. Unlike getApplicants this reads through the USER
  // client, so RLS is the whole of the enforcement.
  read('invitations.getInvitations', 'app/actions/invitations.ts', 'getInvitations', {
    positiveActor: 'alphaAdmin',
    expectPositive: (r, fx) => r.some(i => i.id === fx.alpha.invitation.id),
  }),
  {
    kind: 'write',
    id: 'invitations.revokeInvitation',
    mod: 'app/actions/invitations.ts', fn: 'revokeInvitation',
    // Its own invitation, so the control's real revocation does not silently empty the
    // list the case above asserts on.
    args: fx => [fx.alpha.revocableInvitation.id],
    probe: (db, fx) => snapshot('family_invitations', 'id, revoked_at',
      { id: fx.alpha.revocableInvitation.id })(db),
    positiveActor: 'alphaAdmin',
  },
  // THE ONLY anon COVERAGE IN THE SUITE, and it asserts the opposite of everything
  // else here: that a signed-out stranger holding a valid token CAN read the family
  // name. peek_family_invitation is the single function 20260806000015 leaves granted
  // to anon, because /invite/<token> and /register?invite=<token> must name the family
  // before the visitor has an account. Lose that grant and every invitation link 500s
  // for exactly the people invitations exist for — and no other case would fail.
  //
  // `expectAttack` is required rather than incidental: the invited address IS an ALPHA
  // marker, so the default leak check would flag this as a breach. Disclosing it to
  // whoever holds the token is the documented trade — the token is the credential.
  //
  // The other half — that anon holds EXECUTE on NOTHING ELSE — is asserted by the
  // migration itself ("anon STILL HAS"), which runs on every reset and every push and
  // covers all 34 functions rather than the handful an action could reach.
  read('invitations.peekInvitation (anon, valid token)', 'app/actions/invitations.ts', 'peekInvitation', {
    attacker: 'anon',
    args: () => ['rls-invite-token-ALPHATEST'],
    expectAttack: (r) => r?.valid === true && r.email === 'invited.alpha@rls.test',
    positive: 'not-applicable',
    why: 'the anon call IS the assertion — there is no more-entitled caller to compare against, and a signed-in member reaching the same link is covered by redeemInvitation below',
  }),
  {
    kind: 'write',
    id: 'invitations.redeemInvitation (ALPHA token, wrong person)',
    mod: 'app/actions/invitations.ts', fn: 'redeemInvitation',
    // The attacker holds ALPHA's plaintext token — the fixture seeds a known one
    // precisely so this is testable. The email binding is what must stop them: it was
    // addressed to invited.alpha@rls.test, and they are not that person. Without that
    // check a leaked or forwarded link would be a way into any family.
    args: () => ['rls-invite-token-ALPHATEST'],
    probe: (db) => snapshot('people', 'id, membership_status',
      { family_code: 'ALPHATEST' })(db),
    positive: 'not-applicable',
    why: 'the invited address has no account in the fixture, so nobody can legitimately redeem it; the pre-approved path is exercised directly against SQL and recorded in TODO',
  },
  {
    kind: 'write',
    id: 'invitations.inviteMember (pending member)',
    mod: 'app/actions/invitations.ts', fn: 'inviteMember',
    // An applicant must not be able to invite anyone — it would let someone who has not
    // been let in start pulling others in behind them. create_family_invitation() tests
    // auth_person_id(), which is NULL for them.
    attacker: 'alphaPending',
    args: () => ['newcomer.by.pending@rls.test', true],
    probe: (db) => snapshot('family_invitations', 'id, email, pre_approved',
      { family_code: 'ALPHATEST' })(db),
    // The control proves the action works at all — and, because it asks for
    // pre_approved: true as a PLAIN member, that the request is silently downgraded
    // rather than honoured. alphaMember holds no admin/approvals grant.
    positiveActor: 'alphaMember',
  },
  {
    kind: 'write',
    id: 'invitations.inviteMember (BRAVO naming ALPHA as the target family)',
    mod: 'app/actions/invitations.ts', fn: 'inviteMember',
    // 20260806000014 let the caller name a target family so /my-families can offer the
    // button on every row. That turned an action with no cross-family argument into one
    // with the classic shape — an id from the client written onto a row — so it needs
    // the classic test. The RPC's defence is that it looks for the CALLER's own approved
    // people row in the named family; BRAVO's administrator has none in ALPHA.
    //
    // pre_approved: true is passed deliberately. Even if the family check were somehow
    // satisfied, honouring pre-approval on the strength of BRAVO permissions would be
    // the escalation the migration's `v_family = v_active` clause exists to stop.
    args: () => ['intruder@rls.test', true, 'ALPHATEST'],
    probe: (db) => snapshot('family_invitations', 'id, email, pre_approved',
      { family_code: 'ALPHATEST' })(db),
    // The control names ALPHATEST too — the same argument, from someone entitled to it —
    // so the attack assertion cannot pass merely because the parameter is ignored.
    positiveActor: 'alphaMember',
    positiveArgs: () => ['legit.invite@rls.test', false, 'ALPHATEST'],
  },
  {
    kind: 'write',
    id: 'invitations.redeemInvitation (email conjunct, both halves)',
    mod: 'app/actions/invitations.ts', fn: 'redeemInvitation',
    // THE POSITIVE CONTROL THE EMAIL CONJUNCT HAS NEVER HAD, and the case above is why it
    // is needed: `(ALPHA token, wrong person)` carries `positive: 'not-applicable'`, so
    // until now nothing anywhere proved redemption WORKS for the invited person. A
    // refusal that refuses everybody satisfies the attack assertion perfectly.
    //
    // Both halves run the same call with the same token. The only difference is who is
    // signed in, which is exactly the axis the conjunct discriminates on:
    //   attack   bravoAdmin — every grant BRAVO can confer, and the wrong address
    //   control  outsideInvitee — the address it was actually sent to
    //
    // The control DEVIATES from AGENTS.md §7's "someone in ALPHA who is entitled to it",
    // of necessity: a redeemer must NOT already be in ALPHA or :297 refuses them for
    // belonging. See `outsideInvitee` in seed.mjs for why a BRAVO member is the only
    // shape that satisfies both ends.
    args: () => ['rls-outside-invite-token-ALPHATEST'],
    // accepted_by is the ALPHA people id redemption creates, so this one projection
    // proves both halves of the outcome: the invitation was spent, and a row in ALPHA
    // now exists for the redeemer. A probe on `accepted_at` alone would not have.
    probe: (db, fx) => snapshot('family_invitations', 'id, accepted_at, accepted_by',
      { id: fx.alpha.outsideInvitation.id })(db),
    positiveActor: 'outsideInvitee',
  },

  // ── asking a declined applicant back (20260811000001) ─────────────────────
  {
    kind: 'write',
    id: 'invitations.inviteMember (a declined applicant can be asked back)',
    mod: 'app/actions/invitations.ts', fn: 'inviteMember',
    // THE REPORTED BUG. Declining keeps the people row at 'rejected', and the create-side
    // collision test had no membership_status predicate — so a declined person read as
    // "already in this family" for ever and no invitation could be minted for them again.
    //
    // THE CONTROL IS A PLAIN MEMBER, and that is the policy this change implements: any
    // approved member may ask a declined person back, and re-entry then goes through the
    // approvals queue (asserted by the next case). alphaMember holds no admin/approvals
    // grant — the same actor whose pre_approved request is silently downgraded two cases
    // up — so if this ever starts requiring one, this control goes red.
    attacker: 'bravoAdmin',
    args: () => ['alpha.declined.ask@rls.test', false, 'ALPHATEST'],
    probe: (db) => snapshot('family_invitations', 'id, email, pre_approved',
      { family_code: 'ALPHATEST', email: 'alpha.declined.ask@rls.test' })(db),
    positiveActor: 'alphaMember',
  },
  {
    kind: 'write',
    id: 'invitations.redeemInvitation (a re-invited applicant lands in the queue, not in the family)',
    mod: 'app/actions/invitations.ts', fn: 'redeemInvitation',
    // THE SECURITY PROPERTY OF THE WHOLE CHANGE, and the reason it is small: a re-open
    // ignores pre-approval outright, so no invitation — however minted, by whom, or when —
    // can turn a refusal into a membership without a fresh human decision.
    //
    // THE PROBE IS FILTERED ON 'pending' RATHER THAN PROJECTING THE STATUS, and that is
    // what makes the control mean something. runWrite only asserts that the control MOVED
    // the snapshot (run.mjs:136), and 'rejected' → 'approved' moves a projection just as
    // well as 'rejected' → 'pending' does. Filtered, the row appears only if it landed
    // where it should: delete `AND NOT v_reopen` from the migration and this control goes
    // red because the person came back 'approved'.
    //
    // The seeded invitation is pre_approved: true precisely so that clamp is under test.
    args: () => ['rls-reopen-token-ALPHATEST'],
    probe: (db, fx) => snapshot('people', 'id, membership_status',
      { id: fx.users.alphaDeclinedBack.personId, membership_status: 'pending' })(db),
    positiveActor: 'alphaDeclinedBack',
  },
  {
    kind: 'write',
    id: 'invitations.redeemInvitation (an invitation minted before the decline cannot reverse it)',
    mod: 'app/actions/invitations.ts', fn: 'redeemInvitation',
    // THE ATTACKER IS THE REFUSED PERSON THEMSELVES, which is the only shape that tests
    // this: the family re-opens a refusal, never the person who was refused, and never a
    // token that predates the decision it would undo.
    //
    // The sequence this defends is the one that refuted the first draft — an invitation
    // minted before a decline, still inside its 14 days, redeemed afterwards. The fixture
    // dates this row an hour before membership_decided_at while leaving expires_at at its
    // default, so it is stale WITHOUT being expired; otherwise the refusal would come from
    // the expiry branch and prove nothing.
    //
    // Filtered on 'rejected': the row is there before and must still be there after. Drop
    // the `v_inv.created_at > v_decided` guard and they re-open to 'pending', the filter
    // stops matching, and this attack goes red.
    attacker: 'alphaDeclinedStale',
    args: () => ['rls-stale-token-ALPHATEST'],
    probe: (db, fx) => snapshot('people', 'id, membership_status',
      { id: fx.users.alphaDeclinedStale.personId, membership_status: 'rejected' })(db),
    positive: 'not-applicable',
    why: 'a superseded invitation has no legitimate redeemer by definition — the remedy is a NEW invitation, which the declined-applicant case above covers with a real control',
  },
  read('invitations.inviteMember (an in-family address discloses no status)',
    'app/actions/invitations.ts', 'inviteMember', {
    // THE ENUMERATION ORACLE THIS CHANGE HAD TO AVOID. A reviewer demonstrated against a
    // live database that differentiating the refusal by status ("that person has already
    // asked to join. Approve them from…") tells any signed-in caller whether an arbitrary
    // address is pending, disabled or a member — over the public
    // POST /rest/v1/rpc/create_family_invitation surface, to a caller who can see zero
    // non-approved rows through RLS.
    //
    // alphaPending's address is a PENDING applicant, and alphaMember has no
    // admin/approvals grant, so the correct answer is the same status-blind sentence a
    // current member's address gets. Asserting the STRING is the assertion — a leak check
    // would not catch it, because the address being probed is one the caller supplied.
    attacker: 'alphaMember',
    args: () => ['alpha.pending@rls.test', false, 'ALPHATEST'],
    expectAttack: (r) => r?.success === false
      && r.message === 'That person is already in this family.',
    positive: 'not-applicable',
    why: 'the assertion IS that no caller gets a more informative answer, so a more-entitled caller is not a comparison — an approver reads the queue itself, on a screen their grant already covers',
  }),
  read('invitations.inviteMember (a re-invitation is never pre-approved)',
    'app/actions/invitations.ts', 'inviteMember', {
    // WHAT THE INVITER IS TOLD. alphaAdmin holds admin/approvals:edit at 'any', so their
    // pre_approved request is honoured for a stranger — and must NOT be for somebody the
    // family already declined, because redemption is going to put that person back in the
    // queue whatever the invitation says. Without the `AND v_rows = 0` conjunct the row
    // stores true and InviteMemberDialog promises "they will not appear in the approvals
    // queue" to the one person who most needs that to be accurate.
    //
    // Asserts the RETURN VALUE, which is why this is a read case over a write action: the
    // write runner only compares a probe before and after (run.mjs:112-119), and an
    // invitation is minted either way — it is `pre_approved` on the new row that differs.
    attacker: 'alphaAdmin',
    args: () => ['alpha.declined.ask@rls.test', true, 'ALPHATEST'],
    expectAttack: (r) => r?.success === true && r.preApproved === false,
    positive: 'not-applicable',
    why: 'alphaAdmin IS the entitled caller — the assertion is that even a full approvals grant cannot pre-approve a re-invitation, so a more-entitled comparison does not exist',
  }),
  read('invitations.peekInvitation (a re-invitation promises no access)',
    'app/actions/invitations.ts', 'peekInvitation', {
    // WHAT THE INVITEE IS TOLD, before they have an account or a session — which is why
    // this one matters most: they have no other way to find out, and /invite/<token> reads
    // exactly this bit to choose between "you will have full access as soon as you accept"
    // and "an administrator will review your request once you accept".
    //
    // Uses the STALE token rather than the re-open one on purpose. Both are seeded
    // pre_approved: true against a declined address, but the re-open token is CONSUMED by
    // its own case's positive control — so asserting on it here would make this case
    // depend on running first, which is the fixture trap AGENTS.md §7 warns about. The
    // stale invitation is never accepted by anything, so this holds at any position.
    attacker: 'anon',
    args: () => ['rls-stale-token-ALPHATEST'],
    expectAttack: (r) => r?.valid === true && r.preApproved === false,
    positive: 'not-applicable',
    why: 'peek is anon by design and there is no more-entitled caller — the sibling case above asserts the same rule on the create side, where a control does exist',
  }),

  // Creating a family is not a cross-family operation — there is no ALPHA id to pass —
  // so the usual attack/control split does not apply. What IS worth asserting, and what
  // this case is aimed at, is that creating one does not disturb ALPHA and that the
  // founder comes out able to run it. The second half is the interesting one: it depends
  // on three triggers firing in the right order across two inserts (seed the groups,
  // inherit the profile, stamp approved, join Administrators), and getting the inserts
  // the wrong way round produces a family with an administrator nobody can be.
  {
    kind: 'write',
    id: 'my-families.createFamily (founder administers, ALPHA untouched)',
    mod: 'app/actions/my-families.ts', fn: 'createFamily',
    attacker: 'bravoAdmin',
    args: () => ['Harness Created Family'],
    // ALPHA's membership set. Creating a family elsewhere must not add, remove or
    // re-status a single ALPHA row.
    probe: (db) => snapshot('people', 'id, membership_status',
      { family_code: 'ALPHATEST' })(db),
    positive: 'not-applicable',
    why: 'no rightful-vs-attacker split exists for creating your own family; the founder outcome is asserted by the last case in this file, which needs a real auth user and so cannot live in a migration',
  },
  // Joining is LAST because it leaves a membership behind: bravoNewcomer ends the run
  // with a pending row in ALPHA. Harmless (a pending row confers nothing, which is what
  // this asserts) but it is still fixture drift, and no case after it should inherit it.
  {
    kind: 'write',
    id: 'my-families.joinFamilyByCode (confers nothing)',
    mod: 'app/actions/my-families.ts', fn: 'joinFamilyByCode',
    attacker: 'bravoNewcomer',
    args: () => ['ALPHATEST'],
    // The probe is ALPHA's APPROVED membership set, and that framing is the assertion.
    // A stranger applying to ALPHA is the feature working, so the row count going up is
    // not a failure — becoming an approved member of ALPHA is. This is the case that
    // would catch `?mode=join`-style unpending, or a stamp trigger that stopped firing.
    probe: (db) => snapshot('people', 'id, membership_status',
      { family_code: 'ALPHATEST', membership_status: 'approved' })(db),
    positive: 'not-applicable',
    why: 'any signed-in user may apply to any family by design, so there is no rightful-vs-attacker split to draw; what must hold is that applying confers nothing, which the approved-only probe asserts',
  },

  // ── the founder of a NEW family administers it ────────────────────────────
  // This used to be asserted by 20260806000012's own verify block, against
  // user_group_members. 20260807000000 replaced that table with a column, and its
  // verify block cannot re-assert the outcome: the founder rule keys on
  // `families.created_by = people.user_id`, people.user_id is a foreign key into
  // auth.users, and a migration has no auth user to fabricate. On a fresh database
  // that block can only skip — which AGENTS.md calls out as the failure mode where a
  // green run reports success over something that was never exercised. So the
  // assertion moves here, where real accounts exist.
  //
  // THE PROBE IS THE ASSERTION, and it is filtered on purpose. It returns
  // alphaNewcomer's people rows that sit on a template NAMED Administrators — so:
  //
  //   founder lands on Administrators  → [] becomes [row]  → control passes
  //   founder lands on General         → [] stays []       → control FAILS as
  //                                                          "owner's own write did
  //                                                          nothing", which is the
  //                                                          right complaint
  //
  // A probe of the founder's rows unfiltered would change either way and would prove
  // only that a family got created.
  //
  // LAST in the file, after joinFamilyByCode: it leaves a whole family behind and
  // switches alphaNewcomer's active family to it, so nothing may run after it.
  {
    kind: 'write',
    id: 'my-families.createFamily (founder lands on Administrators)',
    mod: 'app/actions/my-families.ts', fn: 'createFamily',
    // The attack is the same isolation claim as the case above, aimed at a different
    // row: creating a family as BRAVO's administrator must not make ALPHA's newcomer
    // an administrator of anything.
    attacker: 'bravoAdmin',
    args: () => ['Harness Attacker Family'],
    positiveActor: 'alphaNewcomer',
    positiveArgs: () => ['Harness Founder Family'],
    probe: async (db, fx) => {
      const { data, error } = await db
        .from('people')
        .select('id, family_code, permission_templates!inner(name)')
        .eq('user_id', fx.users.alphaNewcomer.userId)
        .eq('permission_templates.name', 'Administrators')
        .order('id')
      if (error) throw new Error(`probe founder template: ${error.message}`)
      return JSON.stringify(data)
    },
  },
]

// Order is load-bearing, and only here: APPROVAL_CASES decides two memberships and
// leaves a third behind, so it runs after everything that reads the fixture.
CASES.push(...MORE_CASES, ...PENDING_CASES, ...APPROVAL_CASES)

/**
 * NOT COVERED, and why — so the gap is a decision rather than an oversight.
 *
 *   uploadDocument, uploadPhoto, uploadEventPhoto, uploadAvatar
 *     Take a FormData carrying a file and write to Supabase Storage, whose
 *     buckets and policies are a separate access-control system from the RLS
 *     policies this suite exercises. Testing them properly means seeding buckets
 *     and asserting on object paths — worth doing, but a different harness.
 *
 *   createFund, createElection, createCollection, createDuesSchedule, addChild
 *     Create rows in the CALLER's own family, derived from their own
 *     auth_family_code(). There is no other family's id to supply, so there is no
 *     cross-family case to construct. Their risk is the permission layer, not
 *     family isolation.
 *
 *   The notifications INSERT policy, and the rest of 20260806000011 §6's sweep
 *     A structural gap rather than a missing case. The sweep narrows policies on
 *     tables that no server action lets an unapproved caller touch — the
 *     notifications INSERT ("any member may notify any member", so an applicant
 *     could reach every bell in the family), and the "readable in family" SELECTs on
 *     permission_templates, template_permissions and resource_visibility.
 *     Every one of those is reachable only by calling PostgREST directly with the
 *     applicant's own JWT, and this suite calls exported ACTIONS. Adding it means a
 *     raw-query harness alongside this one, which is worth doing and is not this.
 *
 *     What stands in for it meanwhile is not nothing: §8 of that migration recomputes
 *     the swept table list from permission_table_map and RAISEs if a single policy on
 *     any of them lacks the conjunct, so the sweep silently matching zero rows fails
 *     the deploy rather than passing the tests.
 */
export const UNCOVERED = [
  'documents.uploadDocument', 'photos.uploadPhoto',
  'event-photos.uploadEventPhoto', 'personal-info.uploadAvatar',
]
