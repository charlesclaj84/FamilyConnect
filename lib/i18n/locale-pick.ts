import { LOCALE_PICK_COOKIE, LOCALE_PICK_MAX_AGE } from '@/lib/i18n/route-locale'

/**
 * Record that a visitor CHOSE this language, rather than being negotiated for.
 *
 * ── WHY IT IS A MODULE AND NOT THREE LINES IN THE PICKER ────────────────────────────
 * Two reasons, and the first is the one that forced it. React Compiler's immutability rule
 * refuses `document.cookie = …` inside a component or a hook — correctly: a write to a global
 * from a render-adjacent function is exactly the shape it exists to catch, and the fact that
 * this one happens in an event handler is not something the rule can see. A plain function in
 * its own module is outside that analysis and is also just the honest place for it.
 *
 * The second is reachability. `lib/i18n/route-locale.ts` holds the cookie's NAME because
 * `proxy.ts` has to read it, and `proxy.ts` runs at the edge where there is no `document`. A
 * browser-only write in that module would be dead code on two of its three consumers. So the
 * constants are shared and the write lives here, imported by the one component that does it.
 *
 * ── BEST EFFORT, DELIBERATELY ───────────────────────────────────────────────────────
 * A browser refusing cookies still navigates, and the only cost is being negotiated for again
 * on the next unprefixed path — a worse experience, not a broken one. `document.cookie` throws
 * in a sandboxed frame rather than failing quietly, which is the case the catch is for.
 */
export function rememberLocalePick(code: string): void {
  try {
    document.cookie =
      `${LOCALE_PICK_COOKIE}=${code}; path=/; max-age=${LOCALE_PICK_MAX_AGE}; samesite=lax`
  } catch {
    // The navigation is what matters. See the header.
  }
}
