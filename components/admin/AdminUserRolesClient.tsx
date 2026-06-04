'use client'

import { useState } from 'react'
import { Plus, Trash2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createCustomRole, deleteCustomRole, type CustomRole } from '@/app/actions/admin/chapters'

const SCOPE_LABELS = { national: 'National', regional: 'Regional', chapter: 'Chapter' }
const CATEGORY_LABELS = { executive_officer: 'Executive Officer', appointed_position: 'Appointed Position' }

export function AdminUserRolesClient({ initialRoles }: { initialRoles: CustomRole[] }) {
  const [roles, setRoles]             = useState(initialRoles)
  const [showForm, setShowForm]       = useState(false)
  const [roleForm, setRoleForm]       = useState({
    name:     '',
    category: 'executive_officer' as 'executive_officer' | 'appointed_position',
    scope:    'national' as 'national' | 'regional' | 'chapter',
  })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const globalRoles = roles.filter(r => r.is_global)
  const customRoles = roles.filter(r => !r.is_global)

  async function handleAdd() {
    if (!roleForm.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    const result = await createCustomRole(roleForm)
    if (!result.success) { setError(result.error ?? 'Error'); setSaving(false); return }
    window.location.reload()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete role "${name}"?`)) return
    const result = await deleteCustomRole(id)
    if (result.success) setRoles(prev => prev.filter(r => r.id !== id))
    else alert(result.error)
  }

  return (
    <div className="space-y-8">
      {/* Global roles — read-only */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-muted-foreground" />
            Global Roles
            <span className="text-xs font-normal text-muted-foreground">(system-defined · cannot be edited or deleted)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-lg border">
            {globalRoles.map(r => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm">{r.name}</span>
                <div className="flex gap-2">
                  <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[r.category]}</span>
                  <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{SCOPE_LABELS[r.scope]}</span>
                </div>
              </div>
            ))}
          </div>
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
                  <Label>Role Name <span className="text-destructive">*</span></Label>
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
              {error && <p className="text-sm text-destructive">{error}</p>}
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
