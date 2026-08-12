import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireViewOrPending } from '@/lib/auth/permissions'
import { getPersonalInfo } from '@/app/actions/personal-info'
import { getMyRoles } from '@/app/actions/admin/users'
import { formatRoleTitle } from '@/lib/role-utils'
import { getChapters } from '@/app/actions/admin/chapters'
import { getViewingMembership } from '@/lib/auth/family'
import { PersonalInfoForm } from '@/components/personal-info/PersonalInfoForm'
import { resolveProfileSection } from '@/components/personal-info/profile-sections'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'My Profile' }

export default async function PersonalInfoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
  const [existing, myRoles, chapters, membership] = await Promise.all([
    getPersonalInfo(),
    pending ? Promise.resolve([]) : getMyRoles(),
    pending ? Promise.resolve([]) : getChapters(),
    getViewingMembership(user.id),
  ])

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">My Profile</h1>
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
              ? <>Your request to join <span className="font-medium">{gate.membership.familyName}</span>{' '}
                  was declined. You can still keep your profile up to date.</>
              : <>Your membership of <span className="font-medium">{gate.membership.familyName}</span>{' '}
                  is waiting for approval. Filling this in helps them recognise you —{' '}
                  <Link href="/dashboard" className="text-primary hover:underline">check the status</Link>.</>}
          </p>
        </div>
      )}

      {/* signInEmail is auth.users.email — the account's identity, not the profile's
          primary_email. Passed from here rather than read in the client so the Sign-in &
          Security section paints with it already resolved. */}
      <PersonalInfoForm
        existing={existing}
        chapters={chapters}
        familyName={membership?.familyName ?? ''}
        initialSection={initialSection}
        signInEmail={user.email ?? ''}
      />
    </PageShell>
  )
}
