'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, FileWarning, Plus, Scale, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { DOCUMENT_FORMATS, acceptAttribute, formatList, isAllowedUpload } from '@/lib/upload-types'
import {
  addBylaw, deleteBylaw, getBylawDownloadUrl, getBylaws, type Bylaw,
} from '@/app/actions/bylaws'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * The family's bylaws, and a search across them. SCAFFOLDING — see `app/actions/bylaws.ts`.
 *
 * ── THE SCREEN SAYS WHAT THE SEARCH CAN AND CANNOT REACH ───────────────────────────
 * The one thing this scaffolding must not do is look finished. A PDF uploaded today is
 * searchable by its TITLE and SUMMARY and not by its contents, so:
 *
 *   * every row carries a badge saying which of the two it is, and
 *   * the empty-result state says it out loud rather than reporting "no matches",
 *
 * because "no result" and "not indexed" are different facts and a reader who cannot tell them
 * apart concludes the bylaws do not say the thing they are looking for.
 *
 * ── THE SEARCH IS A ROUND TRIP AND NOT A CLIENT FILTER ─────────────────────────────
 * It is `websearch_to_tsquery` against the GIN index, so it stems ("meetings" finds "meeting"),
 * takes quoted phrases, and reaches inside a document's text where there is text to reach. A
 * client-side `.includes()` over the loaded rows could do none of those and would silently
 * search only what had already been sent.
 */
export function BylawsClient({ initialBylaws, rights }: {
  initialBylaws: Bylaw[]
  rights: { create: boolean; remove: boolean }
}) {
  const t = useT()
  const router = useRouter()
  const confirm = useConfirm()
  const [bylaws, setBylaws] = useState(initialBylaws)
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function search(next: string) {
    setError('')
    startTransition(async () => {
      setBylaws(await getBylaws(next))
      setSearched(next.trim())
    })
  }

  async function remove(b: Bylaw) {
    const ok = await confirm({
      title: `Delete “${b.title}”?`,
      description: b.filePath
        ? t('bylaws.deleteWithFile')
        : t('bylaws.deleteNoFile'),
      confirmLabel: t('action.delete'),
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await deleteBylaw(b.id)
      if (!result.success) { setError(result.message ?? t('bylaws.deleteFailed')); return }
      setBylaws(await getBylaws(searched))
      router.refresh()
    })
  }

  /**
   * Fetch a fresh signed URL and hand the file over.
   *
   * The file lives in a PRIVATE bucket, so there is no URL to put in an `href` until the press
   * — see `getBylawDownloadUrl`. `location.assign()` rather than `window.open` because the
   * open would land after an `await`, outside the gesture window a popup blocker enforces; the
   * signed response carries `Content-Disposition: attachment`, so the page does not navigate.
   *
   * Outside `startTransition` on purpose: `isPending` disables Search and every Delete on the
   * screen, and opening a file is not a reason to do that.
   */
  async function download(b: Bylaw) {
    setError('')
    const result = await getBylawDownloadUrl(b.id)
    if (!result.success || !result.url) {
      setError(result.message ?? t('bylaws.openFailed'))
      return
    }
    window.location.assign(result.url)
  }

  const notIndexed = bylaws.filter(b => b.indexedState === 'title').length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-3xl font-bold">{t('bylaws.heading')}</h1>
          <p className="text-muted-foreground">
            {t('bylaws.lede')}
          </p>
        </div>
        {rights.create && (
          <Button onClick={() => { setAdding(true); setError('') }}><Plus /> {t('bylaws.addArticle')}</Button>
        )}
      </div>

      {/* A REAL FORM, so Enter submits — which is what somebody typing in a search box does. */}
      <form className="flex flex-wrap items-end gap-2"
        onSubmit={e => { e.preventDefault(); search(query) }}>
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="bylaw-search" className="text-xs">{t('bylaws.searchLabel')}</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input id="bylaw-search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder={t('bylaws.searchPh')} className="pl-8" />
          </div>
        </div>
        <Button type="submit" variant="secondary" disabled={isPending}>{t('action.search')}</Button>
        {searched && (
          <Button type="button" variant="ghost" disabled={isPending}
            onClick={() => { setQuery(''); search('') }}>
            {t('action.clear')}
          </Button>
        )}
      </form>

      <p className="text-xs text-muted-foreground">{t('ui.wholeWordsPhrasesLeading')}</p>

      <FormError message={error} />

      {searched && (
        <p className="text-sm text-muted-foreground">
          {bylaws.length} article{bylaws.length === 1 ? '' : 's'} match &ldquo;{searched}&rdquo;.
          {/* THE HONEST CAVEAT, and only when it applies to something. Without this a reader
              who searched a word that IS in an unindexed PDF concludes the bylaws do not say
              it. */}
          {notIndexed > 0 && ' Articles whose file could not be read are matched on their title and summary only.'}
        </p>
      )}

      {bylaws.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-14 text-center">
          <Scale className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {searched ? t('bylaws.noMatches') : t('bylaws.none')}
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
            {searched
              ? t('bylaws.tryAnother')
              : t('bylaws.addEachHint')}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {bylaws.map(b => (
            <li key={b.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    {b.article && (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-on-soft">
                        {b.article}
                      </span>
                    )}
                    <span className="font-medium">{b.title}</span>
                  </p>
                  {b.summary && (
                    <p className="mt-1 text-sm text-muted-foreground">{b.summary}</p>
                  )}
                  <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <IndexBadge state={b.indexedState} />
                    {b.uploadedByName && (
                      <span>{t('law.addedBy', { name: b.uploadedByName })}</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {b.hasFile && (
                    <button type="button" onClick={() => download(b)}
                      aria-label={`Download ${b.title}`} title={t('action.download')}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {rights.remove && (
                    <button type="button" onClick={() => remove(b)} disabled={isPending}
                      aria-label={`Delete ${b.title}`} title={t('action.delete')}
                      className="rounded-md p-1.5 text-destructive hover:bg-muted disabled:opacity-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <AddDialog onClose={() => setAdding(false)}
          onAdded={() => { setAdding(false); search(searched); router.refresh() }} />
      )}
    </div>
  )
}

/** Which half of the scaffolding a row is in. See `app/actions/bylaws.ts`. */
function IndexBadge({ state }: { state: Bylaw['indexedState'] }) {
  const t = useT()
  if (state === 'full') {
    return <span className="text-brand-on-soft">{t('bylaws.indexedFull')}</span>
  }
  if (state === 'text') {
    return <span className="text-brand-on-soft">{t('bylaws.typedIn')}</span>
  }
  return (
    <span className="inline-flex items-center gap-1 text-brand-withheld">
      <FileWarning className="h-3 w-3" /> {t('bylaws.titleOnly')}
    </span>
  )
}

function AddDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const t = useT()
  const [title, setTitle] = useState('')
  const [article, setArticle] = useState('')
  const [summary, setSummary] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const rejected = file !== null && !isAllowedUpload(file.name, file.type, DOCUMENT_FORMATS)

  async function submit() {
    if (!title.trim()) { setError(t('bylaws.needTitle')); return }
    setError(''); setBusy(true)
    const fd = new FormData()
    fd.append('title', title.trim())
    fd.append('article', article)
    fd.append('summary', summary)
    fd.append('text', text)
    if (file) fd.append('file', file)
    const result = await addBylaw(fd)
    setBusy(false)
    if (!result.success) { setError(result.message ?? t('bylaws.addFailed')); return }
    onAdded()
  }

  return (
    <Dialog open onClose={busy ? () => {} : onClose} title={t('bylaws.addArticle')}
      description={t('bylaws.eitherHint')}
      className="max-w-lg">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="bylaw-article">{t('bylaws.articleOptional')}</Label>
            <Input id="bylaw-article" value={article} onChange={e => setArticle(e.target.value)}
              placeholder={t('bylaws.articlePh')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bylaw-title">{t('field.title')}</Label>
            <Input id="bylaw-title" value={title} onChange={e => setTitle(e.target.value)}
              placeholder={t('bylaws.titlePh')} autoFocus />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bylaw-summary">{t('bylaws.summaryOptional')}</Label>
          <Input id="bylaw-summary" value={summary} onChange={e => setSummary(e.target.value)}
            placeholder={t('bylaws.summaryPh')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bylaw-text">{t('bylaws.textOptional')}</Label>
          <Textarea id="bylaw-text" value={text} rows={6}
            onChange={e => setText(e.target.value)}
            placeholder={t('bylaws.textPh')} />
          {/* THE HONEST INSTRUCTION. Extraction from PDF and Word is not built, so pasting the
              text is not a nicety — it is the only way the search reaches inside an article
              today, and a form that did not say so would look broken later. */}
          <p className="text-xs text-muted-foreground">{t('ui.pastingTextWhatMakes')}</p>
        </div>

        <div className="space-y-1.5">
          <Label>{t('bylaws.documentOptional')}</Label>
          <input ref={inputRef} type="file" className="hidden"
            accept={acceptAttribute(DOCUMENT_FORMATS)}
            onChange={e => { setFile(e.target.files?.[0] ?? null); setError('') }} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
              {t('action.chooseFile')}
            </Button>
            {file && (
              <span className={`text-xs ${rejected ? 'text-brand-withheld' : 'text-muted-foreground'}`}>
                {file.name}
              </span>
            )}
          </div>
          {rejected && (
            <p className="text-xs text-brand-withheld">
              {t('law.notADocumentFormat', { formats: formatList(DOCUMENT_FORMATS) })}
            </p>
          )}
        </div>

        <FormError message={error} />

        <div className="flex gap-2">
          <Button size="sm" variant="affirm" onClick={submit} disabled={busy || rejected}>
            {busy ? t('action.saving') : t('bylaws.addArticleAction')}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>{t('action.cancel')}</Button>
        </div>
      </div>
    </Dialog>
  )
}
