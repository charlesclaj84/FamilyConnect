export function formatPersonName(p: {
  first_name: string
  last_name: string
  nick_name?: string | null
}): string {
  const base = `${p.first_name} ${p.last_name}`.trim()
  return p.nick_name ? `${base} (${p.nick_name})` : base
}

export function disambiguatedName(
  p: {
    first_name: string
    last_name: string
    nick_name?: string | null
    date_of_birth?: string | null
  },
  allPeople: { first_name: string; last_name: string }[]
): string {
  const base = `${p.first_name} ${p.last_name}`.trim()
  const hasDupe =
    allPeople.filter(o => o.first_name === p.first_name && o.last_name === p.last_name).length > 1
  if (!hasDupe) return base
  if (p.nick_name) return `${base} (${p.nick_name})`
  if (p.date_of_birth) return `${base} (${p.date_of_birth.slice(0, 4)})`
  return base
}
