/**
 * The idle sign-out's constants and its one piece of arithmetic, kept out of the component
 * for the same reason `lib/theme.ts` holds `DEFAULT_THEME`: a rule two places have to agree
 * about belongs in neither of them. `components/layout/IdleTimeout.tsx` is the only
 * consumer today, and it carries the reasoning about what the feature does and does not
 * cover. This file is the numbers and the boundary.
 */

/**
 * THE PRODUCT DECISION, and the only place it is stated. Everything else — the
 * milliseconds, the notice on /login — derives from this, so the number and the sentence
 * telling a member what happened cannot drift apart.
 *
 * 75 minutes: long enough that reading a long announcement, filling in a family tree or
 * watching a chat room is not mistaken for absence, short enough that a signed-in tab left
 * on a shared screen does not stay open all afternoon. Was 10 briefly, which was too
 * aggressive for pages people genuinely sit and read.
 *
 * ONE INTERACTION TO KNOW ABOUT: this is longer than `jwt_expiry` (3600s in
 * `supabase/config.toml`), so an access token expires partway through an idle stretch and
 * the client's `autoRefreshToken` renews it. That is fine and is why the page is still
 * alive when the timer fires — but it also means an open tab keeps its session fresh from
 * GoTrue's point of view no matter how idle the human is, which is exactly why
 * `[auth.sessions] inactivity_timeout` cannot do this component's job. See the note beside
 * that setting.
 */
export const IDLE_LIMIT_MINUTES = 75

export const IDLE_LIMIT_MS = IDLE_LIMIT_MINUTES * 60 * 1000

/**
 * How long the warning is on screen before the sign-out. It comes OUT OF the limit rather
 * than being added to it, so the member is signed out at `IDLE_LIMIT_MINUTES` either way
 * and the warning is the last minute of it.
 */
export const WARN_BEFORE_MS = 60 * 1000

/** Cheap enough to run for the life of the page, and fine enough for a live countdown. */
export const TICK_MS = 1_000

/**
 * Activity in ANY tab counts, shared through `localStorage`. Without this, reading in one
 * tab signs you out of the other — and the sign-out revokes the session the browser
 * shares, so the tab you were actually using dies too.
 */
export const ACTIVITY_KEY = 'genorra:last-activity'

/** Written when the timeout fires, so other tabs follow instead of showing a dead page. */
export const SIGNED_OUT_KEY = 'genorra:idle-signed-out'

/** A pointer or wheel event must not write to localStorage on every tick of the hand. */
export const WRITE_THROTTLE_MS = 5_000

/**
 * Shown on /login through its existing `?error=` channel, which renders as an amber notice
 * rather than a red failure — the right register for "this is expected, sign in again".
 */
export const TIMEOUT_NOTICE =
  `You were signed out after ${IDLE_LIMIT_MINUTES} minutes without activity. Sign in to pick up where you left off.`

export type IdlePhase =
  | { phase: 'active' }
  | { phase: 'warn'; secondsLeft: number }
  | { phase: 'expired' }

/**
 * Which of the three states a given idle duration is in.
 *
 * Pure, and takes the elapsed time rather than reading the clock, because the caller
 * computes it from `Date.now()` against a wall-clock marker — a countdown that decremented
 * itself would resume with time left on it after a laptop slept through the window, which
 * is the one case where getting it wrong keeps somebody signed in.
 *
 * `secondsLeft` never reports 0: a countdown showing "0 seconds" for a whole tick before
 * anything happens reads as broken, so the last second displays as 1 and the following
 * tick expires.
 */
export function idlePhase(idleMs: number): IdlePhase {
  if (idleMs >= IDLE_LIMIT_MS) return { phase: 'expired' }
  if (idleMs >= IDLE_LIMIT_MS - WARN_BEFORE_MS) {
    return { phase: 'warn', secondsLeft: Math.max(1, Math.ceil((IDLE_LIMIT_MS - idleMs) / 1000)) }
  }
  return { phase: 'active' }
}
