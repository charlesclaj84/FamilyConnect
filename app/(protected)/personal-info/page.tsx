import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPersonalInfo } from '@/app/actions/personal-info'
import { PersonalInfoForm } from '@/components/personal-info/PersonalInfoForm'

export const metadata = { title: 'My Profile — Family Connect' }

export default async function PersonalInfoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const existing = await getPersonalInfo()

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">My Profile</h1>
        <p className="text-muted-foreground">
          Keep your profile up to date so your family can reach you.
        </p>
      </div>

      <PersonalInfoForm existing={existing} />
    </div>
  )
}
