'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode } from '@/lib/auth/family'
import { createAdminClient } from '@/lib/supabase/admin'

export interface DocumentRecord {
  id: string
  name: string
  description: string | null
  file_path: string
  file_size_bytes: number | null
  mime_type: string | null
  category: string
  scope: string
  uploaded_by_name: string | null
  created_at: string
  download_url: string
}

const CATEGORIES = ['minutes', 'bylaws', 'forms', 'photos', 'other'] as const

export async function getDocuments(category?: string): Promise<DocumentRecord[]> {
  const supabase = await createClient()
  let query = supabase
    .from('documents')
    .select('*, people(first_name, last_name)')
    .order('created_at', { ascending: false })

  if (category && CATEGORIES.includes(category as typeof CATEGORIES[number])) {
    query = query.eq('category', category)
  }

  const { data } = await query

  return (data ?? []).map(d => {
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(d.file_path)
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      file_path: d.file_path,
      file_size_bytes: d.file_size_bytes,
      mime_type: d.mime_type,
      category: d.category,
      scope: d.scope,
      uploaded_by_name: d.people
        ? `${(d.people as { first_name: string; last_name: string }).first_name} ${(d.people as { first_name: string; last_name: string }).last_name}`
        : null,
      created_at: d.created_at,
      download_url: publicUrl,
    }
  })
}

export async function uploadDocument(
  formData: FormData
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode = await getMyFamilyCode(user.id)

  const file = formData.get('file') as File | null
  const name = (formData.get('name') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() || null
  const category = (formData.get('category') as string | null) ?? 'other'

  if (!file || file.size === 0) return { success: false, message: 'No file provided' }
  if (!name) return { success: false, message: 'Document name is required' }

  const ext = file.name.split('.').pop() ?? 'bin'
  const docId = crypto.randomUUID()
  const filePath = `${familyCode}/${docId}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file, { contentType: file.type })

  if (uploadError) return { success: false, message: uploadError.message }

  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()

  const { error: dbError } = await supabase.from('documents').insert({
    family_code: familyCode,
    name,
    description,
    file_path: filePath,
    file_size_bytes: file.size,
    mime_type: file.type,
    category,
    uploaded_by: myPerson?.id ?? null,
  })

  if (dbError) {
    await supabase.storage.from('documents').remove([filePath])
    return { success: false, message: dbError.message }
  }

  revalidatePath('/documents')
  revalidatePath('/admin/documents')
  return { success: true }
}

export async function deleteDocument(id: string, filePath: string): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  await admin.storage.from('documents').remove([filePath])
  const { error } = await admin.from('documents').delete().eq('id', id)
  if (error) return { success: false, message: error.message }
  revalidatePath('/documents')
  revalidatePath('/admin/documents')
  return { success: true }
}
