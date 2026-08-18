import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Who may open the GENORRA staff console, and the guard every staff surface calls.
 *
 * The app-layer half of `20260817000005`. That migration created `public.genorra_staff`
 * and `public.is_genorra_staff()`; this is what the console asks, and everything about
 * it is deliberately narrow — one table, one boolean, no families anywhere in it.
 *
 * ── WHY STAFFNESS IS NOT A `permission_resources` RESOURCE ──────────────────────────
 * The reflex on reading "a new permissioned surface" is AGENTS.md §6: register the key,
 * backfill `resource_visibility`, backfill the system templates. None of that applies
 * here, and doing it would be a security bug rather than an omission. Three reasons, in
 * the order they matter:
 *
 *   * **It is not something a family administers.** Every row in `permission_resources`
 *     is a switch on the Members & Access grid, and that grid belongs to ONE family's
 *     administrator. "Can this person see every family on the platform" is not a decision
 *     a customer gets to make about their own employee, and a model that let them express
 *     it would be wrong in whichever direction it resolved.
 *   * **It is orthogonal to the whole permission model.** `auth_permission()` resolves a
 *     grant on a template that belongs to a family, so every answer it can give is
 *     already scoped to one. Staffness is the property of having NO family scope — there
 *     is no family for the grant to hang off, and a staff member need not be a member of
 *     anything at all.
 *   * **Registering it would ANNOUNCE it.** `getResources()` builds the grid from that
 *     table, so a `staff` row would print a "GENORRA Staff" switch on the settings screen
 *     of every family in the product. The console 404s a non-staff caller precisely so it
 *     does not advertise that it exists (see `requireStaff` below); publishing its name
 *     in every customer's admin UI would give that away on the one screen administrators
 *     read most carefully.
 *
 * The same argument is why `is_genorra_staff()` is granted to nobody in the database and
 * why `app/(staff)` carries no resource key — see the migration's header, which sets the
 * three reasons out at length, and AGENTS.md §2b on why a function `authenticated` may
 * execute shows up in PostgREST's OpenAPI document.
 *
 * ── WHY THE SERVICE ROLE IS REQUIRED, NOT CONVENIENT ────────────────────────────────
 * `genorra_staff` has RLS enabled and NO POLICY AT ALL. That is its access model rather
 * than an oversight: a table in that state returns no rows to any role that is neither
 * its owner nor BYPASSRLS, for every statement, with no expression anyone can later
 * widen. So `anon` and `authenticated` cannot read it, cannot count it, and cannot
 * discover whether a given account is on it — which matters, because the list of people
 * who can see every family in the product is exactly the list an attacker wants next.
 *
 * `createAdminClient()` is the service role and bypasses RLS, so it is the ONLY way to
 * ask. AGENTS.md §3's usual obligation — re-apply by hand what RLS would have done —
 * is discharged here by the query itself: it is `.eq('user_id', userId)` against a table
 * with no family scoping to re-apply, and the id comes from `auth.getUser()` rather than
 * from a caller. No parameter reaches this from the browser.
 */

/**
 * The vocabulary `genorra_staff.role` is checked against, mirroring the CHECK constraint
 * in `20260817000005`.
 *
 * NOTHING READS IT YET, and that is deliberate on both sides of the wire: the console's
 * first pass is read-only over families and accounts plus one restore, so every staff
 * member needs the same access, and a check on this column would be a control nothing
 * consults — exactly what `20260808000000` spent a section removing from
 * `permission_resources.actions`. It is surfaced here so the screen can PRINT it (a list
 * of who has access is worth reading beside what kind of access they have), and so that
 * whatever starts enforcing it later finds the vocabulary already agreed in one place.
 */
export type StaffRole = 'support' | 'engineer' | 'owner'

/** The staff member behind the current request, as `requireStaff()` resolves them. */
export interface StaffCaller {
  userId: string
  /** From `auth.users`, for the console to name whose session it is. May be ''. */
  email: string
  role: StaffRole
}

interface StaffRow {
  user_id: string
  role: string | null
}

/**
 * A named account's staff grant, or `null` when it has none.
 *
 * THE PAIR BELOW MIRRORS THE DATABASE'S OWN PAIR, and for the same reason: `20260817000005`
 * defines `is_genorra_staff(uuid)` as the single definition and lets `is_genorra_staff()`
 * delegate to it, so there is exactly one expression answering "is this account staff".
 * Here the id-taking form is the one that reads the table and the boolean delegates, so
 * there is exactly one query — and `cache()` is on THIS function rather than on both, or
 * two callers in one request would make two round trips to answer the same question.
 *
 * `cache()` is per request (React's, not a cross-request cache), which is what makes it
 * safe: the protected layout, the staff layout, every staff page and every staff action
 * all ask, and none of them may see an answer resolved for a different session. Revoking
 * a grant therefore takes effect on the next request, with nothing to invalidate — the
 * same property the migration's header claims for `is_genorra_staff()` being STABLE
 * rather than IMMUTABLE.
 */
export const staffGrant = cache(async (userId: string): Promise<StaffRole | null> => {
  if (!userId) return null

  const { data, error } = await createAdminClient()
    .from('genorra_staff')
    .select('user_id, role')
    .eq('user_id', userId)
    .maybeSingle()

  // THE ERROR IS READ, NOT DISCARDED (AGENTS.md §8), and the two outcomes mean opposite
  // things that `data` cannot tell apart. `null` from `maybeSingle()` is the ordinary
  // answer — "this account is not staff", which is true of every customer — while a
  // refused query means we have no idea and are denying out of ignorance. The failure
  // that makes this worth logging is the one `getMyFamilies` already hit: a database
  // behind on migrations answers PostgREST 42P01 for a table that does not exist yet,
  // every staff surface 404s, and nothing anywhere says why.
  //
  // It still denies. Failing closed is right for a console that sees every family; the
  // point of the log is that somebody can find out why in less than an hour.
  if (error) {
    console.error(
      `[staff] could not resolve the staff grant for ${userId}: ${error.message}. `
      + 'The staff console will 404 for everyone until this is fixed. If this is '
      + '"relation \\"genorra_staff\\" does not exist", the app is running against a '
      + 'database that is behind supabase/migrations — 20260817000005 creates it.',
    )
    return null
  }

  const row = data as StaffRow | null
  if (!row) return null

  // Narrowed rather than cast. The CHECK constraint already confines the column to these
  // three, so this can only fire against a database whose constraint has been changed
  // without this file hearing about it — and in that case denying is the safe direction,
  // which a bare cast would not give us.
  return isStaffRole(row.role) ? row.role : null
})

/** True when `role` is one of the three the database admits. Narrows, so no cast. */
function isStaffRole(role: unknown): role is StaffRole {
  return role === 'support' || role === 'engineer' || role === 'owner'
}

/**
 * Is this account GENORRA staff?
 *
 * The boolean form, for callers that only need to decide whether to render something —
 * today that is the launcher in the account menu, resolved in `app/(protected)/layout.tsx`
 * and passed down as a prop. It shares `staffGrant`'s memoization, so asking both in one
 * request costs one query.
 *
 * IT TAKES AN ID BECAUSE ITS CALLER ALREADY HAS ONE. Everywhere it is used, the caller has
 * just resolved `auth.getUser()` for its own reasons, and re-resolving the session inside
 * here would be a second GoTrue round trip to learn something the caller already knows.
 * The id never arrives from a client: it comes from a verified session, exactly as
 * `viewableResources(user.id)` beside it does.
 */
export async function isGenorraStaff(userId: string): Promise<boolean> {
  return (await staffGrant(userId)) !== null
}

/**
 * The guard for every staff surface: the layout, each page, and each server action.
 *
 * ── IT 404s, AND NEVER RENDERS A DENIAL ─────────────────────────────────────────────
 * `notFound()` for an anonymous caller, for a signed-in member, and for a staff grant
 * that could not be resolved — three cases, one indistinguishable answer. That is the
 * same choice `requireView` makes for a restricted page and it is sharper here: a screen
 * saying "you are not GENORRA staff" tells any signed-in customer that a cross-family
 * console exists, what it is called, and that the way in is an account flag. A 404 tells
 * them the URL is not a page, which is what every other unrouted path in the app says.
 *
 * Deliberately NOT a redirect to /login for the anonymous case, which is what §1's
 * preamble does for member pages. A redirect is an admission that something is there to
 * sign in to; and there is no sign-in that would help, because ordinary registration
 * cannot produce a staff grant — rows in `genorra_staff` are inserted by hand with SQL.
 *
 * ── IT IS CALLED AT THE LAYOUT *AND* AT EVERY PAGE AND ACTION ───────────────────────
 * Not defensive repetition — the same argument AGENTS.md §2 makes about pages and server
 * actions. A layout guard is a convenience: it runs when Next renders that layout, and a
 * server action reached by POST does not render it at all. A page's own call is what
 * holds when somebody adds a route under `app/(staff)` and Next resolves it through a
 * different layout, or when a future partial render skips one. Each surface gates itself.
 *
 * Returns the caller so the console can say whose session it is and, when something
 * starts reading `role`, what kind of access they hold.
 */
export async function requireStaff(): Promise<StaffCaller> {
  // The USER client, so the session is resolved from the caller's own cookies and
  // verified by GoTrue — `getUser()` and not `getSession()`, which would trust a JWT the
  // browser handed us. The admin client below is for the table only.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const role = await staffGrant(user.id)
  if (!role) notFound()

  return { userId: user.id, email: user.email ?? '', role }
}
