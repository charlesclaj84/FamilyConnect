import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import {
  getTemplates, getResources, getTemplatePolicy, canManageAccess, getMyEffectivePermissions,
} from '@/app/actions/admin/permissions'
import { getApplicants } from '@/app/actions/admin/approvals'
import { getInvitations } from '@/app/actions/invitations'
import {
  AdminAccessClient, type AccessTab, type ApprovalsData,
} from '@/components/admin/AdminAccessClient'

export const metadata = { title: 'Members & Access — Family Connect' }

interface Props {
  searchParams: Promise<{ tab?: string; template?: string }>
}

/**
 * Members & Access, and — since Member Approvals moved here from its own route — the
 * join queue.
 *
 * TWO RESOURCE KEYS GATE THIS ONE PAGE, and neither implies the other.
 *
 *   `admin/users`      the member list and the permission templates
 *   `admin/approvals`  the Pending Approval tab
 *
 * The page opens for EITHER, which is what keeps the move from being a quiet
 * tightening: before it, reviewing applicants needed only the approvals grant, and a
 * family that had given someone Member Approvals without Members & Access would have
 * found them locked out of a queue they were responsible for. Requiring both would
 * have been a permission change smuggled in as a navigation change.
 *
 * Each half then fetches only under its own grant (AGENTS.md §5 — props are
 * serialized into the RSC payload and reach the browser whether a component renders
 * them or not, so hiding a tab over data already fetched publishes that data). The
 * actions behind both halves re-check independently: getTemplates() and friends run
 * requireAccessAdmin('view'), getApplicants() runs requireRead('admin/approvals').
 */
export default async function AdminAccessPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [canViewAccess, canViewApprovals] = await Promise.all([
    can(user.id, 'admin/users', 'view'),
    can(user.id, 'admin/approvals', 'view'),
  ])

  // Neither grant: the 404 requireView() would have given, and for the same reason —
  // a restricted page should not advertise that it exists.
  if (!canViewAccess && !canViewApprovals) notFound()

  const params = await searchParams
  const requested: AccessTab =
    params.tab === 'templates' ? 'templates'
      : params.tab === 'approvals' ? 'approvals'
        : 'members'

  // Landing on a tab this caller cannot see — a stale link, a grant removed since, or
  // an approvals-only caller arriving at the bare URL — falls back to one they can.
  const tab: AccessTab =
    requested === 'approvals'
      ? (canViewApprovals ? 'approvals' : 'members')
      : (canViewAccess ? requested : 'approvals')

  // The member list is searched and paged in the database by the client on demand — a
  // family can run past 500 people — so this page loads only the template catalog.
  const [templates, resources, rights, effective] = canViewAccess
    ? await Promise.all([
        getTemplates(),
        getResources(),
        canManageAccess(),
        getMyEffectivePermissions(),
      ])
    : [[], [], { view: false, create: false, edit: false, remove: false }, { legacy: false }]

  const selectedTemplateId = templates.some(t => t.id === params.template)
    ? params.template!
    : templates[0]?.id ?? null

  // Only fetched for the tab that shows it, on both halves.
  const policy = tab === 'templates' && selectedTemplateId
    ? await getTemplatePolicy(selectedTemplateId)
    : {}

  // Fetched only for a caller who may view the queue AND is looking at it. Whether the
  // TAB appears is `canViewApprovals` alone, passed separately — otherwise it would
  // vanish whenever another tab was open.
  let approvalsData: ApprovalsData | null = null
  if (canViewApprovals && tab === 'approvals') {
    const [{ pending, decided, canDecide }, invitations] = await Promise.all([
      getApplicants(),
      getInvitations(),
    ])
    approvalsData = { pending, decided, canDecide, invitations }
  }

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
        approvals={approvalsData}
        canViewApprovals={canViewApprovals}
        canViewAccess={canViewAccess}
      />
    </div>
  )
}
