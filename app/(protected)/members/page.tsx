import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getMembers } from '@/app/actions/members'
import { MemberDirectoryClient } from '@/components/members/MemberDirectoryClient'
import { PageShell } from '@/components/layout/PageShell'

// "Directory", not "Member Directory". It sits under a Community heading in the rail,
// beside Chat and Announcements, where the only thing it could be a directory OF is the
// family — so the qualifier was restating its own section. The ROUTE and the RESOURCE
// KEY both stay `members`: that string is the permission key in permission_resources,
// permission_table_map and every grant already issued.
export const metadata = { title: 'Directory' }

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'members')

  const members = await getMembers()

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Directory</h1>
        <p className="text-muted-foreground">All family members and their roles.</p>
      </div>
      <MemberDirectoryClient members={members} />
    </PageShell>
  )
}
