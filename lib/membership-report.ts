import { isMinorOn } from '@/lib/age-utils'
import { memberStatus, type MemberStatus } from '@/lib/dues-projection'

/**
 * How a family is made up — how many people, where they are, who has finished joining,
 * and how many are children.
 *
 * PURE, AND THAT IS THE POINT (AGENTS.md §7b). Everything here is arithmetic over rows the
 * action has already read and family-scoped; nothing reads a clock, a database or an
 * environment. `today` arrives as a PARAMETER for the reason `duesPlanMath` takes one — a
 * module that reads `new Date()` internally cannot have its edge cases checked, and this one
 * has a real edge case in the age split (somebody whose eighteenth birthday is today).
 *
 * `today` IS A `YYYY-MM-DD` STRING, never a `Date`, and that is `lib/calendar.ts`'s rule
 * rather than a preference: `date_of_birth` is a bare DATE, so parsing one into a `Date`
 * and reading it back through local accessors moves it a day for every reader west of
 * Greenwich. Writing the first test against `isMinorOn` is what found that (see its header).
 *
 * ── WHO IS COUNTED, AND WHY IT MATCHES DUES PROJECTIONS EXACTLY ─────────────────────
 * The roster is decided by the ACTION, not here — but the answer it passes is deliberately
 * the same set `getDuesProjection` builds: every person whose membership is `'approved'`
 * and who has no `sunset_date`. Two reports on the same rail disagreeing about how many
 * members a family has is the drift AGENTS.md's "A table is a table" is about, one level up
 * — and each half of the rule is right on its own terms:
 *
 *   pending / rejected / disabled   has not joined. The approvals queue is what counts them,
 *                                   and a membership report that included applicants would
 *                                   report work as done.
 *   `sunset_date` set               has died. `getUpcomingBirthdays` and `getDuesProjection`
 *                                   both already exclude them, on the same column and for
 *                                   the same reason: a dead relative has no next birthday
 *                                   and owes no dues, and is not a current member either.
 *
 * A RECORD WITH NO ACCOUNT IS COUNTED, which is the §4b question this report has to answer
 * one way or the other. It counts them, on Dues Projections' side of that line rather than
 * the money PICKERS' side: a grandmother recorded on the tree who never finished registering
 * is somebody the family HAS, and leaving her out would make the National figure smaller
 * than the Member Directory's on the next screen. The invitation split below is precisely
 * what tells her apart from a member who signs in.
 *
 * ── NATIONAL IS THE ABSENCE OF A REGION, AND IT IS A BUCKET RATHER THAN A ROW ───────
 * The product's settled vocabulary (20260817000008, and every screen that prints it): a
 * member with no chapter, and a member whose chapter sits under no region, are equally under
 * **National**. So the region breakdown ends with a National bucket rather than dropping
 * those people, and the two causes are one bucket because they are one fact.
 *
 * The chapter breakdown's leftover is **No chapter**, and that word is different on purpose:
 * a missing chapter is genuinely a missing value — Members & Access prints an em-dash for it
 * — whereas a missing region is a place. A report cannot print an em-dash as a slice label,
 * so it says the absence out loud instead.
 *
 * ── EMPTY CHAPTERS AND EMPTY REGIONS ARE LISTED ─────────────────────────────────────
 * A chapter with nobody in it is exactly the fact an organizer opens this screen for, so the
 * action reads the family's whole geography rather than only the ids its people carry — and
 * this module is handed both lists. The retired `/admin/reports` derived its chapter
 * breakdown from `people.chapters(name)` alone, so a chapter the family had set up and never
 * filled was indistinguishable from one that did not exist.
 */

/** One slice of a breakdown: a label, a count, and a key stable enough to render by. */
export interface CountSlice {
  /** Unique within its breakdown. A uuid for a real row; a sentinel for a bucket. */
  key: string
  label: string
  count: number
  /** Share of the report's total, 0-100, rounded for display. See `sharePercent`. */
  percent: number
}

/** The sentinel keys, so a consumer can tell a bucket from a real region or chapter. */
export const NATIONAL_KEY = '__national__'
export const NO_CHAPTER_KEY = '__no_chapter__'

export interface MembershipReport {
  /** The National figure — every person counted. Every `percent` below is a share of this. */
  total: number
  /** How many regions and chapters the family has configured, empty ones included. */
  regionCount: number
  chapterCount: number
  /** Biggest first, National last however big it is — it is a leftover, not a region. */
  byRegion: CountSlice[]
  /** Biggest first, No chapter last, for the same reason. */
  byChapter: CountSlice[]
  /** Active / Invited / Pending invite, in that order — a progression, never re-sorted. */
  byInvitation: CountSlice[]
  /** Adults / Minors / Birthday not recorded, in that order and never re-sorted. */
  byAge: CountSlice[]
}

/** A roster row, as this module needs it. The action drops everything else. */
export interface ReportPerson {
  id: string
  /** `people.chapter_id`. Null, or an id outside the family's own chapters, is National. */
  chapterId: string | null
  /** `people.date_of_birth`. Null means "not recorded", which is its own bucket. */
  dateOfBirth: string | null
  /** Whether the person holds an auth account — `people.user_id IS NOT NULL`. */
  hasAccount: boolean
}

/** A chapter of the family, whether or not anybody is in it. */
export interface ReportChapter {
  id: string
  name: string
  /** The region it sits under. Null is National — see the header. */
  regionId: string | null
}

/** A region of the family, whether or not any chapter is in it. */
export interface ReportRegion {
  id: string
  name: string
}

/**
 * A whole number percentage of `total`, and 0 when there is nothing to divide by.
 *
 * ROUNDED FOR DISPLAY AND NEVER SUMMED. Three slices of one third each print 33% three
 * times and add to 99, which is what rounding does and what every percentage column in this
 * codebase already lives with. Nothing here adds them up; the COUNTS are what the totals are
 * built from, and they are exact.
 */
export function sharePercent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0
}

/**
 * Biggest first, then by label so a tie is stable rather than dependent on read order.
 *
 * The stability matters more than it looks: two chapters of four members each would
 * otherwise swap places between requests, and a report that reorders itself on refresh is
 * one nobody trusts.
 */
function bySizeThenName(a: CountSlice, b: CountSlice): number {
  return b.count - a.count || a.label.localeCompare(b.label)
}

export function buildMembershipReport(input: {
  people: readonly ReportPerson[]
  chapters: readonly ReportChapter[]
  regions: readonly ReportRegion[]
  /** Person ids with an OPEN invitation — `invitedPersonIds` in lib/dues-projection.ts. */
  invitedIds: ReadonlySet<string>
  today: string
}): MembershipReport {
  const { people, chapters, regions, invitedIds, today } = input
  const total = people.length
  const slice = (key: string, label: string, count: number): CountSlice =>
    ({ key, label, count, percent: sharePercent(count, total) })

  // The family's own geography, by id. A `chapter_id` that is not in here belongs to no
  // chapter this family has — a deleted one, or (§4's shape) one pointing across the family
  // boundary — and lands in National with everybody else who is under no region. That is the
  // same answer `chapterPlaces` gives the two member tables for the same id.
  const chapterById = new Map(chapters.map(c => [c.id, c]))
  const regionNameById = new Map(regions.map(r => [r.id, r.name]))

  // Seeded with every chapter and every region the family has, at zero. An empty chapter is
  // the fact this report exists to surface; see the header.
  const chapterCounts = new Map<string, number>(chapters.map(c => [c.id, 0]))
  const regionCounts = new Map<string, number>(regions.map(r => [r.id, 0]))
  let noChapter = 0
  let national = 0

  let adults = 0, minors = 0, unknownAge = 0
  const invitationCounts: Record<MemberStatus, number> = {
    'active': 0, 'invited': 0, 'pending-invite': 0,
  }

  for (const person of people) {
    const chapter = person.chapterId ? chapterById.get(person.chapterId) : undefined
    if (chapter) chapterCounts.set(chapter.id, (chapterCounts.get(chapter.id) ?? 0) + 1)
    else noChapter += 1

    const regionId = chapter?.regionId ?? null
    if (regionId && regionCounts.has(regionId)) {
      regionCounts.set(regionId, (regionCounts.get(regionId) ?? 0) + 1)
    } else {
      national += 1
    }

    // THREE BUCKETS, NOT TWO, and the third is the honest one. `isMinorOn` answers false for
    // a null birthday deliberately (see its header) — which is right for a Minor BADGE on a
    // directory row and wrong for a COUNT, because it would file every elder with no
    // recorded birthday under Adults and report a precision the data does not have.
    if (!person.dateOfBirth) unknownAge += 1
    else if (isMinorOn(person.dateOfBirth, today)) minors += 1
    else adults += 1

    // ONE DEFINITION OF THE THREE STATES, imported rather than restated. Dues Projections
    // prints the same three words off the same function, so the two screens cannot come to
    // disagree about whether somebody has been asked.
    invitationCounts[memberStatus({
      hasAccount: person.hasAccount,
      invitationOpen: invitedIds.has(person.id),
    })] += 1
  }

  const byRegion = [...regionCounts.entries()]
    .map(([id, count]) => slice(id, regionNameById.get(id) ?? 'Region', count))
    .sort(bySizeThenName)
  // National LAST regardless of size — it is what is left over rather than a region, and a
  // leftover at the top of a list of places reads as the biggest place.
  byRegion.push(slice(NATIONAL_KEY, 'National', national))

  const byChapter = [...chapterCounts.entries()]
    .map(([id, count]) => slice(id, chapterById.get(id)?.name ?? 'Chapter', count))
    .sort(bySizeThenName)
  byChapter.push(slice(NO_CHAPTER_KEY, 'No chapter', noChapter))

  return {
    total,
    regionCount: regions.length,
    chapterCount: chapters.length,
    byRegion,
    byChapter,
    // NEVER SORTED BY SIZE. These two are progressions — a member moves left to right through
    // them — so ordering by count would reshuffle the legend as the family fills in, and a
    // reader comparing two months would be comparing two different charts.
    byInvitation: [
      slice('active', 'Active', invitationCounts['active']),
      slice('invited', 'Invited', invitationCounts['invited']),
      slice('pending-invite', 'Pending invite', invitationCounts['pending-invite']),
    ],
    byAge: [
      slice('adults', 'Adults', adults),
      slice('minors', 'Minors', minors),
      slice('unknown', 'Birthday not recorded', unknownAge),
    ],
  }
}

/**
 * The slices a donut may draw, with everything past `keep` folded into one **Other**.
 *
 * A pie is legible as part-to-whole at a glance and stops being legible somewhere around six
 * segments — past that, adjacent slices are a couple of degrees apart and the colours have to
 * be told apart rather than read. A family with twenty chapters is an ordinary customer of
 * this product, so the fold is not an edge case.
 *
 * NEVER SILENTLY: the folded slice is labelled with how many it stands for, and the TABLE
 * beside every chart on the screen lists all of them. Same rule as `PersonMultiSelect`'s
 * overflow count and the migration verify blocks — a truncation the reader cannot see is how
 * somebody concludes a chapter does not exist.
 *
 * A ZERO SLICE IS DROPPED, because a segment of no degrees is a legend entry pointing at
 * nothing. It is still in the table, which is where "this chapter has nobody in it" belongs.
 */
export function foldForChart(slices: readonly CountSlice[], keep = 5): CountSlice[] {
  const drawable = slices.filter(s => s.count > 0)
  if (drawable.length <= keep + 1) return drawable

  const head = drawable.slice(0, keep)
  const tail = drawable.slice(keep)
  const count = tail.reduce((sum, s) => sum + s.count, 0)
  const total = slices.reduce((sum, s) => sum + s.count, 0)
  return [...head, {
    key: '__other__',
    label: `Other (${tail.length})`,
    count,
    percent: sharePercent(count, total),
  }]
}
