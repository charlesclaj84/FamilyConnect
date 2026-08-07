import { createClient } from '@/lib/supabase/server'
import { getMyFamilies, type FamilyMembership } from '@/lib/auth/family'
import { PendingApprovalScreen } from '@/components/membership/PendingApprovalScreen'

/**
 * Server half of the awaiting-approval screen: resolves the few things it needs and
 * hands them to the client component.
 *
 * It exists so that a page showing this screen is two lines rather than a dozen —
 * which matters, because those lines have to come BEFORE the page's own data fetching
 * and anything easy to get wrong there will be got wrong in one of the three places.
 *
 * Everything read here is the CALLER'S OWN: their memberships, and whether their own
 * email is confirmed. Nothing about the family they are waiting on is fetched beyond
 * the name they already confirmed when they joined.
 */
export async function PendingApproval({ membership }: { membership: FamilyMembership }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const families = await getMyFamilies(user?.id ?? '')
  const otherFamilies = families
    .filter(f => f.familyCode !== membership.familyCode && f.status === 'approved')
    .map(f => ({ familyCode: f.familyCode, familyName: f.familyName }))

  return (
    <PendingApprovalScreen
      familyName={membership.familyName}
      status={membership.status}
      // Treated as confirmed unless GoTrue positively says otherwise, so the resend
      // panel cannot appear for a user who has nothing to confirm. Now that
      // enable_confirmations is on, this is genuinely false for an account that has
      // not clicked its link, and the panel earns its place.
      emailConfirmed={Boolean(user?.email_confirmed_at)}
      otherFamilies={otherFamilies}
    />
  )
}
