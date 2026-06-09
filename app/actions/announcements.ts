'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface Announcement {
  id: string
  title: string
  body: string
  scope: string
  pinned: boolean
  published_at: string
  author_name: string | null
  chapter_id: string | null
  chapter_name: string | null
}

export interface AnnouncementInput {
  title: string
  body: string
  scope: 'national' | 'regional' | 'chapter'
  pinned: boolean
  chapter_id?: string | null
}

export interface Chapter {
  id: string
  name: string
}

export async function getChapters(): Promise<Chapter[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('chapters').select('id, name').order('name')
  return data ?? []
}

function mapAnnouncement(a: {
  id: string; title: string; body: string; scope: string; pinned: boolean; published_at: string;
  chapter_id: string | null; people: unknown; chapters: unknown
}): Announcement {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    scope: a.scope,
    pinned: a.pinned,
    published_at: a.published_at,
    chapter_id: a.chapter_id,
    chapter_name: a.chapters ? (a.chapters as { name: string }).name : null,
    author_name: a.people
      ? `${(a.people as { first_name: string; last_name: string }).first_name} ${(a.people as { first_name: string; last_name: string }).last_name}`
      : null,
  }
}

// Admin: all announcements for the family, no chapter filter
export async function getAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('announcements')
    .select('id, title, body, scope, pinned, published_at, chapter_id, people(first_name, last_name), chapters(name)')
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(50)

  return (data ?? []).map(a => mapAnnouncement(a as Parameters<typeof mapAnnouncement>[0]))
}

// Member: only national/regional + chapter-matching announcements
export async function getMyAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: myPerson } = await supabase
    .from('people').select('chapter_id').eq('user_id', user.id).maybeSingle()
  const myChapterId: string | null = (myPerson as { chapter_id: string | null } | null)?.chapter_id ?? null

  const { data } = await supabase
    .from('announcements')
    .select('id, title, body, scope, pinned, published_at, chapter_id, people(first_name, last_name), chapters(name)')
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(50)

  const raw = (data ?? []) as Parameters<typeof mapAnnouncement>[0][]
  return raw
    .filter(a => {
      if (a.scope === 'national' || a.scope === 'regional') return true
      if (a.scope === 'chapter') {
        if (!a.chapter_id) return true  // unscoped chapter announcements shown to all
        return a.chapter_id === myChapterId
      }
      return true
    })
    .map(mapAnnouncement)
}

export async function getPinnedAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: myPerson } = await supabase
    .from('people').select('chapter_id').eq('user_id', user.id).maybeSingle()
  const myChapterId: string | null = (myPerson as { chapter_id: string | null } | null)?.chapter_id ?? null

  const { data } = await supabase
    .from('announcements')
    .select('id, title, body, scope, pinned, published_at, chapter_id, people(first_name, last_name), chapters(name)')
    .eq('pinned', true)
    .order('published_at', { ascending: false })
    .limit(10)

  const raw = (data ?? []) as Parameters<typeof mapAnnouncement>[0][]
  return raw
    .filter(a => {
      if (a.scope === 'national' || a.scope === 'regional') return true
      if (a.scope === 'chapter') return !a.chapter_id || a.chapter_id === myChapterId
      return true
    })
    .map(mapAnnouncement)
    .slice(0, 2)
}

export async function createAnnouncement(
  input: AnnouncementInput
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  const familyCode: string = user.user_metadata?.family_code ?? ''
  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()

  const { error } = await supabase.from('announcements').insert({
    family_code: familyCode,
    title: input.title.trim(),
    body: input.body.trim(),
    scope: input.scope,
    pinned: input.pinned,
    chapter_id: input.scope === 'chapter' ? (input.chapter_id ?? null) : null,
    author_id: myPerson?.id ?? null,
  })

  if (error) return { success: false, message: error.message }
  revalidatePath('/announcements')
  revalidatePath('/dashboard')
  revalidatePath('/admin/announcements')
  return { success: true }
}

export async function deleteAnnouncement(
  id: string
): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('announcements').delete().eq('id', id)
  if (error) return { success: false, message: error.message }
  revalidatePath('/announcements')
  revalidatePath('/dashboard')
  revalidatePath('/admin/announcements')
  return { success: true }
}

export async function togglePinAnnouncement(
  id: string,
  pinned: boolean
): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('announcements').update({ pinned }).eq('id', id)
  if (error) return { success: false, message: error.message }
  revalidatePath('/announcements')
  revalidatePath('/dashboard')
  revalidatePath('/admin/announcements')
  return { success: true }
}
