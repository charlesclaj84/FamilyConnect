import { Avatar } from '@/components/ui/Avatar'
import { getMyFamilies, isApproved, type FamilyMembership } from '@/lib/auth/family'
import { PendingApprovalScreen } from '@/components/membership/PendingApprovalScreen'
import { currentUser } from '@/lib/auth/current-user'
import { callerI18n } from '@/lib/i18n/server'

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
 *
 * IT IS A DASHBOARD, not a card on an empty page. Someone waiting on approval signs in
 * and lands here, and "Welcome back" is the same greeting an approved member gets —
 * they have an account, it works, and the one thing outstanding is a decision by
 * somebody else. The greeting comes from `user_metadata`, which is the registrant's own
 * first name and needs no family data to read.
 *
 * EVERY non-approved membership is named, not just the one being viewed. An account can
 * be waiting on two families at once — invited to a second while still queued for the
 * first — and a screen that named only the active one told them nothing about the
 * invitation they had just accepted.
 */
export async function PendingApproval({ membership }: { membership: FamilyMembership }) {
  const { user } = await currentUser()
  // `callerI18n`, not `useT()`: this is an async Server Component. It already resolves the
  // caller, so the locale costs nothing — `resolveLocale` is cached per request.
  const { t } = await callerI18n(user?.id)

  const firstName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || t('pend.member')
  const lastName  = user?.user_metadata?.last_name ?? ''
  const initials  = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase()

  const families = await getMyFamilies(user?.id ?? '')

  // The family being viewed first, then the rest — so the one they navigated into is
  // the one they read about first, however many there are.
  const awaiting = families
    .filter(f => !isApproved(f.status))
    .sort((a, b) => Number(b.familyCode === membership.familyCode)
                  - Number(a.familyCode === membership.familyCode))
    .map(f => ({ familyCode: f.familyCode, familyName: f.familyName, status: f.status }))

  const otherFamilies = families
    .filter(f => isApproved(f.status))
    .map(f => ({ familyCode: f.familyCode, familyName: f.familyName }))

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-6">
      <div className="flex items-center gap-5">
        <Avatar initials={initials} size="lg" />
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
          {t('pend.welcomeBack', { name: firstName })}
        </h1>
      </div>

      <PendingApprovalScreen
        // `awaiting` is derived from the caller's own rows and cannot be empty here —
        // this component only renders when requireViewOrPending() found a non-approved
        // membership. The fallback exists so a future caller cannot render a card with
        // no subject at all.
        pending={awaiting.length > 0
          ? awaiting
          : [{ familyCode: membership.familyCode, familyName: membership.familyName, status: membership.status }]}
        // Treated as confirmed unless GoTrue positively says otherwise, so the resend
        // panel cannot appear for a user who has nothing to confirm. Now that
        // enable_confirmations is on, this is genuinely false for an account that has
        // not clicked its link, and the panel earns its place.
        emailConfirmed={Boolean(user?.email_confirmed_at)}
        otherFamilies={otherFamilies}
      />
    </div>
  )
}
