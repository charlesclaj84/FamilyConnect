import Link from 'next/link'
import { redirect } from 'next/navigation'
import { GitBranch } from 'lucide-react'
import { requireView } from '@/lib/auth/permissions'
import { getMembers } from '@/app/actions/members'
import { MemberDirectoryClient } from '@/components/members/MemberDirectoryClient'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { callerI18n } from '@/lib/i18n/server'
import { docTitle } from '@/lib/i18n/page-metadata'
import { currentUser } from '@/lib/auth/current-user'

// "Directory", not "Member Directory". It sits under a Community heading in the rail,
// beside Chat and Announcements, where the only thing it could be a directory OF is the
// family — so the qualifier was restating its own section. The ROUTE and the RESOURCE
// KEY both stay `members`: that string is the permission key in permission_resources,
// permission_table_map and every grant already issued.
export async function generateMetadata() {
  return docTitle('page./community/directory.title')
}

export default async function MembersPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'community/directory')

  const { t } = await callerI18n(user.id)

  const members = await getMembers()

  return (
    <PageShell>
      {/* THE BUTTON POINTS AT THE FAMILY TREE, since 2026-08-13. It used to open
          `/community/directory/family-tree`, the per-member lineage view, which had no rail item and
          so was reachable only from here — that page is now deleted and the family tree
          answers the same question by re-centring on whoever you click.

          It is kept rather than dropped even though Family Tree HAS a rail item directly
          under Directory, because the two screens answer one question from two sides:
          somebody looking at a name in the roster and wondering how they are related is
          one click from the answer, without having to notice the rail. */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('page./community/directory.title')}</h1>
        </div>
        <Link href="/community/family-tree">
          <Button variant="outline">
            <GitBranch className="h-4 w-4" aria-hidden="true" />{t('comm.familyTree')}</Button>
        </Link>
      </div>
      <MemberDirectoryClient members={members} />
    </PageShell>
  )
}
