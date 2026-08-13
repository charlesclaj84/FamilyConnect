'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Pencil, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { useServerState } from '@/lib/use-server-state'
import { createCustomRole, deleteCustomRole, setRoleEnabled, type CustomRole } from '@/app/actions/admin/chapters'

const SCOPE_LABELS = { national: 'National', regional: 'Regional', chapter: 'Chapter' }
const CATEGORY_LABELS = { executive_officer: 'Executive Officer', appointed_position: 'Appointed Position' }

export function AdminUserRolesClient({ initialRoles }: { initialRoles: CustomRole[] }) {
  const router = useRouter()
  const confirm = useConfirm()
  // `useServerState`: `handleAdd` refreshes rather than building a row, so adopting
  // the refreshed props is what makes the new role appear.
  const [roles, setRoles]             = useServerState(initialRoles)
  const [showForm, setShowForm]       = useState(false)
  const [roleForm, setRoleForm]       = useState({
    name:     '',
    category: 'executive_officer' as 'executive_officer' | 'appointed_position',
    scope:    'national' as 'national' | 'regional' | 'chapter',
  })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [editingPositions, setEditingPositions] = useState(false)
  const [, startTransition]   = useTransition()

  const globalRoles = roles.filter(r => r.is_global)
  const customRoles = roles.filter(r => !r.is_global)
  const enabledGlobalRoles = globalRoles.filter(r => r.enabled)
  const usedCount = enabledGlobalRoles.length

  async function handleToggleEnabled(role: CustomRole) {
    const next = !role.enabled
    const ok = await confirm({
      title: next ? 'Add position' : 'Remove position',
      description: next
        ? `Make "${role.name}" available for elections and role assignments?`
        : `Remove "${role.name}" from the positions your family uses? It will no longer be offered in elections or role assignments.`,
      confirmLabel: next ? 'Add position' : 'Remove position',
      destructive: !next,
    })
    if (!ok) return
    setRoles(prev => prev.map(r => r.id === role.id ? { ...r, enabled: next } : r))
    startTransition(async () => {
      const result = await setRoleEnabled(role.id, next)
      if (!result.success) {
        setError(result.error ?? 'Could not update')
        setRoles(prev => prev.map(r => r.id === role.id ? { ...r, enabled: !next } : r))
      }
    })
  }

  async function handleAdd() {
    if (!roleForm.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    const result = await createCustomRole(roleForm)
    if (!result.success) { setError(result.error ?? 'Error'); setSaving(false); return }
    setRoleForm({ name: '', category: 'executive_officer', scope: 'national' })
    setShowForm(false)
    setSaving(false)
    router.refresh()
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: 'Delete role',
      description: `Delete the custom role "${name}"? Anyone currently holding it will lose it.`,
      confirmLabel: 'Delete role',
      destructive: true,
    })
    if (!ok) return
    const result = await deleteCustomRole(id)
    if (result.success) setRoles(prev => prev.filter(r => r.id !== id))
    else alert(result.error)
  }

  return (
    <div className="space-y-8">
      {/* Global positions — choose which your family uses */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              Standard Board Positions
              <span className="text-xs font-normal text-muted-foreground">({usedCount} of {globalRoles.length} in use)</span>
            </CardTitle>
            <Button size="sm" variant={editingPositions ? 'default' : 'outline'} onClick={() => { setEditingPositions(e => !e); setError('') }}>
              {editingPositions ? <><Check className="h-3.5 w-3.5" /> Done</> : <><Pencil className="h-3.5 w-3.5" /> Edit</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <FormError message={error} className="mb-3" />

          {!editingPositions ? (
            // ── View: only the positions the family uses ──
            usedCount === 0 ? (
              <p className="text-sm text-muted-foreground">No positions selected yet. Use <strong>Edit</strong> to choose the positions your family uses.</p>
            ) : (
              <div className="divide-y rounded-lg border">
                {enabledGlobalRoles.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="text-sm truncate">{r.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[r.category]}</span>
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{SCOPE_LABELS[r.scope]}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // ── Edit: check positions to add/remove ──
            <>
              <div className="divide-y rounded-lg border">
                {globalRoles.map(r => (
                  <label key={r.id} className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer select-none transition-colors ${r.enabled ? '' : 'opacity-55'}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={r.enabled}
                        onChange={() => handleToggleEnabled(r)}
                        className="h-4 w-4 rounded border-input accent-primary shrink-0"
                      />
                      <span className="text-sm truncate">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[r.category]}</span>
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{SCOPE_LABELS[r.scope]}</span>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Checked positions are available in elections and role assignments. Standard positions can’t be renamed — add your own below.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Custom roles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Custom Roles</CardTitle>
            <Button size="sm" onClick={() => setShowForm(s => !s)}>
              <Plus className="h-3.5 w-3.5" /> Add Role
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label required>Role Name</Label>
                  <Input
                    placeholder="e.g. Regional Coordinator"
                    value={roleForm.name}
                    onChange={e => { setRoleForm(f => ({ ...f, name: e.target.value })); setError('') }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={roleForm.category}
                    onChange={e => setRoleForm(f => ({ ...f, category: e.target.value as 'executive_officer' | 'appointed_position' }))}
                  >
                    <option value="executive_officer">Executive Officer</option>
                    <option value="appointed_position">Appointed Position</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Scope</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={roleForm.scope}
                    onChange={e => setRoleForm(f => ({ ...f, scope: e.target.value as 'national' | 'regional' | 'chapter' }))}
                  >
                    <option value="national">National</option>
                    <option value="regional">Regional</option>
                    <option value="chapter">Chapter</option>
                  </select>
                </div>
              </div>
              <FormError message={error} />
              <div className="flex gap-2">
                <Button disabled={saving} onClick={handleAdd}>{saving ? 'Creating…' : 'Create Role'}</Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setError('') }}>Cancel</Button>
              </div>
            </div>
          )}

          {customRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom roles yet.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {customRoles.map(r => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm">{r.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[r.category]}</span>
                    <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{SCOPE_LABELS[r.scope]}</span>
                    <button
                      onClick={() => handleDelete(r.id, r.name)}
                      aria-label={`Delete ${r.name} role`}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
