'use client'

import { useState } from 'react'
import { Shield, CheckCircle, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  setAdminFlag, setApproveFlag, assignRole, revokeRoleByAssignmentId,
  type MemberWithRoles, type FamilyRole, type AssignedRole,
} from '@/app/actions/admin/users'
import type { Chapter, Region } from '@/app/actions/admin/chapters'

const SCOPE_LABELS = { national: 'National', regional: 'Regional', chapter: 'Chapter' }

interface Props {
  members: MemberWithRoles[]
  roles: FamilyRole[]
  chapters: Chapter[]
  regions: Region[]
  currentUserId: string
}

function RoleBadge({ role, onRemove }: { role: AssignedRole; onRemove: () => void }) {
  const scopeLabel = role.assignment_scope === 'chapter' && role.chapter_name
    ? role.chapter_name
    : role.assignment_scope === 'regional' && role.region_name
      ? `${role.region_name} Region`
      : SCOPE_LABELS[role.assignment_scope]
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-[#e6ecfa] text-[#0f2540] px-2 py-0.5 rounded-full">
      <span className="font-medium">{role.name}</span>
      <span className="text-muted-foreground">· {scopeLabel}</span>
      <button onClick={onRemove} className="hover:text-destructive transition-colors ml-0.5">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

function AssignRoleDialog({ member, allRoles, chapters, regions, onClose, onAssigned }: {
  member: MemberWithRoles
  allRoles: FamilyRole[]
  chapters: Chapter[]
  regions: Region[]
  onClose: () => void
  onAssigned: (role: AssignedRole) => void
}) {
  const [selectedId, setSelectedId]   = useState('')
  const [scope, setScope]             = useState<'national' | 'regional' | 'chapter'>('national')
  const [chapterId, setChapterId]     = useState('')
  const [regionId, setRegionId]       = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  const assignedRoleIds = new Set(member.roles.map(r => r.id))
  const available = allRoles.filter(r => !assignedRoleIds.has(r.id))
  const executive  = available.filter(r => r.category === 'executive_officer')
  const appointed  = available.filter(r => r.category === 'appointed_position')

  async function handleAssign() {
    if (!selectedId) return
    if (scope === 'chapter' && !chapterId) { setError('Select a chapter'); return }
    if (scope === 'regional' && !regionId) { setError('Select a region'); return }
    setLoading(true)
    const result = await assignRole(member.user_id, selectedId, scope, chapterId || undefined, regionId || undefined)
    if (!result.success) { setError(result.error ?? 'Error'); setLoading(false); return }
    const role = allRoles.find(r => r.id === selectedId)!
    const chapter = chapters.find(c => c.id === chapterId)
    const region = regions.find(r => r.id === regionId)
    onAssigned({
      ...role,
      assignment_id:    Date.now().toString(),
      assignment_scope: scope,
      chapter_id:       scope === 'chapter' ? (chapterId || null) : null,
      chapter_name:     scope === 'chapter' ? (chapter?.name ?? null) : null,
      region_id:        scope === 'regional' ? (regionId || null) : null,
      region_name:      scope === 'regional' ? (region?.name ?? null) : null,
    })
    onClose()
  }

  return (
    <Dialog open onClose={onClose} title="Assign Board Position" description={`Give ${member.first_name} ${member.last_name} a board position`}>
      <div className="space-y-4 mt-2">
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">All board positions are already assigned.</p>
        ) : (
          <>
            {/* 1 — Level */}
            <div className="space-y-1.5">
              <Label>Level</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={scope} onChange={e => { setScope(e.target.value as 'national' | 'regional' | 'chapter'); setChapterId(''); setRegionId(''); setError('') }}>
                <option value="national">National</option>
                <option value="regional">Regional</option>
                <option value="chapter">Chapter</option>
              </select>
            </div>

            {/* 2 — Region or Chapter, depending on the level */}
            {scope === 'regional' && (
              <div className="space-y-1.5">
                <Label>Region</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={regionId} onChange={e => { setRegionId(e.target.value); setError('') }}>
                  <option value="">— Select region —</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            )}
            {scope === 'chapter' && (
              <div className="space-y-1.5">
                <Label>Chapter</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={chapterId} onChange={e => { setChapterId(e.target.value); setError('') }}>
                  <option value="">— Select chapter —</option>
                  {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* 3 — Board Position */}
            <div className="space-y-1.5">
              <Label>Board Position</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedId} onChange={e => { setSelectedId(e.target.value); setError('') }}>
                <option value="">— Select a position —</option>
                {executive.length > 0 && (
                  <optgroup label="Executive Officers">
                    {executive.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </optgroup>
                )}
                {appointed.length > 0 && (
                  <optgroup label="Appointed Positions">
                    {appointed.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </optgroup>
                )}
              </select>
            </div>
          </>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button className="flex-1" disabled={!selectedId || loading} onClick={handleAssign}>
            {loading ? 'Assigning…' : 'Assign Board Position'}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  )
}

export function AdminUsersClient({ members: initialMembers, roles, chapters, regions, currentUserId }: Props) {
  const [members, setMembers]         = useState(initialMembers)
  const [search, setSearch]           = useState('')
  const [assigningFor, setAssigningFor] = useState<MemberWithRoles | null>(null)
  const [loading, setLoading]         = useState<string | null>(null)

  const filtered = search.trim()
    ? members.filter(m => {
        const name = [m.first_name, m.last_name].filter(Boolean).join(' ').toLowerCase()
        return name.includes(search.toLowerCase()) || (m.primary_email ?? '').toLowerCase().includes(search.toLowerCase())
      })
    : members

  function updateMember(userId: string, patch: Partial<MemberWithRoles>) {
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, ...patch } : m))
  }

  async function toggleAdmin(member: MemberWithRoles) {
    setLoading(`admin-${member.user_id}`)
    await setAdminFlag(member.user_id, !member.is_admin)
    updateMember(member.user_id, { is_admin: !member.is_admin })
    setLoading(null)
  }

  async function toggleApprove(member: MemberWithRoles) {
    setLoading(`approve-${member.user_id}`)
    await setApproveFlag(member.user_id, !member.can_approve)
    updateMember(member.user_id, { can_approve: !member.can_approve })
    setLoading(null)
  }

  async function handleRevoke(member: MemberWithRoles, assignmentId: string) {
    await revokeRoleByAssignmentId(assignmentId)
    updateMember(member.user_id, { roles: member.roles.filter(r => r.assignment_id !== assignmentId) })
  }

  return (
    <div className="space-y-4">
      <input
        type="search"
        placeholder="Search by name or email…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
      />

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No members match your search.</p>
      )}

      {filtered.map(member => {
        const name = [member.first_name, member.last_name].filter(Boolean).join(' ') || 'Unknown'
        const isSelf = member.user_id === currentUserId
        return (
          <Card key={member.user_id}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{name} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}</p>
                  <p className="text-xs text-muted-foreground">{member.primary_email}</p>
                  {member.chapter_name && (
                    <p className="text-xs text-muted-foreground">Chapter: {member.chapter_name}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleAdmin(member)}
                    disabled={loading === `admin-${member.user_id}`}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                      member.is_admin
                        ? 'bg-[#0f2540] text-[#e6ecf1] border-[#0f2540]'
                        : 'bg-background text-muted-foreground border-border hover:border-[#0f2540]'
                    }`}
                  >
                    <Shield className="h-3.5 w-3.5" /> Admin
                  </button>

                  <button
                    onClick={() => toggleApprove(member)}
                    disabled={loading === `approve-${member.user_id}`}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                      member.can_approve
                        ? 'bg-[#1aa88a] text-white border-[#1aa88a]'
                        : 'bg-background text-muted-foreground border-border hover:border-[#1aa88a]'
                    }`}
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Can Approve
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {member.roles.map(role => (
                  <RoleBadge key={role.assignment_id} role={role} onRemove={() => handleRevoke(member, role.assignment_id)} />
                ))}
                <button onClick={() => setAssigningFor(member)} className="inline-flex items-center gap-1 text-xs text-primary hover:opacity-70 transition-opacity px-1">
                  <Plus className="h-3 w-3" /> Add Board Position
                </button>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {assigningFor && (
        <AssignRoleDialog
          member={assigningFor}
          allRoles={roles}
          chapters={chapters}
          regions={regions}
          onClose={() => setAssigningFor(null)}
          onAssigned={role => {
            updateMember(assigningFor.user_id, { roles: [...assigningFor.roles, role] })
            setAssigningFor(null)
          }}
        />
      )}
    </div>
  )
}
