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

/*
 * ── THE KIT'S GOLD HAIRLINE IS WITHDRAWN, 2026-08-22, AND THIS NOTE IS WHY ──────────
 *
 * `Welcome_EventHero.svg` strokes a 1.9-unit gold line along the right half of the swoop
 * above (`stroke="#d99714"`, from (372, 286.76) to (791.3, 231.35)), and `HeroCurveHairline`
 * reproduced it EXACTLY: same coordinate space, same viewBox, same `preserveAspectRatio`,
 * `vector-effect="non-scaling-stroke"` so an anisotropically scaled band kept it a hairline,
 * and `currentColor` so no hex entered a component. It landed on the curve's edge with
 * nothing to tune.
 *
 * It still read wrong. On a real band at real widths a 1.9px gold arc does not read as an
 * edge treatment — it reads as a stray curved line drawn around the hero, which is the one
 * thing a decoration that thin must not do. So the component is DELETED rather than left
 * unused: the geometry was right and the composition was the problem, and an unused export
 * carrying kit provenance is exactly the thing somebody re-adds next year believing its
 * absence was an oversight.
 *
 * `08_QA/NO_OVERSIMPLIFICATION.md` says an asset the kit supplies must be consumed, and this
 * is the deliberate exception to it — recorded here rather than argued again. The path is
 * still in the kit if it is ever wanted back; nothing in this repo needs to hold a copy.
 */

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

/**
 * WHERE THE CROP STARTS, as a percentage of the hero's width — the one number this geometry
 * has, and four things read it.
 *
 * The kit puts it at 344 of 790, i.e. 43.5%, so the photograph takes the right-hand 56.5% of
 * its hero. That is right for the kit's box, which is 790x515 and nearly square; a dashboard
 * band is far wider and no taller, so the same fraction gives the crop an aspect near 4:1 and
 * it reads as a wide slab rather than a photograph. At 62% it takes the right-hand 38%, which
 * on a typical desktop is nearer 2.8:1 — still wider than the kit's 1.5:1, because our hero is,
 * but recognisably a picture.
 *
 * FOUR CONSUMERS, and they must not drift:
 *   1. `PHOTO_MASK_SQUEEZE` below, which is how the drawn shape gets there.
 *   2. The `<img>` wrapper's `left`, so the photograph is scaled to the frame it is visible in.
 *   3. `SWOOP_UNIT` and `MASK_UNIT`, which are normalised to that same box.
 *   4. `WelcomeHero`'s `sm:pr-[42%]`, which keeps the member's name clear of it.
 * Changing this means regenerating 1 and 3 — the derivations are stated beside each.
 */
const CROP_LEFT_PCT = 62

/**
 * The horizontal squeeze that moves the kit's mask from x=344 to x=489.8, anchored on the
 * right edge so the shape keeps bleeding off it.
 *
 *     scale = (790 - 489.8) / (790 - 344) = 0.67309
 *     translate = 790 - 0.67309 x 790     = 258.2556
 *
 * A TRANSFORM RATHER THAN AN EDITED PATH, deliberately. `08_QA/NO_OVERSIMPLIFICATION.md` says
 * to consume the kit's asset or reproduce its exact path data, and rewriting 24 coordinates
 * would leave nothing to compare against the kit. The path below is still character for
 * character the kit's; this says what is being done to it, in numbers anyone can check.
 *
 * IT IS APPLIED TO THE MASK ONLY, never to the swoop. The swoop is shared with the band's own
 * `HeroCurveCrest` and has to keep the band's x mapping or the crop's lower boundary stops
 * being the line the gold hairline is drawn along — which is the whole composition.
 */
const PHOTO_MASK_SQUEEZE = 'translate(258.2556 0) scale(0.67309 1)'

/** `eventHero`'s top edge, closed up to THIS viewBox's top — see `HeroCurveCrest`. */
const SWOOP_ABOVE = 'M0 278 C75 216 174 228 297 267 C420 307 561 320 790 231 L790 27 L0 27 Z'
/** `eventPhotoMask`, verbatim. Squeezed by `PHOTO_MASK_SQUEEZE` at the point of use. */
const PHOTO_MASK =
  'M344 292 C358 153 449 55 608 27 C688 13 754 38 790 82 L790 231 C666 284 522 324 344 292 Z'
/** The gold line the kit strokes along the swoop's right half. */
const SWOOP_HAIRLINE =
  'm 372.00111,286.76119 c 167.34627,29.06854 302.72754,-7.26714 419.30584,-55.41191'

/**
 * The two clips again, in the unit box — for the `<img>`, which is CSS rather than SVG.
 *
 * Normalised to the CROP'S OWN BOX and not to the element's: x over [489.8, 790] and y over
 * [27, 303.42]. That second bound is MEASURED rather than read off the path — the mask's lower
 * bezier bulges past its own control point, so its real extent is y 23.11..303.42 where the
 * coordinates suggest 27..324. The bottom is what decides the frame's height (91.228% of the
 * element), and being wrong about it by 20 units would leave the photograph's box hanging below
 * the shape that clips it.
 *
 * The mask's numbers are the kit's normalised over [344, 790] — the squeeze cancels out, because
 * an affine transform normalised over its own transformed extent is the identity. So these are
 * NOT a second copy of the squeeze; they are the same shape in the box it ends up in, and they
 * do not change if `CROP_LEFT_PCT` does. `SWOOP_UNIT` does, which is why its derivation is
 * spelled out: negative x is the part of the swoop left of the crop, which a clip ignores.
 */
const MASK_UNIT =
  'M0 0.95868C0.03139 0.45582 0.23543 0.10129 0.59193 0' +
  'C0.7713 -0.05065 0.91928 0.03979 1 0.19897L1 0.738' +
  'C0.72197 0.92974 0.3991 1.07444 0 0.95868Z'
const SWOOP_UNIT =
  'M-1.63158 0.90803C-1.38175 0.68374 -1.05197 0.72715 -0.64224 0.86824' +
  'C-0.23251 1.01294 0.23718 1.05997 1 0.738L1 0L-1.63158 0Z'

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
              `hidden`: a `display: none` subtree is not rendered, and browsers have been
              inconsistent enough about whether a `clipPath` inside one is still referenceable
              that a collapsed-but-present element is the safer shape. */}
          <svg aria-hidden="true" focusable="false" className="absolute h-0 w-0">
            <defs>
              <clipPath id={HERO_SWOOP_CLIP} clipPathUnits="objectBoundingBox">
                <path d={SWOOP_UNIT} />
              </clipPath>
              <clipPath id={HERO_MASK_CLIP} clipPathUnits="objectBoundingBox">
                <path d={MASK_UNIT} />
              </clipPath>
            </defs>
          </svg>

          {/* THE FRAME, AND IT IS THE CROP'S BOX RATHER THAN THE HERO'S — which is the whole
              of "fit the image to the frame". This wrapper used to be `inset-0`, so the
              `<img>` covered the entire hero and the clip then revealed the end-hand third
              of it: a photograph scaled to a 1650x224 box, of which you saw a slice whose
              content depended on the window width rather than on the picture. Sized to the
              crop instead, `object-cover` scales the photograph to the shape it is actually
              seen through and centres it there.

              `bottom-[8.772%]` is `(330 - 303.42) / 303` — the element's viewBox runs to y=330
              and the mask's measured bottom is 303.42, so the frame stops where the shape does
              rather than 20 units below it. */}
          <div
            className="absolute end-0 top-0 bottom-[8.772%]"
            style={{ left: `${CROP_LEFT_PCT}%`, clipPath: `url(#${HERO_SWOOP_CLIP})` }}
          >
            {/* `object-cover` and not `contain`: the frame is an organic crop, so letterboxing
                would show the page through gaps inside the shape and read as a rendering
                fault. Cover fills it and crops the overflow, which is what a masked photograph
                does — and it is UNIFORM, so no window width distorts a face. That is the one
                property the SVG route could not give: everything inside a
                `preserveAspectRatio="none"` viewport is stretched with it.

                `next/image` is not used here for the reason `components/ui/Avatar.tsx` does not
                either: this is a Supabase Storage URL and no `images.remotePatterns` is
                configured, so the loader would refuse it at runtime. */}
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
            {/* Squeezed, so the placeholder occupies exactly the frame a photograph would —
                see `PHOTO_MASK_SQUEEZE`. The transform wraps the PATH alone. */}
            <g transform={PHOTO_MASK_SQUEEZE}>
              <path d={PHOTO_MASK} fill="currentColor" />
            </g>

            {/* OUTSIDE the squeeze, and placed in the squeezed shape's own coordinates
                (x 489.8-790) rather than the kit's. Inside it, the horizontal-only scale would
                narrow the tree by a third — a distorted tree in a shape whose whole purpose is
                to hold an undistorted picture.

                Faint for the reason `./tree-watermark-path` states at length: the path is a
                bitmap auto-trace whose edges are a one-unit staircase, invisible only while it
                is large and faint.

                `var(--brand-on-soft)` AND NOT `currentColor`, which is the one place this
                departs from its siblings. They each paint ONE shape, so `currentColor` lets the
                parent decide and no token is named in a component. This paints TWO, the second
                inside the first — so `currentColor` would put the tree at 16% of the exact
                colour behind it, i.e. nothing at all. That was the first version and it
                rendered a flat blob. `--brand-on-soft` is the measured AA partner of
                `--brand-soft`, which is what the parent sets, in both themes. Naming a token in
                a component is allowed where a LITERAL is not — see "Colours live in one
                place". */}
            <svg x="560" y="70" width="170" height="200" viewBox={TREE_WATERMARK_VIEWBOX}>
              <path d={TREE_WATERMARK_PATH} fill="var(--brand-on-soft)" opacity="0.16" />
            </svg>
          </g>
        </svg>
      )}

      {/* THE GOLD LINE, over whichever of the two is above — so it reads as the boundary
          between the crop and the burgundy rather than as a line under a shape. Full width and
          untransformed, because it belongs to the SWOOP and not to the crop: the swoop runs the
          whole band whether or not a picture sits on part of it. Always the stretched SVG copy,
          photograph or not — it is a decorative stroke along an edge that IS stretched, so
          distorting it is correct where distorting a face is not. The band draws this same path
          at the same scale underneath, and the two coincide exactly; drawn here as well, the
          line runs unbroken where the crop covers the band's own. */}
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
