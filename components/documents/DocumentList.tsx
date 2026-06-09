'use client'

import { useState, useTransition, useRef } from 'react'
import { FileText, Download, Trash2, Upload, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { uploadDocument, deleteDocument, type DocumentRecord } from '@/app/actions/documents'

const CATEGORIES = [
  { value: 'minutes', label: 'Meeting Minutes' },
  { value: 'bylaws', label: 'Bylaws' },
  { value: 'forms', label: 'Forms' },
  { value: 'photos', label: 'Photos' },
  { value: 'other', label: 'Other' },
]

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

interface Props {
  initialDocuments: DocumentRecord[]
  isAdmin: boolean
}

export function DocumentList({ initialDocuments, isAdmin }: Props) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [fileName, setFileName] = useState('')
  const [fileDescription, setFileDescription] = useState('')
  const [fileCategory, setFileCategory] = useState('other')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = documents.filter(d => {
    const matchesQuery = !query || d.name.toLowerCase().includes(query.toLowerCase())
    const matchesCategory = !categoryFilter || d.category === categoryFilter
    return matchesQuery && matchesCategory
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    if (!fileName) setFileName(file.name.split('.').slice(0, -1).join('.') || file.name)
  }

  function handleUpload() {
    if (!selectedFile || !fileName.trim()) { setError('File and name are required'); return }
    setError('')
    const fd = new FormData()
    fd.append('file', selectedFile)
    fd.append('name', fileName.trim())
    fd.append('description', fileDescription)
    fd.append('category', fileCategory)
    startTransition(async () => {
      const result = await uploadDocument(fd)
      if (!result.success) { setError(result.message ?? 'Upload failed'); return }
      setShowUpload(false); setFileName(''); setFileDescription(''); setSelectedFile(null)
    })
  }

  function handleDelete(doc: DocumentRecord) {
    startTransition(async () => {
      await deleteDocument(doc.id, doc.file_path)
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search documents…" value={query} onChange={e => setQuery(e.target.value)} className="pl-8" />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowUpload(s => !s)}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Upload
          </Button>
        )}
      </div>

      {showUpload && isAdmin && (
        <div className="rounded-xl border bg-card p-4 space-y-3 max-w-lg">
          <h3 className="font-semibold text-sm">Upload Document</h3>
          <div className="space-y-1.5">
            <Label>File</Label>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" type="button" onClick={() => fileRef.current?.click()}>
                {selectedFile ? selectedFile.name : 'Choose File'}
              </Button>
              {selectedFile && <span className="text-xs text-muted-foreground">{formatSize(selectedFile.size)}</span>}
            </div>
            <input ref={fileRef} type="file" className="sr-only" onChange={handleFileChange} />
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={fileName} onChange={e => setFileName(e.target.value)} placeholder="Document name" />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea rows={2} value={fileDescription} onChange={e => setFileDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={fileCategory} onChange={e => setFileCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleUpload} disabled={isPending || !selectedFile}>
              {isPending ? 'Uploading…' : 'Upload'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowUpload(false); setError('') }}>Cancel</Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          <FileText className="mx-auto h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No documents found.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border overflow-hidden">
          {filtered.map(doc => (
            <li key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {CATEGORIES.find(c => c.value === doc.category)?.label ?? doc.category}
                  {doc.file_size_bytes ? ` · ${formatSize(doc.file_size_bytes)}` : ''}
                  {doc.uploaded_by_name ? ` · ${doc.uploaded_by_name}` : ''}
                </p>
                {doc.description && <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{doc.description}</p>}
              </div>
              <div className="flex items-center gap-1">
                <a href={doc.download_url} target="_blank" rel="noreferrer" download>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </a>
                {isAdmin && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(doc)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
