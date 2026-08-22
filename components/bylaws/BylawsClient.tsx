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
import { addBylaw, deleteBylaw, getBylaws, type Bylaw } from '@/app/actions/bylaws'

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
        ? 'The article and its file are removed for everyone. This cannot be undone.'
        : 'The article is removed for everyone. This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await deleteBylaw(b.id)
      if (!result.success) { setError(result.message ?? 'Could not delete that.'); return }
      setBylaws(await getBylaws(searched))
      router.refresh()
    })
  }

  const notIndexed = bylaws.filter(b => b.indexedState === 'title').length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-3xl font-bold">Bylaws</h1>
          <p className="text-muted-foreground">
            The rules the family agreed to live by. Search them, or read them in order.
          </p>
        </div>
        {rights.create && (
          <Button onClick={() => { setAdding(true); setError('') }}><Plus /> Add an article</Button>
        )}
      </div>

      {/* A REAL FORM, so Enter submits — which is what somebody typing in a search box does. */}
      <form className="flex flex-wrap items-end gap-2"
        onSubmit={e => { e.preventDefault(); search(query) }}>
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="bylaw-search" className="text-xs">Search the bylaws</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input id="bylaw-search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="quorum, &ldquo;annual meeting&rdquo;, dues -proxy" className="pl-8" />
          </div>
        </div>
        <Button type="submit" variant="secondary" disabled={isPending}>Search</Button>
        {searched && (
          <Button type="button" variant="ghost" disabled={isPending}
            onClick={() => { setQuery(''); search('') }}>
            Clear
          </Button>
        )}
      </form>

      <p className="text-xs text-muted-foreground">
        Whole words and phrases, and a leading minus excludes one. It reaches inside a document
        only where the text could be read — see the badge on each article.
      </p>

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
            {searched ? 'Nothing matches that.' : 'No bylaws recorded yet.'}
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
            {searched
              ? 'Try a different word. A PDF that has not been read is only matched on its title and summary.'
              : 'Add each article with its text, or upload the document. Pasting the text in is what makes it searchable today.'}
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
                    {b.uploadedByName && <span>· added by {b.uploadedByName}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {b.downloadUrl && (
                    <a href={b.downloadUrl} target="_blank" rel="noopener noreferrer"
                      aria-label={`Download ${b.title}`} title="Download"
                      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {rights.remove && (
                    <button type="button" onClick={() => remove(b)} disabled={isPending}
                      aria-label={`Delete ${b.title}`} title="Delete"
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
  if (state === 'full') {
    return <span className="text-brand-on-soft">Searchable in full</span>
  }
  if (state === 'text') {
    return <span className="text-brand-on-soft">Typed in — searchable in full</span>
  }
  return (
    <span className="inline-flex items-center gap-1 text-brand-withheld">
      <FileWarning className="h-3 w-3" /> Title and summary only — the file&rsquo;s text has not been read
    </span>
  )
}

function AddDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
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
    if (!title.trim()) { setError('Give the article a title'); return }
    setError(''); setBusy(true)
    const fd = new FormData()
    fd.append('title', title.trim())
    fd.append('article', article)
    fd.append('summary', summary)
    fd.append('text', text)
    if (file) fd.append('file', file)
    const result = await addBylaw(fd)
    setBusy(false)
    if (!result.success) { setError(result.message ?? 'Could not add that.'); return }
    onAdded()
  }

  return (
    <Dialog open onClose={busy ? () => {} : onClose} title="Add an article"
      description="Type the text in to make it searchable, upload the document, or both."
      className="max-w-lg">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="bylaw-article">Article (optional)</Label>
            <Input id="bylaw-article" value={article} onChange={e => setArticle(e.target.value)}
              placeholder="Article IV" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bylaw-title">Title</Label>
            <Input id="bylaw-title" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Meetings and quorum" autoFocus />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bylaw-summary">Summary (optional)</Label>
          <Input id="bylaw-summary" value={summary} onChange={e => setSummary(e.target.value)}
            placeholder="What this article covers" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bylaw-text">The text (optional)</Label>
          <Textarea id="bylaw-text" value={text} rows={6}
            onChange={e => setText(e.target.value)}
            placeholder="Paste the article here and every word of it becomes searchable." />
          {/* THE HONEST INSTRUCTION. Extraction from PDF and Word is not built, so pasting the
              text is not a nicety — it is the only way the search reaches inside an article
              today, and a form that did not say so would look broken later. */}
          <p className="text-xs text-muted-foreground">
            Pasting the text is what makes an article searchable word by word. A PDF or Word
            file is stored and downloadable, but its contents are not read yet.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Document (optional)</Label>
          <input ref={inputRef} type="file" className="hidden"
            accept={acceptAttribute(DOCUMENT_FORMATS)}
            onChange={e => { setFile(e.target.files?.[0] ?? null); setError('') }} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
              Choose a file
            </Button>
            {file && (
              <span className={`text-xs ${rejected ? 'text-brand-withheld' : 'text-muted-foreground'}`}>
                {file.name}
              </span>
            )}
          </div>
          {rejected && (
            <p className="text-xs text-brand-withheld">
              That is not {formatList(DOCUMENT_FORMATS)}. Choose another file.
            </p>
          )}
        </div>

        <FormError message={error} />

        <div className="flex gap-2">
          <Button size="sm" variant="affirm" onClick={submit} disabled={busy || rejected}>
            {busy ? 'Saving…' : 'Add article'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  )
}
