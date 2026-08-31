'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react'
import { MemberSearchBox } from '@/components/admin/MemberSearch'
import { SortTh, useTableSort } from '@/components/ui/sortable-header'
import { PageScopedSortNote } from '@/components/staff/PageScopedSortNote'
import { COLLAPSING_CELL, RowMeta, MetaDot } from '@/components/ui/table-collapse'
import { FormError } from '@/components/ui/form-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import {
  listStaffAccounts, lookupStaffAccount,
  type StaffAccountLookup, type StaffAccountPage, type StaffMembership,
} from '@/app/actions/staff/accounts'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'
import { StaffDeleteAccountDialog } from '@/components/staff/StaffDeleteAccountDialog'

/**
 * The screen support opens when somebody says they cannot sign in.
 *
 * ── TWO CONTROLS, ANSWERING TWO DIFFERENT QUESTIONS ────────────────────────────────
 * The table browses; the lookup at the top answers about ONE address, and it is not a
 * more convenient version of the filter. A table can only show what matched, so an empty
 * result is three different sentences at once — "no account has that address", "the
 * filter matched nothing", and "we could not ask". Those are the three things a support
 * engineer needs to tell apart, and only the lookup can: `accountStateForEmail` returns
 * `null` for the failure and `{ exists: false }` for the definite no, and the action
 * pairs it with the `people` rows carrying that address so an invitation nobody took up
 * shows as itself rather than as nothing at all.
 *
 * ── PAGING IS PREV/NEXT AND NOT `Pager` ────────────────────────────────────────────
 * `Pager` is the shared control and is deliberately not reused here: it derives a page
 * count from a total, and there is no dependable total to give it. GoTrue's admin list
 * does not return one (see `lib/auth/account-state.ts`), so the page number is stated and
 * Next is offered whenever the page came back full — which is honest, where a "page 3 of
 * 12" built on a guess would not be.
 *
 * ── UNCONFIRMED IS `--brand-withheld`, NOT `--destructive` ─────────────────────────
 * An address that has never been confirmed withholds a capability — signing in — and
 * nothing is broken, deleted or failed: the account exists and one email fixes it. That
 * is precisely the reversible-withholding role, and `--destructive` in this file belongs
 * to `FormError` alone, which reports a refused operation.
 */
export function StaffAccountsClient({ initial, isOwner = false }: {
  initial: StaffAccountPage
  /**
   * Is the caller a GENORRA staff OWNER?
   *
   * Resolved on the server and handed down, for `AccountMenu`'s `isStaff` reason:
   * `genorra_staff` has RLS with no policies, so the browser cannot read its own row. It
   * decides whether a CONTROL is rendered and nothing else — `deleteStaffAccount` opens with
   * `requireStaffOwner()` and `staff_delete_account` re-asks in SQL, so a forged prop is
   * refused twice more (AGENTS.md §2). Defaults to false, so a caller that has not thought
   * about it withholds the control.
   */
  isOwner?: boolean
}) {
  return (
    <div className="space-y-8">
      <LookupPanel />
      <AccountTable initial={initial} isOwner={isOwner} />
    </div>
  )
}

/** The one-address answer: does this account exist, is it usable, where does it belong. */
function LookupPanel() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<StaffAccountLookup | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const wanted = email.trim()
    if (!wanted) {
      setError(t('staff.enterFromTicket'))
      return
    }
    setError('')
    startTransition(async () => {
      setResult(await lookupStaffAccount(wanted))
    })
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-base font-semibold text-brand-ink">{t('staff.lookUpOne')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('stf.pasteAddressFromTicket')}</p>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Label htmlFor="staff-lookup-email">{t('field.emailAddress')}</Label>
          <Input
            id="staff-lookup-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('staff.lookupPh')}
            className="mt-1 h-9"
            autoComplete="off"
          />
        </div>
        <Button type="submit" size="lg" disabled={isPending} className="shrink-0">
          {isPending
            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            : <Search className="h-4 w-4" aria-hidden="true" />}
          Look up
        </Button>
      </form>

      <FormError message={error} className="mt-3" />

      {result && <LookupResult result={result} />}
    </section>
  )
}

function LookupResult({ result }: { result: StaffAccountLookup }) {
  const t = useT()
  const { state } = result

  return (
    <div className="mt-5 space-y-3 border-t pt-4 text-sm">
      <p className="font-medium break-all">{result.email}</p>

      {/* THE THREE ANSWERS, KEPT APART. `null` is "we could not ask", which must never be
          rendered as "no account" — a support engineer acting on that would tell somebody
          to register again and create a second account for them. */}
      {state === null ? (
        <p className="text-muted-foreground">{t('stf.authenticationServiceDidNot')}</p>
      ) : !state.exists ? (
        <p className="text-muted-foreground">
          {t('staff.neverRegistered', { lede: t('staff.noAccount') })}
        </p>
      ) : (
        <ul className="space-y-1.5 text-muted-foreground">
          <li>{t('staff.accountExists')}</li>
          <li>
            {state.confirmed
              ? t('staff.confirmed')
              : (
                <span className="text-brand-withheld">{t('stf.addressNeverBeenConfirmed')}</span>
              )}
          </li>
          <li>
            {state.signedInBefore
              ? t('staff.hasSignedIn')
              : t('staff.neverSignedIn')}
          </li>
        </ul>
      )}

      {result.membershipsFailed ? (
        <p className="text-muted-foreground">{t('stf.familyRecordsAddressCould')}</p>
      ) : result.memberships.length === 0 ? (
        <p className="text-muted-foreground">{t('stf.addressNoFamilyRecord')}</p>
      ) : (
        <div>
          <p className="mb-1.5 font-medium">{t('staff.inTheseFamilies')}</p>
          <MembershipList memberships={result.memberships} />
        </div>
      )}
    </div>
  )
}

/** The browsable list: one row per account, memberships beside it. */
function AccountTable({ initial, isOwner }: {
  initial: StaffAccountPage
  /** See `StaffAccountsClient`. Decides a control, never an access. */
  isOwner: boolean
}) {
  const intl = useIntlTag()
  const t = useT()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  // 1-BASED, as GoTrue numbers pages, so the number in this state is the number sent to
  // the server. Converting between a 0-based UI page and a 1-based API page in two places
  // is how an off-by-one gets in.
  const [page, setPage] = useState(1)
  const [data, setData] = useState<StaffAccountPage>(initial)

  // ── SORTING ORDERS THE PAGE, AND HERE IT CAN NEVER BE OTHERWISE ──────────────────
  // Families next door pages a Postgres query and could in principle be sorted server-side.
  // This one cannot: it pages GoTrue's admin `listUsers`, which offers no ordering parameter
  // at all, so the only list that exists to sort is the one in hand. `PageScopedSortNote`
  // under the table says so when there is more than one page — the same sentence and the same
  // component both screens use, because it is the same limitation and two wordings would
  // drift.
  //
  // NO `total`, EITHER, which is why the note is given `hasMore`. GoTrue returns no dependable
  // count (`lib/auth/account-state.ts` says so, and it is why the pager here states a page
  // number rather than "3 of 9"), so there is no figure to compare against a page size.
  // "There is at least one more page" is the whole of what can be known, and it is enough to
  // decide whether the caveat applies.
  //
  // STATUS SORTS ON THE SAME TEST THE CELL RENDERS. `confirmedAt` being null is what the
  // column reports — an unconfirmed address, the first thing to check on a support call — so
  // unconfirmed sorts FIRST ascending. A boolean, which `lib/sort-rows.ts` puts true-first on
  // exactly that reasoning: the flagged rows are what somebody pressing the heading is after.
  //
  // FAMILIES SORTS ON THE COUNT, not on the names in the cell. An account belonging to no
  // family is "a finding, not a blank" per `StaffAccountRow`, and a count sorts it to one end
  // where the reader can act on it; ordering by the first family's name would scatter those
  // rows through the alphabet.
  const { rows: sortedRows, sortProps } = useTableSort(data.rows, {
    incoming: () => 0,
    email: r => r.email,
    status: r => r.confirmedAt == null,
    families: r => r.memberships.length,
    lastSignIn: r => r.lastSignInAt,
    created: r => r.createdAt,
  }, 'incoming')
  const [isPending, startTransition] = useTransition()

  const reqId = useRef(0)
  // The server rendered page 1 already; without this the mount effect fetches it again.
  const first = useRef(true)

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(query); setPage(1) }, 250)
    return () => clearTimeout(t)
  }, [query])

  /**
   * Re-read the current page.
   *
   * NAMED rather than left inline in the effect, because a deletion has to be able to call
   * it: patching the deleted row out of local state would leave this screen's page COUNT and
   * its total describing a platform that has changed underneath them — on the one screen
   * whose job is saying what is true. `StaffFamiliesClient` makes the same call for the same
   * reason.
   */
  const load = () => {
    const id = ++reqId.current
    startTransition(async () => {
      const result = await listStaffAccounts({ page, query: debounced })
      // Ignore a response a newer request has already superseded.
      if (id === reqId.current) setData(result)
    })
  }

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    load()
    // `load` is recreated every render and listing it would refetch forever. The two values
    // it closes over are the two in this list — the same exemption `StaffFamiliesClient`
    // carries with the same comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, page])

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-brand-ink">{t('staff.allAccounts')}</h2>

      <MemberSearchBox
        value={query}
        onChange={setQuery}
        placeholder={t('staff.filterAddress')}
        pending={isPending}
      />

      {data.failed ? (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{t('stf.accountListCouldNot')}</p>
      ) : data.rows.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          {debounced
            ? t('staff.noAddressMatches', { query: debounced })
            : t('staff.noAccounts')}
        </p>
      ) : (
        /*
         * The same table rules as everywhere else: a real <table> with real column
         * headings, and below `sm` the subordinate columns FOLD rather than the table
         * scrolling sideways. What stays is what this table answers — which address, and
         * is the account usable — so Email and Status keep their columns and Families,
         * Last sign-in and Created move into the meta line under the address.
         */
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <SortTh label={t('field.email')} {...sortProps('email')} className="px-3 py-2 font-semibold" />
                <SortTh label={t('money.status')} {...sortProps('status')} className="px-3 py-2 font-semibold" />
                <SortTh label={t('staff.families')} {...sortProps('families')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                <SortTh label={t('staff.lastSignIn')} {...sortProps('lastSignIn')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                <SortTh label={t('staff.created')} {...sortProps('created')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                {/* AN `sr-only` HEADING, not an empty `<th>`. A screen reader announces the
                    column when it reads the cell, and a column with no heading to give still
                    needs one — AGENTS.md, "A table is a table". Rendered only when the
                    column is, so the grid does not hold a phantom sixth column open for
                    everybody else. */}
                {isOwner && (
                  <th scope="col" className="px-3 py-2 font-semibold">
                    <span className="sr-only">{t('staff.actions')}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(row => (
                <tr key={row.userId} className="border-b align-top last:border-0">
                  <td className="px-3 py-2.5">
                    <span className="font-medium break-all">{row.email || '(no address)'}</span>
                    <RowMeta className="flex-col items-start gap-y-1">
                      <span>
                        {row.memberships.length === 0
                          ? t('staff.inNoFamily')
                          : `${row.memberships.length} ${row.memberships.length === 1 ? 'family' : 'families'}`}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-1.5">
                        {/* PREFIXED. Two bare dates under an address are a coin toss once
                            the headings that distinguished them are folded away. */}
                        <span>
                          {t('staff.lastSignIn', {
                            date: formatDate(row.lastSignInAt, intl) ?? t('staff.never'),
                          })}
                        </span>
                        <MetaDot />
                        <span>Created {formatDate(row.createdAt, intl) ?? '—'}</span>
                      </span>
                    </RowMeta>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        'inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
                        row.confirmedAt
                          ? 'bg-brand-soft text-brand-on-soft'
                          : 'bg-brand-withheld/10 text-brand-withheld',
                      )}
                    >
                      {row.confirmedAt ? t('staff.confirmedShort') : t('staff.notConfirmed')}
                    </span>
                  </td>
                  <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>
                    {row.memberships.length === 0
                      ? <span className="text-muted-foreground">{t('staff.inNoFamily')}</span>
                      : <MembershipList memberships={row.memberships} />}
                  </td>
                  <td className={cn('px-3 py-2.5 whitespace-nowrap text-muted-foreground', COLLAPSING_CELL)}>
                    {formatDate(row.lastSignInAt, intl) ?? 'Never'}
                  </td>
                  <td className={cn('px-3 py-2.5 whitespace-nowrap text-muted-foreground', COLLAPSING_CELL)}>
                    {formatDate(row.createdAt, intl) ?? '—'}
                  </td>
                  {/* ── AND THE ONE CONTROL WITH NO UNDO, FOR AN OWNER ──────────────────
                      Rendered for nobody else, not disabled for them: a control a `support`
                      staffer can see and not use teaches them the console has buttons that
                      do not work. Same call `AccountMenu` makes about the staff link itself.

                      NOT COLLAPSING. Every other column here folds on a phone; the action
                      does not, because a row you cannot act on is a row you have to widen
                      the window to act on. */}
                  {isOwner && (
                    <td className="px-3 py-2.5 text-right">
                      {row.email ? (
                        <StaffDeleteAccountDialog
                          email={row.email}
                          familyCount={row.memberships.length}
                          onDeleted={load}
                        />
                      ) : (
                        // An account with no address cannot be deleted by this path: the
                        // function resolves the row BY address. Rare and real — GoTrue
                        // permits a phone-only account — so it says so rather than
                        // rendering a button that would refuse.
                        <span className="text-xs text-muted-foreground">{t('staff.noAddress')}</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PageScopedSortNote moreThanOnePage={data.hasMore || data.page > 1} />

      {/* Prev/Next over an unknown total — see the header for why `Pager` cannot be used. */}
      <div className="flex items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
        <span>Page {data.page}</span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1 || isPending}
            className={cn('rounded p-1', page <= 1 ? 'opacity-40' : 'hover:bg-muted')}
            aria-label={t('ms.prevPage')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPage(p => p + 1)}
            disabled={!data.hasMore || isPending}
            className={cn('rounded p-1', !data.hasMore ? 'opacity-40' : 'hover:bg-muted')}
            aria-label={t('ms.nextPage')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </span>
      </div>
    </section>
  )
}

/**
 * The families one address belongs to, each with the two facts that decide whether the
 * person can actually get in: whether their membership is approved, and whether the
 * family is still there.
 *
 * A REMOVED FAMILY IS SAID OUT LOUD rather than left to the reader, because it is the one
 * cause of "I cannot sign in" that looks like nothing at all from the member's side: their
 * password works, their account is confirmed, and every page answers as though the family
 * does not exist. `--brand-withheld` again — the family was not deleted, and the Families
 * screen can put it back.
 */
function MembershipList({ memberships }: { memberships: StaffMembership[] }) {
  return (
    <ul className="space-y-1">
      {memberships.map(m => (
        <li key={m.personId} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="font-medium">{m.familyName}</span>
          <span className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-muted-foreground">
            {m.familyCode}
          </span>
          <span
            className={cn(
              'text-xs',
              m.membershipStatus === 'approved' ? 'text-muted-foreground' : 'text-brand-withheld',
            )}
          >
            {m.membershipStatus}
          </span>
          {m.familyStatus === 'removed' && (
            <span className="rounded-full bg-brand-withheld/10 px-1.5 py-0.5 text-[11px] font-medium text-brand-withheld">
              family removed
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
