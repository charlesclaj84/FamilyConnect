import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPersonalInfo } from '@/app/actions/personal-info'
import { getMyRoles } from '@/app/actions/admin/users'
import { formatRoleTitle } from '@/lib/role-utils'
import { getChapters } from '@/app/actions/admin/chapters'
import { PersonalInfoForm } from '@/components/personal-info/PersonalInfoForm'

export const metadata = { title: 'My Profile — Family Connect' }

export default async function PersonalInfoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [existing, myRoles, chapters] = await Promise.all([
    getPersonalInfo(),
    getMyRoles(),
    getChapters(),
  ])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">My Profile</h1>
        {myRoles.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 mb-1">
            {myRoles.map((r, i) => (
              <span key={i} className="inline-flex items-center text-sm font-medium bg-[#0f2540] text-[#e6ecfa] px-3 py-1 rounded-full">
                {formatRoleTitle(r)}
              </span>
            ))}
          </div>
        )}
      </div>

      <PersonalInfoForm existing={existing} chapters={chapters} />
    </div>
  )
}
