import { redirect } from 'next/navigation'
import { requireViewOrPending } from '@/lib/auth/permissions'
import { getMyFamilies } from '@/lib/auth/family'
import { MyFamiliesSection } from '@/components/my-families/MyFamiliesSection'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'

export const metadata = { title: 'My Families' }

/**
 * Every family this account belongs to. Split out of My Profile, where it sat as a
 * card above the profile form.
 *
 * getMyFamilies() resolves memberships for the signed-in user only, so there is no
 * family-scoping to re-apply here — the caller's own people rows ARE the result set.
 */
export default async function MyFamiliesPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  // Reachable while pending, and the ONLY family-listing page that is. It is how a
  // multi-family account gets back out of a family it is waiting on, and how a
  // single-family applicant sees what they applied to. Everything it renders is the
  // caller's own memberships, so there is nothing here to withhold from them.
  await requireViewOrPending(user.id, 'my-families')
  const { t } = await callerI18n(user.id)

  const families = await getMyFamilies(user.id)

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('page./my-families.title')}</h1>
      </div>

      <MyFamiliesSection families={families} />
    </PageShell>
  )
}
