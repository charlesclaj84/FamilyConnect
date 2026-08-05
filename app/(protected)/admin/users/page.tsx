import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import {
  getGroups, getResources, canManageGroups, getPersonOverrideContext,
} from '@/app/actions/admin/permissions'
import { AdminUserAccessClient } from '@/components/admin/AdminUserAccessClient'

export const metadata = { title: 'User Management — Family Connect' }

interface Props {
  searchParams: Promise<{ person?: string }>
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/users')

  // The member list itself is searched and paged client-side against the database,
  // so this page only loads the group catalog and the expanded member's overrides.
  const [groups, resources, rights] = await Promise.all([
    getGroups(),
    getResources(),
    canManageGroups(),
  ])

  const { person } = await searchParams
  const context = person
    ? await getPersonOverrideContext(person)
    : { found: false, personPolicy: {}, groupCoveredKeys: [] }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">
          Who is in which group, and any per-person exceptions. Group policies are set on
          {' '}<Link href="/admin/groups" className="text-primary hover:underline">Groups &amp; Permissions</Link>;
          board positions live on{' '}
          <Link href="/admin/user-roles" className="text-primary hover:underline">Board Positions</Link>.
        </p>
      </div>

      <AdminUserAccessClient
        groups={groups}
        resources={resources}
        expandedPersonId={context.found ? person! : null}
        personPolicy={context.personPolicy}
        groupCoveredKeys={context.groupCoveredKeys}
        rights={rights}
      />
    </div>
  )
}
