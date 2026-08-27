'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { RotateCcw } from 'lucide-react'
import { MEMBER_PAGE_SIZE } from '@/lib/pagination'
import { MemberSearchBox, Pager } from '@/components/admin/MemberSearch'
import { COLLAPSING_CELL, RowMeta, MetaDot } from '@/components/ui/table-collapse'
import { FormError } from '@/components/ui/form-message'
import { useConfirm } from '@/components/ui/confirm'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/date-utils'
import { TIER_LABEL } from '@/lib/tiers'
import { cn } from '@/lib/utils'
import {
  listStaffFamilies, restoreFamily,
  type StaffFamilyPage, type StaffFamilyRow,
} from '@/app/actions/staff/families'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'

/**
 * Every family on the platform, filtered and paged, with one action: put a removed one
 * back.
 *
 * ── THE FILTER AND THE PAGER ARE THE ADMIN ONES ────────────────────────────────────
 * `MemberSearchBox` and `Pager` are imported from `components/admin/MemberSearch.tsx`
 * rather than rewritten. Both are already generic — a value/onChange box and a
 * prev/next over a total — and the alternative is a second search box that drifts from
 * the first, which is the exact failure `form-message.tsx` and `person-multi-select.tsx`
 * exist to stop. `usePagedMembers` beside them is NOT reused: it is typed to `MemberPage`
 * and would need widening to a generic for one caller, which is a change to a control on
 * the family product's most sensitive screen for the benefit of a console.
 *
 * The page size is `MEMBER_PAGE_SIZE` because `Pager` computes its page count from that
 * constant. Passing a different `limit` to the action would produce a pager that is
 * confidently wrong about how many pages there are.
 *
 * ── WHY THE FIRST PAGE IS SERVER-RENDERED AND THE REST IS NOT ──────────────────────
 * The page hands down `initial`, so the table is there on first paint; typing and paging
 * go back to the server action, because a platform is not a list you ship to a browser
 * and filter there (and `max_rows = 1000` would truncate it silently if you tried). The
 * `first` ref below is what stops the mount effect immediately re-fetching the page the
 * server just rendered.
 *
 * ── REMOVED IS `--brand-withheld`, NOT `--destructive` ─────────────────────────────
 * Removal destroys nothing — no row is deleted anywhere, `families.status` moves and the
 * button in this table moves it back — so the alarm hue would be describing a deletion
 * that did not happen. `--brand-withheld` is the role for a capability being withheld by
 * a reversible change, and it is a FOREGROUND: it has no `on-` partner, so it is used as
 * text and as a tint under text, never as a fill carrying it (AGENTS.md, "Colours live in
 * one place"). `--destructive` in this file belongs to `FormError` alone, which is what
 * reports a refused operation.
 */
export function StaffFamiliesClient({ initial }: { initial: StaffFamilyPage }) {
  const intl = useIntlTag()
  const t = useT()
  const confirm = useConfirm()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<StaffFamilyPage>(initial)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Ignore a slow response a newer request has already superseded — the same guard
  // `usePagedMembers` carries, and it matters more here: a filter typed quickly issues
  // several overlapping reads and the last one to ARRIVE is not necessarily the last one
  // asked for.
  const reqId = useRef(0)
  // The server already rendered page 0 of the unfiltered list. Without this the mount
  // effect would fetch it again on every load of the screen.
  const first = useRef(true)

  // Debounced, so a platform is not queried on every keystroke. Both updates happen in
  // the timeout callback because a new search also resets to the first page, and doing
  // them together keeps it to one commit.
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(query); setPage(0) }, 250)
    return () => clearTimeout(t)
  }, [query])

  function load() {
    const id = ++reqId.current
    startTransition(async () => {
      const result = await listStaffFamilies({
        query: debounced,
        offset: page * MEMBER_PAGE_SIZE,
        limit: MEMBER_PAGE_SIZE,
      })
      if (id === reqId.current) setData(result)
    })
  }

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    load()
    // `load` is recreated every render and depends on exactly these two values; listing
    // it here instead would refetch on every render forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, page])

  async function handleRestore(row: StaffFamilyRow) {
    // NOT `destructive: true`. The affirmative here CREATES access rather than removing
    // it, and the red treatment on a restore would read as a warning about the wrong
    // direction — the same distinction the colour tokens draw.
    const ok = await confirm({
      title: `Restore ${row.familyName}?`,
      description:
        `${row.familyCode} becomes reachable again immediately: its members can sign in `
        + 'to it, its family code works, and its invitations resolve. Nothing was deleted '
        + 'when it was removed, so every record it holds comes back with it.',
      confirmLabel: t('staff.restoreFamily'),
    })
    if (!ok) return

    setError('')
    startTransition(async () => {
      const result = await restoreFamily(row.familyCode)
      if (!result.success) {
        setError(result.message)
        return
      }
      // Re-read rather than patching the row in place. The action revalidates the
      // console's own routes, and a status this screen invented locally could disagree
      // with what the database actually did — on the one screen whose job is saying what
      // is true.
      load()
    })
  }

  return (
    <div className="space-y-4">
      <MemberSearchBox
        value={query}
        onChange={setQuery}
        placeholder={t('staff.filterFamily')}
        pending={isPending}
      />

      {/* One per screen, beside the control that caused it. Renders nothing for an empty
          message, hence no `{error && …}` guard. */}
      <FormError message={error} />

      {data.failed ? (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          The families list could not be read. That is a refused query rather than an empty
          platform — try again in a moment, and check the server log for the reason.
        </p>
      ) : data.rows.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          {debounced
            ? `No family matches “${debounced}”.`
            : t('staff.noFamilies')}
        </p>
      ) : (
        /*
         * A real <table> with real `<th scope="col">`, so a cell is announced with the
         * column it belongs to. Below `sm` the four subordinate columns FOLD — they are
         * `COLLAPSING_CELL` on the heading and on every cell, and the row restates them
         * in a `<RowMeta>` under the family name. No `overflow-x-auto` and no `min-w-*`
         * floor anywhere: sideways scroll parks the column somebody came for off-screen
         * and takes the heading row away with it (AGENTS.md, "On a phone a table narrows").
         *
         * WHAT STAYS is chosen by what this table answers — which family, and is it
         * removed. So Family and Status keep their columns, along with the one control,
         * and Plan / Members / Created fold into the meta line.
         */
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-semibold">{t('staff.family')}</th>
                <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>{t('set.pane.plan')}</th>
                <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>{t('rep.members')}</th>
                <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>{t('staff.created')}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{t('money.status')}</th>
                {/* A column with no caption to give still owes one — without it a screen
                    reader announces the restore button under whatever heading came last. */}
                <th scope="col" className="px-3 py-2 font-semibold">
                  <span className="sr-only">{t('money.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(row => {
                const removed = row.status === 'removed'
                return (
                  <tr key={row.familyCode} className="border-b align-top last:border-0 sm:align-middle">
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{row.familyName}</span>
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {row.familyCode}
                      </span>
                      <RowMeta>
                        <span>{TIER_LABEL[row.tier]}</span>
                        <MetaDot />
                        <span>{row.memberCount} {row.memberCount === 1 ? 'member' : 'members'}</span>
                        {row.createdAt && (
                          <>
                            <MetaDot />
                            {/* PREFIXED, because a bare date under a family name could be
                                either of the two dates this row carries. The removal date
                                is stated in the status cell, which stays visible. */}
                            <span>Created {formatDate(row.createdAt, intl)}</span>
                          </>
                        )}
                      </RowMeta>
                    </td>
                    <td className={cn('px-3 py-2.5 whitespace-nowrap', COLLAPSING_CELL)}>
                      {TIER_LABEL[row.tier]}
                    </td>
                    <td className={cn('px-3 py-2.5 text-right tabular-nums', COLLAPSING_CELL)}>
                      {row.memberCount}
                    </td>
                    <td className={cn('px-3 py-2.5 whitespace-nowrap text-muted-foreground', COLLAPSING_CELL)}>
                      {formatDate(row.createdAt, intl) ?? '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          'inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
                          removed
                            ? 'bg-brand-withheld/10 text-brand-withheld'
                            : 'bg-brand-soft text-brand-on-soft',
                        )}
                      >
                        {removed ? t('staff.removed') : t('staff.active')}
                      </span>
                      {removed && row.removedAt && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(row.removedAt, intl)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {removed ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => { void handleRestore(row) }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('staff.restore')}
                        </Button>
                      ) : (
                        // An em-dash rather than nothing: the cell has to hold the grid
                        // open, and an empty box beside a row that has a button reads as
                        // a button that failed to render.
                        <span className="text-muted-foreground" aria-hidden="true">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} total={data.total} onPage={setPage} />
    </div>
  )
}
