'use client'

import { useState } from 'react'
import { CalendarClock, HandHeart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MainRail, type MainRailItem } from '@/components/layout/MainRail'
import { DuesPlanSection } from '@/components/account/DuesPlanSection'
import type { DuesOnlineStatus } from '@/app/actions/pay-dues'
import { DonationsSection } from '@/components/account/DonationsSection'
import {
  MONEY_PANES, MONEY_PANE_LABEL, type MoneyPane,
} from '@/lib/money-panes'
import type { DuesSummary, DonationSummary } from '@/app/actions/dues'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'

import { useMoney } from '@/components/layout/MoneyProvider'
/**
 * WHERE A MEMBER STANDS — what they owe, and what the family is asking them to give to.
 *
 * ── TWO SCREENS UNTIL 2026-08-20 ────────────────────────────────────────────────────
 * `/accounting/dues` and `/accounting/donations` were separate rail items with separate
 * permission keys. They are one page with two panes, and one key — see
 * `20260820000009`, which argues the key merge, and `lib/money-panes.ts`, which is why the
 * rail's vocabulary lives outside this file.
 *
 * The reason is that they are one question in two directions: what the family asks of ME
 * (a schedule, an installment, a due date) and what it invites me to give (a drive, a goal, a
 * bar). A member checking one is checking both, and two rail items sent them back to the rail
 * in between.
 *
 * ── BOTH RAIL ITEMS CARRY AN `href`, AND THE CLICK IS STILL INTERCEPTED ────────────
 * `MainRail` asks for an `href` wherever a pane has a URL, so cmd-click and copy-link work.
 * These two do: `?pane=dues` and `?pane=donations` are real addresses the page resolves. So
 * both items carry one, and the plain left click is intercepted and handled here — which is
 * the point on this page rather than an optimisation. A real navigation refetches the RSC
 * payload and remounts both panes, and `DuesPlanSection` holds a half-filled payment amount,
 * an open dialog and a `useTransition` in flight; the URL stays shareable and the round trip is
 * skipped.
 *
 * ── NEITHER PANE IS GATED HERE, AND THAT IS NOT AN OMISSION ─────────────────────────
 * One key governs the page, so a caller who is on this screen may see both halves by
 * definition. There is nothing to withhold and no `rights` prop to thread — which is what
 * makes this shell twenty lines rather than a hundred. The page above it does the one
 * `requireView`, and every figure either pane draws is the caller's OWN, filtered
 * `.eq('person_id', myPersonId)` in the action before RLS is consulted at all.
 *
 * ── BOTH PANES STAY MOUNTED ─────────────────────────────────────────────────────────
 * `hidden` rather than a conditional render, for the reason `AdminAccountShell` keeps its
 * panels mounted: `DuesPlanSection` holds an in-flight transition, a half-filled payment
 * amount and whichever dialog is open, and switching to Donations and back must not discard
 * any of them. `hidden` also takes the subtree out of the accessibility tree and the tab
 * order, which a `sr-only`-style hide would not.
 */
export function DuesAndDonationsShell({
  initialPane, summary, donations, online,
}: {
  /** Resolved from `?pane=` on the SERVER, so the first paint is already right. */
  initialPane: MoneyPane
  summary: DuesSummary[]
  donations: DonationSummary[]
  /**
   * Whether this member can pay by card, and what they already pay automatically.
   *
   * ALWAYS PRESENT rather than nullable: `getDuesOnlineStatus` answers a shape with
   * `chargesReady: false` and no rows for every failure path, so this pane needs no second
   * branch and a family with no processor simply renders nothing extra.
   */
  online: DuesOnlineStatus
}) {
  const t = useT()
  const intl = useIntlTag()
  const money = useMoney()
  const [pane, setPane] = useState<MoneyPane>(initialPane)

  const items: MainRailItem<MoneyPane>[] = MONEY_PANES.map(id => ({
    id,
    label: MONEY_PANE_LABEL[id],
    // `HandHeart` and not `HeartHandshake`, so the rail item, the card below it and
    // [Summary](/accounting/summary)'s version of the same card are one glyph rather than
    // three. Two icons for one concept is the drift the colour tokens exist to prevent,
    // arriving through iconography.
    icon: id === 'dues' ? CalendarClock : HandHeart,
    href: `/accounting/dues-and-donations?pane=${id}`,
  }))

  function select(id: MoneyPane) {
    setPane(id)
    // `replaceState` rather than a router push, for the reason in the header: a real
    // navigation remounts both panes. The address stays correct and shareable either way.
    const url = `/accounting/dues-and-donations${id === 'dues' ? '' : `?pane=${id}`}`
    window.history.replaceState(null, '', url)
  }

  return (
    <div className="space-y-6">
      <MainRail label={t('drives.rail')} items={items} active={pane} onSelect={select} />

      <div hidden={pane !== 'dues'}>
        {/* `online` goes INTO the pane rather than beside it, since 2026-08-25. It was a
            `PayOnlineSection` under the table — a second rendering of the same list of dues,
            with each schedule's name and balance repeated under the table that had just
            stated them. Paying is a thing you do to a ROW, so the controls live on the row
            and the one figure that belongs to neither table (what both come to together)
            sits under both. See DuesPlanSection's header. */}
        <DuesPlanSection summary={summary} online={online} />
      </div>

      <div hidden={pane !== 'donations'}>
        {/* ── THE SAME CARD [Summary](/accounting/summary) DRAWS — 2026-09-03 ────────────
            Asked for as: this card too needs to be updated like on Summary. The list was
            bare here while the DUES pane beside it leads with two `rounded-2xl border
            bg-card` panels, so switching rail items changed what kind of thing the screen
            was made of — and Summary had already been given the card treatment on
            2026-09-02 for exactly that reason one page over.

            SUMMARY'S OWN NOTE ARGUED AGAINST DOING THIS, and it was describing a layout
            that is not this one: *"a card would be a box in a box"*. There is no outer box
            — the pane is a bare `<div>` under `MainRail` — so the only box is this one. That
            note is corrected there rather than left to be read as a rule.

            `HandHeart`, matching Summary, and it REPLACED `HeartHandshake` in the empty
            state below rather than sitting beside it: two glyphs for one section is the
            drift the colour tokens exist to prevent, in iconography.

            NO "All drives" LINK IN THE HEADER, which Summary's version carries. That link
            points AT this pane; a control that navigates to the screen you are already on
            is furniture. */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HandHeart className="h-4 w-4 text-primary" />
              {t('acct.openDonationDrives')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* DonationsSection renders null on an empty list — right when it was a pane
                behind a rail item the page could withhold, and not enough here: a blank pane
                under a rail reads as something that failed to load. The empty case is
                answered in place, the way the `/accounting/donations` page it replaces did —
                and INSIDE the card now, so a family with no open drive gets a titled panel
                saying so rather than an unframed icon under a rail. */}
            {donations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <HandHeart className="h-10 w-10 text-muted-foreground/20" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  {t('drives.none')}
                </p>
              </div>
            ) : (
              <>
                <DonationsSection donations={donations} chargesReady={online.chargesReady} intl={intl} money={money} t={t} />
                {/* Said ONCE under the list, not as a greyed-out Give on every drive. It is
                    the same judgement the dues pane makes about its own totals card: a
                    promise about a capability is a property of the SCREEN, and repeating it
                    per row makes the widest control on a phone one that does nothing when
                    tapped. */}
                {!online.chargesReady && (
                  <p className="text-xs text-muted-foreground">{t('ui.familyNotConnectedCard')}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
