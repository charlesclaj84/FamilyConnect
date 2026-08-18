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

// The family code itself, for the handful of cases whose subject is the family ROW
// rather than something filed under it. Imported rather than retyped so a fixture
// rename cannot leave a case quietly asserting about a family that no longer exists.
//
// This is the first import this file has ever had, and it makes the module unloadable
// without the local stack: seed.mjs pulls in env.mjs, which shells out to
// `supabase status` at load. That costs nothing today — run.mjs is the only importer
// and it calls seed() regardless — but it is why `node -e "import('./cases.mjs')"`
// now needs `npx supabase start` first.
import { createHash } from 'node:crypto'
import { ALPHA, BRAVO, CHARLIE } from './seed.mjs'
import { SWEEP_NOTIFICATION_TITLE } from './raw/sweep.mjs'

/** Values that exist only in ALPHA. Finding one in a BRAVO response is a leak. */
export function alphaMarkers(fx) {
  const a = fx.alpha
  return [
    a.chapter.id, 'ALPHATEST chapter',
    a.announcement.id, a.document.id, a.event.id, a.eventPhoto.id,
    a.collection.id, a.photo.id, a.room.id, a.message.id,
    a.schedule.id, a.optionalSchedule.id, a.payment.id, a.fund.id, a.milestone.id,
    // The transfer, and the fund it exists to move money into. `reason` is the one
    // free-text field on a transfer row, so it is the string that would show up in a
    // leaked ledger — marked like every other piece of ALPHA prose below.
    a.secondFund.id, a.transfer.id, 'ALPHATEST transfer', 'ALPHATEST second fund',
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
  // NO `ancestors.*` OR `spouse.*` CASES, since 2026-08-13, and their absence is a
  // deletion rather than a gap: `app/actions/ancestors.ts` and `app/actions/spouse.ts`
  // were removed along with the per-member lineage view they served, so a case naming
  // them would now fail to import.
  //
  // WHAT MOVED RATHER THAN LAPSED, because two of them mattered more than the rest.
  // `upsertSpouse` and `upsertAncestor` are the worked examples AGENTS.md §4 cites for the
  // missing-`belongsToFamily` shape, and the shape outlived the actions: it is tested on
  // `family-tree.addRelative`, which took over their job. Two cases cover it, one per id
  // that action accepts — see "cross-family anchor" and "links ALPHA person to a BRAVO
  // anchor" below.
  // `children.getMyChildren` and `children.getSpouseChildren` WERE HERE and lapsed with
  // their module on 2026-08-13: `/direct-lineage` is gone, and with it the idea that a
  // child is a record its parent owns. Nothing inherited their job, because there is no
  // longer a per-parent view to isolate — the tree reads the whole family roster, and
  // `family-tree.getFamilyTree` below is the case that covers it.
  // The family-wide tree. It reads the WHOLE roster and every relationship between them
  // on the ADMIN client — deliberately, because the `people` SELECT policy hides
  // applicants and the tree has to draw the person it just invited — so its family
  // isolation is a hand-written `.eq('family_code', …)` and nothing else. That makes the
  // attack half more load-bearing here than in the cases around it, not less: there is no
  // policy underneath to catch the scoping if it is ever dropped.
  read('family-tree.getFamilyTree', 'app/actions/family-tree.ts', 'getFamilyTree'),
  read('personal-info.getPersonalInfo', 'app/actions/personal-info.ts', 'getPersonalInfo'),
  read('family.getMyFamilyMemberships', 'app/actions/family.ts', 'getMyFamilyMemberships', {
    // Returns the caller's own memberships; ALPHA's member sees ALPHATEST.
    expectPositive: (r) => Array.isArray(r) && r.some(m => m.familyCode === 'ALPHATEST'),
    expectAttack: (r) => Array.isArray(r) && r.every(m => m.familyCode !== 'ALPHATEST'),
  }),

  // ── community ─────────────────────────────────────────────────────────────
  read('announcements.getAnnouncements', 'app/actions/announcements.ts', 'getAnnouncements'),
  read('announcements.getMyAnnouncements', 'app/actions/announcements.ts', 'getMyAnnouncements'),
  // Was `getPinnedAnnouncements` until 2026-08-13. Same query, one more join: the feed
  // reads `announcement_unpins` alongside the announcements so Recent Updates knows
  // which pins THIS reader has dismissed. Renaming the case rather than adding one is
  // right — the old action no longer exists, and a case naming it would fail to load.
  read('announcements.getAnnouncementFeed', 'app/actions/announcements.ts', 'getAnnouncementFeed'),
  // A REAL CONTROL SINCE THE FIXTURE SEEDS CHAPTERS. This carried
  // `positive: 'not-applicable'` for as long as there were none — an honest note that
  // the isolation half was asserting over an empty list. The chapter rows the
  // `people.chapter_id` cases below need make it testable, so it is a full case now.
  //
  // THE CONTROL RUNS AS ALPHA'S ADMINISTRATOR, not as the default member, and that is
  // the policy being honest rather than the fixture being bent: the composed SELECT
  // policy on `chapters` is
  //     family_code = auth_family_code() AND auth_permission('admin/chapters','view') = 'any'
  // so a plain member reads no chapters at all and `[]` is their correct answer. Using
  // the default actor here would have failed the control for a reason that is not a bug.
  read('announcements.getChapters', 'app/actions/announcements.ts', 'getChapters', {
    positiveActor: 'alphaAdmin',
    expectPositive: (r, fx) => Array.isArray(r) && r.some(c => c.id === fx.alpha.chapter.id),
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

  // ── The Dashboard's "Dues Collected" tile ──────────────────────────────────
  // BOTH ASSERTIONS ARE WRITTEN OUT, and they have to be. This action returns a
  // NUMBER, and the harness's defaults are built for rows: the attack half scans the
  // result for ALPHA's ids and a number contains none, so it would pass without the
  // policy existing at all; the control half requires the owner to SEE one of their own
  // markers, which a number can never satisfy, so it would fail while working perfectly.
  // A bare `read(...)` here would have been one green tick meaning nothing beside one
  // red tick meaning nothing.
  //
  // The two families are seeded identically — same $50.00 payment, same $250.00 gift to
  // the hidden drive — so "the attacker's number differs from ALPHA's" is NOT available
  // as an assertion and would be a trap. What separates leak from no-leak is the SIZE:
  // BRAVO's administrator sees BRAVO's own payment and nothing else, and if ALPHA's rows
  // reached them the total would carry ALPHA's two payments on top of it.
  //
  // Why the expected numbers are what they are, since neither is the naive sum:
  //
  //   attack   bravoAdmin is the BENEFICIARY of BRAVO's hidden donation drive, so
  //            20260811000000's restrictive policy hides that $250.00 gift from them.
  //            What is left is BRAVO's own $50.00 payment. A cross-family leak would
  //            add ALPHA's $50.00 AND ALPHA's $250.00 — they are not ALPHA's
  //            beneficiary — so a failure here is large and unmistakable.
  //
  //   control  alphaMember is nobody's beneficiary, so they see both of ALPHA's
  //            payments. That the control's number is SIX TIMES the attack's is the
  //            point: the two halves are reading genuinely different row sets.
  //
  // Derived from the fixture rather than typed as 5000/30000, so that changing a seeded
  // amount moves the expectation with it instead of turning this red for no reason.
  //
  // TO SEE IT FAIL — required before treating any of this as evidence: drop the
  // `family_code = auth_family_code()` conjunct from `perm:dues_payments:select`
  // (20260808000001) and re-run. The attack half should jump to 35000.
  read('dues.getFamilyDuesCollected', 'app/actions/dues.ts', 'getFamilyDuesCollected', {
    expectAttack: (r, fx) => r === fx.bravo.payment.amount_cents,
    expectPositive: (r, fx) =>
      r === fx.alpha.payment.amount_cents + fx.alpha.hiddenDonationPayment.amount_cents,
  }),
  read('dues.getDonationProgress', 'app/actions/dues.ts', 'getDonationProgress'),

  // ── The family-wide dues projection ───────────────────────────────────────
  // TAKES NO ARGUMENTS, so there is no id for an attacker to pass and this is not the
  // usual §4 shape. What it can still get wrong is bigger: it reads four tables on the
  // SERVICE ROLE — dues_payments' SELECT policy opens with `person_id = auth_person_id()`,
  // so the user's client would report one member's own $50 as the family's whole year —
  // and family isolation is therefore four hand-written `.eq('family_code', …)` clauses
  // and nothing else (§3). Drop one and BRAVO's treasurer projects ALPHA's dues.
  //
  // The assertion is on the FIGURES rather than on a row marker, because a leak here does
  // not add a recognisable row, it adds money. bravoAdmin must see BRAVO's own expected
  // total; the control sees ALPHA's, which is a different number for a different roster.
  //
  // NOTE WHAT IS DELIBERATELY NOT ASSERTED: the amounts. The fixture seeds dues schedules
  // with no `start_date`, which §7b names as the reason an arithmetic assertion here is
  // worthless — `currentPeriodStart` falls back to 1 January and the projection maths goes
  // untested either way. `membersCounted` is the right thing to assert in this suite: it
  // is a count of ROWS the family scoping selected, which is exactly what these cases are
  // about. The arithmetic lives in lib/dues-projection.test.ts, under `npm test`.
  //
  // TO SEE IT FAIL — required before treating this as evidence: drop the
  // `.eq('family_code', familyCode)` from the `people` read in getDuesProjection() and
  // re-run. Both halves should report the two families' rosters added together.
  read('dues.getDuesProjection', 'app/actions/dues.ts', 'getDuesProjection', {
    // THE CONTROL IS ALPHA'S ADMINISTRATOR, not its plain member, and that is a fact about
    // the feature rather than a convenience. 20260817000000 registers this key
    // `restricted` and grants it only where `transactions/dues-payments:view` is already
    // 'any' — so alphaMember, the suite's default owner, is correctly refused and returns
    // null. A control that failed there would report this case as proving nothing, which
    // is exactly what the runner said the first time it ran.
    positiveActor: 'alphaAdmin',
    expectAttack: (r, fx) =>
      r !== null
      && r.people.every(p => p.id !== fx.users.alphaMember.personId)
      && r.projection.membersCounted === r.people.length,
    expectPositive: (r, fx) =>
      r !== null && r.people.some(p => p.id === fx.users.alphaMember.personId),
  }),

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
  // fund_transfers carries HAND-WRITTEN policies (20260812000002 §6) rather than ones
  // composed by 20260618000001's sweep, which is exactly why it needs a case of its
  // own: nothing else in the chain would notice if the family conjunct were dropped
  // from a policy that no other file generates. The control is the ADMIN, because the
  // SELECT policy demands `auth_permission('transactions/fund-transfers','view') =
  // 'any'` — a plain member holds none, and `[]` is their correct answer.
  //
  // [crux], and verified as such: rebuild the policy without its
  // `family_code = public.auth_family_code()` conjunct and the attack half goes red,
  // with BRAVO's administrator reading ALPHA's transfer ledger. Nothing else stands in
  // the way — the two remaining conjuncts are a grant BRAVO holds in its OWN family and
  // an approval BRAVO's administrator genuinely has.
  read('funds.getFundTransfers', 'app/actions/funds.ts', 'getFundTransfers', {
    positiveActor: 'alphaAdmin',
    expectPositive: (r, fx) => Array.isArray(r) && r.some(t => t.id === fx.alpha.transfer.id),
  }),

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

  // ── the reader's own announcement pin (20260813000001) ────────────────────
  // Self-service, so there is no grant to withhold and the ONLY thing standing between
  // BRAVO and a row in ALPHA's family is family scoping — `requireMember()` +
  // `belongsToFamily()` in the action, and the `auth_person_id()` / EXISTS pair in the
  // policy. That makes these two cases the whole test of that table.
  //
  // The attacker is BRAVO's administrator, holding every grant BRAVO can confer, passing
  // ALPHA's real announcement id. A row appearing under it is a cross-family write with
  // every local check satisfied — the §4 shape, arriving through a table whose own row
  // genuinely belongs to the caller.
  {
    kind: 'write',
    id: 'announcements.unpinAnnouncementForMe (cross-family)',
    mod: 'app/actions/announcements.ts',
    fn: 'unpinAnnouncementForMe',
    args: fx => [fx.alpha.announcement.id],
    // Cleared first so the control has something to do: this file is run in order and
    // an earlier pass may have left the row behind.
    setup: async (db, fx) => {
      const { error } = await db.from('announcement_unpins')
        .delete().eq('announcement_id', fx.alpha.announcement.id)
      if (error) throw new Error(`setup: ${error.message}`)
    },
    probe: async (db, fx) => probeUnpins(db, fx.alpha.announcement.id),
  },
  {
    kind: 'write',
    id: 'announcements.repinAnnouncementForMe (cross-family)',
    mod: 'app/actions/announcements.ts',
    fn: 'repinAnnouncementForMe',
    args: fx => [fx.alpha.announcement.id],
    // The mirror of the case above: ALPHA's member has dismissed the announcement, and
    // BRAVO's administrator must not be able to un-dismiss it for them. Seeded through
    // the admin client rather than by relying on the previous case having run, so this
    // case is meaningful on its own and cannot be broken by reordering.
    setup: async (db, fx) => {
      const { error } = await db.from('announcement_unpins').upsert({
        announcement_id: fx.alpha.announcement.id,
        person_id: fx.alpha.ownerPersonId,
        family_code: 'ALPHATEST',
      }, { onConflict: 'announcement_id,person_id' })
      if (error) throw new Error(`setup: ${error.message}`)
    },
    probe: async (db, fx) => probeUnpins(db, fx.alpha.announcement.id),
  },

  // ── the family-wide tree (20260813000004) ─────────────────────────────────
  // Both writes are SELF-SERVICE — `requireMember()` and no grant, matching
  // person_relationships' own policies since 20260806000006 — so the permission layer
  // withholds nothing from BRAVO's administrator here. What must refuse them is family
  // scoping alone: `belongsToFamily()` on every id, and `.eq('family_code', …)` on every
  // query. These two cases are the whole test of that.
  //
  // This is the §4 shape at its sharpest. The row `addRelative` writes is legitimately
  // BRAVO's — its family_code is BRAVOTEST and every policy is satisfied — while the
  // `person_id` it carries points into ALPHA. Nothing in the database objects, because
  // nothing in the database was asked.
  {
    kind: 'write',
    id: 'family-tree.addRelative (cross-family anchor)',
    mod: 'app/actions/family-tree.ts',
    fn: 'addRelative',
    args: fx => [{
      anchorPersonId: fx.alpha.ownerPersonId,
      relationshipType: 'Brother',
      mode: 'record',
      firstName: 'ALPHATESTIntruder',
      lastName: 'Probe',
      noEmailReason: 'rls probe',
    }],
    probe: async (db, fx) => probeRelationships(db, fx.alpha.ownerPersonId),
  },
  {
    kind: 'write',
    id: 'family-tree.removeRelationship (cross-family)',
    mod: 'app/actions/family-tree.ts',
    fn: 'removeRelationship',
    args: () => [TREE_PROBE_REL],
    // ITS OWN ROW, AND ITS OWN PERSON, which AGENTS.md asks for by name: a control that
    // mutates a row a later case depends on turns a real finding into a pass. This action
    // deletes BOTH directions of the pair, so reusing the seeded ancestor relationship
    // would take the (owner → Father → ancestor) row with it — and that row is the
    // baseline the `addRelative (links ALPHA person…)` probe further down snapshots
    // against, so its attack half would compare an empty set with an empty set and pass
    // whatever the action did.
    //
    // Recreated on every half so the attack and the control each start from a row that
    // exists — otherwise the control would have nothing to delete and would report a
    // failure that is really just ordering.
    setup: async (db, fx) => {
      const type = must(await db
        .from('relationship_types').select('id').eq('name', 'Brother').maybeSingle())
      await db.from('person_relationships').delete().eq('id', TREE_PROBE_REL)
      must(await db.from('people').upsert({
        id: TREE_PROBE_PERSON,
        family_code: 'ALPHATEST',
        first_name: 'ALPHATESTTree',
        last_name: 'Probe',
      }))
      must(await db.from('person_relationships').insert({
        id: TREE_PROBE_REL,
        person_id: fx.alpha.ownerPersonId,
        related_person_id: TREE_PROBE_PERSON,
        relationship_type_id: type.id,
        family_code: 'ALPHATEST',
        is_step: false,
      }))
    },
    probe: async (db) => probeRelationships(db, TREE_PROBE_PERSON),
  },
]

/**
 * Fixed ids, so `setup` and `args` can name the same throwaway rows without threading a
 * value between them. Deliberately outside every fixture range — nothing else in the seed
 * uses a hand-written uuid — so a collision would be visible rather than subtle.
 *
 * Declared AFTER `CASES` and used inside it, which is safe because `args` and `setup` are
 * arrow functions the runner calls later. `const` hoists to the module's temporal dead
 * zone, not into it.
 */
const TREE_PROBE_PERSON = '00000000-0000-4000-8000-00000000e2ee'
const TREE_PROBE_REL    = '00000000-0000-4000-8000-00000000e2ef'

/** Throw on a PostgREST error rather than letting a broken fixture pass as an empty one. */
function must(result) {
  if (result.error) throw new Error(`setup: ${result.error.message}`)
  return result.data
}

async function probeRelationships(db, personId) {
  const { data, error } = await db
    .from('person_relationships')
    .select('id, person_id, related_person_id')
    .or(`person_id.eq.${personId},related_person_id.eq.${personId}`)
    .order('id')
  if (error) throw new Error(`probe: ${error.message}`)
  return JSON.stringify(data)
}

async function probeUnpins(db, announcementId) {
  const { data, error } = await db
    .from('announcement_unpins')
    .select('announcement_id, person_id')
    .eq('announcement_id', announcementId)
    .order('person_id')
  if (error) throw new Error(`probe: ${error.message}`)
  return JSON.stringify(data)
}

async function probeRead(db, ids) {
  const { data, error } = await db
    .from('notifications').select('id, read_at').in('id', ids).order('id')
  if (error) throw new Error(`probe: ${error.message}`)
  return JSON.stringify(data)
}

/**
 * Put ALPHA's family name back to what the fixture seeded.
 *
 * The runner calls `setup` before the attack's probe AND before the control's, so both
 * halves of a rename case start from the same value and can pass the same argument.
 * Service role, so it is not the thing under test — and it touches only family_name,
 * which is the only column on `families` anything may change (families_guard_family_code
 * refuses family_code for every role, including this one).
 */
const resetAlphaName = async (db) => {
  const { error } = await db.from('families')
    .update({ family_name: `${ALPHA} Family` }).eq('family_code', ALPHA)
  if (error) throw new Error(`setup: ${error.message}`)
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
 * The marker grant a copied template would carry across a family boundary.
 *
 * `admin/account/bank` for the same reason setTemplatePermission's case uses it —
 * nothing else in the suite reads it, so writing it here cannot change what a later
 * case sees. 'own' rather than 'any' so it is distinguishable from the blanket grant
 * the fixture puts on both Administrators templates.
 */
const markAlphaGeneralBankView = async (db, fx) => {
  const { error } = await db.from('template_permissions').upsert({
    template_id: fx.alpha.generalTemplateId,
    resource_key: 'admin/account/bank',
    action: 'view',
    scope: 'own',
  }, { onConflict: 'template_id,resource_key,action' })
  if (error) throw new Error(`setup: ${error.message}`)
}

/**
 * Every `admin/account/bank` grant in the fixture, named by the family and template
 * holding it.
 *
 * Deliberately spans BOTH families, because the leak createTemplate's copy could cause
 * does not mutate a row in ALPHA at all — it writes ALPHA's answers onto a brand new
 * BRAVO template. A probe scoped to ALPHA would watch the wrong side of the theft and
 * report "no-op — row untouched" over a stolen access map.
 *
 * Both and no more: a developer's local database holds whatever families they have made
 * by hand, and every one of them carries the two seeded templates. Including them turned
 * the failure this probe exists to report into a 6,000-character diff of rows that never
 * change.
 */
const bankGrantsProbe = async (db, fx) => {
  const { data, error } = await db
    .from('template_permissions')
    .select('action, scope, permission_templates!inner(family_code, name)')
    .eq('resource_key', 'admin/account/bank')
  if (error) throw new Error(`probe template_permissions: ${error.message}`)
  const fixture = [fx.alpha.familyCode, fx.bravo.familyCode]
  const rows = (data ?? [])
    .map(r => {
      const t = Array.isArray(r.permission_templates) ? r.permission_templates[0] : r.permission_templates
      return t && fixture.includes(t.family_code)
        ? `${t.family_code}/${t.name}/${r.action}=${r.scope}`
        : null
    })
    .filter(Boolean)
  return JSON.stringify(rows.sort())
}

/**
 * The remaining RLS-path actions: the writes, and the reads that take an id.
 *
 * The writes are the important half. A read that leaks is a confidentiality
 * failure; a write that lands is an integrity failure, and no code path in these
 * actions checks the family of the id it is handed — RLS is the only thing
 * standing between BRAVO's administrator and ALPHA's records.
 */

/**
 * The label every schedule created by a scope case carries, so the probe can find them
 * without knowing which family they landed in.
 *
 * ONE LABEL FOR BOTH HALVES, and the setup clears it before each: the attack must create
 * NOTHING, and the control must create exactly one row. A per-run label would make the
 * attack's row invisible to the control's probe, which is the vacuous-probe failure mode
 * AGENTS.md §7 warns about.
 */
const SCOPE_CASE_LABEL = 'scope-case dues'
const SCOPE_CASE_CHAPTER = 'scope-case chapter'

/** A dues schedule as `createDuesSchedule` takes one, with a scope pointed wherever. */
const scopedScheduleInput = (over) => ({
  label: SCOPE_CASE_LABEL,
  amount_cents: 1000,
  frequency: 'annual',
  due_month: null,
  due_day: null,
  start_date: null,
  end_date: null,
  description: null,
  kind: 'dues',
  goal_cents: null,
  start_age: null,
  bloodline_only: false,
  required: true,
  scope: 'national',
  region_id: null,
  chapter_id: null,
  beneficiary_person_ids: [],
  ...over,
})

const clearScopeCaseSchedules = async (db) => {
  const { error } = await db.from('dues_schedules').delete().eq('label', SCOPE_CASE_LABEL)
  if (error) throw new Error(`setup: ${error.message}`)
}

const clearScopeCaseChapters = async (db) => {
  const { error } = await db.from('chapters').delete().eq('name', SCOPE_CASE_CHAPTER)
  if (error) throw new Error(`setup: ${error.message}`)
}

/**
 * Put both families' spare chapters back: existing, and in their own family's spare region.
 *
 * RE-INSERTS BY ID rather than assuming the row is there, because one of the cases sharing
 * this setup DELETES it. Without that the case after it would probe a row that is gone and
 * read "unchanged" for both halves — a green tick over an assertion about nothing.
 */
const resetSpareChapters = async (db, fx) => {
  for (const side of ['alpha', 'bravo']) {
    const f = fx[side]
    const region = await db.from('regions').upsert({
      id: f.deletableRegion.id, family_code: f.familyCode, name: f.deletableRegion.name,
    })
    if (region.error) throw new Error(`setup: ${region.error.message}`)
    const chapter = await db.from('chapters').upsert({
      id: f.deletableChapter.id, family_code: f.familyCode,
      name: f.deletableChapter.name, region_id: f.deletableRegion.id,
    })
    if (chapter.error) throw new Error(`setup: ${chapter.error.message}`)
  }
}

/** Both families' scopable schedules back to National, so a re-scope is a visible change. */
const resetScopableSchedules = async (db, fx) => {
  const { error } = await db.from('dues_schedules')
    .update({ scope: 'national', region_id: null, chapter_id: null })
    .in('id', [fx.alpha.scopableSchedule.id, fx.bravo.scopableSchedule.id])
  if (error) throw new Error(`setup: ${error.message}`)
}

/**
 * Both families' spare chapters, in one string.
 *
 * The runner calls ONE probe for both halves of a case, and the cases that need this attack
 * BRAVO's row while the control moves ALPHA's — so a probe watching either alone would say
 * "unchanged" for the half it was not looking at. That is the second fixture failure mode
 * AGENTS.md §7 names, and it turns a real finding into a pass in both directions.
 */
const bothSpareChapters = async (db, fx) => {
  const { data, error } = await db.from('chapters').select('id, region_id')
    .in('id', [fx.alpha.deletableChapter.id, fx.bravo.deletableChapter.id]).order('id')
  if (error) throw new Error(`probe: ${error.message}`)
  return JSON.stringify(data)
}

/** Both families' scopable schedules, for the reason above. */
const bothScopableSchedules = async (db, fx) => {
  const { data, error } = await db.from('dues_schedules')
    .select('id, scope, region_id, chapter_id')
    .in('id', [fx.alpha.scopableSchedule.id, fx.bravo.scopableSchedule.id]).order('id')
  if (error) throw new Error(`probe: ${error.message}`)
  return JSON.stringify(data)
}

/** Both families' custom board positions back, since one case deletes one. */
const resetCustomRoles = async (db, fx) => {
  for (const side of ['alpha', 'bravo']) {
    const f = fx[side]
    const { error } = await db.from('family_roles').upsert({
      id: f.customRole.id, family_code: f.familyCode, name: f.customRole.name,
      category: 'appointed_position', scope: 'national', is_global: false,
      sort_order: f.customRole.sort_order,
    })
    if (error) throw new Error(`setup: ${error.message}`)
  }
}

export const MORE_CASES = [
  // ── reads taking an ALPHA id ──────────────────────────────────────────────
  // -- REGIONS & CHAPTERS ----------------------------------------------------
  //
  // Live since 2026-08-18. Every action in app/actions/admin/chapters.ts was written before
  // AGENTS.md §3 and §4 existed, and every one of them was a public HTTP endpoint the whole
  // time the ROUTE served Coming Soon — that gate withholds a page, never an action. Two
  // cross-family deletes, one unchecked reference and two ungated reads came back with the
  // page, and these cases are what would have caught each of them.
  //
  // CHECKED BY MUTATION, 2026-08-18, and the results are recorded because two of them are
  // not what a reading of the code would predict. Observed, not expected:
  //
  //   drop `belongsToFamily` from createChapter          FAIL  createChapter (region from …)
  //   drop both from setChapterRegion                    FAIL  setChapterRegion (region …)
  //   drop `scopeAttachedTo` from deleteChapter          FAIL  deleteChapter (a chapter …)
  //   drop `scopeAttachedTo` from deleteRegion           FAIL  deleteRegion (a region a due …)
  //   drop `belongsToFamily` from createDuesSchedule      FAIL  both create-scope cases
  //   drop `belongsToFamily` from updateDuesSchedule      FAIL  updateDuesSchedule (region …)
  //
  //   drop BOTH `family_code` conjuncts from deleteChapter    FAIL  (another family's chapter)
  //   drop ONLY the one on the existence read                 PASSES
  //
  // THAT PAIR IS THE FINDING. Each delete here has two conjuncts — one on the row it reads
  // first, one on the DELETE — and either alone is sufficient, so the case is evidence for
  // the PAIR and not for either. `deleteRegion` and `deleteCustomRole` behave identically,
  // and were mutated the same way. Do not "simplify" one of them away on the strength of a
  // green suite.
  //
  //   swap getRegions's guard for `requireMember()`           PASSES
  //   swap it for a bare `auth.getUser()` + getMyFamilyCode   FAIL  getRegions (pending member)
  //
  // AND THAT IS THE SECOND FINDING: no cross-family case can test a GRANT, because BRAVO's
  // administrator holds `admin/chapters` in BRAVO and the read is then correctly scoped
  // there whatever the guard says. Every permission-based guard also refuses an unapproved
  // caller (`resolveScope` answers 'none' the moment `approved` is false), so the only
  // mutation that reproduces the bug is the code that WAS there before 2026-08-18: a
  // session, a family code, and no check. The four PENDING cases further down are where
  // these guards are actually asserted, and all four fail under that mutation.
  read('admin/chapters.getRegions', 'app/actions/admin/chapters.ts', 'getRegions', {
    // THE CONTROL RUNS AS ALPHA'S ADMINISTRATOR, and that is the permission model being
    // honest rather than the fixture being bent: `admin/chapters` is an admin key, born
    // 'restricted' per family, so a plain member reads no regions and `[]` is their correct
    // answer. Same reason `announcements.getChapters` above is pinned the same way.
    positiveActor: 'alphaAdmin',
    expectPositive: (r, fx) => Array.isArray(r) && r.some(x => x.id === fx.alpha.region.id),
  }),
  // NO `positiveActor` HERE, deliberately, and the difference is worth reading. This one
  // gates on `requireMember()` rather than on the chapter grant, because /personal-info
  // offers every member a chapter to belong to and cannot do it without the list — so a
  // plain member IS the right control, and pinning it to the administrator would pass
  // whether or not that stayed true.
  read('admin/chapters.getChapters', 'app/actions/admin/chapters.ts', 'getChapters', {
    expectPositive: (r, fx) => Array.isArray(r) && r.some(x => x.id === fx.alpha.chapter.id),
  }),
  read('admin/chapters.getScopeUsage', 'app/actions/admin/chapters.ts', 'getScopeUsage', {
    positiveActor: 'alphaAdmin',
    // The occupied chapter has ALPHA's child in it, so the control has something to count.
    // Asserted on the FIGURE and not merely on the shape: `{ regions: {}, chapters: {} }` is
    // what a refused read returns, and it would satisfy any assertion about the keys.
    expectPositive: (r, fx) => r?.chapters?.[fx.alpha.occupiedChapter.id]?.members === 1,
    expectAttack: (r, fx) => !JSON.stringify(r ?? null).includes(fx.alpha.occupiedChapter.id),
  }),
  {
    kind: 'write',
    id: 'admin/chapters.createChapter (region from another family)',
    mod: 'app/actions/admin/chapters.ts', fn: 'createChapter',
    // §4 in its purest form: the chapter row lands in the ATTACKER's own family and so
    // satisfies every policy on `chapters`, while the `region_id` it carries points into
    // ALPHA. The foreign key constrains existence, not ownership, so the database is content
    // too — `belongsToFamily('regions', ...)` is the whole of the defence.
    args: fx => [SCOPE_CASE_CHAPTER, fx.alpha.region.id],
    // Both halves create a row, so the probe watches for a chapter carrying ALPHA's region.
    // The attack must add none; the control adds one in ALPHA.
    setup: clearScopeCaseChapters,
    probe: (db, fx) => snapshot('chapters', 'id, family_code, name, region_id',
      { region_id: fx.alpha.region.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: "admin/chapters.setChapterRegion (another family's chapter)",
    mod: 'app/actions/admin/chapters.ts', fn: 'setChapterRegion',
    // The attacker moves ALPHA's spare chapter out of its region. That row's family_code is
    // ALPHA's, so the `belongsToFamily('chapters', ...)` check and the `family_code` conjunct
    // on the UPDATE are the only things between BRAVO's administrator and rewriting it.
    args: fx => [fx.alpha.deletableChapter.id, null],
    setup: resetSpareChapters,
    probe: (db, fx) => snapshot('chapters', 'id, region_id',
      { id: fx.alpha.deletableChapter.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/chapters.setChapterRegion (region from another family)',
    mod: 'app/actions/admin/chapters.ts', fn: 'setChapterRegion',
    // The other id, and the other direction: BRAVO's administrator moves BRAVO's OWN chapter
    // into ALPHA's region. Every policy is satisfied — the row is genuinely theirs — so the
    // reference check is the only thing that can refuse it. §4 exactly, and the reason this
    // action checks BOTH of its ids.
    args: fx => [fx.bravo.deletableChapter.id, fx.alpha.region.id],
    setup: resetSpareChapters,
    // BOTH ROWS, because the runner uses ONE probe for both halves and the two halves
    // target different families: the attack must leave BRAVO's chapter alone, and the
    // control must move ALPHA's. A probe watching only the attacker's row would report the
    // control as a no-op and fail it for a reason that is not a bug.
    probe: bothSpareChapters,
    // The same call with ids that belong together: ALPHA's chapter, ALPHA's region. The
    // setup clears both, so the control has somewhere to move from.
    positiveActor: 'alphaAdmin',
    positiveArgs: fx => [fx.alpha.deletableChapter.id, fx.alpha.region.id],
  },
  {
    kind: 'write',
    id: "admin/chapters.deleteChapter (another family's chapter)",
    mod: 'app/actions/admin/chapters.ts', fn: 'deleteChapter',
    args: fx => [fx.alpha.deletableChapter.id],
    setup: resetSpareChapters,
    probe: (db, fx) => snapshot('chapters', 'id, name',
      { id: fx.alpha.deletableChapter.id })(db),
    positiveActor: 'alphaAdmin',
  },
  // ── THE GUARD'S JOB IS THE SENTENCE, so these two assert the sentence ──────
  //
  // NOT CROSS-FAMILY CASES, and not `kind: 'write'` either. Both are ALPHA's own
  // administrator — every grant the family can confer — asking to delete something
  // `lib/scope-attached.ts` refuses, and the reason they are read-shaped is a mutation
  // result rather than a preference:
  //
  //   disabling the `scopeAttachedTo` check in `deleteChapter` left a write-shaped case
  //   GREEN, because `people.chapter_id` is NO ACTION and the DATABASE refuses the delete
  //   too. The row survived either way, so the probe could not tell the two apart.
  //
  // So a probe cannot be evidence here. What the guard actually adds is a sentence naming
  // the fourteen relatives in the way instead of "violates foreign key constraint
  // people_chapter_id_fkey", and that is what these check. Disable either guard and the
  // message becomes the raw one; the regex fails.
  read('admin/chapters.deleteChapter (a chapter somebody is in)',
    'app/actions/admin/chapters.ts', 'deleteChapter', {
      attacker: 'alphaAdmin',
      args: fx => [fx.alpha.occupiedChapter.id],
      expectAttack: (r) => r?.success === false && /still has 1 member attached/.test(r.error ?? ''),
      positive: 'not-applicable',
      why: 'nobody may delete a chapter somebody is in — there is no more-entitled caller to run as, and the deletable-chapter case above proves the action can delete at all',
    }),
  {
    kind: 'write',
    id: "admin/chapters.deleteRegion (another family's region)",
    mod: 'app/actions/admin/chapters.ts', fn: 'deleteRegion',
    args: fx => [fx.alpha.deletableRegion.id],
    // THE PROBE WATCHES BOTH HALVES of what deleting a region does: the region going, and its
    // chapter arriving under National. That second half is the one reference in
    // `lib/scope-attached.ts` that PERMITS a delete rather than refusing it, and nothing pure
    // can test the rule — see the surviving mutation recorded in lib/scope-attached.test.ts.
    // This control is where it is asserted.
    setup: resetSpareChapters,
    probe: async (db, fx) => {
      const [regions, chapters] = await Promise.all([
        db.from('regions').select('id, name').eq('id', fx.alpha.deletableRegion.id),
        db.from('chapters').select('id, region_id').eq('id', fx.alpha.deletableChapter.id),
      ])
      if (regions.error || chapters.error) {
        throw new Error(`probe: ${regions.error?.message ?? chapters.error?.message}`)
      }
      return JSON.stringify([regions.data, chapters.data])
    },
    positiveActor: 'alphaAdmin',
  },
  // The money half of the same guard, read-shaped for the reason above. It also documents
  // why `dues_schedules.region_id` is NO ACTION rather than SET NULL: SET NULL would leave
  // `scope = 'regional'` with no region, which the CHECK from 20260817000008 refuses — so
  // the delete fails either way, with a message about a column nobody touched.
  //
  // The setup is inside the case rather than shared, because it is the only one that needs a
  // schedule pointed at a region, and `resetScopableSchedules` puts it back for the dues
  // cases further down.
  read('admin/chapters.deleteRegion (a region a dues schedule is scoped to)',
    'app/actions/admin/chapters.ts', 'deleteRegion', {
      attacker: 'alphaAdmin',
      args: fx => [fx.alpha.region.id],
      expectAttack: (r) => r?.success === false
        && /still has 1 dues schedule attached/.test(r.error ?? ''),
      positive: 'not-applicable',
      why: 'nobody may delete a region a due is scoped to — the deletable-region case above proves the action can delete at all',
    }),
  {
    kind: 'write',
    id: "admin/chapters.deleteCustomRole (another family's custom board position)",
    mod: 'app/actions/admin/chapters.ts', fn: 'deleteCustomRole',
    // `family_roles` is the HYBRID table AGENTS.md warns about: global rows carry a NULL
    // family_code and a family's own custom positions carry theirs. The action had
    // `.eq('id', id).eq('is_global', false)` and no family conjunct at all, so BRAVO's
    // administrator could delete ALPHA's custom position by id — the same shape as the two
    // deletes above, on a table nobody was looking at because /admin/boardpositions is still
    // Coming Soon. The ACTION was reachable regardless.
    args: fx => [fx.alpha.customRole.id],
    setup: resetCustomRoles,
    probe: (db, fx) => snapshot('family_roles', 'id, name, family_code',
      { id: fx.alpha.customRole.id })(db),
    positiveActor: 'alphaAdmin',
  },

  // -- A DUES SCHEDULE'S SCOPE IS TWO MORE IDS FROM THE CLIENT ----------------
  //
  // The "NOT COVERED" note at the foot of this file excused `createDuesSchedule` on the
  // grounds that it creates a row in the caller's own family and there is no other family's
  // id to supply. That was true until 20260817000008, which gave it a `region_id` and a
  // `chapter_id` — so the exemption is gone, and the note now says so.
  {
    kind: 'write',
    id: 'dues.createDuesSchedule (region from another family)',
    mod: 'app/actions/dues.ts', fn: 'createDuesSchedule',
    // THE USER CLIENT, so RLS is underneath this insert — and RLS checks the row, never the
    // ids the row references. The row's family_code is the attacker's own and every policy is
    // satisfied while `region_id` points into ALPHA.
    args: fx => [scopedScheduleInput({ scope: 'regional', region_id: fx.alpha.region.id })],
    setup: clearScopeCaseSchedules,
    probe: (db) => snapshot('dues_schedules',
      'id, family_code, label, scope, region_id, chapter_id', { label: SCOPE_CASE_LABEL })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'dues.createDuesSchedule (chapter from another family)',
    mod: 'app/actions/dues.ts', fn: 'createDuesSchedule',
    args: fx => [scopedScheduleInput({ scope: 'chapter', chapter_id: fx.alpha.chapter.id })],
    setup: clearScopeCaseSchedules,
    probe: (db) => snapshot('dues_schedules',
      'id, family_code, label, scope, region_id, chapter_id', { label: SCOPE_CASE_LABEL })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'dues.updateDuesSchedule (region from another family)',
    mod: 'app/actions/dues.ts', fn: 'updateDuesSchedule',
    // THE ADMIN CLIENT this time, so there is no policy underneath at all: the two
    // `family_code` conjuncts and the `belongsToFamily` call are the whole defence. The
    // attacker rewrites their OWN schedule to be owed by ALPHA's region, which every policy
    // permits because the row is genuinely theirs.
    args: fx => [fx.bravo.scopableSchedule.id, {
      scope: 'regional', region_id: fx.alpha.region.id, chapter_id: null,
    }],
    setup: resetScopableSchedules,
    // Both schedules, for the reason `bothSpareChapters` gives: one probe, two families.
    probe: bothScopableSchedules,
    // The same call with ids that belong together: ALPHA's schedule, ALPHA's region.
    positiveActor: 'alphaAdmin',
    positiveArgs: fx => [fx.alpha.scopableSchedule.id, {
      scope: 'regional', region_id: fx.alpha.region.id, chapter_id: null,
    }],
  },
  read('dues.getDuesScopeOptions', 'app/actions/dues.ts', 'getDuesScopeOptions', {
    // Gated on `admin/account/dues:view`, which ALPHA's General template does not hold — so
    // the control is the administrator. The attack is BRAVO's administrator, who holds it in
    // BRAVO and must still see none of ALPHA's places.
    positiveActor: 'alphaAdmin',
    expectPositive: (r, fx) => Array.isArray(r?.regions)
      && r.regions.some(x => x.id === fx.alpha.region.id)
      && r.chapters.some(x => x.id === fx.alpha.chapter.id),
  }),
  // ── AND THE RULE ITSELF, END TO END ────────────────────────────────────────
  //
  // NOT AN ISOLATION CASE, and the only one of these that is not. The arithmetic of who owes
  // a scoped due is `duesScopeMatch`, tested pure under `npm test` where a figure can be
  // checked at all (§7b) — but nothing there can say the action CALLS it, reads the right
  // column, or resolves a member's region through the right table. That is what this asserts,
  // through the real action against real policies.
  //
  // BOTH HALVES ARE INSIDE ALPHA, which is why the attacker/control pair reads oddly here:
  // `alphaMember` has no chapter, so the seeded regional due must NOT reach them, and
  // `alphaOther` is in ALPHA's chapter, which is in ALPHA's region, so it MUST. One
  // assertion without the other is worthless — the "absent" half passes for any reason at
  // all, including the schedule not existing.
  //
  // CHECKED BY MUTATION, and each half caught a different one. Observed:
  //   drop the `duesScopeMatch` conjunct from the filter    FAIL attack  (the due reaches
  //                                                          a member with no chapter)
  //   pass `false` for `familyChapterRegions`'s `needed`    FAIL control (the map is empty,
  //                                                          so nobody is in any region)
  //   never read `people.chapter_id`                        FAIL control (same shape, from
  //                                                          the other side)
  read('dues.getMyDuesSummary (a regional due skips a member with no chapter)',
    'app/actions/dues.ts', 'getMyDuesSummary', {
      attacker: 'alphaMember',
      expectAttack: (r, fx) => Array.isArray(r)
        && r.some(row => row.schedule.id === fx.alpha.schedule.id)
        && !r.some(row => row.schedule.id === fx.alpha.regionalSchedule.id),
      positiveActor: 'alphaOther',
      expectPositive: (r, fx) => Array.isArray(r)
        && r.some(row => row.schedule.id === fx.alpha.regionalSchedule.id),
    }),

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

  // ── Family Settings ───────────────────────────────────────────────────────
  // renameFamily() takes NO family identifier — the target is derived from
  // auth_family_code(), exactly as the policy derives it — so there is no ALPHA id for
  // BRAVO to pass and the usual "attacker supplies the owner's id" shape does not apply.
  // What these assert instead is that the derivation cannot be widened: a rename must
  // move ONE family's row, and ALPHA's must be that row for nobody but ALPHA.
  //
  // WHAT EACH OF THESE IS EVIDENCE FOR, established by mutation rather than asserted.
  // Three runs, 2026-08-12, each removing one layer and re-running the suite:
  //
  //   A. Every app-layer check deleted from renameFamily (requireEdit and the
  //      `.eq('family_code', …)` both gone), policies untouched
  //        → all three still PASS. The database alone refuses all of it.
  //
  //   B. A, plus the UPDATE policy stripped to `family_code = auth_family_code()`
  //        → the two grant cases FAIL with ROW MUTATED; cross-family still passes.
  //      So `auth_permission('admin/family','edit') = 'any'` is exactly what those two
  //      are evidence for, and it is not shared with the cross-family one.
  //
  //   C. B, plus `family_code = auth_family_code()` removed from the UPDATE policy
  //        → cross-family STILL passes. It only failed once the families SELECT policy
  //      was opened too, which is the finding worth writing down: `.select()` on the
  //      mutation is a scoping layer as well as an honesty one. Postgres ANDs the SELECT
  //      policy into an UPDATE that carries a RETURNING clause, so the `.select()` added
  //      to turn a silent no-op into a real failure ALSO confines the write to rows the
  //      caller may read. Three independent things therefore have to be dismantled
  //      before BRAVO can rename ALPHA — and the last of them cannot be removed without
  //      taking down the policy every read of `families` in the app depends on.
  read('admin/family.getFamilySettings', 'app/actions/admin/family.ts', 'getFamilySettings', {
    // A family name is not in alphaMarkers and a bare object cannot carry one, so the
    // default marker scan would pass here with no family filter at all. The codes are
    // the assertion: BRAVO's administrator holds admin/family in their OWN family, so
    // they get a perfectly legitimate answer — it just must not be ALPHA's.
    expectAttack: r => r === null || r.familyCode !== ALPHA,
    positiveActor: 'alphaAdmin',
    // `canRemove` and `status` joined this in 20260817000006's app layer, and both are
    // asserted rather than left to the shape: `canRemove` is a SECOND grant resolved
    // server-side so the removal section is not fetched for somebody who cannot use it
    // (§5), and `status` decides whether this page offers the control or reports that it
    // has already been used. A version of getFamilySettings that stopped resolving either
    // would hand the component `undefined` and render silently — the section would simply
    // never appear, which is the failure mode nobody notices.
    expectPositive: r =>
      r?.familyCode === ALPHA && r.canEdit === true
      && r.canRemove === true && r.status === 'active',
  }),
  {
    kind: 'write',
    id: 'admin/family.renameFamily (cross-family)',
    mod: 'app/actions/admin/family.ts', fn: 'renameFamily',
    args: () => ['Renamed by an outsider'],
    // Both halves start from the seeded name, so the same argument can be used for the
    // attack and the control: without this the control would be renaming a family the
    // attack had already left renamed, and "the probe did not move" would mean the
    // fixture agreeing with itself rather than the write being refused.
    setup: resetAlphaName,
    probe: db => snapshot('families', 'id, family_code, family_name', { family_code: ALPHA })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/family.renameFamily (same family, member with no grant)',
    mod: 'app/actions/admin/family.ts', fn: 'renameFamily',
    // The half family scoping cannot catch. alphaMember is inside the boundary and
    // approved; what has to refuse them is the grant — canAny() in the action, and
    // `auth_permission('admin/family','edit') = 'any'` in the policy. Naming the family
    // is family-wide configuration with no owner, so 'own' must not be a way in either.
    attacker: 'alphaMember',
    args: () => ['Renamed by a member with no grant'],
    setup: resetAlphaName,
    probe: db => snapshot('families', 'id, family_code, family_name', { family_code: ALPHA })(db),
    positiveActor: 'alphaAdmin',
  },

  // ── writes against ALPHA's rows ───────────────────────────────────────────
  // ── the four `children.*` write cases were REPLACED here, 2026-08-13 ──────
  // updateChild, deleteChild, acceptSpouseChild and convertChildToAdult all lapsed with
  // `app/actions/children.ts`. Two of the shapes they tested outlived them and are
  // carried below rather than dropped, which is the same reason `upsertSpouse` and
  // `upsertAncestor`'s cases moved onto `addRelative` instead of being deleted:
  //
  //   updateChild          -> editPersonRecord.  A write to somebody else's `people` row
  //                           addressed by a client-supplied id. It runs on the ADMIN
  //                           client now, so RLS is not underneath it at all and the
  //                           `.eq('family_code', …)` is the whole of the isolation.
  //   convertChildToAdult  -> invitePersonRecord. Same id, and it reaches further: a
  //                           success mints a real invitation into a family.
  //
  // acceptSpouseChild has no successor — there is no second parent to accept a child
  // from when a child is just a person on the tree.
  {
    kind: 'write',
    id: 'family-tree.editPersonRecord',
    mod: 'app/actions/family-tree.ts', fn: 'editPersonRecord',
    // BRAVO's administrator rewriting an ALPHA record by id. Nothing in the database
    // objects to the row itself — it is a perfectly ordinary people row — so the only
    // thing between this and a cross-family write is belongsToFamily plus the
    // family_code conjunct on the UPDATE.
    args: fx => [fx.alpha.child.id, { first_name: 'Pwned', last_name: 'Pwned' }],
    // Aimed at the SPARE row: the control genuinely renames it, and pointing both halves
    // at `child` would leave later cases asserting against a row this one had rewritten.
    positiveArgs: fx => [fx.alpha.deletableChild.id,
      { first_name: 'Renamed', last_name: 'ALPHATEST' }],
    // BOTH rows in the projection, because the attack and the control address different
    // ones and a snapshot of either alone cannot show both halves moving.
    probe: db => snapshot('people', 'id, first_name, last_name, gender',
      { family_code: 'ALPHATEST' })(db),
    // A PLAIN MEMBER, deliberately, and this is the case's second claim: the action is
    // self-service (requireMember) rather than grant-gated, so an ordinary member of
    // ALPHA must succeed here. If this control ever needs alphaAdmin to go green,
    // somebody has quietly made the tree administrator-only.
    positiveActor: 'alphaMember',
  },
  {
    kind: 'write',
    id: 'family-tree.invitePersonRecord',
    mod: 'app/actions/family-tree.ts', fn: 'invitePersonRecord',
    args: fx => [fx.alpha.child.id, 'pwned@rls.test'],
    probe: db => snapshot('family_invitations',
      'id, family_code, email, invited_person_id', { family_code: 'ALPHATEST' })(db),
    positive: 'not-applicable',
    why: 'a successful control mints a real invitation and mutates family_invitations for later cases; the attack half is what this guards',
  },
  {
    kind: 'write',
    id: 'family-tree.setRelationshipKind',
    mod: 'app/actions/family-tree.ts', fn: 'setRelationshipKind',
    // ALPHA's Father edge, by id. The row is an ordinary person_relationships row and the
    // action runs on the ADMIN client, so the only thing between BRAVO's administrator and
    // ALPHA's bloodline is the family_code test on the row it read.
    //
    // WHAT A SUCCESSFUL ATTACK WOULD DO is worth stating, because it is quieter than most:
    // it does not delete anything or reveal anything. It changes who another family counts
    // as descended from them, on a screen they will believe.
    args: fx => [fx.alpha.ancestorRelId, 'adopted'],
    positiveArgs: fx => [fx.alpha.ancestorRelId, 'foster'],
    // link_kind IS IN THE PROJECTION — the column the control changes. Leaving it out is
    // the failure mode AGENTS.md §7 names: the write succeeds, the probe cannot see it, and
    // a real change reads as a no-op.
    probe: (db, fx) => snapshot('person_relationships', 'id, link_kind',
      { id: fx.alpha.ancestorRelId })(db),
    // A plain member: recording a relationship is self-service, so correcting one is too.
    positiveActor: 'alphaMember',
  },
  {
    kind: 'write',
    id: 'family-tree.setRelationshipType',
    mod: 'app/actions/family-tree.ts', fn: 'setRelationshipType',
    // ALPHA's marriage, renamed by BRAVO's administrator. The third argument is the
    // SUBJECT — the person the word describes — and it is ALPHA's too, so a successful
    // attack would need both ids to have been taken on trust.
    args: fx => [fx.alpha.spouseRelId, 'Ex-Wife', fx.alpha.otherPersonId],
    positiveArgs: fx => [fx.alpha.spouseRelId, 'Ex-Wife', fx.alpha.otherPersonId],
    // relationship_type_id IS the column that moves, so it has to be in the projection —
    // §7's second failure mode, where a real write reads as a no-op because the probe
    // could not see it.
    probe: (db, fx) => snapshot('person_relationships', 'id, relationship_type_id, link_kind',
      { id: fx.alpha.spouseRelId })(db),
    positiveActor: 'alphaMember',
  },
  {
    kind: 'write',
    id: 'family-tree.setBloodlineAnchor',
    mod: 'app/actions/family-tree.ts', fn: 'setBloodlineAnchor',
    // BRAVO's administrator anchoring ALPHA's bloodline on an ALPHA person. Two things
    // have to hold and they are separate: the write must land on the caller's OWN
    // families row (the `.eq('family_code', …)`), and the id must be checked into that
    // family (§4). Neither is RLS — this runs on the admin client.
    args: fx => [fx.alpha.child.id],
    positiveArgs: fx => [fx.alpha.child.id],
    probe: db => snapshot('families', 'family_code, bloodline_anchor_id',
      { family_code: 'ALPHATEST' })(db),
    // NOT a plain member: this is family-wide configuration on `admin/family:edit`, the
    // same grant renameFamily uses. If alphaMember ever makes this control go green,
    // somebody has widened who may redefine the family's line.
    positiveActor: 'alphaAdmin',
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

  // ── moving money between funds ────────────────────────────────────────────
  // NOT an RLS-path write: transferBetweenFunds inserts through the service-role
  // client, like every other accounting action. Included for the reason
  // getElectionResults is — the family scoping RLS would have applied has to be
  // written by hand there, and these are the assertions that prove it was. There are
  // three, because there are three distinct ways to get at another family's money and
  // a different line of code stops each one.
  //
  // ALL THREE WERE RUN AGAINST A MUTATED BUILD before being called evidence, and the
  // second one turned up something worth writing down. Commands, from repo root, each
  // followed by `npm run test:rls` and then `npx supabase db reset`:
  //
  //   1. Drop `.eq('family_code', familyCode)` from the SOURCE fund lookup in
  //      transferBetweenFunds  → (cross-family) goes red.
  //   2. Drop `canAny(user.id, 'transactions/fund-transfers', 'create')`
  //                            → (member with no grant) goes red.
  //   3. Drop `.eq('family_code', familyCode)` from the DESTINATION lookup
  //                            → (one fund from each family) STAYS GREEN.
  //   4. As 3, plus
  //      `DROP TRIGGER fund_transfers_same_family ON public.fund_transfers;`
  //                            → it goes red, and BRAVO moves money into ALPHA's fund.
  //
  // So the §4 case is evidence for a PAIR — the action's check and 20260812000002 §4's
  // trigger — and either alone is sufficient. That is the intended design rather than a
  // gap (the trigger exists precisely because every accounting write runs through the
  // service role), but it means step 3 on its own proves nothing, and anyone re-running
  // this needs step 4 to see the case fail.
  {
    kind: 'write',
    id: 'funds.transferBetweenFunds (cross-family)',
    mod: 'app/actions/funds.ts', fn: 'transferBetweenFunds',
    // Both ends are ALPHA's. What must refuse this is the `.eq('family_code', …)` on
    // each fund lookup; without it the ids alone would be enough.
    args: fx => [{
      from_fund_id: fx.alpha.fund.id,
      to_fund_id: fx.alpha.secondFund.id,
      amount_cents: 1000,
      transferred_date: '2026-07-06',
      reason: 'attacker transfer',
    }],
    probe: db => snapshot('fund_transfers', 'id, from_fund_id, to_fund_id, amount_cents',
      { family_code: ALPHA })(db),
    // The control moves a DIFFERENT amount, so its row cannot be mistaken for the
    // attacker's having landed — and 1000 is well inside what the fixture leaves in
    // the source fund, which the action checks before it writes anything.
    positiveActor: 'alphaAdmin',
    positiveArgs: fx => [{
      from_fund_id: fx.alpha.fund.id,
      to_fund_id: fx.alpha.secondFund.id,
      amount_cents: 1100,
      transferred_date: '2026-07-06',
      reason: 'control transfer',
    }],
  },
  {
    kind: 'write',
    id: 'funds.transferBetweenFunds (one fund from each family)',
    mod: 'app/actions/funds.ts', fn: 'transferBetweenFunds',
    // THE §4 SHAPE, and the only case here that tests it. BRAVO's administrator moves
    // money out of their OWN fund and into ALPHA's — so the row is genuinely theirs,
    // its family_code is genuinely BRAVO, and every policy on the table is satisfied.
    // Nothing but the second `.eq('family_code', …)` in the action, and the trigger
    // 20260812000002 §4 puts behind it, decides this. Drop either and BRAVO can move
    // money into a fund it does not own — or, with the ids swapped, out of one.
    args: fx => [{
      from_fund_id: fx.bravo.fund.id,
      to_fund_id: fx.alpha.fund.id,
      amount_cents: 500,
      transferred_date: '2026-07-06',
      reason: 'cross-family transfer',
    }],
    // Probed on BOTH families: the row this attack would write is stamped BRAVO, so a
    // probe scoped to ALPHA would not see it land. That is the trap this case exists to
    // avoid — the damage is to ALPHA's balance, but the evidence is in BRAVO's ledger.
    probe: db => snapshot('fund_transfers', 'id, family_code, from_fund_id, to_fund_id', {})(db),
    positive: 'not-applicable',
    why: 'the arguments name a fund from each family by construction, so there is no caller for whom this call is legitimate; the cross-family case above carries the control that proves the action works at all',
  },
  {
    kind: 'write',
    id: 'funds.transferBetweenFunds (same family, member with no grant)',
    mod: 'app/actions/funds.ts', fn: 'transferBetweenFunds',
    // The half family scoping cannot catch. alphaMember is inside the boundary and
    // approved; what has to refuse them is the grant — canAny() in the action, and
    // `auth_permission('transactions/fund-transfers','create') = 'any'` in the INSERT
    // policy beneath it. A transfer has no owner, so 'own' must not be a way in either.
    attacker: 'alphaMember',
    args: fx => [{
      from_fund_id: fx.alpha.fund.id,
      to_fund_id: fx.alpha.secondFund.id,
      amount_cents: 700,
      transferred_date: '2026-07-06',
      reason: 'ungranted transfer',
    }],
    probe: db => snapshot('fund_transfers', 'id, from_fund_id, to_fund_id, amount_cents',
      { family_code: ALPHA })(db),
    positiveActor: 'alphaAdmin',
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
  // ── §4 ON THE *SECOND* ID addRelative TAKES ───────────────────────────────
  //
  // This replaces `spouse.upsertSpouse (links ALPHA person)` and
  // `ancestors.upsertAncestor (links ALPHA person)`, whose actions were deleted with the
  // per-member lineage view on 2026-08-13. Those two are the worked examples AGENTS.md §4
  // cites by name, so the shape they tested had to survive their removal — and it moved
  // to the action that inherited their job.
  //
  // IT IS A DIFFERENT VECTOR FROM `addRelative (cross-family anchor)` above, which is why
  // both exist. That one poisons the ANCHOR and dies on the first `belongsToFamily`. This
  // one gives a legitimate anchor — the attacker's OWN BRAVO row — and poisons the person
  // being linked TO it. The row written is genuinely BRAVO's, its family_code is genuinely
  // BRAVOTEST, and every policy on `person_relationships` is satisfied; only the second
  // `belongsToFamily` in `addRelative` stands between that and one family reaching into
  // another's tree. Delete it and the attack half passes with the anchor check intact.
  //
  // NO `setup`, deliberately: the attack is expected to write nothing, so the control
  // starts from the seeded state either way. `positiveArgs` is what makes the two halves
  // anchor on their OWN person — the whole point is that the anchor is never the flaw.
  //
  // The probe filters on `related_person_id`, so it sees the forward row and not the
  // inverse `addRelative` may also write (person_id = ancestor). That is deliberate: the
  // inverse is written only when the anchor has a recorded gender, and a probe that
  // depended on it would report a fixture detail as a security result.
  {
    kind: 'write',
    id: 'family-tree.addRelative (links ALPHA person to a BRAVO anchor)',
    mod: 'app/actions/family-tree.ts', fn: 'addRelative',
    args: fx => [{
      anchorPersonId: fx.users.bravoAdmin.personId,
      relationshipType: 'Brother',
      mode: 'existing',
      existingPersonId: fx.alpha.ancestor.id,
    }],
    positiveArgs: fx => [{
      anchorPersonId: fx.users.alphaMember.personId,
      relationshipType: 'Brother',
      mode: 'existing',
      existingPersonId: fx.alpha.ancestor.id,
    }],
    probe: (db, fx) => snapshot('person_relationships', 'id, person_id, related_person_id',
      { related_person_id: fx.alpha.ancestor.id })(db),
  },

  // ── people.chapter_id — §4 on the ONE table a member may write themselves ──
  //
  // The purest form of the §4 shape in the codebase, and the reason it survived so
  // long unnoticed: there is no cross-family row to point at. The attacker writes
  // ALPHA's chapter id onto THEIR OWN BRAVO people row. That row is genuinely theirs,
  // its family_code is genuinely BRAVO, and so every policy on `people` is satisfied —
  // while `chapter_id` now references a family they are not in. The FK is
  // `REFERENCES chapters(id)` and constrains existence, not ownership, so the database
  // is content too. Nothing but the action can catch it.
  //
  // These are NOT evidence about a policy, and should not be read as such: no conjunct
  // anywhere refuses them and none ever could. They are evidence about the
  // `chapterIsOurs` / `belongsToFamily('chapters', …)` guard in each action, which is
  // the whole of the defence. To see them fail, delete the guard from the action named
  // in `mod`/`fn` and re-run.
  //
  // The probe covers BOTH rows because attacker and control are different people and
  // the run does attack-then-control: the attack must leave both untouched, and the
  // control must move alphaMember's.
  ...[
    ['upsertPersonalInfo', fx => [{ first_name: 'Chap', last_name: 'Test', chapter_id: fx.alpha.chapter.id }]],
    ['saveChapterAndPropagate', fx => [fx.alpha.chapter.id]],
  ].map(([fn, args]) => ({
    kind: 'write',
    id: `personal-info.${fn} (chapter_id from another family)`,
    mod: 'app/actions/personal-info.ts', fn,
    args,
    // Cleared before each half so the control has somewhere to move from — without
    // this the attack's own reset would leave the value already set and the control's
    // write would read as a no-op.
    setup: async (db, fx) => {
      const { error } = await db.from('people').update({ chapter_id: null })
        .in('id', [fx.users.bravoAdmin.personId, fx.users.alphaMember.personId])
      if (error) throw new Error(`setup: ${error.message}`)
    },
    probe: async (db, fx) => {
      const { data, error } = await db.from('people').select('id, chapter_id')
        .in('id', [fx.users.bravoAdmin.personId, fx.users.alphaMember.personId]).order('id')
      if (error) throw new Error(`probe: ${error.message}`)
      return JSON.stringify(data)
    },
  })),

  // THE TWO ALLOW-LIST CASES. These assert something stronger and narrower than the
  // pair above: that `chapter_id` cannot reach a `people` row through these endpoints
  // AT ALL — not in another family, and not in the caller's own either. The column
  // came off lib/profile-columns.ts, so pickProfileColumns drops the key before either
  // action sees it, and saveChapterAndPropagate is the only way in.
  //
  // Both halves are therefore no-ops and the control is not applicable — the same
  // shape, and the same reason, as the membership_status self-approval case further
  // down: there is no more-entitled caller who may do this, because nobody may.
  // The §4 guard in each action survives as a second layer and is deliberately NOT
  // what these cases are aimed at; the guarded paths are covered above.
  //
  // To see them fail, put 'chapter_id' back on WRITABLE_PROFILE_COLUMNS and delete the
  // guard from the action — with the guard alone restored, the attack still passes and
  // only the control changes, which is the point of testing the two layers separately.
  ...[
    // THE PROBE WATCHES THE ATTACKER'S OWN ROW, not ALPHA's, and that is the whole
    // case: saveProfileSection takes no id and always writes the CALLER's row, so
    // bravoAdmin naming ALPHA's chapter corrupts bravoAdmin. Pointed at alphaMember
    // this passed while the mutation was in place — the write happened, in a row the
    // probe was not looking at. Exactly the vacuous-probe failure mode AGENTS.md §7
    // warns about, found by mutating rather than by reading.
    ['personal-info.saveProfileSection', 'app/actions/personal-info.ts', 'saveProfileSection',
      fx => [{ chapter_id: fx.alpha.chapter.id }], 'bravoAdmin'],
    // The admin route, and the worse of the two: it writes through the service-role
    // client, so there is no RLS underneath it and the allow-list is the whole of the
    // defence. BRAVO's admin updating their OWN family's member with ALPHA's chapter —
    // the target is legitimately theirs, so only the column check can refuse it.
    ['admin/users.updateUserProfile', 'app/actions/admin/users.ts', 'updateUserProfile',
      fx => [fx.users.bravoMember.personId, { chapter_id: fx.alpha.chapter.id }], 'bravoMember'],
  ].map(([id, mod, fn, args, target]) => ({
    kind: 'write',
    id: `${id} (chapter_id is not a profile column)`,
    mod, fn, args,
    setup: async (db, fx) => {
      const { error } = await db.from('people').update({ chapter_id: null })
        .eq('id', fx.users[target].personId)
      if (error) throw new Error(`setup: ${error.message}`)
    },
    probe: async (db, fx) => {
      const { data, error } = await db.from('people').select('id, chapter_id')
        .eq('id', fx.users[target].personId)
      if (error) throw new Error(`probe: ${error.message}`)
      return JSON.stringify(data)
    },
    positive: 'not-applicable',
    why: 'chapter_id is not on WRITABLE_PROFILE_COLUMNS, so no caller may set it here — saveChapterAndPropagate is the only way in and has its own case above',
  })),
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
  // The family-wide tree, which is now the only one — `ancestors.getFamilyMembers` was
  // this line until its module was deleted with the lineage view (2026-08-13). It is the
  // sharper test of the two anyway: `getFamilyTree` reads the WHOLE roster on the ADMIN
  // client, deliberately, so nothing but `requireRead('family-tree')` stands between an
  // unadmitted applicant and every name, gender and birthday in the family.
  read('family-tree.getFamilyTree (pending member)', 'app/actions/family-tree.ts', 'getFamilyTree', {
    attacker: 'alphaPending',
  }),
  read('chat.getFamilyMembersWithAccounts (pending member)', 'app/actions/chat.ts', 'getFamilyMembersWithAccounts', {
    attacker: 'alphaPending',
  }),

  // [crux] Tables covered by way of auth_permission() returning 'none'.
  // The family's money, to somebody the family has not admitted. `getFamilyDuesCollected`
  // gates on `canAny`, and a pending member resolves no template grants — so the honest
  // answer is `null`, not `0`. The distinction is the whole design of that action: 0 would
  // say "your family has collected nothing", which is a different and false claim.
  //
  // The default marker scan cannot judge a number (see the main case above), so this
  // asserts the refusal directly.
  //
  // [not evidence for the family conjunct] Verified by removing it: the attack half of
  // this case still passed at 35000-leak time, because `canAny` in the action refuses a
  // pending caller before any policy is consulted. It is evidence for the GUARD, which is
  // the layer it is aimed at — the conjunct is covered by the main case above, which does
  // go red. Labelled here rather than deleted, so the gap stays visible.
  read('dues.getFamilyDuesCollected (pending member)', 'app/actions/dues.ts', 'getFamilyDuesCollected', {
    attacker: 'alphaPending',
    expectAttack: (r) => r === null,
    expectPositive: (r, fx) =>
      r === fx.alpha.payment.amount_cents + fx.alpha.hiddenDonationPayment.amount_cents,
  }),
  // Every member's outstanding balance, by name, to somebody the family has not admitted.
  // `getDuesProjection` gates on `canAny`, and a pending member resolves no template grant
  // — so the honest answer is `null` rather than a zeroed shape, for the reason
  // getFamilyDuesCollected returns null above: an empty projection reads as "your family
  // owes nothing", which is a different and false claim.
  //
  // [not evidence for the family conjuncts] Same labelling as the case above it, and for
  // the same reason: the guard refuses a pending caller before any query runs, so this half
  // would pass with every `.eq('family_code', …)` removed. It is evidence for the GUARD.
  // The conjuncts are covered by the main case, which does go red.
  read('dues.getDuesProjection (pending member)', 'app/actions/dues.ts', 'getDuesProjection', {
    attacker: 'alphaPending',
    // Entitled, for the reason the main case above states: this key is restricted and a
    // plain member does not hold it.
    positiveActor: 'alphaAdmin',
    expectAttack: (r) => r === null,
    expectPositive: (r, fx) =>
      r !== null && r.people.some(p => p.id === fx.users.alphaMember.personId),
  }),
  read('announcements.getAnnouncements (pending member)', 'app/actions/announcements.ts', 'getAnnouncements', {
    attacker: 'alphaPending',
  }),

  // ── REGIONS & CHAPTERS, to somebody the family has not admitted ────────────
  //
  // [crux for the GUARDS, and the only axis that can be] The cross-family cases on these
  // actions cannot test a grant at all: BRAVO's administrator holds `admin/chapters` in
  // BRAVO, so `g.familyCode` resolves to BRAVO and the read is correctly scoped there
  // whatever the guard says. Verified by mutating `getRegions`'s guard down to
  // `requireMember()` — all four cross-family assertions stayed green.
  //
  // An applicant is inside ALPHA's boundary by every test those cases apply, so these are
  // where the guards are actually asserted. Each returns an EMPTY answer rather than
  // throwing, which is why the markers scan is the assertion.
  read('admin/chapters.getRegions (pending member)', 'app/actions/admin/chapters.ts', 'getRegions', {
    attacker: 'alphaPending',
    positiveActor: 'alphaAdmin',
    expectAttack: (r) => Array.isArray(r) && r.length === 0,
    expectPositive: (r, fx) => Array.isArray(r) && r.some(x => x.id === fx.alpha.region.id),
  }),
  // THE SHARPEST OF THE THREE, because this one is deliberately open to every APPROVED
  // member — /personal-info offers them a chapter and cannot without the list — so
  // `requireMember()` is the whole of the gate and there is no grant underneath it to catch
  // a mistake. It is also the check the function did not have before 2026-08-18: it demanded
  // a session and nothing else.
  read('admin/chapters.getChapters (pending member)', 'app/actions/admin/chapters.ts', 'getChapters', {
    attacker: 'alphaPending',
    expectAttack: (r) => Array.isArray(r) && r.length === 0,
    expectPositive: (r, fx) => Array.isArray(r) && r.some(x => x.id === fx.alpha.chapter.id),
  }),
  read('admin/chapters.getScopeUsage (pending member)', 'app/actions/admin/chapters.ts', 'getScopeUsage', {
    attacker: 'alphaPending',
    positiveActor: 'alphaAdmin',
    expectAttack: (r) => Object.keys(r?.chapters ?? {}).length === 0,
    expectPositive: (r, fx) => r?.chapters?.[fx.alpha.occupiedChapter.id]?.members === 1,
  }),
  read('dues.getDuesScopeOptions (pending member)', 'app/actions/dues.ts', 'getDuesScopeOptions', {
    attacker: 'alphaPending',
    positiveActor: 'alphaAdmin',
    expectAttack: (r) => (r?.regions?.length ?? 0) === 0 && (r?.chapters?.length ?? 0) === 0,
    expectPositive: (r, fx) => r.regions.some(x => x.id === fx.alpha.region.id),
  }),
  {
    kind: 'write',
    id: 'admin/chapters.createRegion (pending member)',
    mod: 'app/actions/admin/chapters.ts', fn: 'createRegion',
    attacker: 'alphaPending',
    // An applicant naming a region in the family they are waiting to join. `regions` has no
    // INSERT policy at all, so this write goes through the service-role client and the guard
    // is the ONLY thing in the way — there is no policy underneath to catch it.
    args: () => ['scope-case region'],
    setup: async (db) => {
      const { error } = await db.from('regions').delete().eq('name', 'scope-case region')
      if (error) throw new Error(`setup: ${error.message}`)
    },
    probe: (db) => snapshot('regions', 'id, family_code, name', { name: 'scope-case region' })(db),
    positiveActor: 'alphaAdmin',
  },
  read('documents.getDocuments (pending member)', 'app/actions/documents.ts', 'getDocuments', {
    attacker: 'alphaPending',
  }),
  read('photos.getPhotoCollections (pending member)', 'app/actions/photos.ts', 'getPhotoCollections', {
    attacker: 'alphaPending',
  }),
  read('funds.getFunds (pending member)', 'app/actions/funds.ts', 'getFunds', {
    attacker: 'alphaPending',
  }),
  // NOT [crux], and labelled so rather than left looking like evidence. The SELECT
  // policy on fund_transfers does carry `auth_membership_approved()` (20260812000002
  // §6), but neutering it changes nothing here: the conjunct beside it demands
  // `auth_permission('transactions/fund-transfers','view') = 'any'`, auth_permission()
  // resolves through auth_person_id(), and auth_person_id() already returns NULL for
  // anyone not approved. The applicant is refused twice over and this case cannot tell
  // which refusal did it.
  //
  // Kept because it is the regression guard on the pair holding together — a later
  // migration that rewrites this policy and drops one of the two would have the other
  // still standing, and the case that notices is the one that runs the whole path.
  //
  // Control is the ADMIN: a plain member holds no view grant either and would get [],
  // making the case assert nothing. Same substitution, same reason, as
  // dues.getScheduleUsage below.
  read('funds.getFundTransfers (pending member)', 'app/actions/funds.ts', 'getFundTransfers', {
    attacker: 'alphaPending',
    positiveActor: 'alphaAdmin',
    expectPositive: (r, fx) => Array.isArray(r) && r.some(t => t.id === fx.alpha.transfer.id),
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
  // A pending caller can work no queue anywhere, so this must come back empty.
  //
  // [crux] for the GRANT CHECK, and NOT for the approval conjunct — which is the opposite
  // of what it looks like and was settled by running both mutations rather than by reading
  // the code. Dropping `workable`'s `scopeInFamilies` filter fails this case at once: the
  // action reads on the service role, so with no grant test there is no policy underneath
  // to refuse an applicant ALPHA's queue depth.
  //
  // Removing `scopeInFamilies`' own `isApproved` filter, however, changes NOTHING here —
  // the applicant is already refused one layer further on, because 20260806000010 sets
  // `admin/approvals` to 'restricted' for every family and the General template they are
  // auto-assigned grants them nothing on it. So this is not evidence for the approval
  // conjunct; that filter earns its place by not resolving a template for somebody who
  // holds no membership to act through, which is a different argument and one this suite
  // does not make. Said out loud rather than left looking like proof, per §7.
  read('admin/approvals.getPendingApprovalQueues (pending member)',
    'app/actions/admin/approvals.ts', 'getPendingApprovalQueues', {
      attacker: 'alphaPending',
      expectAttack: r => Array.isArray(r) && r.length === 0,
      // The ADMIN, not the default plain member: alphaMember holds no approvals grant
      // either and would also get [], making the control assert nothing. Same
      // substitution and the same reason as dues.getScheduleUsage below.
      positiveActor: 'alphaAdmin',
      expectPositive: r => Array.isArray(r) && r.length === 1 && r[0].count === 3,
    }),
  // The shell fingerprint the applicant's own browser polls while it waits to be admitted
  // (components/layout/ShellWatcher.tsx). It MUST answer for a pending caller — that is
  // the entire point of it, and it is the one read here whose positive control is the
  // pending member rather than a check that they are refused.
  //
  // What it must not do is describe anybody else. It takes no arguments and derives
  // everything from the session, so the assertion is that ALPHA's applicant sees ALPHA's
  // own code and nothing of BRAVO's, and vice versa.
  //
  // NOT [crux], and worth saying so: the isolation here is `getMyFamilies`'
  // `.eq('user_id', …)`, which about forty other cases in this file already lean on — a
  // mutation to it fails most of the suite, not this. What this case actually holds is the
  // CONTRACT the watcher depends on: that a pending caller gets a non-empty fingerprint
  // (return '' for them and the shell stops watching, which is the bug it exists to fix)
  // and that the string carries the membership status, which is the thing that changes on
  // approval. Narrow the fingerprint back to, say, the template id alone, and this is what
  // notices.
  read('membership.getMyShellState (pending member)', 'app/actions/membership.ts', 'getMyShellState', {
    attacker: 'alphaPending',
    expectAttack: r => typeof r?.fingerprint === 'string'
      && r.fingerprint.includes('ALPHATEST:pending')
      && !r.fingerprint.includes('BRAVOTEST'),
    positiveActor: 'alphaAdmin',
    expectPositive: r => typeof r?.fingerprint === 'string'
      && r.fingerprint.includes('ALPHATEST:approved')
      && !r.fingerprint.includes('BRAVOTEST'),
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

  // [crux] The same shape as castVote, and for the same reason: `editPersonRecord` is
  // self-service, so there is NO GRANT to withhold — being an approved member is the
  // entire authorization, and `requireMember()` is the only thing an applicant fails.
  //
  // It is the sharper of the two because of what the action runs on. It writes through
  // the ADMIN client (the `people` UPDATE policy admits only a member's own row, so the
  // user client could not touch a record belonging to nobody), which means RLS is not
  // underneath this at all. Neuter the membership gate and somebody who has merely typed
  // the family code can rewrite the name, birthday and gender of every unclaimed person
  // in a family that has not admitted them — with no policy anywhere to object.
  {
    kind: 'write',
    id: 'family-tree.editPersonRecord (pending member)',
    mod: 'app/actions/family-tree.ts', fn: 'editPersonRecord',
    attacker: 'alphaPending',
    args: fx => [fx.alpha.child.id, { first_name: 'Pending', last_name: 'Pwned' }],
    probe: (db, fx) => snapshot('people', 'id, first_name, last_name',
      { id: fx.alpha.child.id })(db),
    positive: 'not-applicable',
    why: 'an approved member editing this row is asserted by the cross-family editPersonRecord case above, whose control is alphaMember',
  },

  // [crux] Same shape as editPersonRecord above and the same argument: self-service, so
  // no grant is being withheld, and it writes on the ADMIN client so no policy is
  // underneath it. An applicant who has merely typed the family code could otherwise
  // rewrite which of a family's children it counts as its own.
  {
    kind: 'write',
    id: 'family-tree.setRelationshipKind (pending member)',
    mod: 'app/actions/family-tree.ts', fn: 'setRelationshipKind',
    attacker: 'alphaPending',
    args: fx => [fx.alpha.ancestorRelId, 'step'],
    probe: (db, fx) => snapshot('person_relationships', 'id, link_kind',
      { id: fx.alpha.ancestorRelId })(db),
    positive: 'not-applicable',
    why: 'an approved member changing this row is asserted by the cross-family setRelationshipKind case above, whose control is alphaMember',
  },

  // NOT [crux], and labelled so rather than left looking like evidence. An applicant is
  // refused a rename by holding no admin/family:edit grant — which is true of every
  // ordinary member, approved or not — so neuter the approval conjunct and this still
  // passes: alphaPending sits on the General template, whose grid states 'none' here.
  //
  // Kept because auth_family_code() resolves ALPHATEST for an applicant deliberately
  // and permanently, so the family scoping inside renameFamily() would scope TO ALPHA
  // quite happily; the grant check and the policy's `= 'any'` are the whole of what
  // stands between somebody who has merely typed the family code and the name every
  // member of that family sees.
  {
    kind: 'write',
    id: 'admin/family.renameFamily (pending member)',
    mod: 'app/actions/admin/family.ts', fn: 'renameFamily',
    attacker: 'alphaPending',
    args: () => ['Renamed by an applicant'],
    setup: resetAlphaName,
    probe: db => snapshot('families', 'id, family_code, family_name', { family_code: ALPHA })(db),
    positiveActor: 'alphaAdmin',
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
 * PHASE 3'S LAST STRUCTURAL GAP — the policies no server action can reach.
 *
 * ── WHY THESE LOOK DIFFERENT FROM EVERY OTHER CASE ──────────────────────────────────
 * They name `tests/rls/raw/sweep.mjs` as their module instead of an action under `app/`.
 * That module speaks PostgREST directly, as the current actor, using the same real JWT the
 * `@/lib/supabase/server` stub already builds — see `tests/rls/raw.mjs` for the full
 * argument, and note that it substitutes NOTHING, so `hooks.mjs`'s "three jobs and
 * deliberately no more than three" is untouched.
 *
 * The reason is structural rather than a shortcut. `20260806000011` §6 added
 * `auth_membership_approved()` to every policy whose only conjunct was
 * `family_code = auth_family_code()`, and what that closes is an APPLICANT — somebody
 * inside the family boundary whom the family has not admitted. The sharpest of those
 * policies is `notifications` INSERT, and it is deliberately reachable by no action at all:
 * notifications are written only by `lib/notifications.ts`, a plain module with no URL,
 * precisely so nothing exposes an arbitrary-recipient notifier. So the action-shaped suite
 * could not reach the thing protecting it, and `UNCOVERED` below said so from Phase 3 until
 * these cases were written on 2026-08-17.
 *
 * ── WHAT USED TO STAND IN FOR THEM, AND WHY IT NO LONGER DOES ───────────────────────
 * §8 of that migration recomputes the swept table list and RAISEs if a policy on any of
 * them lacks the conjunct. That was a real check and it has EXPIRED: its hard-coded half
 * names `user_groups`, `user_group_members` and `group_permissions`, and `20260807000000`
 * renamed the first two and dropped the other two outright. It is therefore a point-in-time
 * assertion — correct on a full replay, and impossible to re-run against today's schema.
 * Worse, `permission_templates` and `template_permissions` are not in the sweep set at all:
 * their policies carry the conjunct because `20260807000000` wrote them that way, and
 * nothing in the chain asserts it. These cases are what covers all of that now.
 *
 * ── THE ATTACKER, AND WHY THE CONTROL MATTERS MORE HERE THAN USUAL ──────────────────
 * `alphaPending` throughout: an applicant in ALPHA, for whom `auth_family_code()` resolves
 * ALPHATEST deliberately and permanently. So the family conjunct in every policy below is
 * SATISFIED for them, and the approval conjunct is the only thing refusing — which is
 * exactly what makes these evidence for it.
 *
 * The control is `alphaMember`, and it is load-bearing rather than ceremonial: a probe that
 * returned `[]` for everybody (a renamed column, an unattached JWT, a PostgREST refusal for
 * some other reason) would pass every attack assertion trivially.
 *
 * ── MUTATION-CHECKED 2026-08-17, AND THE RESULT IS A MAP ────────────────────────────
 * Two mutations were run, cumulatively, each re-creating one function without its
 * `membership_status = 'approved'` conjunct, followed by `npm run test:rls raw:`:
 *
 *   M1  public.auth_membership_approved()   the conjunct §6 swept in
 *   M2  public.auth_person_id()             the other Phase 3 gate — an applicant
 *                                           resolves to NO person, which collapses every
 *                                           own/self expression AND makes
 *                                           auth_permission() return 'none'
 *
 * What went red, measured rather than read off the policies:
 *
 *   under M1   permission_templates · template_permissions · resource_visibility
 *              person_relationships · notifications INSERT
 *   under M2   + event_rsvp · event_assignments
 *   never      chat_participants · user_roles
 *
 * So the nine cases are evidence for THREE different layers, and each is labelled with
 * the one it actually tests. That distinction is the whole value of having run the
 * mutation instead of trusting the migration: five of these protect the table by the
 * conjunct §6 added, two protect it by `auth_person_id()` collapsing the permission
 * lookup, and two are refused before either is consulted. A block that claimed all nine
 * were evidence for the sweep would be wrong about four of them.
 *
 * ── AND THE MUTATION FOUND A BUG IN THE HARNESS, WHICH IS THE POINT ─────────────────
 * On the first run the notifications case stayed GREEN under M1, which should have been
 * impossible — its INSERT policy is `family AND true AND auth_membership_approved()` and
 * nothing else. The cause was `rawInsert` calling `.select()`: PostgreSQL ANDs the SELECT
 * policy into any INSERT carrying a RETURNING clause, and `notifications`' SELECT policy
 * admits only rows addressed to the caller, so the statement failed on the RETURNING with
 * the INSERT policy already neutered. The case was evidence for nothing. `raw.mjs` no
 * longer selects, and the case now trips under M1 as it must. A green run really is not
 * evidence until it has been seen to fail.
 */
export const SWEEP_CASES = [
  // ── (b) tables: family scoping was the whole of the question before §6 ─────────────
  //
  // [crux] The family's entire access map, to somebody the family has not admitted. NOT in
  // the sweep set at all — 20260807000000 wrote these policies with the conjunct itself and
  // nothing in the chain checks it, so this pair is the only assertion anywhere that they
  // still carry it.
  read('raw:permission_templates SELECT (applicant)', 'tests/rls/raw/sweep.mjs', 'selectPermissionTemplates', {
    attacker: 'alphaPending',
    expectAttack: (r) => r.count === 0,
    expectPositive: (r) => r.count > 0,
  }),
  read('raw:template_permissions SELECT (applicant)', 'tests/rls/raw/sweep.mjs', 'selectTemplatePermissions', {
    attacker: 'alphaPending',
    expectAttack: (r) => r.count === 0,
    expectPositive: (r) => r.count > 0,
  }),
  // Which pages this family has switched off — a map of how the family is organized.
  read('raw:resource_visibility SELECT (applicant)', 'tests/rls/raw/sweep.mjs', 'selectResourceVisibility', {
    attacker: 'alphaPending',
    expectAttack: (r) => r.count === 0,
    expectPositive: (r) => r.count > 0,
  }),
  // [crux] The whole family tree — every person and how they are related. The action-level
  // case `family-tree.getFamilyTree (pending member)` covers the GUARD on that page; this
  // covers the policy underneath, which is what protects the table from a direct call.
  read('raw:person_relationships SELECT (applicant)', 'tests/rls/raw/sweep.mjs', 'selectPersonRelationships', {
    attacker: 'alphaPending',
    expectAttack: (r) => r.count === 0,
    expectPositive: (r) => r.count > 0,
  }),

  // [crux] THE HEADLINE, and the case this whole harness exists for: an unadmitted
  // applicant writing a title and a LINK into another member's bell. `kind: 'write'`, so
  // the probe is what judges it — a refusal and a landed row are the two outcomes and the
  // error alone could not tell them apart.
  {
    kind: 'write',
    id: 'raw:notifications INSERT (applicant reaching every bell)',
    mod: 'tests/rls/raw/sweep.mjs', fn: 'insertNotification',
    attacker: 'alphaPending',
    // The applicant's OWN family and one of its real members. The claim is not that they
    // cross a family boundary — they do not — it is that they reach their own family's
    // members without having been admitted to it.
    args: fx => ['ALPHATEST', fx.alpha.ownerPersonId],
    // FILTERED ON THE MARKER TITLE, not counted. The fixture seeds notifications of its
    // own, so a count would move for reasons unrelated to this probe; the title is written
    // by the probe and by nothing else.
    probe: (db) => snapshot('notifications', 'id, title, recipient_id',
      { title: SWEEP_NOTIFICATION_TITLE })(db),
    // And a member of the family genuinely MAY notify another member — that is what the
    // policy says, and what `lib/notifications.ts` relies on. Without this half, a policy
    // that refused everybody would pass the attack assertion and the case would be
    // decoration.
    positiveActor: 'alphaMember',
    // Each half of a write case re-snapshots, so the row the control lands has to be gone
    // before the next half reads the table. The attack leaves nothing behind by
    // construction; the control does, so it is cleared here — the same job `resetAlphaName`
    // does further up, and necessary because `notifications` has no append-only guard to
    // make the leftover row someone else's problem.
    setup: async (db) => {
      await db.from('notifications').delete().eq('title', SWEEP_NOTIFICATION_TITLE)
    },
  },

  // ── (a) tables: a self branch OR-ed OUTSIDE the permission check ──────────────────
  // The subtler half of the sweep. Each policy reads roughly "family AND (this row is mine
  // OR I hold the grant) AND approved" — and the middle disjunct is what an applicant
  // could satisfy, because a row genuinely theirs is still theirs.
  //
  // THE MUTATION SPLIT THESE FOUR INTO THREE ANSWERS. Read the header first; each label
  // below records which layer the case is actually evidence for, and only two of the four
  // are evidence for the sweep at all.

  // [not evidence for §6, nor for auth_person_id] Green under BOTH mutations. The policy
  // leads with `auth_uid_is_room_participant(room_id)`, and the applicant is in no room —
  // the fixture adds only the owner and the other member — so that call refuses before
  // either Phase 3 gate is reached. It is a real assertion about a real protection, just
  // not about this one. The function it IS evidence for is the SECURITY DEFINER one
  // AGENTS.md §2b calls load-bearing for chat because Realtime evaluates it with no call
  // site in the tree; this is the only test of it anywhere.
  read('raw:chat_participants SELECT (applicant)', 'tests/rls/raw/sweep.mjs', 'selectChatParticipants', {
    attacker: 'alphaPending',
    expectAttack: (r) => r.count === 0,
    expectPositive: (r) => r.count > 0,
  }),
  // [evidence for auth_person_id(), not for §6] Green under M1 and red under M2, and the
  // reason is worth knowing: `events` is not an admin key, so General grants view 'any' on
  // it — the permission disjunct WOULD admit the applicant. What stops it is that
  // `auth_person_id()` is NULL for them, which makes `auth_permission()` return 'none'
  // before the grant is ever consulted. Two gates, and this table is held by the other one.
  read('raw:event_rsvp SELECT (applicant)', 'tests/rls/raw/sweep.mjs', 'selectEventRsvp', {
    attacker: 'alphaPending',
    expectAttack: (r) => r.count === 0,
    expectPositive: (r) => r.count > 0,
  }),
  // [evidence for auth_person_id(), not for §6] Same shape as event_rsvp above.
  read('raw:event_assignments SELECT (applicant)', 'tests/rls/raw/sweep.mjs', 'selectEventAssignments', {
    attacker: 'alphaPending',
    expectAttack: (r) => r.count === 0,
    expectPositive: (r) => r.count > 0,
  }),
  // [not evidence for §6, nor for auth_person_id] Green under both, and this one is the
  // PERMISSION layer doing the work: the disjunct needs
  // `auth_permission('admin/boardpositions', 'view') = 'any'`, the applicant holds General,
  // and General's grid says 'none' for every admin key. So the case is evidence that a
  // plain template cannot read the board roster — which is worth asserting and is a
  // different claim from the one this block is named for.
  read('raw:user_roles SELECT (applicant)', 'tests/rls/raw/sweep.mjs', 'selectUserRoles', {
    attacker: 'alphaPending',
    expectAttack: (r) => r.count === 0,
    // ALPHA's administrator, not a plain member, and for exactly the reason above: the
    // grant is what admits the read, and only the Administrators template holds it.
    positiveActor: 'alphaAdmin',
    expectPositive: (r) => r.count > 0,
  }),

  // ── The two guards on `people`, reached where only a raw call can reach them ───────
  //
  // [not evidence for the §6 sweep] Both stay green under the mutation named above,
  // deliberately: they are evidence for a TRIGGER, and their own mutation is
  // `DROP TRIGGER people_guard_membership_status ON public.people` (and the template one),
  // after which both must go red. Labelled rather than moved, because they belong beside
  // the probes that can reach them and nowhere else in this file can.
  //
  // WHY THEY ARE NOT ALREADY COVERED: `personal-info.saveProfileSection (pending member
  // self-approving)` above tests the same intent through the action, and there
  // `pickProfileColumns` strips the column before any SQL runs — so the trigger is never
  // reached and that case is evidence for the ALLOW-LIST. A raw PATCH is what exercises the
  // guard itself.
  {
    kind: 'write',
    id: 'raw:people PATCH membership_status (applicant approving themselves)',
    mod: 'tests/rls/raw/sweep.mjs', fn: 'selfApprove',
    attacker: 'alphaPending',
    // THEIR OWN ROW, which the `people` UPDATE policy genuinely admits them to write. That
    // is the whole point: family isolation is not what is being tested here, the column
    // boundary is.
    args: fx => [fx.users.alphaPending.personId],
    probe: (db, fx) => snapshot('people', 'id, membership_status',
      { id: fx.users.alphaPending.personId })(db),
    positive: 'not-applicable',
    why: 'the guard refuses this column for the `authenticated` role outright, so no caller has a legitimate raw PATCH to run; set_membership_status() is the only way in and admin/approvals.approveApplicant exercises it',
  },
  {
    kind: 'write',
    id: 'raw:people PATCH permission_template_id (applicant promoting themselves)',
    mod: 'tests/rls/raw/sweep.mjs', fn: 'selfPromote',
    attacker: 'alphaPending',
    // ALPHA's own Administrators template, so nothing about this is cross-family either.
    args: fx => [fx.users.alphaPending.personId, fx.alpha.adminTemplateId],
    probe: (db, fx) => snapshot('people', 'id, permission_template_id',
      { id: fx.users.alphaPending.personId })(db),
    positive: 'not-applicable',
    why: 'people_guard_permission_template refuses the `authenticated` role outright; apply_permission_template() is the only way in and admin/permissions.applyTemplate exercises it',
  },

  // ── The fail-closed admin default (20260817000004) ────────────────────────────────
  //
  // [not evidence for the §6 sweep] Its own mutation is restoring
  // `COALESCE(…, 'everyone')` in `auth_permission()`'s default branch, after which the
  // attack half below returns 'any' and goes red.
  //
  // WHY A SYNTHETIC KEY. Every admin key that EXISTS carries an explicit `'restricted'`
  // visibility row and an explicit grid cell, so no real key reaches the default branch at
  // all — which is why the flip was a no-op on live data and why no existing case can be
  // evidence for it. The honest test needs a key nobody has backfilled, which is precisely
  // the state a future migration's omission would produce.
  {
    kind: 'read',
    id: 'raw:auth_permission — an unbackfilled ADMIN key denies view',
    mod: 'tests/rls/raw/sweep.mjs', fn: 'permissionFor',
    // A plain APPROVED member, not an applicant: an applicant resolves 'none' for
    // everything through auth_person_id() and would pass this without the default branch
    // being consulted at all.
    attacker: 'alphaMember',
    args: () => ['admin/zz-unbackfilled'],
    expectAttack: (r) => r.data === 'none',
    // The MIRROR, and it is what keeps this change narrow: a non-admin key with no
    // visibility row must still resolve 'any', or the same migration has quietly closed the
    // Member Directory for every family created after it.
    positiveActor: 'alphaMember',
    positiveArgs: () => ['zz-unbackfilled-general'],
    expectPositive: (r) => r.data === 'any',
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
  // THE CROSS-FAMILY ONE, and it needs saying why it is different from the case above it.
  //
  // getPendingApprovalQueues answers for EVERY family the caller belongs to, deliberately
  // — it exists because an administrator of two families could not be told that the one
  // they were not looking at had somebody waiting. So it is the one read in this file
  // whose whole job is to cross the boundary the rest of the suite is checking, and every
  // guard it has is written by hand: the family codes come from the caller's own
  // memberships, `scopeInFamilies` resolves admin/approvals per family, and the single
  // query is `.in()`-scoped to what survives both. There is no policy underneath it — it
  // reads on the service role, because RLS could not answer this question at all.
  //
  // The default leak scan does NOT catch a failure here, which is why the assertions are
  // explicit: ALPHA's FAMILY NAME is not on the marker list (the markers are its rows and
  // its people, not the string "ALPHATEST Family"), so a version of this action that
  // forgot to scope by membership would hand BRAVO's administrator ALPHA's queue and the
  // scan would report nothing. Assert the family codes themselves.
  //
  // [crux] WHAT THIS IS EVIDENCE FOR, established by mutation rather than assumed: that
  // the returned list is built from the CALLER'S OWN memberships. Rewritten to iterate the
  // count query's keys instead — the obvious refactor, and the one that reads as tidier —
  // BRAVO's administrator is handed ALPHA's queue, and all three assertions here fail.
  //
  // WHAT IT IS NOT EVIDENCE FOR: the `.in('family_code', …)` on that query. Removing it
  // alone changes nothing observable, because the final map only ever reads counts for
  // families already in `workable`. That `.in()` is defence in depth and worth keeping —
  // §3 asks for it, and it is what stops the query dragging every family's pending rows
  // into memory — but this case does not hold it up, and should not be read as though it
  // does.
  read('admin/approvals.getPendingApprovalQueues', 'app/actions/admin/approvals.ts', 'getPendingApprovalQueues', {
    // BRAVO's administrator belongs to BRAVO alone, so exactly one queue, exactly theirs
    // — 1, not the global 4.
    expectAttack: r => Array.isArray(r) && r.length === 1
      && r[0].familyCode === 'BRAVOTEST' && r[0].count === 1,
    positiveActor: 'alphaAdmin',
    expectPositive: r => Array.isArray(r) && r.length === 1
      && r[0].familyCode === 'ALPHATEST' && r[0].count === 3 && r[0].isActive === true,
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
  {
    kind: 'write',
    id: 'admin/permissions.createTemplate (copy from)',
    mod: 'app/actions/admin/permissions.ts', fn: 'createTemplate',
    // THE ATTACK IS NOT THE CREATE — it is the copy. BRAVO's administrator may create a
    // template in their own family all day; what they may not do is seed it from ALPHA's,
    // which would hand them a working transcript of another family's access map without
    // ever reading a row they could be refused.
    //
    // That makes this an exfiltration wearing a write's clothes, and the reason the id
    // is checked into the caller's family before the grid is read (AGENTS.md §4). Drop
    // the `.eq('family_code', …)` from that lookup in createTemplate and this fails.
    setup: markAlphaGeneralBankView,
    args: fx => ['Copied from General', 'stolen', fx.alpha.generalTemplateId],
    probe: bankGrantsProbe,
    // The control copies ALPHA's General inside ALPHA, which is the whole feature: the
    // new template must come out carrying the marker grant. Without it the attack
    // assertion would pass just as well against a createTemplate that ignored its third
    // argument entirely.
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
    args: () => ['newcomer.by.pending@rls.test', { firstName: 'New', lastName: 'Comer' }, true],
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
    args: () => ['intruder@rls.test', { firstName: 'In', lastName: 'Truder' }, true, 'ALPHATEST'],
    probe: (db) => snapshot('family_invitations', 'id, email, pre_approved',
      { family_code: 'ALPHATEST' })(db),
    // The control names ALPHATEST too — the same argument, from someone entitled to it —
    // so the attack assertion cannot pass merely because the parameter is ignored.
    positiveActor: 'alphaMember',
    positiveArgs: () => ['legit.invite@rls.test', { firstName: 'Legit', lastName: 'Invite' }, false, 'ALPHATEST'],
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
    args: () => ['alpha.declined.ask@rls.test', { firstName: 'Declined', lastName: 'Ask' }, false, 'ALPHATEST'],
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
    args: () => ['alpha.pending@rls.test', { firstName: 'Alpha', lastName: 'Pending' }, false, 'ALPHATEST'],
    expectAttack: (r) => r?.success === false
      && r.message === 'That person is already in this family.',
    positive: 'not-applicable',
    why: 'the assertion IS that no caller gets a more informative answer, so a more-entitled caller is not a comparison — an approver reads the queue itself, on a screen their grant already covers',
  }),
  {
    kind: 'write',
    id: 'invitations.resendInvitation',
    mod: 'app/actions/invitations.ts', fn: 'resendInvitation',
    // THE ID IS THE ONLY ARGUMENT, and the address it mails is read from the row — so the
    // whole of the isolation is whether RLS releases that row. BRAVO's administrator holds
    // scope 'any' on every resource in BRAVO, and the policy on family_invitations is
    // family-scoped, so they read nothing and cannot name an address to mail.
    //
    // NOT EVIDENCE FOR THE RLS READ ON ITS OWN, and saying so here rather than letting it
    // look like it is. Mutation-tested 2026-08-12: swapping the read to createAdminClient()
    // — deleting the family scoping entirely — leaves this case GREEN, because
    // `inviteMember` then refuses BRAVO's administrator independently
    // (create_family_invitation looks for the CALLER's approved people row in the target
    // family, 20260806000014:96-107). Two layers, and this case cannot tell you which one
    // held.
    //
    // It is not vacuous either: removing BOTH — admin-client read plus a fail-open family
    // lookup — turns the attack red, with BRAVO's administrator successfully re-minting and
    // mailing an ALPHA invitation. So the pair is under test, the layers are not
    // individually. If you narrow either one, re-run that double mutation rather than
    // trusting this green.
    args: fx => [fx.alpha.resendInvitation.id],
    // A resend revokes the row it resends and inserts a replacement, so ALPHA's own list
    // for that address goes from one open row to one revoked plus one open. Filtered to
    // the address, because that is the only part of the table this case owns.
    probe: (db) => snapshot('family_invitations', 'id, email, revoked_at',
      { family_code: 'ALPHATEST', email: 'resend.alpha@rls.test' })(db),
    positiveActor: 'alphaAdmin',
  },
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
    args: () => ['alpha.declined.ask@rls.test', { firstName: 'Declined', lastName: 'Ask' }, true, 'ALPHATEST'],
    expectAttack: (r) => r?.success === true && r.preApproved === false,
    positive: 'not-applicable',
    why: 'alphaAdmin IS the entitled caller — the assertion is that even a full approvals grant cannot pre-approve a re-invitation, so a more-entitled comparison does not exist',
  }),
  {
    kind: 'write',
    id: 'membership.appealMembershipDecision (acts only on the caller\'s own row)',
    mod: 'app/actions/membership.ts', fn: 'appealMembershipDecision',
    // The action takes a FAMILY CODE and a note, never a person id — so the only thing
    // stopping it touching somebody else's membership is that the RPC resolves the row from
    // auth.uid(). BRAVO's administrator naming ALPHATEST is the test of exactly that: they
    // hold every grant BRAVO can confer, and ALPHATEST is a real family whose declined rows
    // are real, and they must still change nothing.
    //
    // This is the shape AGENTS.md §2b warns about from the other direction: the moment
    // somebody "helpfully" adds a p_person_id so an administrator can appeal on behalf of a
    // relative, this becomes a way to move an arbitrary row into the approvals queue.
    args: () => ['ALPHATEST', 'Please reconsider — I am family.'],
    // THE PROBE IS THE WHOLE SET OF ALPHA'S DECLINED ROWS, not just the one the control
    // moves, and that is the result of mutation-testing this case rather than assuming it.
    // Scoped to a single id it was blind: replacing `p.user_id = v_user` with an unscoped
    // `… AND membership_status = 'rejected' LIMIT 1` lets the attacker move SOME declined
    // ALPHA row, and with no ORDER BY it is arbitrary which — so a one-row probe passed the
    // attack while the protection was gone. Watching the set, any row leaving 'rejected'
    // moves the snapshot whichever one the mutation happens to pick.
    probe: (db) => snapshot('people', 'id, membership_status, membership_appeal',
      { family_code: 'ALPHATEST', membership_status: 'rejected' })(db),
    positiveActor: 'alphaDeclinedAppeal',
  },
  {
    kind: 'write',
    id: 'membership.appealMembershipDecision (only a declined row may appeal)',
    mod: 'app/actions/membership.ts', fn: 'appealMembershipDecision',
    // THE ATTACKER IS A PENDING APPLICANT OF THE SAME FAMILY — inside the boundary by every
    // test the cross-family cases apply, and refused here by state rather than by scoping.
    // Without the `<> 'rejected'` guard this would be a way for anyone already in the queue
    // to keep bumping themselves up it (membership_requested_at is refreshed) and to attach
    // arbitrary text to their own row, which the approvals screen renders.
    attacker: 'alphaPending',
    args: () => ['ALPHATEST', 'Bumping myself up the queue.'],
    // Filtered to the ATTACKER's own row and projecting the column the guard protects: if
    // the guard failed open, their note would land here and the snapshot would move.
    probe: (db, fx) => snapshot('people', 'id, membership_status, membership_appeal',
      { id: fx.users.alphaPending.personId })(db),
    positive: 'not-applicable',
    why: 'a pending applicant has no legitimate appeal — the state exists for declined rows, and the case above supplies the real control with a declined actor',
  },
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

/**
 * The six digits every removal challenge in this fixture is minted with.
 *
 * SEEDED THROUGH THE SERVICE ROLE rather than read back from a mailbox, because the code
 * only ever exists in the process that mails it — `requestFamilyRemovalCode` stores the
 * SHA-256 and nothing else. The hash is computed here exactly as the action computes it
 * (`encode(digest(code,'sha256'),'hex')`), which is the same trick `seed.mjs` uses for
 * invitation tokens and for the same reason: seeding a known plaintext is what lets a case
 * type one family's code at another family's action.
 */
const REMOVAL_CODE = '424242'
const REMOVAL_CODE_HASH = createHash('sha256').update(REMOVAL_CODE).digest('hex')

/** Every family a removal case may touch. Three, because the attack must move none. */
const REMOVAL_FAMILIES = [ALPHA, BRAVO, CHARLIE]

/** No open challenge anywhere, so a minting case starts from a known empty state. */
const clearRemovalChallenges = async (db) => {
  const { error } = await db.from('family_removal_challenges')
    .delete().in('family_code', REMOVAL_FAMILIES)
  if (error) throw new Error(`setup: ${error.message}`)
}

/**
 * Put the three families back to 'active' and re-mint one live challenge per actor.
 *
 * BOTH HALVES OF EVERY REMOVAL CASE RUN THIS, which is what `runWrite` gives it by calling
 * `setup` before the attack and again before the control — the same job `resetAlphaName`
 * does for the rename cases, and necessary for the same reason: the control genuinely
 * removes CHARLIE, so without the reset the second half would find nothing left to remove
 * and "the probe did not move" would be the fixture agreeing with itself.
 *
 * `bravoAdmin` is deliberately NOT given one. Their case asks whether ALPHA's six digits
 * are worth anything to somebody outside ALPHA, and the answer has to come from the
 * resolution pair (family_code, requested_by) rather than from an absent grant.
 */
const resetRemoval = async (db, fx) => {
  // ── FIRST, WHAT THE LAST HALF LEFT BEHIND — and this is not tidying up ────────────
  // `runWrite`'s control assertion is `ctlBefore !== ctlAfter`, which cannot tell removing
  // CHARLIE apart from removing EVERYTHING: both move the probe. So an over-broad UPDATE
  // in the action — `.eq('family_code', g.familyCode)` deleted, say, which is the whole of
  // the isolation once the service role is in play (AGENTS.md §3) — would leave both halves
  // green while every family in the database went down with CHARLIE.
  //
  // This is the assertion that catches it: before restoring anything, nothing but CHARLIE
  // may be found removed. Verified by mutation on 2026-08-18 — dropping that `.eq` turns
  // the second removal case into a harness FAIL naming ALPHATEST and BRAVOTEST, where
  // before this check the whole suite stayed green.
  const { data: found, error: readError } = await db.from('families')
    .select('family_code, status').in('family_code', [ALPHA, BRAVO])
  if (readError) throw new Error(`setup: ${readError.message}`)
  const spilled = (found ?? []).filter(f => f.status !== 'active').map(f => f.family_code)
  if (spilled.length) {
    throw new Error(
      `a previous removal reached ${spilled.join(', ')} as well as its own family. `
      + 'A removal must move ONE family\'s row.',
    )
  }

  const { error: restored } = await db.from('families')
    .update({ status: 'active', removed_at: null, removed_by: null })
    .in('family_code', REMOVAL_FAMILIES)
  if (restored) throw new Error(`setup: ${restored.message}`)

  await clearRemovalChallenges(db)

  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const { error } = await db.from('family_removal_challenges').insert([
    { family_code: ALPHA, requested_by: fx.users.alphaAdmin.personId, code_hash: REMOVAL_CODE_HASH, expires_at: expires },
    { family_code: ALPHA, requested_by: fx.users.alphaMember.personId, code_hash: REMOVAL_CODE_HASH, expires_at: expires },
    { family_code: ALPHA, requested_by: fx.users.alphaPending.personId, code_hash: REMOVAL_CODE_HASH, expires_at: expires },
    { family_code: CHARLIE, requested_by: fx.users.charlieAdmin.personId, code_hash: REMOVAL_CODE_HASH, expires_at: expires },
  ])
  if (error) throw new Error(`setup: ${error.message}`)
}

/**
 * All three families' removal state.
 *
 * `status` IS IN THE PROJECTION, and it is the column the whole case turns on — a snapshot
 * of `id, family_code, family_name` would make a successful removal look like a no-op and
 * every assertion below would pass while testing nothing. That is one of the two fixture
 * failures AGENTS.md §7 names by hand. `removed_at` and `removed_by` are here because the
 * guard covers them for their own sake and one case forges only those.
 *
 * THREE FAMILIES, not one. The attack must move none of them: not ALPHA, whose code the
 * attacker typed, and not BRAVO, which is the family they would remove if the challenge
 * were resolved from the digits instead of from the caller.
 */
const familyStatusProbe = async (db) => {
  const { data, error } = await db.from('families')
    .select('family_code, status, removed_at, removed_by')
    .in('family_code', REMOVAL_FAMILIES)
    .order('family_code')
  if (error) throw new Error(`probe families: ${error.message}`)
  return JSON.stringify(data)
}

/**
 * REMOVING A FAMILY — the two actions, and the trigger underneath them.
 *
 * ── THE SUBJECT IS CHARLIE, AND THAT IS THE WHOLE FIXTURE DESIGN ────────────────────
 * `removeFamily`'s positive control has to genuinely remove a family, which makes it the
 * most destructive control in this suite. Pointed at ALPHA it would take out the row
 * `admin/family.getFamilySettings`, both `renameFamily` cases and every marker in
 * `alphaMarkers` rest on — the §7 failure mode `deletableChild` exists to name, at the
 * scale of a whole family. So `seed.mjs` seeds a third one whose only job is to be removed.
 *
 * Each write case re-snapshots for its control, so `resetRemoval` puts every family back to
 * 'active' and re-mints the challenges before BOTH halves. Without that the control would
 * be removing a family the attack had already left removed, and "the probe did not move"
 * would mean the fixture agreeing with itself.
 *
 * ── EVERY ACTOR GETS A VALID CODE, INCLUDING THE ONES WHO MUST BE REFUSED ───────────
 * `alphaMember` and `alphaPending` are handed real, unexpired challenges of their own. That
 * is the same principle that makes the attacker of record an administrator: if the refusal
 * could be the missing code rather than the missing grant, the case is evidence for
 * nothing. Only `bravoAdmin` has none — deliberately, because their case IS about the
 * challenge, and it asks whether knowing ALPHA's six digits buys an outsider anything.
 *
 * ── WHAT EACH CASE IS EVIDENCE FOR, established by mutation on 2026-08-18 ───────────
 * Four runs, each removing one layer and re-running `npm run test:rls`. These are the
 * observed results, and two of them are not what the first guess said they would be:
 *
 *   A. Both actions' guard preamble replaced by a bare `auth.getUser()` — so they gate on
 *      being signed in and nothing else.
 *        -> FOUR failures, ROW MUTATED: 'same family, member with no grant' and 'pending
 *           member', on BOTH actions. Cross-family stays green, and correctly so —
 *           bravoAdmin can only ever act on BRAVO, and the code layer refuses them there.
 *      NOTE that `requireDelete(…)` -> `requireRead(FAMILY_RESOURCE)` is NOT a sufficient
 *      mutation and was tried first: `admin/family` is a restricted admin key, so a plain
 *      member is refused by the view grant instead and all eight assertions stay green.
 *      A mutation has to remove the LAST layer, not a layer.
 *   B. `consume_family_removal_challenge` rewritten to find the newest unspent challenge
 *      globally — both `family_code` and `requested_by` dropped from its WHERE.
 *        -> cross-family FAILS: BRAVO's administrator types ALPHA's six digits, spends
 *           ALPHA's challenge, and BRAVOTEST comes back `status: "removed"`. That pair of
 *           conjuncts is what this case is evidence for.
 *      Dropping EITHER ONE alone leaves the suite green, because bravoAdmin's person id and
 *      family code both miss. Recorded because it is the interesting half: the case is
 *      evidence for the pair, not for either conjunct on its own.
 *   C. `.eq('family_code', g.familyCode)` deleted from removeFamily's UPDATE — the service
 *      role has no RLS, so that filter IS the isolation (AGENTS.md §3).
 *        -> FOUR failures, all `harness`: 'a previous removal reached BRAVOTEST, ALPHATEST
 *           as well as its own family.'
 *      THIS ONE WENT UNDETECTED AT FIRST, and the fix is `resetRemoval`'s opening
 *      assertion — see the comment there. `runWrite` judges a control by "the probe moved",
 *      which cannot tell removing CHARLIE apart from removing everything.
 *   D. `DROP TRIGGER families_guard_removal ON public.families`
 *        -> both raw PATCH cases FAIL with ROW MUTATED — ALPHATEST comes back
 *           `status: "removed"` for the first and `removed_by: <alphaOther>` for the
 *           second (checked on its own, since the first leaves ALPHA removed and C's
 *           assertion then reports the second as a harness error). Nothing else in the
 *           suite moves, which is the finding: the trigger is reachable by no action.
 */
export const REMOVAL_CASES = [
  // ── requesting the code ───────────────────────────────────────────────────────────
  {
    kind: 'write',
    id: 'admin/family.requestFamilyRemovalCode (cross-family)',
    mod: 'app/actions/admin/family.ts', fn: 'requestFamilyRemovalCode',
    // NO ARGUMENTS, on purpose — the action takes none, so there is no ALPHA id for BRAVO
    // to pass and the usual "attacker supplies the owner's id" shape does not apply. What
    // this asserts instead is that the derivation cannot be widened: a code is minted for
    // the CALLER's family, and ALPHA's must be that family for nobody but ALPHA.
    args: () => [],
    setup: clearRemovalChallenges,
    probe: db => snapshot('family_removal_challenges', 'id, family_code, requested_by',
      { family_code: ALPHA })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/family.requestFamilyRemovalCode (same family, member with no grant)',
    mod: 'app/actions/admin/family.ts', fn: 'requestFamilyRemovalCode',
    // The half family scoping cannot catch. alphaMember is inside the boundary and
    // approved; the only thing that may refuse them is `admin/family/remove:delete`, which
    // is a SEPARATE grant from the one that renames the family — so a member who can
    // rename must still be refused here.
    attacker: 'alphaMember',
    args: () => [],
    setup: clearRemovalChallenges,
    probe: db => snapshot('family_removal_challenges', 'id, family_code, requested_by',
      { family_code: ALPHA })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/family.requestFamilyRemovalCode (pending member)',
    mod: 'app/actions/admin/family.ts', fn: 'requestFamilyRemovalCode',
    // Inside the family boundary by every test the cross-family cases apply —
    // auth_family_code() resolves ALPHATEST for them deliberately — and admitted by
    // nobody. A code mailed to an applicant would be a mailbox the family never chose to
    // trust holding one half of the removal gate.
    attacker: 'alphaPending',
    args: () => [],
    setup: clearRemovalChallenges,
    probe: db => snapshot('family_removal_challenges', 'id, family_code, requested_by',
      { family_code: ALPHA })(db),
    positiveActor: 'alphaAdmin',
  },

  // ── spending it ───────────────────────────────────────────────────────────────────
  {
    kind: 'write',
    id: 'admin/family.removeFamily (cross-family)',
    mod: 'app/actions/admin/family.ts', fn: 'removeFamily',
    // ALPHA'S OWN CODE, typed by BRAVO's administrator. This is the sharpest form the
    // argument can take: the attacker holds every grant BRAVO can confer AND the six
    // digits ALPHA was mailed, and must still remove nothing — not ALPHA, whose challenge
    // it is, and not BRAVO, because the challenge is resolved from their family and their
    // person rather than from the code they typed.
    args: () => [REMOVAL_CODE],
    setup: resetRemoval,
    probe: familyStatusProbe,
    positiveActor: 'charlieAdmin',
  },
  {
    kind: 'write',
    id: 'admin/family.removeFamily (same family, member with no grant)',
    mod: 'app/actions/admin/family.ts', fn: 'removeFamily',
    // A VALID CHALLENGE OF THEIR OWN is seeded for this actor, so the code layer cannot be
    // what refuses them and the grant is left holding it alone.
    attacker: 'alphaMember',
    args: () => [REMOVAL_CODE],
    setup: resetRemoval,
    probe: familyStatusProbe,
    positiveActor: 'charlieAdmin',
  },
  {
    kind: 'write',
    id: 'admin/family.removeFamily (pending member)',
    mod: 'app/actions/admin/family.ts', fn: 'removeFamily',
    // Also handed a valid challenge, for the reason above. An applicant who has typed a
    // family code must not be able to switch that family off.
    attacker: 'alphaPending',
    args: () => [REMOVAL_CODE],
    setup: resetRemoval,
    probe: familyStatusProbe,
    positiveActor: 'charlieAdmin',
  },

  // ── the guard, reached where only a raw call can reach it ─────────────────────────
  //
  // [not evidence for family isolation] Both stay green under every mutation above, and
  // both go red on `DROP TRIGGER families_guard_removal ON public.families`. They are
  // evidence for the TRIGGER, which is what makes the emailed code a gate rather than a
  // dialog — see `removeFamilyByPatch` in raw/sweep.mjs for the PATCH they reproduce.
  {
    kind: 'write',
    id: 'raw:families PATCH status (administrator removing from devtools)',
    mod: 'tests/rls/raw/sweep.mjs', fn: 'removeFamilyByPatch',
    // ALPHA'S OWN ADMINISTRATOR, on ALPHA'S OWN ROW, which the UPDATE policy genuinely
    // admits them to write. That is the whole point: this is the column boundary, not
    // family isolation, and the actor is the one person the policy says yes to.
    attacker: 'alphaAdmin',
    args: fx => [fx.alpha.familyRowId],
    setup: resetRemoval,
    probe: familyStatusProbe,
    positive: 'not-applicable',
    why: 'families_guard_removal refuses these columns for the `authenticated` role outright, so no caller has a legitimate raw PATCH to run; removeFamily() through the service role is the only way in and its own cases exercise it',
  },
  {
    kind: 'write',
    id: 'raw:families PATCH removed_by (forging the record without the act)',
    mod: 'tests/rls/raw/sweep.mjs', fn: 'forgeRemovalRecord',
    attacker: 'alphaAdmin',
    // Naming somebody else as the person who removed the family, while leaving `status`
    // alone. The family stays open and its row says a member switched it off — a false
    // accusation with no other symptom, which is why the guard watches all three columns.
    args: fx => [fx.alpha.familyRowId, fx.alpha.otherPersonId],
    setup: resetRemoval,
    probe: familyStatusProbe,
    positive: 'not-applicable',
    why: 'the record of a removal is written by removeFamily() through the service role and by nothing else; there is no legitimate authenticated write to reproduce',
  },
]

// Order is load-bearing, and only here: APPROVAL_CASES decides two memberships and
// leaves a third behind, so it runs after everything that reads the fixture.
// SWEEP_CASES before APPROVAL_CASES for the same reason APPROVAL_CASES is last: those
// decide two memberships and leave a third behind, and every sweep case depends on
// `alphaPending` still being pending.
// REMOVAL_CASES sits between them and touches nothing either of them reads — its
// destructive control is aimed at CHARLIE, a family nothing else in this file mentions,
// which is exactly why that family exists.
CASES.push(...MORE_CASES, ...PENDING_CASES, ...SWEEP_CASES, ...REMOVAL_CASES, ...APPROVAL_CASES)

/**
 * NOT COVERED, and why — so the gap is a decision rather than an oversight.
 *
 *   uploadDocument, uploadPhoto, uploadEventPhoto, uploadAvatar
 *     Take a FormData carrying a file and write to Supabase Storage, whose
 *     buckets and policies are a separate access-control system from the RLS
 *     policies this suite exercises. Testing them properly means seeding buckets
 *     and asserting on object paths — worth doing, but a different harness.
 *
 *   createFund, createElection, createCollection, addChild
 *     Create rows in the CALLER's own family, derived from their own
 *     auth_family_code(). There is no other family's id to supply, so there is no
 *     cross-family case to construct. Their risk is the permission layer, not
 *     family isolation.
 *
 *     `createDuesSchedule` WAS ON THIS LIST AND CAME OFF IT, 2026-08-18, and the reason is
 *     the lesson rather than the entry: 20260817000008 gave a dues schedule a `region_id`
 *     and a `chapter_id`, so an action whose exemption rested on "there is no foreign id to
 *     supply" acquired two. The exemption expired silently — nothing in the suite or the
 *     schema could have said so — which is why this list is a list of REASONS and not of
 *     names. Any migration that adds a foreign key to a table an exempt action writes has to
 *     be read against it.
 *
 *   20260806000011 §6's sweep — COVERED SINCE 2026-08-17, see SWEEP_CASES above
 *     This entry said the sweep was a structural gap: its policies are reachable only by
 *     calling PostgREST directly with an applicant's JWT, and this suite calls exported
 *     ACTIONS. That was true and is no longer — `tests/rls/raw.mjs` speaks PostgREST as
 *     the current actor, substituting nothing, and `SWEEP_CASES` covers nine policies plus
 *     the two `people` guards and the fail-closed admin default.
 *
 *     WHAT ALSO CHANGED IS THE THING THAT USED TO STAND IN FOR IT. This entry credited §8
 *     of that migration with recomputing the swept table list and RAISEing on a missing
 *     conjunct. It does, and it has EXPIRED: its hard-coded half names `user_groups`,
 *     `user_group_members` and `group_permissions`, and `20260807000000` renamed the first
 *     two and dropped the other two. So it is correct on a full replay and cannot be
 *     re-run against today's schema at all. Do not reach for it as a substitute again.
 *
 *   The two `people` guards, through the ACTION rather than raw
 *     `people_guard_membership_status` and `people_guard_permission_template` are exercised
 *     by raw PATCH in SWEEP_CASES, which is the only way to reach the triggers themselves.
 *     What is NOT covered is a service-role write bypassing them — by design, since the
 *     guards bound the `authenticated` role rather than the column. That obligation is
 *     enforced statically instead: `npm run audit:people`, a step in verify.yml.
 */
export const UNCOVERED = [
  'documents.uploadDocument', 'photos.uploadPhoto',
  'event-photos.uploadEventPhoto', 'personal-info.uploadAvatar',
]
