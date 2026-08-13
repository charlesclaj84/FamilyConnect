import Link from 'next/link'
import { redirect } from 'next/navigation'
import { GitBranch } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getMembers } from '@/app/actions/members'
import { MemberDirectoryClient } from '@/components/members/MemberDirectoryClient'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'

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
      {/* THE LINEAGE LINK IS THE WAY IN TO `/members/family-tree`, and it is not decoration.
          That page moved under this one and deliberately has no rail item — it shows one
          person's line rather than the family, so it belongs behind the roster. Without a
          link here it would be reachable only from inside itself, which is how a page
          becomes unreachable without anybody deleting it. */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Directory</h1>
          <p className="text-muted-foreground">All family members and their roles.</p>
        </div>
        <Link href="/members/family-tree">
          <Button variant="outline">
            <GitBranch className="h-4 w-4" aria-hidden="true" />
            Lineage
          </Button>
        </Link>
      </div>
      <MemberDirectoryClient members={members} />
    </PageShell>
  )
}
