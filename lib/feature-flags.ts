/**
 * Switches for features that are BUILT but not currently offered.
 *
 * Distinct from `lib/features.ts`, which is a registry of ROUTES and drives the
 * sidebar, the Coming Soon gate and the permission resource keys. These are behaviours
 * with no route of their own, turned off without deleting them.
 *
 * A flag here must be read by the SERVER ACTION as well as by whatever renders the
 * control. Hiding a button turns nothing off: every `'use server'` export has a URL and
 * stays callable by anyone signed in, whatever the UI does (AGENTS.md §5). A flag that
 * only reaches the JSX is a feature that still works for anyone who knows the endpoint.
 */

/**
 * "Were you already added to the family?" — the dashboard banner that offers a
 * newly-registered member a list of unlinked `people` rows and lets them claim one as
 * themselves. `getLinkPersonBannerData` + `linkPersonToCurrentUser`.
 *
 * OFF (2026-08-07). Parked rather than deleted; see TODO.md for what has to be decided
 * before it comes back.
 *
 * The short version of why it is not simply "hidden": the banner shows a registrant the
 * first names, last names and birth dates of every unlinked person in the family, and
 * claiming one moves an existing record — which may already carry dues history,
 * payments, relationships and photo tags — onto the claimant's account. What it asks
 * the user to prove is "which of these is me?", and the answer is self-asserted. It is
 * the same shape as the claim-by-email block Phase 3 deleted from register.ts, one step
 * further along: there the match was automatic, here it is a menu.
 */
export const LINK_EXISTING_PERSON_ENABLED = false
