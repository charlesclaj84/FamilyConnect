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
 * The SAME swoop, filling the region ABOVE it — for the TOP edge of a Heritage band.
 *
 * `HeroCurve` above and this are the two halves of one line, and which one you want depends
 * entirely on which side of the edge the band is. `HeroCurve` fills BELOW the kit's top edge,
 * so at a band's foot it paints the page ground cutting up into the burgundy. This fills
 * ABOVE the same edge, so at a band's head it paints the page ground cutting DOWN — which is
 * how the Golden Master actually draws the event hero: the swoop is that band's TOP boundary,
 * with the greeting above it.
 *
 * GEOMETRY IS THE KIT'S, and it is the same `eventHero` top edge verbatim —
 * `M0 278 C75 216 174 228 297 267 C420 307 561 320 790 231`. Only the CLOSURE differs: this
 * runs `L790 200 L0 200 Z` back along the top of the window where `HeroCurve` continues down
 * the path's own lower half. Nothing about the curve itself is retuned, which is the property
 * that matters — the two components draw one identical line and cannot drift apart.
 *
 * THE VIEWBOX IS `HeroCurve`'s AND `HeroCurveHairline`'s, `0 200 790 130`, and that is not
 * tidiness: the hairline belongs to THIS edge in the kit (it is drawn along the swoop's right
 * half, under the photograph), so it is this component the hairline has to register with.
 * Same viewBox, same `preserveAspectRatio="none"`, same box on the element — change one on
 * either and the gold line slides off the edge it is drawn along.
 */
export function HeroCurveCrest({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 200 790 130"
      preserveAspectRatio="none"
      className={className}
    >
      <path
        d="M0 278 C75 216 174 228 297 267 C420 307 561 320 790 231 L790 200 L0 200 Z"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * The kit's OTHER curve — the asymmetric bottom edge of the burgundy event hero.
 *
 * ── THIS SHAPE SHIPPED CROPPED OUT OF EVERY RENDER ────────────────────────────────
 * `eventHero` in `design/dashboard/v1_0/05_DESIGN_SYSTEM/curve-paths.json` is a CLOSED shape
 * with two curved edges, and `HeroCurve` above carries the whole `d` — including this half —
 * while windowing `0 200 790 130`. The bottom edge lives at y 456-512, outside that window,
 * so it was present in the bundle and visible nowhere. The kit's own
 * `08_QA/VISUAL_ACCEPTANCE.md` lists "Burgundy hero has both top and bottom asymmetrical
 * curves" as a must-match item, and `08_QA/NO_OVERSIMPLIFICATION.md` says an asset that
 * exists in the kit must be consumed rather than approximated.
 *
 * The visible cost of its absence was not only fidelity. The premier band reused `HeroCurve`
 * at its foot — the GREETING band's curve, in the same direction — so the two stacked
 * Heritage bands had identical silhouettes, and the one thing a family has flagged as
 * mattering more than the rest of the screen read as a second copy of the page header.
 *
 * ── THE PATH IS THE KIT'S, REVERSED, WHICH IS NOT A REDRAW ────────────────────────
 * The kit traces this edge right-to-left, because it is the return leg of a closed shape:
 *
 *     L790 505 C665 468 528 456 390 482 C249 509 105 512 0 471 Z
 *
 * Written left-to-right here so it reads like the edge it is, which for a cubic means
 * swapping each segment's endpoints and its two control points — an EXACT transform, not an
 * approximation: `(0,471) C105 512 249 509 (390,482) C528 456 665 468 (790,505)`. Every
 * coordinate above appears below unchanged. Then `L790 520 L0 520 Z` closes it downward, so
 * what this paints is the region BELOW the edge, i.e. the page ground again.
 *
 * The window is tight — `0 450 790 70` — because unlike the crest this has nothing to
 * register with: the hairline is the crest's, and the kit draws no second gold line here.
 */
export function HeroCurveFoot({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 450 790 70"
      preserveAspectRatio="none"
      className={className}
    >
      <path
        d="M0 471 C105 512 249 509 390 482 C528 456 665 468 790 505 L790 520 L0 520 Z"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * The kit's photo crop — the family's own photograph when they have set one, and the traced
 * tree holding the space when they have not.
 *
 * ── THE TWO EDGES, AND WHY THE SWOOP IS ONE OF THEM ────────────────────────────────
 * Measured against the reference at 1536x1024: in the Golden Master the photograph's lower
 * boundary IS the swoop, with the gold hairline drawn along it, and it fills every pixel
 * between its own top curve and that line — including the part hanging below the burgundy
 * band's straight top edge. There are not two curves meeting; there is one. So the crop is the
 * INTERSECTION of two of the kit's paths: `eventPhotoMask` above, `eventHero`'s top edge
 * (`HeroCurveCrest`'s curve) below.
 *
 * Both are the kit's data, character for character, in two coordinate systems for two
 * different consumers — and the pair below is the same shape twice, which is a duplication
 * worth understanding before editing either:
 *
 *   * **The SVG copies** (790-unit user space) are what the PLACEHOLDER draws, because an
 *     abstract fill can be stretched with everything else on the page.
 *   * **The `objectBoundingBox` copies** (the 0..1 unit box) are what a PHOTOGRAPH is clipped
 *     by, and they are the same numbers divided through: `x/790` and `(y - 27)/303`, which is
 *     this component's viewBox. Exact arithmetic on the kit's own coordinates, stated here so
 *     the derivation is checkable rather than a table of magic decimals.
 *
 * ── A PHOTOGRAPH MUST NOT BE STRETCHED, WHICH IS WHY THE CSS ROUTE EXISTS ──────────
 * The placeholder is drawn with `preserveAspectRatio="none"` so it distorts along with the
 * swoop it is clipped by — correct for an abstract shape, and the whole reason it registers.
 * A photograph is the opposite: a dashboard band is wide and short, so `none` would squash a
 * family's faces horizontally, and worse, it would squash them DIFFERENTLY at every window
 * width. Nothing inside a `none`-scaled `<svg>` escapes that — a nested `<svg>` or an
 * `<image preserveAspectRatio="slice">` is still mapped through the distorted parent space.
 *
 * So the photograph is not in the SVG at all. It is an `<img>` with `object-fit: cover`, which
 * scales UNIFORMLY and crops the overflow, wearing the two clips as CSS:
 *
 *     <div  clip-path: url(#swoop)>      <-- outer:  keeps only what is above the swoop
 *       <img clip-path: url(#mask)>      <-- inner:  keeps only what is inside the crop
 *
 * NESTED CLIPS INTERSECT, which is the only reason this works — CSS `clip-path` takes one
 * reference, and a `<clipPath>` holding two shapes is their UNION, not their intersection. Two
 * elements, one clip each, is how you say "and". And `clipPathUnits="objectBoundingBox"` is
 * what lets the boundary keep stretching with the layout while the pixels inside it do not:
 * the clip is in fractions of the element's box, so it tracks the swoop exactly as the SVG
 * copy does, while `object-cover` decides the photograph's own scale independently.
 *
 * ── WHAT THE PLACEHOLDER IS, WHEN THERE IS NO PHOTOGRAPH ──────────────────────────
 *   * **Not an affordance.** No camera icon, no "add a photo", no dashed frame. The member
 *     looking at the Dashboard is usually not the organizer who can set one, so an invitation
 *     here would be a control most of the family cannot use. It is set on
 *     `/admin/gatherings/[id]`, behind `admin/gatherings:edit`.
 *   * **Not a fake photograph.** The kit's own `04_MEDIA/family_hero_source.jpg` is stock
 *     photography of an invented family with the design's cream field and burgundy band burnt
 *     into the pixels, and TODO.md carries an open action to delete `04_MEDIA/` over licensing.
 *   * **`aria-hidden`, and so is the photograph.** `alt=""` on the `<img>` is deliberate: the
 *     band already names the gathering, its dates and its place in text, so a description here
 *     would either repeat that or invent a caption for a picture nobody has described. A
 *     decorative image with an empty alt is the honest markup for that.
 *
 * ── THE TWO CLIP IDS ARE LITERALS, AND THAT IS A CONSTRAINT ───────────────────────
 * `clipPath` needs an `id`, and an id in a component is either a collision the day something
 * renders twice or a `useId`, which is not available in a Server Component. This renders at
 * most once per page — `app/(protected)/dashboard/page.tsx` is the only caller and the greeting
 * is not a list. If a second caller ever appears, that is the thing to fix first: two of these
 * on one page would both resolve to the first one's clips.
 */
const HERO_PHOTO_CLIP = 'gn-hero-photo-clip'
const HERO_SWOOP_CLIP = 'gn-hero-swoop-clip'
const HERO_MASK_CLIP = 'gn-hero-mask-clip'

/** `eventHero`'s top edge, closed up to THIS viewBox's top — see `HeroCurveCrest`. */
const SWOOP_ABOVE = 'M0 278 C75 216 174 228 297 267 C420 307 561 320 790 231 L790 27 L0 27 Z'
/** `eventPhotoMask`, verbatim. */
const PHOTO_MASK =
  'M344 292 C358 153 449 55 608 27 C688 13 754 38 790 82 L790 231 C666 284 522 324 344 292 Z'
/** The gold line the kit strokes along the swoop's right half. */
const SWOOP_HAIRLINE =
  'm 372.00111,286.76119 c 167.34627,29.06854 302.72754,-7.26714 419.30584,-55.41191'

/** `SWOOP_ABOVE`, as `x/790` and `(y - 27)/303`. */
const SWOOP_ABOVE_UNIT =
  'M0 0.82838C0.09494 0.62376 0.22025 0.66337 0.37595 0.79208' +
  'C0.53165 0.92409 0.71013 0.967 1 0.67327L1 0L0 0Z'
/** `PHOTO_MASK`, likewise. The one negative y is a control point above the box, which is legal. */
const PHOTO_MASK_UNIT =
  'M0.43544 0.87459C0.45316 0.41584 0.56835 0.09241 0.76962 0' +
  'C0.87089 -0.0462 0.95443 0.0363 1 0.18152L1 0.67327' +
  'C0.84304 0.84818 0.66076 0.9802 0.43544 0.87459Z'

export function EventPhoto({
  photoUrl,
  className,
}: {
  /** The family's photograph, already a URL. `null` draws the placeholder instead. */
  photoUrl?: string | null
  className?: string
}) {
  return (
    <div className={className}>
      {photoUrl ? (
        <>
          {/* The unit-box clips, in a zero-size SVG. `absolute` and `h-0 w-0` rather than
              `hidden`: a `display: none` subtree is not rendered, and a `clipPath` inside one
              is still referenceable — but browsers have been inconsistent about that for long
              enough that a collapsed-but-present element is the safer shape. */}
          <svg aria-hidden="true" focusable="false" className="absolute h-0 w-0">
            <defs>
              <clipPath id={HERO_SWOOP_CLIP} clipPathUnits="objectBoundingBox">
                <path d={SWOOP_ABOVE_UNIT} />
              </clipPath>
              <clipPath id={HERO_MASK_CLIP} clipPathUnits="objectBoundingBox">
                <path d={PHOTO_MASK_UNIT} />
              </clipPath>
            </defs>
          </svg>

          <div className="absolute inset-0" style={{ clipPath: `url(#${HERO_SWOOP_CLIP})` }}>
            {/* `next/image` is not used here for the reason `components/ui/Avatar.tsx` does not
                either: this is a Supabase Storage URL and no `images.remotePatterns` is
                configured, so the loader would refuse it at runtime. Same precedent, same
                lint exemption. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt=""
              className="h-full w-full object-cover"
              style={{ clipPath: `url(#${HERO_MASK_CLIP})` }}
            />
          </div>
        </>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 27 790 303"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            {/* THE SWOOP, CLOSED UP TO y=27 — this viewBox's top, not `HeroCurveCrest`'s y=200.
                The CURVE is the kit's, character for character, and identical to the one that
                component fills; only the closure differs, which is the third time these three
                have had to differ that way. `HeroCurve` closes it DOWNWARD along the path's own
                lower half, `HeroCurveCrest` closes it up to 200 because that is where its own
                window starts, and this closes it up to 27 because that is where THIS one starts.

                Getting it wrong is not subtle and was the first version of this: with the y=200
                closure the clip admitted only y >= 200, so the crop survived as a sliver just
                above the swoop and the whole photograph above it was clipped away. A clip path
                is only ever right relative to the viewBox it is used in. */}
            <clipPath id={HERO_PHOTO_CLIP}>
              <path d={SWOOP_ABOVE} />
            </clipPath>
          </defs>

          <g clipPath={`url(#${HERO_PHOTO_CLIP})`}>
            <path d={PHOTO_MASK} fill="currentColor" />
            {/* The kit's own artwork doing the kit's own job. Faint for the reason
                `./tree-watermark-path` states at length: the path is a bitmap auto-trace whose
                edges are a one-unit staircase, invisible only while large and faint.

                `var(--brand-on-soft)` AND NOT `currentColor`, which is the one place this
                departs from its siblings. They each paint ONE shape, so `currentColor` lets the
                parent decide and no token is named in a component. This paints TWO, the second
                inside the first — so `currentColor` would put the tree at 16% of the exact
                colour behind it, i.e. nothing at all. That was the first version and it
                rendered a flat blob. `--brand-on-soft` is the correct second colour rather than
                a convenient one: it is the measured AA partner of `--brand-soft`, which is what
                the parent sets, in both themes. Naming a token in a component is allowed where a
                LITERAL is not — see "Colours live in one place". */}
            <svg x="470" y="70" width="240" height="200" viewBox={TREE_WATERMARK_VIEWBOX}>
              <path d={TREE_WATERMARK_PATH} fill="var(--brand-on-soft)" opacity="0.16" />
            </svg>
          </g>
        </svg>
      )}

      {/* THE GOLD LINE, over whichever of the two is above — so it reads as the boundary
          between the crop and the burgundy rather than as a line under a shape. Always the
          stretched SVG copy, photograph or not: it is a decorative stroke along an edge that
          IS stretched, so distorting it is correct where distorting a face is not. The band
          draws this same path at the same scale underneath, and the two coincide exactly; drawn
          here as well, the line runs unbroken where the crop covers the band's own. */}
      <svg
        aria-hidden="true"
        viewBox="0 27 790 303"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <path
          d={SWOOP_HAIRLINE}
          fill="none"
          stroke="var(--brand-legacy)"
          strokeWidth="1.9"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
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
