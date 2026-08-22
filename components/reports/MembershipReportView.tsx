import { Users, MapPinned, Building2, MailCheck, Baby } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DonutChart, type DonutPalette } from '@/components/reports/DonutChart'
import { MembershipBreakdownLegend } from '@/components/reports/MembershipBreakdownLegend'
import { foldForChart, type CountSlice, type MembershipReport } from '@/lib/membership-report'
import type { MembershipBreakdown, MembershipRepairRights } from '@/lib/membership-drill'

/**
 * The Membership Report — every figure the family has about who it is made up of.
 *
 * A SERVER COMPONENT WITH NO STATE, so there is no `'use client'` here and nothing to key
 * on `familyCode`: switching family remounts `<main>` and this re-renders from the new
 * payload, with nothing of the old family's held in a `useState` (AGENTS.md, "Switching
 * family remounts the page").
 *
 * THE LEGENDS ARE CLIENT COMPONENTS AND THE RINGS ARE NOT, since 2026-08-22. Every legend row
 * opens the slice under it and offers the one repair that slice is pointing at; the ring stays
 * a server-rendered figure with no JavaScript at all. `MembershipBreakdownLegend`'s header
 * argues why the rows and not the arcs. Nothing about this component's own contract changes:
 * `rights` are resolved by the PAGE and passed through, and no roster reaches the browser
 * until somebody presses a row.
 *
 * ── FOUR BREAKDOWNS, AND EACH CARD SAYS WHAT ITS FIGURE IS FOR ──────────────────────
 * A count with no consequence attached is a number somebody looks at once. Each lede here
 * names the decision the figure feeds — which is also the honest test of whether the
 * breakdown earns a place on the screen at all.
 */

/** One breakdown: a ring, a legend that is also the table and the way in, and a lede. */
function BreakdownCard({
  title, lede, icon: Icon, slices, palette, unit, keep, breakdown, rights,
}: {
  title: string
  lede: string
  icon: React.ComponentType<{ className?: string }>
  slices: CountSlice[]
  palette: DonutPalette
  unit: string
  /** Segments the ring draws before folding the tail. See `foldForChart`. */
  keep: number
  /** Which of the four charts this is — decides which repair a slice offers. */
  breakdown: MembershipBreakdown
  rights: MembershipRepairRights
}) {
  const drawn = foldForChart(slices, keep)
  const total = slices.reduce((sum, s) => sum + s.count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-brand-accent" /> {title}
        </CardTitle>
        <CardDescription>{lede}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* The ring sits beside the figures on a wide screen and above them on a phone —
            the same reason a table folds rather than scrolling sideways: the numbers are
            what the reader came for, and they must never be off the edge. */}
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <DonutChart
            slices={drawn} palette={palette} label={title}
            centerValue={total} centerLabel={unit}
          />
          <div className="w-full min-w-0">
            <MembershipBreakdownLegend
              slices={slices} palette={palette} drawn={drawn} unit={unit}
              breakdown={breakdown} title={title} rights={rights}
            />
            {/* THE ROWS ARE BUTTONS AND HAVE TO SAY SO. A table row that behaves like one is
                not discoverable: the chevron only appears on hover, which is nothing at all on
                a phone. One line under the table, once per card, rather than a control per
                row. */}
            <p className="mt-2 text-xs text-muted-foreground">
              Press a row to see who is in it.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function MembershipReportView({ report, rights }: {
  report: MembershipReport
  /**
   * What the reader may CHANGE from a drill-down, resolved by the page.
   *
   * It reaches the browser as two booleans and nothing else — no grid, no scopes. They
   * decide which control the dialog draws and never whether the write is allowed: all three
   * actions resolve their own grant, because a `'use server'` export has a URL whether or not
   * a button exists (AGENTS.md §2).
   */
  rights: MembershipRepairRights
}) {
  const { total, regionCount, chapterCount } = report
  const reachable = report.byInvitation.find(s => s.key === 'active')?.count ?? 0
  const unasked = report.byInvitation.find(s => s.key === 'pending-invite')?.count ?? 0

  return (
    <div className="space-y-6">
      {/* ── NATIONALLY ────────────────────────────────────────────────────────────────
          The hero figure, which is what "nationally" means in this product: National is
          the whole family, and every share below is a share of this one number. A stat
          tile rather than a chart, because one number is not a part-to-whole. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-brand-accent" /> Nationally
          </CardTitle>
          <CardDescription>
            Every approved member of the family, wherever they sit. Applicants still waiting
            in the approvals queue are not counted, and neither are relatives recorded as
            having died.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <p className="font-display text-5xl font-semibold leading-none text-brand-ink">{total}</p>
              <p className="mt-1.5 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                {total === 1 ? 'member' : 'members'}
              </p>
            </div>
            <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Regions</dt>
                <dd className="text-lg font-semibold tabular-nums">{regionCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Chapters</dt>
                <dd className="text-lg font-semibold tabular-nums">{chapterCount}</dd>
              </div>
              <div>
                {/* THE ONE FIGURE ON THIS SCREEN THAT IS A REACH RATHER THAN A COUNT, and
                    it is the one a treasurer acts on: dues are owed by every approved
                    person, and only these can be sent a link and sign in to pay it. */}
                <dt className="text-muted-foreground">Can sign in</dt>
                <dd className="text-lg font-semibold tabular-nums">{reachable}</dd>
              </div>
              {unasked > 0 && (
                <div>
                  <dt className="text-muted-foreground">Never invited</dt>
                  <dd className="text-lg font-semibold tabular-nums text-brand-withheld">{unasked}</dd>
                </div>
              )}
            </dl>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <BreakdownCard
          title="By region" icon={MapPinned}
          lede="Where the family is, one rung above its chapters. A member in no chapter — or in a chapter that sits under no region — is under National, which is the absence of a region rather than a place of its own."
          slices={report.byRegion} palette="sequential" unit="members" keep={5}
          breakdown="region" rights={rights}
        />
        <BreakdownCard
          title="By chapter" icon={Building2}
          lede="Every chapter the family has set up, including any nobody has joined yet. A chapter standing at zero is the one to look at first."
          slices={report.byChapter} palette="sequential" unit="members" keep={5}
          breakdown="chapter" rights={rights}
        />
        <BreakdownCard
          title="Invitations" icon={MailCheck}
          lede="Active means the person has an account and can sign in. Invited means an invitation is open and unanswered. Pending invite means nobody has asked them yet — they are on the roster and owe dues like everybody else."
          slices={report.byInvitation} palette="categorical" unit="members" keep={2}
          breakdown="invitation" rights={rights}
        />
        <BreakdownCard
          title="Adults and minors" icon={Baby}
          lede="Worked out from each member’s date of birth every time this page loads, never stored. A birthday nobody has recorded is counted as neither rather than guessed — dues schedules with a starting age bill from the recorded date, so an empty birthday is money nobody is asking for."
          slices={report.byAge} palette="categorical" unit="members" keep={2}
          breakdown="age" rights={rights}
        />
      </div>
    </div>
  )
}
