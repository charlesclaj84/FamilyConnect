'use client'

import { Fragment, useCallback, useEffect, useId, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  MoreVertical, Plus, Trash2, Pencil, ShieldCheck, Check, Ban, UserCheck,
  Users, KeyRound, Clock,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useConfirm, type ConfirmOptions } from '@/components/ui/confirm'
import { COLLAPSING_CELL, RowMeta, MetaIf } from '@/components/ui/table-collapse'
import { FormError } from '@/components/ui/form-message'
import { useDismissWhenIdle } from '@/lib/use-dismiss-when-idle'
import { cn } from '@/lib/utils'
import {
  createTemplate, renameTemplate, deleteTemplate, setTemplatePermission,
  applyTemplate, setMemberEnabled, searchMembers,
  type TemplateSummary, type ResourceSummary, type PolicyMap, type MemberSummary,
} from '@/app/actions/admin/permissions'
import { usePagedMembers, MemberSearchBox, Pager } from '@/components/admin/MemberSearch'
import {
  ACTIONS, SCOPE_LABEL, SCOPE_STYLE, scopesFor, groupResources,
} from '@/components/admin/resource-groups'
import { AdminApprovalsClient } from '@/components/admin/AdminApprovalsClient'
import { HelpLink } from '@/components/help/HelpLink'
import { InviteMemberDialog } from '@/components/invitations/InviteMemberDialog'
import { MainRail, type MainRailItem } from '@/components/layout/MainRail'
import type { Applicant } from '@/app/actions/admin/approvals'
import type { FamilyInvitation } from '@/app/actions/invitations'
import { formatPhone } from '@/lib/phone-format'

/**
 * Members & Access — one screen for what used to be three.
 *
 * The old pair could not be merged while a member's access was the union of N group
 * policies layered over a per-person override grid, because no single view could
 * state the answer. One template per member makes the answer a single word on the
 * member's row, and the template's grid the only place it is decided.
 *
 * So: MEMBERS is a filterable list with a row menu, TEMPLATES is the grid, and
 * PENDING APPROVAL is the join queue that used to live at /admin/approvals — the
 * three questions you can ask about who is in this family and what they may do.
 *
 * EACH TAB IS GATED SEPARATELY, and that is load-bearing rather than tidy. Three
 * resource keys, one per tab — `admin/users`, `admin/approvals`,
 * `admin/users/templates` — and a tab is absent, with its data unfetched, for a caller
 * who does not hold its key. See the page, which decides all three.
 *
 * The two splits have different reasons and both are worth keeping straight:
 *   * Pending Approval, because the rows behind it are the only place an applicant's
 *     name, email, phone and date of birth are visible to anyone but themselves.
 *   * Permission Templates, because editing a grid can invent authority while
 *     re-templating a member can only hand out authority that already exists — so a
 *     roster administrator need not be someone who can promote themselves.
 */

export type AccessTab = 'members' | 'templates' | 'approvals'

interface Rights { view: boolean; create: boolean; edit: boolean; remove: boolean }

/** The join queue. Supplied only for the tab that shows it — null otherwise. */
export interface ApprovalsData {
  pending: Applicant[]
  decided: Applicant[]
  canDecide: boolean
  invitations: FamilyInvitation[]
}

interface Props {
  templates: TemplateSummary[]
  resources: ResourceSummary[]
  tab: AccessTab
  selectedTemplateId: string | null
  policy: PolicyMap
  /** What the caller may do on `admin/users` — the roster, and re-templating someone. */
  memberRights: Rights
  /** What the caller may do on `admin/users/templates` — the grids themselves. */
  templateRights: Rights
  legacy: boolean
  /**
   * The queue, and ONLY when `tab` is 'approvals'. Whether the tab exists is
   * `canViewApprovals`, deliberately a separate prop: tying the tab's presence to the
   * data would make it disappear whenever another tab was open, and sending the data
   * on every tab would publish the queue to the browser for someone who never opened
   * it (AGENTS.md §5).
   */
  approvals: ApprovalsData | null
  /** Whether the caller may view `admin/approvals` — drives the tab. */
  canViewApprovals: boolean
  /**
   * Whether the caller may view `admin/users` itself — the Members tab. False for
   * someone who reached this page on their Member Approvals or Permission Templates
   * grant alone.
   */
  canViewAccess: boolean
  /** Whether the caller may view `admin/users/templates` — drives the templates tab. */
  canViewTemplates: boolean
  /**
   * Whether to offer Invite Member at all — resolved by the page as
   * `admin/users:create` OR `admin/approvals:edit` at scope 'any'.
   *
   * A SEPARATE PROP RATHER THAN `memberRights.create`, since 2026-08-13, and it is the
   * union for a reason: the button now sits on the rail, which every tab shares, so
   * tying it to the Members grant alone would have TAKEN it away from an approvals
   * administrator who has no roster grant — the one person on this screen whose whole
   * job is deciding who is in the family. Either grant is a caller who may invite from
   * an administration screen; the database decides what the invitation is worth.
   */
  canInvite: boolean
}

export function AdminAccessClient({
  templates, resources, tab, selectedTemplateId, policy, memberRights, templateRights,
  legacy, approvals, canViewApprovals, canViewAccess, canViewTemplates, canInvite,
}: Props) {
  const router = useRouter()
  const [error, setError] = useState('')

  function go(next: { tab?: AccessTab; template?: string | null }) {
    const t = next.tab ?? tab
    const template = next.template === undefined ? selectedTemplateId : next.template
    const params = new URLSearchParams()
    if (t !== 'members') params.set('tab', t)
    if (t === 'templates' && template) params.set('template', template)
    const qs = params.toString()
    router.push(qs ? `/admin/users?${qs}` : '/admin/users')
  }

  // Built from what the caller may actually see, so a visible tab always leads
  // somewhere they can go. Every entry is conditional and each reads its OWN key —
  // three grants, three tabs, any combination of which is a legitimate caller. Order is
  // Members → Pending Approval → Permission Templates regardless of which of them
  // survive, so the two people-shaped tabs stay adjacent.
  const tabs: MainRailItem<AccessTab>[] = [
    ...(canViewAccess ? [
      { id: 'members' as const, label: 'Members', icon: Users, href: '/admin/users' },
    ] : []),
    ...(canViewApprovals ? [{
      id: 'approvals' as const,
      label: 'Pending Approval',
      icon: Clock,
      href: '/admin/users?tab=approvals',
    }] : []),
    ...(canViewTemplates ? [{
      id: 'templates' as const,
      label: 'Permission Templates',
      icon: KeyRound,
      href: '/admin/users?tab=templates',
    }] : []),
  ]

  return (
    <div className="space-y-5">
      {legacy && (
        <div className="rounded-xl border border-brand-legacy/50 bg-brand-soft px-4 py-3 text-sm text-brand-on-soft">
          <span className="font-medium">Permission tables not found.</span> Run the migrations in
          {' '}<code>supabase/migrations</code>. Until then access falls back to the old
          {' '}<code>is_admin</code> flag and nothing changed here takes effect.
        </div>
      )}

      {/* Per TAB, not per page: read-only on the roster and read-only on the grids are
          different facts, and a caller can hold one and not the other. Suppressed
          entirely on Pending Approval, which is neither — telling somebody reviewing
          applicants that they cannot change access settings is a non sequitur. */}
      {tab === 'members' && canViewAccess && !memberRights.edit && (
        <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          You can view the member list but not change who is on which template.
        </div>
      )}
      {tab === 'templates' && canViewTemplates && !templateRights.edit && (
        <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          You can view what each template grants but not change it.
        </div>
      )}

      <FormError message={error} />

      {/* INVITE MEMBER SITS ON THE RAIL FOR ALL THREE TABS, since 2026-08-13, and this is
          a deliberate departure from MainRail's "the active pane's one action" (AGENTS.md,
          "The main rail is a standard component").

          The rule assumes each pane has a DIFFERENT action, and here all three want the
          same one: adding somebody to the family is the job this whole screen is about,
          and it was previously offered twice — once on the Members rail and once inside
          the Pending Approval pane — so the same button appeared in two places at two
          sizes depending on which tab you were on. One button that does not move is
          easier to find than two that take turns. The pane copy is now gone; this is the
          only Invite Member on the page.

          `canInvite` is the union of the two grants that can mean it — see the prop.

          `preApproved` — the invitee is admitted the moment they accept, because the
          person inviting from an administration screen is the person who would have
          approved them a moment later. It is a REQUEST, not an instruction:
          `create_family_invitation` honours it only for a caller holding
          admin/approvals:edit at scope 'any' and silently downgrades otherwise, so a
          roster administrator without the approvals grant sends an ordinary invitation
          and the dialog reports what actually happened. */}
      <MainRail
        label="Members and access"
        items={tabs}
        active={tab}
        onSelect={t => go({ tab: t })}
        action={canInvite ? <InviteMemberDialog preApproved /> : undefined}
      />

      {tab === 'approvals' && approvals && (
        <AdminApprovalsClient
          pending={approvals.pending}
          decided={approvals.decided}
          canDecide={approvals.canDecide}
          invitations={approvals.invitations}
        />
      )}

      {tab === 'members' && (
        <MembersTab templates={templates} rights={memberRights} onError={setError} />
      )}

      {tab === 'templates' && (
        <TemplatesTab
          templates={templates}
          resources={resources}
          selectedTemplateId={selectedTemplateId}
          policy={policy}
          rights={templateRights}
          onError={setError}
          onSelect={id => go({ tab: 'templates', template: id })}
        />
      )}
    </div>
  )
}

// ── Members ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; className: string } | null> = {
  approved: null,
  pending:  { label: 'Awaiting approval', className: 'bg-brand-legacy text-brand-on-legacy' },
  disabled: { label: 'Disabled',          className: 'bg-destructive/10 text-destructive' },
  rejected: { label: 'Declined',          className: 'bg-muted text-muted-foreground' },
}

function MembersTab({ templates, rights, onError }: {
  templates: TemplateSummary[]
  rights: Rights
  onError: (m: string) => void
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()
  const { query, setQuery, page, setPage, data, isPending: loading, reload } =
    usePagedMembers(({ query, offset }) => searchMembers({ query, offset }))

  async function run(
    options: ConfirmOptions,
    action: () => Promise<{ success: boolean; message?: string }>,
  ) {
    if (!(await confirm(options))) return
    onError('')
    startTransition(async () => {
      const r = await action()
      if (r.success) { reload(); router.refresh() }
      else onError(r.message ?? 'Something went wrong.')
    })
  }

  return (
    <div className="space-y-3">
      <MemberSearchBox value={query} onChange={setQuery} pending={loading}
        placeholder="Filter members by name or email…" />

      {data.rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {query ? 'No members match that filter.' : 'No members with accounts in this family yet.'}
        </p>
      ) : (
        <MemberTable rows={data.rows} templates={templates} rights={rights}
          busy={isPending} run={run} />
      )}

      <Pager page={page} total={data.total} onPage={setPage} />
    </div>
  )
}

/**
 * The members table.
 *
 * A real <table>, not a flex list dressed as one: these are six parallel facts about
 * each member, and a table is the element that says so — a screen reader announces the
 * column when it reads the cell, which is the whole difference between "512 555 0134"
 * and "Phone: 512 555 0134".
 *
 * BELOW `sm` THE MIDDLE FOUR COLUMNS FOLD AWAY and are restated under the name, leaving
 * Name and the row menu. This used to be a `min-w-[52rem]` table scrolling inside its own
 * container — the note here said the alternative was maintaining two renderings of the
 * row, and it is not: the cells are the same cells, hidden by a media query, with a small
 * block beside them that only renders where they do not. Sideways scrolling cost more
 * than the duplication would have. It hid the row menu, which is the entire point of this
 * table, behind a drag; and the header row scrolled away with the columns it named.
 *
 * Member Directory folds the same four, so the two lists still match column for column at
 * every width.
 */
function MemberTable({ rows, templates, rights, busy, run }: {
  rows: MemberSummary[]
  templates: TemplateSummary[]
  rights: Rights
  busy: boolean
  run: (o: ConfirmOptions, a: () => Promise<{ success: boolean; message?: string }>) => void
}) {
  // `overflow-visible`, not the `overflow-x-auto` that was here: an ancestor with
  // `overflow-x: auto` computes its `overflow-y` to `auto` as well, which is what forced
  // RowMenu to portal its panel to the body in the first place. With the scroll gone
  // there is nothing left to clip, and nothing here should acquire a new clipping
  // ancestor.
  return (
    <div className="overflow-visible rounded-xl border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-3 py-2 font-semibold">Name</th>
            <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Phone</th>
            <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Email</th>
            <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>City, State</th>
            <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Group</th>
            {/* The menu column has no heading to give. An empty <th> would be announced
                as a blank column header, so the label is present and hidden. */}
            <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(member => (
            <MemberRow key={member.personId} member={member} templates={templates}
              rights={rights} busy={busy} run={run} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MemberRow({ member, templates, rights, busy, run }: {
  member: MemberSummary
  templates: TemplateSummary[]
  rights: Rights
  busy: boolean
  run: (o: ConfirmOptions, a: () => Promise<{ success: boolean; message?: string }>) => void
}) {
  const badge = STATUS_BADGE[member.status]
  const disabled = member.status === 'disabled'

  return (
    <tr className="border-b last:border-0 align-top sm:align-middle">
      {/* Name carries the status, because that is what the badge qualifies — a
          struck-through name with the badge in another column reads as two facts. */}
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('font-medium', disabled && 'text-muted-foreground line-through')}>
            {member.name}
          </span>
          {badge && (
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', badge.className)}>
              {badge.label}
            </span>
          )}
        </div>
        {/* The folded columns, below sm only — stacked rather than run inline, because
            this is a contact block and Member Directory renders the identical one. The
            template is always shown: it is what this page is FOR, so unlike a missing
            phone number it is never omitted, and "No template" is a real answer. */}
        <RowMeta className="flex-col items-start gap-y-0.5">
          <MetaIf value={formatPhone(member.phone) || null} />
          {member.email && <span className="break-all">{member.email}</span>}
          <MetaIf value={member.location} />
          <span className="mt-0.5 inline-block whitespace-nowrap rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-on-soft">
            {member.templateName ?? 'No template'}
          </span>
        </RowMeta>
      </td>
      <td className={cn('px-3 py-2.5 text-muted-foreground whitespace-nowrap', COLLAPSING_CELL)}>{formatPhone(member.phone) || '—'}</td>
      <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>{member.email ?? '—'}</td>
      <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>{member.location ?? '—'}</td>
      <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>
        <span className="inline-block whitespace-nowrap rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-on-soft">
          {member.templateName ?? 'No template'}
        </span>
      </td>
      <td className="w-10 px-3 py-2.5 text-right">
      <RowMenu label={`Actions for ${member.name}`} disabled={!rights.edit || busy}>
        {close => (
          <>
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Apply permissions template
            </p>
            {templates.length === 0 && (
              <p className="px-3 pb-2 text-xs text-muted-foreground">No templates yet.</p>
            )}
            {templates.map(t => {
              const current = t.id === member.templateId
              return (
                <button key={t.id} type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-brand-soft"
                  onClick={() => {
                    close()
                    if (current) return
                    run({
                      title: 'Apply permissions template',
                      description:
                        `Put ${member.name} on "${t.name}"? Their access becomes exactly what that ` +
                        `template grants${member.templateName ? `, replacing "${member.templateName}"` : ''}.`,
                      confirmLabel: 'Apply template',
                      destructive: !t.grantsAdmin && Boolean(member.templateId),
                    }, () => applyTemplate(member.personId, t.id))
                  }}>
                  <Check className={cn('h-3.5 w-3.5 shrink-0', current ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  {t.grantsAdmin && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </button>
              )
            })}

            <div className="my-1 border-t" />

            {member.status === 'pending' ? (
              <Link href="/admin/users?tab=approvals" onClick={close}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-brand-soft">
                <UserCheck className="h-3.5 w-3.5 shrink-0" />
                Review in Pending Approval
              </Link>
            ) : member.isSelf ? (
              <p className="px-3 py-1.5 text-xs text-muted-foreground">
                You cannot disable your own access.
              </p>
            ) : (
              <button type="button"
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-brand-soft',
                  !disabled && 'text-destructive',
                )}
                onClick={() => {
                  close()
                  run(disabled ? {
                    title: 'Enable member',
                    description: `Switch ${member.name}'s access back on? They regain everything their template grants.`,
                    confirmLabel: 'Enable',
                  } : {
                    title: 'Disable member',
                    description:
                      `Switch off ${member.name}'s access? They keep their account and their profile, ` +
                      'but can see nothing in this family until you switch it back on.',
                    confirmLabel: 'Disable',
                    destructive: true,
                  }, () => setMemberEnabled(member.personId, disabled))
                }}>
                {disabled
                  ? <><UserCheck className="h-3.5 w-3.5 shrink-0" /> Enable member</>
                  : <><Ban className="h-3.5 w-3.5 shrink-0" /> Disable member</>}
              </button>
            )}
          </>
        )}
      </RowMenu>
      </td>
    </tr>
  )
}

/**
 * The row overflow menu.
 *
 * Hand-rolled rather than pulled from a library because the project's ui/ primitives
 * are plain elements and one more dependency for a popover is not worth it. What it
 * still owes: closing on outside click and on Escape, and returning focus to the
 * trigger, or a keyboard user is stranded inside it.
 *
 * A DISCLOSURE, NOT AN ARIA MENU, deliberately. `role="menu"` is a promise about
 * keyboard behaviour — arrow keys move a roving focus between items, Home/End jump to
 * the ends, Tab leaves the whole widget — and a screen reader announces it as such and
 * changes its own key handling to match. This implements none of that, so claiming the
 * role would leave those users pressing arrow keys at something that does not respond.
 * As a plain expanding panel of buttons and links, Tab works, which is true of what is
 * actually here.
 *
 * THE PANEL IS PORTALLED TO document.body, and that is not decoration. The members table
 * scrolls horizontally inside its own container, and a container with `overflow-x: auto`
 * has `overflow-y: visible` computed to `auto` — so an absolutely positioned panel inside
 * it is clipped at the row, which is how this menu became unusable the moment the list
 * became a table. Rendering into the body with `position: fixed`, anchored to the
 * trigger's measured rect, takes it out of every ancestor's overflow.
 */
function RowMenu({ label, disabled, children }: {
  label: string
  disabled?: boolean
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  // Measured on open rather than tracked continuously: the panel closes on the first
  // scroll or resize (below), so a stale rect can never be shown.
  const [rect, setRect] = useState<{ top: number; right: number } | null>(null)
  const panelId = useId()
  const wrap = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  // Ref-free on purpose. `children` is a render prop, so anything handed to it is
  // traced into the render pass — a close() that read trigger.current would count as
  // dereferencing a ref during render. Returning focus to the trigger therefore lives
  // in the Escape handler below, inside an effect, where reading a ref is fine.
  //
  // Nothing is lost on the activation path: every item here opens a confirmation
  // dialog, which takes focus itself and owns restoring it.
  const close = useCallback(() => setOpen(false), [])

  // Closes itself a few seconds after the pointer and focus have both left it — the same
  // hook the three header panels use, so every dropdown in the app goes on the same beat.
  // `parts` looks the portalled panel up by id for the reason the outside-click handler
  // below does: it is not inside `wrap`, so there is no single subtree to test.
  useDismissWhenIdle({
    open,
    close,
    parts: () => [wrap.current, document.getElementById(panelId)],
  })

  useEffect(() => {
    if (!open) return
    // The panel lives outside `wrap` now, so an outside-click test against `wrap` alone
    // would treat every click INSIDE the panel as outside and close it before the button
    // fired. Both subtrees count as inside.
    function onPointer(e: MouseEvent) {
      const target = e.target as Node
      if (wrap.current?.contains(target)) return
      if (document.getElementById(panelId)?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    // A fixed panel does not travel with the page. Closing is the honest response to
    // either — cheaper than re-measuring on every frame, and it is what a menu whose
    // anchor has moved should do anyway. Capture, so a scroll inside the table's own
    // overflow container counts and not just one on the window.
    function onMove() { setOpen(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    document.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, panelId])

  function toggle() {
    if (open) { setOpen(false); return }
    const r = trigger.current?.getBoundingClientRect()
    // Right-aligned to the trigger, which is what the absolute version did with
    // `right-0`. Kept in viewport coordinates because the panel is position: fixed.
    if (r) setRect({ top: r.bottom + 4, right: window.innerWidth - r.right })
    setOpen(true)
  }

  const expanded: 'true' | 'false' = open ? 'true' : 'false'

  return (
    <div ref={wrap} className="relative shrink-0">
      <button ref={trigger} type="button" disabled={disabled}
        onClick={toggle}
        aria-expanded={expanded} aria-controls={panelId} aria-label={label}
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40">
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && rect && createPortal(
        <div id={panelId} aria-label={label}
          style={{ top: rect.top, right: rect.right }}
          className="fixed z-50 w-64 overflow-hidden rounded-xl border bg-card py-1 shadow-lg">
          {children(close)}
        </div>,
        document.body,
      )}
    </div>
  )
}

// ── Templates ───────────────────────────────────────────────────────────────

function TemplatesTab({
  templates, resources, selectedTemplateId, policy, rights, onError, onSelect,
}: {
  templates: TemplateSummary[]
  resources: ResourceSummary[]
  selectedTemplateId: string | null
  policy: PolicyMap
  rights: Rights
  onError: (m: string) => void
  onSelect: (id: string) => void
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  /**
   * Which template the new one starts from, or '' for a blank grid.
   *
   * Offered only to a caller who also holds `edit` on this key, because that is what
   * the action demands of a copy — see createTemplate. Showing the choice to someone
   * who may only create would be a control that refuses every time it is used.
   */
  const [copyFrom, setCopyFrom] = useState('')
  /**
   * Resolved against the LIVE list rather than trusted as held, so every control below
   * reads from one value. Deleting the template the form is pointing at is the case
   * that matters: a `router.refresh()` deliberately merges the new server payload
   * without discarding client state, so `copyFrom` would go on naming a row that no
   * longer exists — the radio saying "A copy of…", the sentence beneath it saying
   * nothing is allowed, and Create sending an id the action can only refuse.
   */
  const copySource = templates.find(t => t.id === copyFrom) ?? null
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const selected = templates.find(t => t.id === selectedTemplateId) ?? null
  const sections = groupResources(resources)

  // `confirmWith` is required rather than optional: every caller has to state what it
  // is asking the user, or pass an explicit null to opt out (creates only).
  async function run(
    confirmWith: ConfirmOptions | null,
    action: () => Promise<{ success: boolean; message?: string }>,
    after?: () => void,
  ) {
    if (confirmWith && !(await confirm(confirmWith))) return
    onError('')
    startTransition(async () => {
      const result = await action()
      if (result.success) { after?.(); router.refresh() }
      else onError(result.message ?? 'Something went wrong.')
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      {/* ── Template list ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          {/* THE ONE PLACED HELP LINK ON THIS SCREEN, and it is on this tab rather than on
              Members or Pending Approval because this is the tab where a reader can be
              confidently wrong. A grid of switches looks self-explanatory and is not: what
              a scope of 'own' means, why a row shows two actions and not four, and that a
              member has exactly ONE template with nothing layered over it are all facts the
              screen assumes. `members-and-access#templates` states them.

              An icon, not the inline variant: this is a column heading with a create button
              on the other end of it, and words here would out-weigh both.

              The top bar's icon already points at this chapter as a whole from every tab,
              so this is the section-level shortcut and not a duplicate of it — see
              components/help/HelpLink.tsx on why there is not one of these per pane. */}
          {/* A `div`, not a `span`: an `h2` is flow content and a `span` is phrasing, so a
              span wrapping it is invalid even though every browser renders it. */}
          <div className="flex min-w-0 items-center gap-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Templates
            </h2>
            <HelpLink
              slug="members-and-access"
              section="templates"
              label="Help: Permission templates"
              className="size-6"
            />
          </div>
          {rights.create && (
            <button type="button" onClick={() => setCreating(c => !c)}
              className="rounded-lg p-1 hover:bg-muted" aria-label="New template">
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>

        {creating && (
          <div className="space-y-2 rounded-xl border bg-card p-3">
            <div className="space-y-1">
              <Label htmlFor="new-template-name">Name</Label>
              <Input id="new-template-name" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Reunion Committee" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-template-desc">Description</Label>
              <Input id="new-template-desc" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="Optional" />
            </div>

            {/* A real <fieldset>/<legend> radio group rather than a styled div: the
                legend is what makes a screen reader announce "Start from" before each
                option, and native radios bring arrow-key selection with them. Same
                reasoning as MainRail refusing role="tablist" — claim only what is
                implemented, and here the platform implements all of it. */}
            {rights.edit && templates.length > 0 && (
              <fieldset className="space-y-1">
                <legend className="text-sm leading-none font-medium">Start from</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="new-template-start" className="accent-brand-primary"
                    checked={!copySource} onChange={() => setCopyFrom('')} />
                  Blank
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="new-template-start" className="accent-brand-primary"
                    checked={!!copySource}
                    onChange={() => setCopyFrom(templates[0].id)} />
                  A copy of…
                </label>
                {copySource && (
                  <Select className="mt-1" aria-label="Template to copy"
                    value={copySource.id} onChange={e => setCopyFrom(e.target.value)}>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                )}
              </fieldset>
            )}

            <p className="text-xs text-muted-foreground">
              {copySource
                ? `The new template starts with exactly what ${copySource.name} grants today. It is a copy, not a link — changing one afterwards leaves the other alone.`
                : 'A new template starts with nothing allowed. Set what it grants, then apply it to members.'}
            </p>
            <div className="flex gap-2">
              <Button size="sm" disabled={isPending || !newName.trim()}
                onClick={() => run(null, () => createTemplate(newName, newDesc, copySource?.id ?? null),
                  () => { setNewName(''); setNewDesc(''); setCopyFrom(''); setCreating(false) })}>
                Create
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <ul className="space-y-1">
          {templates.map(t => (
            <li key={t.id}>
              {editingId === t.id ? (
                <div className="space-y-2 rounded-xl border bg-card p-3">
                  <Input value={editName} onChange={e => setEditName(e.target.value)} aria-label="Template name" />
                  <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={isPending}
                      onClick={() => run({
                        title: 'Save template',
                        description: editName.trim() && editName.trim() !== t.name
                          ? `Rename "${t.name}" to "${editName.trim()}" and save its description?`
                          : `Save your changes to "${t.name}"?`,
                        confirmLabel: 'Save changes',
                      }, () => renameTemplate(t.id, editName, editDesc), () => setEditingId(null))}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                  t.id === selectedTemplateId
                    ? 'bg-brand-primary text-brand-on-primary'
                    : 'bg-brand-soft text-brand-on-soft hover:opacity-90',
                )}>
                  <button type="button" onClick={() => onSelect(t.id)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-1.5 font-medium">
                      {t.isSystem && <ShieldCheck className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                      <span className="truncate">{t.name}</span>
                    </span>
                    <span className={cn('text-xs', t.id === selectedTemplateId ? 'opacity-70' : 'text-muted-foreground')}>
                      {t.memberCount} member{t.memberCount === 1 ? '' : 's'}
                    </span>
                  </button>
                  {rights.edit && (
                    <span className="flex shrink-0 items-center gap-0.5">
                      <button type="button" aria-label={`Rename ${t.name}`} className="rounded p-1 hover:bg-foreground/10"
                        onClick={() => { setEditingId(t.id); setEditName(t.name); setEditDesc(t.description ?? '') }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!t.isSystem && rights.remove && (
                        <button type="button" aria-label={`Delete ${t.name}`} disabled={isPending}
                          className="rounded p-1 hover:bg-foreground/10" onClick={() => run({
                            title: 'Delete template',
                            description: t.memberCount > 0
                              ? `"${t.name}" still has ${t.memberCount} member${t.memberCount === 1 ? '' : 's'}. Move them to another template first.`
                              : `Delete "${t.name}"? This cannot be undone.`,
                            confirmLabel: 'Delete template',
                            destructive: true,
                          }, () => deleteTemplate(t.id))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* ── The grid ─────────────────────────────────────────────────── */}
      <div className="min-w-0">
        {selected ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {selected.isSystem && <ShieldCheck className="h-4 w-4 text-muted-foreground" />}
                {selected.name}
              </CardTitle>
              <CardDescription>
                {selected.description || 'What members on this template may do.'}
                {' '}Changes apply immediately to all {selected.memberCount} member
                {selected.memberCount === 1 ? '' : 's'} on it. Only features that have shipped
                are listed, and each row shows only the actions that mean something for it.
              </CardDescription>
            </CardHeader>
            {/* THIS GRID FOLDS TOO, and it is the one that looked like it could not.
                A permission matrix has no subordinate columns — the four actions ARE
                the content — so the argument for folding it is not width, it is that
                `min-w-[34rem]` in an `overflow-x-auto` box scrolled the FEATURE column
                out of view. On a narrow screen you ended up looking at four unlabelled
                switch groups with no indication of which row you were about to change,
                on the one screen in the app where changing the wrong row hands somebody
                authority they should not have.

                So below `sm` each action becomes a labelled line under the feature name.
                It is taller, and that is the correct trade: this is a screen an
                administrator visits to make one deliberate change, not a list they
                scan. The same buttons are rendered in both layouts — one is always
                `display: none`, so only one is ever focusable — rather than a second
                implementation that could drift from the first. */}
            <CardContent className="overflow-visible">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    {/* Not "Page": the rows under Accounting > Transactions are
                        capabilities — the add buttons on the Transactions page — and
                        have no route of their own. */}
                    <th className="py-2 pr-4 font-medium">Feature</th>
                    {ACTIONS.map(a => (
                      <th key={a} className={cn('py-2 pr-3 font-medium capitalize', COLLAPSING_CELL)}>{a}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sections.map(({ category, label, rows }) => (
                    <Fragment key={category}>
                      <tr>
                        <td colSpan={5} className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {label}
                        </td>
                      </tr>
                      {rows.map(({ resource: r, header, nested }) => {
                        // One definition, rendered into the action column at `sm` and up
                        // and into the stacked line below it.
                        const scopeButtons = (action: typeof ACTIONS[number]) => {
                          const current = policy[`${r.key}:${action}`] ?? 'none'
                          return scopesFor(r, action).map(scope => (
                            <button key={scope} type="button" disabled={!rights.edit || isPending}
                              onClick={() => run({
                                title: 'Change what this template grants',
                                description:
                                  `Set "${selected.name}" to ${action} ${SCOPE_LABEL[scope]}` +
                                  `${scope === 'none' ? ' (not allowed)' : ''} on ${r.label}? ` +
                                  `This applies to all ${selected.memberCount} member` +
                                  `${selected.memberCount === 1 ? '' : 's'} on the template.`,
                                confirmLabel: 'Change',
                                destructive: scope === 'none',
                              }, () => setTemplatePermission(selected.id, r.key, action, scope))}
                              title={`${r.label} · ${action} · ${SCOPE_LABEL[scope]}`}
                              className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-60',
                                current === scope ? SCOPE_STYLE[scope] : 'text-muted-foreground hover:bg-muted')}>
                              {SCOPE_LABEL[scope]}
                            </button>
                          ))
                        }
                        return (
                        <Fragment key={r.key}>
                          {header && (
                            <tr>
                              <td colSpan={5} className="pt-3 pb-1 pl-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                └ {header}
                              </td>
                            </tr>
                          )}
                          <tr className="border-b align-top last:border-0 sm:align-middle">
                            <td className={cn('py-1.5 pr-4', nested && 'pl-8')}>
                              {r.label}
                              {/* Not a `RowMeta`: that renders one inline run of values,
                                  and these are four labelled groups of controls. Same
                                  `sm:hidden` contract, different shape. */}
                              <div className="mt-1.5 space-y-1 sm:hidden">
                                {ACTIONS.map(action => {
                                  const buttons = scopeButtons(action)
                                  // A resource declares only the actions something reads
                                  // (AGENTS.md), so most rows have fewer than four. An
                                  // empty label is a switch that does nothing.
                                  if (buttons.length === 0) return null
                                  return (
                                    <div key={action} className="flex items-center gap-2">
                                      <span className="w-12 shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                                        {action}
                                      </span>
                                      <div className="flex gap-0.5">{buttons}</div>
                                    </div>
                                  )
                                })}
                              </div>
                            </td>
                            {ACTIONS.map(action => (
                              <td key={action} className={cn('py-1.5 pr-3', COLLAPSING_CELL)}>
                                <div className="flex gap-0.5">{scopeButtons(action)}</div>
                              </td>
                            ))}
                          </tr>
                        </Fragment>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 text-xs text-muted-foreground">
                <span className="font-medium">All</span> = every record in the family ·
                {' '}<span className="font-medium">Own</span> = only records this member created or belongs to ·
                {' '}<span className="font-medium">—</span> = not allowed
              </p>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">Select a template to edit what it grants.</p>
        )}
      </div>
    </div>
  )
}
