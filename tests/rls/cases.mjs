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
    a.schedule.id, a.payment.id, a.fund.id, a.milestone.id,
    a.contribution.id, a.disbursement.id, a.allocation.id, a.election.id,
    a.notification.id, a.otherNotification.id,
    a.child.id, a.ancestor.id, a.ownerPersonId, a.otherPersonId,
    a.nominationElection.id, a.plan.id,
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
  // These two run their control as the ADMIN, and the reason is a live bug rather
  // than the usual "this policy wants a grant" — read TODO before copying the
  // pattern. permission_table_map points dues_schedules at 'admin/account' with both
  // own_expr and self_expr 'false', so its composed SELECT reduces to
  // admin/account:view = 'any'. 20260618000000 restricts every admin resource per
  // family, so a plain member cannot read the dues table at all — and
  // getMyDuesSummary is the member-facing "what do I owe" call behind My Summary and
  // the dashboard card. Both return [] for every member of every real family.
  //
  // Until 20260806000008 the fixture wrote no resource_visibility rows, so
  // admin/account fell through to 'any' and these controls passed against a
  // permission configuration no family has. Holding permissions constant at 'any'
  // keeps the attack assertion meaningful; it does not make the bug go away.
  read('dues.getDuesSchedules', 'app/actions/dues.ts', 'getDuesSchedules', {
    positiveActor: 'alphaAdmin',
  }),
  read('dues.getMyDuesSummary', 'app/actions/dues.ts', 'getMyDuesSummary', {
    positiveActor: 'alphaAdmin',
  }),
  read('dues.getAllDuesPayments', 'app/actions/dues.ts', 'getAllDuesPayments'),
  read('dues.getMyPaymentHistory', 'app/actions/dues.ts', 'getMyPaymentHistory'),
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
    expectPositive: (r) => JSON.stringify(r).includes('ALPHATESTChild'),
  }),
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
  read('admin/permissions.canManageGroups', 'app/actions/admin/permissions.ts', 'canManageGroups', {
    positive: 'not-applicable',
    why: 'returns the caller\'s own capability flags; carries no other family\'s data',
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

CASES.push(...MORE_CASES)

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
 */
export const UNCOVERED = [
  'documents.uploadDocument', 'photos.uploadPhoto',
  'event-photos.uploadEventPhoto', 'personal-info.uploadAvatar',
]
