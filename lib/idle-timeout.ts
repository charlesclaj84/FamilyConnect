/**
 * The idle sign-out's constants and its one piece of arithmetic, kept out of the component
 * for the same reason `lib/theme.ts` holds `DEFAULT_THEME`: a rule two places have to agree
 * about belongs in neither of them. `components/layout/IdleTimeout.tsx` carries the
 * reasoning about what the feature does and does not cover. This file is the numbers, the
 * boundary, and the two writes to the shared marker that the AUTH screens owe it — see
 * `markIdleActivity` and `clearIdleActivity` at the bottom, and the note above them about
 * why those call sites exist at all.
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

/**
 * THE MARKER OUTLIVES THE SESSION THAT WROTE IT, and this is the rule that stops it
 * deciding anything about the next one.
 *
 * A tab adopts the stored marker on mount so that opening a second tab during an idle
 * stretch inherits the clock instead of resetting it. Adopted unconditionally, it also
 * signs the member out one tick after they sign back IN: the timeout fires, leaves its own
 * 75-minute-old marker in `localStorage`, and the first signed-in page they reach mounts
 * already expired. That was shipped, and it made the sign-out unrecoverable — every
 * sign-in bounced straight back to /login. `localStorage` survives the browser closing
 * too, so the same bounce met anybody returning the next morning.
 *
 * Returns the marker to adopt, or null to start this tab's own clock. Two rejections:
 *
 *   * **Older than the limit.** It cannot describe a live tab, because a live tab signs
 *     ITSELF out on reaching the limit. So an expired marker is always residue — from a
 *     closed browser, or from the sign-out this feature just performed — and residue is
 *     not evidence of somebody sitting idle in a loaded page, which is the only thing
 *     this component measures.
 *   * **In the future.** A clock that moved, not activity. Inheriting it would set a timer
 *     that never fires.
 *
 * NOT SUFFICIENT ON ITS OWN, deliberately: a marker 74 minutes old is inside the window
 * and still residue if the session it belonged to has ended. `clearIdleActivity()` on
 * sign-out and `markIdleActivity()` on sign-in are the other half.
 */
export function inheritedActivity(raw: string | null, now: number): number | null {
  const at = Number(raw)
  // `Number(null)` and `Number('')` are both 0, so the falsy cases fall out here with NaN.
  if (!Number.isFinite(at) || at <= 0) return null
  if (at >= now) return null
  if (now - at >= IDLE_LIMIT_MS) return null
  return at
}

/**
 * ─── The two writes the auth screens owe ────────────────────────────────────────────────
 *
 * They live here rather than at the call sites for the reason the whole file exists: the
 * key is a string, and a `localStorage.removeItem('genorra:last-activity')` typed into a
 * sign-out handler is a copy of it that no rename will ever find.
 *
 * Both fail soft. Private mode and a full store both throw, and neither is a reason to
 * break a sign-in — the in-page timer still works from mount, and only the cross-tab half
 * is lost.
 */

/**
 * Stamp NOW. Signing in is activity, and the strongest signal there is: somebody just
 * typed a password.
 *
 * Called from the sign-in forms rather than from `IdleTimeout`, because by the time that
 * component mounts the marker has already been read — and because whoever used this
 * browser last is not the person now signing in. Their marker must not decide how long
 * this session has been idle.
 */
export function markIdleActivity(at: number = Date.now()): void {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(at))
  } catch {
    // See above.
  }
}

/**
 * Drop the marker, because the session that wrote it is over.
 *
 * Every sign-out that ends THIS browser's session owes this call — the idle timeout, the
 * header button, the invitation-mismatch hatch. The one that must NOT make it is the
 * password panel's `signOut({ scope: 'others' })`, which evicts the other devices and
 * leaves this one signed in and, by definition, with somebody at the keyboard.
 *
 * `SIGNED_OUT_KEY` is deliberately left alone. It is a broadcast rather than state — its
 * only reader is the `storage` event, which fires on the write — so clearing it would
 * announce a second, meaningless change and there is nothing for a stale value to confuse.
 */
export function clearIdleActivity(): void {
  try {
    localStorage.removeItem(ACTIVITY_KEY)
  } catch {
    // See above.
  }
}
