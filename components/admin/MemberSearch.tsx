'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Search, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MEMBER_PAGE_SIZE } from '@/lib/pagination'
import type { MemberPage, MemberSummary } from '@/app/actions/admin/permissions'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * Search + paging over a family's members. Families can run past 500 people, so
 * both happen in the database — this component only ever holds one page.
 *
 * The caller supplies `fetchPage` rather than the query being baked in. Members &
 * Access is the only caller today — it was written when there were two, and the seam
 * is worth keeping for the next screen that needs a member picker.
 */
export function usePagedMembers(
  fetchPage: (opts: { query: string; offset: number }) => Promise<MemberPage>,
  deps: unknown[] = [],
) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<MemberPage>({ rows: [], total: 0 })
  const [isPending, startTransition] = useTransition()
  const reqId = useRef(0)

  // Debounce typing so a 500-member family isn't queried on every keystroke.
  // Both updates happen in the timeout callback rather than the effect body: a
  // new search also resets to the first page, and doing it here keeps the two in
  // one commit instead of firing a second render pass.
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(query); setPage(0) }, 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const id = ++reqId.current
    startTransition(async () => {
      const result = await fetchPage({ query: debounced, offset: page * MEMBER_PAGE_SIZE })
      // Ignore a slow response that a newer request has already superseded.
      if (id === reqId.current) setData(result)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, page, ...deps])

  const reload = () => {
    const id = ++reqId.current
    startTransition(async () => {
      const result = await fetchPage({ query: debounced, offset: page * MEMBER_PAGE_SIZE })
      if (id === reqId.current) setData(result)
    })
  }

  return { query, setQuery, page, setPage, data, isPending, reload }
}

export function MemberSearchBox({ value, onChange, placeholder, pending }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  pending?: boolean
}) {
  const t = useT()
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 ps-8 pe-16"
        aria-label={placeholder}
      />
      <span className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            aria-label={t('ms.clear')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    </div>
  )
}

export function Pager({ page, total, onPage }: {
  page: number
  total: number
  onPage: (p: number) => void
}) {
  const t = useT()
  const pages = Math.max(1, Math.ceil(total / MEMBER_PAGE_SIZE))
  if (total === 0) return null

  const from = page * MEMBER_PAGE_SIZE + 1
  const to = Math.min(total, (page + 1) * MEMBER_PAGE_SIZE)

  return (
    <div className="flex items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
      <span>
        {from}–{to} of {total}
      </span>
      {pages > 1 && (
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page === 0}
            className={cn('rounded p-1', page === 0 ? 'opacity-40' : 'hover:bg-muted')}
            aria-label={t('ms.prevPage')}
          >
            <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" />
          </button>
          <span className="tabular-nums">
            {page + 1} / {pages}
          </span>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page + 1 >= pages}
            className={cn('rounded p-1', page + 1 >= pages ? 'opacity-40' : 'hover:bg-muted')}
            aria-label={t('ms.nextPage')}
          >
            <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
          </button>
        </span>
      )}
    </div>
  )
}

export type { MemberSummary }
