'use client'

import { Fragment, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Plus, Trash2, Pencil, Eye, EyeOff, ShieldCheck, UserPlus, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConfirm, type ConfirmOptions } from '@/components/ui/confirm'
import { cn } from '@/lib/utils'
import {
  createGroup, renameGroup, deleteGroup, setGroupMembership,
  setGroupPermission, setResourceVisibility,
  getGroupMembers, searchCandidatesForGroup,
  type GroupSummary, type ResourceSummary, type PolicyMap, type MemberSummary,
} from '@/app/actions/admin/permissions'
import { usePagedMembers, MemberSearchBox, Pager } from '@/components/admin/MemberSearch'
import type { PermissionAction, PermissionScope } from '@/lib/auth/permissions'

const ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete']

// 'create' has no own/any distinction — you cannot own a record you are about to
// make — so it offers a plain allow/deny.
const SCOPES_FOR: Record<PermissionAction, PermissionScope[]> = {
  view:   ['none', 'own', 'any'],
  create: ['none', 'any'],
  edit:   ['none', 'own', 'any'],
  delete: ['none', 'own', 'any'],
}
const SCOPE_LABEL: Record<PermissionScope, string> = { none: '—', own: 'Own', any: 'All' }
const SCOPE_STYLE: Record<PermissionScope, string> = {
  none: 'bg-muted text-muted-foreground',
  own:  'bg-amber-100 text-amber-800',
  any:  'bg-green-100 text-green-800',
}

// Presentation order for the visibility list; anything unlisted falls to the end.
const CATEGORY_ORDER = ['general', 'personal', 'community', 'events', 'accounting', 'resources', 'admin']
const CATEGORY_LABEL: Record<string, string> = {
  general: 'General', personal: 'Personal', community: 'Community', events: 'Events',
  accounting: 'Accounting', resources: 'Resources', admin: 'Administration',
}

interface Rights { view: boolean; create: boolean; edit: boolean; remove: boolean }

interface Props {
  groups: GroupSummary[]
  resources: ResourceSummary[]
  selectedGroupId: string | null
  policy: PolicyMap
  rights: Rights
  legacy: boolean
}

function byCategory(resources: ResourceSummary[]) {
  const groups = new Map<string, ResourceSummary[]>()
  for (const r of resources) groups.set(r.category, [...(groups.get(r.category) ?? []), r])
  return [...groups.entries()]
    .sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a[0]); const bi = CATEGORY_ORDER.indexOf(b[0])
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
    .map(([category, list]) => ({
      category,
      label: CATEGORY_LABEL[category] ?? category,
      list: [...list].sort((a, b) => a.label.localeCompare(b.label)),
    }))
}

export function AdminGroupsClient({ groups, resources, selectedGroupId, policy, rights, legacy }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<'policy' | 'members' | 'pages'>('policy')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const selected = groups.find(g => g.id === selectedGroupId) ?? null
  const sections = byCategory(resources)

  // `confirmWith` is required rather than optional: every caller has to state
  // what it is asking the user, or pass an explicit null to opt out (creates only).
  async function run(
    confirmWith: ConfirmOptions | null,
    action: () => Promise<{ success: boolean; message?: string }>,
    after?: () => void,
  ) {
    if (confirmWith && !(await confirm(confirmWith))) return
    setError('')
    startTransition(async () => {
      const result = await action()
      if (result.success) { after?.(); router.refresh() }
      else setError(result.message ?? 'Something went wrong.')
    })
  }

  return (
    <div className="space-y-6">
      {legacy && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-medium">Permission tables not found.</span> Run migration
          {' '}<code>20260618000000_permissions_foundation.sql</code>. Until then access falls back
          to the old <code>is_admin</code> flag and nothing changed here takes effect.
        </div>
      )}

      {!rights.edit && (
        <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          You can view this page but not change anything.
        </div>
      )}

      {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        {/* ── Group list ───────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Groups</h2>
            {rights.create && (
              <button type="button" onClick={() => setCreating(c => !c)} className="rounded-lg p-1 hover:bg-muted" aria-label="New group">
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>

          {creating && (
            <div className="space-y-2 rounded-xl border bg-card p-3">
              <div className="space-y-1">
                <Label htmlFor="new-group-name">Name</Label>
                <Input id="new-group-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Reunion Committee" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-group-desc">Description</Label>
                <Input id="new-group-desc" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={isPending || !newName.trim()}
                  onClick={() => run(null, () => createGroup(newName, newDesc),
                    () => { setNewName(''); setNewDesc(''); setCreating(false) })}>
                  Create
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <ul className="space-y-1">
            {groups.map(g => (
              <li key={g.id}>
                {editingId === g.id ? (
                  <div className="space-y-2 rounded-xl border bg-card p-3">
                    <Input value={editName} onChange={e => setEditName(e.target.value)} />
                    <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={isPending}
                        onClick={() => run({
                          title: 'Save group',
                          description: editName.trim() && editName.trim() !== g.name
                            ? `Rename "${g.name}" to "${editName.trim()}" and save its description?`
                            : `Save your changes to "${g.name}"?`,
                          confirmLabel: 'Save changes',
                        }, () => renameGroup(g.id, editName, editDesc), () => setEditingId(null))}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                    g.id === selectedGroupId ? 'bg-[#0f2540] text-[#e6ecfa]' : 'bg-[#e6ecfa] text-[#0f2540] hover:opacity-90',
                  )}>
                    <button type="button" onClick={() => router.push(`/admin/groups?group=${g.id}`)} className="min-w-0 flex-1 text-left">
                      <span className="flex items-center gap-1.5 font-medium">
                        {g.isSystem && <ShieldCheck className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                        <span className="truncate">{g.name}</span>
                      </span>
                      <span className={cn('text-xs', g.id === selectedGroupId ? 'opacity-70' : 'text-muted-foreground')}>
                        {g.memberCount} member{g.memberCount === 1 ? '' : 's'}
                      </span>
                    </button>
                    {rights.edit && (
                      <span className="flex shrink-0 items-center gap-0.5">
                        <button type="button" aria-label={`Rename ${g.name}`} className="rounded p-1 hover:bg-black/10"
                          onClick={() => { setEditingId(g.id); setEditName(g.name); setEditDesc(g.description ?? '') }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {!g.isSystem && rights.remove && (
                          <button type="button" aria-label={`Delete ${g.name}`} disabled={isPending}
                            className="rounded p-1 hover:bg-black/10" onClick={() => run({
                              title: 'Delete group',
                              description: `Delete "${g.name}"? Its ${g.memberCount} member${g.memberCount === 1 ? '' : 's'} lose every permission the group grants. This cannot be undone.`,
                              confirmLabel: 'Delete group',
                              destructive: true,
                            }, () => deleteGroup(g.id))}>
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

        {/* ── Detail ───────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-1 border-b">
            {([['policy', 'What this group can do'], ['members', 'Members'], ['pages', 'Page visibility']] as const).map(([t, label]) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={cn('px-3 py-2 text-sm transition-colors',
                  tab === t ? 'border-b-2 border-[#0f2540] font-medium text-[#0f2540]' : 'text-muted-foreground hover:text-foreground')}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'policy' && (selected ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{selected.name}</CardTitle>
                <CardDescription>
                  {selected.description || 'What members of this group may do on each page.'}
                  {' '}A group&apos;s policy overrides any individual override on the same page and action.
                  {' '}Only pages that have shipped are listed.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Page</th>
                      {ACTIONS.map(a => <th key={a} className="py-2 pr-3 font-medium capitalize">{a}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map(({ category, label, list }) => (
                      <Fragment key={category}>
                        <tr>
                          <td colSpan={5} className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {label}
                          </td>
                        </tr>
                        {list.map(r => (
                          <tr key={r.key} className="border-b last:border-0">
                            <td className="py-1.5 pr-4">{r.label}</td>
                            {ACTIONS.map(action => {
                              const current = policy[`${r.key}:${action}`] ?? 'none'
                              return (
                                <td key={action} className="py-1.5 pr-3">
                                  <div className="flex gap-0.5">
                                    {SCOPES_FOR[action].map(scope => (
                                      <button key={scope} type="button" disabled={!rights.edit || isPending}
                                        onClick={() => run({
                                          title: 'Change group permission',
                                          description: `Set "${selected.name}" to ${action} ${SCOPE_LABEL[scope]}${scope === 'none' ? ' (not allowed)' : ''} on ${r.label}? This applies to every member of the group.`,
                                          confirmLabel: 'Change',
                                          destructive: scope === 'none',
                                        }, () => setGroupPermission(selected.id, r.key, action, scope))}
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
          ) : <p className="text-sm text-muted-foreground">Select a group to edit its policy.</p>)}

          {tab === 'members' && (selected
            ? <GroupMembers group={selected} rights={rights} onError={setError} />
            : <p className="text-sm text-muted-foreground">Select a group to manage its members.</p>)}

          {tab === 'pages' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Page visibility</CardTitle>
                <CardDescription>
                  <span className="font-medium">Everyone</span> — any member of the family can open the page.
                  {' '}<span className="font-medium">Selected groups</span> — only those granted view access by a
                  group policy or an individual override.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {sections.map(({ category, label, list }) => (
                  <div key={category}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                    <ul className="divide-y rounded-xl border">
                      {list.map(r => (
                        <li key={r.key} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="min-w-0 flex-1 truncate text-sm">{r.label}</span>
                          <span className="flex shrink-0 gap-1">
                            {(['everyone', 'restricted'] as const).map(v => (
                              <button key={v} type="button" disabled={!rights.edit || isPending}
                                onClick={() => run({
                                  title: 'Change page visibility',
                                  description: v === 'everyone'
                                    ? `Open ${r.label} to everyone in the family?`
                                    : `Restrict ${r.label} to groups that have been granted view access? Members without that access will no longer see the page.`,
                                  confirmLabel: 'Change visibility',
                                  destructive: v === 'restricted',
                                }, () => setResourceVisibility(r.key, v))}
                                className={cn('flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60',
                                  r.visibility === v
                                    ? v === 'everyone' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                    : 'border text-muted-foreground hover:bg-muted')}>
                                {v === 'everyone' ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                {v === 'everyone' ? 'Everyone' : 'Selected groups'}
                              </button>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * A group's roster: who is in it (paged and searchable) plus a type-ahead to add
 * someone. Only ever holds one page, so it behaves the same for a group of 5 and
 * a group of 500.
 */
function GroupMembers({ group, rights, onError }: {
  group: GroupSummary
  rights: Rights
  onError: (m: string) => void
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()
  const { query, setQuery, page, setPage, data, isPending: loading, reload } =
    usePagedMembers(({ query, offset }) => getGroupMembers(group.id, { query, offset }), [group.id])

  async function mutate(
    confirmWith: ConfirmOptions,
    action: () => Promise<{ success: boolean; message?: string }>,
  ) {
    if (!(await confirm(confirmWith))) return
    onError('')
    startTransition(async () => {
      const r = await action()
      if (r.success) { reload(); router.refresh() }
      else onError(r.message ?? 'Something went wrong.')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" /> Members of {group.name}
        </CardTitle>
        <CardDescription>{group.memberCount} member{group.memberCount === 1 ? '' : 's'} in this group.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rights.edit && (
          <AddMember groupId={group.id} groupName={group.name} onAdded={() => { reload(); router.refresh() }} onError={onError} />
        )}

        <div className="space-y-2">
          <MemberSearchBox value={query} onChange={setQuery} pending={loading}
            placeholder="Search members of this group…" />

          {data.rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {query ? 'No members match that search.' : 'This group has no members yet.'}
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {data.rows.map(m => (
                <li key={m.personId} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    {m.email && <p className="truncate text-xs text-muted-foreground">{m.email}</p>}
                  </div>
                  {rights.remove && (
                    <button type="button" disabled={isPending}
                      onClick={() => mutate({
                        title: 'Remove from group',
                        description: `Remove ${m.name} from "${group.name}"? They lose the access this group grants.`,
                        confirmLabel: 'Remove',
                        destructive: true,
                      }, () => setGroupMembership(group.id, m.personId, false))}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
                      aria-label={`Remove ${m.name} from ${group.name}`}
                      title={`Remove ${m.name} from ${group.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <Pager page={page} total={data.total} onPage={setPage} />
        </div>
      </CardContent>
    </Card>
  )
}

/** Type-ahead over members not already in the group. */
function AddMember({ groupId, groupName, onAdded, onError }: {
  groupId: string
  groupName: string
  onAdded: () => void
  onError: (m: string) => void
}) {
  const confirm = useConfirm()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<MemberSummary[]>([])
  // The term the results correspond to. Derived rather than a `searching` flag so
  // nothing has to setState synchronously inside the effect.
  const [settledTerm, setSettledTerm] = useState('')
  const [isPending, startTransition] = useTransition()
  const reqId = useRef(0)

  const trimmed = term.trim()
  const searching = trimmed !== '' && trimmed !== settledTerm

  useEffect(() => {
    const id = ++reqId.current
    const t = setTimeout(async () => {
      const found = trimmed ? await searchCandidatesForGroup(groupId, trimmed) : []
      if (id !== reqId.current) return   // a newer keystroke already superseded this
      setResults(found)
      setSettledTerm(trimmed)
    }, 250)
    return () => clearTimeout(t)
  }, [trimmed, groupId])

  async function add(personId: string) {
    const name = results.find(m => m.personId === personId)?.name ?? 'this member'
    const ok = await confirm({
      title: 'Add to group',
      description: `Add ${name} to "${groupName}"? They gain everything the group grants.`,
      confirmLabel: 'Add',
    })
    if (!ok) return
    onError('')
    startTransition(async () => {
      const r = await setGroupMembership(groupId, personId, true)
      if (r.success) { setTerm(''); setResults([]); setSettledTerm(''); onAdded() }
      else onError(r.message ?? 'Could not add the member.')
    })
  }

  return (
    <div className="rounded-xl border border-dashed bg-muted/30 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <UserPlus className="h-3.5 w-3.5" /> Add a member
      </p>
      <MemberSearchBox value={term} onChange={setTerm} pending={searching}
        placeholder="Search by name or email…" />

      {term.trim() && !searching && results.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          No matching members outside this group.
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-2 divide-y overflow-hidden rounded-lg border bg-card">
          {results.map(m => (
            <li key={m.personId}>
              <button type="button" disabled={isPending} onClick={() => add(m.personId)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[#e6ecfa] disabled:opacity-60">
                {isPending ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 flex-1 truncate">
                  {m.name}
                  {m.email && <span className="ml-1.5 text-xs text-muted-foreground">{m.email}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
