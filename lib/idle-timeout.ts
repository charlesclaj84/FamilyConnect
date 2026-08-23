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
 * 60 minutes: long enough that reading a long announcement, filling in a family tree or
 * watching a chat room is not mistaken for absence, short enough that a signed-in tab left
 * on a shared screen does not stay open all afternoon. Was 10 briefly, which was too
 * aggressive for pages people genuinely sit and read, then 75 for a day — verified in a
 * browser at that value and lowered to 60 on 2026-08-13 to MATCH `jwt_expiry` (3600s in
 * `supabase/config.toml`), so an idle stretch and the life of an access token are one
 * number rather than two that nearly agree.
 *
 * WHAT MATCHING BUYS, and what it does not. It does not make GoTrue do the signing out —
 * nothing here depends on the token expiring, and by measurement it could not: auth-js
 * refreshes when the access token is within ~90s of expiry, so a live tab renews at about
 * t+58.5m and is still perfectly alive when this timer fires at t+60m. That is deliberate,
 * because the sign-out is a real `signOut({ scope: 'local' })` and wants a valid token to
 * revoke with. What it buys is that the window in which a walked-away tab holds a usable
 * token no longer outlives the token itself by a quarter of an hour.
 *
 * The same measurement is why `[auth.sessions] inactivity_timeout` cannot do this
 * component's job at any value: that automatic refresh is client activity, not the
 * person's, so an open tab keeps its session fresh from GoTrue's point of view however
 * long the human has been gone. See the note beside that setting.
 *
 * IF THIS NUMBER MOVES AGAIN, the floor worth knowing is that ~58.5-minute refresh: below
 * it, an idle tab is signed out before auth-js has renewed even once, so the revocation
 * goes out on a token near the end of its life. Nothing breaks — the local session is
 * cleared and the redirect happens either way — but the tie to `jwt_expiry` is gone and
 * this paragraph stops being true.
 */
export const IDLE_LIMIT_MINUTES = 60

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
 * Shown on /login through its existing `?error=` channel, which renders as the brand-soft notice
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
 * What a tab should do with the stored marker when it mounts.
 *
 * THREE ANSWERS AND NOT TWO, since 2026-08-22. This returned `number | null` — a marker to
 * adopt, or nothing — and the missing third answer is what made the timeout fail to fire on
 * a phone at all. See `inheritedActivity`.
 */
export type IdleAdoption =
  /** A live-looking marker from THIS session: inherit its clock instead of restarting. */
  | { kind: 'adopt'; at: number }
  /** THIS session's own marker, past the limit. Nobody has been at the keyboard: sign out. */
  | { kind: 'expired'; at: number }
  /** Nothing usable. Start this tab's own clock from now. */
  | { kind: 'fresh' }

/**
 * THE MARKER OUTLIVES THE SESSION THAT WROTE IT, and this is the rule that stops it
 * deciding anything about the next one.
 *
 * A tab adopts the stored marker on mount so that opening a second tab during an idle
 * stretch inherits the clock instead of resetting it. Adopted unconditionally, it also
 * signs the member out one tick after they sign back IN: the timeout fires, leaves its own
 * hour-old marker in `localStorage`, and the first signed-in page they reach mounts
 * already expired. That was shipped, and it made the sign-out unrecoverable — every
 * sign-in bounced straight back to /login. `localStorage` survives the browser closing
 * too, so the same bounce met anybody returning the next morning.
 *
 * ── WHY "OLDER THAN THE LIMIT → IGNORE" WAS WRONG ON A PHONE ────────────────────────
 * The fix for that bounce was to treat an expired marker as residue and start a fresh
 * clock, on the argument that "a live tab signs ITSELF out on reaching the limit, so an
 * expired marker can never describe one". **That argument assumes the tab is still
 * loaded, and on a phone it is not.** Mobile browsers evict background tabs — iOS Safari
 * aggressively, and Android under memory pressure — so the ordinary mobile sequence is:
 *
 *   member uses the app → backgrounds it → the tab is discarded → hours later they
 *   reopen the browser → the page LOADS AGAIN from scratch → `IdleTimeout` mounts,
 *   finds an expired marker, calls it residue, and starts a brand-new hour.
 *
 * No timer ever ran during those hours, because no page existed to run one. So the member
 * was never signed out, which is what was reported: "mobile doesn't automatically log you
 * out". The desktop half worked all along precisely because a desktop tab stays loaded.
 *
 * ── THE DISCRIMINATOR IS THE SESSION'S OWN SIGN-IN TIME ─────────────────────────────
 * Both cases present identically — an expired marker on a fresh mount — and what tells
 * them apart is whether the marker was written BEFORE or AFTER this session began.
 * `sessionStartedAt` is `user.last_sign_in_at`, resolved on the SERVER by
 * `app/(protected)/layout.tsx` and handed down as a prop, so it cannot be a value the
 * browser chose.
 *
 *   * marker written before the session began → residue from an earlier one. Ignore it;
 *     this is the bounce case, and nothing about a previous session may end this one.
 *   * marker written after, and past the limit → THIS session's own page recorded that
 *     activity and the limit has since passed with nobody at the keyboard. Sign out.
 *
 * ── AND WITH NO SIGN-IN TIME IT KEEPS THE OLD, CONSERVATIVE ANSWER ──────────────────
 * `last_sign_in_at` is optional on the GoTrue user. Where it is missing there is no way to
 * tell the two cases apart, and the two mistakes are not symmetrical: expiring wrongly
 * locks somebody out of a session they just created, while adopting wrongly leaves the
 * existing behaviour in place. So `null` falls through to `fresh`, exactly as before.
 *
 * ── THE NARROW LOOSENING THIS BUYS, STATED RATHER THAN DISCOVERED ───────────────────
 * `last_sign_in_at` belongs to the ACCOUNT, not to one device, so signing in on a phone
 * moves it forward for a laptop too. A laptop tab that was evicted while idle, reloaded
 * after a phone sign-in, therefore reads its own marker as pre-dating "the session" and
 * starts a fresh clock rather than expiring. That is one extra window on a page the member
 * has just loaded themselves, and it is the direction to err in: the alternative reading
 * signs somebody out of a session they are actively using.
 *
 * NOT SUFFICIENT ON ITS OWN, deliberately: `clearIdleActivity()` on sign-out and
 * `markIdleActivity()` on sign-in are still the other half, and they are what keep the
 * marker from describing a session that has ended.
 */
export function inheritedActivity(
  raw: string | null,
  now: number,
  sessionStartedAt: number | null,
): IdleAdoption {
  const at = Number(raw)
  // `Number(null)` and `Number('')` are both 0, so the falsy cases fall out here with NaN.
  if (!Number.isFinite(at) || at <= 0) return { kind: 'fresh' }
  // In the future: a clock that moved, not activity. Inheriting it would set a timer that
  // never fires, and expiring on it would be worse.
  if (at >= now) return { kind: 'fresh' }
  // Older than this session — see above. Checked BEFORE the limit, because a marker that is
  // both stale and pre-session must read as residue rather than as an expiry.
  if (sessionStartedAt !== null && at < sessionStartedAt) return { kind: 'fresh' }
  if (now - at >= IDLE_LIMIT_MS) {
    return sessionStartedAt === null ? { kind: 'fresh' } : { kind: 'expired', at }
  }
  return { kind: 'adopt', at }
}

/**
 * `user.last_sign_in_at` as milliseconds, or null if it is missing or unreadable.
 *
 * Here rather than at the call site so the parse and the rule that consumes it are checked
 * by the same test. `Date.parse` on an ISO-8601 string with an explicit offset (which is
 * what GoTrue sends) is unambiguous — this is the one date in the feature that is a real
 * instant rather than a calendar day, so it is the one place a `Date` is the right tool.
 */
export function sessionStartMs(lastSignInAt: string | null | undefined): number | null {
  if (!lastSignInAt) return null
  const at = Date.parse(lastSignInAt)
  return Number.isFinite(at) ? at : null
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
