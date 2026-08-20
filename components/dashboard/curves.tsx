import { TREE_WATERMARK_PATH, TREE_WATERMARK_VIEWBOX } from './tree-watermark-path'

/**
 * The Golden Master's swoop — the organic edge along the bottom of the Heritage band.
 *
 * GEOMETRY IS THE KIT'S. The `d` is `eventHero` from
 * `design/dashboard/v1_0/05_DESIGN_SYSTEM/curve-paths.json`, unaltered, authored against the
 * hero's 790x515 box. Only the top edge of that shape is used here: the band is a
 * coloured `<div>` and this sits at its foot, so the path's own upper half is off-canvas
 * above the window. That is why the viewBox starts at y=200 rather than 0.
 *
 * WHY NOT `clip-path: path()`, which is what the kit's own `genorra-bo.css` reaches for.
 * `path()` takes ABSOLUTE pixel coordinates in the element's own box, so a shape authored
 * at 790x515 stays 790x515 forever — it does not scale with the element, which makes it
 * useless in a fluid layout and wrong on every screen but one. An inline `<svg>` with a
 * `viewBox` scales by definition.
 *
 * `preserveAspectRatio="none"` on purpose: the band's width is the page's and its height
 * is fixed, so the curve must stretch to whatever ratio it is given. A decorative sweep
 * has no proportions worth preserving; keeping them would letterbox the shape and leave a
 * seam of the wrong colour along the band's edge.
 *
 * `fill="currentColor"` and NOT a colour of its own. The curve is the SHAPE OF AN EDGE
 * between the band and the page behind it, so what it paints is whatever the page ground
 * is — the parent sets `text-background` and it follows, in both themes, with no token of
 * its own and nothing to keep in step. This is the whole reason the redesign needed only
 * one new colour.
 */
export function HeroCurve({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 200 790 130"
      preserveAspectRatio="none"
      className={className}
    >
      <path
        d="M0 278 C75 216 174 228 297 267 C420 307 561 320 790 231 L790 505 C665 468 528 456 390 482 C249 509 105 512 0 471 Z"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * The kit's gold hairline along the right half of that same swoop.
 *
 * GEOMETRY IS THE KIT'S, verbatim. The `d` is the stroked path in
 * `design/dashboard/v1_0/03_VECTOR_ASSETS/components/Welcome_EventHero.svg`, where it is drawn
 * `stroke="#d99714" stroke-width="1.9059" fill="none"`. It is the one unbuilt element of
 * that composition that can be honoured EXACTLY, because it was authored in the same
 * 790x515 space as `HeroCurve` above: it runs from (372, 286.76) to (791.3, 231.35), and
 * `HeroCurve`'s own path passes through both of those points on its `… C 420 307 561 320
 * 790 231` segment. Drawn in the SAME viewBox, with the SAME `preserveAspectRatio`, in the
 * SAME box, it lands on the curve's edge with nothing to tune — change any one of those
 * three on either element and the line drifts off the swoop.
 *
 * THE VIEWBOX IS `HeroCurve`'s, NOT the SVG's own `0 0 790 515`, for the reason stated
 * above it: only the top edge of that shape is on screen, which is why the window starts
 * at y=200. The two must agree, which is the whole argument for the pair living in one
 * file.
 *
 * `vector-effect="non-scaling-stroke"` because `preserveAspectRatio="none"` scales this box
 * anisotropically — a hero band is around 1.4x the authored width and 0.5x its height — so a
 * plain `stroke-width` would come out thicker horizontally than vertically. Evaluating the
 * stroke in screen space is what keeps a 1.9-unit hairline a hairline.
 *
 * `stroke="currentColor"` for the same reason its two siblings use `fill="currentColor"`: the
 * parent names the token (`text-brand-legacy`) and no hex enters a component. Gold as a
 * NON-TEXT STROKE is one of its two sanctioned uses — it can never carry text on a pale
 * ground — which is why this is a decoration and not a rule under a heading.
 *
 * `aria-hidden`, with no `<title>`: it carries nothing a member needs.
 */
export function HeroCurveHairline({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 200 790 130"
      preserveAspectRatio="none"
      className={className}
    >
      <path
        d="M 372.00111,286.76119 c 167.34627,29.06854 302.72754,-7.26714 419.30584,-55.41191"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/**
 * The traced tree, as a ghost on the Heritage band.
 *
 * `currentColor` again, so the parent decides — `text-brand-on-hero` at low opacity in
 * both themes. See `./tree-watermark-path` for why this must stay large and faint.
 *
 * `aria-hidden`, with no `<title>`: it carries no information a member needs and the
 * greeting beside it already says everything the screen means.
 */
export function TreeWatermark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox={TREE_WATERMARK_VIEWBOX} className={className}>
      <path d={TREE_WATERMARK_PATH} fill="currentColor" />
    </svg>
  )
}
