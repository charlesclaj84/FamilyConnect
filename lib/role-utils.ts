import { formatBoardTitle } from '@/lib/board-positions'

/**
 * One board position a member holds, as `getMyRoles` and `app/actions/members.ts` read it.
 *
 * `chapter_name` CARRIES THE REGION NAME TOO for a regional assignment, which is a quirk of
 * the queries that build this rather than a decision: both read one place name into one
 * column. `formatBoardTitle` takes the two separately, so this passes it under whichever
 * name the scope calls for — see below.
 */
export interface RoleSummary {
  role_name: string
  assignment_scope: string
  chapter_name: string | null
}

/**
 * Delegates to `formatBoardTitle` in `lib/board-positions.ts`, which is the one place this
 * sentence is composed. It was the only copy until 2026-08-20, when Members & Access started
 * printing the same phrase from a different shape.
 */
export function formatRoleTitle(role: RoleSummary): string {
  return formatBoardTitle({
    positionName: role.role_name,
    scope:        role.assignment_scope,
    // The one place name this shape has, handed over as whichever the scope will read.
    chapterName:  role.chapter_name,
    regionName:   role.chapter_name,
  })
}
