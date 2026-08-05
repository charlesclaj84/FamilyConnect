'use client'

import { useState, useTransition } from 'react'
import { Pin, PinOff, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { AnnouncementCard } from '@/components/announcements/AnnouncementCard'
import { useConfirm } from '@/components/ui/confirm'
import {
  createAnnouncement, deleteAnnouncement, togglePinAnnouncement,
  type Announcement, type Chapter,
} from '@/app/actions/announcements'

interface Props {
  initialAnnouncements: Announcement[]
  chapters: Chapter[]
}

export function AdminAnnouncementsClient({ initialAnnouncements, chapters }: Props) {
  const confirm = useConfirm()
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [scope, setScope] = useState<'national' | 'regional' | 'chapter'>('national')
  const [chapterId, setChapterId] = useState('')
  const [pinned, setPinned] = useState(false)
  const [pinnedUntil, setPinnedUntil] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleCreate() {
    if (!title.trim() || !body.trim()) { setError('Title and body are required.'); return }
    if (scope === 'chapter' && !chapterId) { setError('Select a chapter to target.'); return }
    setError('')
    startTransition(async () => {
      const result = await createAnnouncement({
        title, body, scope, pinned,
        pinned_until: pinned && pinnedUntil ? new Date(pinnedUntil).toISOString() : null,
        chapter_id: scope === 'chapter' ? chapterId : null,
      })
      if (!result.success) { setError(result.message ?? 'Failed'); return }

      const selectedChapter = chapters.find(c => c.id === chapterId)
      setAnnouncements(prev => [{
        id: crypto.randomUUID(), title, body, scope, pinned,
        pinned_until: pinned && pinnedUntil ? new Date(pinnedUntil).toISOString() : null,
        published_at: new Date().toISOString(), author_name: 'You',
        chapter_id: scope === 'chapter' ? chapterId : null,
        chapter_name: scope === 'chapter' ? (selectedChapter?.name ?? null) : null,
      }, ...prev])
      setTitle(''); setBody(''); setScope('national'); setChapterId(''); setPinned(false); setPinnedUntil(''); setShowForm(false)
    })
  }

  async function handleDelete(id: string) {
    const announcement = announcements.find(a => a.id === id)
    const ok = await confirm({
      title: 'Delete announcement',
      description: announcement
        ? `Delete "${announcement.title}"? Members will no longer see it. This cannot be undone.`
        : 'Delete this announcement? This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      await deleteAnnouncement(id)
      setAnnouncements(prev => prev.filter(a => a.id !== id))
    })
  }

  async function handleTogglePin(id: string, current: boolean) {
    const announcement = announcements.find(a => a.id === id)
    const label = announcement ? `"${announcement.title}"` : 'this announcement'
    const ok = await confirm({
      title: current ? 'Unpin announcement' : 'Pin announcement',
      description: current
        ? `Unpin ${label}? It will drop out of the banner at the top of members' dashboards.`
        : `Pin ${label} to the top of members' dashboards?`,
      confirmLabel: current ? 'Unpin' : 'Pin',
    })
    if (!ok) return
    startTransition(async () => {
      await togglePinAnnouncement(id, !current)
      setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, pinned: !current } : a))
    })
  }

  return (
    <div className="space-y-6">
      {!showForm ? (
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> New Announcement
        </Button>
      ) : (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">New Announcement</h2>
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">Title</Label>
            <Input id="ann-title" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ann-body">Body</Label>
            <Textarea id="ann-body" rows={4} value={body} onChange={e => setBody(e.target.value)} />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            <div className="space-y-1.5">
              <Label htmlFor="ann-scope">Audience</Label>
              <Select
                id="ann-scope"
                value={scope}
                onChange={e => { setScope(e.target.value as typeof scope); setChapterId('') }}
              >
                <option value="national">Entire Family (National)</option>
                <option value="regional">Regional</option>
                <option value="chapter">Specific Chapter</option>
              </Select>
            </div>

            {scope === 'chapter' && (
              <div className="space-y-1.5">
                <Label htmlFor="ann-chapter">Chapter</Label>
                <Select
                  id="ann-chapter"
                  value={chapterId}
                  onChange={e => setChapterId(e.target.value)}
                >
                  <option value="">— Select chapter —</option>
                  {chapters.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1.5 mt-5 sm:mt-6">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ann-pinned" checked={pinned} onChange={e => { setPinned(e.target.checked); if (!e.target.checked) setPinnedUntil('') }} />
                <Label htmlFor="ann-pinned">Pin to dashboard</Label>
              </div>
              {pinned && (
                <div className="flex items-center gap-2 ml-5 mt-1">
                  <Label htmlFor="ann-pinned-until" className="text-xs text-muted-foreground whitespace-nowrap">Expire on</Label>
                  <input
                    type="date"
                    id="ann-pinned-until"
                    value={pinnedUntil}
                    onChange={e => setPinnedUntil(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  />
                  {pinnedUntil && (
                    <button type="button" onClick={() => setPinnedUntil('')} className="text-xs text-muted-foreground hover:text-foreground">clear</button>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={isPending}>
              {isPending ? 'Posting…' : 'Post Announcement'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setError('') }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {announcements.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No announcements yet.</p>
      ) : (
        <div className="space-y-4">
          {announcements.map(a => (
            <div key={a.id} className="relative">
              <AnnouncementCard announcement={a} />
              {/* Chapter badge */}
              {a.chapter_name && (
                <span className="absolute top-3 left-3 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {a.chapter_name}
                </span>
              )}
              <div className="absolute top-3 right-3 flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleTogglePin(a.id, a.pinned)} title={a.pinned ? 'Unpin' : 'Pin'}>
                  {a.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(a.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
