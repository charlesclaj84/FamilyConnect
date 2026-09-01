'use client'

import { useMemo, useState } from 'react'
import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sortRows, type SortDirection, type SortValue } from '@/lib/sort-rows'
import { useIntlTag } from '@/components/layout/LocaleProvider'

export type SortDir = SortDirection

/**
 * A sortable column heading.
 *
 * Lifted out of DuesDetailSection when 20260815000000 split that file into the two
 * screens it had grown into — [Dues](/dues) and [Payment History](/payment-history) —
 * because both tables sort and one of them would otherwise have got a second copy.
 * Which is the whole failure mode AGENTS.md keeps returning to: styling repeated by
 * hand is invisible until you put two screens side by side.
 *
 * MOVED FROM `components/account/` TO `components/ui/` ON 2026-08-21, when sorting stopped
 * being two account tables' feature and became every table's. It was already the shared
 * thing; it was filed as though it belonged to one screen, which is the state that makes the
 * third caller write its own.
 *
 * A real `<th>` with the button inside it, not a `<th>` made clickable. The heading has
 * to stay a heading — AGENTS.md's "a table is a table" rests on a cell being announced
 * with its column, and a `<th>` that has become a control announces neither.
 */
export function SortTh({
  label, active, dir, onClick, align = 'start', className,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  /**
   * Which edge the heading and its figures sit against.
   *
   * ── `'start' | 'end'`, NOT `'left' | 'right'`, SINCE 2026-09-01 ────────────────────
   * The values are a VOCABULARY rather than a class name — they were mapped to `text-left` /
   * `text-right` and are mapped to `text-start` / `text-end` now — so renaming them changes no
   * behaviour whatever. What it changes is whether the word means anything: in a right-to-left
   * language a money column belongs on the LEFT, and `align="end"` would have been an
   * instruction that produced the opposite of what it says. A prop nobody can read correctly is
   * how the next person reintroduces a physical class.
   */
  align?: 'start' | 'end'
  /** Pass `COLLAPSING_CELL` when this heading's column folds below `sm`. */
  className?: string
}) {
  const Icon = active ? (dir === 'asc' ? ChevronUp : ChevronDown) : ArrowUpDown
  return (
    // `scope="col"` — added 2026-08-31 when sorting was rolled out to the rest of the tables,
    // and it was MISSING here while every hand-written `<th>` in the app carries it. That is
    // the half of "a table is a table" this component exists to protect: a cell is announced
    // with its column, and a heading with no scope leaves the association to the browser's
    // guess. It was wrong on all four tables already converted, so fixing the component fixed
    // them too — which is the argument for the component rather than a `<th>` per table.
    <th scope="col" className={cn(
      'py-2 pe-3 text-xs font-medium text-muted-foreground',
      align === 'end' ? 'text-end' : 'text-start',
      className,
    )}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-0.5 hover:text-foreground select-none ${align === 'end' ? 'flex-row-reverse' : ''}`}
      >
        {label}
        <Icon className="h-3 w-3 opacity-60" />
      </button>
    </th>
  )
}

/**
 * The state and the ordering behind one sortable table.
 *
 * ── WHY A HOOK AND NOT A COMPARATOR PER TABLE ──────────────────────────────────────
 * `SortTh` has always handled the HEADING. The sorting itself was left to each table, and the
 * two that did it wrote `a.payment_date.localeCompare(b.payment_date)` and
 * `a.amount_cents - b.amount_cents` inline — correct, and neither of them getting the blanks
 * rule right, because neither had a blank to get wrong. Rolling sorting out to twenty tables
 * on that pattern would have been twenty comparators and twenty chances at the bug
 * `lib/sort-rows.ts` exists to state once.
 *
 * So the caller declares WHAT each column is worth and nothing about how to order it:
 *
 *     const { rows, sortProps } = useTableSort(members, {
 *       name:    m => m.last_name,
 *       chapter: m => m.chapter_name,
 *       due:     m => m.balance_cents,
 *     }, 'name')
 *     …
 *     <SortTh label="Name" {...sortProps('name')} />
 *     <SortTh label="Balance" align="end" {...sortProps('due')} />
 *
 * ── THREE THINGS IT DECIDES, SO TWENTY TABLES DO NOT DECIDE THEM DIFFERENTLY ───────
 *
 *   * **The first press on a new column sorts ASCENDING**, and pressing the active column
 *     again reverses it. Not "remember each column's last direction" — that makes the same
 *     press do different things depending on history, which is the one thing a sort control
 *     must not do.
 *   * **The extractor returns a `SortValue`, not a rendered string.** A money column sorts on
 *     `amount_cents` and prints `$1,234.00`; a date sorts on `YYYY-MM-DD` and prints
 *     "June 12th, 2026". Sorting the rendered text is how "$9.00" ends up after "$10.00" and
 *     how a date column orders by month name.
 *   * **`useMemo` on the rows**, keyed on the incoming array and the sort. A table that
 *     re-sorts on every keystroke of its own filter box is the reason these lists have filter
 *     boxes at all (AGENTS.md, "Build every member list for a hundred-member family").
 */
export function useTableSort<
  T,
  // THE KEYS COME FROM `columns` AND NOT FROM `initialKey`. Written as
  // `<T, K extends string>(…, columns: Record<K, …>, initialKey: K)`, TypeScript infers `K`
  // from BOTH parameters and takes the narrower — so `initialKey: 'name'` pinned `K` to
  // `'name'` and every other column in the object became an excess property. Inferring the
  // whole record and deriving the key from it is what makes the call site read naturally.
  C extends Record<string, (row: T) => SortValue>,
>(
  rows: readonly T[],
  columns: C,
  initialKey: keyof C & string,
  initialDir: SortDir = 'asc',
) {
  type K = keyof C & string
  const [key, setKey] = useState<K>(initialKey)
  const [dir, setDir] = useState<SortDir>(initialDir)
  // ── THE READER'S ALPHABET, NOT THE HOST'S ─────────────────────────────────────────
  // `lib/sort-rows.ts` decision 2 has the measurement: `ñ` is a letter of its own in Spanish
  // and files after `n`, so a family with a Muñoz in it saw the name in the English position
  // until this was threaded. `useIntlTag()` and not `useT()` — a collation is an `Intl` tag
  // (`es-MX`) rather than a catalogue code (`es`), and this hook renders no words at all.
  const intl = useIntlTag()

  const sorted = useMemo(
    () => sortRows(rows, columns[key], dir, intl),
    // `columns` is an object literal at the call site and so is a new identity every render —
    // depending on it would defeat the memo entirely. The KEY is what selects the extractor,
    // and a table does not change what a column means while it is on screen.
    //
    // ── SO AN EXTRACTOR MUST READ ITS OWN ROW, AND NOTHING ELSE ──────────────────────
    // Added 2026-08-31 after three tables in that rollout broke this. `rows` is the only
    // data in the dep list, so a column COMPOSED FROM ANOTHER LIST — a region's chapter
    // count out of `chapters`, a milestone's fund name out of `funds`, a segment's task
    // count out of `tasks` — re-renders its CELLS with the new figure while keeping the
    // ORDER derived from the old one. A table sorted ascending by chapter count then shows
    // 5 above 3, and all three of those panes write optimistically with no
    // `router.refresh()`, so nothing comes along to correct it.
    //
    // A `deps` parameter was the obvious fix and cannot be written: the React Compiler
    // lint rule requires this dep list to be an array literal, so there is nothing to
    // spread into. COMPOSE THE VALUE ONTO THE ROW INSTEAD, in a `useMemo` of the caller's
    // own that lists the other list as a dependency, and let the extractor read the field.
    // `AdminRegionsChaptersClient` is the worked example. That is also the shape the
    // contract above describes — the extractor returns a `SortValue` off its row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, key, dir, intl],
  )

  function toggle(next: K) {
    if (next === key) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setKey(next); setDir('asc') }
  }

  /** Spread onto a `SortTh`. Keeps the heading and the ordering from disagreeing about state. */
  function sortProps(col: K) {
    return { active: key === col, dir, onClick: () => toggle(col) }
  }

  return { rows: sorted, sortKey: key, sortDir: dir, toggle, sortProps }
}
