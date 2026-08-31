'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useConfirm } from '@/components/ui/confirm'
import { FieldError } from '@/components/ui/form-message'
import { saveChapterAndPropagate } from '@/app/actions/personal-info'
import type { Chapter } from '@/app/actions/announcements'
import { useT } from '@/components/layout/LocaleProvider'

interface Props {
  chapters: Chapter[]
}

export function ChapterReminderBanner({ chapters }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [dismissed, setDismissed] = useState(false)
  const t = useT()
  const [chapterId, setChapterId] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (dismissed) return null

  // Filled affirm, not an affirm TINT. `--brand-affirm` as text on `--brand-soft` measures
  // 3.69 in light — enough for an icon, not for a sentence — whereas the filled pair
  // `bg-brand-affirm` / `text-brand-on-affirm` is checked at 4.81 light and 4.91 dark.
  // Never cross the pairs to get a softer look; pick the pair that passes.
  if (saved) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-brand-affirm px-4 py-3 text-brand-on-affirm">
        <MapPin className="h-4 w-4 shrink-0" />
        <p className="text-sm font-medium">{t('dash.chapter.saved')}</p>
      </div>
    )
  }

  async function handleSave() {
    if (!chapterId) { setError(t('dash.chapter.required')); return }
    const ok = await confirm({
      title: t('dash.chapter.title'),
      // WHAT MOVES, IN THE WORDS OF THE RULE. There is no household in this product — every
      // member is their own person — and `propagateChapterToChildren` moves exactly one other
      // kind of row: a son or daughter under eighteen with no account of their own. "Everyone
      // in your household" said both more than is true and less than is clear.
      description: `Set your chapter to ${chapters.find(c => c.id === chapterId)?.name ?? 'the selected chapter'}? Any sons or daughters under 18 who have no account of their own move with you.`,
      confirmLabel: t('dash.chapter.action'),
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await saveChapterAndPropagate(chapterId)
      if (result.success) {
        setSaved(true)
        router.refresh()
        setTimeout(() => setDismissed(true), 2000)
      } else {
        setError(result.message ?? t('dash.chapter.failed'))
      }
    })
  }

  return (
    // WAS BLUE, in eight places, with a `dark:` variant on each. Nothing in GENORRA is
    // blue — the palette is Heritage, Warmth, Growth, Legacy, Nurturing — so on a
    // burgundy-and-gold dashboard this banner was the loudest thing on the screen and
    // the only thing on it that belonged to no brand. It is now the standard resting
    // surface: `bg-brand-soft` under `text-brand-on-soft`, a checked pair at 7.31 in
    // light and 10.64 in dark, which is also why every `dark:` override here could go —
    // the roles already resolve per theme.
    <div className="flex gap-3 rounded-xl border border-brand-legacy/40 bg-brand-soft p-4">
      <div className="mt-0.5 shrink-0 self-start rounded-lg bg-brand-primary p-1.5 text-brand-on-primary">
        <MapPin className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <p className="text-sm font-medium text-brand-on-soft">
            {t('dash.chapter.select')}
          </p>
          <p className="mt-0.5 text-xs text-brand-on-soft/80">
            {t('dash.chapter.lede')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Select
            value={chapterId}
            onChange={e => setChapterId(e.target.value)}
            className="flex-1 h-9 text-sm"
            disabled={isPending}
          >
            <option value="">{t('dash.selectYourChapter')}</option>
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
            {isPending ? t('dash.chapter.saving') : t('dash.chapter.action')}
          </Button>
        </div>

        {/* `FieldError` rather than `FormError`: this banner is one control and one
            button, and a bordered alert inside a banner is a box in a box. The colour
            comes from `--destructive` either way, which is the semantic token and
            already resolves per theme — `text-red-600 dark:text-red-400` was a
            hand-rolled copy of it, and is what used to be here. */}
        <FieldError message={error} />
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 self-start text-brand-on-soft/60 transition-colors hover:text-brand-on-soft"
        aria-label={t('dash.dismiss')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
