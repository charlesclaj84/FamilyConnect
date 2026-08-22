'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMember, requireOwn } from '@/lib/auth/guard'
import { canAny } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { embedOne, type PersonNameRow } from '@/lib/supabase/embed'
import { DOCUMENT_FORMATS, isAllowedUpload, uploadRejection } from '@/lib/upload-types'
import { isDocumentCategory } from '@/lib/document-categories'

/**
 * The family's documents — `/library/documents`, and `review/documents` until 2026-08-22.
 *
 * ── IT MOVED TO JOURNALS, AND THE KEY MOVED WITH IT ────────────────────────────────
 * `20260822000018` retired the Review worklist. A family's records — its filings, its forms,
 * its signed copies — sit beside the notebooks its officers keep, and the reader who wants one
 * is the reader who wants the other. Under `resources` it was in a section of two whose only
 * shared property was that you upload to both.
 *
 * ── THREE CATEGORIES, DOWN FROM FIVE ───────────────────────────────────────────────
 * `photos` and `minutes` are gone, and neither is a trim for tidiness:
 *
 *   photos    the Gallery is the screen for a photograph, and it does tagging, albums and a
 *             lightbox that this list will never do. A `photos` category here was an invitation
 *             to put family pictures somewhere they cannot be found.
 *   minutes   Meeting Minutes is a real screen now (`20260822000019`) with a secretary, an
 *             attendee list and votes. A PDF of last year's minutes filed here is a record of
 *             something that happened outside the product, which is what `other` is for.
 *
 * `bylaws` STAYS, deliberately, even though Bylaws is now its own screen: a family may well
 * file a scanned historical copy as a document, and the Bylaws screen is for the text they
 * want searched. Removing the category would strand rows that already carry it.
 *
 * THE LIST ITSELF IS IN `lib/document-categories.ts`, and it has to be: a `'use server'` file
 * may export only async functions, so an array here fails `next build` at page-data collection
 * — after `tsc` and `eslint` have both passed. That module carries the rest of the
 * argument, including why a row filed under a retired category is never rewritten.
 */

export interface DocumentRecord {
  id: string
  name: string
  description: string | null
  file_path: string
  file_size_bytes: number | null
  mime_type: string | null
  category: string
  scope: string
  uploaded_by: string | null
  uploaded_by_name: string | null
  created_at: string
  download_url: string
}

export async function getDocuments(category?: string): Promise<DocumentRecord[]> {
  const supabase = await createClient()
  let query = supabase
    .from('documents')
    .select('*, people(first_name, last_name)')
    .order('created_at', { ascending: false })

  // FILTERED ONLY ON A CATEGORY THAT IS OFFERED, so a client-supplied string cannot become a
  // query predicate. Anything else is ignored rather than refused: the caller gets the whole
  // list, which is the same answer as no filter and is the safe direction for a read.
  if (category && isDocumentCategory(category)) {
    query = query.eq('category', category)
  }

  // §8: the error is read. An empty list and a refused query render identically, and only one
  // of them is a fact about the family.
  const { data, error } = await query
  if (error) {
    console.error(`[documents] read failed: ${error.message}`)
    return []
  }

  return (data ?? []).map(d => {
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(d.file_path)
    const uploader = embedOne<PersonNameRow>(d.people)
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      file_path: d.file_path,
      file_size_bytes: d.file_size_bytes,
      mime_type: d.mime_type,
      category: d.category,
      scope: d.scope,
      uploaded_by: d.uploaded_by,
      uploaded_by_name: uploader ? `${uploader.first_name} ${uploader.last_name}` : null,
      created_at: d.created_at,
      download_url: publicUrl,
    }
  })
}

/**
 * File a document.
 *
 * ── THE FORMAT IS CHECKED HERE, WHICH IS THE ONLY PLACE IT COUNTS ──────────────────
 * Excel, Word, PDF or CSV — `lib/upload-types.ts` is the one list, and its header argues why
 * an extension and a MIME type are both required. The `accept` attribute on the input is a
 * hint a picker may ignore and a drag-and-drop bypasses entirely; a `'use server'` export is
 * a public HTTP endpoint and the form is not in its request path (AGENTS.md §2).
 *
 * ── AND THE GRANT IS CHECKED, WHICH IT WAS NOT ─────────────────────────────────────
 * Until 2026-08-22 this asked for a session and nothing else — so any signed-in member of any
 * family could file a document in their own, whatever the grid said. That is the shape the
 * Review flip found twice over on `/admin/chapters` and `/admin/boardpositions`: an action
 * module written before the permission model and never revisited, live the whole time.
 */
export async function uploadDocument(
  formData: FormData,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!(await canAny(g.userId, 'library/documents', 'create'))) {
    return { success: false, message: 'Not authorized' }
  }

  const file = formData.get('file') as File | null
  const name = (formData.get('name') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() || null
  const rawCategory = (formData.get('category') as string | null) ?? 'other'
  const category = isDocumentCategory(rawCategory) ? rawCategory : 'other'

  if (!file || file.size === 0) return { success: false, message: 'Choose a file' }
  if (!name) return { success: false, message: 'Give the document a name' }
  if (!isAllowedUpload(file.name, file.type, DOCUMENT_FORMATS)) {
    return { success: false, message: uploadRejection(file.name, DOCUMENT_FORMATS) }
  }
  if (file.size > 25 * 1024 * 1024) {
    return { success: false, message: 'The file must be under 25 MB.' }
  }

  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  const docId = crypto.randomUUID()
  const filePath = `${g.familyCode}/${docId}${ext}`

  const supabase = await createClient()
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file, { contentType: file.type || undefined })
  if (uploadError) return { success: false, message: uploadError.message }

  const { error: dbError } = await supabase.from('documents').insert({
    family_code: g.familyCode,
    name,
    description,
    file_path: filePath,
    file_size_bytes: file.size,
    mime_type: file.type,
    category,
    uploaded_by: g.personId || null,
  })

  if (dbError) {
    // The object goes back if the row did not land, or the bucket accumulates files nothing
    // points at.
    await supabase.storage.from('documents').remove([filePath])
    return { success: false, message: dbError.message }
  }

  revalidatePath('/library/documents')
  return { success: true }
}

/**
 * `filePath` is accepted for call-site compatibility and deliberately IGNORED.
 *
 * It used to be passed straight to `storage.remove()`, which — with no auth on this action —
 * was an arbitrary-file-delete: any signed-in caller could name any path in the documents
 * bucket and it would go. The path now comes from the row, and the row is found family-scoped.
 */
export async function deleteDocument(
  id: string,
  filePath?: string,
): Promise<{ success: boolean; message?: string }> {
  void filePath
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('documents').select('file_path, uploaded_by, family_code').eq('id', id).maybeSingle()
  if (!row) return { success: false, message: 'Document not found' }

  // An uploader may delete their own document; deleting somebody else's needs 'any'.
  const g = await requireOwn('library/documents', 'delete', row.uploaded_by)
  if (!g.ok) return { success: false, message: g.message }
  if (row.family_code !== g.familyCode) return { success: false, message: 'Document not found' }

  const { error } = await admin.from('documents').delete().eq('id', id).eq('family_code', g.familyCode)
  if (error) return { success: false, message: error.message }
  // Storage after the row: a failed delete then leaves a reachable file rather than a row
  // pointing at nothing.
  await admin.storage.from('documents').remove([row.file_path])
  revalidatePath('/library/documents')
  return { success: true }
}
