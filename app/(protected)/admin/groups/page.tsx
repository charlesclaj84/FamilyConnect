import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import {
  getGroups, getResources, getGroupPolicy, canManageGroups, getMyEffectivePermissions,
} from '@/app/actions/admin/permissions'
import { AdminGroupsClient } from '@/components/admin/AdminGroupsClient'

export const metadata = { title: 'Groups & Permissions — Family Connect' }

interface Props {
  searchParams: Promise<{ group?: string }>
}

export default async function AdminGroupsPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/groups')

  // Member lists are fetched by the client on demand — a family can run past 500
  // people, so they are searched and paged in the database rather than shipped here.
  const [groups, resources, rights, effective] = await Promise.all([
    getGroups(),
    getResources(),
    canManageGroups(),
    getMyEffectivePermissions(),
  ])

  const { group } = await searchParams
  const selectedGroupId = groups.some(g => g.id === group) ? group! : groups[0]?.id ?? null
  const policy = selectedGroupId ? await getGroupPolicy(selectedGroupId) : {}

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">Groups &amp; Permissions</h1>
        <p className="text-muted-foreground">
          Create groups, decide who is in them, and set what each one can do on every page.
        </p>
      </div>

      <AdminGroupsClient
        groups={groups}
        resources={resources}
        selectedGroupId={selectedGroupId}
        policy={policy}
        rights={rights}
        legacy={effective.legacy}
      />
    </div>
  )
}
