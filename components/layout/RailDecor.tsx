import { APP_MOTTO } from '@/lib/brand'

/**
 * The three layered curves at the foot of the nav rail, and the motto card above them.
 *
 * WHAT THIS IS. Straight out of the Golden Master kit —
 * `public/dashboard/03_VECTOR_ASSETS/components/Sidebar.svg`, whose last four elements
 * are these paths. The `d` strings are copied byte-for-byte and the SVG keeps the kit's
 * own coordinate space (270x1024) through a windowed `viewBox`, so nothing has been
 * re-drawn, re-traced or "simplified" — which is the one thing
 * `00_START_HERE/CLAUDE_START_HERE.md` asks for by name.
 *
 * WHAT CHANGED, AND WHY IT HAD TO. The kit paints them `#D7552B`, `#D99714` and
 * `#656A31`. Those are literals, and a literal in a component is the exact thing
 * AGENTS.md forbids — `app/globals.css` is the only file in the app that may hold a
 * colour. They are also not quite the brand: the kit's palette drifts from the shipped
 * one on every chromatic colour. So the geometry is the kit's and the colour is the
 * app's, through `stroke-brand-*` / `fill-brand-*` utilities. That is also what makes
 * the rail work in dark mode, which the kit has no answer for at all.
 *
 * THREE THINGS ABOUT THE MARKUP.
 *
 *   * **`viewBox="12 890 248 122"` is a window, not a transform.** It shows the bottom
 *     122 units of the kit's canvas at its original origin, which is why the path data
 *     needs no translation. Re-origin it and every number below has to move with it.
 *   * **`preserveAspectRatio="none"`** — the rail is 14rem wide and the kit's is 248
 *     units, but the rail's HEIGHT is whatever the viewport gives it. These are
 *     decorative sweeps, so stretching them is correct; constraining the ratio would
 *     letterbox the band and leave a seam above the curves.
 *   * **`aria-hidden`, and no `<title>`.** The kit's file carries one because it is a
 *     standalone document. Inline here it is ornament, and announcing "GENORRA Golden
 *     Master Sidebar" to a screen reader in the middle of a nav is noise.
 *
 * The curves sit in their own absolutely-positioned layer rather than on the `<aside>`,
 * and that is load-bearing: clipping them needs `overflow-hidden`, and putting that on
 * the aside would break the `position: sticky` on the nav inside it.
 */
export function RailCurves() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-32 overflow-hidden">
      <svg
        viewBox="12 890 248 122"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        {/* Olive lands FIRST so the two strokes read on top of it, matching the kit's
            paint order. `.95` opacity is the kit's own value. */}
        <path d="M119 1012 C158 942 207 919 260 910 V1012Z" className="fill-brand-affirm" opacity=".95" />
        <path d="M12 959 C73 911 144 899 229 939" fill="none" strokeWidth="2" className="stroke-brand-warm" />
        <path d="M12 1003 C89 926 169 913 260 910" fill="none" strokeWidth="2" className="stroke-brand-legacy" />
      </svg>
    </div>
  )
}

/**
 * The motto card that sits above the curves — Legacy gold lead, cream rest, and a
 * hand-drawn heart in the corner.
 *
 * The heart is the kit's path (same file, `stroke="#C6565E"`), re-origined into a 40x40
 * box so it can be placed with normal layout instead of absolute SVG coordinates. Its
 * colour is `--brand-legacy` at reduced opacity rather than the kit's pink, because the
 * card already carries two text colours and a third hue would be the fourth thing
 * competing in a 155px box.
 *
 * The words come from `lib/brand.ts`, not from here. A motto is product copy, and
 * AGENTS.md is explicit that TypeScript-consumed brand strings live in one file — the
 * same rule that keeps `APP_NAME` out of components.
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
