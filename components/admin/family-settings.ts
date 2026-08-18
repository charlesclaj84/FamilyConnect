/**
 * The vocabulary of Family Settings, in a plain module because a `'use server'` file
 * may only export async functions — so the resource key the action gates on and the
 * page guards on cannot live beside either of them.
 *
 * Same arrangement, and the same reason, as LEDGER_RESOURCE in
 * components/transactions/ledgers.ts: one table binding the surface to the permission
 * key, so the page, the action and the RLS policy cannot drift into disagreeing about
 * which grant decides this screen.
 */

/**
 * The one resource key governing the page, its fetch and its one write.
 *
 * Registered by 20260812000000 with actions view + edit only. There is no `create`
 * because families are created from /my-families by any member, and no `delete`
 * because deleting a family is not built — nothing has a foreign key to `families`,
 * so a DELETE would remove one row and orphan the other 34 tables' worth.
 */
export const FAMILY_RESOURCE = 'admin/family'

/**
 * The separate grant that admits removing the family, declaring the single action
 * `delete` (20260817000006 §4).
 *
 * NOT a third action on `admin/family`, and the reason is worth keeping beside the key
 * rather than only in the migration: 20260812000000 deliberately narrowed that resource to
 * view + edit, DELETEs any create/delete grant for it, and asserts none exists. Folding
 * removal in there would put this code in conflict with an applied assertion — and, more
 * to the point, would make the grant to RENAME a family the grant to END it.
 *
 * There is no `view`. Removal has no screen of its own: the control lives at the bottom of
 * /admin/family, which has its own view grant, so a view switch here would be a control
 * nothing reads.
 */
export const REMOVE_FAMILY_RESOURCE = 'admin/family/remove'

/** Matches the limit create_family() applies, so a family cannot be renamed to
 *  something it could not have been created as. */
export const MAX_FAMILY_NAME = 100
