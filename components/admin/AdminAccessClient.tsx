'use client'

import { Fragment, useCallback, useEffect, useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  MoreVertical, Plus, Trash2, Pencil, ShieldCheck, Check, Ban, UserCheck,
  Users, KeyRound,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConfirm, type ConfirmOptions } from '@/components/ui/confirm'
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

/**
 * Members & Access — one screen for what used to be two.
 *
 * The old pair could not be merged while a member's access was the union of N group
 * policies layered over a per-person override grid, because no single view could
 * state the answer. One template per member makes the answer a single word on the
 * member's row, and the template's grid the only place it is decided.
 *
 * So: MEMBERS is a filterable list with a row menu, and TEMPLATES is the grid. There
 * is no third thing.
 */

interface Rights { view: boolean; create: boolean; edit: boolean; remove: boolean }

interface Props {
  templates: TemplateSummary[]
  resources: ResourceSummary[]
  tab: 'members' | 'templates'
  selectedTemplateId: string | null
  policy: PolicyMap
  rights: Rights
  legacy: boolean
}

export function AdminAccessClient({
  templates, resources, tab, selectedTemplateId, policy, rights, legacy,
}: Props) {
  const router = useRouter()
  const [error, setError] = useState('')

  function go(next: { tab?: 'members' | 'templates'; template?: string | null }) {
    const t = next.tab ?? tab
    const template = next.template === undefined ? selectedTemplateId : next.template
    const params = new URLSearchParams()
    if (t !== 'members') params.set('tab', t)
    if (t === 'templates' && template) params.set('template', template)
    const qs = params.toString()
    router.push(qs ? `/admin/users?${qs}` : '/admin/users')
  }

  return (
    <div className="space-y-5">
      {legacy && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-medium">Permission tables not found.</span> Run the migrations in
          {' '}<code>supabase/migrations</code>. Until then access falls back to the old
          {' '}<code>is_admin</code> flag and nothing changed here takes effect.
        </div>
      )}

      {!rights.edit && (
        <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          You can view access settings but not change them.
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      <div className="flex flex-wrap gap-1 border-b">
        {([
          ['members', 'Members', Users],
          ['templates', 'Permission templates', KeyRound],
        ] as const).map(([t, label, Icon]) => (
          <button key={t} type="button" onClick={() => go({ tab: t })}
            className={cn('flex items-center gap-1.5 px-3 py-2 text-sm transition-colors',
              tab === t
                ? 'border-b-2 border-[#0f2540] font-medium text-[#0f2540]'
                : 'text-muted-foreground hover:text-foreground')}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'members'
        ? <MembersTab templates={templates} rights={rights} onError={setError} />
        : <TemplatesTab
            templates={templates}
            resources={resources}
            selectedTemplateId={selectedTemplateId}
            policy={policy}
            rights={rights}
            onError={setError}
            onSelect={id => go({ tab: 'templates', template: id })}
          />}
    </div>
  )
}

// ── Members ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; className: string } | null> = {
  approved: null,
  pending:  { label: 'Awaiting approval', className: 'bg-amber-100 text-amber-800' },
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
        <ul className="divide-y overflow-visible rounded-xl border">
          {data.rows.map(member => (
            <MemberRow key={member.personId} member={member} templates={templates}
              rights={rights} busy={isPending} run={run} />
          ))}
        </ul>
      )}

      <Pager page={page} total={data.total} onPage={setPage} />
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
    <li className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', disabled && 'text-muted-foreground line-through')}>
          {member.name}
        </p>
        {member.email && <p className="truncate text-xs text-muted-foreground">{member.email}</p>}
      </div>

      <span className="shrink-0 rounded-full bg-[#e6ecfa] px-2.5 py-1 text-xs font-medium text-[#0f2540]">
        {member.templateName ?? 'No template'}
      </span>

      {badge && (
        <span className={cn('hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-medium sm:inline', badge.className)}>
          {badge.label}
        </span>
      )}

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
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-[#e6ecfa]"
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
              <Link href="/admin/approvals" onClick={close}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-[#e6ecfa]">
                <UserCheck className="h-3.5 w-3.5 shrink-0" />
                Review in Member Approvals
              </Link>
            ) : member.isSelf ? (
              <p className="px-3 py-1.5 text-xs text-muted-foreground">
                You cannot disable your own access.
              </p>
            ) : (
              <button type="button"
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-[#e6ecfa]',
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
    </li>
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
 */
function RowMenu({ label, disabled, children }: {
  label: string
  disabled?: boolean
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
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

  useEffect(() => {
    if (!open) return
    function onPointer(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrap} className="relative shrink-0">
      <button ref={trigger} type="button" disabled={disabled}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open ? 'true' : 'false'} aria-controls={panelId} aria-label={label}
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40">
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div id={panelId} aria-label={label}
          className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-xl border bg-card py-1 shadow-lg">
          {children(close)}
        </div>
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Templates
          </h2>
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
            <p className="text-xs text-muted-foreground">
              A new template starts with nothing allowed. Set what it grants, then apply it
              to members.
            </p>
            <div className="flex gap-2">
              <Button size="sm" disabled={isPending || !newName.trim()}
                onClick={() => run(null, () => createTemplate(newName, newDesc),
                  () => { setNewName(''); setNewDesc(''); setCreating(false) })}>
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
                    ? 'bg-[#0f2540] text-[#e6ecfa]'
                    : 'bg-[#e6ecfa] text-[#0f2540] hover:opacity-90',
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
                      <button type="button" aria-label={`Rename ${t.name}`} className="rounded p-1 hover:bg-black/10"
                        onClick={() => { setEditingId(t.id); setEditName(t.name); setEditDesc(t.description ?? '') }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!t.isSystem && rights.remove && (
                        <button type="button" aria-label={`Delete ${t.name}`} disabled={isPending}
                          className="rounded p-1 hover:bg-black/10" onClick={() => run({
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
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    {/* Not "Page": the rows under Accounting > Transactions are
                        capabilities — the add buttons on the Transactions page — and
                        have no route of their own. */}
                    <th className="py-2 pr-4 font-medium">Feature</th>
                    {ACTIONS.map(a => <th key={a} className="py-2 pr-3 font-medium capitalize">{a}</th>)}
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
                      {rows.map(({ resource: r, header, nested }) => (
                        <Fragment key={r.key}>
                          {header && (
                            <tr>
                              <td colSpan={5} className="pt-3 pb-1 pl-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                └ {header}
                              </td>
                            </tr>
                          )}
                          <tr className="border-b last:border-0">
                            <td className={cn('py-1.5 pr-4', nested && 'pl-8')}>{r.label}</td>
                            {ACTIONS.map(action => {
                              const current = policy[`${r.key}:${action}`] ?? 'none'
                              return (
                                <td key={action} className="py-1.5 pr-3">
                                  <div className="flex gap-0.5">
                                    {scopesFor(r, action).map(scope => (
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
                                    ))}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        </Fragment>
                      ))}
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
