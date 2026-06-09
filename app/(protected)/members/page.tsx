import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMembers } from '@/app/actions/members'
import { MemberDirectoryClient } from '@/components/members/MemberDirectoryClient'

export const metadata = { title: 'Member Directory — Family Connect' }

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const members = await getMembers()

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Member Directory</h1>
        <p className="text-muted-foreground">All family members and their roles.</p>
      </div>
      <MemberDirectoryClient members={members} />
    </div>
  )
}
