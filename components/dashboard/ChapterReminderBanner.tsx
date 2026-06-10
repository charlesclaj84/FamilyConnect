'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { saveChapterAndPropagate } from '@/app/actions/personal-info'
import type { Chapter } from '@/app/actions/announcements'

interface Props {
  chapters: Chapter[]
}

export function ChapterReminderBanner({ chapters }: Props) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [chapterId, setChapterId] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (dismissed) return null

  if (saved) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 px-4 py-3 flex items-center gap-3">
        <MapPin className="h-4 w-4 text-green-600 shrink-0" />
        <p className="text-sm text-green-800 dark:text-green-200 font-medium">Chapter saved successfully.</p>
      </div>
    )
  }

  function handleSave() {
    if (!chapterId) { setError('Please select a chapter.'); return }
    setError('')
    startTransition(async () => {
      const result = await saveChapterAndPropagate(chapterId)
      if (result.success) {
        setSaved(true)
        router.refresh()
        setTimeout(() => setDismissed(true), 2000)
      } else {
        setError(result.message ?? 'Failed to save. Please try again.')
      }
    })
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4 flex gap-3">
      <div className="shrink-0 p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 self-start mt-0.5">
        <MapPin className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Select your chapter
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
            Assigning your chapter ensures you receive the right announcements and are grouped correctly within the family.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Select
            value={chapterId}
            onChange={e => setChapterId(e.target.value)}
            className="flex-1 h-9 text-sm"
            disabled={isPending}
          >
            <option value="">— Select your chapter —</option>
            {chapters.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending || !chapterId}
            className="shrink-0"
          >
            {isPending ? 'Saving…' : 'Save Chapter'}
          </Button>
        </div>

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 self-start text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
