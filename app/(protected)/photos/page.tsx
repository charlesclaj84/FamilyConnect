'use client'

import { useState, useTransition, useEffect } from 'react'
import { Camera, Plus } from 'lucide-react'
import { PhotoCollectionCard } from '@/components/photos/PhotoCollectionCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getPhotoCollections, createCollection } from '@/app/actions/photos'
import type { PhotoCollection } from '@/app/actions/photos'

export default function PhotosPage() {
  const [collections, setCollections] = useState<PhotoCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getPhotoCollections().then(data => { setCollections(data); setLoading(false) })
  }, [])

  function handleCreate() {
    if (!name.trim()) { setError('Name required'); return }
    setError('')
    startTransition(async () => {
      const result = await createCollection({ name: name.trim(), description: description.trim() || undefined })
      if (!result.success) { setError(result.message ?? 'Failed'); return }
      setShowForm(false); setName(''); setDescription('')
      const updated = await getPhotoCollections()
      setCollections(updated)
    })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Photo Collections</h1>
          <p className="text-muted-foreground">Browse and upload family photos organized by event or occasion.</p>
        </div>
        <Button onClick={() => setShowForm(s => !s)} variant={showForm ? 'secondary' : 'default'}>
          <Plus className="h-4 w-4 mr-1.5" /> New Collection
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-card p-4 space-y-3 max-w-md">
          <h3 className="text-sm font-semibold">Create Collection</h3>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Summer Reunion 2026" />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Photos from the summer gathering" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={isPending}>Create</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setError('') }}>Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading collections…</p>
      ) : collections.length === 0 ? (
        <div className="text-center py-16">
          <Camera className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">No photo collections yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Create one above or publish an event to auto-generate a collection.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {collections.map(c => <PhotoCollectionCard key={c.id} collection={c} />)}
        </div>
      )}
    </div>
  )
}
