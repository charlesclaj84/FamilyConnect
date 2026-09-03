import Link from 'next/link'
import { redirect } from 'next/navigation'
import { can, requireView } from '@/lib/auth/permissions'
import { getMyDuesSummary, getMyPaymentHistory, getDonationProgress } from '@/app/actions/dues'
import { getFunds } from '@/app/actions/funds'
import { getDuesOnlineStatus } from '@/app/actions/pay-dues'
import { HandHeart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { DonationsSection } from '@/components/account/DonationsSection'
import { FundsSection } from '@/components/account/FundsSection'
import { NextInstallmentsCard } from '@/components/account/NextInstallmentsCard'
import { PaidThisYearCard } from '@/components/account/PaidThisYearCard'
import { DuesBalanceKpi } from '@/components/dues/DuesBalanceKpi'
import { PageShell } from '@/components/layout/PageShell'
import { cn } from '@/lib/utils'
import { callerI18n } from '@/lib/i18n/server'
import { moneyFor } from '@/lib/currency-utils'
import { getMyFamilyCurrency } from '@/lib/auth/currency'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

// "Summary", not "My Summary" — see the note on the FEATURES entry in lib/features.ts.
// The route and the resource key both stay `account-summary`.
export async function generateMetadata() {
  return docTitle('page./accounting/summary.title')
}

/**
 * Where this member stands, and where the family's money is.
 *
 * WHAT CHANGED, 20260815000000. This page used to BE Dues, Donations and Payment
 * History — three panes behind a `MainRail`, with `?pane=` written by replaceState. They
 * are three screens on the main rail now, each with its own route and its own permission
 * key, and this page is what its name always claimed: a digest that says what is
 * outstanding, what has been paid, which drives are open and what the family holds,
 * with a way through to each.
 *
 * FIVE SECTIONS, FOUR GRANTS, AND EVERY FETCH GATED. Each section is a summary OF a
 * screen and rides on that screen's grant, so a member who cannot open Donations gets no
 * donation figure here either. Skipping the call is the point rather than not rendering
 * the result: props are serialized into the RSC payload and reach the browser whether a
 * component reads them or not (AGENTS.md §5).
 *
 *   dues                     the balance card and what is due next        -> /dues
 *   payment-history          what has been paid this year, by schedule    -> /payment-history
 *   donations                the OPEN drives and their progress           -> /donations
 *   account-summary/funds    the family's funds and what each holds       -> no route
 *
 * THE FUNDS SECTION IS THE ONE WITH NO SCREEN BEHIND IT, which is why its key is a
 * sub-key of this page rather than a route: it is a capability inside a page, the shape
 * AGENTS.md names and `transactions/dues-payments` uses. It is an APP-LAYER gate and
 * not the RLS predicate — `funds` is mapped to `family-finances` in
 * permission_table_map and still is, so the rows a caller gets back are decided there
 * and whether the section is fetched at all is decided here.
 *
 * WORTH KNOWING BEFORE MOVING IT: /family-finances is priced `plus` and its blurb is
 * "Fund balances, contributions, and a clean profit-and-loss ledger" — so the balances
 * below are the half of that page a Free family can now see. That is a deliberate
 * reading of "a family should be able to see what it holds", not an oversight: the P&L,
 * the contribution ledger and the per-fund history stay on the paid screen. A tier
 * boundary running through a page is expressible — give the capability its own registry
 * entry — and this sub-key is where that would attach if the answer ever changes.
 */
export default async function AccountSummaryPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'accounting/summary')

  const { t, intl } = await callerI18n(user.id)
  // The FAMILY's currency, bound with the reader's conventions. A page printing the
  // family's own figures uses this; GENORRA's own prices use `formatPlatformMoney`.
  // See `lib/currency-utils.ts` — the two ledgers must never meet.
  const money = moneyFor(await getMyFamilyCurrency(user.id), intl)

  const [canDues, canHistory, canDonations, canFunds] = await Promise.all([
    can(user.id, 'accounting/dues-and-donations', 'view'),
    can(user.id, 'reporting/payment-history', 'view'),
    // THE SAME KEY TWICE, and it stays two `can()` calls rather than one. `20260820000009`
    // merged `accounting/dues` and `accounting/donations` into one resource, so both halves of
    // this digest are now governed by one grant — but they are still two SECTIONS with two
    // links, and collapsing them into one boolean would mean the next thing that splits them
    // (a tier, a second key) has to re-derive which sections it applies to. `can()` is
    // `cache()`d, so this is one query either way.
    can(user.id, 'accounting/dues-and-donations', 'view'),
    can(user.id, 'accounting/summary/funds', 'view'),
  ])

  const [duesSummary, paymentHistory, donations, funds, canManageFunds, online] = await Promise.all([
    canDues ? getMyDuesSummary() : [],
    canHistory ? getMyPaymentHistory() : [],
    canDonations ? getDonationProgress() : [],
    canFunds ? getFunds() : [],
    // The "Manage Funds" link inside FundsSection points at /admin/account?section=funds,
    // so it is that section's own view grant that decides whether to offer it. Anything
    // looser renders a link that 404s for the person who follows it.
    can(user.id, 'admin/accounting/funds', 'view'),
    // GATED ON THE DRIVES GRANT (§5), because the only thing it feeds is the Give button on
    // one. A member who cannot see the drives has no button for this to decide about, and
    // the empty shape is what `getDuesOnlineStatus` returns for every failure path anyway —
    // so the fallback needs no second branch downstream.
    canDonations ? getDuesOnlineStatus() : { chargesReady: false, autopay: [] },
  ])

  // OPEN DRIVES ONLY, and the closed ones are counted rather than dropped. A digest is
  // about what to do next; a drive whose bar cannot move any more is history, and
  // history is what /donations is for. Truncating quietly is the one thing forbidden
  // here (AGENTS.md), so the sentence under the list says how many are not shown.
  const openDrives = donations.filter(d => !d.closed)
  const closedCount = donations.length - openDrives.length

  // The stat row is one card per grant, so a withheld card leaves no hole — a fixed
  // `sm:grid-cols-3` would show a gap that reads as something that failed to load.
  const cardCount = (canDues ? 2 : 0) + (canHistory ? 1 : 0)

  // Reachable: `account-summary:view` opens the page and each section is its own grant,
  // so a caller can hold the page and none of its contents. Said out loud rather than
  // rendered as an empty stack of headings — the same answer AdminAccountShell and
  // TransactionsClient give.
  if (!canDues && !canHistory && !canDonations && !canFunds) {
    return (
      <PageShell className="space-y-8">
        <h1 className="text-3xl font-bold">{t('page./accounting/summary.title')}</h1>
        <div className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">{t('acct.noneSectionsSummaryBeen')}</div>
      </PageShell>
    )
  }

  return (
    <PageShell className="space-y-10">
      <h1 className="text-3xl font-bold">{t('page./accounting/summary.title')}</h1>

      {cardCount > 0 && (
        <div className={cn(
          'grid grid-cols-1 gap-4',
          cardCount === 3 ? 'sm:grid-cols-3' : cardCount === 2 ? 'sm:grid-cols-2' : '',
        )}>
          {/* THE DASHBOARD'S ACCOUNT CARD, the same component, unchanged — see
              DuesBalanceKpi. Two hand-rolled versions of one KPI had drifted into two
              different readings of the same money, and matching them by hand only lasts
              until the next edit to one of them. No `showViewLink`: the section heading
              below carries the way through to /dues, so a button here would be a second
              one saying the same thing. */}
          {canDues && <DuesBalanceKpi summary={duesSummary} money={money} t={t} />}
          {canDues && <NextInstallmentsCard summary={duesSummary} intl={intl} money={money} t={t} />}
          {canHistory && <PaidThisYearCard history={paymentHistory} money={money} t={t} />}
        </div>
      )}

      {(canDues || canHistory) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {canDues && <Link href="/accounting/dues-and-donations">{t('acct.seeAllDues')}</Link>}
          {canHistory && <Link href="/reporting/payment-history">{t('acct.seeFullPaymentHistory')}</Link>}
        </div>
      )}

      {canFunds && (
        <section className="space-y-3">
          {/* No SectionHeading: FundsSection is a Card with its own title and its own
              Manage Funds link. A heading above it would be the third thing on screen
              naming the same list. */}
          <FundsSection funds={funds} canManage={canManageFunds} />
        </section>
      )}

      {/* ── DRIVES COME AFTER THE FUNDS, since 2026-08-26 ─────────────────────────
          Both are the family's money rather than the reader's, and of the two the funds
          are the standing answer — where the family's money lives and what the waterfall
          is filling — while a drive is a thing currently being asked for. Reading the
          pots first and then what is being raised into one is the order somebody thinks
          in; the reverse asked them to take an appeal in before they knew what it fed. */}
      {/* ── THE SAME CARD AS FAMILY FUNDS ABOVE IT (2026-09-02) ────────────────────
          It was a bare `SectionHeading` — an `h2` with a text link opposite — over an
          unfenced list of bordered rows, sitting directly under a `Card` with an icon, a
          `CardTitle` and an outline button. Two adjacent sections of one page, both of them
          the FAMILY's money rather than the reader's, drawn as two different kinds of thing.
          Reported as: open donations should look just like Family Funds.

          THE CHROME IS BUILT HERE AND NOT MOVED INTO `DonationsSection`, deliberately. That
          component says in its own header that it has no card because *"whatever heading is
          above it names it"*, and it has a second caller — the Dues & Donations shell, where
          it sits inside that screen's own pane and a card would be a box in a box. The card
          belongs to the digest, which is the surface that has funds beside it to match.

          `HandHeart` rather than `FundsSection`'s `Award`, because two identical icons is
          worse than none: the shape of the panel is what says these are the same kind of
          section, and the icon is what says which one you are looking at. */}
      {canDonations && openDrives.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <HandHeart className="h-4 w-4 text-primary" />
              {t('acct.openDonationDrives')}
            </CardTitle>
            <Link
              href="/accounting/dues-and-donations?pane=donations"
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
            >
              {t('acct.allDrives')}
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* `chargesReady` so a drive carries a real Give button here as well as on
                [Dues & Donations](/accounting/dues-and-donations?pane=donations). A digest
                that shows the ask and cannot take the gift sends somebody to another screen
                to press the same button. */}
            <DonationsSection donations={openDrives} chargesReady={online.chargesReady} intl={intl} money={money} t={t} />
            {closedCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {t(closedCount === 1 ? 'acct.closedDrivesOne' : 'acct.closedDrivesMany',
                  { n: String(closedCount) })}
                {' '}
                <Link href="/accounting/dues-and-donations?pane=donations">
                  {t('acct.seeDonations')}
                </Link>{' '}
                {t('acct.seeDonationsForFull')}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </PageShell>
  )
}
