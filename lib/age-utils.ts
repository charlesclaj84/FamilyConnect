import { todayLocal } from '@/lib/date-utils'

/**
 * Is this person under 18 *today*?
 *
 * THE ONLY DEFINITION, since 20260813000006 dropped `people.is_minor`. There were two
 * before it and they disagreed: the stored column, written `true` only by the retired
 * `addChild`, and this function, which `members.ts` already used at read time — so a
 * child entered with no birthday was stored as a minor and reported as an adult on the
 * next screen.
 *
 * A stored answer is the wrong shape for this question. The row does not change when
 * somebody has a birthday, so a boolean written once is wrong from the morning they turn
 * 18 until somebody notices. Derive it, every time, from the one column that can answer.
 *
 * FALSE FOR AN UNKNOWN BIRTHDAY, deliberately and not as a fallback: `date_of_birth` is
 * optional and most of a real tree has none. The alternative — treating "not recorded" as
 * "a child" — would put a Minor badge on half the Directory and mark the family's elders
 * as children, which is worse in every direction than declining to guess.
 *
 * ── THE CLOCK IS A PARAMETER NOW, AND THE ARITHMETIC MOVED ONTO STRINGS ─────────────
 * Split on 2026-08-20 for AGENTS.md §7b — a pure module with real date edge cases takes
 * `today` as an argument, because that is what makes the edge cases checkable without a
 * browser. This function had none and so had never been tested, and the first two tests
 * written against it both failed.
 *
 * THEY FAILED ON A REAL DEFECT, not on the test being wrong. The old body was
 * `new Date(dob)` compared against `new Date()` through `getFullYear`/`getMonth`/
 * `getDate` — LOCAL accessors over a value parsed as UTC. `date_of_birth` is a bare DATE,
 * so `new Date('2008-08-21')` is UTC midnight and reads back as **20 August** anywhere
 * west of Greenwich. Somebody born on the 21st was therefore counted as an adult a day
 * early for every reader in the Americas and on the correct day for every reader in
 * Europe — the same row, two answers, decided by where the reader happened to be sitting.
 * It is `lib/calendar.ts`'s reunion-on-the-wrong-day trap, on a column where the wrong
 * answer is "this child is an adult".
 *
 * So the comparison is on `YYYY-MM-DD` STRINGS, which have no timezone to get wrong, and
 * that is the same fix `lib/calendar.ts` states at length for the calendar. What changes
 * for existing screens is one day at one boundary: a member is now a minor through the end
 * of the day before their eighteenth birthday, everywhere, and an adult from the birthday
 * itself. Nothing else in the tree moves.
 */
export function computeIsMinor(dob: string | null | undefined): boolean {
  return isMinorOn(dob, todayLocal())
}

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
  // The cutoff is `today` with the year moved back eighteen. Both sides are `YYYY-MM-DD`,
  // so a lexical comparison IS a chronological one.
  const cutoff = `${Number(today.slice(0, 4)) - 18}${today.slice(4)}`
  return dob.slice(0, 10) > cutoff
}
