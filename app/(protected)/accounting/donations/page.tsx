import { HeartHandshake } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getDonationProgress } from '@/app/actions/dues'
import { DonationsSection } from '@/components/account/DonationsSection'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Donations' }

/**
 * Every drive the family is running, how far each has got toward its goal, and what
 * this member has given to it.
 *
 * A PANE OF /account-summary UNTIL 20260815000000. `account-summary/donations` became
 * `donations`; see [Dues](/dues) for the argument, which is the same one.
 *
 * OPEN AND CLOSED DRIVES ALIKE, which is what separates this screen from the digest on
 * [Summary](/account-summary): that one lists what is still open, because a summary is
 * about what to do next, and points here for the rest. A closed drive's bar cannot move
 * any more, but what it raised is family history and this is where it is kept.
 *
 * NOTHING HERE IDENTIFIES ANOTHER MEMBER'S GIVING. Every figure is either a family
 * total or the reader's own — getDonationProgress() computes the family totals on the
 * admin client precisely so that only the totals cross the boundary.
 */
export default async function DonationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'accounting/donations')

  const donations = await getDonationProgress()

  return (
    <PageShell className="space-y-8">
      <h1 className="text-3xl font-bold">Donations</h1>
      {/* DonationsSection renders null on an empty list — right when it was a pane
          behind a rail item the page could withhold, and not enough on a screen a
          member has just navigated to. A blank page under a heading reads as something
          that failed to load, so the empty case is answered here instead. */}
      {donations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10">
          <HeartHandshake className="h-10 w-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            Your family is not running any donation drives right now.
          </p>
        </div>
      ) : (
        <DonationsSection donations={donations} />
      )}
    </PageShell>
  )
}
