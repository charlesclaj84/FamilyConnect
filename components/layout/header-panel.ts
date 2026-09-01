'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'

/**
 * The geometry every panel hanging off the app header shares.
 *
 * Both panels — the family switcher and the notification bell — anchor to a trigger
 * sitting in the END cluster of a header whose controls run out to the edge of the
 * screen. That is the trap: `absolute end-0` measures from the trigger, not from the
 * viewport, so a 20rem panel opened from a bell that already sits ~110px in from that
 * edge starts 55px off the OTHER side of a 375px screen. Capping the width does not
 * save it either — the panel is still as wide as it is and still anchored where it is;
 * it just runs off the far side more slowly.
 *
 * ── `end-0` AND NOT `right-0`, SINCE THE 2026-09-01 LAYOUT PASS ─────────────────────
 * The classes here were `right-0` / `left-3 right-3` and the prose said RIGHT-HAND, which was
 * true of every reader this product has. In a right-to-left language the header's controls
 * cluster on the LEFT, and a panel anchored `right-0` would hang off the far side of the
 * screen from its own trigger. The logical property mirrors with `dir` and nothing here asks
 * which direction it is in — `npm run i18n:rtl` is what keeps that true.
 *
 * So below `sm` the panel stops being a dropdown and becomes a sheet: `fixed`, pinned
 * under the header, inset from both edges, so its width is the screen's and there is no
 * anchor left to overflow from. From `sm` up it goes back to hanging off its trigger,
 * where there is room for it.
 *
 * `fixed` inside the header resolves against the VIEWPORT and not the header, because
 * `position: sticky` does not create a containing block for fixed descendants — only
 * transform, filter and will-change do, and the header has none of them. It does stay
 * inside the header's stacking context, which is what keeps it above the sidebar's
 * drawer; see the stacking table in TopBar.
 *
 * Height is capped in `dvh`, not `vh`. On a phone `vh` is the LARGE viewport — the one
 * you get with the address bar scrolled away — so a `vh` cap lets the bottom of a full
 * panel sit underneath browser chrome that is currently on screen.
 *
 * Callers add their own `sm:w-*`, and are responsible for the internals: this is a
 * `flex flex-col` with `overflow-hidden`, so a scrolling region inside it needs
 * `min-h-0 flex-1 overflow-y-auto` and everything else needs `shrink-0`.
 */
export const HEADER_PANEL_CLASS = [
  // Mobile: a sheet under the header. 4.25rem (68px) clears the h-16 bar and the 2px
  // Legacy gold rule that replaced its 1px border, leaving a 2px breath. If the header's
  // edge gets thicker again, this and the Sidebar's two `calc(4rem + 2px)` offsets move
  // together — they are the same measurement written three times.
  // The underscores are Tailwind's escape for the spaces `calc()` requires around a
  // `-`; `calc(100dvh-5.5rem)` is not valid CSS. Same convention as the Sidebar's
  // `top-[calc(4rem_+_1px)]`.
  'fixed start-3 end-3 top-[4.25rem] max-h-[calc(100dvh_-_5.5rem)]',
  // Desktop: back to a dropdown hanging off the trigger.
  'sm:absolute sm:start-auto sm:end-0 sm:top-full sm:mt-1 sm:max-h-[min(60vh,32rem)]',
  // Shared chrome. z-30 ranks it against the backdrop (z-20) inside the header's own
  // stacking context — it is not competing with the page.
  'z-30 flex flex-col overflow-hidden rounded-xl border bg-card shadow-lg',
].join(' ')

/** The click-away scrim behind either panel. Below the panel, above the header's bar. */
export const HEADER_PANEL_SCRIM_CLASS = 'fixed inset-0 z-20'

/**
 * Close an open header panel when the page underneath it changes.
 *
 * THE BUG THIS FIXES. `TopBar` is rendered by `app/(protected)/layout.tsx`, so it does
 * not unmount on navigation — and neither does the `open` flag in any of the three
 * panels hanging off it. Open the account menu, go to another page, and the menu is
 * still sitting there over a screen it no longer has anything to do with.
 *
 * The scrim is not the answer, and it is worth saying why, because it looks like it
 * ought to be: `HEADER_PANEL_SCRIM_CLASS` covers the viewport and closes on click, but
 * the sidebar is not underneath it. `<main>` carries `isolate`, which scopes the
 * header's `z-30` — and everything inside it, this scrim included — to main's own
 * stacking context, while the rail's sticky block is `z-10` in the ROOT one. A positive
 * z-index in the root context paints after a z-auto subtree, so the rail sits ON TOP of
 * the scrim and its links stay clickable with a panel open. That is the route into the
 * bug: click the avatar, then click a page in the rail.
 *
 * Anything reached without a click — Back, Forward, a redirect, the idle timeout — has
 * never gone through the scrim either, so this is the general answer rather than a patch
 * over that one route.
 *
 * ADJUSTED DURING RENDER, not in an effect. This is React's documented pattern for
 * "reset some state when a prop changes": compare against the value the state was
 * computed for and set during render, which React resolves before it commits anything.
 * An effect would paint one frame of the new page with the old page's menu still open,
 * and it is the cascading render `react-hooks/set-state-in-effect` exists to stop. The
 * sidebar's `NavTree` and `MobileNav` both do exactly this, for exactly this reason.
 *
 * `close` is called during the render of the component that owns the state, which is
 * the one place React permits a render-phase update.
 */
export function useCloseOnNavigate(open: boolean, close: () => void) {
  const pathname = usePathname()
  const [seenPathname, setSeenPathname] = useState(pathname)
  if (seenPathname !== pathname) {
    setSeenPathname(pathname)
    if (open) close()
  }
}
