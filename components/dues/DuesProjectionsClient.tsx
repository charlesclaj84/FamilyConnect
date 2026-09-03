'use client'

import { useMemo, useState } from 'react'
import { Search, TrendingUp, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'
import { disambiguatedName } from '@/lib/name-utils'
import { matchesPersonQuery } from '@/lib/person-search'
import { COLLAPSING_CELL, RowMeta, MetaDot, MetaIf } from '@/components/ui/table-collapse'
import { SortTh, useTableSort } from '@/components/ui/sortable-header'
import { HelpLink } from '@/components/help/HelpLink'
import { collectedPercent, type DuesStanding, type MemberStatus } from '@/lib/dues-projection'
import type { DuesProjectionResult, ProjectionPerson } from '@/app/actions/dues'
import { useIntlTag } from '@/components/layout/LocaleProvider'
import { useMoney } from '@/components/layout/MoneyProvider'
import { useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

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
 * ── EVERY APPROVED PERSON IS IN IT, AND THE ROW SAYS WHETHER YOU CAN ASK THEM ───────
 * The roster stopped being accounts-only on 2026-08-18 — a projection is what the family is
 * OWED, and a grandmother recorded on the tree who never finished registering owes her dues
 * just as much as her son does. `lib/dues-projection.ts`'s header argues that out.
 *
 * It puts something on screen that was not there before: money owed by people the family has
 * no way to invoice. So the **Status** column carries Active / Invited / Pending Invite, the
 * caption under the figures says how many of each there are, and **Still to collect** says how
 * much of itself belongs to somebody with no account. Without those three the screen would
 * report a bigger number with no explanation of why it cannot be chased, which is a different
 * kind of dishonesty from the one the roster change fixed.
 *
 * NONE OF THE THREE IS A COLOUR THIS SCREEN ALREADY USES FOR MONEY. `--brand-withheld` is
 * spoken for here — it is what an outstanding figure is printed in — so borrowing it for a
 * membership state would make one colour mean two things in adjacent cells of the same row.
 * Status is Heritage soft, Warmth, and muted; not `--destructive`, because nobody has failed
 * at anything by not having been invited yet.
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
function standing(t: T): Record<DuesStanding, { label: string; className: string; hint: string }> {
  return {
    unpaid:   { label: t('dues.nothingPaid'), className: 'bg-brand-withheld/10 text-brand-withheld', hint: 'Owes the whole amount for this period.' },
    partial:  { label: t('dues.partPaid'),    className: 'bg-brand-warm text-brand-on-warm',         hint: 'Something in, not all of it.' },
    settled:  { label: 'Settled',      className: 'bg-brand-affirm text-brand-on-affirm',     hint: 'Paid in full, or forgiven.' },
    declined: { label: 'Declined',     className: 'bg-muted text-muted-foreground',           hint: 'Opted out of an optional due.' },
    // Muted rather than affirm, and the distinction is load-bearing: a child below the age a
    // due starts at has not paid anything, and colouring them green would read as settled.
    exempt:   { label: t('dues.notYetDue'),  className: 'bg-muted text-muted-foreground',           hint: 'Below the age this due starts at.' },
    // "Not theirs" rather than "not blood". The screen has to account for the money, and it
    // can do that without labelling a relative by how they joined the family — the same call
    // AGENTS.md records for the tree's cards, where the step and adopted pills came off
    // because a word about somebody's route into the family, printed beside their name, reads
    // as a correction attached to a person. The hint says which due it is about; the pill
    // does not say anything about them.
    excluded: { label: t('dues.notTheirs'),   className: 'bg-muted text-muted-foreground',           hint: 'This due is owed by the bloodline only.' },
    // "Elsewhere", and deliberately NOT folded into 'Not theirs'. Both mean the member owes
    // nothing, and one of them is reversible: they move chapter, or their chapter moves
    // region, and the due becomes theirs. Wording it as geography also keeps the pill silent
    // about how anybody joined the family, which is the same call 'Not theirs' makes.
    'out-of-scope': { label: 'Elsewhere', className: 'bg-muted text-muted-foreground',        hint: 'This due is for one region or chapter, and they are in another — or in none, which puts them under National.' },
  }
}

/** Least settled first, so the people to chase are at the top before anybody sorts. */
const STANDING_ORDER: readonly DuesStanding[] = [
  'unpaid', 'partial', 'settled', 'declined', 'exempt', 'excluded', 'out-of-scope',
]

/**
 * Whether the family can ask this person for the money. A SECOND AXIS, not a standing.
 *
 * Two columns rather than one because they are two questions, and folding them would answer
 * the wrong one: "Pending Invite" is not a reason somebody owes nothing, and a single pill
 * would have to choose which of the two facts to hide. The words are the ones the requirement
 * asked for, verbatim, so the help chapter and the screen use one vocabulary.
 */
function memberStatus(t: T): Record<MemberStatus, { label: string; hint: string; className: string }> {
  return {
    // Heritage soft — a resting pill for the ordinary state. It is deliberately not affirm:
    // affirm on this screen means money in, and having an account is not a payment.
    active: {
      label: 'Active',
      hint: 'They have an account and can see this due on their own Dues screen.',
      className: 'bg-brand-soft text-brand-on-soft',
    },
    // The one filled Warmth chip in this column: something is in progress and the ball is with
    // them, which is neither the resting state nor nothing having happened.
    invited: {
      label: 'Invited',
      hint: 'No account yet, and an invitation is open. They have been asked.',
      className: 'bg-brand-warm text-brand-on-warm',
    },
    // Muted, because nothing has happened yet — which is the honest reading. NOT
    // `--brand-withheld`: on this screen that token is what an outstanding figure is printed in,
    // and a second meaning for it two cells away would make the colour say nothing at all.
    'pending-invite': {
      label: t('dues.pendingInvite'),
      hint: 'Recorded in the family and not yet asked to join, so there is nobody to invoice.',
      className: 'bg-muted text-muted-foreground',
    },
  }
}

/** Reachable first, so the caption reads from "we can ask them" down to "we cannot". */
const MEMBER_STATUS_ORDER: readonly MemberStatus[] = ['active', 'invited', 'pending-invite']

/**
 * "Texas region" / "Houston chapter", or null for a national due.
 *
 * The name comes from `placeNames`, and a MISSING one falls back to the bare word rather
 * than to the uuid: an id renders to a reader as a fault, and the row's `scope` is enough to
 * say what kind of place it is even when the name did not come back.
 */
function scopeCaption(
  s: { scope: string; regionId: string | null; chapterId: string | null },
  placeNames: Record<string, string>,
): string | null {
  if (s.scope === 'regional') {
    const name = s.regionId ? placeNames[s.regionId] : undefined
    return name ? `${name} region` : 'One region'
  }
  if (s.scope === 'chapter') {
    const name = s.chapterId ? placeNames[s.chapterId] : undefined
    return name ? `${name} chapter` : 'One chapter'
  }
  return null
}

export function DuesProjectionsClient({ result }: { result: DuesProjectionResult }) {
  const t = useT()
  const intl = useIntlTag()
  const money = useMoney()
  const { projection, people, placeNames } = result
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

  // ── SORTING, AND THE MEMBER TABLE IS THE ONE CASE IN THE PASS WITH A COMPOSITE DEFAULT ──
  // `rows` above is already sorted three deep — standing, then outstanding descending, then
  // name — and that order is this screen's whole editorial line: the lede under the table says
  // "Least settled first". A single-key hook cannot express three keys, so it does not have to:
  // `sortRows` is STABLE, so sorting the already-composite-sorted array by standing alone
  // leaves the two secondary keys exactly where they were inside each standing group. The
  // default therefore reproduces the old order to the row, and the machinery is honest about
  // what it is doing rather than smuggling a second comparator in.
  //
  // STANDING SORTS ON A RANK, WHICH CONTRADICTS THE RULE THIS PASS TOOK EVERYWHERE ELSE —
  // deliberately, and the distinction is where the rank came from. On the staff console and
  // the board-position list an ordering of the enum would have had to be INVENTED, so those
  // sort on the printed label. `STANDING_ORDER` is not invented here: it is a constant this
  // screen already shipped, already sorts by, and already draws its pills in. Sorting on the
  // label instead would make the default order unreachable from the heading that sets it.
  //
  // THE SCHEDULE TABLE DEFAULTS TO `schedule`, which is `getDuesSchedules`' `.order('label')`.
  //
  // EVERY FIGURE ON BOTH TABLES SORTS ON CENTS. Ten currency columns between them, and
  // `formatCurrency` is applied only in the cell.
  const scheduleSort = useTableSort(projection.schedules, {
    schedule: s => s.label,
    paying: s => s.payingMembers,
    expected: s => s.expectedCents,
    collected: s => s.collectedCents,
    waived: s => s.waivedCents,
    outstanding: s => s.outstandingCents,
  }, 'schedule')

  const memberSort = useTableSort(rows, {
    standing: r => STANDING_ORDER.indexOf(r.standing),
    member: r => r.name,
    status: r => memberStatus(t)[r.status].label,
    dues: r => r.liableSchedules,
    expected: r => r.expectedCents,
    paid: r => r.collectedCents,
    outstanding: r => r.outstandingCents,
  }, 'standing')

  const percent = collectedPercent(projection)
  const owing = projection.members.filter(m => m.outstandingCents > 0).length

  // "12 Active · 1 Invited · 3 Pending Invite", and only the states that are actually there.
  // Built from `statusCounts`, which `projectDues` derives from the same call the pills render
  // from — so the sentence and the column cannot disagree. A state with nobody in it is left
  // out for the reason the standing pills are: a row of zeroes is noise, and "0 Invited" reads
  // as a broken figure rather than as an absence.
  const statusSummary = MEMBER_STATUS_ORDER
    .filter(k => projection.statusCounts[k] > 0)
    .map(k => `${projection.statusCounts[k]} ${memberStatus(t)[k].label}`)
    .join(' · ')
  const unreachable = projection.statusCounts.invited + projection.statusCounts['pending-invite']

  return (
    <div className="space-y-6">
      {/* ── THE HEADLINE FIGURES ────────────────────────────────────────────────────
          Four, plus Pending when there is any. Expected leads, because every other
          figure on the screen is a fraction of it. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Figure
          label={t('proj.expectedThisYear')}
          value={money(projection.expectedCents)}
          caption={t(projection.payingMembers === 1
            ? 'proj.oweSomethingOne'
            : 'proj.oweSomethingMany', {
            paying: String(projection.payingMembers),
            total: String(projection.membersCounted),
          })}
        />
        <Figure
          label={t('proj.collected')}
          value={money(projection.collectedCents)}
          caption={projection.expectedCents > 0
            ? t('proj.percentOfBilled', { percent: String(percent) })
            : t('proj.nothingBilledYet')}
          tone="affirm"
        />
        <Figure
          label={t('proj.waived')}
          value={money(projection.waivedCents)}
          caption={t('proj.waivedCaption')}
        />
        <Figure
          label={t('proj.stillToCollect')}
          value={money(projection.outstandingCents)}
          caption={owing === 0
            ? t('proj.everybodyUpToDate')
            : t(owing === 1 ? 'proj.outstandingOne' : 'proj.outstandingMany',
                { n: String(owing) })}
          tone="withheld"
        />
      </div>

      {/* Only when there is any. See the header: nothing writes this state today, and a
          standing $0.00 would be a figure nobody can account for. */}
      {projection.pendingCents > 0 && (
        <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t('proj.pendingSettlement', {
            amount: money(projection.pendingCents),
          })}
        </p>
      )}

      {/* HOW MUCH OF "STILL TO COLLECT" NOBODY CAN BE INVOICED FOR. Without this the figure
          above reads as a list of people to chase, and part of it belongs to relatives who
          cannot see a due, let alone pay one — which is the one thing counting them introduced.
          It is a SUBSET and says so: the family is owed it either way, which is why they are
          counted at all.

          `--brand-withheld`, the same role the tile above prints its total in, so a reader
          connects the two figures rather than reading this as a separate number. Not
          `--destructive`: nothing has failed, and nothing was deleted. */}
      {projection.unregisteredOutstandingCents > 0 && (
        <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-brand-withheld">{money(projection.unregisteredOutstandingCents)}</span>
          {' '}of what is still to collect is owed
          by {unreachable === 1 ? 'one member' : `${unreachable} members`} with no
          account — {projection.statusCounts.invited} invited
          and {projection.statusCounts['pending-invite']} not yet asked to join. It is part of the
          total above, not a deduction from it: the family is owed the money whether or not there
          is an inbox to send the invoice to.
        </p>
      )}

      {/* WHO IS IN THESE FIGURES. This used to reconcile a smaller count against the Member
          Directory's; it now states that the two ARE the same list, which is the property the
          roster change bought. What replaces the reconciliation is the split a treasurer cannot
          get anywhere else — how many of the people who owe money can actually be invoiced. */}
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Counted over {projection.membersCounted} approved {projection.membersCounted === 1 ? 'member' : 'members'} —
          the same list the Member Directory shows, whether or not they have finished
          registering.
          {statusSummary && <> {statusSummary}.</>}
          {' '}A due is owed either way; the <strong className="font-medium">Status</strong> column
          says whether there is anybody to send an invoice to.
          {' '}Anybody with no date of birth recorded owes a due in full, because an age is
          never guessed at.
        </span>
      </p>

      {/* ── PER SCHEDULE ──────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg">{t('dues.schedule')}</h2>
        {projection.schedules.length === 0 ? (
          <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">{t('dues.noDuesSchedulesActive')}</p>
        ) : (
          <div className="overflow-visible rounded-xl border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <SortTh label={t('col.schedule')} {...scheduleSort.sortProps('schedule')} className="px-3 py-2 font-semibold" />
                  <SortTh label={t('proj.colPaying')} align="end" {...scheduleSort.sortProps('paying')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                  <SortTh label={t('proj.colExpected')} align="end" {...scheduleSort.sortProps('expected')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                  <SortTh label={t('proj.collected')} align="end" {...scheduleSort.sortProps('collected')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                  <SortTh label={t('proj.waived')} align="end" {...scheduleSort.sortProps('waived')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                  <SortTh label={t('proj.colOutstanding')} align="end" {...scheduleSort.sortProps('outstanding')} className="px-3 py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {scheduleSort.rows.map(s => (
                  <tr key={s.scheduleId} className="border-b align-top last:border-0 sm:align-middle">
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{s.label}</span>
                      <span className={cn(
                        'ms-2 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
                        s.required ? 'bg-brand-soft text-brand-on-soft' : 'bg-brand-warm text-brand-on-warm',
                      )}>
                        {s.required ? 'Required' : 'Optional'}
                      </span>
                      {/* ── WHICH SIDE OF THE BLOODLINE, SINCE 2026-09-03 ────────────
                          It was one badge for `bloodlineOnly` and nothing otherwise, which
                          cannot tell the third scope from the default. `'all'` stays silent:
                          "owed by everybody" is what a row with no badge means, and a badge
                          on every row is a badge on none. */}
                      {s.bloodlineScope === 'bloodline' && (
                        <span className="ms-1.5 inline-block whitespace-nowrap rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-on-soft"
                          title={t('dues.onlyMembersDescendedFrom')}>{t('inc.scopeBloodline')}</span>
                      )}
                      {s.bloodlineScope === 'non-bloodline' && (
                        <span className="ms-1.5 inline-block whitespace-nowrap rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-on-soft"
                          title={t('dues.onlyMembersWhoMarriedIn')}>{t('inc.scopeNonBloodline')}</span>
                      )}
                      {/* WHICH PART OF THE FAMILY OWES IT. On the row and not only in the
                          totals, because a scoped due's Expected figure is a fraction of a
                          national one's for a reason that is nowhere in the numbers. Only
                          rendered when there IS a scope: "National" on every row of a family
                          that has no chapters would be noise on every row. */}
                      {scopeCaption(s, placeNames) && (
                        <span className="ms-1.5 inline-block whitespace-nowrap rounded-full bg-brand-warm px-2 py-0.5 text-[11px] font-medium text-brand-on-warm"
                          title={t('dues.onlyMembersPartFamily')}>
                          {scopeCaption(s, placeNames)}
                        </span>
                      )}
                      {/* THE ONE STATE ON THIS SCREEN A TREASURER CANNOT DIAGNOSE FROM THE
                          NUMBERS. Bloodline-only and nobody is marked as being in it, so
                          Expected reads $0.00 and there is nothing in the figures to say
                          why. `--brand-withheld` and not `--destructive`: nothing has
                          failed and nothing was deleted — a capability is being withheld,
                          which is exactly what that role is for.

                          IT ASKED A DIFFERENT QUESTION UNTIL `20260902000000` — "the family
                          has not said which ancestor its line descends from" — because the
                          bloodline was derived from an anchor. There is no anchor now; the
                          state it warned about is a family that has not marked anybody, and
                          the sentence names the control that fixes it either way. */}
                      {s.bloodlineEmpty && (
                        <p className="mt-1 text-xs text-brand-withheld">
                          {t('proj.bloodlineEmptyNote', {
                            control: t('tree.inBloodline'),
                          })}
                        </p>
                      )}
                      {/* THE OTHER STATE A TREASURER CANNOT DIAGNOSE FROM THE NUMBERS, and
                          the commoner of the two: a due scoped to a chapter nobody has
                          joined yet bills nothing, so Expected reads $0.00 with no
                          explanation in the figures. `--brand-withheld` for the same reason
                          as above — nothing has failed and nothing was deleted. */}
                      {s.scopeEmpty && (
                        <p className="mt-1 text-xs text-brand-withheld">
                          {t('proj.scopeEmptyNote', {
                            where: scopeCaption(s, placeNames)
                              ?? t('proj.thatPartOfTheFamily'),
                          })}
                        </p>
                      )}
                      {/* THE PERIOD, on every row. Two schedules can be measured over two
                          different years, and a table that did not say so would be adding
                          up figures a reader assumes share a window. */}
                      <RowMeta className="gap-x-2">
                        <MetaIf value={money(s.annualCents)}
                          prefix={t('proj.fullYear')} />
                        <MetaDot />
                        <MetaIf value={formatDate(s.periodStart, intl) ?? undefined}
                          prefix={t('proj.yearFromPrefix')} />
                        <MetaDot />
                        <MetaIf value={t('proj.payingCount', {
                          n: String(s.payingMembers),
                        })} />
                        <MetaDot />
                        <MetaIf value={money(s.expectedCents)} prefix="Expected" />
                        <MetaDot />
                        <MetaIf value={money(s.collectedCents)} prefix="Collected" />
                      </RowMeta>
                      {/* The standings that are worth a word, and only when non-zero: a row
                          of five zeroes on a schedule nobody has declined is noise. */}
                      <p className="mt-1 flex flex-wrap gap-1">
                        {STANDING_ORDER.filter(k => s.counts[k] > 0).map(k => (
                          <span key={k} title={standing(t)[k].hint}
                            className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', standing(t)[k].className)}>
                            {s.counts[k]} {standing(t)[k].label.toLowerCase()}
                          </span>
                        ))}
                      </p>
                    </td>
                    <td className={cn('px-3 py-2.5 text-end whitespace-nowrap text-muted-foreground tabular-nums', COLLAPSING_CELL)}>{s.payingMembers}</td>
                    <td className={cn('px-3 py-2.5 text-end whitespace-nowrap tabular-nums', COLLAPSING_CELL)}>{money(s.expectedCents)}</td>
                    <td className={cn('px-3 py-2.5 text-end whitespace-nowrap text-brand-affirm tabular-nums', COLLAPSING_CELL)}>{money(s.collectedCents)}</td>
                    <td className={cn('px-3 py-2.5 text-end whitespace-nowrap text-muted-foreground tabular-nums', COLLAPSING_CELL)}>{money(s.waivedCents)}</td>
                    <td className={cn('px-3 py-2.5 text-end font-semibold whitespace-nowrap tabular-nums',
                      s.outstandingCents > 0 ? 'text-brand-withheld' : 'text-muted-foreground')}>
                      {money(s.outstandingCents)}
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
            <h2 className="flex items-center gap-1 text-lg">
              {t('dues.member')}
              {/* WHO IS IN THIS TABLE IS THE FIRST THING A TREASURER DOUBTS, and it is not
                  answerable from the table itself: it lists every approved person in the
                  family, so a grandmother recorded on the tree is in it and owes her dues —
                  the Status column is what says nobody can invoice her yet. Five separate
                  reductions — an age-limited due, the bloodline, the region or chapter a due
                  is for, a declined optional due, a waiver — are all honoured silently in the
                  figures, and a missing date of birth makes an age-limited due bill in full,
                  which is the commonest reason a row looks too high.
                  `dues-projections#who-is-counted` is that whole list.

                  An icon on the heading, not the inline variant: the row already carries a
                  filter box and a checkbox, and words here would compete with the controls
                  somebody came to use. */}
              <HelpLink
                slug="dues-projections"
                section="who-is-counted"
                label={t('proj.helpWhoCounted')}
                className="size-6"
              />
            </h2>
            <p className="text-xs text-muted-foreground">
              {t('proj.leastSettledFirst', {
                shown: String(rows.length),
                total: String(projection.members.length),
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={onlyOwing}
                onChange={e => setOnlyOwing(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />{t('dues.onlyThoseWhoOwe')}</label>
            <div className="relative w-full sm:w-52">
              <Search className="absolute start-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label={t('dues.filterMembers')}
                placeholder={t('dues.filterName')}
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="h-8 ps-7 text-xs"
              />
            </div>
          </div>
        </div>

        {projection.members.length === 0 ? (
          <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">{t('dues.nobodyFamilyBeenApproved')}</p>
        ) : (
          <div className="overflow-visible rounded-xl border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <SortTh label={t('col.member')} {...memberSort.sortProps('member')} className="px-3 py-2 font-semibold" />
                  <SortTh label={t('proj.colStanding')} {...memberSort.sortProps('standing')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                  {/* THE SECOND AXIS. It folds like Standing does and is restated in the same
                      meta line, so a phone loses neither — see the header for why they are two
                      columns rather than one pill. */}
                  <SortTh label={t('col.status')} {...memberSort.sortProps('status')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                  <SortTh label={t('proj.colDues')} align="end" {...memberSort.sortProps('dues')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                  <SortTh label={t('proj.colExpected')} align="end" {...memberSort.sortProps('expected')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                  <SortTh label={t('proj.colPaid')} align="end" {...memberSort.sortProps('paid')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
                  <SortTh label={t('proj.colOutstanding')} align="end" {...memberSort.sortProps('outstanding')} className="px-3 py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-xs text-muted-foreground">{t('dues.noMembersMatchFilter')}</td>
                  </tr>
                ) : memberSort.rows.map(r => {
                  const pill = (
                    <span title={standing(t)[r.standing].hint}
                      className={cn('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
                        standing(t)[r.standing].className)}>
                      {standing(t)[r.standing].label}
                    </span>
                  )
                  // ONE ELEMENT, RENDERED TWICE — the folded column and the meta line — which is
                  // what AGENTS.md asks for when a column folds by moving its content: two copies
                  // of a rendering drift, and a variable cannot.
                  const statusPill = (
                    <span title={memberStatus(t)[r.status].hint}
                      className={cn('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
                        memberStatus(t)[r.status].className)}>
                      {memberStatus(t)[r.status].label}
                    </span>
                  )
                  return (
                    <tr key={r.personId} className="border-b align-top last:border-0 hover:bg-muted/30 sm:align-middle">
                      <td className="px-3 py-2.5">
                        <span className="font-medium">{r.name}</span>
                        <RowMeta className="gap-x-2">
                          {pill}
                          {statusPill}
                          <MetaIf value={`${r.liableSchedules} ${r.liableSchedules === 1 ? 'due' : 'dues'}`} />
                          <MetaDot />
                          <MetaIf value={money(r.expectedCents)} prefix="Expected" />
                          <MetaDot />
                          <MetaIf value={money(r.collectedCents)} prefix="Paid" />
                          {r.waivedCents > 0 && (
                            <>
                              <MetaDot />
                              <MetaIf value={money(r.waivedCents)} prefix="Waived" />
                            </>
                          )}
                        </RowMeta>
                      </td>
                      <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>{pill}</td>
                      <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>{statusPill}</td>
                      <td className={cn('px-3 py-2.5 text-end whitespace-nowrap text-muted-foreground tabular-nums', COLLAPSING_CELL)}>{r.liableSchedules}</td>
                      <td className={cn('px-3 py-2.5 text-end whitespace-nowrap tabular-nums', COLLAPSING_CELL)}>{money(r.expectedCents)}</td>
                      <td className={cn('px-3 py-2.5 text-end whitespace-nowrap text-brand-affirm tabular-nums', COLLAPSING_CELL)}>{money(r.collectedCents)}</td>
                      <td className={cn('px-3 py-2.5 text-end font-semibold whitespace-nowrap tabular-nums',
                        r.outstandingCents > 0 ? 'text-brand-withheld' : 'text-muted-foreground')}>
                        {money(r.outstandingCents)}
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
  const t = useT()
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <TrendingUp className="h-3 w-3 text-brand-accent" aria-hidden="true" />{t('dues.eachScheduleMeasuredOver')}</span>
      <span>· A waiver settles a due without being income</span>
      {/* WHO IS COUNTED, in the one line under the heading, because it is the fact about this
          screen most likely to surprise somebody who last read it when the roster was
          accounts-only. */}
      <span>· Everybody in the family is counted, whether or not they have an account yet</span>
      <span>· Nobody is chased here — recording a payment is on Transactions</span>
    </p>
  )
}
