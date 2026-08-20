import { APP_MOTTO } from '@/lib/brand'

/**
 * The Golden Master's decorative shell system: the cream bite at the top of the rail, and
 * the olive hill that runs out of the rail's foot across the workspace.
 *
 * ALL GEOMETRY IS THE KIT'S, from PATCH 01
 * (`design/dashboard/v1_0/05_DESIGN_SYSTEM/curve-paths.json` and
 * `03_VECTOR_ASSETS/components/Sidebar.svg`). Nothing is re-drawn. What the patch
 * corrected, and what this file therefore had to change, is worth recording because the
 * first implementation got both halves wrong in the same way — it kept the decoration
 * inside the rail:
 *
 *   * **The cream cut belongs to the LOGO AREA ONLY.** It was a `rounded-l-[2rem]` on
 *     `<main>`, which is a curve at the top AND the bottom running the whole height —
 *     exactly the "narrow sidebar carried down the page" the patch calls out. The kit's
 *     `sidebarBurgundyShape` bulges to x=286 at the top, bites in to x=244 around y=91,
 *     and is back to the rail's full width (x=258) by the first nav row, straight from
 *     there down.
 *   * **The olive hill is NOT rail-width.** It spans x=132..664 while the rail ends at
 *     258, so more than half of it lies over the workspace. Clipping it to the rail —
 *     which the first version did, with an `overflow-hidden` layer inside the `<aside>` —
 *     threw away the part the patch describes as "intentionally extends well beyond the
 *     sidebar into the lower main canvas".
 *
 * COLOUR IS THE APP'S, not the kit's. The kit paints these with literals and a gradient
 * (`#81752F` → `#5F6532` for the hill, `#D7552B` and `#D99714` for the accents); a
 * literal in a component is what `app/globals.css` exists to prevent, and the kit's
 * palette drifts from the shipped brand on every chromatic colour anyway. So the shapes
 * are the kit's and the fills are `--brand-*` roles, which is also the only reason any of
 * this works in dark mode — the kit has no dark treatment at all.
 *
 * The hill's three-stop gradient collapses to one flat `--brand-affirm`. A gradient
 * between three olives that differ by a few percent is invisible at this size, and
 * reproducing it would mean either three literals or three tokens that exist for nothing
 * else.
 */

// ── Kit coordinate space ─────────────────────────────────────────────────────────────
// The kit draws the rail from x=12 to x=258 — 246 units — and this app renders it at
// `w-56`, 14rem. Every size below is derived from that one ratio rather than eyeballed,
// so the decoration stays registered with the rail if the rail's width ever changes.
//
//   1 kit unit = 14rem / 246 = 0.056910rem
//
// `RAIL_REM` is `w-56` on the <aside> in Sidebar.tsx and must be kept in step with it.
// This is the only place the two are coupled, and getting it wrong shows up as the hill's
// left edge sliding off the rail rather than as anything breaking.
const RAIL_REM = 14
const UNIT_REM = RAIL_REM / 246

/** rem for a span of kit units, to 4dp. */
const u = (units: number) => `${(units * UNIT_REM).toFixed(4)}rem`

/**
 * A kit x coordinate as a rem offset from the VIEWPORT's left edge rather than from
 * `<main>`'s — which is what a `fixed` element needs, since `fixed` resolves against the
 * viewport and knows nothing about the column it is written inside.
 */
const fromViewport = (kitX: number) => `${(RAIL_REM - (258 - kitX) * UNIT_REM).toFixed(4)}rem`

/**
 * The rail's top-left corner radius, consumed by the <aside> in Sidebar.tsx. It lives here
 * because this is the file that owns the conversion from kit units to rem.
 *
 * 36 UNITS, NOT THE KIT'S 22. This is the one measurement in the shell deliberately off
 * the kit, and the reason is that the two corners are not in the same situation. The kit's
 * sidebar is a card floating on a canvas with a 12-unit margin all round, so its round is
 * read against three visible edges and 22 units is plenty. Ours meets the corner of the
 * browser window, where the same round is a 20px nick in the corner of the screen that
 * reads as an artifact rather than a shape. 36 units is ~33px, which reads as intended.
 */
export const RAIL_CORNER_REM = u(36)

/**
 * The cream bite at the top of the rail, and the burgundy bulge beside it.
 *
 * ONE ELEMENT PAINTS BOTH, which is why it straddles the boundary. The window is
 * x=240..286 — 18 units left of the rail's edge and 28 to the right of it — filled first
 * with the page ground and then with the burgundy shape on top. Over the rail (x<258)
 * the ground shows through wherever the shape has pulled away: that is the bite. Over
 * the workspace (x>258) the shape paints burgundy past the edge: that is the bulge.
 * Everywhere else it is cream on cream or burgundy on burgundy, and invisible.
 *
 * THE WINDOW HAS TO CLEAR THE CURVE'S DEEPEST POINT, and the first version did not —
 * it started at x=244, which is where the kit's first cubic *ends* and looks like the
 * left extreme. It is not. The second cubic's x is `244 - 15t + 36t² - 7t³`, whose
 * derivative vanishes at t=0.2228: the curve keeps travelling left to x=242.368 at
 * y=112 before turning back. An `<svg>` clips to its own viewport, so a window starting
 * at 244 threw that away and replaced 46 units of curve — y=91 to y=137.1, where the
 * cubic is left of 244 — with a dead-straight vertical at the window's edge. At this
 * scale that is a ~42px flat running down the boundary, and it lands beside the wordmark,
 * which is what made it read as the brand block being oversized rather than as a clip.
 *
 * SO THE PATH'S OWN LEFT EDGE MOVES WITH THE WINDOW. It closes at x=240, not 244: the
 * fill is bounded on the left by that closing line, so leaving it at 244 while widening
 * the window would make the region between the curve and x=244 a burgundy sliver floating
 * in the cream, with the real rail starting again 2 units further left. Widening one
 * without the other is worse than the clip.
 *
 * IT IS PINNED TO THE VIEWPORT, not to the top of the document. The rail's own contents
 * are `sticky top-0`, so on a long page the brand block stays where it is while the page
 * moves under it — and an `absolute top-0` bite scrolled away from the logo it belongs to,
 * leaving the rail a plain straight column a screenful down. `fixed` is what keeps the two
 * halves of one shape together. That is also why `left` comes from `fromViewport()` rather
 * than being an offset from `<main>`: a fixed element resolves against the viewport, so the
 * rail's width has to enter the arithmetic explicitly.
 *
 * `fixed` surviving here is the same invariant `components/layout/header-panel.ts` depends
 * on — no ancestor of this element may take a `transform`, `filter`, `will-change` or
 * `backdrop-filter`, any of which would make itself the containing block and drop this
 * shape to wherever `<main>` happens to start. TopBar's comment forbids frosted glass for
 * exactly this reason; the same prohibition now protects this.
 *
 * IT SITS AT LEVEL 30 WITH TOPBAR, AND AFTER IT IN THE DOM — which is what makes it
 * visible at all. TopBar is `sticky top-0 z-30 bg-background` across the whole width of
 * `<main>`, and this shape reaches into the workspace only in its top ~34px (above kit
 * y=48.9 the boundary is right of x=258; below it the whole figure is over the rail). So
 * at `z-0` the bar's opaque cream erased precisely the bulge, and nothing else — leaving a
 * straight vertical edge for 34px and a bite that looked like it began a third of the way
 * down the logo. Sharing the bar's level and following it in tree order paints over the
 * bar's background without adding a rung to the ladder TopBar documents.
 *
 * Level 30 is also deliberately BELOW the dialogs. `components/ui/dialog.tsx` is
 * `fixed inset-0 z-50` rendered in place rather than portalled, so it lives inside the
 * `relative z-10` wrapper this shape is rendered into: anything raised above that wrapper
 * would notch every modal scrim in the app at the top left. The mobile drawer's backdrop
 * is also 40/50 and cannot collide with this — that is `md:hidden` where this is `md:` only.
 *
 * Rendered inside that wrapper rather than as a bare child of `<main>` so it paints ON TOP
 * of the workspace's background AND the bar's; before `<main>` it would sit under both.
 *
 * `md:` only. Below that breakpoint the rail is a drawer rather than a column beside the
 * content, and there is no vertical boundary for this to straddle.
 */
export function ShellSwoop() {
  return (
    <svg
      aria-hidden="true"
      viewBox="240 12 46 189"
      preserveAspectRatio="none"
      className="pointer-events-none fixed top-0 z-30 hidden md:block"
      style={{ left: fromViewport(240), width: u(46), height: u(189) }}
    >
      <rect x="240" y="12" width="46" height="189" className="fill-background" />
      <path
        d="M240 12 L286 12 C263 34 249 62 244 91 C239 121 246 160 258 201 L240 201 Z"
        className="fill-brand-hero"
      />
    </svg>
  )
}

/**
 * The lower decorative system — olive hill, then the terracotta and gold accent strokes.
 *
 * PAINT ORDER IS THE KIT'S: hill first, both strokes over it. That is what makes the
 * strokes read as crossing the hill's left flank rather than disappearing behind it, and
 * it is visible in the kit's own `09_PREVIEW/Sidebar.png`.
 *
 * Positioned from `<main>`'s bottom-left and pulled left by exactly the rail's width, so
 * the window's x=12 lands on the rail's left edge. `overflow-visible` is the point of it:
 * the hill runs to x=664, some 400 units past the rail, and clipping is what the patch
 * exists to undo.
 *
 * THREE THINGS KEEP THIS SAFE. It is `pointer-events-none`, so a hill lying under the
 * bottom of a page cannot swallow a click. It is `z-0` under content raised to `z-10`, so
 * it paints over the workspace's background and beneath everything on it. And it is
 * `absolute` with a negative offset, which in a left-to-right document adds nothing to
 * the scrollable area — measured, because a 505px-wide page on a 390px screen is exactly
 * the bug this shape looks capable of causing.
 */
export function ShellHill() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 z-0 hidden overflow-hidden md:block"
      style={{ left: u(-246), width: u(688), height: u(134) }}
    >
      <svg viewBox="12 890 688 134" preserveAspectRatio="none" className="h-full w-full">
        <HillPaths />
      </svg>
    </div>
  )
}

/**
 * The same lower system, windowed to the rail alone — for the mobile drawer.
 *
 * The drawer is a 16rem panel with nothing beside it, so there is no workspace for the
 * hill to run into and the shell variant would simply be cut off at the panel's edge.
 * Same paths, same order, narrower window: `x=12..270` is the rail and a little past it,
 * which lets the hill crest inside the panel instead of leaving a flat olive band.
 *
 * One component, one set of geometry, two viewBoxes. A second copy of these paths is how
 * the two would drift.
 */
export function RailFootDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-32 overflow-hidden">
      <svg viewBox="12 890 300 134" preserveAspectRatio="none" className="h-full w-full">
        <HillPaths />
      </svg>
    </div>
  )
}

/** The three shapes, shared so the shell and the drawer cannot disagree about them. */
function HillPaths() {
  return (
    <>
      <path
        d="M132 1012 C169 953 229 914 301 901 C371 889 426 916 488 955 C544 990 596 1010 664 1024 H132 Z"
        className="fill-brand-affirm"
        opacity=".98"
      />
      <path
        d="M12 952 C74 914 137 904 197 921 C225 929 249 941 279 954"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        className="stroke-brand-warm"
      />
      <path
        d="M12 1005 C73 954 138 928 206 922 C259 917 309 924 357 942"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        className="stroke-brand-legacy"
      />
    </>
  )
}

/**
 * The motto card at the foot of the nav — Legacy gold lead, cream rest, and the kit's
 * hand-drawn heart in the corner.
 *
 * The heart is `Sidebar.svg`'s path (there `stroke="#C6565E"`), re-windowed into a 40x40
 * box so it can be placed with normal layout rather than absolute SVG coordinates. It
 * takes `--brand-legacy` at low opacity rather than the kit's pink, because the card
 * already carries two text colours and a third hue would be the fourth thing competing
 * inside a 155px box.
 *
 * The words come from `lib/brand.ts`. A motto is product copy, and AGENTS.md is explicit
 * that TypeScript-consumed brand strings live in one file — the rule that keeps
 * `APP_NAME` out of components applies here too.
 */
/*
 * ONE MEASURED NOTE, because this card is the only place in the app where text sits on a
 * BLEND rather than on a token value: `bg-brand-primary/60` over the rail's
 * `bg-brand-hero` composites to #5c2934 in light and #5c3239 in dark. Gold on that is
 * 5.00 and 4.63; the cream half is 8.26 and 9.96. Both pass AA, and the dark gold figure
 * is the tightest pairing in the shell — so if the tint ever gets heavier, re-measure
 * rather than assume. Dropping the tint entirely would take gold to 5.94 / 7.57.
 */
export function RailMotto() {
  return (
    <div className="relative mt-6 overflow-hidden rounded-3xl border border-brand-legacy/25 bg-brand-primary/60 px-4 py-4">
      <p className="text-sm font-semibold leading-relaxed">
        <span className="text-brand-legacy">{APP_MOTTO.lead}</span>{' '}
        <span className="text-brand-on-hero">{APP_MOTTO.rest}</span>
      </p>
      <svg
        aria-hidden="true"
        viewBox="145 838 50 45"
        className="pointer-events-none absolute -bottom-1 right-1 h-10 w-10 stroke-brand-legacy/40"
      >
        <path
          d="M169 852 C176 840 189 842 189 853 C189 864 177 871 169 879 C161 871 149 864 149 853 C149 842 162 840 169 852Z"
          fill="none"
          strokeWidth="1.4"
        />
      </svg>
    </div>
  )
}
