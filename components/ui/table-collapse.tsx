/**
 * How a table narrows on a phone instead of scrolling sideways.
 *
 * ── THE PROBLEM ──────────────────────────────────────────────────────────────
 *
 * Every table in this app used to sit in an `overflow-x-auto` box over a table with a
 * `min-w-*` floor — 52rem on the two member tables, 760px on My Summary's dues, 44rem
 * on Accounting's schedules. On a 390px screen that is a window onto something two or
 * three times as wide, and horizontal scrolling inside a page that also scrolls down is
 * the worst of the options available:
 *
 *   * The gesture is easy to start by accident and hard to aim.
 *   * The column parked off-screen is invariably the one people came for — the amount,
 *     or the row menu.
 *   * The heading row slides away with the columns it names, so what you scroll TO is
 *     unlabelled. The table's whole accessibility argument is that a cell is announced
 *     with its column; sideways scroll takes that away from sighted users only.
 *
 * ── THE PATTERN ──────────────────────────────────────────────────────────────
 *
 * A column that is not the row's subject or its headline figure gets `COLLAPSING_CELL`
 * on BOTH its `<th>` and every one of its `<td>`s, and the row restates it in a
 * `<RowMeta>` inside the first cell. Below `sm` the table is two or three columns; from
 * `sm` up it is exactly what it was.
 *
 * ```tsx
 * <th className={cn('px-3 py-2', COLLAPSING_CELL)}>Date</th>
 * …
 * <td className="px-3 py-2">
 *   {row.name}
 *   <RowMeta>
 *     <span>{row.fund}</span><MetaDot /><span>{formatDate(row.date)}</span>
 *   </RowMeta>
 * </td>
 * <td className={cn('px-3 py-2', COLLAPSING_CELL)}>{formatDate(row.date)}</td>
 * ```
 *
 * ── WHY NOT THE OTHER TWO OPTIONS ────────────────────────────────────────────
 *
 * **Not `display: block` on the rows and cells.** That is the usual recipe for a
 * "responsive table" and it throws away the table semantics entirely: a `<td>` set to
 * block loses its implicit cell role, so the thing a screen reader was navigating as a
 * grid becomes a pile of divs. "A table is a table" in AGENTS.md exists because these
 * lists were flex rows once; this would put them back.
 *
 * **Not a second, stacked rendering below `sm`.** Two renderings of the same row drift —
 * a column added to one and not the other is invisible until someone opens a phone. The
 * cells here are the SAME cells, hidden by a media query.
 *
 * ── WHAT THE HIDING ACTUALLY DOES ────────────────────────────────────────────
 *
 * `display: none` removes the element from the accessibility tree, which is the desired
 * behaviour and the reason the `<th>` must go with its `<td>`s: hide four cells and
 * leave five headings, and every remaining cell is announced under the wrong column.
 * Hide both and the mobile table is a coherent two-column table with two headings.
 *
 * Nothing is lost, only moved. Everything a collapsed column held is on the row, in the
 * meta line — and on the money ledgers, in full in the row's detail dialog.
 *
 * ── COLLAPSING A COLUMN THAT HOLDS A CONTROL ─────────────────────────────────
 *
 * Some do: the cadence `<Select>` on My Summary, the Minimum $ `<Input>` on dues
 * routing, the scope buttons on the permission grid. Render the SAME element in both
 * places — assign it to a variable and use it twice — rather than describing it in the
 * meta line, or the field becomes read-only on a phone.
 *
 * Two elements exist in the DOM and only one is ever `display: none`-free, so only one
 * is focusable and only one is in the accessibility tree. Both are bound to the same
 * state, so they cannot disagree. The one thing this forbids is an `id`: two elements
 * sharing one would be a duplicate-id violation and would break any `<label htmlFor>`
 * pointing at it. Use `aria-label` instead — which these need anyway, since the column
 * heading that named them is gone.
 *
 * And LABEL the control in the meta line. A bare second number box under a percentage
 * box, with the headings that distinguished them folded away, is a coin toss.
 */
import { cn } from '@/lib/utils'

/**
 * Put this on every `<th>` and `<td>` of a collapsing column.
 *
 * `sm:table-cell` and not `sm:block`: a `<td>` reverted to `block` is still not a cell,
 * so the column would come back visually and stay broken for a screen reader.
 */
export const COLLAPSING_CELL = 'hidden sm:table-cell'

/**
 * What the collapsed columns say once they are gone: a small line under the row's
 * subject, rendered only where those columns are not.
 *
 * Takes nodes rather than strings on purpose — a status pill is the one collapsed value
 * that carries meaning in its colour, and restating it as grey text would render the
 * row's most important fact as its least visible one.
 */
export function RowMeta({ children, className }: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn(
      'mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground sm:hidden',
      className,
    )}>
      {children}
    </div>
  )
}

/**
 * The separator between two `RowMeta` values — the same interpunct the disbursements
 * Fund/Milestone cell uses, so the two read as the same kind of subordinate detail.
 *
 * Decorative: the gap already separates them visually, and a screen reader reading
 * "Reunion Fund · 4 June" out as "Reunion Fund middle dot 4 June" is noise.
 */
export function MetaDot() {
  return <span aria-hidden="true" className="text-muted-foreground/50">·</span>
}

/**
 * A value that is only worth a meta line when it exists.
 *
 * An em-dash is what a missing value looks like in a COLUMN, where the cell has to hold
 * the grid open. There is no grid in a meta line, so a value we do not have is simply
 * not a line — `<MetaIf value={row.phone} />` renders nothing rather than "—".
 */
export function MetaIf({ value, prefix }: { value?: string | null; prefix?: string }) {
  if (!value) return null
  return <span>{prefix ? `${prefix} ${value}` : value}</span>
}
