/**
 * The geometry every panel hanging off the app header shares.
 *
 * Both panels — the family switcher and the notification bell — anchor to a trigger
 * sitting in the RIGHT-HAND cluster of a header whose controls run out to the edge of
 * the screen. That is the trap: `absolute right-0` measures from the trigger, not from
 * the viewport, so a 20rem panel opened from a bell that already sits ~110px in from
 * the right edge starts 55px off the LEFT of a 375px screen. Capping the width does not
 * save it either — the panel is still as wide as it is and still anchored where it is;
 * it just runs off the other side more slowly.
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
  'fixed left-3 right-3 top-[4.25rem] max-h-[calc(100dvh_-_5.5rem)]',
  // Desktop: back to a dropdown hanging off the trigger.
  'sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-1 sm:max-h-[min(60vh,32rem)]',
  // Shared chrome. z-30 ranks it against the backdrop (z-20) inside the header's own
  // stacking context — it is not competing with the page.
  'z-30 flex flex-col overflow-hidden rounded-xl border bg-card shadow-lg',
].join(' ')

/** The click-away scrim behind either panel. Below the panel, above the header's bar. */
export const HEADER_PANEL_SCRIM_CLASS = 'fixed inset-0 z-20'
