import {
  annualTotalCents, ageShareOfPeriod, proratedAnnualCents, currentPeriodStart,
  duesEligibility, duesScope, duesScopeMatch,
  type DuesScheduleLike, type DuesScope,
} from '@/lib/dues-utils'

/**
 * What the family should collect in dues this year, what it has, and from whom.
 *
 * ── WHY THIS IS A PURE MODULE AND NOT A QUERY ───────────────────────────────────────
 * Because it is arithmetic, and §7b is explicit about where arithmetic gets checked: the
 * RLS suite calls actions for real against real policies and cannot check a figure — its
 * fixtures seed dues schedules with no `start_date` at all, so an assertion about a
 * projection there would exercise one null branch and pass while testing nothing.
 *
 * Every input arrives as an argument, `today` included, so the whole roll-up is runnable.
 * The server action above it does exactly two things this cannot: it decides who is
 * allowed to ask, and it reads the four tables.
 *
 * ── EACH SCHEDULE IS MEASURED AGAINST ITS OWN YEAR ──────────────────────────────────
 * There is no single family-wide "year" to report against, and inventing one would be the
 * worst kind of wrong. `currentPeriodStart` is a property of the SCHEDULE — anchored on its
 * `start_date`, or its `due_month`, or January 1st as a last resort — so a family running
 * dues from 1 April and a building levy from 1 January genuinely have two years in progress.
 *
 * Measuring both against a calendar year instead would make this screen disagree with every
 * member's own balance on /dues, which is computed per schedule by `getMyDuesSummary`. Two
 * screens reporting different debts for the same member is the one outcome a treasurer
 * cannot work with, so the family total is the SUM of each schedule's own current period and
 * every row carries the period it was measured over.
 *
 * ── EXPECTED IS NOT "AMOUNT × MEMBERS" ──────────────────────────────────────────────
 * Five things reduce what a member owes below the schedule's headline figure, and every one
 * has to be honoured here or the projection is a bigger number than anybody will ever pay:
 *
 *   the age rule     `dues_schedules.start_age` (20260814000000). A member reaching the age
 *                    in July owes the months after their birthday month — five twelfths —
 *                    and nothing at all in the years before. `ageShareOfPeriod` decides it.
 *   the bloodline    `bloodline_only` (20260817000002). Owed by the descendants alone, so
 *                    anybody who married in owes nothing. `duesEligibility` decides it.
 *   the scope        `scope` (20260817000008). A regional or chapter due is owed only by the
 *                    members filed there, and a member in NO chapter is under National and
 *                    owes neither. `duesScopeMatch` decides it.
 *   opting out       an OPTIONAL due a member has declined is owed by nobody, so it leaves
 *                    the expected total rather than sitting in it as a debt nobody will pay.
 *   a waiver         settles the obligation without money arriving. It comes off what is
 *                    still to collect and must never reach a collected total — see
 *                    `waivedCents`, which is its own field for exactly that reason.
 *
 * ── EVERY APPROVED PERSON, ACCOUNT OR NOT — AND THIS REVERSES §4b's TABLE ───────────
 * §4b lists "dues and disbursement pickers, chapters, Reports' `totalMembers`" as
 * accounts-only, on the ground that "a record cannot pay or be paid". That is right about a
 * PICKER and wrong about a PROJECTION, and the difference is the whole reason this module is
 * separate from the ledger: a picker is the list of people a treasurer is about to record
 * money AGAINST, and a record can never be one of them; a projection is what the family is
 * OWED, and a grandmother on the tree who has never signed in owes her dues exactly as much
 * as her son does. Leaving her out never made the debt smaller — it made the screen report a
 * smaller one, which is the one thing a projection must not do.
 *
 * So `members` is the whole approved roster, and it is the SAME set the Member Directory
 * lists (`membership_status = 'approved'`, with no test on `user_id`). That is a property
 * worth keeping rather than a coincidence: the member count on this screen and the count next
 * door can no longer disagree, and the paragraph that used to explain why they did is gone.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO IS GATE INCLUSION ON THE BLOODLINE. The requirement was
 * phrased "all bloodline members should be counted", and billing only the bloodline would be
 * a different and worse rule: `bloodline_only` is the ONE place descent may decide who owes a
 * due (§4c), so on a schedule whose flag is OFF a step-son with no account and a blood son
 * with no account owe the same thing. Gating the ROSTER on descent would bill one and not the
 * other while the schedule itself said descent was irrelevant — and it would do it silently
 * for every family with no anchor, since `bloodlineIds` answers NULL there. The bloodline
 * keeps its one job, `duesEligibility`, where NULL still means "do not know" and still bills
 * nobody.
 *
 * ── THREE STATES, DERIVED, AND NOT ONE OF THEM CHANGES A FIGURE ─────────────────────
 * `memberStatus` below: Active, Invited, Pending Invite. That is what the family can DO about
 * the money, which is a different question from whether it is owed — all three owe, and the
 * status says whether there is anybody to send an invoice to. Nothing is stored: both facts
 * it reads are already in the database, and a status column would be a third copy that is
 * wrong the moment an invitation expires. §4b's `is_minor` is the same mistake.
 */

/** The four money figures, at every level of the roll-up. */
export interface ProjectionTotals {
  /** What the people counted here owe for their schedules' current periods. */
  expectedCents: number
  /** Money that actually arrived — `status = 'paid'`, reversals netted out. */
  collectedCents: number
  /** Forgiven. Settles the obligation; never counted as money. */
  waivedCents: number
  /**
   * Started and not settled — `status = 'pending'`.
   *
   * Zero for every family today, and it is carried rather than dropped because the state
   * is real: 20260806000002 leaves the pending→paid settlement open because that is the
   * shape an online-payment webhook needs, and `recordPayment` refuses 'pending' precisely
   * so nothing else can write one. The screen renders this only when it is non-zero, so a
   * treasurer never reads a permanent $0.00 as a broken figure.
   */
  pendingCents: number
  /** Expected, less what has been settled. Never negative. */
  outstandingCents: number
}

/** Where one member stands on one schedule. */
export type DuesStanding =
  /** Below the schedule's `start_age` for this whole period. Owes nothing yet. */
  | 'exempt'
  /**
   * Bloodline-only, and this member is not in it — or the family has not named the line.
   *
   * ITS OWN STANDING RATHER THAN A KIND OF 'exempt', because the two are different
   * promises. A child who is exempt becomes a payer; a member who married in never does,
   * so folding them together would report somebody's wife as "not yet due" on a due she
   * will never owe.
   */
  | 'excluded'
  /**
   * The due is scoped to a region or a chapter that is not theirs — or they are in no
   * chapter at all, which puts them under National (20260817000008).
   *
   * ITS OWN STANDING RATHER THAN A KIND OF 'excluded', and the distinction is the same one
   * that separates 'excluded' from 'exempt': a bloodline exclusion is permanent, and this
   * is not. A member who moves chapter, or whose chapter moves region, starts owing this
   * tomorrow — so reporting them in the words used for somebody excluded by their marriage
   * would be a different claim about a reversible fact.
   */
  | 'out-of-scope'
  /** Declined an optional due. Owes nothing. */
  | 'declined'
  /** Settled in full, by money or by waiver. */
  | 'settled'
  /** Something in, not all of it. */
  | 'partial'
  /** Owes the whole thing. */
  | 'unpaid'

/**
 * Whether there is anybody to send the bill to. `memberStatus` derives it.
 *
 * NOT A STANDING, AND DELIBERATELY NOT IN THAT UNION. Every one of these three owes the same
 * money; folding them in beside 'exempt' and 'excluded' would put "nobody has asked them to
 * join" in a list of reasons somebody owes nothing, which is the single wrong idea this
 * screen has to avoid. They are two columns because they are two questions.
 */
export type MemberStatus = 'active' | 'invited' | 'pending-invite'

export interface ScheduleProjection extends ProjectionTotals {
  scheduleId: string
  label: string
  required: boolean
  /** The period these figures cover — this schedule's own current year. */
  periodStart: string
  /** The schedule's full annual figure, before any member's age or opt-out. */
  annualCents: number
  /** Only the bloodline owes it. */
  bloodlineOnly: boolean
  /**
   * Bloodline-only, and NOT ONE member counted is in the bloodline — so it bills nothing.
   *
   * ── IT WAS `bloodlineUnknown` UNTIL `20260902000000` ──────────────────────────────
   * The bloodline was derived from `families.bloodline_anchor_id`, and a family that had
   * never set one got NULL from `bloodlineIds()`, which billed nobody. That state is gone
   * with the anchor — `people.is_bloodline` is stated per person — and the REASON the field
   * existed is not: this is still "the one state on this screen a treasurer cannot diagnose
   * from the numbers", because a family that ticks Bloodline only before marking anybody
   * sees Expected read $0.00 with nothing in the figures to explain it.
   *
   * So the field asks the new question instead of being deleted, and it is now the exact
   * parallel of `scopeEmpty` below — same shape, same derivation from `counts`, same reason.
   */
  bloodlineEmpty: boolean
  /** Which part of the family owes it (20260817000008). */
  scope: DuesScope
  /** The region it is scoped to, when `scope` is 'regional'. The screen names it. */
  regionId: string | null
  /** The chapter it is scoped to, when `scope` is 'chapter'. */
  chapterId: string | null
  /**
   * Scoped to a region or a chapter, and NOBODY in the family is in it — so it bills
   * nothing at all.
   *
   * Surfaced for the same reason as `bloodlineUnknown`, and it is the commoner mistake of
   * the two: a family that creates the Texas chapter and a Texas due before anybody has
   * picked their chapter sees Expected read $0.00 with nothing in the figures to explain
   * it. A treasurer cannot diagnose this from the numbers, so the screen says it.
   */
  scopeEmpty: boolean
  /** Members who owe something on it this period. */
  payingMembers: number
  counts: Record<DuesStanding, number>
}

export interface MemberProjection extends ProjectionTotals {
  personId: string
  /** How many schedules this member owes something on this period. */
  liableSchedules: number
  /** The least settled standing they hold on any schedule — what the row is sorted by. */
  standing: DuesStanding
  /** Whether the family can ask them for it at all — see `memberStatus`. */
  status: MemberStatus
}

export interface DuesProjection extends ProjectionTotals {
  /**
   * Everybody the projection was computed over: every approved person in the family, with an
   * account or without one. The same set the Member Directory lists — see the header.
   */
  membersCounted: number
  /** How many of them owe something on at least one schedule. */
  payingMembers: number
  /**
   * How many are Active, Invited and Pending Invite. Derived from the same call the table's
   * pills render from, so the caption and the rows cannot disagree.
   */
  statusCounts: Record<MemberStatus, number>
  /**
   * Of `outstandingCents`, how much is owed by people with NO ACCOUNT — Invited and Pending
   * Invite together.
   *
   * Its own figure, because the screen would otherwise be dishonest by omission. "Still to
   * collect $4,200" reads as a list of people to chase, and a treasurer needs to know when a
   * third of it belongs to relatives who cannot see a due, let alone pay one. It is a SUBSET
   * of `outstandingCents` and is never taken off it: the family is owed the money either way,
   * which is the whole reason those people are counted now.
   */
  unregisteredOutstandingCents: number
  schedules: ScheduleProjection[]
  members: MemberProjection[]
}

/** A schedule as the projection needs it — the pure shape plus what it is called. */
export interface ProjectionSchedule extends DuesScheduleLike {
  id: string
  label: string
  required: boolean
}

export interface ProjectionMember {
  personId: string
  /** `people.date_of_birth`. Null means not recorded, which the age rule reads as adult. */
  dateOfBirth: string | null
  /**
   * `people.user_id IS NOT NULL` — somebody has signed up and this row is theirs.
   *
   * REQUIRED, WITH NO DEFAULT, for the reason every `FEATURES` entry states its `tier`: the
   * failure mode of forgetting is invisible. Defaulting it true would report a family of
   * unregistered relatives as fully contactable; defaulting it false would file every paying
   * member under "nobody has asked them". The caller knows which it is, so it has to say.
   */
  hasAccount: boolean
  /**
   * An invitation to this family that is still OPEN — not accepted, not revoked, not expired.
   *
   * Optional because it decides nothing for somebody who already has an account, and because
   * a caller that has not read `family_invitations` should read as "not asked" rather than
   * guess: 'pending-invite' names work to do, which is recoverable, where a wrong 'invited'
   * reports work as already done.
   */
  invitationOpen?: boolean
  /**
   * `people.chapter_id` in this family, or null for a member in no chapter — who is under
   * National and owes no regional or chapter due (20260817000008).
   *
   * Optional so a caller that has not loaded chapters passes nothing and every member reads
   * as unplaced. That is only correct for a family with no scoped schedules, which is why
   * `getDuesProjection` always selects the column rather than deciding whether it needs to.
   */
  chapterId?: string | null
  /**
   * `people.is_bloodline` — stated by the family, never derived (`20260902000000`).
   *
   * REQUIRED, WITH NO DEFAULT, for `hasAccount`'s reason: the failure mode of forgetting is
   * invisible, and here it is money. Defaulting it true would bill every member who married
   * in on a blood-only due; defaulting it false would silently stop billing the whole
   * family. The caller has the column in hand, so it has to say.
   */
  isBloodline: boolean
}

export interface ProjectionPayment {
  personId: string
  scheduleId: string
  amountCents: number
  /** `paid` | `waived` | `pending`. Anything else is ignored. */
  status: string
  paymentDate: string
}

export interface ProjectionPlan {
  personId: string
  scheduleId: string
  optedOut: boolean
}

const ZERO: ProjectionTotals = {
  expectedCents: 0, collectedCents: 0, waivedCents: 0, pendingCents: 0, outstandingCents: 0,
}

/**
 * Sum two sets of totals. `outstandingCents` is added rather than re-derived, because it is
 * floored at zero PER MEMBER PER SCHEDULE: a member who overpaid one due does not reduce
 * what the family is still owed on another, and re-deriving the family figure from the
 * family's expected-less-settled would let one overpayment cancel somebody else's arrears.
 */
function add(a: ProjectionTotals, b: ProjectionTotals): ProjectionTotals {
  return {
    expectedCents: a.expectedCents + b.expectedCents,
    collectedCents: a.collectedCents + b.collectedCents,
    waivedCents: a.waivedCents + b.waivedCents,
    pendingCents: a.pendingCents + b.pendingCents,
    outstandingCents: a.outstandingCents + b.outstandingCents,
  }
}

/** Least settled first — the order the member table sorts by, and `standing` picks. */
const STANDING_RANK: Record<DuesStanding, number> = {
  unpaid: 0, partial: 1, settled: 2, declined: 3, exempt: 4, excluded: 5, 'out-of-scope': 6,
}

/**
 * Whether the family can ask this person for the money — a separate question from whether they
 * owe it, and the answer changes nothing about the figures.
 *
 *   Active          they have an account and an approved membership. There is somebody to
 *                   invoice, and they can see the due on their own /dues screen.
 *   Invited         no account yet, and an invitation is open. The family has asked; the ball
 *                   is with them.
 *   Pending Invite  a person recorded on the tree whom nobody has asked yet. This one has its
 *                   own name rather than being folded into "no account" precisely because it
 *                   is the only one of the three a treasurer can act on today.
 *
 * DERIVED, NEVER STORED. Both inputs are facts the database already holds — `people.user_id`,
 * and a row in `family_invitations` — so a status column would be a third copy of them, wrong
 * from the moment an invitation expires and wrong without the row being written. That is
 * exactly what `is_minor` was (§4b), and it is why this takes two booleans rather than reading
 * a column.
 *
 * AN EXPIRED INVITATION IS NOT OPEN, and that is a decision. An expired token cannot be
 * redeemed, so the family has to ask again — which is what 'pending-invite' says. Calling it
 * 'invited' would report work as done. `peek_family_invitation` draws the line in the same
 * place (`expires_at > NOW()`), so the screen and the link agree about what an invitation is.
 *
 * THERE IS NO FOURTH STATE, and the ROSTER is why rather than this function. An account whose
 * membership is 'pending', 'rejected' or 'disabled' is not approved, so it never reaches here:
 * the projection is computed over `membership_status = 'approved'`, the Directory's own set. An
 * applicant has not joined the family, and the family is not owed anything by them yet.
 */
export function memberStatus(
  member: { hasAccount: boolean; invitationOpen?: boolean },
): MemberStatus {
  if (member.hasAccount) return 'active'
  return member.invitationOpen ? 'invited' : 'pending-invite'
}

/** A roster row as the invitation join needs it. */
export interface InvitationCandidate {
  personId: string
  hasAccount: boolean
  /** `people.primary_email`. Compared case-insensitively; null for a row with no address. */
  email: string | null
}

/** An OPEN invitation — the caller is what decides that; see `memberStatus` on expiry. */
export interface OpenInvitation {
  /** `family_invitations.invited_person_id`: the record this invitation was about, if any. */
  personId: string | null
  /** `family_invitations.email`, which the database stores lower-cased and trimmed. */
  email: string
}

/**
 * Which people on the roster have been asked to join — the `invitationOpen` half of
 * `memberStatus`, resolved from `family_invitations`.
 *
 * ── IT MATCHES ON TWO THINGS, AND BOTH ARE LOAD-BEARING ─────────────────────────────
 * `invited_person_id` is the column that exists for exactly this (20260813000004) and is what
 * `invitePersonRecord` writes — but it is set by only one of the three doors an invitation can
 * come through, so matching on it alone under-reports:
 *
 *   the tree's Invite button   `invitePersonRecord` → names the record. Matches on the id.
 *   Members & Access           `InviteMemberDialog` → takes an address and no person at all,
 *                              so a family that invites a recorded relative from there has
 *                              asked them and the id is NULL. Matches on the address.
 *   Resend                     `resendInvitation` re-mints WITHOUT carrying the person link
 *                              through, so the second ask loses the id the first one had.
 *                              Matches on the address, when the record holds a real one.
 *
 * The last of those is a defect in `resendInvitation` rather than in this rule, and TODO.md
 * carries it: a re-sent invitation about a record should still be about that record, or
 * redemption creates a second person. The address match is what keeps THIS screen honest
 * meanwhile, and it is why it is not simply `invited_person_id IN (…)`.
 *
 * ── AN ACCOUNT WINS OVER AN INVITATION ──────────────────────────────────────────────
 * Anybody with an account is left out of the set, so a stale open invitation addressed to a
 * member who has since joined by some other door cannot report them as still being asked.
 * `memberStatus` would ignore it anyway; excluding it here means the two cannot drift apart.
 *
 * PURE, and one Set out. The action reads the rows and applies §3's family scoping; this is
 * the rule, which is the part with edge cases and therefore the part worth testing (§7b).
 */
export function invitedPersonIds(
  roster: readonly InvitationCandidate[],
  invitations: readonly OpenInvitation[],
): Set<string> {
  const open = new Set<string>()
  if (invitations.length === 0) return open

  const waiting = new Set<string>()
  const byEmail = new Map<string, string>()
  for (const person of roster) {
    if (person.hasAccount) continue
    waiting.add(person.personId)
    const email = person.email?.trim().toLowerCase()
    if (email) byEmail.set(email, person.personId)
  }

  for (const invitation of invitations) {
    // Named the record. Guarded by `waiting` rather than trusted: an id for somebody outside
    // this roster decides nothing, and one for a member who now has an account is stale.
    if (invitation.personId && waiting.has(invitation.personId)) {
      open.add(invitation.personId)
      continue
    }
    const match = byEmail.get(invitation.email.trim().toLowerCase())
    if (match) open.add(match)
  }

  return open
}

export function projectDues(input: {
  /** Active dues schedules. Donations must not be here — nobody owes a gift. */
  schedules: readonly ProjectionSchedule[]
  members: readonly ProjectionMember[]
  payments: readonly ProjectionPayment[]
  plans: readonly ProjectionPlan[]
  /**
   * `chapters` as chapter id -> region id, which is what a member's REGION is derived from
   * (20260817000008). A chapter under National maps to null.
   *
   * Only consulted for a schedule whose `scope` is not 'national'. Omitting it is the same
   * as a family with no chapters: every regional and chapter due then bills nobody, which
   * is exactly what is true of such a family. There is no `people.region_id` and none may
   * be added — see `duesScopeMatch`.
   */
  chapterRegions?: ReadonlyMap<string, string | null>
}): DuesProjection {
  const { schedules, members, payments, plans } = input
  const chapterRegions = input.chapterRegions ?? new Map<string, string | null>()

  const declined = new Set(
    plans.filter(p => p.optedOut).map(p => `${p.personId}:${p.scheduleId}`),
  )

  // Settled money, bucketed by (member, schedule) and by status. Bucketed ONCE rather than
  // filtered per member per schedule: a family of 150 on four schedules is 600 cells, and
  // scanning the whole ledger for each of them is the shape that makes a page time out.
  const paid = new Map<string, number>()
  const waived = new Map<string, number>()
  const pending = new Map<string, number>()
  const bucket = (m: Map<string, number>, key: string, cents: number) =>
    m.set(key, (m.get(key) ?? 0) + cents)

  // A schedule's period is its own, so a payment counts only if it falls inside the period
  // of the schedule it was made against.
  const periodStartOf = new Map<string, string>(
    schedules.map(s => [s.id, currentPeriodStart(s)]),
  )

  for (const payment of payments) {
    const periodStart = periodStartOf.get(payment.scheduleId)
    if (periodStart === undefined) continue          // a schedule we are not reporting on
    if (payment.paymentDate < periodStart) continue  // last year's money, last year's due
    const key = `${payment.personId}:${payment.scheduleId}`
    if (payment.status === 'paid') bucket(paid, key, payment.amountCents)
    else if (payment.status === 'waived') bucket(waived, key, payment.amountCents)
    else if (payment.status === 'pending') bucket(pending, key, payment.amountCents)
  }

  const memberTotals = new Map<string, ProjectionTotals>()
  const memberLiable = new Map<string, number>()
  const memberStanding = new Map<string, DuesStanding>()

  const scheduleRows: ScheduleProjection[] = schedules.map(schedule => {
    const periodStart = periodStartOf.get(schedule.id) as string
    const annualCents = annualTotalCents(schedule)
    let totals = ZERO
    let payingMembers = 0
    const counts: Record<DuesStanding, number> = {
      exempt: 0, excluded: 0, 'out-of-scope': 0, declined: 0, settled: 0, partial: 0, unpaid: 0,
    }

    for (const member of members) {
      const key = `${member.personId}:${schedule.id}`
      const share = ageShareOfPeriod({
        startAge: schedule.start_age,
        dateOfBirth: member.dateOfBirth,
        periodStart,
      })
      // A REQUIRED due cannot be declined, and the check is here as well as in the
      // database: a plan row that predates 20260807000003's guard, or one whose schedule
      // was made required after the member opted out, must read as owed.
      const optedOut = !schedule.required && declined.has(key)
      // WHETHER THEY OWE IT AT ALL, before any question of how much — see
      // `duesEligibility`, which is where the reasoning lives. One column on the member's
      // own row since `20260902000000`; it used to be a set membership test against a walk
      // over the whole family tree.
      const eligibility = duesEligibility({
        bloodlineOnly: schedule.bloodline_only,
        isBloodline: member.isBloodline,
      })
      const excluded = eligibility !== 'owed'
      // WHOSE PART OF THE FAMILY IT IS FOR, which is a third and separate reduction — see
      // `duesScopeMatch`. A member in no chapter is under National and owes nothing scoped.
      const outOfScope = duesScopeMatch({
        schedule,
        memberChapterId: member.chapterId ?? null,
        chapterRegions,
      }) !== 'owed'

      const collectedCents = paid.get(key) ?? 0
      const waivedCents = waived.get(key) ?? 0
      const pendingCents = pending.get(key) ?? 0
      const expectedCents = optedOut || excluded || outOfScope
        ? 0
        : proratedAnnualCents(annualCents, share)
      const outstandingCents = Math.max(0, expectedCents - collectedCents - waivedCents)

      // ORDER MATTERS, and 'out-of-scope' comes FIRST — ahead of 'excluded', which used to
      // lead. A due scoped to another chapter was never ADDRESSED to this member, so the
      // bloodline question does not arise: answering "not blood" about a Texas due for a
      // Georgia member is an answer to a question nobody asked, and it names how they
      // joined the family to explain something geography already explains.
      //
      // The rest of the order is unchanged and for the reason it always was: a member
      // outside the bloodline will never owe this, so reporting them as 'exempt' because
      // they are also a child — or as 'settled' because they owe nothing — would both be
      // wrong. What is true of them is that the due is not theirs.
      const standing: DuesStanding =
        outOfScope ? 'out-of-scope'
          : excluded ? 'excluded'
            : share.exempt ? 'exempt'
              : optedOut ? 'declined'
                : outstandingCents <= 0 ? 'settled'
                  : collectedCents + waivedCents > 0 ? 'partial'
                    : 'unpaid'

      counts[standing]++
      if (expectedCents > 0) payingMembers++

      const cell: ProjectionTotals = {
        expectedCents, collectedCents, waivedCents, pendingCents, outstandingCents,
      }
      totals = add(totals, cell)
      memberTotals.set(member.personId, add(memberTotals.get(member.personId) ?? ZERO, cell))
      if (expectedCents > 0) {
        memberLiable.set(member.personId, (memberLiable.get(member.personId) ?? 0) + 1)
      }
      // The least settled standing a member holds anywhere is what their row reports:
      // somebody paid up on three dues and owing a fourth is a member who owes.
      const held = memberStanding.get(member.personId)
      if (held === undefined || STANDING_RANK[standing] < STANDING_RANK[held]) {
        memberStanding.set(member.personId, standing)
      }
    }

    return {
      scheduleId: schedule.id,
      label: schedule.label,
      required: schedule.required,
      periodStart,
      annualCents,
      bloodlineOnly: Boolean(schedule.bloodline_only),
      // Bloodline-only, and every member counted came out excluded. DERIVED FROM `counts`
      // rather than from the roster, exactly as `scopeEmpty` is and for the same reason: a
      // second count taken from the roster would be free to disagree with the pills beside
      // it. A schedule open to everybody does not care that nobody is marked, so the first
      // conjunct is what stops this being a warning about nothing — and a family with no
      // members at all is not this state, which the member count already says.
      //
      // `counts['excluded']` is the bloodline's own bucket: `duesScopeMatch` is answered
      // FIRST (see the order note above), so a member out of scope never reaches 'excluded'
      // and cannot inflate this into a false positive on a scoped blood-only due.
      bloodlineEmpty: Boolean(schedule.bloodline_only)
        && members.length > 0
        && counts.excluded === members.length,
      scope: duesScope(schedule),
      regionId: schedule.region_id ?? null,
      chapterId: schedule.chapter_id ?? null,
      // Scoped, and every member counted came out out-of-scope. Derived from the counts
      // rather than from the roster, so it cannot disagree with the pills beside it. A family
      // with no members at all is not this state: it has nothing to report either way, which
      // is what the zero member count above already says.
      //
      // THE FIRST CONJUNCT IS PROVABLY REDUNDANT AND IS KEPT ANYWAY, which the test file
      // records rather than leaving for somebody to discover: `duesScopeMatch` answers
      // 'owed' for every member of a national due, so `counts['out-of-scope']` is zero and
      // cannot equal a non-zero member count. Removing it breaks no test — the mutation was
      // run. It stays because `scopeEmpty` is a claim about a SCOPED due, and the property it
      // would otherwise lean on is one line of `duesScopeMatch` away from changing.
      scopeEmpty: duesScope(schedule) !== 'national'
        && members.length > 0
        && counts['out-of-scope'] === members.length,
      payingMembers,
      counts,
      ...totals,
    }
  })

  // The three states, and the two roll-ups the screen reads off them. Counted HERE, over the
  // rows the table renders, rather than in the action: a second count taken from the roster
  // would be free to disagree with the pills beside it, which is the failure the schedule
  // row's `scopeEmpty` is derived from `counts` to avoid.
  const statusCounts: Record<MemberStatus, number> = {
    active: 0, invited: 0, 'pending-invite': 0,
  }
  let unregisteredOutstandingCents = 0

  const memberRows: MemberProjection[] = members.map(member => {
    const status = memberStatus(member)
    const totals = memberTotals.get(member.personId) ?? ZERO
    statusCounts[status]++
    // A SUBSET, never a deduction. What the family is owed does not change because there is
    // nobody to send the invoice to; what changes is whether the treasurer can act on it.
    if (status !== 'active') unregisteredOutstandingCents += totals.outstandingCents

    return {
      personId: member.personId,
      liableSchedules: memberLiable.get(member.personId) ?? 0,
      // 'settled' for a family with no dues at all: they owe nothing and nothing is
      // outstanding, which is what that word means here.
      standing: memberStanding.get(member.personId) ?? 'settled',
      status,
      ...totals,
    }
  })

  return {
    membersCounted: members.length,
    payingMembers: memberRows.filter(m => m.liableSchedules > 0).length,
    statusCounts,
    unregisteredOutstandingCents,
    schedules: scheduleRows,
    members: memberRows,
    ...scheduleRows.reduce(add, ZERO),
  }
}

/**
 * What share of the expected total has been settled, 0–100, rounded.
 *
 * NOT CLAMPED ABOVE 100, deliberately, and the reason is the reverse of the donation bar's:
 * a family collecting more than it billed is not a triumph, it is a figure a treasurer needs
 * to see and reconcile — an overpayment, a duplicate entry, or a payment posted against the
 * wrong period. Hiding it at 100% would hide the discrepancy.
 *
 * Zero expected gives 0 rather than 100. A family that has billed nothing has not collected
 * all of it; it has nothing to collect, and the screen says that in words instead.
 */
export function collectedPercent(totals: ProjectionTotals): number {
  if (totals.expectedCents <= 0) return 0
  const settled = totals.collectedCents + totals.waivedCents
  return Math.round((settled / totals.expectedCents) * 100)
}
