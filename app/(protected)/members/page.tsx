import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getMembers } from '@/app/actions/members'
import { MemberDirectoryClient } from '@/components/members/MemberDirectoryClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Member Directory' }

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'members')

  const members = await getMembers()

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Member Directory</h1>
        <p className="text-muted-foreground">All family members and their roles.</p>
      </div>
      <MemberDirectoryClient members={members} />
    </PageShell>
  )
}
