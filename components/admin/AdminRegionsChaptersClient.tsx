'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import {
  createRegion, deleteRegion, createChapter, deleteChapter,
  type Region, type Chapter,
} from '@/app/actions/admin/chapters'

interface Props {
  initialRegions: Region[]
  initialChapters: Chapter[]
}

function ChapterRow({ chapter, onDelete }: { chapter: Chapter; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b last:border-0">
      <span className="text-sm">{chapter.name}</span>
      <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function RegionGroup({
  label,
  regionId,
  chapters,
  onAddChapter,
  onDeleteChapter,
  onDeleteRegion,
  isDeletable,
}: {
  label: string
  regionId: string | null
  chapters: Chapter[]
  onAddChapter: (name: string, regionId: string | null) => Promise<void>
  onDeleteChapter: (id: string) => void
  onDeleteRegion?: () => void
  isDeletable: boolean
}) {
  const [expanded, setExpanded]   = useState(true)
  const [newName, setNewName]     = useState('')
  const [adding, setAdding]       = useState(false)
  const [error, setError]         = useState('')

  async function handleAdd() {
    if (!newName.trim()) return
    setAdding(true)
    await onAddChapter(newName.trim(), regionId)
    setNewName('')
    setAdding(false)
  }

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 text-sm font-medium flex-1 text-left"
        >
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          {label}
          <span className="text-xs text-muted-foreground font-normal">({chapters.length} chapter{chapters.length !== 1 ? 's' : ''})</span>
        </button>
        {isDeletable && onDeleteRegion && (
          <button
            onClick={onDeleteRegion}
            className="text-muted-foreground hover:text-destructive transition-colors ml-2"
            title={`Delete ${label} region`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {expanded && (
        <div>
          {chapters.length > 0 ? (
            chapters.map(c => (
              <ChapterRow key={c.id} chapter={c} onDelete={() => onDeleteChapter(c.id)} />
            ))
          ) : (
            <p className="text-xs text-muted-foreground px-3 py-2">No chapters yet.</p>
          )}
          <div className="flex gap-2 px-3 py-2 border-t">
            <Input
              placeholder="New chapter name…"
              value={newName}
              onChange={e => { setNewName(e.target.value); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              className="h-7 text-sm"
            />
            <Button size="sm" className="h-7 px-2" disabled={!newName.trim() || adding} onClick={handleAdd}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          {error && <p className="text-xs text-destructive px-3 pb-2">{error}</p>}
        </div>
      )}
    </div>
  )
}

export function AdminRegionsChaptersClient({ initialRegions, initialChapters }: Props) {
  const confirm = useConfirm()
  const [regions, setRegions]     = useState(initialRegions)
  const [chapters, setChapters]   = useState(initialChapters)
  const [newRegion, setNewRegion] = useState('')
  const [addingRegion, setAddingRegion] = useState(false)
  const [regionError, setRegionError]   = useState('')

  async function handleAddRegion() {
    if (!newRegion.trim()) return
    setAddingRegion(true)
    setRegionError('')
    const result = await createRegion(newRegion.trim())
    if (!result.success) { setRegionError(result.error ?? 'Error'); setAddingRegion(false); return }
    window.location.reload()
  }

  async function handleDeleteRegion(id: string, name: string) {
    const ok = await confirm({
      title: 'Delete region',
      description: `Delete the region "${name}"? Its chapters will move to National. This cannot be undone.`,
      confirmLabel: 'Delete region',
      destructive: true,
    })
    if (!ok) return
    await deleteRegion(id)
    setRegions(prev => prev.filter(r => r.id !== id))
    setChapters(prev => prev.map(c => c.region_id === id ? { ...c, region_id: null, region_name: null } : c))
  }

  async function handleAddChapter(name: string, regionId: string | null) {
    const result = await createChapter(name, regionId)
    if (!result.success) { alert(result.error); return }
    const newChapter: Chapter = {
      id:          result.id!,
      family_code: '',
      name,
      region_id:   regionId,
      region_name: regionId ? (regions.find(r => r.id === regionId)?.name ?? null) : null,
      created_at:  new Date().toISOString(),
    }
    setChapters(prev => [...prev, newChapter].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function handleDeleteChapter(id: string) {
    const name = chapters.find(c => c.id === id)?.name
    const ok = await confirm({
      title: 'Delete chapter',
      description: name
        ? `Delete the chapter "${name}"? This cannot be undone.`
        : 'Delete this chapter? This cannot be undone.',
      confirmLabel: 'Delete chapter',
      destructive: true,
    })
    if (!ok) return
    await deleteChapter(id)
    setChapters(prev => prev.filter(c => c.id !== id))
  }

  // Group chapters by region
  const nationalChapters = chapters.filter(c => !c.region_id)
  const chaptersByRegion = (regionId: string) => chapters.filter(c => c.region_id === regionId)

  return (
    <div className="space-y-6">
      {/* Add region */}
      <div className="flex gap-2 items-end">
        <div className="space-y-1.5 flex-1 max-w-xs">
          <Label>Add Region</Label>
          <Input
            placeholder="e.g. Texas, Eastern, Southeast…"
            value={newRegion}
            onChange={e => { setNewRegion(e.target.value); setRegionError('') }}
            onKeyDown={e => { if (e.key === 'Enter') handleAddRegion() }}
          />
          {regionError && <p className="text-xs text-destructive">{regionError}</p>}
        </div>
        <Button disabled={!newRegion.trim() || addingRegion} onClick={handleAddRegion}>
          <Plus className="h-4 w-4" /> Add Region
        </Button>
      </div>

      {/* National (implicit — always shown, cannot be deleted) */}
      <RegionGroup
        label="National"
        regionId={null}
        chapters={nationalChapters}
        onAddChapter={handleAddChapter}
        onDeleteChapter={handleDeleteChapter}
        isDeletable={false}
      />

      {/* Custom regions */}
      {regions.map(region => (
        <RegionGroup
          key={region.id}
          label={region.name}
          regionId={region.id}
          chapters={chaptersByRegion(region.id)}
          onAddChapter={handleAddChapter}
          onDeleteChapter={handleDeleteChapter}
          onDeleteRegion={() => handleDeleteRegion(region.id, region.name)}
          isDeletable
        />
      ))}
    </div>
  )
}
