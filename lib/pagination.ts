/**
 * Shared paging constant.
 *
 * Lives outside app/actions because a `'use server'` module may only export async
 * functions — a plain const there is a build error. Both the server actions and
 * the client controls need this value, so it belongs in a neutral module.
 */
export const MEMBER_PAGE_SIZE = 25
