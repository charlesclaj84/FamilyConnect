import { createClient } from '@/lib/supabase/client'
import { clearIdleActivity } from '@/lib/idle-timeout'

/**
 * Signing out, in one place.
 *
 * ── WHY IT IS A MODULE AND NOT A HANDLER IN EACH BUTTON ────────────────────────────
 * There were two, character for character: `SignOutButton` (the Heritage band) and
 * `AccountMenu` (the top-bar menu). Both carried the same three decisions and the same
 * three paragraphs of comment explaining them, which is `lib/chapter-propagation.ts`'
 * argument exactly — *a second copy is a second place for one of those decisions to drift.*
 * The moment the destination changed, it had to change twice.
 *
 * ── THE THREE DECISIONS IT OWNS ────────────────────────────────────────────────────
 *
 * **`scope: 'local'` — THIS DEVICE, NOT THE ACCOUNT.** `signOut()` defaults to `'global'`,
 * which revokes every session the account has: signing out on a laptop was also signing the
 * member out of their phone, with nothing on screen suggesting it would. `InviteMismatchActions`
 * states the same rule, and `SignInSecurity` deliberately breaks it the other way with
 * `'others'`, where evicting the other devices is the point. It still revokes this session
 * server-side rather than only clearing the cookie, so it remains a real sign-out.
 *
 * **THE IDLE MARKER IS CLEARED, AND ONLY ON SUCCESS.** `genorra:last-activity` belongs to the
 * session that just ended; left behind it is however old this member's last click was, and the
 * next person to sign in on this browser inherits it. Clearing it after a FAILED sign-out
 * would be worse than leaving it: the session is still live and the idle timer is still the
 * thing guarding it. `lib/idle-timeout.ts` argues both halves.
 *
 * **IT REPORTS FAILURE RATHER THAN NAVIGATING ANYWAY.** gotrue-js clears the local session
 * only after a logout call that succeeded (or returned 401/403/404); on a network failure or a
 * 5xx the session is still live. That used to be invisible, because the destination was Home
 * — which renders perfectly well for a signed-in member. It is not invisible any more: see
 * the destination below.
 */

/**
 * Where a deliberate sign-out lands.
 *
 * ── `/login`, NOT `/` — CHANGED 2026-09-03 ────────────────────────────────────────
 * Both buttons pushed to Home, which is the marketing site: somebody who has just chosen to
 * sign out was shown a page selling them the product, with a "Create Your Free Account"
 * button on it. The login screen is where a sign-out ends, and it is where `IdleTimeout`
 * has always sent people — so this also makes the two ways out of the app agree.
 *
 * **IT IS A CONSTANT BECAUSE THREE THINGS NAVIGATE HERE.** A literal in each button is how
 * one of them ends up somewhere else, which is the whole reason this module exists.
 *
 * No `?error=` and no notice: `IdleTimeout` carries one because being signed out by a timer
 * needs explaining, and pressing "Sign out" does not. `next=` is deliberately absent too —
 * a member who signs out and signs back in should land on their dashboard, not be returned
 * to the screen they chose to leave.
 */
export const SIGN_OUT_DESTINATION = '/login'

/** The bit of `next/navigation`'s router this needs, so `lib/` does not import from it. */
interface Navigator {
  push: (href: string) => void
  refresh: () => void
}

/**
 * Sign this device out and land on the login screen.
 *
 * Returns `false` when the sign-out was refused, having navigated nowhere — the caller shows
 * a message. Pushing to `/login` on a failure would render a login form to somebody who is
 * still signed in, which reads as the button half-working; Home used to hide that.
 */
export async function signOutThisDevice(router: Navigator): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) return false

  clearIdleActivity()
  router.push(SIGN_OUT_DESTINATION)
  router.refresh()
  return true
}
