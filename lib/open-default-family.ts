import { openDefaultFamily } from '@/app/actions/family'

/**
 * Point the active family at the login default, and NEVER let that stop a sign-in.
 *
 * ── THE BUG THIS EXISTS TO CLOSE, WHICH SHIPPED AND BROKE LOGIN ────────────────────
 * `20260902000002` made `default_family_code` mean something, and the four sign-in flows
 * each grew one line:
 *
 *     await openDefaultFamily()
 *     router.push(next)
 *
 * `openDefaultFamily`'s own header says *"it never reports a failure to the caller"* and it
 * is careful to read `error` and swallow it — which is true of everything that happens INSIDE
 * the action and says nothing about the action CALL. A server action is a `fetch` to a URL,
 * and it can reject for reasons its body never sees:
 *
 *   * **A deployed build the open page does not know about.** The browser posts the action id
 *     it was rendered with; a page loaded before a deploy posts an id the new server has never
 *     heard of and Next rejects it. Somebody sitting on the login screen across a deploy —
 *     which is exactly who is sitting on the login screen — presses Sign in and gets this.
 *   * A 500 from the function, a cold start that times out, a dropped connection, a proxy in
 *     front of it.
 *
 * An unhandled rejection there means `router.push(next)` never runs. The credentials were
 * accepted, GoTrue recorded the sign-in, and the page does not move — no error message
 * either, because `serverError` was cleared at the top of the handler and nothing set it.
 * Reported as: **I cannot log in.**
 *
 * ── WHY A MODULE AND NOT A `try` AT EACH CALL SITE ─────────────────────────────────
 * There are four sign-in flows and a fifth owes a call (see the action's header). A line every
 * caller has to remember is a line one caller will not have — the same argument `requireView`
 * makes for folding `requireTier` in, and `lib/chapter-propagation.ts` makes for being a
 * module rather than a second copy. This is the only supported way to make the call.
 *
 * ── IT IS STILL AWAITED, AND THAT IS DELIBERATE ────────────────────────────────────
 * Not fired and forgotten. The page being navigated to resolves its family SERVER-SIDE, so a
 * call still in flight when `router.push` runs renders the family the member was last in —
 * which is the bug `20260902000002` fixed, reappearing as a race. Awaiting a call that cannot
 * fail costs one round trip on a screen that has just made several.
 *
 * ── AND THE COST OF FAILURE IS ONE PRESS OF THE FAMILY SWITCHER ────────────────────
 * Which is why swallowing is right rather than merely convenient. The member is signed in;
 * they are looking at a family they belong to; it may be the one they were last in rather than
 * the one they nominated. Refusing the sign-in over that would be the product withholding the
 * thing they asked for because a preference could not be applied.
 */
export async function openDefaultFamilySafely(): Promise<void> {
  try {
    await openDefaultFamily()
  } catch (e) {
    // Logged, never surfaced. A browser console line is the right place: it is the only
    // audience for a failure that has no consequence the member can act on.
    console.error('[family] could not open the login default:', e)
  }
}
