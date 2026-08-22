'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/auth/guard'
import { canAny } from '@/lib/auth/permissions'
import { embedOne, type PersonNameRow } from '@/lib/supabase/embed'
import { DOCUMENT_FORMATS, isAllowedUpload, uploadRejection } from '@/lib/upload-types'

/**
 * Bylaws — `/library/bylaws`. SCAFFOLDING.
 *
 * ── WHAT IS BUILT AND WHAT IS NOT, STATED FIRST ────────────────────────────────────
 * The ask was scaffolding for a screen where a family uploads its governing documents and
 * members search inside them. This is the whole of it:
 *
 *   BUILT      an article per row, the file in the `documents` bucket, a full-text index over
 *              the row, and a search that uses it.
 *   BUILT      plain-text formats are READ ON UPLOAD, so a `.txt` or `.csv` bylaw is
 *              searchable by its contents from the moment it lands.
 *   NOT BUILT  extraction from PDF and Word — which is where a real family's bylaws live.
 *              Those upload, store, download and are searchable by TITLE, ARTICLE and SUMMARY
 *              only. `indexedState` reports which of the two a row is and the screen prints
 *              it, because "no result" and "not indexed" are different facts and only one of
 *              them means the search worked.
 *
 * `bylaws.content_text` exists and is inside the generated `search_vector`, so turning
 * extraction on is a job that writes that one column: no migration, no reindex, no change
 * here beyond `extractText`.
 *
 * ── THE BOUNDARY IS THE SAME ONE MEETING MINUTES USES ──────────────────────────────
 * One SELECT policy — family and approval — and NO write policy, so §2c denies INSERT, UPDATE
 * and DELETE to the browser outright. Every write below is on the admin client with
 * `.eq('family_code', …)` by hand (§3), behind `library/bylaws:create` / `:delete` at
 * `canAny`. A guard trigger refuses a cross-family uploader underneath (§4).
 *
 * READ BY THE WHOLE FAMILY, which is the feature rather than a default: bylaws are the rules
 * the family agreed to live by, and a rule nobody may read is not one.
 */

export interface Bylaw {
  id: string
  title: string
  article: string | null
  summary: string | null
  filePath: string | null
  mimeType: string | null
  fileSizeBytes: number | null
  sortOrder: number
  uploadedByName: string | null
  createdAt: string
  /** A signed-in member's link to the file, or null where the row is text only. */
  downloadUrl: string | null
  /**
   * Whether the DOCUMENT'S TEXT is in the index, or only its title and summary.
   *
   * `'full'`  the text was extracted and a search reaches inside it
   * `'title'` a PDF or Word file the scaffolding cannot read yet
   * `'text'`  a row with no file at all — somebody typed the article in
   */
  indexedState: 'full' | 'title' | 'text'
}

/**
 * How much of an uploaded file this scaffolding can read.
 *
 * PLAIN TEXT ONLY, and deliberately narrow: a `.docx` is a zip and a `.pdf` is a container
 * format, and half-reading either produces a column full of binary noise that the search index
 * then matches on. Answering NULL is the honest outcome, and `indexedState` is what tells the
 * reader which they have.
 *
 * THE CAP IS ON WHAT IS INDEXED, not on what is stored. A tsvector has a hard ceiling of about
 * 1 MB and Postgres raises rather than truncating, so a long document would otherwise fail its
 * INSERT with `string is too long for tsvector` — a raw error, on an upload that looked fine.
 */
const INDEXABLE_MIME = ['text/plain', 'text/csv', 'text/markdown']
const MAX_INDEXED_CHARS = 200_000

async function extractText(file: File): Promise<string | null> {
  const type = (file.type || '').toLowerCase().split(';')[0].trim()
  const name = file.name.toLowerCase()
  const looksPlain = INDEXABLE_MIME.includes(type)
    || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv')
  if (!looksPlain) return null
  try {
    const text = await file.text()
    return text.slice(0, MAX_INDEXED_CHARS).trim() || null
  } catch (e) {
    // NOT FATAL. A file that cannot be read is one that is searchable by title, which is the
    // same outcome as a PDF — so the upload proceeds and the row says so.
    console.error(`[bylaws] could not read ${file.name} for indexing: ${(e as Error).message}`)
    return null
  }
}

function stateOf(row: { file_path: unknown; content_text: unknown }): Bylaw['indexedState'] {
  if (!row.file_path) return 'text'
  return row.content_text ? 'full' : 'title'
}

/**
 * The family's bylaws, in the order they set, or the ones matching a search.
 *
 * ── THE SEARCH IS `websearch_to_tsquery` AND NOT `ilike` ───────────────────────────
 * It is what the GIN index on `search_vector` can answer, and it takes the syntax a reader
 * already knows from a search box: quoted phrases, `or`, and a leading `-` to exclude. An
 * `ilike '%…%'` would match substrings inside words ("art" finding "quarterly") and could not
 * use the index at all.
 *
 * A BLANK QUERY IS NOT A SEARCH and returns everything in the family's own order, which is what
 * a table of contents wants. `websearch_to_tsquery('')` matches nothing, so the empty case has
 * to be a different query rather than a different argument.
 */
export async function getBylaws(query?: string): Promise<Bylaw[]> {
  const g = await requireMember()
  if (!g.ok) return []

  const supabase = await createClient()
  let q = supabase
    .from('bylaws')
    // ONE path to `people` (`uploaded_by`), so a bare embed is unambiguous today. Stated
    // because §8's rule is that a foreign key added anywhere can make this PGRST201, which
    // arrives as `[]` with the error discarded.
    .select('*, people(first_name, last_name)')

  const search = (query ?? '').trim()
  if (search) {
    q = q.textSearch('search_vector', search, { type: 'websearch', config: 'english' })
  }

  const { data, error } = await q.order('sort_order').order('created_at')
  if (error) {
    console.error(`[bylaws] read failed for ${g.familyCode}: ${error.message}`)
    return []
  }

  return ((data ?? []) as Record<string, unknown>[]).map(r => {
    const path = (r.file_path as string | null) ?? null
    const { data: { publicUrl } } = supabase.storage
      .from('documents').getPublicUrl(path ?? '')
    return {
      id: r.id as string,
      title: r.title as string,
      article: (r.article as string | null) ?? null,
      summary: (r.summary as string | null) ?? null,
      filePath: path,
      mimeType: (r.mime_type as string | null) ?? null,
      fileSizeBytes: (r.file_size_bytes as number | null) ?? null,
      sortOrder: (r.sort_order as number | null) ?? 0,
      uploadedByName: (() => {
        const p = embedOne<PersonNameRow>(r.people)
        return p ? `${p.first_name} ${p.last_name}`.trim() || null : null
      })(),
      createdAt: r.created_at as string,
      downloadUrl: path ? publicUrl : null,
      indexedState: stateOf(r as { file_path: unknown; content_text: unknown }),
    }
  })
}

/** May the caller add or remove a bylaw? For the controls, never for the gate. */
export async function getBylawRights(): Promise<{ create: boolean; remove: boolean }> {
  const g = await requireMember()
  if (!g.ok) return { create: false, remove: false }
  const [create, remove] = await Promise.all([
    canAny(g.userId, 'library/bylaws', 'create'),
    canAny(g.userId, 'library/bylaws', 'delete'),
  ])
  return { create, remove }
}

/**
 * Add an article, with or without a file.
 *
 * ── THE FILE IS OPTIONAL, WHICH IS NOT AN OVERSIGHT ────────────────────────────────
 * A family may type an article in — that is the version that is fully searchable today, and it
 * is the honest recommendation while extraction is unbuilt. The screen says so.
 */
export async function addBylaw(formData: FormData): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!(await canAny(g.userId, 'library/bylaws', 'create'))) {
    return { success: false, message: 'Not authorized' }
  }

  const title = (formData.get('title') as string | null)?.trim()
  const article = (formData.get('article') as string | null)?.trim() || null
  const summary = (formData.get('summary') as string | null)?.trim() || null
  const typedText = (formData.get('text') as string | null)?.trim() || null
  const file = formData.get('file') as File | null

  if (!title) return { success: false, message: 'Give the article a title' }

  let filePath: string | null = null
  let mimeType: string | null = null
  let fileSize: number | null = null
  let contentText: string | null = typedText

  const supabase = await createClient()
  if (file && file.size > 0) {
    if (!isAllowedUpload(file.name, file.type, DOCUMENT_FORMATS)) {
      return { success: false, message: uploadRejection(file.name, DOCUMENT_FORMATS) }
    }
    if (file.size > 25 * 1024 * 1024) {
      return { success: false, message: 'The file must be under 25 MB.' }
    }
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    // UNDER `<family>/bylaws/`, which keeps the storage policy's first-segment family check
    // satisfied while separating these from ordinary documents in the bucket listing.
    filePath = `${g.familyCode}/bylaws/${crypto.randomUUID()}${ext}`
    mimeType = file.type || null
    fileSize = file.size

    const { error: uploadError } = await supabase.storage
      .from('documents').upload(filePath, file, { contentType: file.type || undefined })
    if (uploadError) return { success: false, message: uploadError.message }

    // TYPED TEXT WINS over extracted text, because somebody who pasted the article in meant
    // that to be the searchable version.
    contentText = typedText ?? await extractText(file)
  }

  const admin = createAdminClient()
  const { error } = await admin.from('bylaws').insert({
    family_code: g.familyCode,
    title,
    article,
    summary,
    content_text: contentText,
    file_path: filePath,
    mime_type: mimeType,
    file_size_bytes: fileSize,
    uploaded_by: g.personId || null,
  })
  if (error) {
    if (filePath) await supabase.storage.from('documents').remove([filePath])
    return { success: false, message: error.message }
  }

  revalidatePath('/library/bylaws')
  return { success: true }
}

export async function deleteBylaw(id: string): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!(await canAny(g.userId, 'library/bylaws', 'delete'))) {
    return { success: false, message: 'Not authorized' }
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('bylaws').select('file_path').eq('id', id).eq('family_code', g.familyCode).maybeSingle()
  const row = (data ?? null) as { file_path: string | null } | null
  if (!row) return { success: false, message: 'Not found' }

  const { error } = await admin
    .from('bylaws').delete().eq('id', id).eq('family_code', g.familyCode)
  if (error) return { success: false, message: error.message }

  // Storage after the row, and not fatal — the same ordering `deleteDocument` uses: a failed
  // object delete leaves a file nothing points at, while the reverse leaves a row pointing at
  // nothing.
  if (row.file_path) await admin.storage.from('documents').remove([row.file_path])

  revalidatePath('/library/bylaws')
  return { success: true }
}
