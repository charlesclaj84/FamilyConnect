'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createAnnouncement } from '@/app/actions/announcements'

export function NewAnnouncementForm({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function submit() {
    if (!title.trim() || !body.trim()) { setError('Title and message are required'); return }
    setError('')
    startTransition(async () => {
      const res = await createAnnouncement({ title, body, scope: 'national', pinned: isAdmin && pinned })
      if (!res.success) { setError(res.message ?? 'Could not post'); return }
      setTitle(''); setBody(''); setPinned(false); setOpen(false)
      router.refresh()
    })
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New Announcement
      </Button>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <p className="text-sm font-semibold flex items-center gap-1.5">
        <Megaphone className="h-4 w-4 text-primary" /> New Announcement
      </p>
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Reunion update" />
      </div>
      <div className="space-y-1.5">
        <Label>Message</Label>
        <Textarea rows={3} value={body} onChange={e => setBody(e.target.value)} />
      </div>
      {isAdmin && (
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={pinned}
            onChange={e => setPinned(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          Pin to top
        </label>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={isPending}>{isPending ? 'Posting…' : 'Post'}</Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setError('') }}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
      </div>
    </div>
  )
}
