'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Megaphone, Send, Globe, Map, Building2, Pin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { createAnnouncement, type Chapter } from '@/app/actions/announcements'

type Scope = 'national' | 'regional' | 'chapter'

const SCOPE_META: Record<Scope, { label: string; icon: typeof Globe; hint: string }> = {
  national: { label: 'Entire Family', icon: Globe, hint: 'Everyone in the family will see this' },
  regional: { label: 'Region', icon: Map, hint: 'Shown to your region' },
  chapter:  { label: 'Chapter', icon: Building2, hint: 'Shown to a specific chapter' },
}

export function NewAnnouncementForm({ isAdmin, chapters }: { isAdmin: boolean; chapters: Chapter[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [scope, setScope] = useState<Scope>('national')
  const [chapterId, setChapterId] = useState('')
  const [pinned, setPinned] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function reset() {
    setTitle(''); setBody(''); setScope('national'); setChapterId(''); setPinned(false); setError(''); setOpen(false)
  }

  function submit() {
    if (!title.trim() || !body.trim()) { setError('Add a title and a message.'); return }
    if (scope === 'chapter' && !chapterId) { setError('Choose which chapter to notify.'); return }
    setError('')
    startTransition(async () => {
      const res = await createAnnouncement({
        title, body, scope,
        pinned: isAdmin && pinned,
        chapter_id: scope === 'chapter' ? chapterId : null,
      })
      if (!res.success) { setError(res.message ?? 'Could not post'); return }
      reset()
      router.refresh()
    })
  }

  // ── Collapsed: an inviting composer bar ──
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group w-full flex items-center gap-3 rounded-2xl border bg-card px-4 py-3.5 text-left shadow-sm transition-all hover:shadow-md hover:border-primary/40"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-105">
          <Megaphone className="h-5 w-5" />
        </span>
        <span className="text-muted-foreground">Share an announcement with your family…</span>
        <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
          <Send className="h-3.5 w-3.5" /> Post
        </span>
      </button>
    )
  }

  // ── Expanded: full composer card ──
  const scopeKeys: Scope[] = ['national', 'regional', 'chapter']

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-md space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Megaphone className="h-5 w-5" />
        </span>
        <h2 className="text-base font-semibold">New Announcement</h2>
        <button onClick={reset} className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ann-title">Title</Label>
        <Input id="ann-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Reunion update" autoFocus />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ann-body">Message</Label>
        <Textarea id="ann-body" rows={4} value={body} onChange={e => setBody(e.target.value)} placeholder="What would you like to share?" />
      </div>

      {/* Audience targeting — segmented control */}
      <div className="space-y-2">
        <Label>Audience</Label>
        <div className="grid grid-cols-3 gap-2">
          {scopeKeys.map(key => {
            const { label, icon: Icon } = SCOPE_META[key]
            const active = scope === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setScope(key); if (key !== 'chapter') setChapterId('') }}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition-all ${
                  active ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">{SCOPE_META[scope].hint}</p>
      </div>

      {scope === 'chapter' && (
        <div className="space-y-1.5">
          <Label htmlFor="ann-chapter">Chapter</Label>
          <Select id="ann-chapter" value={chapterId} onChange={e => setChapterId(e.target.value)}>
            <option value="">— Select chapter —</option>
            {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      )}

      {isAdmin && (
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
          <Pin className="h-3.5 w-3.5 text-muted-foreground" />
          Pin to the top of everyone’s dashboard
        </label>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={submit} disabled={isPending}>
          <Send className="h-3.5 w-3.5" /> {isPending ? 'Posting…' : 'Post Announcement'}
        </Button>
        <Button size="sm" variant="ghost" onClick={reset}>Cancel</Button>
      </div>
    </div>
  )
}
