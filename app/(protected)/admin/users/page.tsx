import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import {
  getTemplates, getResources, getTemplatePolicy, canManageAccess, getMyEffectivePermissions,
  type AccessRights,
} from '@/app/actions/admin/permissions'
import { getApplicants } from '@/app/actions/admin/approvals'
import { getInvitations } from '@/app/actions/invitations'
import {
  AdminAccessClient, type AccessTab, type ApprovalsData,
} from '@/components/admin/AdminAccessClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Members & Access' }

interface Props {
  searchParams: Promise<{ tab?: string; template?: string }>
}

/** The shape handed down when neither half of the page was fetched. */
const NO_RIGHTS: AccessRights = { view: false, create: false, edit: false, remove: false }

/**
 * Members & Access, and — since Member Approvals moved here from its own route — the
 * join queue.
 *
 * THREE RESOURCE KEYS GATE THIS ONE PAGE — one per tab — and none implies another.
 *
 *   `admin/users`            the Members tab: the roster, and re-templating someone
 *   `admin/approvals`        the Pending Approval tab: the join queue
 *   `admin/users/templates`  the Permission Templates tab: the grids themselves
 *
 * The page opens for ANY of them, which is what keeps each move onto this screen from
 * being a quiet tightening: reviewing applicants needed only the approvals grant before
 * the queue moved here, and editing grids needed only the Groups & Permissions grant
 * before that screen was merged in. Requiring the page's key on top of a tab's would be
 * a permission change smuggled in as a navigation change.
 *
 * Each tab then fetches only under its own grant (AGENTS.md §5 — props are
 * serialized into the RSC payload and reach the browser whether a component renders
 * them or not, so hiding a tab over data already fetched publishes that data). The
 * actions behind all three re-check independently: getResources() and
 * getTemplatePolicy() run requireAccessAdmin(TEMPLATE_RESOURCE, 'view'), searchMembers()
 * runs it on 'admin/users', getApplicants() runs requireRead('admin/approvals').
 */
export default async function AdminAccessPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [canViewAccess, canViewApprovals, canViewTemplates] = await Promise.all([
    can(user.id, 'admin/users', 'view'),
    can(user.id, 'admin/approvals', 'view'),
    can(user.id, 'admin/users/templates', 'view'),
  ])

  // No grant at all: the 404 requireView() would have given, and for the same reason —
  // a restricted page should not advertise that it exists.
  if (!canViewAccess && !canViewApprovals && !canViewTemplates) notFound()

  const params = await searchParams
  const requested: AccessTab =
    params.tab === 'templates' ? 'templates'
      : params.tab === 'approvals' ? 'approvals'
        : 'members'

  // Landing on a tab this caller cannot see — a stale link, a grant removed since, or
  // a single-grant caller arriving at the bare URL — falls back to one they can, in
  // the rail's own order so the landing tab is the leftmost one available.
  const allowed: Record<AccessTab, boolean> = {
    members: canViewAccess,
    approvals: canViewApprovals,
    templates: canViewTemplates,
  }
  const tab: AccessTab = allowed[requested]
    ? requested
    : (['members', 'approvals', 'templates'] as AccessTab[]).find(t => allowed[t])!

  // The member list is searched and paged in the database by the client on demand — a
  // family can run past 500 people — so this page loads only the template catalog.
  //
  // getTemplates() is fetched for EITHER key: the Members tab's row menu is a list of
  // templates to put someone on, so the roster half needs their names as much as the
  // grid half does. getResources() is the templates half alone — the resource catalog
  // is only the grid's columns.
  const [templates, rights, effective] = canViewAccess || canViewTemplates
    ? await Promise.all([getTemplates(), canManageAccess(), getMyEffectivePermissions()])
    : [[], { members: NO_RIGHTS, templates: NO_RIGHTS }, { legacy: false }]

  const resources = canViewTemplates ? await getResources() : []

  const selectedTemplateId = templates.some(t => t.id === params.template)
    ? params.template!
    : templates[0]?.id ?? null

  // Only fetched for the tab that shows it, and only under the grant that governs it.
  const policy = canViewTemplates && tab === 'templates' && selectedTemplateId
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
    <PageShell>
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
        memberRights={rights.members}
        templateRights={rights.templates}
        legacy={effective.legacy}
        approvals={approvalsData}
        canViewApprovals={canViewApprovals}
        canViewAccess={canViewAccess}
        canViewTemplates={canViewTemplates}
      />
    </PageShell>
  )
}
