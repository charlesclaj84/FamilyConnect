import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getMyFamilies } from '@/lib/auth/family'
import { MyFamiliesSection } from '@/components/my-families/MyFamiliesSection'

export const metadata = { title: 'My Families — Family Connect' }

/**
 * Every family this account belongs to. Split out of My Profile, where it sat as a
 * card above the profile form.
 *
 * getMyFamilies() resolves memberships for the signed-in user only, so there is no
 * family-scoping to re-apply here — the caller's own people rows ARE the result set.
 */
export default async function MyFamiliesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'my-families')

  const families = await getMyFamilies(user.id)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">My Families</h1>
        <p className="text-muted-foreground">
          Choose which family opens when you log in, or switch the one you&apos;re viewing now.
        </p>
      </div>

      <MyFamiliesSection families={families} />
    </div>
  )
}
