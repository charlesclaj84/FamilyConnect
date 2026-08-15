'use client'

import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SortDir = 'asc' | 'desc'

/**
 * A sortable column heading.
 *
 * Lifted out of DuesDetailSection when 20260815000000 split that file into the two
 * screens it had grown into — [Dues](/dues) and [Payment History](/payment-history) —
 * because both tables sort and one of them would otherwise have got a second copy.
 * Which is the whole failure mode AGENTS.md keeps returning to: styling repeated by
 * hand is invisible until you put two screens side by side.
 *
 * A real `<th>` with the button inside it, not a `<th>` made clickable. The heading has
 * to stay a heading — AGENTS.md's "a table is a table" rests on a cell being announced
 * with its column, and a `<th>` that has become a control announces neither.
 */
export function SortTh({
  label, active, dir, onClick, align = 'left', className,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  align?: 'left' | 'right'
  /** Pass `COLLAPSING_CELL` when this heading's column folds below `sm`. */
  className?: string
}) {
  const Icon = active ? (dir === 'asc' ? ChevronUp : ChevronDown) : ArrowUpDown
  return (
    <th className={cn(
      'py-2 pr-3 text-xs font-medium text-muted-foreground',
      align === 'right' ? 'text-right' : 'text-left',
      className,
    )}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-0.5 hover:text-foreground select-none ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {label}
        <Icon className="h-3 w-3 opacity-60" />
      </button>
    </th>
  )
}
