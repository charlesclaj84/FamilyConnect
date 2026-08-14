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
 */
export function computeIsMinor(dob: string | null | undefined): boolean {
  if (!dob) return false
  const birth = new Date(dob)
  const today = new Date()
  const age = today.getFullYear() - birth.getFullYear() -
    (today.getMonth() < birth.getMonth() ||
     (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate()) ? 1 : 0)
  return age < 18
}
