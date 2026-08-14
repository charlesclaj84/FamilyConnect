export function formatPersonName(p: {
  first_name: string
  last_name: string
  nick_name?: string | null
}): string {
  const base = `${p.first_name} ${p.last_name}`.trim()
  return p.nick_name ? `${base} (${p.nick_name})` : base
}

/**
 * "First Last", with just enough added to tell two people apart.
 *
 * `nickShownSeparately` is for surfaces that PRINT the nickname on its own line — the
 * family tree's cards and the Member Directory, through `<NickName>`. Without it those
 * screens render the nickname twice for a duplicated name: once inside the parentheses
 * this function adds, and again underneath. Passing it skips the nickname branch and
 * falls through to the birth year, which is the other thing that distinguishes two
 * Martha Allens and is not otherwise on the card.
 *
 * It is NOT the default, because the callers that cannot show a second line — every
 * `<option>` in a `<select>`, and the two person pickers — genuinely need the nickname
 * inline or they lose the disambiguation altogether.
 */
export function disambiguatedName(
  p: {
    first_name: string
    last_name: string
    nick_name?: string | null
    date_of_birth?: string | null
  },
  allPeople: { first_name: string; last_name: string }[],
  opts?: { nickShownSeparately?: boolean },
): string {
  const base = `${p.first_name} ${p.last_name}`.trim()
  const hasDupe =
    allPeople.filter(o => o.first_name === p.first_name && o.last_name === p.last_name).length > 1
  if (!hasDupe) return base
  if (p.nick_name && !opts?.nickShownSeparately) return `${base} (${p.nick_name})`
  if (p.date_of_birth) return `${base} (${p.date_of_birth.slice(0, 4)})`
  return base
}
