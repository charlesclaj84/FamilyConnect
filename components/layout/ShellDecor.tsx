import { APP_MOTTO } from '@/lib/brand'

/**
 * The Golden Master's decorative shell system: the cream bite at the top of the rail, and
 * the olive hill that runs out of the rail's foot across the workspace.
 *
 * ALL GEOMETRY IS THE KIT'S, from PATCH 01
 * (`public/dashboard/05_DESIGN_SYSTEM/curve-paths.json` and
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
// Keep these in step with `w-56` on the <aside> in Sidebar.tsx. They are the only place
// the two are coupled, and getting it wrong shows up as the hill's left edge sliding off
// the rail rather than as anything breaking.
const UNIT_REM = 14 / 246

/** rem for a span of kit units, to 4dp. */
const u = (units: number) => `${(units * UNIT_REM).toFixed(4)}rem`

/**
 * The cream bite at the top of the rail, and the burgundy bulge beside it.
 *
 * ONE ELEMENT PAINTS BOTH, which is why it straddles the boundary. The window is
 * x=244..286 — 14 units left of the rail's edge and 28 to the right of it — filled first
 * with the page ground and then with the burgundy shape on top. Over the rail (x<258)
 * the ground shows through wherever the shape has pulled away: that is the bite. Over
 * the workspace (x>258) the shape paints burgundy past the edge: that is the bulge.
 * Everywhere else it is cream on cream or burgundy on burgundy, and invisible.
 *
 * Rendered as a child of `<main>` so it paints ON TOP of the workspace's own background;
 * as a sibling it would sit underneath and only half of it would show.
 *
 * `md:` only. Below that breakpoint the rail is a horizontal bar above the content rather
 * than a column beside it, and there is no vertical boundary for this to straddle.
 */
export function ShellSwoop() {
  return (
    <svg
      aria-hidden="true"
      viewBox="244 12 42 189"
      preserveAspectRatio="none"
      className="pointer-events-none absolute top-0 z-0 hidden md:block"
      style={{ left: u(-14), width: u(42), height: u(189) }}
    >
      <rect x="244" y="12" width="42" height="189" className="fill-background" />
      <path
        d="M244 12 L286 12 C263 34 249 62 244 91 C239 121 246 160 258 201 L244 201 Z"
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
