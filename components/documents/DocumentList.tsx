'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, FileText, Search, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { useServerState } from '@/lib/use-server-state'
import { COLLAPSING_CELL, MetaDot, RowMeta } from '@/components/ui/table-collapse'
import { DOCUMENT_FORMATS, acceptAttribute, formatList, isAllowedUpload } from '@/lib/upload-types'
import {
  deleteDocument, getDocumentDownloadUrl, uploadDocument, type DocumentRecord,
} from '@/app/actions/documents'
import { DOCUMENT_CATEGORIES, documentCategoryLabel } from '@/lib/document-categories'
import { formatInstantDate } from '@/lib/tz'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * The family's filed documents.
 *
 * ── THE UPLOAD IS A DIALOG SINCE 2026-08-22 ────────────────────────────────────────
 * It was a panel that unfolded above the list, which is the arrangement that makes a form
 * compete with the thing it is adding to: the list jumped down the page when it opened, and on
 * a phone the Upload button ended up below the fold of a form that had pushed it there. A
 * dialog has one job, has its own scroll, and pins its buttons — which is what
 * `components/ui/dialog.tsx` owns the height cap for.
 *
 * ── THE FORMAT LIST IS SHARED WITH THE SERVER ──────────────────────────────────────
 * `lib/upload-types.ts`. The `accept` attribute and the sentence under the control are both
 * DERIVED from it, and the file is checked here before it is sent — for speed of feedback, not
 * for safety. `uploadDocument` checks it again, and that is the gate: a `'use server'` export
 * is a public HTTP endpoint (AGENTS.md §2).
 *
 * ── A TABLE THAT NARROWS RATHER THAN SCROLLING SIDEWAYS ────────────────────────────
 * `COLLAPSING_CELL` on the category, the size and the date, with the same values restated in a
 * `RowMeta` under the name. Same pattern as every other table here, and for the reason
 * AGENTS.md gives: the column that scrolls off is invariably the one somebody came for.
 */
export function DocumentList({ initialDocuments, canUpload, canDeleteAny, myPersonId, zone }: {
  initialDocuments: DocumentRecord[]
  canUpload: boolean
  /** `library/documents:delete` at scope 'any' — may remove anybody's. */
  canDeleteAny: boolean
  /** The caller's own `people.id`: an uploader may always remove their own. */
  myPersonId: string | null
  /** The reader's timezone, resolved by the page. `created_at` is an instant. */
  zone: string
}) {
  const t = useT()
  const router = useRouter()
  const confirm = useConfirm()
  // `useServerState`: an uploaded file used to stay invisible until the page was left and
  // re-entered. The row is not built client-side because the uploader's name only exists once
  // the server has read the row back through its `people` embed.
  const [documents, setDocuments] = useServerState(initialDocuments)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const filtered = documents.filter(d => {
    const q = query.trim().toLowerCase()
    const matchesQuery = !q
      || d.name.toLowerCase().includes(q)
      || (d.description ?? '').toLowerCase().includes(q)
    return matchesQuery && (!categoryFilter || d.category === categoryFilter)
  })

  const mayDelete = (d: DocumentRecord) =>
    canDeleteAny || (myPersonId !== null && d.uploaded_by === myPersonId)

  async function handleDelete(doc: DocumentRecord) {
    const ok = await confirm({
      title: t('docs.deleteTitle'),
      description: `Delete “${doc.name}”? The file is removed for everyone. This cannot be undone.`,
      confirmLabel: t('docs.deleteTitle'),
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await deleteDocument(doc.id)
      if (!result.success) { setError(result.message ?? t('docs.deleteFailed')); return }
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
      router.refresh()
    })
  }

  /**
   * Fetch a fresh signed URL and hand the file over.
   *
   * ── `location.assign()`, NOT `window.open` ────────────────────────────────────────
   * The URL does not exist until the action returns, so any `window.open` here happens after
   * an `await` — outside the user-gesture window every popup blocker enforces, so it is
   * blocked for some readers and not others. Navigating to a response carrying
   * `Content-Disposition: attachment` (which is what `download: true` sets on the signed URL)
   * downloads the file and does not navigate the page away from the list.
   *
   * NOT `startTransition`, deliberately: `isPending` is shared with the delete control, and a
   * download must not disable every Delete button on the screen while it resolves. The error
   * still goes to the same `FormError`, which is the one per form (AGENTS.md).
   */
  async function handleDownload(doc: DocumentRecord) {
    setError('')
    const result = await getDocumentDownloadUrl(doc.id)
    if (!result.success || !result.url) {
      setError(result.message ?? t('docs.openFailed'))
      return
    }
    window.location.assign(result.url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="doc-search" className="text-xs">{t('action.search')}</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input id="doc-search" value={query} onChange={e => setQuery(e.target.value)}
                placeholder={t('docs.searchPh')} className="w-56 pl-8" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="doc-category" className="text-xs">{t('common.category')}</Label>
            <Select id="doc-category" value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)} className="w-40">
              <option value="">{t('common.all')}</option>
              {DOCUMENT_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>
        </div>

        {canUpload && (
          <Button onClick={() => { setUploadOpen(true); setError('') }}>
            <Upload /> {t('docs.upload')}
          </Button>
        )}
      </div>

      <FormError message={error} />

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-12 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {documents.length === 0
              ? t('docs.none')
              : t('docs.noMatches')}
          </p>
          {documents.length === 0 && (
            <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
              This is where the family&rsquo;s records live — forms, filings, signed copies.{' '}
              {formatList(DOCUMENT_FORMATS)} only.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr className="border-b">
                <th scope="col" className="px-3 py-2 font-semibold">{t('docs.document')}</th>
                <th scope="col" className={`px-3 py-2 font-semibold ${COLLAPSING_CELL}`}>{t('common.category')}</th>
                <th scope="col" className={`px-3 py-2 font-semibold ${COLLAPSING_CELL}`}>{t('common.size')}</th>
                <th scope="col" className={`px-3 py-2 font-semibold ${COLLAPSING_CELL}`}>{t('docs.filed')}</th>
                <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">{t('money.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => (
                <tr key={doc.id} className="border-b align-top last:border-0 sm:align-middle">
                  <td className="px-3 py-2.5">
                    {/* A BUTTON, not an anchor. There is no URL to put in an `href` until
                        the press: the file is in a private bucket and its signed URL is
                        minted per click (see `getDocumentDownloadUrl`). A `<button>` is
                        what this actually is, so it is keyboard-reachable and announces
                        itself honestly — the same reasoning `MainRail` gives for refusing
                        `role="tablist"`. */}
                    <button type="button" onClick={() => handleDownload(doc)}
                      className="text-left font-medium text-foreground hover:underline">
                      {doc.name}
                    </button>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground">{doc.description}</p>
                    )}
                    <RowMeta>
                      <span>{documentCategoryLabel(doc.category)}</span>
                      {doc.file_size_bytes ? <><MetaDot /><span>{formatSize(doc.file_size_bytes)}</span></> : null}
                      <MetaDot />
                      <span>{formatInstantDate(doc.created_at, zone)}</span>
                    </RowMeta>
                  </td>
                  <td className={`px-3 py-2.5 text-muted-foreground ${COLLAPSING_CELL}`}>
                    {documentCategoryLabel(doc.category)}
                  </td>
                  <td className={`px-3 py-2.5 text-muted-foreground ${COLLAPSING_CELL}`}>
                    {formatSize(doc.file_size_bytes)}
                  </td>
                  <td className={`px-3 py-2.5 text-muted-foreground ${COLLAPSING_CELL}`}>
                    {formatInstantDate(doc.created_at, zone)}
                    {doc.uploaded_by_name && (
                      <span className="block text-xs">by {doc.uploaded_by_name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="flex justify-end gap-1">
                      <button type="button" onClick={() => handleDownload(doc)}
                        aria-label={`Download ${doc.name}`} title={t('action.download')}
                        className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      {mayDelete(doc) && (
                        <button type="button" onClick={() => handleDelete(doc)} disabled={isPending}
                          aria-label={`Delete ${doc.name}`} title={t('action.delete')}
                          className="rounded-md p-1.5 text-destructive hover:bg-muted disabled:opacity-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {uploadOpen && (
        <UploadDialog
          onClose={() => setUploadOpen(false)}
          onDone={() => { setUploadOpen(false); router.refresh() }}
        />
      )}
    </div>
  )
}


function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function UploadDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useT()
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>('other')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const rejected = file !== null && !isAllowedUpload(file.name, file.type, DOCUMENT_FORMATS)

  function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null
    setFile(chosen)
    setError('')
    // The name defaults to the file's, minus its extension — which is what somebody would type
    // anyway, and the one field they cannot be bothered to fill in twice.
    if (chosen && !name.trim()) {
      const dot = chosen.name.lastIndexOf('.')
      setName(dot > 0 ? chosen.name.slice(0, dot) : chosen.name)
    }
  }

  async function submit() {
    if (!file) { setError(t('action.chooseFile')); return }
    if (!name.trim()) { setError(t('docs.needName')); return }
    setError(''); setBusy(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', name.trim())
    fd.append('description', description)
    fd.append('category', category)
    const result = await uploadDocument(fd)
    setBusy(false)
    if (!result.success) { setError(result.message ?? t('docs.uploadFailed')); return }
    onDone()
  }

  return (
    <Dialog open onClose={busy ? () => {} : onClose} title={t('docs.upload')}
      description={`${formatList(DOCUMENT_FORMATS)}, up to 25 MB.`}>
      <div className="space-y-3">
        <input ref={inputRef} type="file" className="hidden"
          accept={acceptAttribute(DOCUMENT_FORMATS)} onChange={choose} />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Upload /> {t('action.chooseFile')}
          </Button>
          {file && (
            <span className={`text-xs ${rejected ? 'text-brand-withheld' : 'text-muted-foreground'}`}>
              {file.name} · {formatSize(file.size)}
            </span>
          )}
        </div>
        {rejected && (
          <p className="text-xs text-brand-withheld">
            That is not {formatList(DOCUMENT_FORMATS)}. Choose another file.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="doc-name">{t('field.name')}</Label>
          <Input id="doc-name" value={name} onChange={e => setName(e.target.value)}
            placeholder={t('docs.namePh')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-desc">{t('field.descriptionOptional')}</Label>
          <Textarea id="doc-desc" value={description} rows={2}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('docs.descriptionPh')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-cat">{t('common.category')}</Label>
          <Select id="doc-cat" value={category} onChange={e => setCategory(e.target.value)}>
            {DOCUMENT_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>

        <FormError message={error} />

        <div className="flex gap-2">
          <Button size="sm" variant="affirm" onClick={submit} disabled={busy || rejected || !file}>
            {busy ? t('action.uploading') : t('action.upload')}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>{t('action.cancel')}</Button>
        </div>
      </div>
    </Dialog>
  )
}
