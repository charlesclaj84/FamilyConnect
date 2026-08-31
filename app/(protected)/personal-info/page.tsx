import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import { requireViewOrPending } from '@/lib/auth/permissions'
import { getPersonalInfo } from '@/app/actions/personal-info'
import { getMyRoles } from '@/app/actions/admin/users'
import { formatRoleTitle } from '@/lib/role-utils'
import { getChapters } from '@/app/actions/admin/chapters'
import { getViewingMembership } from '@/lib/auth/family'
import { familyShowsPhotos } from '@/lib/auth/tier'
import { getMyNotificationSettings } from '@/app/actions/notification-prefs'
import { PersonalInfoForm } from '@/components/personal-info/PersonalInfoForm'
import { resolveProfileSection } from '@/components/personal-info/profile-sections'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('page./personal-info.title')
}

export default async function PersonalInfoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { user } = await currentUser()
  if (!user) redirect('/login')
  const { t } = await callerI18n(user.id)

  // Resolved server-side so the first paint already shows the right section, and so the
  // client's initial state matches the server HTML exactly — which is what keeps this
  // free of hydration mismatch. searchParams is a Promise in Next 16.
  const initialSection = resolveProfileSection((await searchParams).section)

  // The one page a pending member gets in FULL rather than as a waiting screen: filling
  // in their profile is the useful thing they can do while they wait, and it is what
  // gives the administrators reviewing the request something to recognise.
  //
  // So this page does not early-return. It withholds the two fetches that are FAMILY
  // data instead — held roles and the family's chapter list — and keeps the one that is
  // the caller's own row. Skipped rather than filtered afterwards: getMyRoles() would
  // return [] for a pending caller anyway (20260806000011 swept user_roles), but
  // "returns nothing today" is a fact about the current policies, and not fetching is a
  // fact about this page.
  const gate = await requireViewOrPending(user.id, 'personal-info')
  const pending = gate.pending

  // My Families moved to its own page (/my-families) — it is no longer fetched here.
  // The active family's NAME, which the chapter block is headed with — chapter is the
  // one field on this page that is per-family rather than shared, so it says which
  // family it means. Free: getViewingMembership reads getMyFamilies(), which is
  // cache()-wrapped and already resolved for this request by the layout and the navbar.
  // Fetched for a pending member too, unlike the two below: they are family data, and
  // this is the name of the family they are waiting on.
  // `familyShowsPhotos` rides along: profile pictures are Standard (2026-08-22), and it is the
  // tier of the family being VIEWED rather than anything about the account. Fetched for a
  // pending member too — a plan is a fact about the family, not about how far through joining
  // somebody is — and it costs nothing, since `getMyFamilyTier` is cache()d per request and the
  // layout has already resolved it.
  const [existing, myRoles, chapters, membership, photosAllowed, notificationSettings] =
    await Promise.all([
      getPersonalInfo(),
      pending ? Promise.resolve([]) : getMyRoles(),
      pending ? Promise.resolve([]) : getChapters(),
      getViewingMembership(user.id),
      familyShowsPhotos(user.id),
      // NOT skipped for a pending member, unlike the two above. An applicant may edit their own
      // profile (AGENTS.md §2's one exception to `requireMember`), and a safety check-in is
      // exactly the thing somebody should be able to opt out of before their membership is
      // decided — so the action answers the conservative empty shape rather than needing a
      // branch here. The two above are skipped because a pending caller has no roles and no
      // chapter list to be shown.
      getMyNotificationSettings(),
    ])

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">{t('page./personal-info.title')}</h1>
        {myRoles.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 mb-1">
            {myRoles.map((r, i) => (
              <span key={i} className="inline-flex items-center text-sm font-medium bg-brand-primary text-brand-on-primary px-3 py-1 rounded-full">
                {formatRoleTitle(r)}
              </span>
            ))}
          </div>
        )}
      </div>

      {pending && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border bg-muted/40 px-4 py-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {gate.membership.status === 'rejected'
              ? t('prof.requestDeclined', {
                  lede: t('prof.requestJoin'),
                  family: gate.membership.familyName,
                })
              : <>{t('prof.waitingForApproval', {
                  lede: t('prof.membership'),
                  family: gate.membership.familyName,
                })}{' '}
                  <Link href="/dashboard" className="text-primary hover:underline">
                    {t('prof.checkTheStatus')}
                  </Link>.</>}
          </p>
        </div>
      )}

      {/* signInEmail is auth.users.email — the account's identity, not the profile's
          primary_email. Passed from here rather than read in the client so the Sign-in &
          Security section paints with it already resolved. */}
      {/* notificationSettings is the caller's OWN grid — which notifications they want, down
          which channel — resolved here for `photosAllowed`'s reason: the form is a client
          component and every field of it is a database fact. It also means the grid paints with
          real answers rather than flashing a row of defaults at somebody who has already set
          them, which on a consent screen looks like the product having forgotten their choice.

          NO GATE IN FRONT OF IT. `getMyNotificationSettings` is `requireMember()` and the
          caller's own person id, and it is deliberately not tier-checked: managing your own
          consent is not a paid capability, and a family that lapses from Premium must not lose
          the ability to turn a notification OFF. See app/actions/notification-prefs.ts. */}
      <PersonalInfoForm
        existing={existing}
        chapters={chapters}
        familyName={membership?.familyName ?? ''}
        photosAllowed={photosAllowed}
        initialSection={initialSection}
        signInEmail={user.email ?? ''}
        notificationSettings={notificationSettings}
      />
    </PageShell>
  )
}
