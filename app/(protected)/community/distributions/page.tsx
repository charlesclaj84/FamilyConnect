import { redirect } from 'next/navigation'
import { canAny, requireView } from '@/lib/auth/permissions'
import {
  getDistributionAudiences, getDistributionRights, getDistributions,
} from '@/app/actions/distributions'
import { DistributionsClient } from '@/components/distributions/DistributionsClient'
import { PageShell } from '@/components/layout/PageShell'
import { currentUser } from '@/lib/auth/current-user'

export const metadata = { title: 'Distributions' }

/**
 * Email the family, drawn from the membership. `/community/distributions`, Premium.
 *
 * ── ONE `requireView`, AND IT IS DOING THREE JOBS ──────────────────────────────────
 * §1's preamble. It folds `requireFamilyActive` and `requireTier` in, which is why this page
 * does not name either — and it matters more here than on most screens, because this is the
 * first PREMIUM route in the product, so `requireTier` is the only thing standing between a
 * Free family and a feature its plan does not include. A page that decomposed `requireView`
 * into `can()` calls would silently drop both (the trap "A PAGE THAT RESOLVES PANES BY HAND"
 * describes); this one has a single key and does not need to.
 *
 * ── AND A SECOND CHECK, `canAny`, WHICH IS NOT REDUNDANT ───────────────────────────
 * `requireView` resolves with `can()`, which is TRUE for scope `'own'` — and `'own'` is a real
 * grant on this key, meaning "the distributions I sent". So `can` is right for admitting
 * somebody to the screen, and it is not enough to decide whether they may SEND: that is
 * `canAny`, because mail to the whole family has no coherent "own" version and the row a
 * member would own is the abuse case. The two answers are different and both are needed, which
 * is why `getDistributionRights()` exists rather than the page inferring send from view.
 *
 * ── §5: THE AUDIENCE LIST IS NOT FETCHED FOR SOMEBODY WHO CANNOT SEND ──────────────
 * `getDistributionAudiences()` returns the region and chapter names with a HEAD COUNT against
 * each. That is family structure rather than PII, but it is also useless to a reader who
 * cannot compose — and props are serialized into the RSC payload whether a component renders
 * them or not, so the fetch is skipped rather than the picker hidden. The action resolves the
 * same grant itself, because this page is a convenience and not a gate (§2).
 */
export default async function DistributionsPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'community/distributions')

  const canSend = await canAny(user.id, 'community/distributions', 'create')

  const [distributions, rights, audiences] = await Promise.all([
    getDistributions(),
    getDistributionRights(),
    canSend ? getDistributionAudiences() : Promise.resolve([]),
  ])

  return (
    <PageShell className="space-y-6">
      <DistributionsClient
        // §8: `null` from the action is a REFUSED READ, not an empty log, and the client says
        // so rather than rendering "nothing sent yet" over an outage. The two are different
        // facts and only one of them is about the family.
        initialDistributions={distributions}
        audiences={audiences}
        rights={rights}
      />
    </PageShell>
  )
}
