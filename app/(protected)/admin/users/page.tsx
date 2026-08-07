import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import {
  getTemplates, getResources, getTemplatePolicy, canManageAccess, getMyEffectivePermissions,
} from '@/app/actions/admin/permissions'
import { AdminAccessClient } from '@/components/admin/AdminAccessClient'

export const metadata = { title: 'Members & Access — Family Connect' }

interface Props {
  searchParams: Promise<{ tab?: string; template?: string }>
}

export default async function AdminAccessPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/users')

  // The member list is searched and paged in the database by the client on demand — a
  // family can run past 500 people — so this page loads only the template catalog.
  const [templates, resources, rights, effective] = await Promise.all([
    getTemplates(),
    getResources(),
    canManageAccess(),
    getMyEffectivePermissions(),
  ])

  const params = await searchParams
  const tab = params.tab === 'templates' ? 'templates' : 'members'
  const selectedTemplateId = templates.some(t => t.id === params.template)
    ? params.template!
    : templates[0]?.id ?? null

  // Only fetched for the tab that shows it. A grid the caller is not looking at would
  // still be serialized into the RSC payload and reach the browser (AGENTS.md §5).
  const policy = tab === 'templates' && selectedTemplateId
    ? await getTemplatePolicy(selectedTemplateId)
    : {}

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">Members &amp; Access</h1>
        <p className="text-muted-foreground">
          Every member is on one permission template, and that template is what they can do.
        </p>
      </div>

      <AdminAccessClient
        templates={templates}
        resources={resources}
        tab={tab}
        selectedTemplateId={selectedTemplateId}
        policy={policy}
        rights={rights}
        legacy={effective.legacy}
      />
    </div>
  )
}
