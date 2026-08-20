import { cn } from '@/lib/utils'
import type { CountSlice } from '@/lib/membership-report'

/**
 * A part-to-whole donut, and the legend that makes it readable.
 *
 * ── IT IS A SERVER COMPONENT, AND THERE IS NO JAVASCRIPT TOOLTIP ────────────────────
 * The usual reason a chart needs a hover layer is that the values are not on the page —
 * one number per point is chaos, so the numbers live in a tooltip instead. That argument
 * does not apply to six segments: every slice's label, count and percentage is printed in
 * the legend right beside the ring, permanently, for every reader including one who cannot
 * hover at all. A tooltip would be a second copy of what is already visible, bought with a
 * `'use client'` boundary on a page that otherwise ships no JavaScript.
 *
 * Each segment still carries an SVG `<title>`, which browsers surface as a native tooltip
 * and screen readers announce — the accessible affordance without the bundle.
 *
 * ── THE COLOURS COME FROM TOKENS, WHICH IS THE ONLY WAY THEY COULD ──────────────────
 * `var(--viz-*)`, declared in app/globals.css and validated there in both themes. AGENTS.md
 * permits reading a custom property from markup for exactly this case — "if a chart or an
 * illustration ever genuinely needs a colour in JS, read it from the custom property rather
 * than restating the hex" — and an SVG `fill`/`stroke` is that case. No hex appears here,
 * and none may.
 *
 * TWO PALETTES, AND WHICH ONE IS A FACT ABOUT THE READER'S JOB rather than a style:
 *
 *   `categorical`  the slices are IDENTITIES — Active vs Invited, Adults vs Minors. Two
 *                  brand hues and a de-emphasis grey for the "not recorded" bucket, which
 *                  is the absence of an answer rather than a third kind of thing. THREE
 *                  SLICES IS THE CEILING and globals.css says why: every GENORRA hue is
 *                  warm, and simulated red-blind vision collapses that arc, so a third
 *                  identity colour cannot clear the separation floor.
 *   `sequential`   the slices are MAGNITUDES — which chapter is biggest. One hue, five
 *                  steps, darkest first, with the folded Other in grey. This is what lets a
 *                  breakdown carry six segments at all, and it is the honest encoding: the
 *                  reader's question really is about size, and the ring is already ordered.
 *
 * ── A 100% SLICE DRAWS A PLAIN RING ─────────────────────────────────────────────────
 * The 2px gap that separates adjacent segments has nothing to separate when there is one
 * segment, and a full circle drawn with a gap in it reads as a chart that failed to load.
 */

/** How many segments each palette can colour. `foldForChart(slices, N-1)` is the caller's job. */
const CATEGORICAL = ['var(--viz-cat-1)', 'var(--viz-cat-2)', 'var(--viz-muted)']
const SEQUENTIAL = [
  'var(--viz-seq-1)', 'var(--viz-seq-2)', 'var(--viz-seq-3)',
  'var(--viz-seq-4)', 'var(--viz-seq-5)', 'var(--viz-muted)',
]

export type DonutPalette = 'categorical' | 'sequential'

export function sliceColor(palette: DonutPalette, index: number): string {
  const ramp = palette === 'categorical' ? CATEGORICAL : SEQUENTIAL
  // The last colour rather than a cycled one. Cycling would give slice 7 the same fill as
  // slice 1 — two segments of one ring claiming to be the same thing — and the caller is
  // supposed to have folded the tail before it gets here. Clamping is what that mistake
  // looks like if it ever happens: one grey Other, never a repeat.
  return ramp[Math.min(index, ramp.length - 1)]
}

// The geometry, in user units of a 100×100 viewBox. `GAP` is ~2px once the ring renders at
// its usual ~150px — the surface gap the marks spec asks for between adjacent fills, drawn
// as a break in the stroke rather than as a border around each segment.
const RADIUS = 40
const THICKNESS = 15
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 1.1

export function DonutChart({ slices, palette, label, centerValue, centerLabel, className }: {
  slices: readonly CountSlice[]
  palette: DonutPalette
  /** Names the figure for a screen reader. The visible heading is the card's, not this. */
  label: string
  /** The hero number in the hole. Usually the total the slices are a share of. */
  centerValue: number
  centerLabel: string
  className?: string
}) {
  const total = slices.reduce((sum, s) => sum + s.count, 0)

  if (total === 0) {
    return (
      <svg viewBox="0 0 100 100" role="img" aria-label={`${label}: nothing to show yet`}
           className={cn('h-40 w-40 shrink-0', className)}>
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth={THICKNESS} />
        <text x="50" y="53" textAnchor="middle" className="fill-muted-foreground text-[9px]">—</text>
      </svg>
    )
  }

  // THE GEOMETRY IS DERIVED BEFORE THE MAP, not accumulated inside it. A `let consumed`
  // mutated across a `.map()` callback is a reassignment during render, which React Compiler
  // rejects outright — and it would be the wrong shape here anyway, since the ring's segments
  // are a pure function of the slices. `reduce` carries the running offset instead.
  //
  // The first segment starts at twelve o'clock, which is what the -90° rotation buys.
  const single = slices.filter(s => s.count > 0).length === 1
  const segments = slices.reduce<{ at: number; drawn: { slice: CountSlice; index: number; length: number; offset: number }[] }>(
    (acc, slice, index) => {
      const length = (slice.count / total) * CIRCUMFERENCE
      if (slice.count > 0) acc.drawn.push({ slice, index, length, offset: -acc.at })
      return { at: acc.at + length, drawn: acc.drawn }
    },
    { at: 0, drawn: [] },
  ).drawn

  return (
    <svg viewBox="0 0 100 100" role="img"
         aria-label={`${label}. ${slices.map(s => `${s.label} ${s.count}`).join(', ')}.`}
         className={cn('h-40 w-40 shrink-0', className)}>
      <g transform="rotate(-90 50 50)">
        {segments.map(({ slice: s, index, length, offset }) => {
          // The gap is taken off the END of each segment, so it falls between this segment
          // and the next rather than shrinking both. On a single full segment there is no
          // next, so nothing is taken.
          const drawn = single ? length : Math.max(length - GAP, 0.5)
          return (
            <circle
              key={s.key} cx="50" cy="50" r={RADIUS} fill="none"
              stroke={sliceColor(palette, index)} strokeWidth={THICKNESS}
              strokeDasharray={`${drawn} ${CIRCUMFERENCE - drawn}`}
              strokeDashoffset={offset}
            >
              <title>{`${s.label}: ${s.count} (${s.percent}%)`}</title>
            </circle>
          )
        })}
      </g>
      {/* The hole is not empty, because a donut's hole is the best place on the figure to
          put the one number the ring is a share of. `aria-hidden` — the label above already
          says it, and a screen reader reading the total twice is noise. */}
      <text x="50" y="49" textAnchor="middle" aria-hidden="true"
            className="fill-foreground text-[15px] font-semibold">{centerValue}</text>
      <text x="50" y="59" textAnchor="middle" aria-hidden="true"
            className="fill-muted-foreground text-[6px] uppercase tracking-[0.12em]">{centerLabel}</text>
    </svg>
  )
}

/**
 * The legend, which is also the direct labelling and also the table.
 *
 * One row per slice, with the swatch, the name, the count and the share — so identity is
 * never carried by colour alone, every value is on screen without hovering, and the
 * contrast relief the palette owes (see globals.css) is discharged by construction.
 *
 * IT LISTS EVERY SLICE, INCLUDING THE ONES THE RING DOES NOT DRAW. The caller passes the
 * FULL breakdown here and the FOLDED one to the chart, so a chapter with nobody in it and
 * the four chapters swept into "Other" are all still readable — which is the whole of what
 * makes folding honest rather than a truncation.
 */
export function DonutLegend({ slices, palette, drawn, unit }: {
  slices: readonly CountSlice[]
  palette: DonutPalette
  /** The slices the ring actually drew, in order, so the swatches match it. */
  drawn: readonly CountSlice[]
  /** What is being counted — "member", pluralised by the caller's copy. */
  unit: string
}) {
  const colorByKey = new Map(drawn.map((s, i) => [s.key, sliceColor(palette, i)]))
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{`Every ${unit} count in this breakdown, including any the chart folds together`}</caption>
      <thead className="sr-only">
        <tr><th scope="col">Group</th><th scope="col">Members</th><th scope="col">Share</th></tr>
      </thead>
      <tbody>
        {slices.map(s => (
          <tr key={s.key} className="border-b last:border-0">
            <td className="py-1.5 pr-2">
              <span className="flex items-center gap-2">
                {/* A slice the ring did not draw gets a hollow swatch rather than a colour
                    it does not have — an empty chapter is a real row and a filled swatch
                    would send the reader looking for it on the ring. */}
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full border"
                      style={colorByKey.has(s.key)
                        ? { backgroundColor: colorByKey.get(s.key), borderColor: 'transparent' }
                        : { borderColor: 'var(--border)' }} />
                <span className="truncate">{s.label}</span>
              </span>
            </td>
            <td className="py-1.5 pr-2 text-right font-medium tabular-nums">{s.count}</td>
            <td className="py-1.5 text-right tabular-nums text-muted-foreground">{s.percent}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
