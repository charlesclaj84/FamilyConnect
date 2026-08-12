/**
 * Reading PostgREST embeds without `any`.
 *
 * This client is untyped — there are no generated `Database` types — so every
 * `.select('*, people(first_name, last_name)')` comes back as `any`, and the way that got
 * written down 26 times was `(row.people as any).first_name`. That reads as a shrug, and it
 * costs more than tidiness: an `any` spread or cast switches off excess-property checking
 * for the whole expression around it, which is how `createSubEvent` came to be handed a
 * `budget_amount_cents` it does not accept and silently drops.
 *
 * Name the shape instead:
 *
 *     const uploader = embedOne<PersonNameRow>(photo.people)
 *     const tags     = embedMany<{ person_id: string }>(photo.photo_tags)
 *
 * WHY THESE NORMALISE ARRAY-VS-OBJECT, which is the part worth knowing.
 * PostgREST decides an embed's cardinality from the constraint it resolved, so the same
 * relationship is a bare object in one query and a one-element array in another — a
 * to-one embed reached through a join table, or one whose FK it could not prove unique,
 * arrives wrapped. `(row.people as any).first_name` is `undefined` in that case, with no
 * error anywhere: the name renders blank and nothing says why. Handling both here means a
 * call site cannot be wrong about which it got.
 *
 * These are casts, not validators. They assert a shape the caller already knows from the
 * `.select()` string a few lines above, which is the only place that truth exists while the
 * client is untyped. They do not parse, and they must not be used on anything whose shape
 * is genuinely unknown — see AGENTS.md §8 for what actually goes wrong with embeds, and
 * note that neither of these can save a query PostgREST refused outright (PGRST200/201):
 * that returns no rows at all, and the fix is naming the constraint in the select.
 */

/** The person embed this codebase reaches for most. */
export type PersonNameRow = { first_name: string; last_name: string }

/** A to-one embed: the row, or null when the join found nothing. */
export function embedOne<T>(value: unknown): T | null {
  if (value == null) return null
  if (Array.isArray(value)) return (value[0] ?? null) as T | null
  return value as T
}

/** A to-many embed: always an array, empty when the join found nothing. */
export function embedMany<T>(value: unknown): T[] {
  if (value == null) return []
  return (Array.isArray(value) ? value : [value]) as T[]
}
