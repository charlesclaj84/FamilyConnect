'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import { useServerState } from '@/lib/use-server-state'
import {
  createChapter, deleteChapter, createCustomRole, deleteCustomRole,
  type Chapter, type CustomRole,
} from '@/app/actions/admin/chapters'

const SCOPE_LABELS = { national: 'National', regional: 'Regional', chapter: 'Chapter' }
const CATEGORY_LABELS = { executive_officer: 'Executive Officer', appointed_position: 'Appointed Position' }

interface Props {
  initialChapters: Chapter[]
  initialRoles: CustomRole[]
}

export function AdminChaptersClient({ initialChapters, initialRoles }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  // `useServerState`: both create handlers below hand off to `router.refresh()`
  // rather than building a row locally, so adopting the refreshed props is what
  // actually makes the new row appear.
  const [chapters, setChapters] = useServerState(initialChapters)
  const [roles, setRoles]       = useServerState(initialRoles)

  // Chapter form
  const [chapterName, setChapterName] = useState('')
  const [chapterSaving, setChapterSaving] = useState(false)
  const [chapterError, setChapterError]   = useState('')

  // Role form
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [roleForm, setRoleForm] = useState({ name: '', category: 'executive_officer' as 'executive_officer' | 'appointed_position', scope: 'national' as 'national' | 'regional' | 'chapter' })
  const [roleSaving, setRoleSaving] = useState(false)
  const [roleError, setRoleError]   = useState('')

  async function handleAddChapter() {
    if (!chapterName.trim()) { setChapterError('Name is required'); return }
    setChapterSaving(true)
    const result = await createChapter(chapterName.trim())
    if (!result.success) { setChapterError(result.error ?? 'Error'); setChapterSaving(false); return }
    setChapterName('')
    setChapterSaving(false)
    router.refresh()
  }

  async function handleDeleteChapter(id: string, name: string) {
    const ok = await confirm({
      title: 'Delete chapter',
      description: `Delete the chapter "${name}"? This cannot be undone.`,
      confirmLabel: 'Delete chapter',
      destructive: true,
    })
    if (!ok) return
    await deleteChapter(id)
    setChapters(prev => prev.filter(c => c.id !== id))
  }

  async function handleAddRole() {
    if (!roleForm.name.trim()) { setRoleError('Name is required'); return }
    setRoleSaving(true)
    const result = await createCustomRole(roleForm)
    if (!result.success) { setRoleError(result.error ?? 'Error'); setRoleSaving(false); return }
    setRoleForm({ name: '', category: 'executive_officer', scope: 'national' })
    setShowRoleForm(false)
    setRoleSaving(false)
    router.refresh()
  }

  async function handleDeleteRole(id: string, name: string) {
    const ok = await confirm({
      title: 'Delete role',
      description: `Delete the role "${name}"? Anyone currently holding it will lose it.`,
      confirmLabel: 'Delete role',
      destructive: true,
    })
    if (!ok) return
    const result = await deleteCustomRole(id)
    if (result.success) setRoles(prev => prev.filter(r => r.id !== id))
    else alert(result.error)
  }

  const globalRoles = roles.filter(r => r.is_global)
  const customRoles = roles.filter(r => !r.is_global)

  return (
    <div className="space-y-8">
      {/* Chapters */}
      <Card>
        <CardHeader>
          <CardTitle>Chapters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {chapters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chapters defined yet.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {chapters.map(c => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm font-medium">{c.name}</span>
                  <button onClick={() => handleDeleteChapter(c.id, c.name)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              placeholder="Chapter name…"
              value={chapterName}
              onChange={e => { setChapterName(e.target.value); setChapterError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleAddChapter() }}
              className="max-w-xs"
            />
            <Button disabled={chapterSaving} onClick={handleAddChapter}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          {chapterError && <p className="text-sm text-destructive">{chapterError}</p>}
        </CardContent>
      </Card>

      {/* Global roles (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" /> Global Roles
            <span className="text-xs font-normal text-muted-foreground ml-1">(read-only · cannot be edited or deleted)</span>
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
            <CardTitle>Custom Roles</CardTitle>
            <Button size="sm" onClick={() => setShowRoleForm(s => !s)}>
              <Plus className="h-3.5 w-3.5" /> Add Role
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showRoleForm && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label>Role Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g. Regional Coordinator" value={roleForm.name} onChange={e => { setRoleForm(f => ({ ...f, name: e.target.value })); setRoleError('') }} />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={roleForm.category} onChange={e => setRoleForm(f => ({ ...f, category: e.target.value as 'executive_officer' | 'appointed_position' }))}>
                    <option value="executive_officer">Executive Officer</option>
                    <option value="appointed_position">Appointed Position</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Scope</Label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={roleForm.scope} onChange={e => setRoleForm(f => ({ ...f, scope: e.target.value as 'national' | 'regional' | 'chapter' }))}>
                    <option value="national">National</option>
                    <option value="regional">Regional</option>
                    <option value="chapter">Chapter</option>
                  </select>
                </div>
              </div>
              {roleError && <p className="text-sm text-destructive">{roleError}</p>}
              <div className="flex gap-2">
                <Button disabled={roleSaving} onClick={handleAddRole}>{roleSaving ? 'Creating…' : 'Create Role'}</Button>
                <Button variant="outline" onClick={() => setShowRoleForm(false)}>Cancel</Button>
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
                    <button onClick={() => handleDeleteRole(r.id, r.name)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
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
