'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { sliceColor, type DonutPalette } from '@/components/reports/DonutChart'
import { MembershipSliceDialog } from '@/components/reports/MembershipSliceDialog'
import type { CountSlice } from '@/lib/membership-report'
import type { MembershipBreakdown, MembershipRepairRights } from '@/lib/membership-drill'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * The legend beside a donut — which is also the direct labelling, also the data table, and
 * since 2026-08-22 also the way IN to the slice.
 *
 * ── WHY THE LEGEND AND NOT THE RING ─────────────────────────────────────────────────
 * The ask was to drill into the pie charts. The legend is the better target for it and is
 * strictly more capable, which is worth stating because it is not the literal reading:
 *
 *   * **It is complete.** The ring draws at most six segments and folds the tail into one
 *     grey **Other** (`foldForChart`), which is a synthetic bucket with no members — so a
 *     clickable ring would have one segment that could not open, on a family with seven
 *     chapters. The legend lists every slice, always, including the empty ones.
 *   * **It is reachable.** A `stroke-dasharray` arc is a hit target you aim at rather than
 *     press, worst at the small end of the ring and worst on a phone; and an interactive SVG
 *     segment has no accessible name of its own to give.
 *   * **It keeps the ring a figure.** `DonutChart` is a server component with no JavaScript at
 *     all and its header argues that at length. Making the arcs interactive would move the
 *     whole ring across the client boundary to duplicate an affordance sitting beside it.
 *
 * So the ring stays a picture and the rows are the buttons. The card says so in a line, because
 * a row that looks like a table row and behaves like a button has to be told about.
 *
 * ── IT WAS `DonutLegend`, EXPORTED FROM `DonutChart.tsx`, AND THAT IS NOW HERE ───────
 * Moved rather than wrapped. A second legend beside the first is two renderings of one row that
 * drift — the failure "On a phone a table narrows" describes about a second stacked table — and
 * every consumer of this chart on this screen wants the interactive one. `sliceColor` stays in
 * `DonutChart.tsx` and is imported, so the swatch and the arc cannot disagree about a colour.
 *
 * ── EVERY SLICE OPENS; NOT EVERY SLICE OFFERS A REPAIR ──────────────────────────────
 * Reading who is in a chapter is useful on its own, so a row with nobody to fix still opens and
 * still lists (or says it is empty). What varies is the control inside, and
 * `lib/membership-drill.ts` is the one place that decides which.
 */
export function MembershipBreakdownLegend({
  slices, palette, drawn, unit, breakdown, title, rights,
}: {
  slices: readonly CountSlice[]
  palette: DonutPalette
  /** The slices the ring actually drew, in order, so the swatches match it. */
  drawn: readonly CountSlice[]
  /** What is being counted — "members", pluralised by the caller's copy. */
  unit: string
  breakdown: MembershipBreakdown
  /** The card's own heading, so the dialog can say which chart it came from. */
  title: string
  rights: MembershipRepairRights
}) {
  const t = useT()
  const [openSlice, setOpenSlice] = useState<CountSlice | null>(null)
  const colorByKey = new Map(drawn.map((s, i) => [s.key, sliceColor(palette, i)]))

  return (
    <>
      <table className="w-full text-sm">
        <caption className="sr-only">
          {t('rep.everyUnitCount', { unit }) + t('rep.pressRow')}
        </caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">{t('rep.group')}</th><th scope="col">{t('rep.members')}</th><th scope="col">{t('rep.share')}</th>
          </tr>
        </thead>
        <tbody>
          {slices.map(s => (
            <tr key={s.key} className="border-b last:border-0">
              {/* ── THE WHOLE ROW IS ONE BUTTON, IN THE FIRST CELL ────────────────────
                  A handler on the `<tr>` would be unreachable by keyboard and invisible to a
                  screen reader — the argument `MemberDetailsTrigger` makes on the members
                  table, and the reason `MainRail` refuses `role="tablist"`. This is a real
                  `<button>` whose text IS its accessible name, and the count and the share stay
                  in their own cells so each is still announced with its column heading.

                  `aria-haspopup="dialog"` is honest about what it opens. */}
              <td className="py-1.5 pr-2">
                <button
                  type="button"
                  onClick={() => setOpenSlice(s)}
                  aria-haspopup="dialog"
                  className="group flex w-full items-center gap-2 text-left hover:underline underline-offset-4"
                >
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full border"
                        style={colorByKey.has(s.key)
                          ? { backgroundColor: colorByKey.get(s.key), borderColor: 'transparent' }
                          : { borderColor: 'var(--border)' }} />
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    aria-hidden="true"
                  />
                </button>
              </td>
              <td className="py-1.5 pr-2 text-right font-medium tabular-nums">{s.count}</td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">{s.percent}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* MOUNTED ONLY WHILE OPEN AND KEYED ON THE SLICE. The key is what discards the previous
          slice's fetched roster, filter text and error — the same mechanism AGENTS.md uses at
          `<main key={familyCode}>`, and the reason the dialog needs no reset logic of its own. */}
      {openSlice && (
        <MembershipSliceDialog
          key={`${breakdown}:${openSlice.key}`}
          breakdown={breakdown}
          slice={openSlice}
          chartTitle={title}
          rights={rights}
          onClose={() => setOpenSlice(null)}
        />
      )}
    </>
  )
}
