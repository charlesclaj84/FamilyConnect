'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Megaphone, Send, Globe, Map, Building2, Pin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { FormError } from '@/components/ui/form-message'
import { createAnnouncement, type Chapter } from '@/app/actions/announcements'
import { useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

type Scope = 'national' | 'regional' | 'chapter'

// A FUNCTION of `t` since Phase 5: the captions come from the reader's catalogue and cannot
// be resolved at module load. The ICONS and the scope ids stay here, which is what this map
// is actually for — and the ids are what `createAnnouncement` is sent.
function scopeMeta(t: T): Record<Scope, { label: string; icon: typeof Globe; hint: string }> {
  return {
    national: { label: t('ann.new.wholeFamily'), icon: Globe, hint: t('ann.new.wholeFamilyHint') },
    regional: { label: t('ann.new.region'), icon: Map, hint: t('ann.new.regionHint') },
    chapter:  { label: t('field.chapter'), icon: Building2, hint: t('ann.new.chapterHint') },
  }
}

/**
 * `canPin` was called `isAdmin` until 2026-08-13, and the rename is not cosmetic: it is
 * the ONE grant this control reads — `announcements:edit` at scope 'any' — rather than a
 * general statement about the caller. A family can hand pinning to a communications
 * officer who administers nothing else, and a prop named `isAdmin` invites the next
 * reader to reuse it for a second decision that does not follow from it.
 *
 * THE EXPIRY CAME BACK WITH THE ADMIN PAGE'S DELETION. `pinned_until` is a column
 * (20260610000003) and `createAnnouncement` has always honoured it; only the deleted
 * Announcement Management screen offered it, so folding that screen in here without this
 * field would have quietly removed the ability to pin something until the reunion and no
 * longer.
 */
export function NewAnnouncementForm({ canPin, chapters }: { canPin: boolean; chapters: Chapter[] }) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [scope, setScope] = useState<Scope>('national')
  const [chapterId, setChapterId] = useState('')
  const [pinned, setPinned] = useState(false)
  const [pinnedUntil, setPinnedUntil] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function reset() {
    setTitle(''); setBody(''); setScope('national'); setChapterId('')
    setPinned(false); setPinnedUntil(''); setError(''); setOpen(false)
  }

  function submit() {
    if (!title.trim() || !body.trim()) { setError(t('ann.new.needBoth')); return }
    if (scope === 'chapter' && !chapterId) { setError(t('ann.new.needChapter')); return }
    setError('')
    const willPin = canPin && pinned
    startTransition(async () => {
      const res = await createAnnouncement({
        title, body, scope,
        pinned: willPin,
        // Only when it is actually pinned — an expiry on an unpinned post is a date
        // nothing ever reads, and `createAnnouncement` drops it for the same reason.
        pinned_until: willPin && pinnedUntil ? new Date(pinnedUntil).toISOString() : null,
        chapter_id: scope === 'chapter' ? chapterId : null,
      })
      if (!res.success) { setError(res.message ?? t('ann.new.failed')); return }
      reset()
      router.refresh()
    })
  }

  // ── Collapsed: an inviting composer bar ──
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group w-full flex items-center gap-3 rounded-2xl border bg-card px-4 py-3.5 text-start shadow-sm transition-all hover:shadow-md hover:border-primary/40"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-105">
          <Megaphone className="h-5 w-5" />
        </span>
        <span className="text-muted-foreground">{t('ann.new.prompt')}</span>
        <span className="ms-auto hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
          <Send className="h-3.5 w-3.5" /> {t('action.post')}
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
        <h2 className="text-base font-semibold">{t('ann.new.heading')}</h2>
        <button onClick={reset} className="ms-auto rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label={t('action.close')}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ann-title">{t('field.title')}</Label>
        <Input id="ann-title" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('ann.new.titlePh')} autoFocus />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ann-body">{t('field.message')}</Label>
        <Textarea id="ann-body" rows={4} value={body} onChange={e => setBody(e.target.value)} placeholder={t('ann.new.bodyPh')} />
      </div>

      {/* Audience targeting — segmented control */}
      <div className="space-y-2">
        <Label>{t('field.audience')}</Label>
        <div className="grid grid-cols-3 gap-2">
          {scopeKeys.map(key => {
            const { label, icon: Icon } = scopeMeta(t)[key]
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
        <p className="text-xs text-muted-foreground">{scopeMeta(t)[scope].hint}</p>
      </div>

      {scope === 'chapter' && (
        <div className="space-y-1.5">
          <Label htmlFor="ann-chapter">{t('field.chapter')}</Label>
          <Select id="ann-chapter" value={chapterId} onChange={e => setChapterId(e.target.value)}>
            <option value="">— Select chapter —</option>
            {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      )}

      {canPin && (
        <div className="space-y-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pinned}
              onChange={e => { setPinned(e.target.checked); if (!e.target.checked) setPinnedUntil('') }}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <Pin className="h-3.5 w-3.5 text-muted-foreground" />
            {t('ann.new.pin')}
          </label>
          {pinned && (
            <div className="ms-6 space-y-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="ann-pinned-until" className="whitespace-nowrap text-xs text-muted-foreground">
                  {t('ann.new.unpinOn')}
                </Label>
                <input
                  type="date"
                  id="ann-pinned-until"
                  value={pinnedUntil}
                  onChange={e => setPinnedUntil(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                />
                {pinnedUntil && (
                  <button
                    type="button"
                    onClick={() => setPinnedUntil('')}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    clear
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t('ui.optionalLeaveEmptyPin')}</p>
            </div>
          )}
        </div>
      )}

      <FormError message={error} />

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={submit} disabled={isPending}>
          <Send className="h-3.5 w-3.5" /> {isPending ? t('action.posting') : t('ann.new.submit')}
        </Button>
        <Button size="sm" variant="ghost" onClick={reset}>{t('action.cancel')}</Button>
      </div>
    </div>
  )
}
