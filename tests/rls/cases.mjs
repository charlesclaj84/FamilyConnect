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
// The refusal sentence itself, imported rather than retyped. A copy here would go on
// asserting a string the product had stopped using — the same argument that makes
// SWEEP_NOTIFICATION_TITLE an import.
import { WRITE_NOT_SAVED } from '../../lib/confirmed-write.ts'

/** Values that exist only in ALPHA. Finding one in a BRAVO response is a leak. */
export function alphaMarkers(fx) {
  const a = fx.alpha
  return [
    a.chapter.id, 'ALPHATEST chapter',
    // ── THE REGION, ADDED 2026-08-19, AND ITS ABSENCE UNTIL NOW WAS A REAL GAP ──────────
    //
    // A region has been in this fixture since 2026-08-18 and was findable in a response by
    // nothing at all. That was survivable while `regions` was read only by `/admin/members/organization`,
    // whose own cases assert on `fx.alpha.region.id` explicitly — and it stopped being
    // survivable today, because `chapterPlaces` in app/actions/members.ts and its deliberate
    // twin in app/actions/admin/permissions.ts now WALK `people.chapter_id -> chapters.region_id
    // -> regions.name` and publish the region's NAME on both member tables. So the string is
    // now roster-adjacent family structure that a cross-family read could hand over, and
    // `members.getMembers` / `admin/permissions.searchMembers` are the two reads that would.
    //
    // ONE SUBSTRING OVERLAP, STATED SO IT IS NOT DISCOVERED AS A PUZZLE: this scan matches
    // substrings, and `f.regionalSchedule.label` is 'ALPHATEST regional dues' — which CONTAINS
    // 'ALPHATEST region'. So a leaked regional dues schedule is reported under this marker as
    // well as being one. That is a leak either way and no false positive; what it costs is that
    // the marker alone does not say which row came out, which the id beside it does.
    a.region.id, 'ALPHATEST region',
    // ── THE BOARD POSITION THE ADMINISTRATOR HOLDS (20260819000004) ──────────────────────
    //
    // `family_roles` stopped being a hybrid on 2026-08-19: the 25 global built-ins are gone and
    // every row belongs to one family, which makes the NAME of a position ALPHA-only data for
    // the first time. `getMembers` publishes it as `primary_role_title` through an ADMIN-CLIENT
    // read whose only scoping is a hand-written `.eq('family_code', …)` added the same day, and
    // the SELECT policy on `family_roles` carried `USING (true)` — no family conjunct at all —
    // for the entire life of the table before that migration fixed it. Both halves of that are
    // exactly what a marker is for.
    //
    // `f.customRole` ('ALPHATEST Historian') is deliberately NOT here: the board-position delete
    // case removes that row, and a marker whose row a case deletes stops being findable for
    // every case ordered after it. The President is held by a `user_roles` row and nothing
    // touches it.
    'ALPHATEST President',
    a.announcement.id, a.document.id,
    a.collection.id, a.photo.id, a.room.id, a.message.id,
    a.schedule.id, a.optionalSchedule.id, a.payment.id, a.fund.id, a.milestone.id,
    // The money-free spares MONEY_CASES delete. Ids only: each is ALPHA's by construction, so
    // a BRAVO response carrying one is a leak like any other, and every default-checked read
    // gains the assertion for nothing. Their NAMES are deliberately not listed —
    // `f.deletableFund` is "ALPHATEST spare fund", which no substring test would distinguish
    // from a marker that is already here.
    //
    // FOUR EVENT IDS WERE ON THIS LIST and their tables are dropped (20260819000006).
    a.deletableSchedule.id, a.deletableFund.id, a.deletableMilestone.id,
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
    // The two records Dues Projections' three states need. ALPHA-only values like every
    // other id here, so every default-checked case gains the assertion for free.
    a.invitedRecord.id, a.uninvitedRecord.id,
    // ── THE BIRTHDAYS PANE (20260819000002) ─────────────────────────────────────────────
    //
    // A NAME AND A DATE OF BIRTH ARE PII, which is the whole reason
    // `getUpcomingBirthdays` reads on the USER client rather than the service role (its own
    // header argues it out) — so both of these rows are marked like any other, and both names
    // as well as both ids, because the pane's response carries `firstName`/`lastName` and no
    // other field a marker could match.
    //
    // The DEPARTED one is marked even though ALPHA's own pane must not list him either. Those
    // are two different claims and only the first belongs here: a BRAVO caller must not see the
    // row because it is ALPHA's, which the scan asserts for every default-checked read in this
    // file; that ALPHA's OWN pane withholds him is `sunset_date`'s job and is asserted by name
    // in the birthday cases' `expectPositive`.
    a.birthdayPerson.id, 'ALPHATESTBirthday',
    a.sunsetBirthdayPerson.id, 'ALPHATESTDeparted',
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
    // ── GATHERINGS (20260819000000) ───────────────────────────────────────────
    //
    // EVERY STRING HERE SAYS "ASSEMBLY" AND NONE SAYS "GATHERING", and that is the one thing
    // about this list a future addition must not get wrong. `seed.mjs` seeds an `event_types`
    // row named `${code} gathering`, this scan matches on SUBSTRINGS, and a marker of
    // 'ALPHATEST gathering' would therefore be found in that pre-existing row — reporting a
    // leak against every read in the suite, in a response that never touched this feature.
    //
    // The ids first. Every one is ALPHA's by construction, so a BRAVO response carrying one
    // is a leak like any other and every default-checked read gains the assertion for free.
    a.template.id, a.deletableTemplate.id,
    a.templateStep1.id, a.templateStep2.id, a.deletableStep.id, a.deletableTemplateStep.id,
    a.gathering.id, a.deletableGathering.id, a.templateUse.id,
    a.assignedTask.id, a.unassignedTask.id, a.submittableTask.id, a.submittedTask.id,
    a.queuedTask.id, a.pendingTask.id, a.submission.id, a.queuedSubmission.id,
    a.approvedTask.id, a.approvedSubmission.id,
    // And the prose. A template's name and a step's label are what a leaked template library
    // would actually show; a submission's note is a relative's own words about the family's
    // money and is the sharpest single string in this block.
    //
    // `location` IS DELIBERATELY ABSENT ('ALPHATEST assembly hall'). `updateGathering`'s
    // control rewrites a column on that row, and a marker a case overwrites is a marker that
    // silently stops being found for every case ordered after it — which would weaken the
    // CONTROL side of those cases, where the assertion is "at least one marker came back".
    'ALPHATEST assembly plan', 'ALPHATEST assembly plan notes',
    'ALPHATEST spare assembly plan',
    'ALPHATEST spring assembly', 'ALPHATEST assembly summary',
    'ALPHATEST spare assembly',
    'ALPHATEST bring the assembly banner', 'ALPHATEST assembly banner note',
    'ALPHATEST assembly catering line',
    'ALPHATEST spare assembly step', 'ALPHATEST spare plan assembly step',
    'ALPHATEST assembly seating plan', 'ALPHATEST assembly photograph list',
    'ALPHATEST assembly photograph', 'ALPHATEST assembly submission note',
    'ALPHATEST assembly transport list', 'ALPHATEST assembly transport note',
    'ALPHATEST assembly minibus',
    // The approved task, its answer and the note that came with it. Safe to mark even though a
    // case moves that row: `reopenGatheringTask` writes `status`, `decided_at` and `decided_by`
    // and deliberately touches neither the label nor the answer, which is the whole of what
    // "nothing is erased" means — so these three survive the control and go on being findable
    // for every case ordered after it, which is the property the `location` note above is about.
    'ALPHATEST assembly hall booking', 'ALPHATEST assembly parish hall',
    'ALPHATEST assembly hall booking note',
    // The task ALPHA's APPLICANT holds. Marked deliberately, and the note beside it in
    // seed.mjs says why the usual "never mark an attacking actor's own row" rule does not
    // reach it: a task is the family's work, not the applicant's own people row.
    'ALPHATEST assembly welcome table',
  ]
}

const read = (id, mod, fn, extra = {}) => ({ kind: 'read', id, mod, fn, args: () => [], ...extra })

export const CASES = [
  // ── directory / identity ──────────────────────────────────────────────────
  // The Member Directory's roster. The default marker scan is the attack assertion, and since
  // 2026-08-19 it carries the family's REGION and CHAPTER names as well — see `alphaMarkers`,
  // where `'ALPHATEST region'` was added for exactly this read.
  //
  // THE CONTROL IS SPELLED OUT BECAUSE THIS ACTION GREW A SECOND QUERY TODAY, and the shape of
  // it is the one AGENTS.md §3 is about: `chapterPlaces` walks
  // `people.chapter_id -> chapters.region_id -> regions.name` on the ADMIN client, with a
  // hand-written `.eq('family_code', …)` where a policy used to be.
  //
  // WHAT THE ASSERTION IS EVIDENCE FOR: that the walk resolves for a caller who holds NO
  // `admin/chapters` grant. That is not a hypothetical regression — the composed SELECT policies
  // on `chapters` and `regions` both demand `admin/chapters:view = 'any'`, so the old bare
  // `chapters(name)` embed on the user client came back NULL for every ordinary member, and the
  // Directory's Chapter column was blank for a year with nothing anywhere saying so. `alphaOther`
  // is in `f.chapter`, which is in `f.region`, and `alphaMember` (General template, no admin
  // grant) is the reader: both names must arrive.
  //
  // [not evidence for the family conjunct inside `chapterPlaces`] Said out loud rather than left
  // looking like proof, per §7. The chapter ids handed to that function come from `people` rows
  // the action has just read inside its own family, so no state this fixture can reach makes it
  // resolve another family's chapter — dropping the conjunct changes nothing observable here.
  // What would catch that is a `people` row whose `chapter_id` points across the boundary, which
  // is a thing no action in the product can create (every writer checks `belongsToFamily` first)
  // and which the harness would have to forge with the service role. Recorded as a gap.
  //
  // ── CHECKED BY MUTATION, 2026-08-19. OBSERVED ───────────────────────────────────────────
  //   m1  app/actions/members.ts AND app/actions/admin/permissions.ts, `chapterPlaces`: return
  //       the empty map immediately — which is not a contrived edit, it is EXACTLY what the
  //       pre-2026-08-19 user-client version produced for a caller with no `admin/chapters`
  //       grant, because the composed SELECT policies on `chapters` and `regions` both demand
  //       that key at 'any'
  //         FAIL  members.getMembers (control)                — chapter and region null for a
  //               member who is demonstrably in both
  //         FAIL  admin/permissions.searchMembers (control)   — same, on the other table
  //         pass  members.getMembers (pending member) — its control is the same plain member
  //               and would also fail; it passed because the derived pending case keeps the
  //               DEFAULT expectPositive (the marker scan), which this mutation does not move.
  //       Two cases, one mutation, both member tables: this is the pair that would have caught
  //       the year the Directory's Chapter column was blank.
  //   m2  app/actions/members.ts: put the `user_roles` read back on the USER client
  //       (`await supabase` in place of `await createAdminClient()`) — again not a contrived
  //       edit, it is what the line said until 2026-08-19
  //         FAIL  members.getMembers (control)  — `alphaAdmin`'s board title unresolved for a
  //               plain member, because the `user_roles` SELECT policy releases a row to its
  //               own holder or to `admin/boardpositions:view = 'any'` and General is neither
  //         pass  members.getMembers (pending member) — the derived case keeps the default
  //               marker scan, as with m1.
  read('members.getMembers', 'app/actions/members.ts', 'getMembers', {
    expectPositive: (r, fx) => Array.isArray(r) && (() => {
      const inChapter = r.find(m => m.id === fx.users.alphaOther.personId)
      const national = r.find(m => m.id === fx.alpha.birthdayPerson.id)
      return !!inChapter
        && inChapter.chapter_name === 'ALPHATEST chapter'
        && inChapter.region_name === 'ALPHATEST region'
        // AND THE ABSENCE OF A REGION IS NULL, NOT A WORD. `National` is a caption the
        // components own — `MemberRecord.region_name`'s comment says so, matching
        // `Chapter.region_name` in app/actions/admin/chapters.ts — and an action that returned
        // the string would be a second spelling of something the grid, the dues form and Dues
        // Projections each print for themselves. The birthday record is in no chapter, so it is
        // the row that pins it.
        && !!national && national.chapter_name === null && national.region_name === null
        // AND SOMEBODY ELSE'S BOARD TITLE, WHICH IS A THIRD ADMIN-CLIENT READ IN THIS ACTION
        // AND THE NEWEST OF THE THREE. The `user_roles` join moved to the service role on
        // 2026-08-19 with a hand-written `.eq('family_code', …)`, because on the user client the
        // policy released a row to its own holder or to an `admin/boardpositions:view = 'any'`
        // caller — so an ordinary member saw their own title and nobody else's, and the column
        // read as "this family has one officer".
        //
        // The subject is the ADMINISTRATOR'S title read by a PLAIN MEMBER, which is the exact
        // case that was broken: `alphaMember` holds General, which grants nothing on
        // `admin/boardpositions`. `'ALPHATEST President'` is on the marker list too, so the
        // attack half now catches the same string crossing the boundary.
        //
        // `includes` AND NOT `===`, DELIBERATELY: the value is `formatRoleTitle`'s output, so it
        // reads 'National ALPHATEST President' — the scope prefix belongs to `lib/role-utils.ts`
        // and is nothing this suite has an opinion about. What is asserted is that the position's
        // NAME was resolved for a member who is not the caller, which is the isolation-and-
        // resolution question; pinning the caption here would make an ordinary copy change in
        // that module fail a cross-family test.
        && (r.find(m => m.id === fx.users.alphaAdmin.personId)?.primary_role_title ?? '')
             .includes('ALPHATEST President')
    })(),
  }),
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

  // ── [crux] THE BOARD AND RECENT UPDATES AGREE ABOUT ONE READER'S PIN ───────
  //
  // NOT AN ISOLATION CASE, and it is here because nothing else in the tree could hold it. The
  // two screens render the same rows and were reported as out of sync, and they were: the
  // board sorted and highlighted on `announcements.pinned` — the FAMILY's flag — while Recent
  // Updates banded on `pinnedForMe`, the family's flag narrowed by this reader's dismissal. A
  // member who dismissed a notice saw it drop out of the band on one screen and stay at the
  // top with a pin on the other.
  //
  // THE SETUP IS THE WHOLE CASE. It writes a dismissal for the CONTROL ACTOR as the service
  // role — so the fixture's pinned announcement is one `alphaMember` has dismissed and
  // `bravoAdmin` has not — and then asserts that `getAnnouncements` says so. Before the fix
  // the returned rows carried no `pinnedForMe` field at all, so the control assertion is
  // `=== false` rather than falsy: `undefined` is what the bug looked like and it must not
  // pass.
  //
  // IT IS IDEMPOTENT, because `setup` runs twice — once before the attack and once before the
  // control (see `runWrite`/`runRead` in run.mjs). An INSERT would collide on the second pass;
  // the upsert is what makes the case re-runnable.
  //
  // THE ATTACK HALF IS THE ORDINARY ONE and is not wasted: it asserts BRAVO's administrator
  // still sees none of ALPHA's announcements, which is the assertion `getAnnouncements`
  // already made — kept here so the row this case dismisses cannot become a hole.
  read('announcements.getAnnouncements (a pin this reader has dismissed)',
    'app/actions/announcements.ts', 'getAnnouncements', {
      setup: async (db, fx) => {
        await db.from('announcement_unpins').upsert({
          announcement_id: fx.alpha.announcement.id,
          person_id: fx.alpha.ownerPersonId,
          family_code: fx.alpha.familyCode,
        }, { onConflict: 'announcement_id,person_id' })
      },
      expectPositive: (rows, fx) => {
        const row = rows.find(a => a.id === fx.alpha.announcement.id)
        return row != null
          // The family still has it pinned — that half is untouched by a dismissal, and if
          // this were false the assertion below would pass for the wrong reason.
          && row.pinned === true && row.pin_active === true
          // And this reader does not, which is the field the board was missing.
          && row.pinnedForMe === false
          // AND it is not first. The sort is the visible half of the bug: `byPinThenDate`
          // read `isPinActive`, so a dismissed notice held the top of the board while Recent
          // Updates had already dropped it into date order.
          && rows.length > 1 && rows[0].id !== fx.alpha.announcement.id
      },
    }),

  // ── the Birthdays pane on /announcements (20260819000002) ──────────────────
  //
  // THREE CASES, AND EACH ASSERTS SOMETHING THE OTHER TWO CANNOT. `getUpcomingBirthdays`
  // applies three conjuncts before handing the roster to `lib/birthdays.ts`, and two of them
  // are invisible to any caller who could not have seen the withheld row in the first place:
  //
  //   the default one  cross-family isolation, and the `sunset_date` conjunct, as a PLAIN
  //                    member — the reader the pane is actually for.
  //   (pending member) an applicant the family has not admitted gets nothing at all.
  //   (an applicant's  ALPHA'S ADMINISTRATOR is the only caller who can prove the
  //    birthday)       `membership_status = 'approved'` conjunct, because they are the only
  //                    one the `people` SELECT policy shows an applicant to at all.
  //
  // WHY THE CONTROL CAN BE A PLAIN MEMBER AT ALL, which is not true of most reads in this
  // file: `announcements/birthdays` is registered with default visibility 'everyone' (a family
  // knowing its own birthdays is the point), so the General template every seeded member holds
  // resolves `view` on it. The roster underneath comes back because the same template grants
  // `members:view` at 'any' — which is the pane's stated design, that the sub-key decides
  // whether the section is fetched and `members` decides whose names are in it.
  //
  // THE FIXTURE HAD NO ROW THIS COULD SEE, and that is the point worth carrying forward: every
  // `date_of_birth` in seed.mjs was a hard-coded literal months away, so all three of these
  // would have passed by answering `[]` for everybody. `BIRTHDAY_SOON` is computed from the
  // run's own clock for `inDays`' reason — a literal inside the window rots the day the
  // calendar leaves it, silently, on a fixture nobody edited.
  //
  // ── CHECKED BY MUTATION, 2026-08-19. OBSERVED ───────────────────────────────────────────
  // `npm run test:rls "getUpcomingBirthdays"`, restored from a byte copy verified with
  // `md5sum -c`. Both results confirm the split of work across the three cases:
  //
  //   b1  app/actions/announcements.ts, `getUpcomingBirthdays`: delete
  //       `.is('sunset_date', null)`
  //         FAIL  the default case's control        the departed relative in the list
  //         FAIL  (an applicant's birthday) control same
  //         pass  (pending member) control — its `expectPositive` only asks that the living
  //               record IS there, which is right for a case whose subject is the applicant's
  //               refusal. Two of the three is the correct answer, not a shortfall.
  //   b2  the same function: delete `.eq('membership_status', 'approved')`
  //         FAIL  (an applicant's birthday) control ONLY, with `"firstName":"alphaPending"`
  //               first in ALPHA'S ADMINISTRATOR'S birthday list
  //         pass  the other two controls — AND THIS IS EXACTLY WHY THE THIRD CASE RUNS AS THE
  //               ADMINISTRATOR. Both of those run as `alphaMember`, from whom the `people`
  //               SELECT policy withholds an applicant anyway, so neither could ever see this
  //               conjunct do its job. A version of this block with only the plain-member cases
  //               would have been green with the conjunct deleted.
  read('announcements.getUpcomingBirthdays', 'app/actions/announcements.ts', 'getUpcomingBirthdays', {
    // The default marker scan is the right attack assertion here and needs no help: both
    // birthday rows are ALPHA-only and both their ids and names are on the marker list, so a
    // BRAVO caller who sees either is caught. BRAVO's own two rows come back legitimately.
    //
    // The CONTROL is spelled out because the default (at least one marker came back) would be
    // satisfied by the DEPARTED relative leaking, which is the opposite of what this asserts.
    expectPositive: (r, fx) => Array.isArray(r)
      // The living record IS listed — an account-less relative, which is the §4b decision the
      // pane makes deliberately: a projection counts every approved person, not every account.
      && r.some(b => b.id === fx.alpha.birthdayPerson.id)
      // …and the one who died in 1998 is NOT, however ordinary his birthday looks. This is the
      // action's own "single most important line": `lib/birthdays.ts` does not know about
      // `sunset_date` and never should, so the FETCH is the only thing withholding him.
      && !r.some(b => b.id === fx.alpha.sunsetBirthdayPerson.id)
      // Inside the horizon and sorted soonest-first, so the row this fixture put ~10 days out
      // is near the front. Asserted as a BOUND rather than as `daysAway === 10`: `inDays` is UTC
      // and `todayLocal()` is local, so the exact figure legitimately differs by a day.
      && r.find(b => b.id === fx.alpha.birthdayPerson.id).daysAway <= 60,
  }),
  read('announcements.getUpcomingBirthdays (pending member)',
    'app/actions/announcements.ts', 'getUpcomingBirthdays', {
      attacker: 'alphaPending',
      // [crux, and for a PAIR] An applicant is inside ALPHA's boundary by every test the
      // cross-family case above applies — `auth_family_code()` resolves ALPHATEST for them
      // deliberately — so this is where the membership gate is actually asserted. TWO gates
      // stand here and either alone answers empty: `requireRead('community/announcements/birthdays')`,
      // where `resolveScope()` denies a non-approved caller outright, and the `people` SELECT
      // policy's own `auth_membership_approved()`. Both have to go before an applicant reads a
      // single birthday, which is what the mutation record in the header measures.
      //
      // `[]` rather than a refusal: `requireRead` returns not-ok and the action answers an empty
      // list, so the assertion has to be the emptiness itself. Spelled out rather than left to
      // the marker scan, which would also pass on a list that came back full of BRAVO's rows.
      expectAttack: (r) => Array.isArray(r) && r.length === 0,
      expectPositive: (r, fx) => Array.isArray(r)
        && r.some(b => b.id === fx.alpha.birthdayPerson.id),
    }),
  read("announcements.getUpcomingBirthdays (an applicant's birthday)",
    'app/actions/announcements.ts', 'getUpcomingBirthdays', {
      // ALPHA'S ADMINISTRATOR IS THE CONTROL, AND ONLY THEY CAN MAKE THIS ASSERTION.
      //
      // The `people` SELECT policy admits a non-approved row to anyone holding
      // `admin/approvals:view`, which in this fixture is the administrator alone. So an
      // administrator is the one reader for whom `membership_status = 'approved'` in the action
      // is load-bearing: without it their birthday pane would list people the family has not
      // admitted, next to the family's own. A plain member's pane cannot see the difference,
      // because the policy withholds the applicant from them anyway.
      //
      // The applicant is `alphaPending`, whose people row the fixture gives the same
      // `BIRTHDAY_SOON` as the living record — so they are inside the horizon and would be
      // listed if the conjunct were dropped. It is that actor and not `alphaApplicant` or
      // `alphaRejectable` because those two are CONSUMED by the approve and reject controls,
      // and an approved applicant would then legitimately appear — making the assertion depend
      // on which cases had already run.
      positiveActor: 'alphaAdmin',
      expectPositive: (r, fx) => Array.isArray(r)
        && r.some(b => b.id === fx.alpha.birthdayPerson.id)
        // The unadmitted applicant is NOT on the family's birthday list.
        //
        // BY ID, and it has to be: `fx.users.alphaPending.personId` is deliberately absent from
        // `alphaMarkers()` (they are an attacking actor and RLS correctly lets them read their
        // own row), so the marker scan cannot see this one either way.
        && !r.some(b => b.id === fx.users.alphaPending.personId)
        && !r.some(b => b.id === fx.alpha.sunsetBirthdayPerson.id),
    }),
  // A REAL CONTROL SINCE THE FIXTURE SEEDS CHAPTERS. This carried
  // `positive: 'not-applicable'` for as long as there were none — an honest note that
  // the isolation half was asserting over an empty list. The chapter rows the
  // `people.chapter_id` cases below need make it testable, so it is a full case now.
  //
  // THE CONTROL RUNS AS ALPHA'S ADMINISTRATOR, not as the default member, and that is
  // the policy being honest rather than the fixture being bent: the composed SELECT
  // policy on `chapters` is
  //     family_code = auth_family_code() AND auth_permission('admin/members/organization','view') = 'any'
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
  read('funds.getDisbursementsForFund', 'app/actions/funds.ts', 'getDisbursementsForFund', {
    args: fx => [fx.alpha.fund.id],
  }),

  // ── chat group membership: the hole `npm run audit:family-scope` found ─────
  // `addGroupMember` and `removeGroupMember` read their room by `.eq('id', roomId)` on the
  // SERVICE-ROLE client with no family conjunct until 2026-08-20, gated only on
  // `created_by === user.id`. That test authorizes the ACTION and says nothing about which
  // family's room it acts on, which is AGENTS.md §4 with the second id arriving from the
  // caller's own membership rather than from a parameter.
  //
  // [not evidence for the family conjunct] Said out loud rather than left looking like proof,
  // per §7, because it is the sharpest example of the labelling that section asks for.
  //
  // THE REAL HOLE NEEDS A USER IN TWO FAMILIES, and this fixture has none: every row in
  // `USERS` belongs to exactly one. The sequence that exploited it was one person creating a
  // group in ALPHA, switching to BRAVO, and adding a BRAVO relative to the ALPHA room — every
  // check in the function satisfied, because `getMyFamilyCode` answered BRAVO while the room
  // was ALPHA's. BRAVO's administrator cannot reproduce that: they are not the room's creator,
  // so the `created_by` test refuses them whether the conjunct is there or not. Verified by
  // removing the conjunct — the attack half still passes.
  //
  // These cases are kept anyway and are evidence for TWO things worth keeping evidence for:
  // that the creator test is doing its job, and that neither action can be turned into a
  // cross-family read by an id alone. The dual-membership gap is recorded here rather than
  // papered over; closing it means adding a user to two families, which changes what
  // `auth_family_code()` resolves for them and what every `getMyFamilies` count asserts, and
  // is a fixture change to make deliberately rather than in passing.
  {
    kind: 'write',
    id: 'chat.addGroupMember (a group room from another family)',
    mod: 'app/actions/chat.ts', fn: 'addGroupMember',
    args: fx => [fx.alpha.groupRoom.id, fx.users.bravoMember.userId],
    // The participant list is the damage: a BRAVO member inside an ALPHA room can read every
    // message in it, and `chat_participants` is what realtime evaluates its own policy against.
    probe: (db, fx) => snapshot('chat_participants', 'room_id, user_id',
      { room_id: fx.alpha.groupRoom.id })(db),
    // The room's CREATOR, which is what both actions demand. `alphaAdmin` would be refused for
    // a reason that has nothing to do with family isolation — see the note above.
    positiveActor: 'alphaMember',
    positiveArgs: fx => [fx.alpha.groupRoom.id, fx.users.alphaOther.userId],
  },
  {
    kind: 'write',
    id: 'chat.removeGroupMember (a group room from another family)',
    mod: 'app/actions/chat.ts', fn: 'removeGroupMember',
    args: fx => [fx.alpha.groupRoom.id, fx.users.alphaOther.userId],
    // `is_hidden` and `can_reply` are what a removal writes, so the projection has to carry
    // them or a successful removal reads as a no-op — the second fixture failure mode §7 names.
    probe: (db, fx) => snapshot('chat_participants', 'room_id, user_id, is_hidden, can_reply',
      { room_id: fx.alpha.groupRoom.id })(db),
    positiveActor: 'alphaMember',
    // Its own row to consume: the control really does hide `alphaOther`, and the add case above
    // is what puts them back. Ordering between the two is therefore load-bearing in one
    // direction only — add runs first — and neither reads the other's result.
    positiveArgs: fx => [fx.alpha.groupRoom.id, fx.users.alphaOther.userId],
  },


  // ── money ─────────────────────────────────────────────────────────────────
  // These two ran their control as the ADMIN until 20260808000002, and not because the
  // policy wanted a grant: permission_table_map points dues_schedules at 'admin/accounting'
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
  //
  // THREE MORE MUTATIONS were run on 2026-08-18, when the roster stopped being accounts-only
  // and the three states arrived. Observed, not expected, with
  // `node --import ./tests/rls/register.mjs ./tests/rls/run.mjs getDuesProjection`:
  //
  //   `.filter(p => p.user_id)` put back on `roster`      BOTH halves FAIL — the control
  //     (the accounts-only behaviour this reverses)          loses ALPHA's record, the attack
  //                                                          loses BRAVO's own
  //   `.eq('family_code', familyCode)` dropped from the    ATTACK fails: BRAVOTESTUninvited
  //     new `family_invitations` read                         comes back 'invited' on the
  //                                                          strength of ALPHA's row
  //   `invitationOpen: invited.has(p.id)` → `false`        BOTH halves FAIL — 'invited'
  //                                                          collapses into 'pending-invite'
  //
  // The second is the one worth reading: it is the ONLY assertion in the suite covering the
  // fifth read this action gained, and it fails on the attack half alone, by design. The
  // fixture pair it leans on is `crossFamilyInvitation` and `uninvitedRecord` in seed.mjs.
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
      && r.people.every(p => p.id !== fx.alpha.invitedRecord.id)
      && r.projection.membersCounted === r.people.length
      // BRAVO's OWN records ARE in BRAVO's projection, which is what stops the two lines
      // above from passing on an empty roster — and is the attack half of the roster change.
      && r.people.some(p => p.id === fx.bravo.invitedRecord.id)
      && projectionStatus(r, fx.bravo.invitedRecord.id) === 'invited'
      // THE DETECTOR for the family conjunct on the NEW invitations read. ALPHA holds an open
      // invitation to this person's address (see `crossFamilyInvitation` in seed.mjs), so a
      // projection that read `family_invitations` unscoped would report BRAVO's own record as
      // Invited on the strength of a row ALPHA wrote.
      && projectionStatus(r, fx.bravo.uninvitedRecord.id) === 'pending-invite',
    expectPositive: (r, fx) =>
      r !== null
      && r.people.some(p => p.id === fx.users.alphaMember.personId)
      && projectionStatus(r, fx.users.alphaMember.personId) === 'active'
      // THE ROSTER ASSERTION, and the reason this control was strengthened on 2026-08-18: a
      // person with NO ACCOUNT is counted, because a projection is what the family is owed and
      // a recorded relative owes it. Put `.filter(p => p.user_id)` back on the roster in
      // getDuesProjection and this is the half that goes red.
      && r.people.some(p => p.id === fx.alpha.invitedRecord.id)
      && projectionStatus(r, fx.alpha.invitedRecord.id) === 'invited'
      && projectionStatus(r, fx.alpha.uninvitedRecord.id) === 'pending-invite',
  }),

  // ── The membership report: counts, and the two tables no member can read ──
  //
  // `getMembershipReport` reads FOUR tables on the admin client, and two of them are ones an
  // ordinary member is refused outright: the composed SELECT policies on `chapters` and
  // `regions` both demand `admin/chapters:view = 'any'` (their `permission_table_map` rows
  // carry an `own_expr` of the literal 'false'). So there is no policy underneath half this
  // action at all, and every conjunct protecting it is a hand-written `.eq('family_code', …)`
  // — AGENTS.md §3's obligation in its purest form.
  //
  // ── THE ASSERTIONS ARE EXACT COUNTS, AND THEY HAVE TO BE ──────────────────────────────
  // This action returns COUNTS and PLACE NAMES and nothing else — no person, no id, no
  // birthday — so the default marker scan can only catch a leaked region or chapter NAME.
  // That is one of the four reads. The other three leak as a number that is too big and
  // carries no ALPHA string in it at all, and a relative assertion cannot see it: the four
  // breakdowns are four reductions of ONE roster, so they go on summing to the total no
  // matter whose people are in it.
  //
  // The first draft asserted only those internal sums and `>= 1` floors, and TWO of the three
  // mutations below sailed through it. So the numbers are the fixture's own roster, written
  // down. WHEN THE FIXTURE GROWS A PERSON, THESE GO RED and the repair is to update them —
  // that is the cost of an absolute, and it is the price of the case meaning anything.
  //
  //   ALPHA  11 people · 5 active, 1 invited, 5 pending invite · 2 regions, 3 chapters
  //   BRAVO  10 people · 4 active, 1 invited, 5 pending invite · 2 regions, 3 chapters
  //
  // TO SEE IT FAIL — required before treating this as evidence (§7). Three mutations, run
  // with `node --import ./tests/rls/register.mjs ./tests/rls/run.mjs getMembershipReport`,
  // and all three were run on 2026-08-20:
  //
  //   drop `.eq('family_code', …)` from the `people` read     BOTH halves fail — each family
  //                                                            reports the two rosters added
  //                                                            together
  //   drop it from the `chapters` read                        ATTACK fails on the marker:
  //                                                            'ALPHATEST chapter' is a label
  //                                                            in BRAVO's byChapter
  //   drop it from the `family_invitations` read              ATTACK fails: BRAVO's
  //                                                            uninvitedRecord is counted as
  //                                                            Invited on the strength of
  //                                                            ALPHA's row — 2 invited, 4
  //                                                            pending rather than 1 and 5
  //
  // THE CONTROL IS ALPHA'S ADMINISTRATOR, not its plain member, and that is a fact about the
  // feature: 20260820000003 registers this key `restricted` and carries the grant across from
  // `admin/reports`, so alphaMember — the suite's default owner — is correctly refused and
  // gets null. A control that failed there would report this case as proving nothing.
  read('reports.getMembershipReport', 'app/actions/reports.ts', 'getMembershipReport', {
    positiveActor: 'alphaAdmin',
    expectAttack: (r) =>
      r !== null
      // BRAVO's own geography is there — which is what stops every line below from passing
      // on an empty report, the failure mode §7's positive-control argument is about.
      && r.byChapter.some(s => s.label === `${BRAVO} chapter`)
      && r.byRegion.some(s => s.label === `${BRAVO} region`)
      // ...and ALPHA's is not, by name. This duplicates the marker scan deliberately: a
      // marker says "an ALPHA string came out" and this says which field it came out of.
      && r.byChapter.every(s => s.label !== `${ALPHA} chapter`)
      && r.byRegion.every(s => s.label !== `${ALPHA} region`)
      // THE ROSTER, EXACTLY. Nothing else in this case can see an unscoped `people` read.
      && r.total === 10
      && r.chapterCount === 3 && r.regionCount === 2
      // THE INVITATION SPLIT, EXACTLY, which is what sees an unscoped `family_invitations`
      // read: ALPHA holds an open invitation to BRAVO's uninvited record's address (see
      // `crossFamilyInvitation` in seed.mjs), so a leak moves one person from the third
      // bucket to the second and both these numbers move with them.
      && (r.byInvitation.find(s => s.key === 'active')?.count ?? -1) === 4
      && (r.byInvitation.find(s => s.key === 'invited')?.count ?? -1) === 1
      && (r.byInvitation.find(s => s.key === 'pending-invite')?.count ?? -1) === 5
      // The four breakdowns are four reductions of one roster and must each account for all
      // of it — a person who fell out of a bucket is a person the screen does not mention.
      && r.byInvitation.reduce((n, s) => n + s.count, 0) === r.total
      && r.byAge.reduce((n, s) => n + s.count, 0) === r.total
      && r.byChapter.reduce((n, s) => n + s.count, 0) === r.total
      && r.byRegion.reduce((n, s) => n + s.count, 0) === r.total,
    expectPositive: (r) =>
      r !== null
      && r.total === 11
      // ALPHA's own geography resolves for a caller reading it through the admin client —
      // the same property `members.getMembers`'s control asserts about `chapterPlaces`, and
      // the one that fails silently as "everybody is National" if an embed is refused (§8).
      && r.byChapter.some(s => s.label === `${ALPHA} chapter`)
      && r.byRegion.some(s => s.label === `${ALPHA} region`)
      // EMPTY PLACES ARE LISTED, which is the feature and not an incidental. The fixture
      // seeds a spare chapter and a spare region in each family with nobody in them; a report
      // built from `people.chapters(name)` — the way the retired /admin/reports built its
      // chapter list — would omit both.
      && r.byChapter.some(s => s.label === `${ALPHA} spare chapter` && s.count === 0)
      && r.byRegion.some(s => s.label === `${ALPHA} spare region` && s.count === 0)
      // All three invitation states are reachable in ALPHA's fixture, so the split is
      // exercised rather than merely present: alphaMember has an account, invitedRecord has
      // an open invitation, uninvitedRecord has neither.
      && (r.byInvitation.find(s => s.key === 'active')?.count ?? -1) === 5
      && (r.byInvitation.find(s => s.key === 'invited')?.count ?? -1) === 1
      && (r.byInvitation.find(s => s.key === 'pending-invite')?.count ?? -1) === 5
      && r.byInvitation.reduce((n, s) => n + s.count, 0) === r.total
      && r.byAge.reduce((n, s) => n + s.count, 0) === r.total,
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
  // SELECT policy demands `auth_permission('reporting/transactions/fund-transfers','view') =
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
  // `getActiveElections` AND `getAllElections` WERE HERE UNTIL 2026-08-21. The member's list
  // is `getElectionsForMember` — narrowed to published elections addressed to the caller's
  // part of the family — and the organizer's is `getElectionsForOrganizer`, which reads on the
  // service role and is gated on `admin/elections:view`. Two functions rather than one because
  // the two screens want opposite things: the member must not see a draft or another chapter's
  // ballot, and the organizer must see every one of them.
  read('elections.getElectionsForMember', 'app/actions/elections.ts', 'getElectionsForMember'),
  // The organizer's list is on the ADMIN client, so no policy narrows it and the
  // `.eq('family_code', …)` in the action is the whole boundary (AGENTS.md §3). The control is
  // `alphaAdmin` because `admin/elections` starts restricted in every family, so a plain
  // member holds no view grant and their control would fail for a permission reason.
  read('elections.getElectionsForOrganizer', 'app/actions/elections.ts', 'getElectionsForOrganizer', {
    positiveActor: 'alphaAdmin',
    expectPositive: (r, fx) => Array.isArray(r) && r.some(e => e.id === fx.alpha.election.id)
      // The DRAFT is the half a member must never see and the organizer must always see, so
      // it is asserted here rather than left to the title marker sweep.
      && r.some(e => e.id === fx.alpha.draftElection.id),
  }),
  // The offices, the regions and the chapters an election can be pointed at. Replaces
  // `admin/users.getAllRoles`, which was deleted with its key — see the note where that case
  // used to be.
  read('elections.getElectionScopeOptions', 'app/actions/elections.ts', 'getElectionScopeOptions', {
    positiveActor: 'alphaAdmin',
    expectPositive: (r, fx) => Array.isArray(r?.roles)
      && r.roles.some(x => x.name === 'ALPHATEST President')
      && r.chapters.some(x => x.id === fx.alpha.chapter.id),
  }),

  // ── [crux] THE AREA BOUNDARY, WHICH IS A RULE INSIDE ONE FAMILY ───────────
  // Every other election case here asks whether BRAVO can reach ALPHA. This one asks whether
  // one part of ALPHA can reach another, which is what 20260821000001 added and what no
  // cross-family assertion can see.
  //
  // The attacker is `alphaSpare`, who is in NO CHAPTER and therefore under National, and the
  // control is `alphaOther`, who is in `f.chapter`. They differ in nothing else — same family,
  // same template, same approval — so whatever the attacker still reaches, they reached
  // because the area rule failed.
  //
  // NOT `alphaMember`, AND THAT IS A CORRECTION RATHER THAN A PREFERENCE.
  // `personal-info.saveChapterAndPropagate`'s positive control puts `alphaMember` INTO
  // `f.chapter` and leaves them there, so an attacker built on that actor is in the chapter by
  // the time half of this file has run — and these cases would then pass or fail depending on
  // where in the array they sat. The `members.getMembers` case already records that hazard and
  // names the fix: `alphaSpare`, whose chapter nothing touches. Found by the raw probes below
  // failing while these passed, which is the two layers disagreeing about the same fixture.
  //
  // CHECKED BY MUTATION, AND THE RESULT IS NOT WHAT IT LOOKS LIKE — read this before trusting
  // these two. Replacing `auth_may_see_election(scope, region_id, chapter_id)` with `true` in
  // every election policy leaves BOTH of these GREEN, because `lib/election-area.ts` filters in
  // the app as well and an action-shaped case cannot tell which layer refused. Measured: all
  // four tables neutered, suite reported 649/649.
  //
  // So what these two are evidence for is the APP layer — which is real and is the layer §5 is
  // about, and is the only layer that exists for `getElectionResults` (service role, no policy).
  // The DATABASE half is asserted by `ELECTION_RAW_CASES` at the foot of this file, which calls
  // PostgREST with no action in the way and DOES trip under that mutation. Both are needed and
  // neither substitutes for the other; that split is why the raw file exists.
  read('elections.getElectionsForMember (a chapter election they are not in)',
    'app/actions/elections.ts', 'getElectionsForMember', {
      attacker: 'alphaSpare',
      expectAttack: (r, fx) => Array.isArray(r)
        && !r.some(e => e.id === fx.alpha.chapterElection.id)
        // AND they still see the national one, or this case would pass for an action that
        // returned nothing to anybody — the failure mode AGENTS.md §7 warns about.
        && r.some(e => e.id === fx.alpha.election.id),
      positiveActor: 'alphaOther',
      expectPositive: (r, fx) => Array.isArray(r)
        && r.some(e => e.id === fx.alpha.chapterElection.id),
    }),
  // ── THE DASHBOARD'S ELECTION CHIP ─────────────────────────────────────────
  // `getMyActionableElection` reuses `getElectionsForMember`, so the area rule and the draft
  // exclusion are the same code — and that is exactly why it needs its own case rather than
  // resting on the ones above. What it adds is a NARROWING (only the two phases a member can
  // act in) and a CHOICE (the one closing soonest), and a bug in either would publish the
  // title and id of a ballot on a screen that gates nothing about elections.
  //
  // THE ATTACK IS THE ORDINARY CROSS-FAMILY ONE. BRAVO's administrator gets their own family's
  // answer, which is legitimate, so the assertion is on ALPHA's specific ids — the shape every
  // read case here uses.
  //
  // THE CONTROL IS WHAT MAKES IT EVIDENCE, and it is not trivially satisfied: the fixture's
  // `nominationElection` is the only one of ALPHA's four whose NOMINATIONS window contains
  // today, and `f.election` is in its voting window — so a caller entitled to both must get
  // one of the two and never a third. Without the control this would pass for a function that
  // answers null to everybody, which is what a wrong phase filter would produce.
  read('elections.getMyActionableElection',
    'app/actions/elections.ts', 'getMyActionableElection', {
      expectPositive: (r, fx) =>
        r != null && (r.id === fx.alpha.nominationElection.id || r.id === fx.alpha.election.id)
        // AND the phase is one of the two a member can act in, which is the narrowing this
        // case exists for. A function that returned a `scheduled` election would satisfy the
        // id assertion above and be wrong.
        && (r.phase === 'nominations' || r.phase === 'voting'),
    }),
  read('elections.getElectionDetail (a chapter election they are not in)',
    'app/actions/elections.ts', 'getElectionDetail', {
      args: fx => [fx.alpha.chapterElection.id],
      attacker: 'alphaSpare',
      expectAttack: (r) => r?.election === null,
      positiveActor: 'alphaOther',
      expectPositive: (r, fx) => r?.election?.id === fx.alpha.chapterElection.id,
    }),
  // The nominee list. It is on the admin client, so the area rule in the action is the only
  // thing narrowing it — and getting it wrong publishes a roster (§5) as well as offering a
  // nomination the policy will refuse.
  read('elections.getElectionNomineeOptions', 'app/actions/elections.ts', 'getElectionNomineeOptions', {
    args: fx => [fx.alpha.chapterElection.id],
    positiveActor: 'alphaOther',
    expectPositive: (r, fx) => Array.isArray(r) && r.some(x => x.id === fx.alpha.otherPersonId)
      // The member with no chapter must NOT be offered for a chapter election, which is the
      // same rule the INSERT policy holds through `election_area_includes_person`. Asserted on
      // `sparePersonId` rather than on `ownerPersonId` because `alphaMember`'s chapter is moved
      // by `personal-info.saveChapterAndPropagate` — see the note on the area cases above.
      && !r.some(x => x.id === fx.alpha.sparePersonId),
  }),

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
/**
 * Which of Dues Projections' three states one person came out as — 'active', 'invited' or
 * 'pending-invite', or undefined for somebody the projection did not count at all.
 *
 * A helper rather than an inline `.find(...)` because both halves of `dues.getDuesProjection`
 * ask it four times between them, and the interesting failure is `undefined`: a person missing
 * from `projection.members` reads as "not counted", which is exactly the accounts-only
 * behaviour the case exists to refuse.
 */
const projectionStatus = (r, personId) =>
  r?.projection?.members?.find(m => m.personId === personId)?.status

const snapshot = (table, cols, filter) => async (db) => {
  let q = db.from(table).select(cols).order('id')
  for (const [col, val] of Object.entries(filter)) q = q.eq(col, val)
  const { data, error } = await q
  if (error) throw new Error(`probe ${table}: ${error.message}`)
  return JSON.stringify(data)
}

/**
 * Who is standing behind one or more candidacies.
 *
 * Its own probe rather than `snapshot()`, and for that helper's own stated reason:
 * `election_nomination_supporters` is keyed (nomination_id, person_id) and has NO `id`
 * column, so `snapshot`'s `.order('id')` would fail with 42703 before it ever looked at a
 * row — and a probe that throws is a case that reports nothing rather than a case that
 * passes, which is the better failure but is still not a test. `template_permissions` needed
 * its own for exactly this.
 *
 * Ordered explicitly on both key columns, because `before === after` is the whole assertion
 * and PostgREST makes no promise about row order without an ORDER BY.
 */
const probeSupporters = (nominationIds) => async (db, fx) => {
  const { data, error } = await db.from('election_nomination_supporters')
    .select('nomination_id, person_id')
    .in('nomination_id', nominationIds(fx))
    .order('nomination_id')
    .order('person_id')
  if (error) throw new Error(`probe election_nomination_supporters: ${error.message}`)
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
    resource_key: 'admin/accounting/bank',
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
    .eq('resource_key', 'admin/accounting/bank')
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
      category: 'appointed_position', scope: 'national',
      sort_order: f.customRole.sort_order,
    })
    if (error) throw new Error(`setup: ${error.message}`)
  }
}

/**
 * The board-position assignment fixtures, rebuilt before EVERY half of every case that uses
 * them. `runWrite` calls `setup` twice — once before the attack and once before the control —
 * which is what makes this shape work: each half starts from the same known state.
 *
 * Three rows per family, and each exists for a stated reason:
 *
 *   `position`    an office with NOBODY holding it, so the two assign cases have somewhere to
 *                 insert. Every assignment on it is cleared here, because the control inserts
 *                 (person, position) and `user_roles_user_id_family_code_role_id_key` would
 *                 otherwise refuse the second case's control with "they already hold that
 *                 position" — a no-op, which `runWrite` correctly reports as the attack
 *                 assertion being vacuous.
 *   `spare`       a second office, holding exactly one assignment, so `revokeBoardPosition`'s
 *                 control has a row to delete that nothing else depends on. This is
 *                 `deletableChild`'s rule: a control that mutates a row a later case reads is
 *                 how a suite goes green over a finding.
 *   `assignment`  that row's id, which is the client-supplied id the revoke case attacks with.
 *
 * NOT ADDED TO seed.mjs, deliberately. These rows exist for three cases in this file, the
 * fixture is already the largest file in the suite, and a row seeded there is a row every
 * marker scan and every sweep has to be reasoned about. They are stashed on `fx` on first use
 * so the ids are stable for the rest of the run.
 */
const resetBoardAssignments = async (db, fx) => {
  for (const side of ['alpha', 'bravo']) {
    const f = fx[side]
    f.board ??= {}

    for (const [slot, name, order] of [['position', 'Assignable', 910], ['spare', 'Revocable', 911]]) {
      if (f.board[slot]) {
        // RESTORED BY ID, AND THE NAME IS THE POINT. `renameBoardPosition`'s control changes it,
        // so a helper that only created the row when absent would leave the renamed name in
        // place — and the next `upsert` by the name key would then create a SECOND row rather
        // than finding it. Restoring by id is what makes this helper idempotent under a rename
        // as well as under a delete.
        const { error } = await db.from('family_roles')
          .update({ name: `${f.familyCode} ${name}` }).eq('id', f.board[slot])
        if (error) throw new Error(`setup board ${slot} restore: ${error.message}`)
      } else {
        // `onConflict` ON THE REAL INDEX, WHICH GAINED A COLUMN ON 2026-08-20. It was
        // `family_code,name` — the index 20260819000004 created — and 20260820000001 replaced
        // that with `(family_code, name, scope)` so a family may keep the same title at each
        // scope. PostgREST resolves `onConflict` against an actual unique index, so the old
        // list did not merely become imprecise: it answered 42P10 ("no unique or exclusion
        // constraint matching the ON CONFLICT specification") and took four cases down as
        // HARNESS errors. That is the RLS suite doing the job AGENTS.md §7 describes — the
        // fixture is the half most likely to rot when the schema moves under it.
        //
        // A plain insert would work on the first call and 23505 on a re-run, and this helper
        // runs many times.
        const { data, error } = await db.from('family_roles')
          .upsert({
            family_code: f.familyCode, name: `${f.familyCode} ${name}`,
            category: 'appointed_position', scope: 'national', sort_order: order,
          }, { onConflict: 'family_code,name,scope' })
          .select('id').single()
        if (error) throw new Error(`setup board ${slot}: ${error.message}`)
        f.board[slot] = data.id
      }
    }

    const holder = side === 'alpha' ? fx.users.alphaOther : fx.users.bravoMember
    for (const roleId of [f.board.position, f.board.spare]) {
      const { error } = await db.from('user_roles').delete().eq('role_id', roleId)
      if (error) throw new Error(`setup board wipe: ${error.message}`)
    }
    const { data, error } = await db.from('user_roles')
      .insert({ family_code: f.familyCode, user_id: holder.userId, role_id: f.board.spare })
      .select('id').single()
    if (error) throw new Error(`setup board assignment: ${error.message}`)
    f.board.assignment = data.id
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
    // THE RENAME LANDED, and this is the one line the previous note here said would be all
    // that was needed. `20260819000004_board_positions_per_family.sql` retired the hybrid
    // `family_roles` — the 25 built-ins are gone, `is_global` is DROPPED, `family_code` is NOT
    // NULL, and the SELECT policy gained the family conjunct it never had. `deleteCustomRole`
    // became `deleteBoardPosition`, and its resource key moved from `admin/chapters` to
    // `admin/boardpositions`. `fn` and the case id are the only edits, because the note was
    // right that a rename leaves the subject, the setup and the probe alone.
    //
    // TWO PROPERTIES OF THE FIXTURE now keep this case honest, and both can be broken from a
    // distance by an edit to seed.mjs rather than to this file:
    //
    //   `deleteBoardPosition` REFUSES while anybody holds the position. `f.customRole` is held
    //   by nobody — seed.mjs deliberately hangs `f.userRole` off a SECOND position (`${code}
    //   President`) so this delete cannot cascade away the row `raw:user_roles` sweeps. Collapse
    //   those two back into one and this case starts asserting the holder refusal instead of
    //   family isolation, and passes for the wrong reason.
    //
    //   The key is `admin/boardpositions`, which the attacker holds at scope `'any'` IN BRAVO,
    //   exactly as they held `admin/chapters` before. That is the whole point of the attacker
    //   being an administrator (§7): the grant is satisfied, so what is left to fail is isolation.
    id: "admin/chapters.deleteBoardPosition (another family's custom board position)",
    mod: 'app/actions/admin/chapters.ts', fn: 'deleteBoardPosition',
    // WHAT THE CASE IS FOR. `family_roles` WAS the HYBRID table AGENTS.md warns about: global
    // rows carried a NULL family_code and a family's own positions carried theirs. The action
    // had `.eq('id', id).eq('is_global', false)` and no family conjunct at all, so BRAVO's
    // administrator could delete ALPHA's position by id — the same shape as the two deletes
    // above, on a table nobody was looking at because /admin/boardpositions was still Coming
    // Soon. The ACTION was reachable regardless, which is the whole of AGENTS.md's "COMING SOON
    // WITHHOLDS A PAGE. IT DOES NOT WITHHOLD AN ACTION". None of that changes with the rename:
    // the id still arrives from the client and the delete still runs where a missing conjunct
    // reaches another family.
    args: fx => [fx.alpha.customRole.id],
    setup: resetCustomRoles,
    probe: (db, fx) => snapshot('family_roles', 'id, name, family_code',
      { id: fx.alpha.customRole.id })(db),
    positiveActor: 'alphaAdmin',
  },

  // -- GIVING AND TAKING AWAY A BOARD POSITION (2026-08-19) -------------------
  //
  // `/admin/members/board-positions` went live on 2026-08-19 and grew the thing it had never had: a
  // way to record who holds an office. The assignment actions below replace four exports in
  // `app/actions/admin/users.ts` that had NO CALL SITE and were reachable anyway —
  // `assignRole` wrote four client-supplied ids onto a `user_roles` row carrying the caller's
  // own family_code (§4, and the `roleId` one is how one family assigned another family's
  // position), and `revokeRoleByAssignmentId` was `.delete().eq('id', assignmentId)` on the
  // service-role client with no family conjunct at all (§3 — `deleteRegion`'s hole in a second
  // costume). Both are deleted; these cases are what stops the replacements repeating them.
  //
  // ONE CASE PER ID, which is what §4 asks for: `assignBoardPosition` takes a position and a
  // person and either can point across the boundary, so the position case passes ALPHA's
  // position with a BRAVO person and the person case does the opposite. A single case passing
  // both ALPHA ids would pass the moment EITHER check existed and prove nothing about the other.
  //
  // `chapterId`/`regionId` are the third and fourth such ids and are NOT covered, deliberately
  // and with a stated reason: the action derives the assignment's scope from the POSITION, so
  // reaching either check needs a position whose scope is 'regional' or 'chapter', and the
  // refusal that arrives first for a cross-family caller is "Position not found" on the id the
  // case above already covers. The `belongsToFamily` calls are the same two `createChapter` and
  // `createDuesSchedule` already have cases for, on the same two tables. Recorded here rather
  // than left looking covered.
  //
  // ── CHECKED BY MUTATION, 2026-08-19. OBSERVED, not expected ─────────────────────────────
  //   m1  `revokeBoardPosition`: drop `.eq('family_code', g.familyCode)` from BOTH the
  //       read-back and the delete — which is exactly what the action it replaced looked like
  //       (`.delete().eq('id', assignmentId)`, no conjunct)
  //         FAIL  revokeBoardPosition (attack)      — ALPHA's assignment row deleted by BRAVO
  //         pass  everything else, including both assign cases
  //   m2  `assignBoardPosition`: drop the conjunct from the POSITION lookup
  //         FAIL  assignBoardPosition (a position from another family) — attack
  //         pass  assignBoardPosition (a person from another family) — its protection is the
  //               other conjunct, which is the discrimination these two cases exist for
  //   m3  `assignBoardPosition`: drop the conjunct from the PERSON lookup instead
  //         FAIL  assignBoardPosition (a person from another family) — attack
  //         pass  assignBoardPosition (a position from another family)
  //       One case per id, and each one fails for its own id and nothing else — which is what
  //       a single case passing both ALPHA ids could not have told anybody.
  // -- THE BOARD-POSITION READS, WHICH THE WRITES ABOVE DO NOT COVER ----------
  //
  // ADDED 2026-08-19 by review, and the gap is worth naming: the four writes below had cases
  // from the day the screen went live and the five READS did not, while the three
  // same-shaped reads in the same module (`getRegions`, `getChapters`, `getScopeUsage`) have
  // had them since 2026-08-18. Drop `.eq('family_code', g.familyCode)` from either read in
  // `getBoardPositions` and every family's positions — and every family's holder counts —
  // land on one family's screen, with the suite still green. The writes are the half that
  // damages; the reads are the half that publishes.
  //
  // ALL FIVE ARE ADMIN-CLIENT READS, so RLS is not underneath them and the family conjunct is
  // the whole boundary. The default marker scan is the attack assertion, and it is not vacuous
  // here: `'ALPHATEST President'` is on the marker list precisely because a position's NAME
  // became ALPHA-only data when `family_roles` stopped being a hybrid.
  //
  // The controls are `alphaAdmin` rather than the default member, because every one of these
  // is `requireScope(…, 'view')` on an `admin/` key — which fails closed since 20260817000004,
  // so a General template resolves 'none' and would make each control vacuously empty.
  //
  // ── CHECKED BY MUTATION, 2026-08-19. OBSERVED ───────────────────────────────────────────
  //   m5  `getBoardPositions`: drop `.eq('family_code', g.familyCode)` from the positions read
  //         FAIL  admin/chapters.getBoardPositions (attack) — BRAVO's administrator gets
  //               'ALPHATEST President' in the list
  //         pass  every other case, the four reads beside it included, which is the point of
  //               having five rather than one: each one's conjunct is its own.
  read('admin/chapters.getBoardPositions', 'app/actions/admin/chapters.ts', 'getBoardPositions', {
    positiveActor: 'alphaAdmin',
    expectPositive: (r) => Array.isArray(r)
      && r.some(pos => pos.name === 'ALPHATEST President')
      // AND THE HOLDER COUNT, which is a second query inside the same action and the thing
      // the delete refusal is built on. The fixture gives that position exactly one holder,
      // so a count of 0 here means the `user_roles` read came back empty — which would make
      // every position look deletable.
      && r.some(pos => pos.name === 'ALPHATEST President' && pos.holders === 1),
  }),
  read('admin/chapters.getBoardPositionHolders', 'app/actions/admin/chapters.ts',
    'getBoardPositionHolders', {
      positiveActor: 'alphaAdmin',
      // FIVE READS AND A TYPESCRIPT JOIN, so this control is about the join as much as the
      // scoping: a holder whose `people` row did not resolve renders as "Somebody no longer
      // in this family", which is a real state and must not be the state a healthy fixture
      // produces.
      expectPositive: (r, fx) => Array.isArray(r)
        && r.some(h => h.assignment_id === fx.alpha.userRole.id
          && h.position_name === 'ALPHATEST President'
          && h.person_name !== 'Somebody no longer in this family'),
    }),
  read('admin/chapters.getAssignableMembers', 'app/actions/admin/chapters.ts',
    'getAssignableMembers', {
      positiveActor: 'alphaAdmin',
      // THE ATTACK IS SPELLED OUT because this projection carries no marker. It is
      // `SelectablePerson`-shaped — id, names, birthday — and the marker list holds ALPHA
      // people ids only for the rows other cases are about, so a scan could pass over a
      // leaked roster. Naming two ALPHA person ids makes the assertion say what it means.
      expectAttack: (r, fx) => Array.isArray(r)
        && !r.some(m => m.id === fx.users.alphaOther.personId
          || m.id === fx.users.alphaMember.personId),
      // ACCOUNTS ONLY, AND APPROVED ONLY, which is the other half of what this action is for:
      // `user_roles.user_id` references `auth.users`, so a recorded relative cannot hold an
      // office, and an applicant has not joined yet. Both are asserted, because both are one
      // `.eq()` away from being dropped.
      expectPositive: (r, fx) => Array.isArray(r)
        && r.some(m => m.id === fx.users.alphaOther.personId)
        && !r.some(m => m.id === fx.alpha.applicantPersonId)
        && !r.some(m => m.id === fx.alpha.invitedRecord.id),
    }),
  read('admin/chapters.getBoardPositionScopeOptions', 'app/actions/admin/chapters.ts',
    'getBoardPositionScopeOptions', {
      positiveActor: 'alphaAdmin',
      expectPositive: (r, fx) => Array.isArray(r?.regions) && Array.isArray(r?.chapters)
        && r.regions.some(x => x.id === fx.alpha.region.id)
        && r.chapters.some(x => x.id === fx.alpha.chapter.id),
    }),
  // `admin/users.getAllRoles` WAS HERE AND THE FUNCTION IS DELETED (2026-08-21). It was the
  // elections-facing read of this same table, gated on `admin/elections` rather than
  // `admin/boardpositions` because an organizer may hold one screen and not the other — and
  // that reasoning survives; what did not is the function. Its gate named
  // `review/election-management`, a key 20260821000000 removes, and an unregistered key that
  // is not shaped `admin/…` falls back to visibility 'everyone' — so leaving it would have
  // turned the gate into a grant. The read it did is now
  // `elections.getElectionScopeOptions`, asserted with the other election cases above.

  {
    kind: 'write',
    id: "admin/chapters.renameBoardPosition (another family's position)",
    mod: 'app/actions/admin/chapters.ts', fn: 'renameBoardPosition',
    // ADDED 2026-08-19, with the action. The catalogue's third write, and the one whose absence
    // was a TODO entry: the delete refuses while anybody holds a position, so without a rename a
    // typo noticed after the officers were recorded could only be fixed by un-assigning
    // everybody first.
    //
    // An UPDATE on the service-role client with an id from the client — `deleteRegion`'s shape
    // with a different verb, and `family_roles` has no UPDATE policy at all (§2c), so there is
    // no RLS underneath this to catch a missing conjunct. Both statements need it: the read-back
    // that decides "Position not found", and the update itself.
    //
    // CHECKED BY MUTATION, 2026-08-19: dropping the conjunct from BOTH the read-back and the
    // UPDATE fails this case's attack and nothing else — BRAVO's administrator renames
    // 'ALPHATEST Assignable' and the probe reports the new name.
    //
    // The attacking name is deliberately something no fixture would produce, so a probe that
    // changed says exactly what happened rather than leaving a reader to compare two plausible
    // strings.
    args: fx => [fx.alpha.board.position, 'BRAVOTEST renamed this'],
    setup: resetBoardAssignments,
    probe: (db, fx) => snapshot('family_roles', 'id, name, family_code',
      { id: fx.alpha.board.position })(db),
    positiveArgs: fx => [fx.alpha.board.position, 'ALPHATEST Assignable renamed'],
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/chapters.assignBoardPosition (a position from another family)',
    mod: 'app/actions/admin/chapters.ts', fn: 'assignBoardPosition',
    // The attacker's own person, ALPHA's position: the row would land in BRAVO carrying an
    // office ALPHA invented and BRAVO can neither see nor name.
    args: fx => [{ positionId: fx.alpha.board.position, personId: fx.users.bravoMember.personId }],
    setup: resetBoardAssignments,
    probe: (db, fx) => snapshot('user_roles', 'id, user_id, role_id, family_code',
      { role_id: fx.alpha.board.position })(db),
    positiveArgs: fx => [{ positionId: fx.alpha.board.position, personId: fx.users.alphaOther.personId }],
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/chapters.assignBoardPosition (a person from another family)',
    mod: 'app/actions/admin/chapters.ts', fn: 'assignBoardPosition',
    // The mirror. The attacker's own position, ALPHA's person — which is the shape that gives
    // one family's office to somebody who is not in it, and the reason the action takes a
    // people.id and resolves the account itself rather than accepting a user id.
    args: fx => [{ positionId: fx.bravo.board.position, personId: fx.users.alphaOther.personId }],
    setup: resetBoardAssignments,
    // Probed on the PERSON rather than the position, because that is where this attack would
    // show: a row in BRAVO naming ALPHA's user. The positive control moves the same snapshot,
    // which is why `resetBoardAssignments` clears assignments on both families' positions —
    // without that the control's insert would collide with the previous case's and change
    // nothing, making the attack assertion above vacuous.
    probe: (db, fx) => snapshot('user_roles', 'id, user_id, role_id, family_code',
      { user_id: fx.users.alphaOther.userId })(db),
    positiveArgs: fx => [{ positionId: fx.alpha.board.position, personId: fx.users.alphaOther.personId }],
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: "admin/chapters.revokeBoardPosition (another family's assignment)",
    mod: 'app/actions/admin/chapters.ts', fn: 'revokeBoardPosition',
    // Byte for byte the `deleteRegion` shape its predecessor had: one id from the client, a
    // delete on the service-role client, and nothing but `.eq('id', …)` underneath. `user_roles`
    // has no DELETE policy at all (§2c), so there is no RLS beneath this to catch it.
    args: fx => [fx.alpha.board.assignment],
    setup: resetBoardAssignments,
    probe: (db, fx) => snapshot('user_roles', 'id, user_id, role_id, family_code',
      { id: fx.alpha.board.assignment })(db),
    positiveActor: 'alphaAdmin',
  },

  // -- THE UPDATES ARCHIVE (20260819000005) ----------------------------------
  //
  // `/community/updates` is the archive behind the dashboard's Recent Updates card: `announcements` and
  // the caller's own `notifications`, merged by date, searchable. BOTH reads go through the
  // USER client, so family isolation on both tables is RLS's — which is what §7 is written
  // about, and what these cases are for.
  //
  // The default marker scan is the whole attack assertion and it is a strong one here: the
  // response carries every announcement's TITLE AND BODY, and `'secret body ALPHATEST'` is on
  // the marker list, so a leak cannot be a subtle one.
  //
  // ── CHECKED BY MUTATION, 2026-08-19. OBSERVED ───────────────────────────────────────────
  //   m4  `getUpdatesArchive`: read `announcements` on `createAdminClient()` instead of the
  //       user client. Not a contrived edit — it is the plausible "fix" for the one thing this
  //       action deliberately does without (chapter NAMES, which need an admin-client read),
  //       and the service role applies no RLS at all.
  //         FAIL  updates.getUpdatesArchive (attack)
  //         FAIL  updates.getUpdatesArchive (searching) (attack)
  //         FAIL  updates.getUpdatesArchive (a query of nothing but punctuation) (attack)
  //         pass  updates.getUpdatesArchive (pending member) (attack)
  //
  //       THAT LAST LINE IS THE USEFUL ONE and it is why the pending case is labelled below
  //       rather than left looking like a fourth copy of the same assertion: an applicant does
  //       not hold `announcements:view`, so `mayViewBoard` is false and the announcements query
  //       is never built — the client it would have used is beside the point. The pending case
  //       is evidence about the GRANT; the three above are evidence about the CLIENT.
  read('updates.getUpdatesArchive', 'app/actions/updates.ts', 'getUpdatesArchive', {
    expectPositive: (r, fx) => Array.isArray(r?.items)
      && r.items.some(i => i.kind === 'announcement' && i.id === fx.alpha.announcement.id)
      // AND THE HALVES ARE REPORTED HONESTLY. `announcementsIncluded` is what lets the screen
      // say the board is not in the list rather than showing an archive that quietly omits it,
      // so a control that only counted rows would pass over a version that always said false.
      && r.announcementsIncluded === true
      && r.failed === false,
  }),
  // THE SEARCH, which is the half no other case reaches: the query is a value from a text box
  // going into a PostgREST filter, and the row it must find is ALPHA's announcement BODY —
  // `secret body ALPHATEST`, whose title contains no such word. So this asserts the tsvector
  // covers the body as well as the title, that the `english` config is in play on both sides,
  // and that a search does not widen what the reader may see: BRAVO's administrator searching
  // the same word gets their own family's row and no marker.
  read('updates.getUpdatesArchive (searching)', 'app/actions/updates.ts', 'getUpdatesArchive', {
    args: () => [{ q: 'secret' }],
    expectPositive: (r, fx) => Array.isArray(r?.items)
      && r.items.some(i => i.id === fx.alpha.announcement.id)
      && r.query === 'secret',
  }),
  // A SEARCH THAT IS NOTHING BUT PUNCTUATION must be a search for nothing rather than a query
  // error or an unfiltered list. `sanitizeUpdatesQuery` strips it to '', and the action then
  // runs no `textSearch` at all — so this is also the assertion that an emptied query does not
  // silently become "show me everything, from anybody".
  read('updates.getUpdatesArchive (a query of nothing but punctuation)',
    'app/actions/updates.ts', 'getUpdatesArchive', {
      args: () => [{ q: '(),:;' }],
      expectPositive: (r, fx) => Array.isArray(r?.items)
        && r.query === ''
        && r.items.some(i => i.id === fx.alpha.announcement.id),
    }),
  // AND TO SOMEBODY THE FAMILY HAS NOT ADMITTED. Placed here beside its siblings rather than
  // in PENDING_CASES, because the three above are the context that makes it readable and every
  // array in this file is concatenated into `CASES` regardless. An applicant is inside ALPHA's
  // boundary by every test the cross-family cases apply, so this is the axis that asserts the
  // guard: `notifications` carries `auth_membership_approved()` in its own policy, and the
  // announcement half is refused by `auth_permission()` resolving nothing for a caller with no
  // approved person row.
  read('updates.getUpdatesArchive (pending member)', 'app/actions/updates.ts', 'getUpdatesArchive', {
    attacker: 'alphaPending',
    expectAttack: (r) => Array.isArray(r?.items) && r.items.length === 0,
    expectPositive: (r, fx) => Array.isArray(r?.items)
      && r.items.some(i => i.id === fx.alpha.announcement.id),
  }),

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
  // THE MEMBERS & ACCESS ROSTER, AND IT GAINED TWO COLUMNS ON 2026-08-19. `chapterName` and
  // `regionName`, resolved by a `chapterPlaces` that is a DELIBERATE second copy of the one in
  // app/actions/members.ts — its own comment says why it is not shared (promoting a private
  // helper out of a `'use server'` file would publish a chapter-and-region lookup as an HTTP
  // endpoint) and that the two must be changed together. THIS ASSERTION IS THE HALF OF THAT
  // PROMISE A TEST CAN KEEP: it pins the same pair of names on the same person as
  // `members.getMembers` above, so the two member tables cannot start spelling one family's
  // geography two ways without one of the two cases going red.
  //
  // The attack half stays the default marker scan, which is now stronger than it was: adding
  // `'ALPHATEST region'` to `alphaMarkers()` means a cross-family read of this roster is caught
  // by the region name as well as by the ids and addresses it already carried.
  //
  // `alphaOther` is the subject because they have an ACCOUNT — this action filters
  // `user_id IS NOT NULL`, deliberately, so the account-less records `members.getMembers` lists
  // are not here to be asserted about — and because the fixture puts them in `f.chapter`, which
  // sits in `f.region`. `alphaAdmin` is the control for the reason stated above: `admin/users`
  // starts 'restricted' in every family, so a plain member's control would fail on the grant.
  read('admin/permissions.searchMembers', 'app/actions/admin/permissions.ts', 'searchMembers', {
    positiveActor: 'alphaAdmin',
    expectPositive: (r, fx) => {
      const inChapter = r?.rows?.find(m => m.personId === fx.users.alphaOther.personId)
      const national = r?.rows?.find(m => m.personId === fx.users.alphaMember.personId)
      return !!inChapter
        && inChapter.chapterName === 'ALPHATEST chapter'
        && inChapter.regionName === 'ALPHATEST region'
        // NULL RATHER THAN THE WORD "National", identically to `members.getMembers` — the
        // caption belongs to the component. `alphaMember` is the row in no chapter, and it has
        // to be a row in this projection: the birthday record `getMembers` uses for this is
        // account-less and so is filtered out here.
        //
        // AND IT IS ORDER-DEPENDENT, WHICH IS SAID HERE RATHER THAN LEFT TO BE DISCOVERED.
        // `personal-info.saveChapterAndPropagate`'s positive control puts `alphaMember` INTO
        // `f.chapter` and leaves them there — so this assertion is only true because that case
        // sits later in MORE_CASES than this one does. Moving either past the other turns this
        // control red with `chapterName: 'ALPHATEST chapter'`, which is the fixture telling the
        // truth rather than a bug; the fix then is `fx.users.alphaSpare`, whose chapter nothing
        // touches.
        && !!national && national.chapterName === null && national.regionName === null
    },
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
      r?.['admin/members:edit'] === 'any' && r?.['admin/members/templates:edit'] === 'any',
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
  //      So `auth_permission('admin/settings','edit') = 'any'` is exactly what those two
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
    // `auth_permission('admin/settings','edit') = 'any'` in the policy. Naming the family
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
  //   2. Drop `canAny(user.id, 'reporting/transactions/fund-transfers', 'create')`
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
    // `auth_permission('reporting/transactions/fund-transfers','create') = 'any'` in the INSERT
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
    // Against the election whose NOMINATIONS WINDOW CONTAINS TODAY — the INSERT policy
    // requires `election_window_open(election_id, 'nominations')`, which reads CURRENT_DATE,
    // so aiming at the voting election would fail for everyone and prove nothing about
    // isolation. The fixture computes both windows from `inDays` for that reason.
    args: fx => [fx.alpha.nominationElection.id, fx.alpha.nominationPosition.id, fx.alpha.ownerPersonId],
    probe: (db, fx) => snapshot('election_nominations', 'id, nominee_id, nominated_by',
      { election_id: fx.alpha.nominationElection.id })(db),
    // ── THE CONTROL IS AN ORDINARY MEMBER NOW, AND THAT IS THE POINT ─────
    // It was `alphaAdmin` — scope 'any' on every resource — so it asserted only that
    // SOMEBODY in ALPHA could nominate. `alphaOther` is on the General template, and until
    // 20260821000004 this line would have been RED: the INSERT policy's authority test is
    //
    //     nominee_id = auth_person_id() OR auth_permission(..., 'create') = 'any' OR ...
    //
    // and General granted `create` at 'none', so the self-expression was the only branch an
    // ordinary member could satisfy — **they could nominate only themselves.** The action has
    // never demanded a grant (`requireMember()`, per its own header), so nothing above the
    // policy reported this and the attack half passed throughout.
    //
    // The nominee is `ownerPersonId`, which is NOT `alphaOther` — the whole assertion is that
    // a member can put SOMEBODY ELSE forward. Mutation-checked by reverting the grant to
    // 'none' for ALPHA's General template, which turns this one line red and nothing else.
    positiveActor: 'alphaOther',
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
  // ── RETRACTING A NOMINATION: FOUR CASES OVER ONE RULE ──────────────────
  //
  // *You may retract a nomination you made. Not one somebody else made, and not one the
  // nominee has already accepted — unless the nominee is you.*
  //
  // The rule lives in `perm:family can retract a nomination` (20260821000004 §4c) and
  // NOWHERE ELSE — `retractNomination` deliberately re-checks none of it, so these are the
  // only thing standing between that policy and a control that quietly removes other
  // people's nominations. Each has its OWN candidacy in the fixture, because a successful
  // control deletes the last supporter and the candidacy goes with it: AGENTS.md §7's warning
  // about a control that mutates a row a later case depends on.
  //
  // EVERY ONE PROBES `election_nomination_supporters`, not `election_nominations`. The
  // supporter row is what the action writes; the candidacy disappearing is a TRIGGER's doing,
  // and a probe on the parent would pass for a case where the supporter row survived and the
  // parent was deleted by something else.
  {
    kind: 'write',
    id: 'elections.retractNomination (a nomination in another family)',
    mod: 'app/actions/elections.ts', fn: 'retractNomination',
    args: fx => [fx.alpha.retractCross.nomination.id, fx.alpha.nominationElection.id],
    probe: probeSupporters(fx => [fx.alpha.retractCross.nomination.id]),
    // `alphaMember` is the nominator the fixture recorded, and the default control actor.
  },
  // ── [crux] IN THE FAMILY, IN THE AREA, FULL GRANTS — AND STILL REFUSED ─────
  // The sharpest of these, and the one no cross-family assertion could ever reach.
  // `alphaAdmin` holds `community/elections:delete` at scope 'any' in their OWN family, is
  // approved, and is under National like this election — so every conjunct the other cases
  // turn on is satisfied for them. What refuses them is `person_id = auth_person_id()`,
  // which the DELETE policy carries as a CONJUNCT rather than as one of the alternatives, so
  // no scope widens it and no grant buys it.
  //
  // That is the difference between this table and its parent: `election_nominations`' DELETE
  // policy has `delete = 'any'` as an alternative, which is right (an organizer must be able
  // to strike a nomination) and would be wrong here (nobody may take another member's name
  // off a nomination that member made).
  {
    kind: 'write',
    id: 'elections.retractNomination (a nomination they did not make)',
    mod: 'app/actions/elections.ts', fn: 'retractNomination',
    attacker: 'alphaAdmin',
    args: fx => [fx.alpha.retractOutsider.nomination.id, fx.alpha.nominationElection.id],
    probe: probeSupporters(fx => [fx.alpha.retractOutsider.nomination.id]),
    // AND THEY MUST BE TOLD. A DELETE that matches zero rows is `{ error: null }`, so without
    // `confirmWrite` this action would report success over a nomination that still carries
    // the caller's name — and on this control that is the worst version of the §8b lie: the
    // ballot goes to a vote saying they asked for this candidate. The probe cannot see it.
    expectRefusal: v => v?.success === false
      ? { ok: true, detail: 'reported the refusal' }
      : { ok: false, detail: `expected a refusal, got ${JSON.stringify(v)}` },
  },
  // ── AN ACCEPTED NOMINATION IS NOT THE NOMINATOR'S TO WITHDRAW ──────────
  // The attacker is the person who MADE this nomination — `alphaMember`, the fixture's
  // nominator — so this is not an isolation case at all. It is the acceptance conjunct, and
  // the pair is chosen so the two halves differ in exactly one thing: whether the caller is
  // the nominee.
  //
  //   attack   alphaMember retracts their nomination of `other`, which `other` ACCEPTED
  //   control  alphaMember withdraws their own accepted SELF-nomination, same office
  //
  // The control is the carve-out, and it is what "withdraw my own nomination" means: a
  // self-nomination is auto-accepted by `submitNomination`, so without it the one person
  // guaranteed to be able to stand could never stand down. Both candidacies are on the same
  // position, so the probe covers both and neither half can pass by touching the other's row.
  {
    kind: 'write',
    id: 'elections.retractNomination (one the nominee has accepted)',
    mod: 'app/actions/elections.ts', fn: 'retractNomination',
    attacker: 'alphaMember',
    args: fx => [fx.alpha.retractAccepted.nomination.id, fx.alpha.nominationElection.id],
    probe: probeSupporters(fx => [
      fx.alpha.retractAccepted.nomination.id, fx.alpha.retractOwnSelf.id,
    ]),
    expectRefusal: v => v?.success === false
      ? { ok: true, detail: 'reported the refusal' }
      : { ok: false, detail: `expected a refusal, got ${JSON.stringify(v)}` },
    positiveArgs: fx => [fx.alpha.retractOwnSelf.id, fx.alpha.nominationElection.id],
  },
  // ── THE SECOND NOMINATOR, WHICH IS THE WHOLE REASON THE TABLE EXISTS ───
  // `submitNomination` against a candidacy that already exists used to answer "they have
  // already been nominated for that position" and stop. It turns the UNIQUE collision into a
  // supporter row now, so two members can want the same person in the same office and
  // neither one's retraction removes the other's.
  //
  // The probe is the SUPPORTER list rather than the nomination list, because the candidacy
  // row does not change at all in this path — a probe on `election_nominations` would report
  // "no-op — row untouched" for the control as well as the attack, and the case would pass
  // while proving nothing.
  //
  // The nominee is `owner`, so `alphaOther` can second it without being the nominee
  // themselves — which would be the self-expression branch and a different assertion.
  // ── ONCE NOMINATIONS CLOSE, NOBODY RETRACTS ANYTHING ───────────────────
  // FOUND BY A MUTATION, which is the only reason it is here. Removing
  // `election_window_open(election_id, 'nominations')` from the DELETE policy left the whole
  // suite green: every candidacy in the fixture is on `nominationElection`, whose window
  // contains today, so no case could tell the conjunct was gone. `f.retractClosed` is on
  // `f.election`, whose nominations closed ten days ago and whose poll is open now.
  //
  // IT IS ITS OWN ROW RATHER THAN `f.nomination`, and the first draft used that one and was
  // wrong: `f.nomination` is ACCEPTED, so the ACCEPTANCE conjunct refused this call and the
  // window was never consulted — the case passed under the very mutation it was written for.
  // A case has to be refused by ONE thing to be evidence about that thing.
  //
  // THE ATTACKER IS THE PERSON WHO MADE IT. `alphaMember` is the nominator the fixture
  // recorded, is approved, is under National, and holds the supporter row — so every other
  // conjunct in the policy is satisfied for them and the clock is the only thing refusing.
  // That is what makes this a test of the window rather than of anything else.
  //
  // WHY THE RULE. `election_votes.nominee_id` references `people`, not a nomination, so a
  // candidacy deleted mid-poll would leave votes cast for somebody no longer standing with
  // nothing in the schema to notice. The way off a ballot after nominations close is DECLINE,
  // which preserves the record of having been asked.
  {
    kind: 'write',
    id: 'elections.retractNomination (after nominations closed)',
    mod: 'app/actions/elections.ts', fn: 'retractNomination',
    attacker: 'alphaMember',
    args: fx => [fx.alpha.retractClosed.id, fx.alpha.election.id],
    probe: probeSupporters(fx => [fx.alpha.retractClosed.id]),
    expectRefusal: v => v?.success === false
      ? { ok: true, detail: 'reported the refusal' }
      : { ok: false, detail: `expected a refusal, got ${JSON.stringify(v)}` },
    positive: 'not-applicable',
    why: 'the window is the thing being asserted, so there is no caller for whom this call is '
      + 'legitimate today; that a retraction lands at all is the four cases above',
  },
  {
    kind: 'write',
    id: 'elections.submitNomination (seconding one somebody else made)',
    mod: 'app/actions/elections.ts', fn: 'submitNomination',
    args: fx => [
      fx.alpha.nominationElection.id, fx.alpha.retractSecond.position.id, fx.alpha.ownerPersonId,
    ],
    probe: probeSupporters(fx => [fx.alpha.retractSecond.nomination.id]),
    positiveActor: 'alphaOther',
  },
  // ── [crux] NOMINATING SOMEBODY OUTSIDE THE ELECTION AREA ───────────────────
  // The write half of the area rule, and the one that is NOT covered by the read cases: the
  // attacker here is in the family and in the chapter, so every family conjunct is satisfied
  // and the only thing refusing them is `election_area_includes_person(election_id,
  // nominee_id)` in the INSERT policy. They nominate the member who is in NO chapter — under
  // National — into the chapter's election.
  //
  // `alphaOther` is BOTH the attacker and, in the positive control, the legitimate nominee, so
  // the two halves differ in exactly one argument. That is what makes the case evidence: the
  // control lands a nomination through the same code path with the same caller.
  {
    kind: 'write',
    id: 'elections.submitNomination (somebody outside the chapter)',
    mod: 'app/actions/elections.ts', fn: 'submitNomination',
    attacker: 'alphaOther',
    // `sparePersonId`, not `ownerPersonId`: `alphaMember` is moved INTO `f.chapter` by
    // `personal-info.saveChapterAndPropagate`, which would make this attack legitimate.
    args: fx => [fx.alpha.chapterElection.id, fx.alpha.chapterPosition.id, fx.alpha.sparePersonId],
    probe: (db, fx) => snapshot('election_nominations', 'id, nominee_id',
      { election_id: fx.alpha.chapterElection.id })(db),
    positiveActor: 'alphaOther',
    positiveArgs: fx => [fx.alpha.chapterElection.id, fx.alpha.chapterPosition.id, fx.alpha.otherPersonId],
  },
  // ── VOTING IN A CHAPTER ELECTION YOU ARE NOT IN ───────────────────────────────
  // No positive control: the chapter election's voting window opens in fifteen days, so
  // nobody may vote in it today and there is no legitimate call to run. The refusal being
  // asserted is therefore the AREA one only where the phase check has not already refused —
  // which it has, for everybody. Said out loud rather than left looking like evidence it is
  // not, per AGENTS.md §7.
  {
    kind: 'write',
    id: 'elections.castVote (a chapter election they are not in)',
    mod: 'app/actions/elections.ts', fn: 'castVote',
    attacker: 'alphaSpare',
    args: fx => [fx.alpha.chapterElection.id, fx.alpha.chapterPosition.id, fx.alpha.otherPersonId],
    probe: (db, fx) => snapshot('election_votes', 'id, voter_id',
      { election_id: fx.alpha.chapterElection.id })(db),
    positive: 'not-applicable',
    why: 'the chapter election\'s voting window opens in 15 days, so no caller may vote in it today; the area refusal on a write is asserted by the submitNomination case above',
  },
  // ── THE LIFECYCLE, CROSS-FAMILY ──────────────────────────────────────────────
  // All three run on the SERVICE-ROLE client, so no policy is underneath them at all and the
  // `.eq('family_code', …)` in each action is the entire boundary — `deleteRegion`'s shape
  // (AGENTS.md §3) with three different verbs. `updateElectionStatus` was the only one of
  // these that existed before 2026-08-21 and it had no case; these are its successors.
  {
    kind: 'write',
    id: "elections.publishElection (another family's draft)",
    mod: 'app/actions/elections.ts', fn: 'publishElection',
    args: fx => [fx.alpha.draftElection.id],
    probe: (db, fx) => snapshot('elections', 'id, status',
      { id: fx.alpha.draftElection.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: "elections.updateElection (another family's draft)",
    mod: 'app/actions/elections.ts', fn: 'updateElection',
    // ITS OWN DRAFT, AND THAT IS NOT TIDINESS. `publishElection` runs before this case and its
    // positive control PUBLISHES `draftElection` — after which `updateElection` refuses it,
    // correctly, and this control fails with "owner's own write did nothing". That is exactly
    // the fixture failure mode AGENTS.md §7 names: a case whose positive control mutates a row
    // a later case depends on. Found by running it, not by reading it.
    //
    // The title is what the probe watches, so it is deliberately something no fixture could
    // produce — a probe that could not tell a successful attack from the seeded value would
    // assert nothing.
    args: fx => [fx.alpha.editableElection.id, {
      title: 'BRAVO WAS HERE', description: '', scope: 'national',
      region_id: null, chapter_id: null,
      nominations_open_on: '', nominations_close_on: '',
      voting_open_on: '', voting_close_on: '',
      positions: [],
    }],
    probe: (db, fx) => snapshot('elections', 'id, title, status',
      { id: fx.alpha.editableElection.id })(db),
    positiveActor: 'alphaAdmin',
    positiveArgs: fx => [fx.alpha.editableElection.id, {
      title: 'ALPHATEST renamed draft', description: '', scope: 'national',
      region_id: null, chapter_id: null,
      nominations_open_on: '', nominations_close_on: '',
      voting_open_on: '', voting_close_on: '',
      positions: [{ title: 'ALPHATEST President', max_winners: 1 }],
    }],
  },
  {
    kind: 'write',
    id: "elections.deleteElection (another family's election)",
    mod: 'app/actions/elections.ts', fn: 'deleteElection',
    // Its own row, not one another case depends on — the fixture's `draftElection` is read
    // back by the two cases above, and a delete that ran first would leave them asserting
    // against nothing. This one is the chapter election, whose readers are all reads.
    args: fx => [fx.alpha.chapterElection.id],
    probe: (db, fx) => snapshot('elections', 'id, title',
      { id: fx.alpha.chapterElection.id })(db),
    positive: 'not-applicable',
    why: 'deleting it would take the chapter\'s election out from under the four area cases above, which are the only assertions of the area rule in this suite',
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
  // ── A MEMBER WHO IS REFUSED MUST BE TOLD, NOT THANKED ─────────────────────
  //
  // The only case in this file whose subject is the RETURN VALUE rather than a boundary,
  // and the only one whose attacker is an ordinary approved member of the family the row
  // belongs to. Both are deliberate.
  //
  // ── THE PREMISE CHANGED ON 2026-08-20, AND THE CASE GOT SHARPER FOR IT ────
  // This was `(a member with no delete grant)` aimed at `alphaMember`, because the General
  // grid granted `review/photos` create and edit and NOT delete. `20260820000007` filled
  // that gap in — the template's own description says "manages only their own records", and
  // the missing row was an oversight rather than a policy — so `alphaMember` now holds
  // `delete` at scope `'own'` and can remove the photograph they uploaded.
  //
  // So the attacker moved to `alphaOther`: also on General, so also holding `delete` at
  // `'own'`, and NOT the uploader of `fx.alpha.photo` (the fixture's `owner` is
  // `alphaMember` — see seed.mjs). What refuses them is the OWN-EXPRESSION,
  // `uploader_id = auth_person_id()`, rather than the absence of a grant.
  //
  // **THAT MAKES THIS THE FIRST ASSERTION IN THIS FILE THAT AN `own_expr` NARROWS
  // ANYTHING.** TODO.md's entry about the fixture having no scope-'own' actor was written
  // when every read in the suite was satisfied by the `= 'any'` disjunct; it is one
  // resource narrower now, and the rest of that entry still stands.
  //
  // WHY IT COULD NOT BE SEEN BEFORE, which is the part worth carrying forward whatever the
  // premise: the probe assertion PASSES either way. A no-op leaves the row untouched, so
  // `photos.deletePhoto` below has always gone green on its attack half — perfectly
  // isolated, and perfectly silent about lying to the caller. `expectRefusal` (see runWrite
  // in run.mjs) is a second assertion on the same call for exactly that reason.
  //
  // ORDER MATTERS AND THIS MUST STAY IMMEDIATELY ABOVE `photos.deletePhoto`: that case's
  // positive control genuinely deletes ALPHA's photo. Run afterwards, this one would get
  // zero rows because the row was GONE rather than because the caller was refused, and it
  // would pass while proving nothing — the shape AGENTS.md §7 warns about twice.
  //
  // MUTATION-CHECKED 2026-08-20, which is what makes it evidence: reverting deletePhoto to
  // `const { error } = await …delete().eq('id', id)` turns this line red on its own, and
  // nothing else in the suite moves.
  {
    kind: 'write',
    id: 'photos.deletePhoto (a photo they did not upload)',
    mod: 'app/actions/photos.ts', fn: 'deletePhoto',
    attacker: 'alphaOther',
    args: fx => [fx.alpha.photo.id, fx.alpha.photo.file_path, fx.alpha.collection.id],
    probe: (db, fx) => snapshot('photos', 'id', { id: fx.alpha.photo.id })(db),
    expectRefusal: v => v?.success === false && v?.message === WRITE_NOT_SAVED
      ? { ok: true, detail: 'reported the refusal' }
      : { ok: false, detail: `expected the WRITE_NOT_SAVED refusal, got ${JSON.stringify(v)}` },
    positive: 'not-applicable',
    why: 'the entitled caller is the case below, whose control is now the uploader themselves',
  },
  // THE CONTROL IS THE UPLOADER, AND THAT IS WHAT 20260820000007 MADE MEANINGFUL. It was
  // `alphaAdmin` — scope 'any' on everything — so it asserted only that SOMEBODY could
  // delete a photograph. `alphaMember` (the default) uploaded this one and holds `delete` at
  // `'own'`, so the pair now reads: the uploader may, another General member may not.
  {
    kind: 'write',
    id: 'photos.deletePhoto',
    mod: 'app/actions/photos.ts', fn: 'deletePhoto',
    args: fx => [fx.alpha.photo.id, fx.alpha.photo.file_path, fx.alpha.collection.id],
    probe: (db, fx) => snapshot('photos', 'id', { id: fx.alpha.photo.id })(db),
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
  // client, deliberately, so nothing but `requireRead('community/family-tree')` stands between an
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
  // `auth_permission('reporting/transactions/fund-transfers','view') = 'any'`, auth_permission()
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
  read('elections.getElectionsForMember (pending member)', 'app/actions/elections.ts', 'getElectionsForMember', {
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
  // AND RETRACTION, which is a DIFFERENT gate from the one above and worth its own line.
  // `castVote` is refused by `requireMember()`; so is this — but the row underneath it would
  // be refused a second time anyway, because `perm:family can retract a nomination` carries
  // `auth_membership_approved()` as a conjunct of its own. Two layers, and the case asserts
  // the caller is told rather than watching a policy match nothing (AGENTS.md §2).
  //
  // The applicant has a `people` row in ALPHA and `auth_family_code()` resolves ALPHATEST for
  // them permanently and deliberately, so every family conjunct in that policy is satisfied
  // for them. What is not satisfied is that they have joined.
  {
    kind: 'write',
    id: 'elections.retractNomination (pending member)',
    mod: 'app/actions/elections.ts', fn: 'retractNomination',
    attacker: 'alphaPending',
    args: fx => [fx.alpha.retractPending.nomination.id, fx.alpha.nominationElection.id],
    probe: probeSupporters(fx => [fx.alpha.retractPending.nomination.id]),
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
    args: fx => [fx.alpha.generalTemplateId, 'admin/accounting/bank', 'view', 'any'],
    probe: templateGrantProbe('admin/accounting/bank', 'view'),
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
  // TWO RAW READS WERE DELETED HERE ON 2026-08-19 — `event_rsvp` and `event_assignments` as
  // an applicant. They were evidence for `auth_person_id()` gating on membership rather than
  // for §6, and both tables lost every policy with the Events product (20260819000006), so
  // what they would test now is a table with RLS on and nothing to match: refused for
  // everybody, which proves nothing about who the caller is.
  //
  // WHAT THEY WERE EVIDENCE FOR, kept because the property is still true of every other table
  // here: `events` was not an admin key, so General granted view 'any' on it and the
  // permission disjunct WOULD have admitted a pending applicant. What stopped it is that
  // `auth_person_id()` is NULL for them, which makes `auth_permission()` return 'none' before
  // the grant is ever consulted. Two gates, and those tables were held by the other one.
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
    args: fx => [fx.alpha.generalTemplateId, 'admin/accounting/bank', 'edit', 'any'],
    // template_permissions has a composite primary key and no `id`, so snapshot()'s
    // .order('id') cannot be used here.
    probe: templateGrantProbe('admin/accounting/bank', 'edit'),
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

// ── THE MONEY-DELETION GUARD ────────────────────────────────────────────────────────
//
// `lib/money-attached.ts` refuses to delete a record money points at. Five actions consult
// it, and NOTHING ANYWHERE PROVED ANY OF THEM DID until this block: the module's two pure
// halves are covered by `lib/money-attached.test.ts`, and that file's header records the
// mutation that survived it — deleting the `isUuid(id)` call changes nothing under vitest,
// because `moneyAttachedTo` needs a database. Wiring is what this block asserts.
//
// THESE ARE NOT, MOSTLY, CROSS-FAMILY CASES, and the shape is inverted from the rest of the
// file in a way worth reading before adding another. The usual write case is "BRAVO must
// change nothing / ALPHA must change something". Here the interesting claim is that ALPHA's
// OWN ADMINISTRATOR — every grant the family can confer, scope 'any' on everything — must
// change nothing either, because the record is funded. So `attacker: 'alphaAdmin'`.
//
// AND THE CONTROL IS A DIFFERENT ROW RATHER THAN `positive: 'not-applicable'`. The runner
// requires the control half to CHANGE something and reports "owner's own write did nothing"
// as a failure, so the obvious reading of this shape is a skipped control. That was rejected:
// a genuine control exists here, which is the same administrator deleting the MONEY-FREE
// twin of the same kind of record, and it is the half that stops the attack assertion being
// vacuous — an action that refuses every delete for every caller (a renamed grant, a typo in
// the resource key, a guard that returns early) satisfies "the row is still there" perfectly.
// So each case carries `positiveArgs` pointing at a spare row, and ONE probe watching BOTH:
//
//   attack   alphaAdmin deletes the FUNDED row      → both rows still present
//   control  alphaAdmin deletes the MONEY-FREE row  → the spare is gone
//
// That is the `bothSpareChapters` pattern (see the note on it above) applied to a pair of
// rows in one family rather than one row in each of two, and for the same reason: the runner
// calls one probe for both halves, so a probe watching either row alone would report the
// other half as a no-op.
//
// THE SPARES ARE SEEDED, NOT CREATED HERE, and `resetMoneyFreeRecords` puts each one back by
// id before both halves of every case — `deletableChild`'s rule, and AGENTS.md §7's first
// fixture failure mode. Every control below deletes its spare, so without the reset the case
// after it would probe a row that had gone and read "unchanged" twice.
//
// ── CHECKED BY MUTATION, 2026-08-18 ─────────────────────────────────────────────────
// Commands and observed results are recorded per case. The one general note: mutating the
// guard makes an ATTACK half delete a fixture row that the rest of the fixture hangs off —
// `f.fund` cascades its contribution, disbursement, transfer and milestones — which is why
// this block is pushed LAST. Restore the guard and re-run the whole suite before trusting
// anything else in the file. (`f.event` used to be the worse of the two, cascading a photo,
// an RSVP, an assignment, two budget lines and an expense; that whole fixture is gone with
// the tables.)

/**
 * Put every money-free spare row back: existing, and exactly as the fixture seeded it.
 *
 * RE-INSERTS BY ID, because every positive control in this block DELETES one of these. The
 * columns are the ones the fixture states explicitly — a probe compares what it projects, so
 * a restore that changed a value would make the next half's "before" differ from the last
 * half's "after" and report a finding that was the setup's doing.
 *
 * Both families, though only ALPHA's rows are ever the subject: the attack half of the
 * cross-family cases passes ALPHA's id, so BRAVO's spares are never touched. Resetting both
 * costs one round trip and means a future case can attack in either direction without
 * discovering that half the fixture is not restored.
 */
const resetMoneyFreeRecords = async (db, fx) => {
  for (const side of ['alpha', 'bravo']) {
    const f = fx[side]
    const rows = [
      ['dues_schedules', {
        id: f.deletableSchedule.id, family_code: f.familyCode,
        label: f.deletableSchedule.label, amount_cents: f.deletableSchedule.amount_cents,
        active: false,
      }],
      ['funds', {
        id: f.deletableFund.id, family_code: f.familyCode, name: f.deletableFund.name,
        created_by: f.deletableFund.created_by, active: true,
      }],
      // AFTER `funds`, and it has to be: fund_milestones.fund_id REFERENCES funds(id), and
      // this milestone hangs off `f.fund` rather than off the spare — but a restore that ran
      // before its parent existed would fail on the foreign key for a case that had deleted
      // one. Ordering the list is cheaper than reasoning about which case ran last.
      ['fund_milestones', {
        id: f.deletableMilestone.id, fund_id: f.fund.id, family_code: f.familyCode,
        name: f.deletableMilestone.name, amount_cents: f.deletableMilestone.amount_cents,
        sort_order: f.deletableMilestone.sort_order,
      }],
      // TWO MORE ROWS WERE HERE — `events` and `event_budget_items`, both dropped
      // (20260819000006). What they demonstrated is the reason this list is ORDERED at all
      // and applies to whatever is added next: a restore that ran before its own parent
      // existed would fail on a foreign key, for a case that had deleted that parent. It is
      // cheaper to order the list than to reason about which case ran last.
    ]
    for (const [table, row] of rows) {
      const { error } = await db.from(table).upsert(row)
      if (error) throw new Error(`setup ${table}: ${error.message}`)
    }
  }
}

/**
 * The funded row and its money-free twin, in one string.
 *
 * The reason is `bothSpareChapters`': one probe serves both halves of a case, and here the
 * halves aim at different rows on purpose. `.in()` rather than two queries so a row that has
 * gone simply drops out of the array, which is the change the runner is looking for.
 */
const moneyPairProbe = (table, cols, ids) => async (db, fx) => {
  const { data, error } = await db.from(table).select(cols).in('id', ids(fx)).order('id')
  if (error) throw new Error(`probe ${table}: ${error.message}`)
  return JSON.stringify(data)
}

export const MONEY_CASES = [
  // ── 1. THE REFUSAL, ONE CASE PER ACTION ───────────────────────────────────────────
  //
  // TO SEE EACH OF THESE FAIL — required before treating any of them as evidence. Delete the
  // `moneyAttachedTo`/`attached.any` block from the action named in the case and re-run it:
  //
  //   node --import ./tests/rls/register.mjs ./tests/rls/run.mjs deleteDuesSchedule
  //
  // The ATTACK half goes red with ROW MUTATED and the funded row missing from the probe. The
  // control half stays green, which is the point of having it: exactly one assertion moves.
  {
    kind: 'write',
    id: 'dues.deleteDuesSchedule (a due with payments against it)',
    mod: 'app/actions/dues.ts', fn: 'deleteDuesSchedule',
    // THE REPORTED BUG, at its original size: a due with $50.00 collected against it, and
    // `dues_payments.schedule_id` is ON DELETE SET NULL — so before 2026-08-17 the delete
    // succeeded and the payment survived attributed to nothing, irreversibly, because that
    // table is append-only and permits no update.
    attacker: 'alphaAdmin',
    args: fx => [fx.alpha.schedule.id],
    setup: resetMoneyFreeRecords,
    probe: moneyPairProbe('dues_schedules', 'id, label',
      fx => [fx.alpha.schedule.id, fx.alpha.deletableSchedule.id]),
    positiveActor: 'alphaAdmin',
    positiveArgs: fx => [fx.alpha.deletableSchedule.id],
  },
  {
    kind: 'write',
    id: 'funds.deleteFund (a fund with money in it)',
    mod: 'app/actions/funds.ts', fn: 'deleteFund',
    // THREE KINDS OF MONEY point at `f.fund` — a contribution, a disbursement and a transfer
    // — and all three CASCADE, so a successful delete does not orphan the ledger, it erases it
    // and the family's collected total drops. The old check looked at transfers alone, which is
    // why the probe is worth reading as a pair with the spare: a guard narrowed back to
    // transfers passes nothing here. (There was a fourth, `event_expenses`, deliberately NOT
    // pointed at this fund; that table is dropped.)
    attacker: 'alphaAdmin',
    args: fx => [fx.alpha.fund.id],
    setup: resetMoneyFreeRecords,
    probe: moneyPairProbe('funds', 'id, name',
      fx => [fx.alpha.fund.id, fx.alpha.deletableFund.id]),
    positiveActor: 'alphaAdmin',
    positiveArgs: fx => [fx.alpha.deletableFund.id],
  },
  {
    kind: 'write',
    id: 'funds.deleteMilestone (a milestone a disbursement is attributed to)',
    mod: 'app/actions/funds.ts', fn: 'deleteMilestone',
    // `fund_disbursements.milestone_id` is ON DELETE SET NULL: the payout stays in the ledger
    // and what it was FOR is gone. The fixture attributes its one disbursement to `f.milestone`
    // for exactly this case — see the note in seed.mjs on why the existing row was pointed at
    // it rather than a second one being seeded.
    attacker: 'alphaAdmin',
    args: fx => [fx.alpha.milestone.id],
    setup: resetMoneyFreeRecords,
    probe: moneyPairProbe('fund_milestones', 'id, name',
      fx => [fx.alpha.milestone.id, fx.alpha.deletableMilestone.id]),
    positiveActor: 'alphaAdmin',
    positiveArgs: fx => [fx.alpha.deletableMilestone.id],
  },

  // TWO CASES WERE DELETED FROM HERE ON 2026-08-19, with the Events product:
  // `admin/events.deleteEvent (an event with recorded spend)` and
  // `admin/events.deleteEventBudgetItem (a budget line with an expense against it)`. Both
  // actions are gone, and a case naming a module that does not exist fails to import rather
  // than reporting a gap. `event_expenses` is dropped too (20260819000006) along with its
  // term in `fund_balance_cents()`, so there is no such money and no action to aim at.

  // ── 2. THE GUARD DID NOT REPLACE THE PERMISSION MODEL ─────────────────────────────
  //
  // A refusal that applies to everybody is not a guard, it is an outage, and the five cases
  // above cannot tell the two apart on their own — their control proves the action deletes
  // for an administrator, and these prove it does NOT for the two callers who must never
  // reach it. All three subjects are the MONEY-FREE spare, so the money guard is out of the
  // result and what refuses is family scoping or the grant.
  {
    kind: 'write',
    id: "funds.deleteFund (another family's fund)",
    mod: 'app/actions/funds.ts', fn: 'deleteFund',
    // The default attacker. `deleteFund` runs on the service-role client, so `.eq('family_code',
    // familyCode)` on both the existence read and the DELETE is the whole of the defence —
    // there is no policy underneath. Same PAIR finding as `deleteChapter` above: either
    // conjunct alone is sufficient, so this is evidence for the pair and not for either.
    args: fx => [fx.alpha.deletableFund.id],
    setup: resetMoneyFreeRecords,
    probe: (db, fx) => snapshot('funds', 'id, name, family_code',
      { id: fx.alpha.deletableFund.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'funds.deleteFund (same family, member with no grant)',
    mod: 'app/actions/funds.ts', fn: 'deleteFund',
    // The half family scoping cannot catch. alphaMember is inside the boundary and approved,
    // holds ALPHA's General template, and the only thing that may refuse them is
    // `admin/account/funds:delete`. A guard bolted on above the grant check — or a grant check
    // moved below it — would show up here and nowhere else.
    attacker: 'alphaMember',
    args: fx => [fx.alpha.deletableFund.id],
    setup: resetMoneyFreeRecords,
    probe: (db, fx) => snapshot('funds', 'id, name, family_code',
      { id: fx.alpha.deletableFund.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: "dues.deleteDuesSchedule (another family's due)",
    mod: 'app/actions/dues.ts', fn: 'deleteDuesSchedule',
    args: fx => [fx.alpha.deletableSchedule.id],
    setup: resetMoneyFreeRecords,
    probe: (db, fx) => snapshot('dues_schedules', 'id, label, family_code',
      { id: fx.alpha.deletableSchedule.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: "funds.deleteMilestone (another family's milestone)",
    mod: 'app/actions/funds.ts', fn: 'deleteMilestone',
    args: fx => [fx.alpha.deletableMilestone.id],
    setup: resetMoneyFreeRecords,
    probe: (db, fx) => snapshot('fund_milestones', 'id, name, family_code',
      { id: fx.alpha.deletableMilestone.id })(db),
    positiveActor: 'alphaAdmin',
  },

  // SECTION 3 WAS THE TWO EVENT DELETES AND IS GONE, 2026-08-19. It proved that
  // `deleteEvent` and `deleteEventBudgetItem` had gained the `family_code` conjunct they ran
  // without until 2026-08-17 — a real finding, and one whose subject no longer exists. The
  // SHAPE it established is the thing worth keeping and it is used by a dozen cases above:
  // aim BRAVO's administrator at ALPHA's id, make the subject a row with no money on it so the
  // money guard cannot refuse first and take the credit, and keep the control on ALPHA's own
  // administrator rather than on BRAVO's own row (see the note in section 4 below about
  // `my-families.createFamily` moving bravoAdmin's active family out from under a symmetric
  // control).

  // ── 4. THE CRAFTED ID: THE CASE IS GONE AND THE FINDING IS NOT ───────────────────
  //
  // `moneyAttachedTo` builds a PostgREST `or` expression by INTERPOLATING the id it was handed,
  // which is a value that arrived in an HTTP request, and `isUuid(id)` is what makes that safe.
  // The case that asserted it aimed `admin/events.deleteEvent`, chosen because it was the one
  // action that reached the guard BEFORE reading the row by id — the other four answer "not
  // found" on a 22P02 first, so a crafted id never gets that far in them. That action is
  // deleted with the Events product, and the case went with it.
  //
  // WHAT THE MEASUREMENT ESTABLISHED, kept because it is what makes the guard's absence
  // noticeable if somebody removes it. Measured against the local stack, 2026-08-18:
  //
  //   .eq('id', '<uuid>,fund_id.eq.<uuid>')   → 22P02, data null. postgrest-js encodes an
  //                                             `eq` value and PostgREST reads the remainder
  //                                             as a literal, so a filter VALUE is not
  //                                             injectable — only `.or()`, whose whole
  //                                             decoded value is parsed as an expression, is.
  //   the DELETE with that same id            → 22P02, nothing deleted.
  //
  // So the row was never in danger and a probe could not tell a wired `isUuid` from an unwired
  // one; what differed was the SENTENCE the administrator got. `lib/money-attached.test.ts`
  // still covers the pure half, and its own header records the mutation that survives it.
  //
  // A REPLACEMENT IS OWED THE DAY ANOTHER ACTION CONSULTS THE GUARD BEFORE READING ITS ROW.
  // None does today — that is the property that made `deleteEvent` the only candidate — so
  // this is a gap that is stated rather than one that is hidden.

  // ── 5. THE FAMILY SCOPING THOSE TWO ACTIONS DID NOT HAVE ──────────────────────────
  //
  // The last two event cases stood here — `deleteEvent` and `deleteEventBudgetItem`, run as
  // BRAVO's administrator against ALPHA's money-free spares — and they are gone with the
  // actions. One thing they discovered is not about events at all and applies to any case
  // added at the END of this file, so it is kept:
  //
  // A CROSS-FAMILY CASE MUST NOT MAKE ITS CONTROL SYMMETRIC. The first version had BRAVO's
  // administrator deleting BRAVO's own spare as the control. It passed when the two cases were
  // run alone and FAILED in the full suite with "owner's own write did nothing" — because
  // `my-families.createFamily` runs bravoAdmin as its attacker, twice, and creating a family
  // MAKES IT THE CREATOR'S ACTIVE ONE. By the time these ran, bravoAdmin held three
  // memberships and `user_family_settings.active_family_code` pointed at one of the families
  // those cases had minted, so `getMyFamilyCode(bravoAdmin)` no longer answered BRAVOTEST.
  // Nothing was wrong with the action.
  //
  // The canonical shape every other case here uses is order-independent: BOTH halves pass
  // ALPHA's id and only the CALLER changes, so it asks nothing about which family the attacker
  // happens to be in — which is the right question anyway.
]

/* ═══════════════════════════════════════════════════════════════════════════════════════
 * GATHERINGS (20260819000000) — 32 actions across four modules.
 *
 * ── WHAT IS ACTUALLY BEING TESTED HERE, PER TABLE ──────────────────────────────────────
 * The six tables have ONE SELECT policy each and NO INSERT, UPDATE or DELETE policy at all
 * — the same shape `fund_transfers` and `fund_disbursements` keep. So the two halves of this
 * feature are protected by two completely different mechanisms, and the cases split the same
 * way:
 *
 *   READS   go through the user client, so the composed SELECT policy is what isolates
 *           them — except for five that deliberately do not, and those five are the sharpest
 *           cases in the block because NO POLICY IS UNDERNEATH THEM AT ALL:
 *           `getSchedulableTemplates`, `getAdminGatherings`, `getAdminGatheringDetail`,
 *           `getGatheringReviewQueue`, `getGatheringFundOptions`,
 *           `getGatheringAssignableMembers`, and the events half of `getCalendarMonth`.
 *           A hand-written `.eq('family_code', ...)` is their whole defence.
 *
 *   WRITES  have no policy underneath them by design. Every one runs on
 *           `createAdminClient()`, so the action's own `family_code` conjuncts and its
 *           `belongsToFamily` calls ARE the boundary, with the five `*_same_family` guard
 *           triggers behind them. Two cases (`setGatheringBudget (a fund from another
 *           family)` and `assignGatheringTask (a person from another family)`) are the §4
 *           shape at its sharpest: the row being written is genuinely the caller's own and
 *           every policy is satisfied, while an id it carries points into another family.
 *
 * ── WHY MOST CONTROLS ARE `alphaAdmin`, AND WHICH THREE ARE NOT ────────────────────────
 * AGENTS.md asks for the LEAST-entitled actor that can legitimately succeed, and for this
 * feature that answer is measured rather than assumed. The General template a plain member
 * is born on (seeded by the families trigger, per `seed_family_permission_templates()`)
 * holds exactly this, verified against the fixture database:
 *
 *     gatherings:view          any      <- so the member-facing READS run as alphaMember
 *     gatherings/my-tasks:view any
 *     calendar:view            any
 *     gatherings:create        none     <- so scheduleGathering CANNOT be a plain member
 *     gatherings/budget:view   none     <- 20260819000000 §6a restricts this key
 *     admin/gatherings:*       none
 *     admin/gathering-templates:* none
 *
 * The three that are NOT pinned to the administrator are the ones that matter most, for the
 * reason the dues comment above states: an admin-only control passes whether or not members
 * can do their own job.
 *
 *   getGatherings, getGatheringDetail, getPremierGathering, getMyGatheringTasks,
 *   getMyGatheringTaskCount, getCalendarMonth   run as `alphaMember`
 *   submitGatheringTask                          runs as `alphaMember`, and MUST — it is
 *                                                self-service, gated on `requireMember()`
 *                                                plus `assignee_id === personId`, so
 *                                                alphaAdmin is refused by the ownership test
 *                                                and could never be the control here.
 *
 * `scheduleGathering` is pinned to `alphaAdmin` and that pin is NOT a bug's shadow: the
 * shipped default really is that an ordinary member may not schedule, and an administrator
 * grants `gatherings:create` on Members & Access to change it. If that default ever moves,
 * this pin is the line to reconsider — not the fixture.
 *
 * ── THE PENDING HALF IS DERIVED, NOT TYPED TWICE ───────────────────────────────────────
 * `GATHERING_PENDING_CASES` below is `GATHERING_CASES.map(...)` with the attacker swapped to
 * `alphaPending`, and that is deliberate. Every one of these 32 actions reads or writes
 * family data, so every one owes a pending case; writing them out by hand would be ~20
 * write cases restated with one field different, and the failure mode of a restatement is
 * that the two copies drift — a `setup` fixed in one and not the other turns the pending
 * half into a vacuous pass, silently. Deriving them makes that impossible.
 *
 * WHICH OF THEM ARE EVIDENCE, labelled here rather than left to look uniform:
 *
 *   [crux] the member-facing reads and `submitGatheringTask`. An applicant is INSIDE
 *          ALPHA's boundary by every test the cross-family cases apply — `auth_family_code()`
 *          resolves ALPHATEST for them deliberately — so these are where the membership gate
 *          is actually asserted. `requireMember()` refuses them by name; `requireRead` and
 *          `requireScope` refuse them because `resolveScope()` denies a non-approved caller
 *          outright, mirroring `auth_person_id()`'s own conjunct.
 *
 *   [not evidence for the family conjunct] every case whose main half is already refused by
 *          a GRANT. A pending caller holds no template grant at all, so the two admin keys
 *          and `gatherings/budget` refuse them before any query runs — the same labelling
 *          `dues.getFamilyDuesCollected (pending member)` carries above. They are kept
 *          because they are the regression guard on the pair holding together: a later
 *          migration that loosens one has the other still standing, and the case that
 *          notices is the one that runs the whole path.
 *
 * `noPending: true` on a case opts it out, and exactly three use it — the two §4 cases whose
 * attacker is already `alphaAdmin` (swapping THAT attacker for an applicant would test the
 * membership gate a third time and say nothing about the reference check the case exists for),
 * and `submitGatheringTask (an applicant holding the task)`, which IS the pending case.
 *
 * ── CHECKED BY MUTATION, 2026-08-19. OBSERVED, NOT EXPECTED ────────────────────────────
 * A green suite is not evidence until it has been seen to fail (AGENTS.md §7). Every result
 * below was run against the local stack; the commands are given so the next person can repeat
 * them, and three of them are recorded BECAUSE THEY DID NOT TRIP — a mutation that passes says
 * something about the case, and hiding it would leave the rest looking stronger than it is.
 *
 * The database mutations were made with `docker exec -i supabase_db_GENORRA psql -U postgres
 * -d postgres`; the file mutations by hand, restored from a copy, and the whole set finished
 * with `npx supabase db reset`. `npm run test:rls "<substring>"` runs one case at a time.
 *
 *   g1  ALTER POLICY "perm:gatherings:select" ON public.gatherings USING (...) with
 *       `family_code = public.auth_family_code() AND` deleted
 *         FAIL  gatherings.getGatherings          LEAKED 5
 *         FAIL  gatherings.getGatheringDetail     LEAKED 3
 *         FAIL  gatherings.getPremierGathering    LEAKED 3
 *         FAIL  calendar.getCalendarMonth         LEAKED 4
 *         pass  gatherings.getMyGatheringTasks    — and this is the one to read. That action
 *               filters `.eq('assignee_id', g.personId)` on a person id resolved from the
 *               CALLER's active family, so a BRAVO caller can never match an ALPHA row
 *               whatever the policy says. Its cross-family half is structurally vacuous and
 *               is labelled so on the case; `submitGatheringTask (an applicant holding the
 *               task)` is where that action's gate is actually observed.
 *
 *   g2  app/actions/gatherings.ts, `getSchedulableTemplates`: drop
 *       `.eq('family_code', g.familyCode)` from the admin-client read
 *         FAIL  gatherings.getSchedulableTemplates   LEAKED 6 (both template ids, both names)
 *       There is no policy under this read — `gathering_templates` keys on
 *       `admin/gathering-templates:view`, which the member this action exists for does not
 *       hold, which is why it is on the service role at all. One line is the whole defence.
 *
 *   g3  app/actions/admin/gatherings.ts, `updateGathering`: drop BOTH
 *       `.eq('family_code', g.familyCode)` conjuncts (the existence read and the UPDATE)
 *         FAIL  admin/gatherings.updateGathering (cross-family)   ROW MUTATED,
 *               `"status":"planning"` -> `"status":"scheduled"` on ALPHA's gathering
 *   g3b drop ONLY the one on the existence read      pass
 *   g3c drop ONLY the one on the UPDATE              pass
 *       Either conjunct alone is sufficient, so this case is evidence for the PAIR and not
 *       for either line. Exactly the result `admin/chapters.deleteChapter` records above, and
 *       the reason to record it is that a reviewer deleting one of the two would see green.
 *
 *   g4a app/actions/admin/gatherings.ts, `setGatheringBudget`: delete the
 *       `belongsToFamily('funds', ...)` call
 *         pass  setGatheringBudget (a fund from another family)
 *               — `tg_gathering_same_family()` refuses the row: the trigger exists precisely
 *                 because every write in this feature runs on the service role.
 *   g4b g4a AND `CREATE OR REPLACE FUNCTION public.tg_gathering_same_family()` with the
 *       `NEW.fund_id` branch deleted
 *         FAIL  ROW MUTATED — ALPHA's gathering repointed at BRAVO's fund,
 *               `fund_id` de4eaee7... -> 209a8b7d..., `budget_cents` 50000 -> 1234
 *   g4c the trigger neutered, `belongsToFamily` left in place
 *         pass  — the action refuses it.
 *       So §4 here is a PAIR and either half is sufficient. That is the intended design, and
 *       it means g4a on its own proves nothing: anyone re-running this needs g4b to see red.
 *
 *   g7  app/actions/admin/gatherings.ts, `assignGatheringTask`: delete the
 *       `belongsToFamily('people', ...)` call AND the family conjunct on the membership read
 *         pass  assignGatheringTask (a person from another family)
 *   g7b g7 AND `tg_gathering_task_same_family()` with the `NEW.assignee_id` branch deleted
 *         FAIL  ROW MUTATED — ALPHA's task assigned to BRAVO's member
 *       The same pair, on the other §4 id.
 *
 *   g5a lib/auth/permissions.ts: `const approved = true` in `getMyPermissionSet`
 *         pass  every `(pending member)` read — `auth_membership_approved()` in the policy
 *               refuses them, and `auth_permission()` resolves 'none' through
 *               `auth_person_id()`, so the applicant is refused twice more in SQL.
 *   g5c g5a AND `auth_person_id()` with `AND p.membership_status = 'approved'` deleted
 *         FAIL  gatherings.getGatherings (pending member)        LEAKED 5
 *         FAIL  gatherings.getGatheringDetail (pending member)   LEAKED 20
 *         FAIL  gatherings.getPremierGathering (pending member)  LEAKED 3
 *       Twenty markers on the detail: the gathering, its summary, its template, every task
 *       label and the submission note. That is what an unadmitted applicant would read.
 *
 *   g5d lib/auth/family.ts: `isApprovedMember()` returns true
 *         FAIL  submitGatheringTask (an applicant holding the task)   ROW MUTATED,
 *               `"status":"open"` -> `"submitted"` with the applicant's answer on the row
 *         pass  getMyGatheringTasks / getMyGatheringTaskCount (pending member) — those read
 *               on the USER client, so the policy is still underneath them.
 *   g5b g5d AND `auth_membership_approved()` returns true AND g5c
 *         FAIL  getMyGatheringTasks (pending member)       LEAKED 5
 *         FAIL  getMyGatheringTaskCount (pending member)   unexpected: 1
 *       THREE GATES DEEP, which is worth knowing before anyone "simplifies" one of them:
 *       `requireMember()` in TypeScript, `auth_membership_approved()` in the policy, and
 *       `auth_person_id()`'s own conjunct inside `self_expr`. All three have to go before an
 *       applicant reads the task they are holding.
 *
 *   g8  app/actions/admin/gatherings.ts, `reopenGatheringTask`: delete the
 *       `.eq('family_code', g.familyCode)` conjunct from BOTH the read and the UPDATE
 *         FAIL  reopenGatheringTask (another family's approved task)   ROW MUTATED
 *               `"status":"approved"` -> `"open"`, `decided_at` and `decided_by` nulled, and
 *               ALPHA's assignee told about it in ALPHA's notifications with BRAVO's reason in
 *               the body. `.eq('id', ...)` alone is the whole predicate then, on the admin
 *               client, so nothing else is underneath it at all.
 *   g8b `reopenGatheringTask` with the `task.status !== 'approved'` refusal deleted
 *         pass  BOTH halves — and that is the point of it being recorded here rather than
 *               omitted. This case cannot see that refusal, because `resetApprovedTasks` puts
 *               the row back to 'approved' before each half, so both halves address a row the
 *               guard would admit either way. The refusal is a product rule, not an isolation
 *               boundary, and nothing in this suite asserts it. Stated so a green run is not
 *               read as evidence for it.
 *
 *   g9  the DATABASE, not a file: drop the `family_code = public.auth_family_code()` conjunct
 *       from `perm:gatherings:select` (DROP + CREATE with `(false)` in the self branch and the
 *       rest verbatim)
 *         FAIL  getUpcomingGatheringCount                  unexpected: 4
 *         FAIL  getUpcomingGatheringCount (control)         2 expected, 4 seen
 *         pass  getUpcomingGatheringCount (pending member)
 *       Measured with `npm run test:rls "getUpcomingGatheringCount"`, which reseeds and runs only
 *       these two — so `bravoAdmin` is in BRAVOTEST alone there and counts their own 2 before the
 *       mutation. In the FULL suite they are in three families and count 0 unmutated; 4 is over
 *       the ceiling either way, which is why the attack half asserts one.
 *       A DOUBLING, exactly as `FAMILY_UPCOMING_GATHERINGS` predicts, because both families hold
 *       the same two rows. This is the mutation that makes the count case evidence, and it has to
 *       be run against the database because that policy is what does the scoping — the action has
 *       no `.eq('family_code', ...)` of its own, deliberately, so there is nothing in a file to
 *       delete. `npx supabase db reset` afterwards.
 *   g9b g9 AND `auth_membership_approved()` returning true AND `isApprovedMember()` returning
 *       true (g5d)
 *         pass  getUpcomingGatheringCount (pending member)  — STILL. Recorded because it is the
 *               honest reading of what that half proves on its own, which is less than it looks:
 *               three gates deep and an applicant still counts 0.
 *   g9c g9b AND `getMyPermissionSet`'s `const approved = true` (g5a) AND `auth_person_id()`
 *       without its `membership_status = 'approved'` conjunct (g5c)
 *         FAIL  getUpcomingGatheringCount (pending member)  unexpected: 4
 *       FOUR GATES, and this is where the pending half finally bites: `requireRead('gatherings/calendar')`
 *       resolving through `getMyPermissionSet`, `auth_membership_approved()` in the policy, and
 *       `auth_permission()` collapsing to 'none' because `auth_person_id()` is NULL for an
 *       applicant. Any one of them left standing answers 0.
 *
 *   g6  tests/rls/seed.mjs: move the six gathering tables in `scoped` from before `funds` to
 *       after it
 *         DIED IN TEARDOWN, before a single case executed:
 *           Error: teardown funds: new row for relation "gatherings" violates check
 *           constraint "gatherings_budget_needs_fund"
 *       The ordering note in seed.mjs is measured, not reasoned: `gatherings.fund_id` is ON
 *       DELETE SET NULL, Postgres carries that out as an UPDATE on the referencing row, and
 *       every CHECK on that row is enforced against it.
 *
 * ── SEGMENTS: `setGatheringSegment` (20260819000001), MEASURED 2026-08-19 ───────────────
 * Run with `npm run test:rls "setGatheringSegment"`, restored from byte copies checked with
 * `md5sum -c`. Two of the four are recorded because they did NOT trip.
 *
 *   g10 app/actions/admin/gatherings.ts, `setGatheringSegment`: ALL THREE of
 *       `belongsToFamily('gatherings', …)`, the `resolveTemplates(…)` refusal, and
 *       `.eq('family_code', g.familyCode)` on the UPDATE, deleted together
 *         FAIL  setGatheringSegment (cross-family)   ROW MUTATED — BRAVO's administrator moved
 *               ALPHA's segment: `occurs_on` 2026-09-18 -> 2026-09-20 and `location`
 *               'ALPHATEST assembly pavilion' -> 'scope-case assembly marquee'. BRAVO's own
 *               segment, which the probe also carries, was untouched — so the probe is watching
 *               the right two rows.
 *         pass  setGatheringSegment (a template from another family) — see g11.
 *   g11 g10 with ONLY `.eq('family_code', g.familyCode)` restored
 *         pass  BOTH halves. So this case is evidence for a SET and not for any one line: the
 *               conjunct alone is sufficient, and by symmetry with `updateGathering`'s g3b/g3c
 *               above so is the `belongsToFamily` alone. A reviewer deleting one of the three
 *               would see green, which is the reason to write this down rather than to imply
 *               each line is separately load-bearing.
 *
 *       AND THE §4 CASE DID NOT TRIP UNDER EITHER, which is the more interesting result and is
 *       a FOURTH layer nobody wrote on purpose: with all three checks gone, ALPHA's
 *       administrator naming BRAVO's template still changes nothing, because the pair
 *       `(ALPHA's gathering, BRAVO's template)` HAS NO ROW — the action UPDATEs and deliberately
 *       does not upsert (its header: "an upsert here would create a segment with a day, a place
 *       and NONE OF ITS TASKS"). Seeing that case fail therefore needs the update turned into an
 *       upsert as well, and then `gathering_template_uses_same_family` refuses the insert with a
 *       23514 — so it is a triple in the g4a/g4b/g4c mould. Not run to the end; the three layers
 *       are named here so the next person starts from the right place.
 *   g12 tests/rls/cases.mjs, `mainSegmentsProbe`: narrow the select to
 *       `gathering_id, template_id`
 *         FAIL  all three controls — "owner's own write did nothing — the attack assertion
 *               above is vacuous"
 *       THE ONE PROBE-PROJECTION MUTATION IN THIS FILE THAT TRIPS, and it is worth knowing which
 *       ones do not. `setGatheringSegment` writes ONLY `occurs_on` and `location` on a row that
 *       exists before and after, so the projection is the whole of what makes the write visible.
 *       By contrast `addGatheringTemplate` CREATES its row, `createGatheringTemplate` creates
 *       one, and `updateGatheringTemplate` moves `description` in the same call — so for those
 *       three the widened projections added on 2026-08-19 are future-proofing rather than a live
 *       tripwire, and saying so is the honest version of "the probe projects the new column".
 * ═══════════════════════════════════════════════════════════════════════════════════════ */

/** A gathering created by a case, so a probe can find it without knowing whose family it landed in. */
const SCHEDULE_CASE_TITLE = 'scope-case scheduled assembly'
const CREATE_CASE_TITLE = 'scope-case organized assembly'
const TEMPLATE_CASE_NAME = 'scope-case assembly plan'
/**
 * The **Usual location** `createGatheringTemplate`'s case writes (20260819000001 §8).
 *
 * `scope-case` like every other value a case creates, so a stray row is identifiable as this
 * suite's litter, and — like all of them — deliberately NOT on the marker list: a string a case
 * writes is not a fact about ALPHA that a leak could expose.
 */
const STEP_CASE_LABEL = 'scope-case assembly step'
/** Far enough out that it cannot fall inside the month `getCalendarMonth`'s case asks for. */
const CREATE_CASE_DATE = '2027-06-01'

/**
 * How many upcoming, uncancelled gatherings ONE family has at seed: `f.gathering` (+30 days) and
 * `f.deletableGathering` (+45 days), both 'planning'. The fixture loop seeds both families
 * identically, so this is ALPHA's figure and BRAVO's alike — MEASURED, not counted from the
 * source: `SELECT family_code, count(*) ... FROM gatherings GROUP BY 1` answers 2 for each.
 *
 * It is the CEILING `getUpcomingGatheringCount`'s attack half asserts and the EXACT figure its
 * control asserts, and the asymmetry is measured rather than cautious — see that case.
 *
 * The leak signature of a family conjunct going missing is a DOUBLING: 4, not 3, because the two
 * families hold the same rows. So `<=` on the attack side still catches it, and the control's
 * exact `=== 2` is what catches a query that answers 0 for everybody. A future fixture change
 * that adds an upcoming gathering fails the control loudly with the number printed, which is the
 * right way for a stale figure to break.
 */
const FAMILY_UPCOMING_GATHERINGS = 2

/**
 * ALPHA's and BRAVO's main gathering back to what the fixture seeded.
 *
 * FIVE COLUMNS, because three cases share this and each moves a different one:
 * `updateGathering` moves `status`, `setGatheringBudget` moves `fund_id` and `budget_cents`,
 * and `is_premier` is restored so `getPremierGathering` cannot be made to depend on the
 * order the write cases ran in. `location` is restored too even though no case moves it —
 * it is the one column on this row a future case is most likely to reach for.
 */
const resetGatherings = async (db, fx) => {
  for (const side of ['alpha', 'bravo']) {
    const f = fx[side]
    must(await db.from('gatherings').update({
      status: 'planning', is_premier: true,
      fund_id: f.fund.id, budget_cents: 50000,
      location: `${f.familyCode} assembly hall`,
    }).eq('id', f.gathering.id))
  }
}

/**
 * Both families' SPARE gatherings back: existing, unflagged, and with no money on them.
 *
 * RE-INSERTS BY ID rather than assuming the row is there, because `deleteGathering`'s control
 * removes it — and without this the cases after it would probe a row that is gone and read
 * "unchanged" for both halves, which is a green tick over an assertion about nothing.
 * `resetSpareChapters` above exists for exactly this reason and this is the same shape.
 */
const resetSpareGatherings = async (db, fx) => {
  for (const side of ['alpha', 'bravo']) {
    const f = fx[side]
    must(await db.from('gatherings').upsert({
      id: f.deletableGathering.id, family_code: f.familyCode,
      title: `${f.familyCode} spare assembly`,
      starts_on: f.deletableGathering.starts_on,
      status: 'planning', is_premier: false,
      // NULL on both, so `lib/money-attached.ts` counts nothing against a fund on account of
      // this row — `funds.deleteFund`'s control would otherwise start failing with a message
      // about a gathering, which reads as a bug in the money guard rather than a collision.
      fund_id: null, budget_cents: null,
      // NULL explicitly, although the column defaults to it: an upsert only updates the
      // columns it names, so a case that had set a photograph would leave one behind for
      // every case after it — and `setGatheringPhoto`'s own control asserts a null-to-set
      // transition, which a leftover would make vacuous.
      photo_path: null,
      created_by: f.ownerPersonId,
    }))
  }
}

/** Both families' spare TEMPLATES back, with their one step, since a control deletes one. */
const resetSpareTemplates = async (db, fx) => {
  for (const side of ['alpha', 'bravo']) {
    const f = fx[side]
    must(await db.from('gathering_templates').upsert({
      id: f.deletableTemplate.id, family_code: f.familyCode,
      name: `${f.familyCode} spare assembly plan`,
      created_by: f.ownerPersonId, who_may_schedule: 'admin', is_archived: false,
    }))
    must(await db.from('gathering_template_steps').upsert({
      id: f.deletableTemplateStep.id, family_code: f.familyCode,
      template_id: f.deletableTemplate.id, position: 0,
      label: `${f.familyCode} spare plan assembly step`, kind: 'text',
    }))
  }
}

/**
 * Both families' main template back — `updateGatheringTemplate` rewrites its description.
 *
 * EVERY COLUMN THE CONTROL CHANGES IS RESTORED, which is what this file's own §7 note is about:
 * each half of a write case re-runs `setup` and then probes, so a column the control changes has
 * to start each half from a KNOWN value. Left out, the second half would start from whatever the
 * first half wrote, and a write of the same value twice is indistinguishable from a write that
 * did nothing.
 *
 * `default_location` was on this list until 20260819000007 dropped the column.
 */
const resetTemplates = async (db, fx) => {
  for (const side of ['alpha', 'bravo']) {
    const f = fx[side]
    must(await db.from('gathering_templates').update({
      name: `${f.familyCode} assembly plan`,
      description: `${f.familyCode} assembly plan notes`,
      who_may_schedule: 'family', is_archived: false,
    }).eq('id', f.template.id))
  }
}

/**
 * The four steps of both families' main template, in the order and shape the fixture seeded.
 *
 * Shared by `updateTemplateStep` (which rewrites step 1's help text), `deleteTemplateStep`
 * (which removes the third) and `moveTemplateStep` (which swaps the first two). The positions
 * are restated rather than assumed because the swap is persistent: without this the move
 * case's second half would start from the order its first half left behind, and a swap back
 * is indistinguishable from a swap that did nothing.
 */
const resetTemplateSteps = async (db, fx) => {
  for (const side of ['alpha', 'bravo']) {
    const f = fx[side]
    must(await db.from('gathering_template_steps').update({
      position: 0, help_text: `${f.familyCode} assembly banner note`,
    }).eq('id', f.templateStep1.id))
    must(await db.from('gathering_template_steps').update({ position: 1 })
      .eq('id', f.templateStep2.id))
    // Position 2 is the `location` step (20260819000007), which no case moves or deletes and
    // which therefore needs no restoring. The spare sits after it.
    must(await db.from('gathering_template_steps').update({ position: 2 })
      .eq('id', f.templateStep3.id))
    must(await db.from('gathering_template_steps').upsert({
      id: f.deletableStep.id, family_code: f.familyCode, template_id: f.template.id,
      position: 3, label: `${f.familyCode} spare assembly step`, kind: 'long_text',
    }))
  }
}

/** The unassigned task back to nobody's, undated, with the template's suggested line on it. */
const resetUnassignedTasks = async (db, fx) => {
  for (const side of ['alpha', 'bravo']) {
    must(await db.from('gathering_tasks')
      .update({ assignee_id: null, due_on: null, budget_cents: 5000 })
      .eq('id', fx[side].unassignedTask.id))
  }
}

/**
 * The submittable task back to 'open' with no answer and no submissions behind it.
 *
 * THE SUBMISSIONS ARE DELETED, not merely ignored, because `submitGatheringTask` INSERTS one
 * every time it succeeds: left in place, the probe's submission list would grow on every half
 * of every run and the case would report a change for the attack half of the run after it.
 */
const resetSubmittableTasks = async (db, fx) => {
  for (const side of ['alpha', 'bravo']) {
    const f = fx[side]
    must(await db.from('gathering_task_submissions').delete().eq('task_id', f.submittableTask.id))
    must(await db.from('gathering_tasks')
      .update({ status: 'open', answer: null, decided_at: null, decided_by: null })
      .eq('id', f.submittableTask.id))
  }
}

/** The applicant-held task back to 'open' with no answer, and no submissions behind it. */
const resetPendingTasks = async (db, fx) => {
  for (const side of ['alpha', 'bravo']) {
    const f = fx[side]
    must(await db.from('gathering_task_submissions').delete().eq('task_id', f.pendingTask.id))
    must(await db.from('gathering_tasks')
      .update({ status: 'open', answer: null, assignee_id: f.pendingPersonId })
      .eq('id', f.pendingTask.id))
  }
}

/** The submitted task and its pending submission back to undecided, for `reviewGatheringTask`. */
const resetSubmittedTasks = async (db, fx) => {
  for (const side of ['alpha', 'bravo']) {
    const f = fx[side]
    must(await db.from('gathering_tasks')
      .update({ status: 'submitted', decided_at: null, decided_by: null })
      .eq('id', f.submittedTask.id))
    must(await db.from('gathering_task_submissions')
      .update({ decision: 'pending', review_notes: null, reviewed_by: null, reviewed_at: null })
      .eq('id', f.submission.id))
  }
}

/**
 * The approved task and its approved submission back to ruled-on, for `reopenGatheringTask`.
 *
 * `status = 'approved'` is the ONLY state that action accepts, so without this the control's
 * second run would be refused with "this task has not been approved" — a green attack half and a
 * red control half, for a reason with nothing to do with family isolation. `setup` runs once per
 * half, so it has to be idempotent, and an UPDATE to fixed values is.
 *
 * `decided_at` and `decided_by` are written back as well as the status, because they are what a
 * reopen CLEARS: restore only the status and the second run's probe would compare two rows that
 * were already null there, so a reopen that stopped clearing them would pass.
 *
 * The values come off the FIXTURE ROW rather than from a literal here or a clock read. `seed.mjs`
 * inserts these rows with `.select().single()`, so `f.approvedTask` already carries the exact
 * `decided_at` and `decided_by` the fixture chose — restoring from a second copy of them would be
 * two places to keep in step, and restoring from `new Date()` would make the probe's
 * before-and-after differ by the run's own duration on a column nothing under test wrote.
 *
 * The SUBMISSION is restored too although nothing under test writes it — that is the point. A
 * reopen must leave the audit trail exactly as it is, so the probe projects it, and a probe that
 * projects a column no setup pins would report the fixture's own drift as a mutation.
 */
const resetApprovedTasks = async (db, fx) => {
  for (const side of ['alpha', 'bravo']) {
    const f = fx[side]
    must(await db.from('gathering_tasks')
      .update({
        status: 'approved',
        decided_at: f.approvedTask.decided_at,
        decided_by: f.approvedTask.decided_by,
      })
      .eq('id', f.approvedTask.id))
    must(await db.from('gathering_task_submissions')
      .update({
        decision: 'approved',
        reviewed_by: f.approvedSubmission.reviewed_by,
        reviewed_at: f.approvedSubmission.reviewed_at,
        review_notes: null,
      })
      .eq('id', f.approvedSubmission.id))
  }
}

/**
 * ALPHA's approved task and the approved submission behind it.
 *
 * FIVE COLUMNS ACROSS TWO TABLES, and each is there for a different reason:
 *
 *  * `status`, `decided_at`, `decided_by` — the three a reopen writes. A probe naming only
 *    `status` would read a reopen that left an organizer named as having decided something they
 *    had taken back as a clean success.
 *  * `answer` on the task — the one a reopen must NOT write. Clearing it would hand the member a
 *    blank box and ask them to retype an answer they had already got right, and on a probe
 *    watching only the status columns that regression is invisible.
 *  * `decision` and `review_notes` on the submission — the audit trail, which a reopen must also
 *    leave alone. This is the half that cannot be seen from the task at all.
 */
const reopenedTaskProbe = async (db, fx) => {
  const [task, sub] = await Promise.all([
    db.from('gathering_tasks').select('status, answer, decided_at, decided_by')
      .eq('id', fx.alpha.approvedTask.id),
    db.from('gathering_task_submissions').select('decision, review_notes, reviewed_by')
      .eq('id', fx.alpha.approvedSubmission.id),
  ])
  if (task.error || sub.error) {
    throw new Error(`probe: ${task.error?.message ?? sub.error?.message}`)
  }
  return JSON.stringify([task.data, sub.data])
}

/** No link at all between a family's spare gathering and its spare template. */
const clearSpareLink = async (db, fx) => {
  await resetSpareGatherings(db, fx)
  await resetSpareTemplates(db, fx)
  for (const side of ['alpha', 'bravo']) {
    const f = fx[side]
    must(await db.from('gathering_tasks').delete()
      .eq('gathering_id', f.deletableGathering.id).eq('template_id', f.deletableTemplate.id))
    must(await db.from('gathering_template_uses').delete()
      .eq('gathering_id', f.deletableGathering.id).eq('template_id', f.deletableTemplate.id))
  }
}

/**
 * Both families' MAIN segment back to the day and the place the fixture seeded (20260819000001).
 *
 * The segment is `(f.gathering, f.template)` — the junction row `getGatheringDetail` groups the
 * task list by — and `setGatheringSegment`'s two cases both rewrite `occurs_on` and `location` on
 * it. BOTH halves of each case re-run this, so the control starts from the seeded values rather
 * than from whatever the attack half left: without it a second write of the same values would be
 * indistinguishable from a write that did nothing, which is the vacuous-probe failure AGENTS.md §7
 * warns about at the fixture level.
 *
 * BOTH FAMILIES, not just ALPHA, for the reason every reset in this block does both: the §4 case
 * hands ALPHA's administrator BRAVO's template, and a BRAVO segment left in a state the fixture
 * did not choose would make the next reading of that case's outcome guesswork.
 */
const resetSegments = async (db, fx) => {
  for (const side of ['alpha', 'bravo']) {
    const f = fx[side]
    must(await db.from('gathering_template_uses').update({
      occurs_on: f.gathering.starts_on,
      location: `${f.familyCode} assembly pavilion`,
    }).eq('gathering_id', f.gathering.id).eq('template_id', f.template.id))
  }
}

/**
 * BOTH FAMILIES' main segments — ALPHA's, and BRAVO's beside it. The name says `main` and not
 * `alpha` deliberately: a probe called `alphaSegmentProbe` that also reads BRAVO's row is a
 * small lie, and the second row is the whole reason this exists.
 *
 * TWO ROWS IN ONE PROBE, and the second is the load-bearing one. The §4 case's attacker is
 * ALPHA's OWN administrator naming BRAVO's template, so the mutation to catch is a write that
 * lands on BRAVO's segment — a probe watching ALPHA alone would report "row untouched" and pass
 * while another family's row had just been moved. That is the same reasoning
 * `personal-info.saveProfileSection`'s chapter case records: point the probe at the row the
 * attack could actually corrupt, which is not always the victim's.
 *
 * `occurs_on` and `location` are both projected because the action writes either or both.
 */
const mainSegmentsProbe = async (db, fx) => {
  const { data, error } = await db
    .from('gathering_template_uses')
    .select('gathering_id, template_id, occurs_on, location')
    .in('gathering_id', [fx.alpha.gathering.id, fx.bravo.gathering.id])
    .order('gathering_id')
  if (error) throw new Error(`probe gathering_template_uses: ${error.message}`)
  return JSON.stringify(data)
}

/**
 * A family's spare gathering linked to its MAIN template, with one task from it that is still
 * 'open' and unassigned — the only state `removeGatheringTemplate` will unlink.
 *
 * Delete-then-insert rather than an upsert, so no fixed uuid has to be threaded between this
 * and the probe: the pair (gathering_id, template_id) is the identity that matters and it is
 * what both statements filter on.
 */
const linkSpareGathering = async (db, fx) => {
  await resetSpareGatherings(db, fx)
  for (const side of ['alpha', 'bravo']) {
    const f = fx[side]
    must(await db.from('gathering_tasks').delete().eq('gathering_id', f.deletableGathering.id))
    must(await db.from('gathering_template_uses').delete()
      .eq('gathering_id', f.deletableGathering.id))
    must(await db.from('gathering_template_uses').insert({
      family_code: f.familyCode, gathering_id: f.deletableGathering.id,
      template_id: f.template.id, position: 0,
    }))
    must(await db.from('gathering_tasks').insert({
      family_code: f.familyCode, gathering_id: f.deletableGathering.id,
      template_id: f.template.id, label: `${f.familyCode} spare link assembly task`,
      kind: 'text', required: false, position: 0, status: 'open', assignee_id: null,
    }))
  }
}

/**
 * Everything hanging off ALPHA's spare gathering: which templates it is built from, and every
 * task those templates put there.
 *
 * BOTH HALVES IN ONE STRING, because `addGatheringTemplate` and `removeGatheringTemplate`
 * each move both — a probe watching only the junction table would report a template unlinked
 * while ten tasks it created stayed behind, which is the exact bug
 * `removeGatheringTemplate`'s refusal exists to prevent.
 *
 * `occurs_on` AND `location` ARE PROJECTED SINCE 20260819000001, and their absence would have
 * been the failure mode AGENTS.md §7 names last: `addGatheringTemplate` now takes a day and a
 * place, its case now passes one and lets the other fall back to the template's default, and a
 * probe listing only `(template_id, position)` would have read all of that as an ordinary link —
 * so a version of the action that dropped both columns on the floor would have passed. What the
 * probe watches has to be what the control writes.
 */
const spareGatheringLinks = async (db, fx) => {
  const [uses, tasks] = await Promise.all([
    db.from('gathering_template_uses').select('template_id, position, occurs_on, location')
      .eq('gathering_id', fx.alpha.deletableGathering.id).order('template_id'),
    db.from('gathering_tasks').select('label, template_id, status, assignee_id')
      .eq('gathering_id', fx.alpha.deletableGathering.id).order('label'),
  ])
  if (uses.error || tasks.error) {
    throw new Error(`probe: ${uses.error?.message ?? tasks.error?.message}`)
  }
  return JSON.stringify([uses.data, tasks.data])
}

/**
 * ALPHA's submittable task and every submission behind it.
 *
 * `status` AND `answer` are both projected, and the submissions beside them, because
 * `submitGatheringTask` writes all three: the audit row first, then the status and the
 * normalised answer on the task. A probe that watched only `status` would read a successful
 * write as a no-op the moment somebody re-ordered those two statements.
 */
const submittableTaskProbe = async (db, fx) => {
  const [task, subs] = await Promise.all([
    db.from('gathering_tasks').select('status, answer, decided_at')
      .eq('id', fx.alpha.submittableTask.id),
    db.from('gathering_task_submissions').select('decision, note, answer, submitted_by')
      .eq('task_id', fx.alpha.submittableTask.id).order('created_at'),
  ])
  if (task.error || subs.error) {
    throw new Error(`probe: ${task.error?.message ?? subs.error?.message}`)
  }
  return JSON.stringify([task.data, subs.data])
}

/**
 * ALPHA's submitted task and the submission `reviewGatheringTask` rules on.
 *
 * The decision lands in TWO places — `status`/`decided_by` on the task and
 * `decision`/`review_notes`/`reviewed_by` on the submission — and the submission half is the
 * only one that carries the notes a denial exists to deliver. Watching the task alone would
 * make a review that recorded no notes indistinguishable from one that did.
 */
const reviewedTaskProbe = async (db, fx) => {
  const [task, sub] = await Promise.all([
    db.from('gathering_tasks').select('status, decided_by')
      .eq('id', fx.alpha.submittedTask.id),
    db.from('gathering_task_submissions').select('decision, review_notes, reviewed_by')
      .eq('id', fx.alpha.submission.id),
  ])
  if (task.error || sub.error) {
    throw new Error(`probe: ${task.error?.message ?? sub.error?.message}`)
  }
  return JSON.stringify([task.data, sub.data])
}

/** Anything a create case left behind, in EITHER family — see each case on why both. */
const clearCaseGatherings = (title) => async (db) => {
  const { error } = await db.from('gatherings').delete().eq('title', title)
  if (error) throw new Error(`setup: ${error.message}`)
}

const clearCaseTemplates = async (db) => {
  const { error } = await db.from('gathering_templates').delete().eq('name', TEMPLATE_CASE_NAME)
  if (error) throw new Error(`setup: ${error.message}`)
}

const clearCaseSteps = async (db, fx) => {
  await resetSpareTemplates(db, fx)
  const { error } = await db.from('gathering_template_steps').delete().eq('label', STEP_CASE_LABEL)
  if (error) throw new Error(`setup: ${error.message}`)
}

export const GATHERING_CASES = [
  // ── member facing: app/actions/gatherings.ts ──────────────────────────────
  // The list and the detail read on the USER client, so the composed
  // `perm:gatherings:select` policy is what refuses BRAVO — `family_code =
  // auth_family_code() AND auth_membership_approved() AND gatherings:view`. No conjunct in
  // the action does it, which is the point: the code cannot come to disagree with the
  // database about who may see what.
  read('gatherings.getGatherings', 'app/actions/gatherings.ts', 'getGatherings'),
  read('gatherings.getGatheringDetail', 'app/actions/gatherings.ts', 'getGatheringDetail', {
    args: fx => [fx.alpha.gathering.id],
  }),
  // THE MOST IMPORTANT CONTROL IN THE BLOCK, and it is a plain member's. `gathering_tasks`
  // carries `self_expr = assignee_id = auth_person_id()` specifically so an assignee reads
  // their own task in a family that has restricted `gatherings:view` — this is the case that
  // fails if that expression is ever dropped.
  //
  // The cross-family half is honest rather than sharp, and is labelled so: the query is
  // `.eq('assignee_id', g.personId)` where `personId` is resolved from the CALLER's active
  // family, so bravoAdmin can never match an ALPHA row whatever the policy says. The pending
  // half is where this action's gate is actually asserted.
  read('gatherings.getMyGatheringTasks', 'app/actions/gatherings.ts', 'getMyGatheringTasks'),
  // A number, which the marker scan cannot judge, so both sides are asserted directly.
  // bravoAdmin holds no task in either family (the fixture assigns to `owner`, and on the
  // BRAVO side that is bravoMember), so 0 is their honest answer and anything above it means
  // the count reached across the boundary.
  read('gatherings.getMyGatheringTaskCount', 'app/actions/gatherings.ts', 'getMyGatheringTaskCount', {
    expectAttack: (r) => r === 0,
    // NOT PINNED TO AN EXACT FIGURE, and that is a decision rather than laziness. The badge
    // counts 'open' and 'denied' only, so the number depends on which write controls have
    // already run: this case appears twice (here and in the pending block) and between the two
    // `submitGatheringTask`'s control moves one task to 'submitted' while
    // `reviewGatheringTask`'s moves another to 'denied'. Both happen to leave the figure at 2,
    // which is exactly the kind of coincidence a later reordering would break — and it would
    // break it in a case that has nothing to say about arithmetic. What this case is for is
    // isolation: the attacker counts none of ALPHA's, the owner counts their own.
    // `lib/gatherings.test.ts` is where the status rule is asserted.
    expectPositive: (r) => r >= 1,
  }),
  read('gatherings.getPremierGathering', 'app/actions/gatherings.ts', 'getPremierGathering', {
    expectPositive: (r, fx) => r?.id === fx.alpha.gathering.id,
  }),
  // ── THE DASHBOARD TILE'S COUNT ────────────────────────────────────────────
  // A number, which the marker scan cannot judge, so both halves are asserted directly — the
  // same treatment as `getMyGatheringTaskCount` above and for the same reason.
  //
  // IT IS PLACED HERE, AMONG THE READS, DELIBERATELY. `deleteGathering`'s control removes
  // ALPHA's spare gathering and the two create cases add one to whichever family the actor is
  // in, so the control's exact figure is only stable before the write cases run. Moving this
  // below them would make the assertion depend on which of them had executed, in a case that has
  // nothing to say about any of it.
  //
  // THE ATTACK HALF IS A CEILING AND NOT AN EXACT FIGURE, and the reason is worth reading before
  // anybody tightens it back. It was `=== FAMILY_UPCOMING_GATHERINGS`, it passed on its own, and
  // it FAILED in the full suite with `unexpected: 0` — because by the time this runs `bravoAdmin`
  // is a member of THREE families, not one. Earlier blocks have them create and join families
  // (`createFamily`, `joinFamilyByCode`), `auth_family_code()` is an `ORDER BY … LIMIT 1` over
  // the caller's memberships with no `active_family_code` set for a seeded user, and one of those
  // new families is what it resolves — a family with no gatherings at all. Measured, not
  // reasoned: `SELECT p.family_code FROM people p JOIN auth.users u … WHERE u.email =
  // 'bravo.admin@rls.test'` answers BRAVOTEST and two generated codes after a full run.
  //
  // So the attacker's honest answer is anything from 0 to 2 depending on which family they land
  // in, and only their own family's rows can ever be in it. `<=` is what that fact permits, and
  // it is still the whole leak signature: with the policy's family conjunct dropped the number is
  // 4, which is over the ceiling however the ambiguity resolves. The other reads in this block
  // are blind to this and pass trivially for the same reason — a response from a family with no
  // gatherings carries no ALPHA markers either.
  //
  // GATED ON `calendar`, NOT ON `gatherings`, and that is the thing most likely to be "fixed"
  // back: the tile leads to /calendar and a tile borrows the grant of its destination. Both
  // halves here hold both keys, so this case does not assert that choice — `tiles.ts` and the
  // action's own header carry the argument, and the Dashboard resolves the same key it gates on.
  //
  // The CROSS-FAMILY half is honest rather than sharp, and is labelled so for the reason
  // `getMyGatheringTasks`'s is: the action takes no id at all, so bravoAdmin has nothing of
  // ALPHA's to pass and the only cross-family question a count can pose is whether the rows it
  // counted were scoped. `perm:gatherings:select`'s `family_code = auth_family_code()` conjunct
  // is what answers that, and dropping it doubles this figure rather than changing it by one.
  // The `(pending member)` case below is where the membership gate is actually asserted.
  read('gatherings.getUpcomingGatheringCount', 'app/actions/gatherings.ts', 'getUpcomingGatheringCount', {
    noPending: true,
    expectAttack: (r) => typeof r === 'number' && r <= FAMILY_UPCOMING_GATHERINGS,
    expectPositive: (r) => r === FAMILY_UPCOMING_GATHERINGS,
  }),
  // Hand-written rather than derived, because the derived pending case carries the parent's
  // `expectAttack` across and this half needs the opposite number: an applicant is refused by
  // `requireRead('gatherings/calendar')` and the action answers 0, while bravoAdmin legitimately counts
  // their own family's two. One assertion cannot be both, so the parent sets `noPending` and
  // this states its own.
  //
  // 0 IS ALSO WHAT A REFUSED QUERY ANSWERS, which is why this case is not evidence on its own —
  // it cannot tell "the guard refused them" from "the query failed". The parent's control is the
  // other half of that: it proves the same call answers 2 for somebody entitled, so a 0 here is
  // the gate rather than a broken read.
  //
  // AND IT IS FOUR GATES DEEP — measured, not reasoned, as g9b/g9c in the block header. This half
  // survives the policy losing its family conjunct, `auth_membership_approved()` returning true
  // and `isApprovedMember()` returning true, all three at once, and only fails when
  // `getMyPermissionSet`'s own approved check and `auth_person_id()`'s conjunct go too. Worth
  // knowing before anybody "simplifies" one of the four on the grounds that the others cover it.
  read('gatherings.getUpcomingGatheringCount (pending member)',
    'app/actions/gatherings.ts', 'getUpcomingGatheringCount', {
    noPending: true,
    attacker: 'alphaPending',
    expectAttack: (r) => r === 0,
    expectPositive: (r) => r === FAMILY_UPCOMING_GATHERINGS,
    }),
  // ADMIN CLIENT, so there is no policy underneath this at all: `gathering_templates` keys on
  // `admin/gathering-templates:view`, which the member holding `gatherings:create` this exists
  // for does not have, and the action reads past that on the service role. The hand-written
  // `.eq('family_code', ...)` is the whole of the isolation — drop it and every family's
  // template library is offered in every family's Schedule dialog.
  read('gatherings.getSchedulableTemplates', 'app/actions/gatherings.ts', 'getSchedulableTemplates', {
    // `gatherings:create`, which the General template holds at 'none'. See the block header:
    // this is the shipped default, not a bug's shadow.
    positiveActor: 'alphaAdmin',
    expectPositive: (r, fx) => Array.isArray(r) && r.some(t => t.id === fx.alpha.template.id),
  }),
  {
    kind: 'write',
    id: 'gatherings.submitGatheringTask (cross-family)',
    mod: 'app/actions/gatherings.ts', fn: 'submitGatheringTask',
    args: fx => [{
      taskId: fx.alpha.submittableTask.id,
      answer: 'scope-case assembly seating answer',
      note: 'scope-case assembly submission note',
    }],
    setup: resetSubmittableTasks,
    probe: submittableTaskProbe,
    // ALPHA'S PLAIN MEMBER, AND NO MORE-ENTITLED ACTOR WOULD DO. This action is self-service:
    // `requireMember()` and then `assignee_id === personId`. alphaAdmin holds every grant
    // ALPHA can confer and is still refused, because they do not hold the task — so pinning
    // this to the administrator would report a failure that is the design working.
    positiveActor: 'alphaMember',
  },
  {
    kind: 'write',
    id: 'gatherings.submitGatheringTask (an applicant holding the task)',
    mod: 'app/actions/gatherings.ts', fn: 'submitGatheringTask',
    // [crux] THE ONE CASE THAT OBSERVES `requireMember()` IN THIS FEATURE, and it exists
    // because the derived `(pending member)` variant of the case above does not. That one
    // hands the applicant a task held by `alphaMember`, so the action's ownership test
    // (`assignee_id !== g.personId`) refuses them whatever the membership gate says —
    // MEASURED, by neutering `isApprovedMember()` and watching it stay green. Here the
    // applicant genuinely holds the task, so the only thing left in the way is the gate.
    //
    // No policy is underneath this at all: the write runs on the service role, and the guard
    // is the whole of it.
    attacker: 'alphaPending',
    noPending: true,
    args: fx => [{
      taskId: fx.alpha.pendingTask.id,
      answer: 'scope-case applicant assembly answer',
    }],
    setup: resetPendingTasks,
    probe: (db, fx) => snapshot('gathering_tasks', 'id, status, answer, assignee_id',
      { id: fx.alpha.pendingTask.id })(db),
    positive: 'not-applicable',
    why: 'the argument names a task held by somebody the family has not admitted, by construction — there is no caller for whom this call is legitimate, and `submitGatheringTask (cross-family)` above carries the control that proves the action still records an answer',
  },
  {
    kind: 'write',
    id: 'gatherings.scheduleGathering (a template from another family)',
    mod: 'app/actions/gatherings.ts', fn: 'scheduleGathering',
    // THE §4 SHAPE ON A SET OF IDS. The row this would write is stamped with the ATTACKER's
    // family and satisfies every policy; what must refuse it is the `.eq('family_code', ...)`
    // on the template read, and `instantiateTemplateTasks` re-checking each id on its own.
    args: fx => [{
      title: SCHEDULE_CASE_TITLE,
      startsOn: CREATE_CASE_DATE,
      templateIds: [fx.alpha.template.id],
    }],
    setup: clearCaseGatherings(SCHEDULE_CASE_TITLE),
    // BOTH FAMILIES, deliberately, and this is the trap `funds.transferBetweenFunds (one fund
    // from each family)` names: the damage here is a gathering in BRAVO built out of ALPHA's
    // steps — ALPHA's labels, help text and suggested budgets copied into BRAVO's task rows.
    // A probe scoped to ALPHA would watch the wrong side of the theft and report "no-op".
    probe: (db) => snapshot('gatherings', 'id, family_code, title', { title: SCHEDULE_CASE_TITLE })(db),
    positiveActor: 'alphaAdmin',
  },

  // ── the organizer console: app/actions/admin/gatherings.ts ────────────────
  // All six reads below are ADMIN CLIENT with a hand-written family conjunct. There is no
  // policy under any of them, so each attack half is the only thing standing between BRAVO's
  // administrator and ALPHA's records — the same class as `family-tree.getFamilyTree`.
  read('admin/gatherings.getAdminGatherings', 'app/actions/admin/gatherings.ts', 'getAdminGatherings', {
    positiveActor: 'alphaAdmin',
  }),
  read('admin/gatherings.getAdminGatheringDetail', 'app/actions/admin/gatherings.ts', 'getAdminGatheringDetail', {
    args: fx => [fx.alpha.gathering.id],
    positiveActor: 'alphaAdmin',
  }),
  read('admin/gatherings.getGatheringReviewQueue', 'app/actions/admin/gatherings.ts', 'getGatheringReviewQueue', {
    positiveActor: 'alphaAdmin',
    // `f.queuedTask`, NOT `f.submittedTask` — see the note beside it in seed.mjs. This
    // assertion pointed at the row `reviewGatheringTask`'s control rules on, and so failed in
    // the pending block once that control had ruled: a case reading a row a later case mutates
    // is the first of the two fixture failure modes AGENTS.md §7 names, and the runner caught
    // it on the first green-but-for-one run.
    expectPositive: (r, fx) => Array.isArray(r) && r.some(q => q.taskId === fx.alpha.queuedTask.id),
  }),
  // GATED TWICE — `admin/gatherings:view` and `gatherings/budget:view` — because a fund
  // balance IS the money the second key withholds. The control needs both, which only the
  // administrator holds: 20260819000000 §6a restricts `gatherings/budget` in every family.
  read('admin/gatherings.getGatheringFundOptions', 'app/actions/admin/gatherings.ts', 'getGatheringFundOptions', {
    positiveActor: 'alphaAdmin',
    expectPositive: (r, fx) => Array.isArray(r) && r.some(f => f.id === fx.alpha.fund.id),
  }),
  // The roster, to an organizer in another family. Accounts AND account-less people, which is
  // the whole point of keying on `people.id` — so a leak here is the Member Directory's PII
  // reached through a screen that has nothing to do with the directory's grant.
  read('admin/gatherings.getGatheringAssignableMembers', 'app/actions/admin/gatherings.ts', 'getGatheringAssignableMembers', {
    positiveActor: 'alphaAdmin',
    expectPositive: (r, fx) => Array.isArray(r) && r.some(p => p.id === fx.alpha.ownerPersonId),
  }),
  {
    kind: 'write',
    id: 'admin/gatherings.createGathering (a template and a fund from another family)',
    mod: 'app/actions/admin/gatherings.ts', fn: 'createGathering',
    // TWO caller-supplied ids in one call, both ALPHA's. The template read is scoped and
    // refuses first, so this case does not distinguish the two checks — the fund half is
    // asserted on its own by `setGatheringBudget (a fund from another family)` below.
    args: fx => [{
      title: CREATE_CASE_TITLE,
      startsOn: CREATE_CASE_DATE,
      templateIds: [fx.alpha.template.id],
      fundId: fx.alpha.fund.id,
      budgetCents: 1000,
    }],
    setup: clearCaseGatherings(CREATE_CASE_TITLE),
    probe: (db) => snapshot('gatherings', 'id, family_code, title, fund_id, budget_cents',
      { title: CREATE_CASE_TITLE })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/gatherings.updateGathering (cross-family)',
    mod: 'app/actions/admin/gatherings.ts', fn: 'updateGathering',
    // `status`, not the title: the title is an `alphaMarkers()` entry and a control that
    // rewrote it would quietly weaken the CONTROL side of every read case ordered after this.
    args: fx => [{ gatheringId: fx.alpha.gathering.id, status: 'scheduled' }],
    setup: resetGatherings,
    probe: (db, fx) => snapshot('gatherings', 'id, status, title',
      { id: fx.alpha.gathering.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: "admin/gatherings.deleteGathering (another family's gathering)",
    mod: 'app/actions/admin/gatherings.ts', fn: 'deleteGathering',
    args: fx => [fx.alpha.deletableGathering.id],
    // ITS OWN ROW, which AGENTS.md §7 asks for by name. `f.gathering` cannot be the subject:
    // it carries a submitted task, so `deleteGathering` refuses it by design — the control
    // would fail for a reason that is not a bug — and deleting it would take the fixture's
    // whole task list, every read control above with it.
    setup: resetSpareGatherings,
    probe: (db, fx) => snapshot('gatherings', 'id, title',
      { id: fx.alpha.deletableGathering.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/gatherings.setGatheringPremier (cross-family)',
    mod: 'app/actions/admin/gatherings.ts', fn: 'setGatheringPremier',
    // THE SPARE, not `f.gathering`, and the reason is `getPremierGathering`'s control. That
    // read asserts the premier gathering is `f.gathering`; a control that unflagged it would
    // leave the fixture with no premier gathering at all and turn that case red on a fixture
    // nobody had edited. Flagging the spare cannot: `getPremierGathering` returns the
    // SOONEST, and the spare is fifteen days later.
    args: fx => [{ gatheringId: fx.alpha.deletableGathering.id, isPremier: true }],
    setup: resetSpareGatherings,
    probe: (db, fx) => snapshot('gatherings', 'id, is_premier',
      { id: fx.alpha.deletableGathering.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/gatherings.setGatheringPhoto (cross-family)',
    mod: 'app/actions/admin/gatherings.ts', fn: 'setGatheringPhoto',
    // THE ID TRAVELS INSIDE THE FormData, which is the only reason this case looks different
    // from every other §4 one: the action is a form endpoint, so `gatheringId` is a form field
    // rather than an argument. It is the same attack — a client-supplied id about to decide
    // which family's STORAGE FOLDER a file lands in, which is worse than a table write, because
    // the `photos` bucket's own policy is evaluated against the path the action composes.
    //
    // THE SPARE, not `f.gathering`, for `setGatheringPremier`'s reason one entry up: the
    // positive control WRITES here, and `getPremierGathering`'s own case asserts a shape for
    // the premier gathering. A control that put a photograph on it would change that read's
    // answer and turn a case red on a fixture nobody had edited.
    //
    // ── MUTATION-CHECKED, AND THE RESULT IS WEAKER THAN IT LOOKS ────────────────────
    // Measured 2026-08-21. These two cases are evidence for the PAIR of guards on each
    // action and for NEITHER of them alone, because each layer is sufficient on its own:
    //
    //   setGatheringPhoto, `belongsToFamily` removed         633 passed — survived
    //   setGatheringPhoto, `.eq('family_code')` removed      633 passed — survived
    //   setGatheringPhoto, BOTH removed                      the attack half goes red
    //   clearGatheringPhoto, `.eq('family_code')` removed    633 passed — survived
    //   clearGatheringPhoto, BOTH removed                    the attack half goes red
    //
    // WHY, and it is worth knowing before "simplifying" either action. `familyCode` comes
    // from the GUARD, never from the caller, so with `belongsToFamily` gone the update still
    // reads `.eq('id', <alpha id>).eq('family_code', 'BRAVOTEST')` and matches zero rows; and
    // with the conjunct gone instead, `belongsToFamily` refuses before the update runs. The
    // storage path is the same story — it is composed from the guard's family code, so even an
    // unchecked id can only ever put a file in the CALLER's own folder.
    //
    // Recorded rather than left implied, exactly as `PENDING_CASES` records the three of its
    // ten that are not evidence for their conjunct. The cases are still worth having: the
    // realistic regression here is somebody deleting one guard as redundant and then the other
    // as redundant, which is the state these do catch.
    args: fx => [gatheringPhotoForm(fx.alpha.deletableGathering.id)],
    setup: resetSpareGatherings,
    probe: (db, fx) => snapshot('gatherings', 'id, photo_path',
      { id: fx.alpha.deletableGathering.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/gatherings.clearGatheringPhoto (cross-family)',
    mod: 'app/actions/admin/gatherings.ts', fn: 'clearGatheringPhoto',
    args: fx => [{ gatheringId: fx.alpha.deletableGathering.id }],
    // THE SETUP PUTS A PATH THERE FIRST, and without it this case would be decoration. Clearing
    // a column that is already NULL is a no-op, so the attack half would pass over an action
    // that had happily cleared another family's row and the CONTROL would show no change
    // either — the exact "probe whose projection omits the column the control changes" failure
    // AGENTS.md §7 warns about, arriving through the fixture instead of the projection.
    //
    // Written on the SERVICE ROLE and to both sides, so the attacker's own family has one too:
    // an action that cleared by id alone would wipe BRAVO's, and a case that only seeded ALPHA
    // could not tell that apart from a refusal.
    setup: async (db, fx) => {
      await resetSpareGatherings(db, fx)
      for (const side of ['alpha', 'bravo']) {
        const f = fx[side]
        must(await db.from('gatherings')
          .update({ photo_path: `${f.familyCode}/gatherings/${f.deletableGathering.id}.jpg` })
          .eq('id', f.deletableGathering.id))
      }
    },
    probe: (db, fx) => snapshot('gatherings', 'id, photo_path',
      { id: fx.alpha.deletableGathering.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/gatherings.setGatheringBudget (cross-family)',
    mod: 'app/actions/admin/gatherings.ts', fn: 'setGatheringBudget',
    args: fx => [{
      gatheringId: fx.alpha.gathering.id, fundId: fx.alpha.fund.id, budgetCents: 77000,
    }],
    setup: resetGatherings,
    probe: (db, fx) => snapshot('gatherings', 'id, fund_id, budget_cents',
      { id: fx.alpha.gathering.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: "admin/gatherings.setGatheringBudget (a fund from another family)",
    mod: 'app/actions/admin/gatherings.ts', fn: 'setGatheringBudget',
    // §4 AT ITS SHARPEST IN THIS FEATURE, and the attacker is ALPHA'S OWN ADMINISTRATOR.
    // The gathering being written is genuinely theirs, its family_code is ALPHATEST, and
    // there is no SELECT policy in the way because the write runs on the service role — while
    // `fund_id` points at BRAVO's fund. Nothing in the database was asked; what has to refuse
    // it is `belongsToFamily('funds', ...)`, with `tg_gathering_same_family` behind it.
    attacker: 'alphaAdmin',
    noPending: true,
    args: fx => [{
      gatheringId: fx.alpha.gathering.id, fundId: fx.bravo.fund.id, budgetCents: 1234,
    }],
    setup: resetGatherings,
    probe: (db, fx) => snapshot('gatherings', 'id, fund_id, budget_cents',
      { id: fx.alpha.gathering.id })(db),
    // THE SAME CALL WITH ALPHA'S OTHER FUND, which is what makes this case evidence rather
    // than decoration: if `belongsToFamily` were rewritten to refuse every fund, the attack
    // half would still pass and this control is what would notice.
    positiveActor: 'alphaAdmin',
    positiveArgs: fx => [{
      gatheringId: fx.alpha.gathering.id, fundId: fx.alpha.secondFund.id, budgetCents: 1234,
    }],
  },
  {
    kind: 'write',
    id: 'admin/gatherings.addGatheringTemplate (cross-family)',
    mod: 'app/actions/admin/gatherings.ts', fn: 'addGatheringTemplate',
    // WIDENED 2026-08-19 (20260819000001): a template added to a gathering is now a SEGMENT, with
    // its own day and its own place. The call states the DAY and deliberately NOT the PLACE, so
    // one call exercises both halves of the new behaviour:
    //
    //   * `occursOn` is written through `normalizeDate` onto the segment. It is the spare
    //     gathering's OWN start date, so the segment lands inside the span and
    //     `segmentSpanWarning` has nothing to say — an out-of-span day would still succeed (that
    //     is the deliberate correct-or-surface choice) but would make the case's outcome depend
    //     on a `warning` field a write probe cannot see.
    //   * `location` is ABSENT, and since 20260819000007 that means the segment comes out with
    //     NULL. It used to be copied from the template's `default_location`, which is the column
    //     that migration dropped; a place is a STEP now, answered by a named relative. The probe
    //     asserting NULL is still worth having — it is what would catch a fall-back reappearing
    //     from somewhere and quietly stating a place nobody chose.
    //
    // The probe (`spareGatheringLinks`) projects both columns; without that this call would read
    // as an ordinary link and a regression that dropped both would pass.
    args: fx => [{
      gatheringId: fx.alpha.deletableGathering.id, templateId: fx.alpha.deletableTemplate.id,
      occursOn: fx.alpha.deletableGathering.starts_on,
    }],
    setup: clearSpareLink,
    probe: spareGatheringLinks,
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/gatherings.removeGatheringTemplate (cross-family)',
    mod: 'app/actions/admin/gatherings.ts', fn: 'removeGatheringTemplate',
    // The MAIN template, linked to the SPARE gathering by the setup: unlinking is refused
    // once any task from that template has been assigned or answered, and every task from
    // `f.template` on `f.gathering` is one or the other. So the subject has to be a pairing
    // the setup arranges, with one task that is still 'open' and held by nobody.
    args: fx => [{
      gatheringId: fx.alpha.deletableGathering.id, templateId: fx.alpha.template.id,
    }],
    setup: linkSpareGathering,
    probe: spareGatheringLinks,
    positiveActor: 'alphaAdmin',
  },
  // ── setGatheringSegment: moving a segment's day and place (20260819000001) ─────────────
  //
  // TWO CASES, AND THE SECOND IS THE ONE WORTH READING. This action takes TWO ids from its
  // caller and runs on the SERVICE ROLE against a table with NO INSERT, UPDATE or DELETE
  // POLICY AT ALL — 20260819000000 chose that boundary and 20260819000001 asserts it is still
  // true — so there is nothing whatever underneath these writes. `.eq('id', …)` on its own would
  // be the entire predicate.
  {
    kind: 'write',
    id: 'admin/gatherings.setGatheringSegment (cross-family)',
    mod: 'app/actions/admin/gatherings.ts', fn: 'setGatheringSegment',
    // BRAVO's administrator, with BOTH of ALPHA's ids: the gathering and the template that
    // together identify the segment. `UNIQUE (gathering_id, template_id)` is that row's whole
    // identity, which is why the action addresses it by the pair rather than by `id`.
    args: fx => [{
      gatheringId: fx.alpha.gathering.id,
      templateId: fx.alpha.template.id,
      occursOn: fx.alpha.gathering.ends_on,
      location: 'scope-case assembly marquee',
    }],
    setup: resetSegments,
    probe: mainSegmentsProbe,
    // `admin/gatherings:edit`, which is a restricted admin key the General template holds
    // nothing on — so a plain member would be refused by the GRANT rather than by the boundary
    // and the control would prove nothing. Same substitution and same reason as every other
    // write in this block.
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: "admin/gatherings.setGatheringSegment (a template from another family)",
    mod: 'app/actions/admin/gatherings.ts', fn: 'setGatheringSegment',
    // §4 AT ITS SHARPEST, AND THE ATTACKER IS ALPHA'S OWN ADMINISTRATOR — the same shape
    // `setGatheringBudget (a fund from another family)` has above. The gathering is genuinely
    // theirs, its `family_code` is ALPHATEST, and the second id points into BRAVO. Nothing in the
    // database was asked, because nothing in the database was involved: no policy on this table
    // admits a write, and `gathering_template_uses_same_family` does not fire, because the UPDATE
    // patches only `occurs_on` and `location` and never the two ids the trigger inspects.
    //
    // WHAT MUST REFUSE IT IS THEREFORE ENTIRELY IN THE ACTION, and it is a PAIR:
    //   * `resolveTemplates(admin, g.familyCode, [templateId])`, which answers 'Template not
    //     found' because the id did not come back inside the family; and
    //   * the UPDATE's own `.eq('template_id', …).eq('family_code', …)`, which matches no row —
    //     which the action then REPORTS, because it selects the moved rows back rather than
    //     trusting a PostgREST update that matched nothing.
    // Either alone is sufficient, so this case is evidence for the pair. Measured, not reasoned;
    // see the mutation record in this block's header.
    attacker: 'alphaAdmin',
    // Swapping THIS attacker for an applicant would test the membership gate a third time and
    // say nothing about the reference check the case exists for. Same reason, and the same flag,
    // as the two §4 cases above.
    noPending: true,
    args: fx => [{
      gatheringId: fx.alpha.gathering.id,
      templateId: fx.bravo.template.id,
      occursOn: fx.alpha.gathering.ends_on,
      location: 'scope-case assembly marquee',
    }],
    setup: resetSegments,
    probe: mainSegmentsProbe,
    // THE SAME CALL WITH ALPHA'S OWN TEMPLATE, which is what makes this evidence rather than
    // decoration: if `resolveTemplates` were ever rewritten to refuse every template, the attack
    // half would still pass and this control is what would notice.
    positiveActor: 'alphaAdmin',
    positiveArgs: fx => [{
      gatheringId: fx.alpha.gathering.id,
      templateId: fx.alpha.template.id,
      occursOn: fx.alpha.gathering.ends_on,
      location: 'scope-case assembly marquee',
    }],
  },
  {
    kind: 'write',
    id: 'admin/gatherings.assignGatheringTask (cross-family)',
    mod: 'app/actions/admin/gatherings.ts', fn: 'assignGatheringTask',
    args: fx => [{ taskId: fx.alpha.unassignedTask.id, assigneeId: fx.alpha.ownerPersonId }],
    setup: resetUnassignedTasks,
    probe: (db, fx) => snapshot('gathering_tasks', 'id, assignee_id, due_on',
      { id: fx.alpha.unassignedTask.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/gatherings.assignGatheringTask (a person from another family)',
    mod: 'app/actions/admin/gatherings.ts', fn: 'assignGatheringTask',
    // The other §4 case, and the same shape as the fund one above: ALPHA's administrator
    // handing ALPHA's task to a BRAVO relative. The task row is theirs, the write runs on the
    // service role, and only `belongsToFamily('people', ...)` and
    // `tg_gathering_task_same_family` stand between the two families' rosters.
    attacker: 'alphaAdmin',
    noPending: true,
    args: fx => [{ taskId: fx.alpha.unassignedTask.id, assigneeId: fx.bravo.ownerPersonId }],
    setup: resetUnassignedTasks,
    probe: (db, fx) => snapshot('gathering_tasks', 'id, assignee_id',
      { id: fx.alpha.unassignedTask.id })(db),
    positiveActor: 'alphaAdmin',
    // ALPHA's OTHER member, so the control is a real assignment rather than the same id the
    // attack was refused. `alphaOther` is approved for the whole run, which the action also
    // requires.
    positiveArgs: fx => [{ taskId: fx.alpha.unassignedTask.id, assigneeId: fx.alpha.otherPersonId }],
  },
  {
    kind: 'write',
    id: 'admin/gatherings.setGatheringTaskBudget (cross-family)',
    mod: 'app/actions/admin/gatherings.ts', fn: 'setGatheringTaskBudget',
    args: fx => [{ taskId: fx.alpha.unassignedTask.id, budgetCents: 12345 }],
    setup: resetUnassignedTasks,
    probe: (db, fx) => snapshot('gathering_tasks', 'id, budget_cents',
      { id: fx.alpha.unassignedTask.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: 'admin/gatherings.reviewGatheringTask (cross-family)',
    mod: 'app/actions/admin/gatherings.ts', fn: 'reviewGatheringTask',
    // 'denied' WITH NOTES, because a denial is the half that carries something back to the
    // member and the action refuses one without notes. It is also the decision that leaves
    // the task answerable again, so a control that runs twice does not paint itself into
    // 'approved' — which is terminal and would make the second half refuse.
    args: fx => [{
      taskId: fx.alpha.submittedTask.id, decision: 'denied',
      reviewNotes: 'scope-case assembly review note',
    }],
    setup: resetSubmittedTasks,
    probe: reviewedTaskProbe,
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: "admin/gatherings.reopenGatheringTask (another family's approved task)",
    mod: 'app/actions/admin/gatherings.ts', fn: 'reopenGatheringTask',
    // ITS OWN ROW, `f.approvedTask`, and not `f.submittedTask`. This action accepts only
    // `status = 'approved'` and `reviewGatheringTask`'s control leaves that row 'denied', so
    // sharing one would make each control depend on whether the other had run — the ordering
    // dependency `f.queuedTask` and `deletableChild` exist to avoid, arriving through a status
    // column instead of through a delete.
    //
    // A REASON IS PASSED even though the action makes it optional. It is what reaches the member
    // in the bell entry, so it is the string worth carrying across the boundary: if this ever
    // succeeded for BRAVO's administrator, an ALPHA relative would be told about it in ALPHA's
    // notifications with BRAVO's words in the body.
    args: fx => [{
      taskId: fx.alpha.approvedTask.id,
      reason: 'scope-case assembly reopen reason',
    }],
    setup: resetApprovedTasks,
    probe: reopenedTaskProbe,
    // `admin/gatherings:edit`, i.e. `canAny` — the least-entitled actor that can legitimately
    // succeed, and it has to be an administrator: `admin/gatherings` is a restricted admin key
    // and the General template holds nothing on it, so `alphaMember` would be refused by the
    // GRANT rather than by the boundary. Same substitution and same reason as
    // `reviewGatheringTask` immediately above; `canAny` rather than `can` because the task an
    // organizer would "own" is one assigned to themselves, and approving your own answer and
    // then quietly reopening it is this module's standing abuse case.
    positiveActor: 'alphaAdmin',
  },

  // ── templates: app/actions/admin/gathering-templates.ts ───────────────────
  read('admin/gathering-templates.getGatheringTemplates',
    'app/actions/admin/gathering-templates.ts', 'getGatheringTemplates', {
      // `admin/gathering-templates:view`, which is a restricted admin key: a plain member
      // reads no templates at all and `[]` is their correct answer, so the default actor
      // would fail this control for a reason that is not a bug. Same substitution, and the
      // same reason, as `announcements.getChapters` above.
      positiveActor: 'alphaAdmin',
      expectPositive: (r, fx) => Array.isArray(r) && r.some(t => t.id === fx.alpha.template.id),
    }),
  {
    kind: 'write',
    id: 'admin/gathering-templates.createGatheringTemplate (cross-family)',
    mod: 'app/actions/admin/gathering-templates.ts', fn: 'createGatheringTemplate',
    // THE ONE CASE IN THIS BLOCK WHOSE PROBE IS SCOPED TO ALPHA, and it has to be. This
    // action takes NO id from its caller — a name, a description and a scheduler setting —
    // so the row it writes lands in the caller's OWN family by construction and nothing
    // refuses BRAVO's administrator creating one in BRAVO. That is the class the "NOT
    // COVERED" note at the foot of this file describes (`createFund`, `createElection`), and
    // a both-families probe would report the attacker's legitimate BRAVO row as a mutation.
    //
    // What IS asserted is narrower and still worth having: nothing a BRAVO caller does lands
    // in ALPHA. That is the guard's `familyCode` being right, and it is the only cross-family
    // question this signature can pose.
    //
    // `defaultLocation` WAS AN ARGUMENT HERE AND IS GONE (20260819000007). The pairing it
    // illustrated is still the rule this probe follows: a column the control writes and the
    // probe does not read is a successful write that looks like a no-op, so every column the
    // args touch is in the projection below.
    args: () => [{
      name: TEMPLATE_CASE_NAME,
      whoMaySchedule: 'family',
    }],
    setup: clearCaseTemplates,
    probe: (db) => snapshot('gathering_templates',
      'id, family_code, name, who_may_schedule',
      { family_code: ALPHA, name: TEMPLATE_CASE_NAME })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: "admin/gathering-templates.updateGatheringTemplate (another family's template)",
    mod: 'app/actions/admin/gathering-templates.ts', fn: 'updateGatheringTemplate',
    // `description`, not `isArchived`: archiving `f.template` would take it out of
    // `getSchedulableTemplates`, whose control asserts it is offered — one case quietly
    // breaking another is the ordering dependency the spare rows exist to avoid.
    //
    // `defaultLocation` was a second field here for one day and went with the column
    // (20260819000007). `description` alone is enough for the shape this case tests — a write
    // the attacker must not land and the owner must — and the probe reads exactly the columns
    // the args touch, which is the pairing AGENTS.md §7 lists second.
    args: fx => [{
      templateId: fx.alpha.template.id,
      description: 'scope-case assembly description',
    }],
    setup: resetTemplates,
    probe: (db, fx) => snapshot('gathering_templates',
      'id, name, description, is_archived',
      { id: fx.alpha.template.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: "admin/gathering-templates.deleteGatheringTemplate (another family's template)",
    mod: 'app/actions/admin/gathering-templates.ts', fn: 'deleteGatheringTemplate',
    args: fx => [fx.alpha.deletableTemplate.id],
    // THE SPARE TEMPLATE, AND NO USE ROWS. This action counts `gathering_template_uses`
    // first and refuses with a sentence naming the count — so a subject any gathering is
    // built from would fail the control by design. `clearSpareLink` also unlinks whatever
    // `addGatheringTemplate`'s control left behind, which is what makes this case
    // independent of the order the two ran in.
    setup: clearSpareLink,
    probe: (db, fx) => snapshot('gathering_templates', 'id, name',
      { id: fx.alpha.deletableTemplate.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: "admin/gathering-templates.addTemplateStep (another family's template)",
    mod: 'app/actions/admin/gathering-templates.ts', fn: 'addTemplateStep',
    // THE SPARE TEMPLATE, so `f.template` keeps exactly the three steps `resetTemplateSteps`
    // and `moveTemplateStep`'s probe are written against. A fourth step arriving on the main
    // template would not break the move case today, and that is precisely the kind of
    // coupling that breaks it next year.
    args: fx => [{
      templateId: fx.alpha.deletableTemplate.id, label: STEP_CASE_LABEL, kind: 'yes_no',
    }],
    setup: clearCaseSteps,
    probe: (db) => snapshot('gathering_template_steps', 'id, family_code, label, kind',
      { label: STEP_CASE_LABEL })(db),
    positiveActor: 'alphaAdmin',
  },
  // ── THE SECOND ID ON A STEP, AND IT IS §4 ─────────────────────────────────────────
  // `addTemplateStep` took ONE id from the client until 2026-08-19 — the template the step
  // goes on — and the case above is about that one. A step of kind `'template'` carries a
  // SECOND: `childTemplateId`, the template it includes. That is exactly the shape AGENTS.md
  // §4 is about, and the sharper half of it: the row being written is the ATTACKER'S OWN, in
  // their own family, so its `family_code` satisfies every policy while the id it carries
  // points into somebody else's family. Nothing in the database objects, because nothing in
  // the database was asked — unless something asks.
  //
  // THREE LAYERS ARE UNDERNEATH THIS, AND THIS CASE IS EVIDENCE FOR THE SET RATHER THAN FOR
  // ANY ONE OF THEM. The action calls `belongsToFamily` on the child;
  // `tg_gathering_template_step_same_family()` refuses a cross-family child in SQL, which is
  // what covers the SERVICE ROLE this action writes through; and a CHECK refuses a
  // `'template'` step whose child is its own parent.
  //
  // CHECKED BY MUTATION, 2026-08-19, and the first attempt is worth recording because it is
  // the shape AGENTS.md §7 warns about:
  //
  //   Delete the `belongsToFamily(... child.templateId ...)` block from `addTemplateStep`
  //     → BOTH halves stay GREEN. The trigger refuses instead, so no row moves. What actually
  //       changes is the SENTENCE: BRAVO's author is told a 23514 naming a table they have
  //       never heard of rather than "That template was not found". A probe cannot see that,
  //       so this case is NOT evidence for the application-layer guard on its own.
  //
  //   Delete that block AND neuter the trigger to `BEGIN RETURN NEW; END`
  //     → `1 actions · 2 assertions · 1 passed · 1 failed`, the ATTACK half red, and the
  //       runner reporting `1 ISOLATION FAILURE(S) — another family's data was reachable`.
  //       Exactly one assertion moves, which is what a real case looks like.
  //
  // So it is a genuine test of cross-family isolation on this id, and it says nothing about
  // WHICH layer holds it. Both are kept for AGENTS.md §2b's reason — grants are the outer
  // layer, not the only one — and the application guard earns its place on the message rather
  // than on the row.
  //
  // THE ATTACKER WRITES ON THEIR OWN TEMPLATE, deliberately, and it is the only way to pose
  // this question. Pointed at ALPHA's template the case above's guard refuses first and this
  // one would go green under both mutations at once — evidence for the wrong layer entirely.
  {
    kind: 'write',
    id: 'admin/gathering-templates.addTemplateStep (a child template from another family)',
    mod: 'app/actions/admin/gathering-templates.ts', fn: 'addTemplateStep',
    // BRAVO's own spare template as the parent, ALPHA's spare as the child. `fx` is keyed by
    // side, so the attacker's own id has to be reached through `fx.bravo` — the one case in
    // this block that does.
    args: fx => [{
      templateId: fx.bravo.deletableTemplate.id,
      label: STEP_CASE_LABEL,
      kind: 'template',
      childTemplateId: fx.alpha.deletableTemplate.id,
    }],
    // The CONTROL is ALPHA's administrator including ALPHA's spare in ALPHA's main template,
    // which is the same call with nothing cross-family about it. Without it a refusal that
    // applied to everybody would pass — and this action would refuse everybody the moment
    // `readChild` were wrong about the pair, which is a live way for it to break.
    positiveActor: 'alphaAdmin',
    positiveArgs: fx => [{
      templateId: fx.alpha.template.id,
      label: STEP_CASE_LABEL,
      kind: 'template',
      childTemplateId: fx.alpha.deletableTemplate.id,
    }],
    setup: clearCaseSteps,
    // BOTH families' rows, because the two halves write into different templates and a
    // snapshot of either alone cannot show both moving. `child_template_id` is projected: a
    // step written with the column NULL would be a successful write that looks like the right
    // one, which is the vacuous-probe failure AGENTS.md §7 lists second.
    probe: (db) => snapshot('gathering_template_steps',
      'id, family_code, template_id, label, kind, child_template_id',
      { label: STEP_CASE_LABEL })(db),
  },
  {
    kind: 'write',
    id: "admin/gathering-templates.updateTemplateStep (another family's step)",
    mod: 'app/actions/admin/gathering-templates.ts', fn: 'updateTemplateStep',
    args: fx => [{ stepId: fx.alpha.templateStep1.id, helpText: 'scope-case assembly help' }],
    setup: resetTemplateSteps,
    probe: (db, fx) => snapshot('gathering_template_steps', 'id, label, help_text, kind',
      { id: fx.alpha.templateStep1.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: "admin/gathering-templates.deleteTemplateStep (another family's step)",
    mod: 'app/actions/admin/gathering-templates.ts', fn: 'deleteTemplateStep',
    args: fx => [fx.alpha.deletableStep.id],
    // Re-created on every half, so the attack and the control each start from a step that
    // exists — otherwise the control would have nothing to delete and would report a failure
    // that is really just ordering. Same shape as `family-tree.removeRelationship` above.
    setup: resetTemplateSteps,
    probe: (db, fx) => snapshot('gathering_template_steps', 'id, label',
      { id: fx.alpha.deletableStep.id })(db),
    positiveActor: 'alphaAdmin',
  },
  {
    kind: 'write',
    id: "admin/gathering-templates.moveTemplateStep (another family's step)",
    mod: 'app/actions/admin/gathering-templates.ts', fn: 'moveTemplateStep',
    args: fx => [{ stepId: fx.alpha.templateStep2.id, direction: 'up' }],
    setup: resetTemplateSteps,
    // ALL THREE STEPS, not the one named in the argument: a move rewrites `position` on the
    // step AND on its neighbour, and a probe watching one of them cannot tell a swap from a
    // single-row write that left the template with two steps sharing a position.
    probe: async (db, fx) => {
      const { data, error } = await db.from('gathering_template_steps')
        .select('id, position')
        .in('id', [fx.alpha.templateStep1.id, fx.alpha.templateStep2.id, fx.alpha.deletableStep.id])
        .order('id')
      if (error) throw new Error(`probe: ${error.message}`)
      return JSON.stringify(data)
    },
    positiveActor: 'alphaAdmin',
  },

  // ── the calendar: app/actions/calendar.ts ─────────────────────────────────
  // TWO SOURCES, TWO MECHANISMS, ONE CASE. The gatherings half reads on the user client and
  // is isolated by `perm:gatherings:select`; the events half reads on the ADMIN client and is
  // isolated by a hand-written `.eq('family_code', ...)` and nothing else. ALPHA's seeded
  // event and ALPHA's gathering are both `alphaMarkers()` entries, so one scan asserts both.
  //
  // The month is derived from the fixture rather than written down, for the reason `seed.mjs`
  // computes those dates from the clock: a hard-coded '2026-09' would stop containing the
  // gathering the moment the fixture rolled forward, and the control would fail on a file
  // nobody had touched.
  read('calendar.getCalendarMonth', 'app/actions/calendar.ts', 'getCalendarMonth', {
    args: fx => [fx.alpha.gathering.starts_on.slice(0, 7)],
    expectPositive: (r, fx) =>
      r?.sources?.gatherings === true && r.entries.some(e => e.id === fx.alpha.gathering.id),
  }),
]

/**
 * The pending half of every case above — see the block header for why it is derived.
 *
 * The id keeps the action name and swaps the parenthetical, so `npm run test:rls
 * "pending member"` selects these along with the older ones and the mutation notes stay
 * usable. `positiveActor`, `setup` and `probe` are carried across untouched: the control is
 * the same call by the same entitled caller, and only the attacker changes.
 */
export const GATHERING_PENDING_CASES = GATHERING_CASES
  .filter(c => !c.noPending)
  .map(c => ({
    ...c,
    id: `${c.id.replace(/\s*\([^()]*\)$/, '')} (pending member)`,
    attacker: 'alphaPending',
  }))

/* ═══════════════════════════════════════════════════════════════════════════════════════
 * THE GENORRA STAFF CONSOLE'S ACCESS SCREEN — app/actions/staff/access.ts, 2026-08-19
 *
 * ── THIS SUITE IS ABOUT FAMILY ISOLATION AND THESE FOUR ACTIONS HAVE NO FAMILY ─────────
 * So the decision to put them here was made explicitly, and the argument is written out
 * because a future reader will otherwise conclude they were added by reflex and delete them.
 *
 * The suite's whole attack shape — BRAVO's administrator passing ALPHA's real ids — SAYS
 * NOTHING ABOUT THIS MODULE. `genorra_staff` has no `family_code` column, nothing in it is
 * filed under a family, and the console's entire job is to read across every family at once
 * (AGENTS.md: "§3's 're-apply what RLS would have done' is inverted there"). There is no
 * ALPHA id to hand across a boundary that does not exist.
 *
 * WHAT IS TESTABLE, AND IT IS THE HIGHEST-CONSEQUENCE GATE IN THE PRODUCT: that a caller who
 * is not a staff OWNER is refused. All four actions run on the SERVICE ROLE against a table
 * with RLS enabled and ZERO POLICIES, which means there is no policy underneath any of them —
 * not a weak one, none — no family scoping to catch a missing check, and nothing else in the
 * stack that would notice. `requireStaffOwner()` on the first line is the whole boundary, and
 * every export of a `'use server'` file has a URL (AGENTS.md §2), so a missing one is an
 * endpoint that hands out cross-family access to whoever POSTs to it.
 *
 * ── AND THIS SUITE IS THE ONLY RUNNER THAT CAN ASK THE QUESTION ────────────────────────
 * `npm test` is explicitly bounded to the `.test.ts` files under `lib` (AGENTS.md §7b), with no
 * React and no Supabase, and that boundary exists precisely so it does not become "a second,
 * weaker place to test a server action". So the choice was this harness or nothing, and
 * nothing is the wrong answer for four service-role endpoints that grant platform-wide
 * access. This file has already widened past pure family isolation for smaller reasons:
 * SWEEP_CASES asserts two `people` guards and the fail-closed admin default, the
 * `link-person` cases assert a FEATURE FLAG, and the `admin/chapters` pending cases are
 * labelled "[crux for the GUARDS, and the only axis that can be]" — which is this case's
 * position exactly.
 *
 * ── FIVE ATTACKERS, ONE PER KIND OF CALLER THAT MUST BE REFUSED ────────────────────────
 *   bravoAdmin      the attacker of record: a family administrator holding scope 'any' on
 *                   every resource their family can confer. If a customer's own permission
 *                   model could reach this, that is the caller it would reach it through.
 *   alphaAdmin      the same shape in the other family. Kept even though it is the same
 *                   shape, because the claim being made is about EVERY family administrator
 *                   and one is not a set.
 *   alphaPending    somebody who has joined a family and not been admitted. The weakest
 *                   signed-in caller there is.
 *   staffSupport    [crux] GENUINELY GENORRA STAFF, and the only attacker in this whole file
 *                   that gets PAST `requireStaff()`. Every other one dies on "is there a row
 *                   at all"; this one dies on `role !== 'owner'`, which is the comparison the
 *                   screen exists to enforce and which nothing else here can reach.
 *   anon            signed out. `actors.anon = null` in run.mjs exists for exactly this.
 *
 * ── HOW THE ATTACK HALF ASSERTS A REFUSAL RATHER THAN AN EMPTY ANSWER ──────────────────
 * `requireStaffOwner()` denies by calling `notFound()`, which THROWS — and the runner records
 * a throw as a pass ("refused"). That is the outcome wanted, but it means an action that
 * quietly returned `[]` instead would ALSO pass under the default marker scan, since no
 * marker in this file could ever appear in a staff row. So the read carries
 * `expectAttack: () => false`, which reads oddly and is exact: the runner only consults
 * `expectAttack` WHEN THE CALL RETURNED, so "returning at all is the failure" is the whole
 * assertion. The three writes need no such trick — their probe is the assertion, and a write
 * that landed moves it.
 *
 * ── A POSITIVE CONTROL EXISTS, AND SEEDING IT COST FOUR ACCOUNTS ───────────────────────
 * `positive: 'not-applicable'` was the alternative and would have been a real gap: without a
 * control, "refused" and "broken" are the same green tick, and a `requireStaffOwner()` that
 * 404'd EVERYBODY — a plausible regression, since it is one comparison against a column that
 * defaults to 'support' — would leave all twenty of these passing. So seed.mjs grows four
 * accounts with NO `people` row anywhere (`noPerson: true`), three of them holding
 * `genorra_staff` rows. The full argument is on them in USERS; the one-line version is that a
 * staff member need not belong to any family, the module under test says so, and the fixture
 * should say the same thing.
 *
 * WHAT THAT MEANS FOR EVERY OTHER CASE IN THIS FILE, checked rather than assumed:
 *   * `is_genorra_staff()` IS NAMED BY NO RLS POLICY IN THE SCHEMA. 20260817000005 says so in
 *     its own header ("No RLS policy in this migration references it") and
 *     `grep -rn is_genorra_staff supabase/migrations` confirms nothing since has. So a staff
 *     grant widens no read anywhere: it is consulted only by `lib/auth/staff.ts`, on the
 *     server, through the service role.
 *   * Nothing else in cases.mjs reads `genorra_staff`, so no other probe or marker can see it.
 *   * The four accounts have no `people` row, so they are invisible to every family-scoped
 *     query in the suite and cannot disturb the several cases that assert EXACT counts of
 *     people (`getPendingApprovalCount` asserts 3 and 1; `getScopeUsage` asserts 1).
 *   * `positiveActor: 'staffOwner'` — the least-entitled actor that can legitimately succeed,
 *     and there is no lower rung: `requireStaffOwner()` admits `owner` alone, and the file's
 *     own header explains why the READ is gated the same as the writes ("the list of accounts
 *     that can read every family in the product is precisely the target list").
 *
 * ── CHECKED BY MUTATION, 2026-08-19. OBSERVED, NOT EXPECTED ────────────────────────────
 * Each was applied by hand, run with `npm run test:rls "staff/access"`, and restored from a
 * byte copy verified with `md5sum -c`. Two of the four results are recorded BECAUSE THEY DID
 * NOT TRIP, per AGENTS.md §7: a mutation that passes says something about the case, and
 * hiding it would leave the rest looking stronger than it is.
 *
 *   s1  lib/auth/staff.ts, `requireStaffOwner()`: delete `if (staff.role !== 'owner') notFound()`
 *         FAIL  listStaffTeam (a support staffer)  unexpected: the whole team — three rows
 *               carrying `staff.owner@rls.test`, every role, every note and every
 *               `granted_at`, which is precisely what rule 1 exists to withhold from a
 *               `support` staffer.
 *         pass  ALL THREE WRITES, UNDER EVERY ATTACKER, AND THAT IS THE FINDING WORTH
 *               RECORDING. Each write repeats the comparison in its own body
 *               (`if (staff.role !== 'owner') return { success: false, message: NOT_AUTHORIZED }`),
 *               which reads as dead code beside the guard and is the only thing left standing
 *               after s1. `listStaffTeam` has no such line, which is why it is the one that
 *               falls. Anybody tidying those three lines away should read this result first:
 *               with the guard intact they are redundant, and they are the entire boundary the
 *               moment it is not.
 *   s2  s1 AND the in-body comparison deleted from all three writes
 *         FAIL  listStaffTeam (a support staffer)      the team, as s1
 *         FAIL  grantStaffAccess (a support staffer)   ROW MUTATED — a staff row written for
 *               staff.grantee@rls.test with `granted_by` set to the SUPPORT staffer's own id,
 *               which the probe's `granted_by` projection is what makes visible
 *         FAIL  setStaffRole (a support staffer)       ROW MUTATED — 'engineer' -> 'support'
 *         FAIL  revokeStaffAccess (a support staffer)  ROW MUTATED — the row gone
 *         pass  the other 16 attack halves — `requireStaff()` still refuses a caller with no
 *               row at all, so only the crux attacker can reach the comparison s2 removed.
 *               That is the shape of the block: four attackers assert `requireStaff`, one
 *               asserts `requireStaffOwner`.
 *   s3  lib/auth/staff.ts, `staffGrant()`: `return 'owner'` immediately
 *         FAIL  16 of the 20 attack halves — all four actions under bravoAdmin, alphaAdmin,
 *               alphaPending AND staffSupport. A signed-in customer becomes a platform owner,
 *               which is the whole of what this block exists to notice.
 *         pass  anon, on all four. `requireStaff()` reads `getUser()` BEFORE it asks about a
 *               grant, so there is no session for a forged role to attach to. Recorded because
 *               it says something real about the order of those two lines rather than nothing.
 *   s4  tests/rls/cases.mjs, `staffTeamProbe`: narrow the select to `user_id` alone
 *         NOT RUN, and stated rather than left implied. The three write controls each move a
 *         row's EXISTENCE (`grantStaffAccess`, `revokeStaffAccess`) or its `role`
 *         (`setStaffRole`), and a `user_id`-only projection would still see two of the three —
 *         so this projection is future-proofing plus the `granted_by` assertion s2 exercised,
 *         not the live tripwire that `mainSegmentsProbe`'s is (see g12 in the GATHERING_CASES
 *         header, where the same mutation WAS run and did trip).
 * ═══════════════════════════════════════════════════════════════════════════════════════ */

/**
 * The staff team back to what the fixture seeded: the spare an 'engineer', and the grantee
 * holding nothing.
 *
 * IDEMPOTENT, because `setup` runs TWICE per case — once before the attack and once before the
 * control — and delete-then-upsert is what makes the two halves start from the same world. Both
 * statements are needed: `revokeStaffAccess`'s control DELETES the spare row and
 * `grantStaffAccess`'s control CREATES the grantee's, so each has to be undone for the other's
 * halves to mean anything.
 *
 * IT DELIBERATELY DOES NOT TOUCH `staffOwner` OR `staffSupport`. Those two are ACTORS — the
 * control and the crux attacker — and a reset that rewrote an actor's own row would be a fixture
 * repairing the thing under test. Neither is reachable by any of these controls anyway: rule 4
 * refuses a caller changing their own row, and no case names the support row.
 */
const resetStaffTeam = async (db, fx) => {
  must(await db.from('genorra_staff').delete().eq('user_id', fx.users.staffGrantee.userId))
  must(await db.from('genorra_staff').upsert({
    user_id: fx.users.staffSpare.userId,
    role: 'engineer',
    note: 'seeded by the RLS harness as engineer',
    granted_by: fx.users.staffOwner.userId,
  }))
}

/**
 * All four staff rows the fixture knows about, whether or not they exist.
 *
 * ONE PROBE FOR ALL THREE WRITES, and wider than any single case needs, deliberately: the
 * mutation this most has to catch is a write that lands on a row the case was not aiming at —
 * `grantStaffAccess` upserting over an existing member (it is an INSERT precisely so it cannot),
 * or a `setStaffRole` whose predicate was dropped and which therefore moved every row. A probe
 * scoped to one `user_id` would call that "unchanged".
 *
 * `role`, `note` AND `granted_by` are all projected because `grantStaffAccess` writes all three,
 * and the last is the one worth having: it is the acting owner's id taken from the verified
 * session and NEVER from a parameter, so a change that started trusting an input would show up
 * here as the wrong uuid rather than as nothing at all.
 */
const staffTeamProbe = async (db, fx) => {
  const ids = ['staffOwner', 'staffSupport', 'staffSpare', 'staffGrantee']
    .map(k => fx.users[k].userId)
  const { data, error } = await db
    .from('genorra_staff')
    .select('user_id, role, note, granted_by')
    .in('user_id', ids)
    .order('user_id')
  if (error) throw new Error(`probe genorra_staff: ${error.message}`)
  return JSON.stringify(data)
}

/** The reason a grant records, in words — rule 3 refuses an empty one. */
const STAFF_GRANT_NOTE = 'scope-case grant from the RLS harness'

/**
 * One case per exported action. The attacker is the default `bravoAdmin`; the other four are
 * derived below.
 */
const STAFF_BASE_CASES = [
  {
    kind: 'read',
    id: 'staff/access.listStaffTeam (a family administrator)',
    mod: 'app/actions/staff/access.ts', fn: 'listStaffTeam',
    args: () => [],
    // See the header: the runner consults this only when the call RETURNED, so this says
    // "returning at all is the failure". A `[]` would otherwise pass for the wrong reason,
    // because no marker in this file can appear in a staff row.
    expectAttack: () => false,
    positiveActor: 'staffOwner',
    expectPositive: (r, fx) => {
      if (!Array.isArray(r)) return false
      const me = r.find(t => t.userId === fx.users.staffOwner.userId)
      const support = r.find(t => t.userId === fx.users.staffSupport.userId)
      return !!me && !!support
        // The acting owner's own row, flagged as theirs — rules 4 and 5 both key on `isSelf`,
        // and the screen renders that row's controls disabled with the reason.
        && me.isSelf === true && me.role === 'owner'
        // The address comes from GoTrue through the admin API and is NOT a column on
        // `genorra_staff` — the interface says the table must never gain one, because an
        // address is GoTrue's fact and a copy would be wrong the first time somebody changed
        // theirs. Asserting it is what proves that lookup ran rather than quietly failing to
        // `''`, which the row would still be listed under.
        && me.email === 'staff.owner@rls.test'
        // Rule 3's audit record survived the round trip.
        && typeof me.note === 'string' && me.note.length > 0
        // NULL for the owner because the fixture grants it to nobody — the bootstrap shape, a
        // row `grant_staff.sql` wrote before this screen existed — and RESOLVED for the support
        // row, whose `granted_by` is the owner. Both branches, because null means three
        // different things there and the screen must not claim to know which.
        && me.grantedByEmail === null
        && support.grantedByEmail === 'staff.owner@rls.test'
        && support.isSelf === false
    },
  },
  {
    kind: 'write',
    id: 'staff/access.grantStaffAccess (a family administrator)',
    mod: 'app/actions/staff/access.ts', fn: 'grantStaffAccess',
    // AN EMAIL AND NEVER A `user_id`, which is rule 2 and is the reason this case cannot be
    // written the obvious way: there is no id parameter to hand across a boundary. What an
    // attacker supplies is an address, which the action resolves against GoTrue and compares
    // EXACTLY — the `filter` it uses is a substring match, so the comparison is the identity
    // resolution and the filter is only there to keep it to one request.
    //
    // `staffGrantee` is a real account with no staff row, so the control creates one; an
    // address with no account would be refused for a reason that has nothing to do with the
    // gate, and an address that already had a row would be refused as a duplicate.
    args: fx => [{
      email: fx.users.staffGrantee.email,
      role: 'support',
      note: STAFF_GRANT_NOTE,
    }],
    setup: resetStaffTeam,
    probe: staffTeamProbe,
    positiveActor: 'staffOwner',
  },
  {
    kind: 'write',
    id: 'staff/access.setStaffRole (a family administrator)',
    mod: 'app/actions/staff/access.ts', fn: 'setStaffRole',
    // THE SPARE ROW, AND NOT AN ACTOR'S. `staffSpare` exists for `deletableChild`'s reason:
    // this control really does change a role, and pointing it at `staffOwner` would be refused
    // by rule 4 (nobody changes their own row) AND by rule 5 (the last owner cannot be
    // demoted), while pointing it at `staffSupport` would move the crux attacker's own grant
    // out from under every other case in this block.
    //
    // 'engineer' -> 'support' rather than anything -> 'owner': a second owner would make rule
    // 5 untestable for every case ordered after this one, and this suite asserts nothing about
    // that rule — see UNCOVERED.
    args: fx => [{ userId: fx.users.staffSpare.userId, role: 'support' }],
    setup: resetStaffTeam,
    probe: staffTeamProbe,
    positiveActor: 'staffOwner',
  },
  {
    kind: 'write',
    id: 'staff/access.revokeStaffAccess (a family administrator)',
    mod: 'app/actions/staff/access.ts', fn: 'revokeStaffAccess',
    // The spare again, for the reason above, and it must not be an owner: rule 5 refuses
    // removing the last one, and the fixture seeds exactly one deliberately.
    args: fx => [{ userId: fx.users.staffSpare.userId }],
    setup: resetStaffTeam,
    probe: staffTeamProbe,
    positiveActor: 'staffOwner',
  },
]

/**
 * The four kinds of caller that must be refused, beside the default `bravoAdmin` — see the
 * header for what each one is evidence for. Derived rather than typed out, for
 * `GATHERING_PENDING_CASES`' reason: twenty cases differing in one field, written by hand, are
 * twenty chances for a `setup` fixed in one and not the others to make a whole row of them
 * vacuous.
 */
const STAFF_ATTACKERS = [
  ['alphaAdmin', "the other family's administrator"],
  ['alphaPending', 'an unadmitted applicant'],
  ['staffSupport', 'a support staffer'],
  ['anon', 'a signed-out caller'],
]

export const STAFF_CASES = STAFF_BASE_CASES.flatMap(c => [
  c,
  ...STAFF_ATTACKERS.map(([attacker, label]) => ({
    ...c,
    id: `${c.id.replace(/\s*\([^()]*\)$/, '')} (${label})`,
    attacker,
  })),
])

// Order is load-bearing, and only here: APPROVAL_CASES decides two memberships and
// leaves a third behind, so it runs after everything that reads the fixture.
// SWEEP_CASES before APPROVAL_CASES for the same reason APPROVAL_CASES is last: those
// decide two memberships and leave a third behind, and every sweep case depends on
// `alphaPending` still being pending.
// REMOVAL_CASES sits between them and touches nothing either of them reads — its
// destructive control is aimed at CHARLIE, a family nothing else in this file mentions,
// which is exactly why that family exists.
// MONEY_CASES IS AFTER APPROVAL_CASES, which is a second place order matters and a different
// reason: nothing it reads is touched by the approvals (its actors are alphaAdmin, alphaMember
// and bravoAdmin, and APPROVAL_CASES decides `applicant`, `rejectable` and `spare`), while a
// MUTATION of the money guard makes one of its attack halves delete `f.fund` or `f.event` and
// take a large part of the fixture with it. Last means a deliberate mutation reports one
// finding instead of a cascade.
// GATHERING_CASES IS LAST, and for MONEY_CASES' reason rather than a new one. Nothing in it
// is read by an earlier block, while its own controls delete ALPHA's spare gathering, repoint
// the main gathering's fund, move a task off 'submitted' and move another off 'approved' — so
// running it at the end means a deliberate mutation of this feature reports one finding instead
// of a cascade. It is also
// after APPROVAL_CASES, which disables `alphaSpare`: `getGatheringAssignableMembers` lists
// only approved people, and its control asserts on `ownerPersonId` rather than on a count for
// exactly that reason.
// ELECTION_RAW_CASES IS BEFORE APPROVAL_CASES, for that block's own reason applied to a
// different actor: its attacker is `alphaSpare`, and APPROVAL_CASES DISABLES that member. A
// disabled caller resolves no person id, so every probe there would answer empty and every
// attack half would go green while asserting nothing about the area rule. Its own header
// carries the argument.
// STAFF_CASES IS AFTER ALL OF IT, AND ITS POSITION IS THE ONE IN THIS LIST THAT DOES NOT
// MATTER — said out loud so nobody looks for the reason. `genorra_staff` is read by nothing else
// in this file and has no `family_code` to be swept or scoped, its four accounts have no `people`
// row for any other case to find, and its own controls touch only the spare and grantee rows the
// fixture seeds for them. It sits last because that is where a block nothing depends on belongs.
/**
 * THE TWO ACTIONS BEHIND **EDIT PROFILE** ON MEMBERS & ACCESS, added 2026-08-20.
 *
 * `updateUserProfile` has had a case since Phase 3 and had no CALLER until today — TODO.md
 * carried the choice between deleting the endpoint and giving it a screen, and it now has one:
 * the member detail dialog's Edit profile button. Two new actions came with it and both are
 * exactly the shape AGENTS.md §3 is about — service-role reads with the family conjunct
 * written by hand, so there is no policy underneath either of them.
 *
 * ── WHY THE ATTACK IS THE INTERESTING HALF HERE ─────────────────────────────────────
 * Both take a `people.id` straight from the client. Drop the `.eq('family_code', …)` from
 * either and BRAVO's administrator reads ALPHA's date of birth, street address and gender out
 * of the first, or mails a password-reset link to an ALPHA member out of the second. Neither
 * would fail, log, or look wrong from BRAVO: the id is valid, the row exists, and the service
 * role does not care whose family it is in.
 *
 * MUTATION-CHECKED 2026-08-20 by removing that conjunct from each action in turn. The read
 * leaks on the marker scan; the send is caught by `expectAttack`, which is why that one is
 * spelled out rather than left to the default.
 */
const PROFILE_EDIT_CASES = [
  // The READ. Default marker scan for the attack — the projection carries the person's names,
  // so an ALPHA row coming back to BRAVO is caught by `alphaMarkers` without a custom
  // assertion. The control is pinned to `alphaAdmin` because the gate is
  // `admin/members:edit` at `canAny`, which the General template does not grant: run as
  // `alphaMember` this would answer 'Not authorized' and the case would be asserting that
  // nobody can call it, which is perfect isolation and no evidence at all.
  read('admin/users.getMemberProfileForEdit', 'app/actions/admin/users.ts', 'getMemberProfileForEdit', {
    args: fx => [fx.users.alphaOther.personId],
    positiveActor: 'alphaAdmin',
    expectPositive: v => v?.success === true
      && v.profile?.peopleId != null
      // The two things the dialog decides its own shape from. Asserted so a projection that
      // silently stopped selecting them — which would render an editable email field and hide
      // the password offer from a real account — turns this red.
      && typeof v.profile?.hasAccount === 'boolean'
      && typeof v.profile?.emailIsPlaceholder === 'boolean'
      // `primary_email` is READ here (the field is shown, disabled) and must never be
      // writable. That half is asserted by updateUserProfile's own cases.
      && v.profile?.fields != null
      && !('primary_email' in v.profile.fields),
  }),

  // The SEND. `kind: 'read'` because there is no row to probe — the observable is what the
  // action ANSWERS, and a mail either was or was not requested of GoTrue. `expectAttack` is
  // spelled out for the same reason: a refusal here is `{ success: false }`, which carries no
  // ALPHA marker, so the default scan would pass against an action that had just mailed
  // somebody in another family.
  read('admin/users.sendMemberPasswordReset', 'app/actions/admin/users.ts', 'sendMemberPasswordReset', {
    args: fx => [fx.users.alphaOther.personId],
    expectAttack: v => v?.success === false,
    positiveActor: 'alphaAdmin',
    // This really does send a recovery mail on the local stack, which Mailpit catches. That is
    // the point: the control is what proves the family conjunct above did not simply refuse
    // everybody, and the only way to prove a send is to send one.
    //
    // ── ONE CASCADE TO EXPECT WHEN YOU MUTATE THIS, so it is not read as a second bug ──
    // GoTrue enforces `[auth.rate_limit] max_frequency` PER ADDRESS — 1s locally — and both
    // halves of this case aim at the same member. So a mutation that lets the ATTACK send
    // consumes that window and the control then fails too, with GoTrue's own "you can only
    // request this after 0 seconds". Measured: removing the family conjunct reports the leak
    // AND a failed control, and the second one is a consequence of the first rather than a
    // fixture problem. Unmutated the attack never sends, so the window is free.
    expectPositive: v => v?.success === true && typeof v.message === 'string',
  }),

  // ── AND THE ACCOUNT-LESS RELATIVE, WHICH IS A PRODUCT RULE RATHER THAN A BOUNDARY ──
  // `fx.alpha.child` is a `people` row with no `user_id` — §4b's recorded relative. There is
  // no password to reset and its `primary_email` is a generated placeholder, so mailing it can
  // only ever hard-bounce, and a bounce is charged to our sending domain's reputation.
  //
  // The attacker is ALPHA'S OWN ADMINISTRATOR, which is unusual in this file and deliberate:
  // the caller is fully entitled and the refusal is about the RECORD, not about them. Filed as
  // an attack because the assertion is the same shape — this call must not do the thing.
  read('admin/users.sendMemberPasswordReset (a relative with no account)',
    'app/actions/admin/users.ts', 'sendMemberPasswordReset', {
      args: fx => [fx.alpha.child.id],
      attacker: 'alphaAdmin',
      expectAttack: v => v?.success === false && /no account yet/i.test(v?.error ?? ''),
      positive: 'not-applicable',
      why: 'the entitled send is asserted by the case above; this row has nobody to send to by construction',
    }),
]

/**
 * SUPABASE STORAGE — the second access-control system, covered from 2026-08-20.
 *
 * `UNCOVERED` at the foot of this file named the four upload actions from Phase 3 until
 * today, with the right reason: bucket policies live on `storage.objects` and are a
 * SEPARATE system from the composed policies this suite was built for. Nothing in
 * `20260618000001`'s sweep touches them, `audit:family-scope` does not look at them, and
 * §2c's whole argument about `public` tables says nothing about a bucket. So the suite was
 * silent on whether one family could read or overwrite another's files.
 *
 * ── WHAT THE FIRST RUN FOUND, so nobody reads these as ceremonial ───────────────────
 * Three real holes, each measured against the local stack and all three closed by
 * `20260820000006`:
 *
 *   * `photos` INSERT was `bucket_id = 'photos'` and nothing else — any signed-in user, ANY
 *     path. BRAVO's administrator wrote an object into `ALPHATEST/<alpha collection>/` and
 *     got a 200, in a bucket that is `public: true` and therefore served by URL.
 *   * `photos` DELETE was the right pattern aimed at the wrong layout —
 *     `auth.uid()::text = (storage.foldername(name))[1]` against paths that start with a
 *     FAMILY CODE. It matched nothing for anybody, so every photograph a family had
 *     "deleted" was still in a public bucket. Storage reports a refused `remove()` as
 *     **200 with an empty array**, which is why nothing had ever noticed.
 *   * `documents` was `auth.uid() IS NOT NULL` on all four commands, on a PRIVATE bucket.
 *     BRAVO downloaded ALPHA's document, listed ALPHA's filenames, and DELETED an ALPHA
 *     document. A pending applicant could upload.
 *
 * ── WHY HALF OF THESE ARE PROBES AND NOT ACTIONS ────────────────────────────────────
 * `uploadAvatar` computes its path from `auth.uid()` and never from a parameter, so it
 * CANNOT express the attack that matters — an object aimed at another user's folder. That
 * is a good property of the action, and it means the policy underneath is unreachable from
 * an action-shaped test: the same structural blind spot `raw.mjs` was written for. So the
 * cases below call the ACTION for the ordinary path and `raw/storage.mjs` for the attack.
 *
 * ── THE ASSERTION IS NEVER `error === null` ─────────────────────────────────────────
 * Storage's failure modes are not uniform. An RLS refusal on an INSERT is a 403 with "new
 * row violates row-level security policy"; a refused SELECT of a private object is a **404
 * NoSuchKey**, because a policy that admits no row is indistinguishable from a missing one;
 * a refused `list()` is `[]`; and a refused `remove()` is a **200 with an empty array**. So
 * the probes return counts and names, and these cases assert on those.
 *
 * ── AND THE PROBE GOES THROUGH THE STORAGE API, NOT THROUGH POSTGREST ───────────────
 * The first version of this block probed `db.schema('storage').from('objects')` and every
 * one of its probes silently answered `[]`: **PostgREST exposes `public` and
 * `graphql_public`, and not `storage`**. The attack halves still passed — `[]` before and
 * `[]` after is "row untouched" — so four cases were reporting perfect isolation over a
 * probe that could not see a single object.
 *
 * It was the POSITIVE CONTROLS that caught it, all four at once, with "owner's own write did
 * nothing". That is AGENTS.md §7's argument for the control half in one line, and it is the
 * second time in this file's history that the control found what the attack could not.
 * `objectsIn()` below uses the service-role client's own Storage API, which bypasses RLS the
 * way the service role does everywhere else and can actually see the bucket.
 */

/**
 * Every object name directly inside one bucket folder, as the SERVICE ROLE.
 *
 * `list()` is one level deep and returns folder entries as well as files, so a case must
 * point this at the IMMEDIATE parent of the object it cares about — pointed at `ALPHATEST`
 * when the object is at `ALPHATEST/probe/x.jpg` it reports the folder `probe` and would not
 * change when the file inside it did.
 */
const objectsIn = (bucket, dir) => async db => {
  const { data, error } = await db.storage.from(bucket).list(dir)
  if (error) return `LIST FAILED: ${error.message}`
  return JSON.stringify((data ?? []).map(o => o.name).sort())
}

/**
 * Put a real object there as the service role, so a case has something to reach for.
 *
 * THE MIME TYPE IS DERIVED FROM THE EXTENSION, and it has to be: `photos`, `avatars` and
 * `event-photos` all carry an `allowed_mime_types` list of images (20260609000000,
 * 20260610000001), so seeding a `.jpg` as `application/pdf` is refused by the BUCKET before
 * any policy is consulted — measured, and it failed this way on the first run. That refusal
 * is thrown rather than swallowed: a case whose setup quietly planted nothing would assert
 * against an absent object and pass.
 */
const seedObject = (bucket, path) => async db => {
  const type = /\.pdf$/.test(path) ? 'application/pdf' : 'image/jpeg'
  await db.storage.from(bucket).remove([path])
  const { error } = await db.storage.from(bucket)
    .upload(path, new Blob([new Uint8Array([7, 7, 7, 7])], { type }), { upsert: true })
  if (error) throw new Error(`setup: could not seed ${bucket}/${path}: ${error.message}`)
}

const STORAGE_CASES = [
  // ── avatars: the fix 20260820000002 shipped, now with a test under it ─────
  //
  // That migration verified itself with a plpgsql probe, which is the right thing for a
  // migration and is a point-in-time assertion. This is the standing one, and it runs as a
  // real signed-in user through the real Storage API rather than as `SET LOCAL role`.
  {
    kind: 'write',
    id: 'storage.avatars (writing into another user\'s folder)',
    mod: 'tests/rls/raw/storage.mjs', fn: 'uploadTo',
    args: fx => ['avatars', `${fx.users.alphaMember.userId}/avatar.jpg`, 'bravo-was-here'],
    setup: (db, fx) => db.storage.from('avatars')
      .remove([`${fx.users.alphaMember.userId}/avatar.jpg`]),
    probe: (db, fx) => objectsIn('avatars', fx.users.alphaMember.userId)(db),
    expectRefusal: v => /row-level security/i.test(v?.error?.message ?? '')
      ? { ok: true, detail: 'refused by the folder policy' }
      : { ok: false, detail: `expected an RLS refusal, got ${JSON.stringify(v)}` },
    // The owner writing their OWN folder. Without this the assertion above would pass
    // against a bucket that refused everybody, which is what a broken policy looks like —
    // and it is exactly how the old `photos` DELETE policy was wrong.
    positiveActor: 'alphaMember',
  },
  // RENAMING INTO SOMEBODY ELSE'S FOLDER — the `WITH CHECK` half of the UPDATE policy, and
  // the only assertion in this file with no call site anywhere in the app. Nothing moves an
  // object, so this policy half exists purely to stop the overwrite hole arriving by a
  // second route, and it would otherwise rot unnoticed.
  //
  // ONE PROBE FUNCTION DOES BOTH HALVES (`moveOwnInto`), because the attacker needs an
  // object of their own to move and `setup` runs with no actor. Uploading it as the service
  // role would leave `owner` NULL, and then a refusal could be the source being unreachable
  // rather than the destination being forbidden — the case would pass for the wrong reason.
  {
    kind: 'write',
    id: 'storage.avatars (renaming an object into another user\'s folder)',
    mod: 'tests/rls/raw/storage.mjs', fn: 'moveOwnInto',
    attacker: 'bravoAdmin',
    args: fx => ['avatars',
      `${fx.users.bravoAdmin.userId}/avatar.jpg`,
      `${fx.users.alphaMember.userId}/avatar.jpg`],
    setup: (db, fx) => db.storage.from('avatars')
      .remove([`${fx.users.alphaMember.userId}/avatar.jpg`]),
    probe: (db, fx) => objectsIn('avatars', fx.users.alphaMember.userId)(db),
    // BOTH halves are asserted. `uploaded` proves the attacker really had an object of their
    // own — without it a missing source would look like a working policy.
    expectRefusal: v => v?.uploaded && v?.moveError != null
      ? { ok: true, detail: 'the move was refused' }
      : { ok: false, detail: `expected upload-then-refused-move, got ${JSON.stringify(v)}` },
    positive: 'not-applicable',
    why: 'nothing in the app moves an object, so there is no entitled caller to contrast with — the upload case above is what proves the bucket is not simply refusing everybody',
  },

  // ── photos: the two holes 20260820000006 closed ──────────────────────────
  //
  // THE CONTROL WRITES INTO THE SAME FOLDER AS THE ATTACK, deliberately. Pointed at a
  // different folder the probe would not change when the rightful uploader succeeded, and
  // the runner reports that as a vacuous case — which is how the first draft of this block
  // was caught.
  {
    kind: 'write',
    id: 'storage.photos (writing into another family\'s folder)',
    mod: 'tests/rls/raw/storage.mjs', fn: 'uploadTo',
    args: fx => ['photos', `${fx.alpha.familyCode}/${fx.alpha.collection.id}/pwned.jpg`, 'x'],
    setup: (db, fx) => db.storage.from('photos').remove([
      `${fx.alpha.familyCode}/${fx.alpha.collection.id}/pwned.jpg`,
      `${fx.alpha.familyCode}/${fx.alpha.collection.id}/mine.jpg`,
    ]),
    probe: (db, fx) =>
      objectsIn('photos', `${fx.alpha.familyCode}/${fx.alpha.collection.id}`)(db),
    expectRefusal: v => /row-level security/i.test(v?.error?.message ?? '')
      ? { ok: true, detail: 'refused by the family-folder policy' }
      : { ok: false, detail: `expected an RLS refusal, got ${JSON.stringify(v)}` },
    // This is the half that would have caught a family-folder policy written against
    // `auth.uid()` — which is exactly the bug the old DELETE policy had — because such a
    // policy refuses the rightful uploader too.
    positiveActor: 'alphaMember',
    positiveArgs: fx => ['photos',
      `${fx.alpha.familyCode}/${fx.alpha.collection.id}/mine.jpg`, 'mine'],
  },
  // THE DELETE THAT COULD NEVER MATCH. The attack half is ordinary cross-family isolation;
  // the CONTROL is the interesting one, because "the rightful uploader can remove their own
  // object" was FALSE for the entire life of this bucket and left every deleted photograph
  // public. A refused `remove()` is a 200 with an empty array, so the count is the
  // assertion and `error === null` proves nothing at all.
  {
    kind: 'write',
    id: 'storage.photos (another family cannot delete the object)',
    mod: 'tests/rls/raw/storage.mjs', fn: 'removeFrom',
    setup: (db, fx) => seedObject('photos', `${fx.alpha.familyCode}/probe/deletable.jpg`)(db),
    args: fx => ['photos', [`${fx.alpha.familyCode}/probe/deletable.jpg`]],
    probe: (db, fx) => objectsIn('photos', `${fx.alpha.familyCode}/probe`)(db),
    expectRefusal: v => v?.removed === 0
      ? { ok: true, detail: 'nothing removed' }
      : { ok: false, detail: `another family removed ${v?.removed} object(s)` },
    positiveActor: 'alphaMember',
  },

  // ── documents: a PRIVATE bucket, where read is the boundary ──────────────
  //
  // A read case rather than a write one, because the finding was a DOWNLOAD. The refusal
  // arrives as a 404 `NoSuchKey` rather than a 403 — a policy that admits no row is
  // indistinguishable from a missing object, which is the right answer for a private bucket
  // and is why this asserts on the byte count rather than on a message.
  read('storage.documents (downloading another family\'s file)',
    'tests/rls/raw/storage.mjs', 'downloadFrom', {
      args: fx => ['documents', `${fx.alpha.familyCode}/probe.pdf`],
      setup: (db, fx) => seedObject('documents', `${fx.alpha.familyCode}/probe.pdf`)(db),
      expectAttack: v => v?.bytes === 0,
      positiveActor: 'alphaMember',
      expectPositive: v => v?.bytes > 0,
    }),
  // LISTING, which is the smaller leak a download case cannot ask about: whether one family
  // can discover WHAT another has uploaded. `list()` is a SELECT under the covers and a
  // refused one is `[]`, so the count is the assertion.
  read('storage.documents (listing another family\'s files)',
    'tests/rls/raw/storage.mjs', 'listIn', {
      args: fx => ['documents', fx.alpha.familyCode],
      setup: (db, fx) => seedObject('documents', `${fx.alpha.familyCode}/listable.pdf`)(db),
      expectAttack: v => v?.count === 0,
      positiveActor: 'alphaMember',
      expectPositive: v => v?.count > 0,
    }),
  // A PENDING APPLICANT MAY NOT FILE ANYTHING INTO THE FAMILY'S STORAGE.
  // `auth_family_code()` resolves ALPHATEST for them deliberately and permanently, so the
  // family conjunct alone would admit them — this is evidence for the
  // `auth_membership_approved()` half, the same conjunct 20260806000011 §6 swept into the
  // `public` tables.
  {
    kind: 'write',
    id: 'storage.documents (a pending applicant uploading)',
    mod: 'tests/rls/raw/storage.mjs', fn: 'uploadTo',
    attacker: 'alphaPending',
    args: fx => ['documents', `${fx.alpha.familyCode}/pending.pdf`, 'x'],
    setup: (db, fx) => db.storage.from('documents').remove([
      `${fx.alpha.familyCode}/pending.pdf`, `${fx.alpha.familyCode}/approved.pdf`,
    ]),
    probe: (db, fx) => objectsIn('documents', fx.alpha.familyCode)(db),
    expectRefusal: v => /row-level security/i.test(v?.error?.message ?? '')
      ? { ok: true, detail: 'refused — not an approved member' }
      : { ok: false, detail: `an applicant uploaded: ${JSON.stringify(v)}` },
    positiveActor: 'alphaMember',
    positiveArgs: fx => ['documents', `${fx.alpha.familyCode}/approved.pdf`, 'x'],
  },

  // ── event-photos: GONE, and the assertion is that it stays gone ──────────
  //
  // The bucket was created by 20260609000000 for a feature 20260819000006 retired. It was
  // frozen by 20260820000006 (all three write policies dropped, nothing put back) and
  // DELETED outright by 20260820000008 — bucket row, object rows and read policy — after
  // `scripts/drop-retired-bucket.mjs` removed the bytes through the Storage API, which is
  // the only thing that can reach them.
  //
  // ── THE ASSERTION CHANGED SHAPE WITH IT, AND THAT IS THE POINT ────────────
  // While the bucket existed, this case asserted an RLS refusal: "new row violates
  // row-level security policy", because no INSERT policy admitted anybody. Now there is no
  // bucket, so Storage answers `Bucket not found` instead — a DIFFERENT refusal, from a
  // different layer, and one that cannot be undone by restoring a policy.
  //
  // Asserting on the bucket's ABSENCE rather than on a policy's refusal is strictly
  // stronger: the old assertion would have gone green again the moment somebody re-created
  // the bucket without policies, which is a perfectly plausible "let me just check
  // something" that leaves a public bucket behind. This one only goes green while the
  // bucket does not exist. `20260609000000` still creates it on every fresh database, so
  // there IS a migration racing this every reset — which is exactly why the assertion is
  // worth keeping rather than deleting along with the feature.
  {
    kind: 'write',
    id: 'storage.event-photos (the bucket does not exist)',
    mod: 'tests/rls/raw/storage.mjs', fn: 'uploadTo',
    attacker: 'alphaAdmin',
    args: fx => ['event-photos', `${fx.alpha.familyCode}/orphan.jpg`, 'x'],
    // Nothing to probe in the bucket, so the probe watches the BUCKET LIST — which is also
    // what catches the case this is really guarding against: the bucket coming back.
    probe: async db => {
      const { data } = await db.storage.listBuckets()
      return JSON.stringify((data ?? []).map(b => b.id).sort())
    },
    expectRefusal: v => /bucket not found/i.test(v?.error?.message ?? '')
      ? { ok: true, detail: 'no such bucket' }
      : { ok: false, detail: `expected 'Bucket not found', got ${JSON.stringify(v)}` },
    positive: 'not-applicable',
    why: 'there is no bucket and no feature — the three live buckets are covered by the cases above',
  },

  // ── AND THE ACTIONS THEMSELVES, which is what UNCOVERED actually named ───
  {
    kind: 'write',
    id: 'personal-info.uploadAvatar',
    mod: 'app/actions/personal-info.ts', fn: 'uploadAvatar',
    args: () => [avatarForm()],
    setup: (db, fx) => db.storage.from('avatars')
      .remove([`${fx.users.alphaMember.userId}/avatar.jpg`,
        `${fx.users.alphaMember.userId}/avatar.png`,
        `${fx.users.alphaMember.userId}/avatar.webp`]),
    // WHOSE FOLDER IS WATCHED IS THE WHOLE CASE. The action writes to a path derived from
    // `auth.uid()` and takes no id at all, so BRAVO uploading can only ever touch BRAVO.
    // Pointed at BRAVO's folder this would pass while testing nothing — the vacuous probe
    // AGENTS.md §7 warns about — so it watches ALPHA's folder and asserts a BRAVO upload
    // cannot land there.
    probe: (db, fx) => objectsIn('avatars', fx.users.alphaMember.userId)(db),
    positiveActor: 'alphaMember',
  },
  {
    kind: 'write',
    id: 'documents.uploadDocument',
    mod: 'app/actions/documents.ts', fn: 'uploadDocument',
    args: () => [documentForm()],
    // The ROW, not the object: `uploadDocument` writes both, and a `documents` row carrying
    // ALPHA's family_code is what a cross-family write looks like from the app's side.
    probe: (db, fx) => snapshot('documents', 'id, name, family_code',
      { family_code: fx.alpha.familyCode })(db),
    positiveActor: 'alphaAdmin',
  },
  // `uploadPhoto` TAKES A COLLECTION ID FROM THE CLIENT, which makes it the one upload with
  // a §4 shape — and it had no `belongsToFamily` until 2026-08-20. The row it writes carries
  // the CALLER's family_code, so every policy on `photos` is satisfied while `collection_id`
  // points into ALPHA's album: a cross-family reference nothing in the database was asked
  // about, and nothing in the product would ever report, because the reading side scopes by
  // family and renders a gap where an image should be.
  {
    kind: 'write',
    id: 'photos.uploadPhoto (a collection from another family)',
    mod: 'app/actions/photos.ts', fn: 'uploadPhoto',
    args: fx => [fx.alpha.collection.id, photoForm()],
    probe: (db, fx) => snapshot('photos', 'id, collection_id, family_code',
      { collection_id: fx.alpha.collection.id })(db),
    positiveActor: 'alphaAdmin',
  },
]

// ── FormData builders for the upload actions ────────────────────────────────
// Functions rather than constants: a `File` body is consumed by the upload and `args` is
// called once per phase, so a shared instance would make the positive control upload
// nothing. `File` and `FormData` are Node globals, so nothing here is stubbed.
function avatarForm() {
  const fd = new FormData()
  fd.append('file', new File([new Uint8Array([1, 2, 3, 4])], 'a.jpg', { type: 'image/jpeg' }))
  return fd
}
function documentForm() {
  const fd = new FormData()
  fd.append('file', new File([new Uint8Array([1, 2, 3, 4])], 'd.pdf', { type: 'application/pdf' }))
  fd.append('name', 'RLS probe document')
  fd.append('category', 'other')
  return fd
}
function gatheringPhotoForm(gatheringId) {
  const fd = new FormData()
  fd.append('gatheringId', gatheringId)
  fd.append('file', new File([new Uint8Array([1, 2, 3, 4])], 'g.jpg', { type: 'image/jpeg' }))
  return fd
}
function photoForm() {
  const fd = new FormData()
  fd.append('file', new File([new Uint8Array([1, 2, 3, 4])], 'p.jpg', { type: 'image/jpeg' }))
  fd.append('caption', 'RLS probe photo')
  return fd
}

/**
 * THE ELECTION POLICIES, REACHED WITHOUT AN ACTION — and the reason they need to be.
 *
 * `20260821000001` narrowed all four election tables with `auth_may_see_election()`, and the
 * action-shaped cases up above cannot test it: `lib/election-area.ts` filters in the app too,
 * so both layers refuse and the case cannot say which one did. That is not a hypothesis. Every
 * one of the four policies was neutered — the conjunct replaced by `true` — and the suite
 * reported 649/649 with no case moving.
 *
 * These call PostgREST directly, so the POLICY is the only thing that can refuse them, exactly
 * as `SWEEP_CASES` does for the policies `lib/notifications.ts` keeps off the URL space.
 *
 * ── CHECKED BY MUTATION, per AGENTS.md §7 ──────────────────────────────────────────
 * Run each of these against the mutated database and the clean one. The mutation:
 *
 *   docker exec supabase_db_GENORRA psql -U postgres -d postgres -c "
 *     DO \$\$ DECLARE r record; BEGIN
 *       FOR r IN SELECT policyname, qual FROM pg_policies
 *                 WHERE schemaname='public' AND tablename='elections' AND cmd='SELECT'
 *       LOOP EXECUTE format('ALTER POLICY %I ON public.elections USING (%s)', r.policyname,
 *         replace(r.qual, 'auth_may_see_election(scope, region_id, chapter_id)', 'true'));
 *       END LOOP; END \$\$;"
 *
 * and `npm run db reset` puts it back. Observed:
 *
 *   the area conjunct -> true       `raw:elections SELECT (a chapter they are not in)` FAILS
 *   admin/elections -> community/elections
 *     in the votes policy           `raw:election_votes SELECT (another member's ballot)` FAILS
 *
 * ── THE ATTACKER IS IN THE FAMILY, WHICH IS THE POINT ──────────────────────────────
 * `alphaSpare` is in NO CHAPTER — under National — and `alphaOther` is in `f.chapter`. Same
 * family, same template, same approval; they differ in where they are filed and in nothing
 * else. So whatever the attacker still reads, they read because the area rule failed rather
 * than because a grant was missing.
 *
 * IT IS `alphaSpare` AND NOT `alphaMember`, and these probes are how that was learned. The
 * first draft used `alphaMember` and failed — correctly — because
 * `personal-info.saveChapterAndPropagate`'s positive control puts that actor INTO `f.chapter`
 * and leaves them there. The `members.getMembers` case had already recorded the hazard and
 * named this fix; what is new is that the action-level cases above PASSED with the same wrong
 * actor, because they sit earlier in the array than the case that moves it. An order-dependent
 * pass is the thing this suite is least able to see.
 *
 * ── SO THIS BLOCK RUNS BEFORE `APPROVAL_CASES` ─────────────────────────────────────
 * That block DISABLES `alphaSpare`, and a disabled member resolves no person id at all — so
 * every probe here would come back empty and every attack half would go green for a reason
 * that has nothing to do with the area rule. `GATHERING_CASES` records the same constraint
 * about the same actor from the other direction.
 */
const ELECTION_RAW_CASES = [
  // [crux] TAKING SOMEBODY ELSE'S NAME OFF A NOMINATION, WITH NO ACTION IN THE WAY.
  //
  // The conjunct this asserts is `person_id = public.auth_person_id()` in
  // `perm:family can retract a nomination`, and it is a CONJUNCT rather than one of the
  // alternatives — so unlike every other write on these four tables, no scope widens it and
  // no grant buys it. Nobody may take another member's name off a nomination that member made.
  //
  // IT HAS TO BE A RAW PROBE, and that is not a preference. `retractNomination` states
  // `.eq('person_id', g.personId)` in its own statement — defence in depth, and deliberate —
  // so an action-shaped case cannot send the offending request at all: it narrows to the
  // caller before PostgREST sees it, and the attack half passes with the policy conjunct
  // DELETED. Measured on the day this was written: conjunct removed, ten retraction
  // assertions still green. This one goes red.
  //
  // THE ATTACKER HOLDS EVERY GRANT IN THEIR OWN FAMILY. `alphaAdmin` has
  // `community/elections:delete` at scope 'any', is approved, and is under National like this
  // election — so every other conjunct in the policy is satisfied for them. That is what makes
  // this a test of the pin rather than of the family boundary.
  //
  // `count` IS THE ASSERTION, not `error`. RLS refusing a DELETE is zero rows and
  // `{ error: null }` (AGENTS.md §8b), so the response's only moving part is the count — and
  // the case's own probe reads the row back through the service role to say so independently.
  {
    kind: 'write',
    id: 'raw:election_nomination_supporters DELETE (somebody else\'s nomination)',
    mod: 'tests/rls/raw/elections.mjs', fn: 'deleteNominationSupport',
    attacker: 'alphaAdmin',
    args: fx => [fx.alpha.retractRaw.nomination.id, fx.alpha.ownerPersonId],
    probe: probeSupporters(fx => [fx.alpha.retractRaw.nomination.id]),
    expectRefusal: v => v?.count === 0
      ? { ok: true, detail: 'PostgREST deleted 0 rows' }
      : { ok: false, detail: `expected count 0, got ${JSON.stringify(v)}` },
    // The control is the NOMINATOR sending the same request for their OWN row — the same
    // probe, the same two arguments' shape, one of them different. Without it this passes for
    // a policy that refuses everybody, which is what the previous draft of the DELETE policy
    // did when its EXISTS named the wrong column.
    positiveActor: 'alphaMember',
    positiveArgs: fx => [fx.alpha.retractRaw.nomination.id, fx.alpha.ownerPersonId],
  },
  // [crux] A CHAPTER'S ELECTION, TO THE REST OF ITS OWN FAMILY. The single assertion this
  // whole feature turns on, and the only one in the suite that exercises the policy.
  read('raw:elections SELECT (a chapter they are not in)',
    'tests/rls/raw/elections.mjs', 'selectElections', {
      attacker: 'alphaSpare',
      expectAttack: (r, fx) => !r.rows.some(e => e.id === fx.alpha.chapterElection.id)
        // AND the national one still comes back, or this passes for a policy that releases
        // nothing to anybody — which is perfectly isolated and perfectly useless.
        && r.rows.some(e => e.id === fx.alpha.election.id),
      positiveActor: 'alphaOther',
      expectPositive: (r, fx) => r.rows.some(e => e.id === fx.alpha.chapterElection.id),
    }),
  // The child table, which reaches its scope through `election_id` and so is narrowed by
  // `auth_may_see_election_id()` rather than by the column form. Worth asserting separately:
  // the two helpers are two functions, and a nomination names a person.
  read('raw:election_nominations SELECT (a chapter they are not in)',
    'tests/rls/raw/elections.mjs', 'selectElectionNominations', {
      attacker: 'alphaSpare',
      setup: async (db, fx) => {
        // A nomination ON the chapter election, so there is something to be refused. Written
        // as the service role, which sees past every policy — the probe is what is being
        // tested, not this. Idempotent: the table is UNIQUE on the triple.
        await db.from('election_nominations').upsert({
          election_id: fx.alpha.chapterElection.id,
          position_id: fx.alpha.chapterPosition.id,
          nominee_id: fx.alpha.otherPersonId,
          accepted: true,
        }, { onConflict: 'election_id,position_id,nominee_id' })
      },
      expectAttack: (r, fx) => !r.rows.some(n => n.election_id === fx.alpha.chapterElection.id)
        // The national election's nomination is still readable, so the probe is not blind.
        && r.rows.some(n => n.election_id === fx.alpha.election.id),
      positiveActor: 'alphaOther',
      expectPositive: (r, fx) => r.rows.some(n => n.election_id === fx.alpha.chapterElection.id),
    }),
  // [crux] THE SECRET BALLOT, AND IT WAS NOT SECRET UNTIL 2026-08-21.
  //
  // `perm:admins can view all votes` was satisfied by `community/elections:view = 'any'`, which
  // every member holds by default because a non-admin resource with no `resource_visibility`
  // row defaults to 'everyone'. So the policy named for administrators admitted the whole
  // family, and any signed-in member could read every vote — who voted, and for whom — off
  // PostgREST. 20260609000007's own comment said "Voters can see their own vote but not
  // others' (secret ballot)"; that had never been true.
  //
  // NO ACTION EXPOSES THIS READ AT ALL. `getElectionResults` tallies on the service role
  // precisely because a count must include votes the reader may not see individually, so this
  // probe is the only possible assertion. The fixture's vote is `owner -> other`, so
  // `alphaOther` — a member with no organizer grant — must not see it.
  read('raw:election_votes SELECT (another member\'s ballot)',
    'tests/rls/raw/elections.mjs', 'selectElectionVotes', {
      attacker: 'alphaOther',
      expectAttack: (r, fx) => !r.rows.some(v => v.id === fx.alpha.vote.id),
      // The ORGANIZER is the positive control, because an organizer is who the policy is now
      // for. A control run as the voter would assert `perm:voters can see own votes`, which is
      // the other policy and was never the defect.
      positiveActor: 'alphaAdmin',
      expectPositive: (r, fx) => r.rows.some(v => v.id === fx.alpha.vote.id),
    }),
  // The other half of the same table: a member DOES still reach their own ballot. Asserted
  // because narrowing the organizer policy could have been done by dropping it, and the two
  // outcomes are indistinguishable from the attack half alone.
  read('raw:election_votes SELECT (their own ballot)',
    'tests/rls/raw/elections.mjs', 'selectElectionVotes', {
      attacker: 'bravoAdmin',
      expectAttack: (r, fx) => !r.rows.some(v => v.id === fx.alpha.vote.id),
      // `alphaMember` IS the voter in the fixture — `f.vote` is owner -> other. Their chapter
      // is moved by an earlier case and it does not matter here: `f.election` is NATIONAL, so
      // the area conjunct is true for everybody and this case is about the vote policy alone.
      positiveActor: 'alphaMember',
      expectPositive: (r, fx) => r.rows.some(v => v.id === fx.alpha.vote.id),
    }),
]

CASES.push(...MORE_CASES, ...PENDING_CASES, ...SWEEP_CASES, ...ELECTION_RAW_CASES,
  ...REMOVAL_CASES, ...APPROVAL_CASES,
  ...MONEY_CASES, ...GATHERING_CASES, ...GATHERING_PENDING_CASES, ...PROFILE_EDIT_CASES,
  ...STORAGE_CASES, ...STAFF_CASES)

/**
 * NOT COVERED, and why — so the gap is a decision rather than an oversight.
 *
 *   THE STORAGE-BACKED UPLOADS — COVERED SINCE 2026-08-20, see STORAGE_CASES above
 *     This entry read: "uploadDocument, uploadPhoto, uploadEventPhoto, uploadAvatar take a
 *     FormData carrying a file and write to Supabase Storage, whose buckets and policies are
 *     a separate access-control system from the RLS policies this suite exercises. Testing
 *     them properly means seeding buckets and asserting on object paths — worth doing, but a
 *     different harness."
 *
 *     Every word of that was true, including the last clause: `tests/rls/raw/storage.mjs` IS
 *     a different harness, in the sense `raw.mjs` is — it speaks the Storage API as the
 *     current actor and substitutes nothing. What the gap cost is the part worth keeping:
 *     three real holes had been open for months and the first run of these cases found all
 *     three (the block header lists them, `20260820000006` closes them). The worst was not a
 *     leak but a REFUSAL — `photos` DELETE could never match any path, so every photograph a
 *     family had "deleted" was still in a public bucket — and no cross-family assertion
 *     could ever have found it. The POSITIVE CONTROL did.
 *
 *     `uploadEventPhoto` is gone rather than covered: 20260819000006 retired Events and
 *     deleted the action. It sat in this list for a day after its own deletion, which is the
 *     smallest possible version of the lesson this whole note is about.
 *
 *     WHAT IS STILL NOT REACHED, so the remaining gap is a decision:
 *
 *     * A PUBLIC BUCKET'S READ IS NOT ASSERTED BY ANYTHING, because there is nothing to
 *       assert: `avatars` and `photos` are `public: true`, so any URL is fetchable by
 *       anybody, signed in or not. Both migrations that touched these policies say the same
 *       thing — the hole was WRITE, and narrowing read is a product decision with a real
 *       cost (a signed URL per image per render). A case asserting the current behaviour
 *       would be asserting the decision, and would go red on the day somebody took it.
 *     * IMAGE TRANSFORMS AND SIGNED URLS are untouched. `getPublicUrl` needs no policy at
 *       all on a public bucket, and nothing in the tree calls `createSignedUrl`.
 *     * `event-photos` IS GONE — this entry read "STILL HOLDS ITS OBJECTS" until
 *       2026-08-20. `scripts/drop-retired-bucket.mjs` removed the bytes through the Storage
 *       API and `20260820000008` removed the bucket, its object rows and its read policy.
 *       Both halves were needed: SQL cannot reach the storage backend, and a script cannot
 *       stop `20260609000000` re-creating the bucket on every `db reset`. The case above now
 *       asserts the bucket's ABSENCE, which no policy can undo.
 *
 *   createFund, createElection, createCollection, addChild
 *     Create rows in the CALLER's own family, derived from their own
 *     auth_family_code(). There is no other family's id to supply, so there is no
 *     cross-family case to construct. Their risk is the permission layer, not
 *     family isolation.
 *
 *     `createGatheringTemplate` IS THE SAME SHAPE AND IS NOT ON THIS LIST, deliberately.
 *     It takes a name, a description and a scheduler setting and no id at all, so the
 *     paragraph above applies to it word for word — but it has a case anyway, with its probe
 *     scoped to ALPHA and a comment saying which half of the question that answers. The
 *     exemption is cheaper to write and the case is cheaper to keep honest: the entry above
 *     expired silently for `createDuesSchedule` when a migration gave it two foreign ids,
 *     and a case that already exists cannot expire that way. Read the two together before
 *     adding a fifth name to this paragraph.
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
 *   GATHERINGS: what is covered, and what is not
 *     (no count is written down here on purpose — this list has already grown once)
 *     All 32 exported functions across the four modules have a case, and every one of them
 *     has a pending case too (`GATHERING_PENDING_CASES`). What this suite still does not
 *     reach, stated so each gap is a decision:
 *
 *     * `lib/gathering-instantiate.ts` IS NOT AN ACTION and has no case of its own. It is a
 *       plain module (deliberately not `'use server'`, so it gets no URL) and it re-verifies
 *       the gathering and the template on every call, because three call sites import it and
 *       it must not trust any of them. That third check is exercised transitively by
 *       `scheduleGathering`, `createGathering` and `addGatheringTemplate` — but a mutation
 *       that dropped it would leave all three still passing, because each of them checks the
 *       same ids first. The honest statement is that the redundancy is untested BY DESIGN of
 *       this suite: it is a second line of defence and nothing here can see past the first.
 *
 *     * THE FIVE `*_same_family` GUARD TRIGGERS are only reachable through an action here,
 *       and every action checks the same thing first — so the two §4 cases above
 *       (`setGatheringBudget (a fund from another family)`, `assignGatheringTask (a person
 *       from another family)`) are evidence for a PAIR and either half alone is sufficient.
 *       That is the intended design, exactly as `funds.transferBetweenFunds`'s §4 case
 *       records for 20260812000002's trigger. The triggers themselves are asserted by
 *       20260819000000's own verify block, which probes them with real rows.
 *
 *     * `gatherings/my-tasks` AND `gatherings/budget` HAVE NO ACTION OF THEIR OWN. They are
 *       keys, not modules: `my-tasks` gates a screen whose data comes from
 *       `getMyGatheringTasks`, and `budget` is resolved with `canAny` INSIDE
 *       `getGatheringDetail`, `getAdminGatherings`, `getAdminGatheringDetail` and
 *       `getGatheringFundOptions`. Only the last of those returns `[]` outright when the key
 *       is withheld, which is why it is the one with a control pinned to the administrator;
 *       the other three withhold a FIELD, and a field's absence is not something a
 *       cross-family assertion can see. `lib/gathering-budget.test.ts` covers the figures.
 *
 *     * THE `self_expr` ON THE TWO TASK TABLES IS NOT EXERCISED BY ANY CASE, and this is the
 *       largest of the four gaps. `perm:gathering_tasks:select` carries
 *       `assignee_id = auth_person_id()` as its `self_expr` specifically so an assignee reads
 *       their own task in a family that has narrowed `gatherings:view` to 'own' or 'none' —
 *       the claim being that /gatherings/my-tasks survives that narrowing. Nothing here can
 *       see it: this fixture has exactly two grids per family, Administrators (everything
 *       'any') and General (`gatherings:view = 'any'`), so every read in this block is
 *       satisfied by the `= 'any'` disjunct and the `self_expr` beside it never decides
 *       anything. MEASURED: mutation g5b above leaks the task through `auth_permission()`
 *       resolving 'any' from the applicant's own General template, not through `self_expr`.
 *
 *       That is not specific to Gatherings — NO case in this file tests an 'own' scope, on
 *       any resource, because the fixture has no actor holding one. Closing it means a fifth
 *       ALPHA actor on a third template whose `gatherings:view` is 'own', holding a task of
 *       their own, with `getMyGatheringTasks` pinned to them as the positive control. It is a
 *       real addition rather than a tweak, and it would widen this suite's remit from
 *       cross-family isolation to scope resolution, so it is recorded here rather than done
 *       quietly. `lib/auth/permissions.ts`'s own resolver is the other half that would need
 *       to move with it.
 *
 *     * THE NOTIFICATION WRITERS run inside four of these actions and are not asserted here.
 *       `notifyGatheringTaskSubmitted/Assigned/Reviewed` resolve their recipients from
 *       `admin/gatherings:edit` through `notifyGrantHolders`, which is family-scoped by the
 *       same resolver `notifyApprovers` has always used — and every one of them is wrapped in
 *       a try/catch that must never undo the decision it announces, so a refused insert
 *       cannot fail a case. `notifications.getNotifications` above is what would notice a
 *       bell entry crossing a family boundary.
 *
 *   The two `people` guards, through the ACTION rather than raw
 *     `people_guard_membership_status` and `people_guard_permission_template` are exercised
 *     by raw PATCH in SWEEP_CASES, which is the only way to reach the triggers themselves.
 *     What is NOT covered is a service-role write bypassing them — by design, since the
 *     guards bound the `authenticated` role rather than the column. That obligation is
 *     enforced statically instead: `npm run audit:people`, a step in verify.yml.
 *
 *   THE STAFF CONSOLE: what STAFF_CASES reaches, and the four things it does not
 *     `app/actions/staff/access.ts` has a case per action under five attackers (see that
 *     block's header for why this suite is the right runner for a module with no families in
 *     it). The gaps, each a decision:
 *
 *     * `app/actions/staff/families.ts` AND `app/actions/staff/accounts.ts` HAVE NO CASES AT
 *       ALL, and that is the older gap rather than one this change introduced. Both are gated
 *       on `requireStaff()` — staffness, not role, deliberately, because reading a customer's
 *       family is what the console is for — so the shape STAFF_CASES asserts (a non-owner is
 *       refused) is not their shape: a `support` staffer SHOULD reach them. What is worth
 *       asserting there is that a non-staff caller is refused, which is one derived block away
 *       and was left out because those two actions predate this batch and nothing in it
 *       touched them. Adding a `staffRole`-less attacker map over their exports is the whole
 *       job; the fixture already has every actor it would need.
 *     * RULE 5 — THE LAST OWNER CANNOT BE DEMOTED OR REVOKED — is not asserted, and cannot be
 *       by these cases. The fixture seeds exactly ONE owner, on purpose (a second would make
 *       the rule unreachable), and rule 4 refuses a caller touching their own row before rule 5
 *       is ever consulted — which the action's own `ownerCount` comment explains at length as
 *       the reason that count looks like dead code and is not. Reaching it needs a SECOND owner
 *       and a case in which one demotes the other, and then the assertion is about the
 *       PRODUCT rule rather than about a boundary. `lib/`-side there is nothing to test: the
 *       count is a query.
 *     * THE RACE THAT COUNT DOES NOT CLOSE is likewise untested and untestable from here. Two
 *       owners revoking each other in the same instant both read a count of 2 and both writes
 *       land. The action says so itself and names the stronger form (one SQL statement under
 *       `FOR UPDATE`, as `consume_family_removal_challenge` does). A suite that calls actions
 *       sequentially cannot see it.
 *     * `requireStaffOwner()` 404s AND THE ACTIONS ANSWER A FLAT SENTENCE, which is two
 *       different refusals for one condition — the guard for the PAGE, `NOT_AUTHORIZED` for a
 *       direct POST, neither ever saying "owners only". The cases here observe the THROW and
 *       cannot see the sentence, because the runner records a throw as a pass without
 *       inspecting it. Mutation s1 in the header is what separates the two layers, and it found
 *       that the read has only one of them.
 */
/**
 * EMPTY SINCE 2026-08-20, and kept rather than deleted.
 *
 * It held the four Storage-backed uploads from Phase 3 until STORAGE_CASES covered three of
 * them and 20260819000006 deleted the fourth. The export stays because it is the shape this
 * file wants for the next gap — a NAMED list beats a paragraph, since a name can be diffed
 * and a paragraph is read once — and because an empty array is a stronger statement than a
 * missing symbol: it says somebody looked.
 *
 * The narrative exemptions above are a different thing and are not moving here. Those are
 * lists of REASONS rather than of names, which is what let `createDuesSchedule` fall off one
 * of them when a migration gave it two foreign ids.
 */
export const UNCOVERED = []
