'use client'

import { useMemo, useState } from 'react'
import { Search, TrendingUp, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import { disambiguatedName } from '@/lib/name-utils'
import { matchesPersonQuery } from '@/lib/person-search'
import { COLLAPSING_CELL, RowMeta, MetaDot, MetaIf } from '@/components/ui/table-collapse'
import { collectedPercent, type DuesStanding } from '@/lib/dues-projection'
import type { DuesProjectionResult, ProjectionPerson } from '@/app/actions/dues'

/**
 * Dues Projections — what the family should collect this year, what it has, and from whom.
 *
 * ── THE FOUR FIGURES, AND WHY THEY ARE FOUR ─────────────────────────────────────────
 * Expected, Collected, Waived, Still to collect. A treasurer's question is not "how much
 * came in" — that is the ledger, on /transactions — it is whether what came in matches what
 * was billed, and the gap has two different explanations that must never be added together:
 *
 *   Waived           the family forgave it. It settles the obligation and no money arrived,
 *                    so it comes off what is still owed and must never reach an income
 *                    figure. Folding it into Collected would put a forgiven due into the
 *                    family's revenue.
 *   Still to collect what is genuinely outstanding — the number the screen exists for.
 *
 * "Pending" renders only when it is non-zero. `dues_payments.status = 'pending'` is a real
 * state that nothing writes today (recordPayment refuses it; the pending→paid settlement is
 * left open for an online-payment webhook), so a permanent $0.00 tile would be a figure
 * nobody can explain — the same rule the Dashboard's Pending Approval tile follows.
 *
 * ── EACH SCHEDULE HAS ITS OWN YEAR, AND THE SCREEN SAYS SO ──────────────────────────
 * `currentPeriodStart` is a property of the schedule, so a family running dues from 1 April
 * and a levy from 1 January has two years in progress. The per-schedule table states the
 * period each row was measured over rather than implying one family-wide year, because the
 * alternative is a headline that disagrees with what every member sees on /dues.
 *
 * ── THE MEMBER TABLE IS BUILT FOR A HUNDRED AND FIFTY ───────────────────────────────
 * A real `<table>` with `<th scope="col">`, a filter box over `matchesPersonQuery` so "jose"
 * finds "José", `disambiguatedName` against the WHOLE roster, and `COLLAPSING_CELL` on every
 * column that is not the person or the figure — no `min-w` floor, because this is a screen a
 * treasurer opens on a phone at a board meeting.
 *
 * Names are disambiguated against the whole roster and never the filtered subset: two Martha
 * Allens are likelier in a large family, and this is the screen where confusing them means
 * chasing the wrong one for money.
 *
 * ── THE COLOURS ─────────────────────────────────────────────────────────────────────
 * `--brand-affirm` for money in, `--brand-withheld` for what is still owed. Withheld and
 * NOT `--destructive`: an unpaid due is neither an error nor a deletion, which is exactly
 * the distinction that token exists for and the same one the "Catching up" pill on /dues
 * already makes. Nobody has failed at anything by not having paid yet.
 */

/** What each standing is called, and what colour it carries. */
const STANDING: Record<DuesStanding, { label: string; className: string; hint: string }> = {
  unpaid:   { label: 'Nothing paid', className: 'bg-brand-withheld/10 text-brand-withheld', hint: 'Owes the whole amount for this period.' },
  partial:  { label: 'Part paid',    className: 'bg-brand-warm text-brand-on-warm',         hint: 'Something in, not all of it.' },
  settled:  { label: 'Settled',      className: 'bg-brand-affirm text-brand-on-affirm',     hint: 'Paid in full, or forgiven.' },
  declined: { label: 'Declined',     className: 'bg-muted text-muted-foreground',           hint: 'Opted out of an optional due.' },
  // Muted rather than affirm, and the distinction is load-bearing: a child below the age a
  // due starts at has not paid anything, and colouring them green would read as settled.
  exempt:   { label: 'Not yet due',  className: 'bg-muted text-muted-foreground',           hint: 'Below the age this due starts at.' },
  // "Not theirs" rather than "not blood". The screen has to account for the money, and it
  // can do that without labelling a relative by how they joined the family — the same call
  // AGENTS.md records for the tree's cards, where the step and adopted pills came off
  // because a word about somebody's route into the family, printed beside their name, reads
  // as a correction attached to a person. The hint says which due it is about; the pill
  // does not say anything about them.
  excluded: { label: 'Not theirs',   className: 'bg-muted text-muted-foreground',           hint: 'This due is owed by the bloodline only.' },
}

/** Least settled first, so the people to chase are at the top before anybody sorts. */
const STANDING_ORDER: readonly DuesStanding[] = [
  'unpaid', 'partial', 'settled', 'declined', 'exempt', 'excluded',
]

export function DuesProjectionsClient({ result }: { result: DuesProjectionResult }) {
  const { projection, people } = result
  const [query, setQuery] = useState('')
  const [onlyOwing, setOnlyOwing] = useState(false)

  const byId = useMemo(
    () => new Map<string, ProjectionPerson>(people.map(p => [p.id, p])),
    [people],
  )

  // Against the WHOLE roster — see the header.
  const nameOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of people) map.set(p.id, disambiguatedName(p, people))
    return map
  }, [people])

  const rows = useMemo(() => {
    const list = projection.members
      .map(m => ({ ...m, person: byId.get(m.personId), name: nameOf.get(m.personId) ?? '' }))
      .filter(r => r.person)
      .filter(r => !onlyOwing || r.outstandingCents > 0)
      // The DISPLAY name is passed as well as the row, so a search matches what is on
      // screen — a disambiguated "Martha Allen (1962)" is findable by the year the screen
      // is showing, not only by the columns behind it.
      .filter(r => matchesPersonQuery(r.person!, r.name, query))
    return list.sort((a, b) =>
      STANDING_ORDER.indexOf(a.standing) - STANDING_ORDER.indexOf(b.standing)
      || b.outstandingCents - a.outstandingCents
      || a.name.localeCompare(b.name))
  }, [projection.members, byId, nameOf, onlyOwing, query])

  const percent = collectedPercent(projection)
  const owing = projection.members.filter(m => m.outstandingCents > 0).length

  return (
    <div className="space-y-6">
      {/* ── THE HEADLINE FIGURES ────────────────────────────────────────────────────
          Four, plus Pending when there is any. Expected leads, because every other
          figure on the screen is a fraction of it. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Figure
          label="Expected this year"
          value={formatCurrency(projection.expectedCents)}
          caption={`${projection.payingMembers} of ${projection.membersCounted} members owe something`}
        />
        <Figure
          label="Collected"
          value={formatCurrency(projection.collectedCents)}
          caption={projection.expectedCents > 0 ? `${percent}% of what was billed, waivers included` : 'Nothing billed yet'}
          tone="affirm"
        />
        <Figure
          label="Waived"
          value={formatCurrency(projection.waivedCents)}
          caption="Forgiven — settles the due, and is not income"
        />
        <Figure
          label="Still to collect"
          value={formatCurrency(projection.outstandingCents)}
          caption={owing === 0 ? 'Everybody is up to date' : `${owing} ${owing === 1 ? 'member has' : 'members have'} something outstanding`}
          tone="withheld"
        />
      </div>

      {/* Only when there is any. See the header: nothing writes this state today, and a
          standing $0.00 would be a figure nobody can account for. */}
      {projection.pendingCents > 0 && (
        <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{formatCurrency(projection.pendingCents)}</span>
          {' '}is awaiting settlement — started and not yet confirmed. It is not counted as
          collected, and it has not been taken off what is still owed.
        </p>
      )}

      {/* HOW THE MEMBER COUNT WAS ARRIVED AT. A figure here that quietly disagrees with the
          Member Directory next door is a figure nobody trusts, so the difference is stated
          rather than left to be discovered. */}
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Counted over {projection.membersCounted} approved {projection.membersCounted === 1 ? 'member' : 'members'} with an account.
          {projection.recordsExcluded > 0 && (
            <> {projection.recordsExcluded} more {projection.recordsExcluded === 1 ? 'person is' : 'people are'} recorded
            in the family without one — a record cannot pay, so nothing is expected from them.</>
          )}
          {' '}Anybody with no date of birth recorded owes a due in full, because an age is
          never guessed at.
        </span>
      </p>

      {/* ── PER SCHEDULE ──────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg">By schedule</h2>
        {projection.schedules.length === 0 ? (
          <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
            No dues schedules are active, so there is nothing to project. Add one under
            Accounting → Dues.
          </p>
        ) : (
          <div className="overflow-visible rounded-xl border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-semibold">Schedule</th>
                  <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Paying</th>
                  <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Expected</th>
                  <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Collected</th>
                  <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Waived</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {projection.schedules.map(s => (
                  <tr key={s.scheduleId} className="border-b align-top last:border-0 sm:align-middle">
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{s.label}</span>
                      <span className={cn(
                        'ml-2 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
                        s.required ? 'bg-brand-soft text-brand-on-soft' : 'bg-brand-warm text-brand-on-warm',
                      )}>
                        {s.required ? 'Required' : 'Optional'}
                      </span>
                      {s.bloodlineOnly && (
                        <span className="ml-1.5 inline-block whitespace-nowrap rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-on-soft"
                          title="Only members descended from the family's line owe this.">
                          Bloodline only
                        </span>
                      )}
                      {/* THE ONE STATE ON THIS SCREEN A TREASURER CANNOT DIAGNOSE FROM THE
                          NUMBERS. Bloodline-only with no bloodline to apply means nobody
                          owes it, so Expected reads $0.00 and there is nothing in the
                          figures to say why. `--brand-withheld` and not `--destructive`:
                          nothing has failed and nothing was deleted — a capability is
                          being withheld, which is exactly what that role is for. */}
                      {s.bloodlineUnknown && (
                        <p className="mt-1 text-xs text-brand-withheld">
                          Nobody owes this: your family has not said which ancestor its line
                          descends from, so there is no bloodline to charge. Set{' '}
                          <strong className="font-medium">Bloodline descends from</strong> on
                          the family tree.
                        </p>
                      )}
                      {/* THE PERIOD, on every row. Two schedules can be measured over two
                          different years, and a table that did not say so would be adding
                          up figures a reader assumes share a window. */}
                      <RowMeta className="gap-x-2">
                        <MetaIf value={formatCurrency(s.annualCents)} prefix="Full year" />
                        <MetaDot />
                        <MetaIf value={formatDate(s.periodStart) ?? undefined} prefix="Year from" />
                        <MetaDot />
                        <MetaIf value={`${s.payingMembers} paying`} />
                        <MetaDot />
                        <MetaIf value={formatCurrency(s.expectedCents)} prefix="Expected" />
                        <MetaDot />
                        <MetaIf value={formatCurrency(s.collectedCents)} prefix="Collected" />
                      </RowMeta>
                      {/* The standings that are worth a word, and only when non-zero: a row
                          of five zeroes on a schedule nobody has declined is noise. */}
                      <p className="mt-1 flex flex-wrap gap-1">
                        {STANDING_ORDER.filter(k => s.counts[k] > 0).map(k => (
                          <span key={k} title={STANDING[k].hint}
                            className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', STANDING[k].className)}>
                            {s.counts[k]} {STANDING[k].label.toLowerCase()}
                          </span>
                        ))}
                      </p>
                    </td>
                    <td className={cn('px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground tabular-nums', COLLAPSING_CELL)}>{s.payingMembers}</td>
                    <td className={cn('px-3 py-2.5 text-right whitespace-nowrap tabular-nums', COLLAPSING_CELL)}>{formatCurrency(s.expectedCents)}</td>
                    <td className={cn('px-3 py-2.5 text-right whitespace-nowrap text-brand-affirm tabular-nums', COLLAPSING_CELL)}>{formatCurrency(s.collectedCents)}</td>
                    <td className={cn('px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground tabular-nums', COLLAPSING_CELL)}>{formatCurrency(s.waivedCents)}</td>
                    <td className={cn('px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums',
                      s.outstandingCents > 0 ? 'text-brand-withheld' : 'text-muted-foreground')}>
                      {formatCurrency(s.outstandingCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── PER MEMBER ────────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-lg">By member</h2>
            <p className="text-xs text-muted-foreground">
              Least settled first. {rows.length} of {projection.members.length} shown.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={onlyOwing}
                onChange={e => setOnlyOwing(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Only those who owe
            </label>
            <div className="relative w-full sm:w-52">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Filter members"
                placeholder="Filter by name…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
        </div>

        {projection.members.length === 0 ? (
          <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
            No approved members with an account, so there is nobody to project dues for.
          </p>
        ) : (
          <div className="overflow-visible rounded-xl border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-semibold">Member</th>
                  <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Standing</th>
                  <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Dues</th>
                  <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Expected</th>
                  <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Paid</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No members match that filter.
                    </td>
                  </tr>
                ) : rows.map(r => {
                  const pill = (
                    <span title={STANDING[r.standing].hint}
                      className={cn('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
                        STANDING[r.standing].className)}>
                      {STANDING[r.standing].label}
                    </span>
                  )
                  return (
                    <tr key={r.personId} className="border-b align-top last:border-0 hover:bg-muted/30 sm:align-middle">
                      <td className="px-3 py-2.5">
                        <span className="font-medium">{r.name}</span>
                        <RowMeta className="gap-x-2">
                          {pill}
                          <MetaIf value={`${r.liableSchedules} ${r.liableSchedules === 1 ? 'due' : 'dues'}`} />
                          <MetaDot />
                          <MetaIf value={formatCurrency(r.expectedCents)} prefix="Expected" />
                          <MetaDot />
                          <MetaIf value={formatCurrency(r.collectedCents)} prefix="Paid" />
                          {r.waivedCents > 0 && (
                            <>
                              <MetaDot />
                              <MetaIf value={formatCurrency(r.waivedCents)} prefix="Waived" />
                            </>
                          )}
                        </RowMeta>
                      </td>
                      <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>{pill}</td>
                      <td className={cn('px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground tabular-nums', COLLAPSING_CELL)}>{r.liableSchedules}</td>
                      <td className={cn('px-3 py-2.5 text-right whitespace-nowrap tabular-nums', COLLAPSING_CELL)}>{formatCurrency(r.expectedCents)}</td>
                      <td className={cn('px-3 py-2.5 text-right whitespace-nowrap text-brand-affirm tabular-nums', COLLAPSING_CELL)}>{formatCurrency(r.collectedCents)}</td>
                      <td className={cn('px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums',
                        r.outstandingCents > 0 ? 'text-brand-withheld' : 'text-muted-foreground')}>
                        {formatCurrency(r.outstandingCents)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * One headline figure.
 *
 * `tabular-nums` so a column of amounts lines up and a figure that changes does not shift
 * its caption. The tone names a brand ROLE and never a hue — affirm for money in, withheld
 * for money still owed — and each is used as a foreground on the card's own ground, which is
 * the one thing `--brand-withheld` may be (it has no `on-` partner, deliberately).
 */
function Figure({ label, value, caption, tone }: {
  label: string
  value: string
  caption: string
  tone?: 'affirm' | 'withheld'
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold leading-none tabular-nums',
        tone === 'affirm' ? 'text-brand-affirm' : tone === 'withheld' ? 'text-brand-withheld' : '')}>
        {value}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{caption}</p>
    </div>
  )
}

/** The one-line key under the page heading. */
export function ProjectionsLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <TrendingUp className="h-3 w-3 text-brand-accent" aria-hidden="true" />
        Each schedule is measured over its own year, so the totals are the sum of them
      </span>
      <span>· A waiver settles a due without being income</span>
      <span>· Nobody is chased here — recording a payment is on Transactions</span>
    </p>
  )
}
