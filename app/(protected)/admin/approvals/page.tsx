import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getApplicants } from '@/app/actions/admin/approvals'
import { getInvitations } from '@/app/actions/invitations'
import { AdminApprovalsClient } from '@/components/admin/AdminApprovalsClient'

export const metadata = { title: 'Member Approvals — Family Connect' }

/**
 * The queue of people who have asked to join, and the decisions already taken.
 *
 * Gated on `admin/approvals` — registered in 20260806000010 and restricted per family
 * by the same migration, so it is administrators-only unless a family grants it
 * elsewhere. The gate is not cosmetic here even by the usual standard: the rows on this
 * page are the only place an applicant's name, email, phone and date of birth are
 * visible to anyone but themselves, because the `people` SELECT policy hides a
 * non-approved row from every caller who cannot view THIS resource key.
 */
export default async function AdminApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/approvals')

  const [{ pending, decided, canDecide }, invitations] = await Promise.all([
    getApplicants(),
    getInvitations(),
  ])

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">Member Approvals</h1>
        <p className="text-muted-foreground">
          People who have asked to join with your family code. They cannot see anything
          in the family until you admit them — unless you invite them from here, which
          admits them on acceptance.
        </p>
      </div>

      <AdminApprovalsClient
        pending={pending}
        decided={decided}
        canDecide={canDecide}
        invitations={invitations}
      />
    </div>
  )
}
