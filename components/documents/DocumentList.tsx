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
import { deleteDocument, uploadDocument, type DocumentRecord } from '@/app/actions/documents'
import { DOCUMENT_CATEGORIES, documentCategoryLabel } from '@/lib/document-categories'
import { formatDate } from '@/lib/date-utils'

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
export function DocumentList({ initialDocuments, canUpload, canDeleteAny, myPersonId }: {
  initialDocuments: DocumentRecord[]
  canUpload: boolean
  /** `journals/documents:delete` at scope 'any' — may remove anybody's. */
  canDeleteAny: boolean
  /** The caller's own `people.id`: an uploader may always remove their own. */
  myPersonId: string | null
}) {
  const router = useRouter()
  const confirm = useConfirm()
  // `useServerState`: an uploaded file used to stay invisible until the page was left and
  // re-entered. The row is not built client-side because two of its fields — the uploader's
  // name and the storage download URL — only exist once the server has read the row back.
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
      title: 'Delete document',
      description: `Delete “${doc.name}”? The file is removed for everyone. This cannot be undone.`,
      confirmLabel: 'Delete document',
      destructive: true,
    })
    if (!ok) return
    setError('')
    startTransition(async () => {
      const result = await deleteDocument(doc.id)
      if (!result.success) { setError(result.message ?? 'Could not delete that.'); return }
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="doc-search" className="text-xs">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input id="doc-search" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Name or description…" className="w-56 pl-8" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="doc-category" className="text-xs">Category</Label>
            <Select id="doc-category" value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)} className="w-40">
              <option value="">All</option>
              {DOCUMENT_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>
        </div>

        {canUpload && (
          <Button onClick={() => { setUploadOpen(true); setError('') }}>
            <Upload /> Upload a document
          </Button>
        )}
      </div>

      <FormError message={error} />

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-12 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {documents.length === 0
              ? 'No documents filed yet.'
              : 'No documents match that.'}
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
                <th scope="col" className="px-3 py-2 font-semibold">Document</th>
                <th scope="col" className={`px-3 py-2 font-semibold ${COLLAPSING_CELL}`}>Category</th>
                <th scope="col" className={`px-3 py-2 font-semibold ${COLLAPSING_CELL}`}>Size</th>
                <th scope="col" className={`px-3 py-2 font-semibold ${COLLAPSING_CELL}`}>Filed</th>
                <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => (
                <tr key={doc.id} className="border-b align-top last:border-0 sm:align-middle">
                  <td className="px-3 py-2.5">
                    <a href={doc.download_url} target="_blank" rel="noopener noreferrer"
                      className="font-medium text-foreground hover:underline">
                      {doc.name}
                    </a>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground">{doc.description}</p>
                    )}
                    <RowMeta>
                      <span>{documentCategoryLabel(doc.category)}</span>
                      {doc.file_size_bytes ? <><MetaDot /><span>{formatSize(doc.file_size_bytes)}</span></> : null}
                      <MetaDot />
                      <span>{formatDate(doc.created_at)}</span>
                    </RowMeta>
                  </td>
                  <td className={`px-3 py-2.5 text-muted-foreground ${COLLAPSING_CELL}`}>
                    {documentCategoryLabel(doc.category)}
                  </td>
                  <td className={`px-3 py-2.5 text-muted-foreground ${COLLAPSING_CELL}`}>
                    {formatSize(doc.file_size_bytes)}
                  </td>
                  <td className={`px-3 py-2.5 text-muted-foreground ${COLLAPSING_CELL}`}>
                    {formatDate(doc.created_at)}
                    {doc.uploaded_by_name && (
                      <span className="block text-xs">by {doc.uploaded_by_name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="flex justify-end gap-1">
                      <a href={doc.download_url} target="_blank" rel="noopener noreferrer"
                        aria-label={`Download ${doc.name}`} title="Download"
                        className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      {mayDelete(doc) && (
                        <button type="button" onClick={() => handleDelete(doc)} disabled={isPending}
                          aria-label={`Delete ${doc.name}`} title="Delete"
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
    if (!file) { setError('Choose a file'); return }
    if (!name.trim()) { setError('Give the document a name'); return }
    setError(''); setBusy(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', name.trim())
    fd.append('description', description)
    fd.append('category', category)
    const result = await uploadDocument(fd)
    setBusy(false)
    if (!result.success) { setError(result.message ?? 'Upload failed'); return }
    onDone()
  }

  return (
    <Dialog open onClose={busy ? () => {} : onClose} title="Upload a document"
      description={`${formatList(DOCUMENT_FORMATS)}, up to 25 MB.`}>
      <div className="space-y-3">
        <input ref={inputRef} type="file" className="hidden"
          accept={acceptAttribute(DOCUMENT_FORMATS)} onChange={choose} />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Upload /> Choose a file
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
          <Label htmlFor="doc-name">Name</Label>
          <Input id="doc-name" value={name} onChange={e => setName(e.target.value)}
            placeholder="2026 Membership Form" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-desc">Description (optional)</Label>
          <Textarea id="doc-desc" value={description} rows={2}
            onChange={e => setDescription(e.target.value)}
            placeholder="What it is, and who needs it" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-cat">Category</Label>
          <Select id="doc-cat" value={category} onChange={e => setCategory(e.target.value)}>
            {DOCUMENT_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>

        <FormError message={error} />

        <div className="flex gap-2">
          <Button size="sm" variant="affirm" onClick={submit} disabled={busy || rejected || !file}>
            {busy ? 'Uploading…' : 'Upload'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  )
}
