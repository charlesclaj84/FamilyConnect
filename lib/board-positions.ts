import type { T } from '@/lib/i18n/t'

/**
 * The vocabulary a board position is described in.
 *
 * ── WHY THIS IS A MODULE OF ITS OWN ─────────────────────────────────────────────────
 * The two arrays below started life in `app/actions/admin/chapters.ts`, beside the actions
 * that validate against them, and **that does not build**: a `'use server'` file may export
 * only async functions, and `next build` refuses it with "A 'use server' file can only export
 * async functions, found object." Types are fine there — they do not exist at runtime — so the
 * failure is specifically about the two `const` arrays and about nothing else.
 *
 * It is a better home anyway, for the reason the file it left already has three of: the
 * category and the scope are a VOCABULARY, read by the action that validates a create, by the
 * screen that offers the options, and by the labels that print them. One definition, imported
 * by all three, is what stops the third from drifting — which is the same argument
 * `lib/role-utils.ts` makes about formatting a title.
 *
 * ── THE LISTS ARE THE DATABASE'S ────────────────────────────────────────────────────
 * `family_roles_category_check` and `family_roles_scope_check` (20260604000000 and
 * 20260604000002) hold exactly these values. Adding one here without a migration produces a
 * screen that offers an option every insert then refuses with a raw 23514, so the two move
 * together or not at all.
 */

/** `family_roles.category` — the CHECK constraint's values, in the order the form offers them. */
export const POSITION_CATEGORIES = ['executive_officer', 'appointed_position'] as const

/** `family_roles.scope` — likewise. `national` is the default and the commonest by far. */
export const POSITION_SCOPES = ['national', 'regional', 'chapter'] as const

export type PositionCategory = (typeof POSITION_CATEGORIES)[number]
export type PositionScope = (typeof POSITION_SCOPES)[number]

/**
 * The longest a position name may be.
 *
 * The database has no opinion — `family_roles.name` is `TEXT` and only refuses a blank
 * (`family_roles_name_not_blank`, 20260819000004). This is the screen's, and it is enforced
 * server-side as well as on the input, because the client is not in the request path.
 */
export const POSITION_NAME_MAX = 80

/**
 * A position's category and scope, in the reader's language.
 *
 * FUNCTIONS TAKING `t` rather than maps, so this module stays pure — the `T` import is
 * type-only and erased, and `npm test` still reaches the phrase-building below without
 * React. The IDS are `family_roles.category` and `user_roles.scope`; only the words moved.
 */
export function positionCategoryLabel(t: T, category: PositionCategory): string {
  return t(`pos.cat.${category}`)
}

export function positionScopeLabel(t: T, scope: PositionScope): string {
  return t(`pos.scope.${scope}`)
}

/**
 * A held position as one phrase — "National President", "Austin Chapter Treasurer".
 *
 * ── WHY IT LIVES HERE AND NOT AT EITHER CALL SITE ──────────────────────────────────
 * Three surfaces print this string and they read from two different shapes. The Member
 * Directory gets it precomputed on the server (`MemberRecord.primary_role_title`, built from
 * a `user_roles` row); Members & Access builds it in the browser from a
 * `BoardPositionHolder`; and `getMyRoles` feeds the Dashboard from a third. Before this,
 * `formatRoleTitle` in `lib/role-utils.ts` was the only copy and the other two either
 * borrowed its shape or invented their own — which is how "Eastern Region President" and
 * "Regional President" both came to be things this product says.
 *
 * `formatRoleTitle` now delegates here, so there is one sentence and one place to change it.
 *
 * ── THE SCOPE DECIDES WHICH PLACE IS NAMED, AND ONLY ONE OF THEM IS EVER SET ────────
 * A `user_roles` row carries `chapter_id` OR `region_id` according to its scope, never both,
 * so the two are separate parameters rather than one "place". Passing the wrong one is then a
 * missing name rather than a wrong one — "Chapter Treasurer" instead of "Austin Region
 * Treasurer", which is vague where the other is false.
 *
 * A NATIONAL POSITION SAYS "National" rather than nothing, for `whereOf`'s reason and the
 * same reason a nationally scoped due does: National is somewhere, not nowhere.
 */
export function formatBoardTitle(input: {
  positionName: string
  scope: PositionScope | string
  chapterName?: string | null
  regionName?: string | null
}): string {
  const { positionName, scope, chapterName, regionName } = input
  if (scope === 'chapter') return `${chapterName ?? 'Chapter'} Chapter ${positionName}`
  if (scope === 'regional') {
    return regionName ? `${regionName} Region ${positionName}` : `Regional ${positionName}`
  }
  return `National ${positionName}`
}
