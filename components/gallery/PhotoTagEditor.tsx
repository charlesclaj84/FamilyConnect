'use client'

import { useState, useTransition } from 'react'
import { Tag, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/components/ui/confirm'
import { useT } from '@/components/layout/LocaleProvider'
import { formatPersonName } from '@/lib/name-utils'
import { matchesPersonQuery, type SearchablePerson } from '@/lib/person-search'
import { tagPersonInPhoto, untagPersonFromPhoto, type Photo } from '@/app/actions/gallery'
import { cn } from '@/lib/utils'

/**
 * Somebody who can be tagged.
 *
 * `SearchablePerson` plus the `id`, which the matcher does not need and a write does. Declared
 * here rather than imported from `CollectionView` because that module imports THIS one — the
 * dependency runs one way, and a shared type in the consumer would make it a cycle.
 */
export interface TaggablePerson extends SearchablePerson {
  id: string
}

/** How many names the picker draws before it says how many it is holding back. */
const RENDER_LIMIT = 40

/**
 * Who is in this photograph — the chips, and the picker that adds one.
 *
 * ── IT IS A COMPONENT BECAUSE IT HAS TWO SURFACES NOW ──────────────────────────────
 * It lived inside `PhotoRow` in the list view, and the lightbox carried a comment saying
 * tagging was deliberately NOT there:
 *
 *   > TAGGING AND CAPTIONING ARE NOT HERE, DELIBERATELY. They were, and it meant opening a
 *   > photograph full-screen to fix a typo — and then doing it again for the next one.
 *
 * **That argument was right about the CAPTION and wrong about the TAGS**, which is why only
 * half of it is reversed. A caption is text somebody is correcting, and correcting several in
 * a row is a job the list view is built for — it stays there. A tag is an answer to *"who is
 * that?"*, and the only place that question can be answered is in front of the photograph big
 * enough to recognise a face in. Tagging from a 96px tile is guessing.
 *
 * So the editor is shared rather than copied. AGENTS.md' "Known gaps" already records what
 * copying this costs: the Member Directory got accent-insensitive search and the photo tagger
 * did not, for a year, because the matcher had been written twice. There is one matcher here
 * (`matchesPersonQuery`) and now one tagger.
 *
 * ── `tone`, AND WHY IT IS NOT A `className` ────────────────────────────────────────
 * The two surfaces have different GROUNDS: a card in the list view, and a near-black scrim in
 * the lightbox. `--brand-soft`/`--brand-on-soft` is a checked pair on the first and is
 * unreadable on the second, so the chips need two treatments — and an `on-` token on the wrong
 * ground is the failure AGENTS.md measured on the calendar's nomination chip, where a chip
 * rendered, took up space, was a link, and had no readable text in either theme.
 *
 * A `className` prop would put that decision at the call site, where the next surface gets it
 * wrong. Two named tones is the whole vocabulary; a third ground owes a third name here.
 *
 * ── IT RENDERS THE CHIPS WHETHER OR NOT THE CALLER MAY EDIT ────────────────────────
 * Who is in a photograph is worth reading either way. `mayEdit` withholds the ✕ and the
 * picker, not the answer — and it is resolved server-side (`GalleryRights.editAny`), so a
 * caller without it is never sent a control to hide (§5).
 */
export function PhotoTagEditor({
  photo, allMembers, mayEdit, busy, onChanged, onError, tone,
}: {
  photo: Photo
  /** Every member this caller may tag, resolved server-side. */
  allMembers: TaggablePerson[]
  mayEdit: boolean
  /** A write is already in flight somewhere on the screen. */
  busy: boolean
  onChanged: (message?: string) => void
  onError: (message: string) => void
  /** The ground this sits on. See the header — not a `className`. */
  tone: 'card' | 'scrim'
}) {
  const t = useT()
  const confirm = useConfirm()
  const [tagging, setTagging] = useState(false)
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  const dark = tone === 'scrim'

  // `matchesPersonQuery` — the SHARED matcher, so this searches accents and punctuation the
  // same way both person pickers do. Scored against the WHOLE roster minus who is already
  // tagged, never against the rendered subset.
  const untagged = allMembers.filter(m =>
    !photo.tags.some(tag => tag.person_id === m.id)
    && matchesPersonQuery(m, formatPersonName(m), query))

  function addTag(personId: string) {
    startTransition(async () => {
      const result = await tagPersonInPhoto(photo.id, personId)
      if (!result.success) { onError(result.message ?? t('gal.tagFailed')); return }
      setTagging(false); setQuery('')
      onChanged()
    })
  }

  async function removeTag(personId: string, name: string) {
    const ok = await confirm({
      title: t('gal.removeTag'),
      description: t('gal.removeTagForConfirm', { name }),
      confirmLabel: t('gal.removeTag'),
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      const result = await untagPersonFromPhoto(photo.id, personId)
      if (!result.success) { onError(result.message ?? t('gal.removeTagFailed')); return }
      onChanged()
    })
  }

  return (
    <div className="space-y-2">
      <div className={cn('flex flex-wrap items-center gap-1.5', dark && 'justify-center')}>
        {/* `tag`, not `t` — the translator is `t` in every file in this tree, and a map
            callback called `t` shadows it. See AGENTS.md's i18n section. */}
        {photo.tags.map(tag => (
          <span
            key={tag.person_id}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
              dark ? 'bg-white/20 text-white' : 'bg-brand-soft text-brand-on-soft',
            )}
          >
            {tag.person_name}
            {mayEdit && (
              <button
                type="button"
                onClick={() => removeTag(tag.person_id, tag.person_name)}
                aria-label={t('gal.removeTagForAria', { name: tag.person_name })}
                disabled={isPending || busy}
                className={dark ? 'hover:text-white/60' : 'hover:text-destructive'}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {mayEdit && !tagging && (
          <button
            type="button"
            onClick={() => { setTagging(true); setQuery('') }}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs',
              dark
                ? 'border-white/40 text-white/70 hover:text-white'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Tag className="h-3 w-3" /> {t('gal.tagSomebody')}
          </button>
        )}
      </div>

      {tagging && (
        <div
          className={cn(
            'max-w-xs space-y-1 rounded-lg border p-2',
            dark ? 'mx-auto border-white/20 bg-black/60' : 'bg-muted/30',
          )}
        >
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('gal.searchFamily')}
            className={cn('h-7 text-sm', dark && 'border-white/30 bg-white/10 text-white placeholder:text-white/50')}
            autoFocus
            aria-label={t('gal.searchToTag')}
          />
          <ul className="max-h-40 space-y-0.5 overflow-y-auto">
            {untagged.length === 0 ? (
              <li className={cn('px-2 py-1 text-xs', dark ? 'text-white/60' : 'text-muted-foreground')}>
                {t('gal.nobodyMatches')}
              </li>
            ) : untagged.slice(0, RENDER_LIMIT).map(m => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => addTag(m.id)}
                  disabled={isPending}
                  className={cn(
                    'w-full rounded px-2 py-1 text-start text-sm',
                    dark ? 'text-white hover:bg-white/15' : 'hover:bg-brand-soft',
                  )}
                >
                  {formatPersonName(m)}
                </button>
              </li>
            ))}
          </ul>
          {/* NEVER TRUNCATE QUIETLY. A list that stops at forty while LOOKING complete is how
              somebody concludes a relative is not in the family — the rule
              `PersonMultiSelect` keeps, and the reason the count is stated rather than the
              list simply ending. */}
          {untagged.length > RENDER_LIMIT && (
            <p className={cn('px-2 text-xs', dark ? 'text-white/60' : 'text-muted-foreground')}>
              {t('gal.moreKeepTyping', { n: String(untagged.length - RENDER_LIMIT) })}
            </p>
          )}
          <button
            type="button"
            onClick={() => setTagging(false)}
            className={cn('px-2 text-xs', dark ? 'text-white/60' : 'text-muted-foreground')}
          >
            {t('action.cancel')}
          </button>
        </div>
      )}
    </div>
  )
}
