
/**
 * `computeIsMinor` WAS HERE AND IS DELETED. Use `isMinorOn(dob, today)`.
 *
 * It read `todayLocal()` internally, which is the whole problem: on the server that is UTC,
 * and UTC rolls over at 7pm Central — so for the last five hours of every day it answered
 * against tomorrow, and a relative counted as an adult five hours before their eighteenth
 * birthday in the family's own zone. Its four callers (`getMembers`, `getUnlinkedPeople`,
 * `getMembershipReport` and the chapter propagation) now resolve the FAMILY's zone and pass
 * the date in — see `resolveFamilyZone` in `lib/auth/zone.ts` for why the family's and not the
 * reader's.
 *
 * **It is deleted rather than left in place**, and that is the point of this comment. A
 * convenience wrapper that reads a clock is exactly the shape this sweep removed from four
 * call sites; leaving it exported would leave the next caller a one-word way back to the bug.
 * `isMinorOn` is the rule, it takes the date, and that is what makes the answer stateable
 * (§7b) and the same on every surface.
 */


/**
 * The rule itself, against a calendar date the caller supplies as `YYYY-MM-DD`.
 *
 * Somebody is a minor while their birthday is LATER than the same date eighteen years ago
 * — one string comparison, no arithmetic on months and no `setUTCMonth` to overflow (the
 * trap `addCadenceSteps` in lib/dues-utils.ts is written around). The eighteenth birthday
 * itself is an adult, which is what "under 18" means.
 *
 * A LEAP-DAY BIRTHDAY RESOLVES ON 1 MARCH in a common year, and that falls out of the
 * comparison rather than being a case: `2009-02-29` is still later than a `…-02-28`
 * cutoff, so the person is a minor for that one extra day. The alternative — treating 28
 * February as the anniversary — would make somebody an adult on a date that is not their
 * birthday.
 */
export function isMinorOn(dob: string | null | undefined, today: string): boolean {
  if (!dob || !today) return false
  return dob.slice(0, 10) > minorCutoff(today)
}

/**
 * The birthday on which somebody turns eighteen, given today — `today` with the year moved
 * back eighteen. Anybody born LATER than this is a minor.
 *
 * ── WHY THIS IS EXPORTED, WHICH IS THE WHOLE REASON IT IS A FUNCTION ────────────────
 * `isMinorOn` answers the question one row at a time, and that is the wrong shape for a
 * QUERY. `lib/chapter-propagation.ts` has to ask the database for a member's children under
 * eighteen, which is `.gt('date_of_birth', minorCutoff(todayLocal()))` — one filter rather
 * than reading every child's birthday back and sieving them in TypeScript.
 *
 * Both callers are then two EXPRESSIONS of ONE rule instead of two rules that agree today.
 * That distinction is the `is_minor` lesson in AGENTS.md §4b restated: what went wrong there
 * was a stored boolean beside a derivation, and what would go wrong here is a hand-written
 * date cutoff beside this comparison — drifting the first time somebody decided a leap-day
 * birthday resolved on 28 February.
 *
 * ── AND THE NULL BEHAVIOUR CARRIES ACROSS, WHICH TAKES NO CODE ──────────────────────
 * `isMinorOn` is FALSE for an unrecorded birthday. A `>` comparison in SQL is likewise never
 * true for a NULL `date_of_birth`, so a person with no birthday on file is excluded by both
 * without either having to say so — which is the answer AGENTS.md argues for at length: "the
 * alternative — treating 'not recorded' as 'a child' — would put a Minor badge on half the
 * Directory and mark the family's elders as children".
 */
export function minorCutoff(today: string): string {
  // Both sides are `YYYY-MM-DD`, so a lexical comparison IS a chronological one. The year is
  // spliced rather than computed through a Date, which is what keeps a 29 February birthday
  // out of `setUTCMonth`'s overflow (the trap `addCadenceSteps` in lib/dues-utils.ts is
  // written around) and out of any timezone at all.
  return `${Number(today.slice(0, 4)) - 18}${today.slice(4)}`
}
