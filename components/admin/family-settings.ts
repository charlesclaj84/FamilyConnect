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

/** Matches the limit create_family() applies, so a family cannot be renamed to
 *  something it could not have been created as. */
export const MAX_FAMILY_NAME = 100
