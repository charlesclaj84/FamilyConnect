'use client'

import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ShieldCheck, UserCircle, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfirm, type ConfirmOptions } from '@/components/ui/confirm'
import { cn } from '@/lib/utils'
import {
  setGroupMembership, setPersonPermission, searchMembers,
  type GroupSummary, type ResourceSummary, type PolicyMap,
} from '@/app/actions/admin/permissions'
import { usePagedMembers, MemberSearchBox, Pager } from '@/components/admin/MemberSearch'
import type { PermissionAction, PermissionScope } from '@/lib/auth/permissions'

const ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete']
const SCOPES_FOR: Record<PermissionAction, PermissionScope[]> = {
  view: ['none', 'own', 'any'], create: ['none', 'any'],
  edit: ['none', 'own', 'any'], delete: ['none', 'own', 'any'],
}
const SCOPE_LABEL: Record<PermissionScope, string> = { none: '—', own: 'Own', any: 'All' }
const SCOPE_STYLE: Record<PermissionScope, string> = {
  none: 'bg-muted text-muted-foreground',
  own: 'bg-amber-100 text-amber-800',
  any: 'bg-green-100 text-green-800',
}

const CATEGORY_ORDER = ['general', 'personal', 'community', 'events', 'accounting', 'resources', 'admin']
const CATEGORY_LABEL: Record<string, string> = {
  general: 'General', personal: 'Personal', community: 'Community', events: 'Events',
  accounting: 'Accounting', resources: 'Resources', admin: 'Administration',
}

interface Props {
  groups: GroupSummary[]
  resources: ResourceSummary[]
  expandedPersonId: string | null
  personPolicy: PolicyMap
  groupCoveredKeys: string[]
  rights: { view: boolean; create: boolean; edit: boolean; remove: boolean }
}

export function AdminUserAccessClient({
  groups, resources, expandedPersonId, personPolicy, groupCoveredKeys, rights,
}: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const { query, setQuery, page, setPage, data, isPending: loading, reload } =
    usePagedMembers(({ query, offset }) => searchMembers({ query, offset }))

  const covered = new Set(groupCoveredKeys)

  const sections = (() => {
    const map = new Map<string, ResourceSummary[]>()
    for (const r of resources) map.set(r.category, [...(map.get(r.category) ?? []), r])
    return [...map.entries()]
      .sort((a, b) => {
        const ai = CATEGORY_ORDER.indexOf(a[0]); const bi = CATEGORY_ORDER.indexOf(b[0])
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      .map(([category, list]) => ({
        category,
        label: CATEGORY_LABEL[category] ?? category,
        list: [...list].sort((a, b) => a.label.localeCompare(b.label)),
      }))
  })()

  // Every control here edits someone's access, so nothing runs until it is
  // confirmed — the grid is one click away from silently widening a member's rights.
  async function run(
    options: ConfirmOptions,
    action: () => Promise<{ success: boolean; message?: string }>,
  ) {
    if (!(await confirm(options))) return
    setError('')
    startTransition(async () => {
      const r = await action()
      if (r.success) { reload(); router.refresh() }
      else setError(r.message ?? 'Something went wrong.')
    })
  }

  function toggleExpanded(personId: string) {
    router.push(personId === expandedPersonId ? '/admin/users' : `/admin/users?person=${personId}`)
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      {!rights.edit && (
        <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          You can view access settings but not change them.
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Group policies win. Where any of a member&apos;s groups already sets a page and action, the
          individual override is ignored — those cells are greyed out. Only pages that have shipped
          are listed.
        </p>
      </div>

      <MemberSearchBox value={query} onChange={setQuery} pending={loading}
        placeholder="Search members by name or email…" />

      {data.rows.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {query ? 'No members match that search.' : 'No members with accounts in this family yet.'}
        </p>
      )}

      {data.rows.map(member => {
        const expanded = member.personId === expandedPersonId
        return (
          <Card key={member.personId}>
            <CardHeader className="pb-3">
              <button type="button" onClick={() => toggleExpanded(member.personId)}
                className="flex w-full items-center gap-3 text-left"
                aria-expanded={expanded ? 'true' : 'false'}>
                <UserCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate text-base">{member.name}</CardTitle>
                  {member.email && <CardDescription className="truncate">{member.email}</CardDescription>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {member.groupIds.length} group{member.groupIds.length === 1 ? '' : 's'}
                </span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', expanded ? '' : '-rotate-90')} />
              </button>

              {/* Group chips double as the membership control. */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {groups.map(g => {
                  const isMember = member.groupIds.includes(g.id)
                  // Removing needs delete rights; adding needs edit.
                  const allowed = isMember ? rights.remove : rights.edit
                  return (
                    <button key={g.id} type="button" disabled={!allowed || isPending}
                      onClick={() => run({
                        title: isMember ? 'Remove from group' : 'Add to group',
                        description: isMember
                          ? `Remove ${member.name} from "${g.name}"? They lose the access that group grants.`
                          : `Add ${member.name} to "${g.name}"? They gain everything that group grants.`,
                        confirmLabel: isMember ? 'Remove' : 'Add',
                        destructive: isMember,
                      }, () => setGroupMembership(g.id, member.personId, !isMember))}
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60',
                        isMember ? 'bg-[#0f2540] text-[#e6ecfa]' : 'border text-muted-foreground hover:bg-muted',
                      )}
                      title={isMember
                        ? (rights.remove ? `Remove from ${g.name}` : `In ${g.name} — you cannot remove members`)
                        : (rights.edit ? `Add to ${g.name}` : `Not in ${g.name}`)}>
                      {g.isSystem && <ShieldCheck className="h-3 w-3" />}
                      {g.name}
                    </button>
                  )
                })}
              </div>
            </CardHeader>

            {expanded && (
              <CardContent className="overflow-x-auto border-t pt-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Individual overrides
                </p>
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
                              const k = `${r.key}:${action}`
                              const isCovered = covered.has(k)
                              const current = personPolicy[k]
                              return (
                                <td key={action} className="py-1.5 pr-3">
                                  <div className={cn('flex gap-0.5', isCovered && 'opacity-40')}>
                                    {SCOPES_FOR[action].map(scope => (
                                      <button key={scope} type="button"
                                        disabled={!rights.edit || isPending || isCovered}
                                        onClick={() => run({
                                          title: current === scope ? 'Clear permission' : 'Change permission',
                                          description: current === scope
                                            ? `Clear ${member.name}'s "${action}" permission on ${r.label}? They fall back to whatever their groups grant.`
                                            : `Set ${member.name}'s "${action}" permission on ${r.label} to ${SCOPE_LABEL[scope]}${scope === 'none' ? ' (denied)' : ''}?`,
                                          confirmLabel: current === scope ? 'Clear' : 'Change',
                                          destructive: current === scope || scope === 'none',
                                        }, () => setPersonPermission(
                                          member.personId, r.key, action, current === scope ? null : scope))}
                                        title={isCovered ? 'Set by one of this member’s groups'
                                          : `${r.label} · ${action} · ${SCOPE_LABEL[scope]}`}
                                        className={cn(
                                          'rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed',
                                          current === scope ? SCOPE_STYLE[scope] : 'text-muted-foreground hover:bg-muted',
                                        )}>
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
                  Click a selected value again to clear the override and fall back to the member&apos;s groups.
                </p>
              </CardContent>
            )}
          </Card>
        )
      })}

      <Pager page={page} total={data.total} onPage={setPage} />
    </div>
  )
}
