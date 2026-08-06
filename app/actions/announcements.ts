'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { getMyFamilyCode } from '@/lib/auth/family'
import { requireEdit, requireOwn } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'

export interface Announcement {
  id: string
  title: string
  body: string
  scope: string
  pinned: boolean
  pinned_until: string | null
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
  pinned_until?: string | null
  chapter_id?: string | null
}

function isPinActive(a: { pinned: boolean; pinned_until?: string | null }): boolean {
  if (!a.pinned) return false
  if (!a.pinned_until) return true
  return new Date(a.pinned_until) > new Date()
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
  id: string; title: string; body: string; scope: string; pinned: boolean; pinned_until?: string | null; published_at: string;
  chapter_id: string | null; people: unknown; chapters: unknown
}): Announcement {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    scope: a.scope,
    pinned: a.pinned,
    pinned_until: a.pinned_until ?? null,
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
    .select('id, title, body, scope, pinned, pinned_until, published_at, chapter_id, people(first_name, last_name), chapters(name)')
    .order('published_at', { ascending: false })
    .limit(50)

  const mapped = (data ?? []).map(a => mapAnnouncement(a as Parameters<typeof mapAnnouncement>[0]))
  // Active pins first, then by published_at desc
  return mapped.sort((a, b) => {
    const aPin = isPinActive(a) ? 1 : 0
    const bPin = isPinActive(b) ? 1 : 0
    if (aPin !== bPin) return bPin - aPin
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  })
}

// Member: only national/regional + chapter-matching announcements
export async function getMyAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // chapter_id is per-family — resolve it in the family being viewed.
  const { data: myPerson } = await supabase
    .from('people').select('chapter_id')
    .eq('user_id', user.id)
    .eq('family_code', await getMyFamilyCode(user.id))
    .maybeSingle()
  const myChapterId: string | null = (myPerson as { chapter_id: string | null } | null)?.chapter_id ?? null

  const { data } = await supabase
    .from('announcements')
    .select('id, title, body, scope, pinned, pinned_until, published_at, chapter_id, people(first_name, last_name), chapters(name)')
    .order('published_at', { ascending: false })
    .limit(50)

  const raw = (data ?? []) as Parameters<typeof mapAnnouncement>[0][]
  const mapped = raw
    .filter(a => {
      if (a.scope === 'national' || a.scope === 'regional') return true
      if (a.scope === 'chapter') {
        if (!a.chapter_id) return true
        return a.chapter_id === myChapterId
      }
      return true
    })
    .map(mapAnnouncement)

  return mapped.sort((a, b) => {
    const aPin = isPinActive(a) ? 1 : 0
    const bPin = isPinActive(b) ? 1 : 0
    if (aPin !== bPin) return bPin - aPin
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  })
}

export async function getPinnedAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // chapter_id is per-family — resolve it in the family being viewed.
  const { data: myPerson } = await supabase
    .from('people').select('chapter_id')
    .eq('user_id', user.id)
    .eq('family_code', await getMyFamilyCode(user.id))
    .maybeSingle()
  const myChapterId: string | null = (myPerson as { chapter_id: string | null } | null)?.chapter_id ?? null

  const { data } = await supabase
    .from('announcements')
    .select('id, title, body, scope, pinned, pinned_until, published_at, chapter_id, people(first_name, last_name), chapters(name)')
    .eq('pinned', true)
    .order('published_at', { ascending: false })
    .limit(10)

  const raw = (data ?? []) as Parameters<typeof mapAnnouncement>[0][]
  return raw
    .filter(a => isPinActive(a))
    .filter(a => {
      if (a.scope === 'national' || a.scope === 'regional') return true
      if (a.scope === 'chapter') return !a.chapter_id || a.chapter_id === myChapterId
      return true
    })
    .map(mapAnnouncement)
    .slice(0, 2)
}

/**
 * Returns the new row's id so a client list can show it under its real id. Without
 * that, an optimistic row carries an invented id and the delete/pin buttons on it
 * silently address a row that does not exist.
 */
export async function createAnnouncement(
  input: AnnouncementInput
): Promise<{ success: boolean; id?: string; message?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  if (!input.title.trim() || !input.body.trim()) return { success: false, message: 'Title and message are required' }

  const familyCode = await getMyFamilyCode(user.id)
  const { data: myPerson } = await admin.from('people').select('id')
    .eq('user_id', user.id)
    .eq('family_code', familyCode)
    .maybeSingle()
  const isAdmin = await can(user.id, 'announcements', 'edit')

  // Anyone can post and target an audience (National / Regional / Chapter);
  // only admins can pin to the dashboard.
  const scope = input.scope
  const pinned = isAdmin ? input.pinned : false

  // Service-role insert so non-admin members can post (RLS limits inserts to admins).
  const { data, error } = await admin.from('announcements').insert({
    family_code: familyCode,
    title: input.title.trim(),
    body: input.body.trim(),
    scope,
    pinned,
    pinned_until: pinned && input.pinned_until ? input.pinned_until : null,
    chapter_id: scope === 'chapter' ? (input.chapter_id ?? null) : null,
    author_id: myPerson?.id ?? null,
  }).select('id').single()

  if (error) return { success: false, message: error.message }
  revalidatePath('/announcements')
  revalidatePath('/dashboard')
  revalidatePath('/admin/announcements')
  return { success: true, id: data?.id }
}

export async function deleteAnnouncement(
  id: string
): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient()

  // The row is read first, family-scoped, so the ownership decision is made against
  // what the database holds rather than anything the caller sent. An author may
  // delete their own announcement (scope 'own'); deleting someone else's needs 'any'.
  const { data: row } = await admin
    .from('announcements').select('author_id, family_code').eq('id', id).maybeSingle()
  if (!row) return { success: false, message: 'Announcement not found' }

  const g = await requireOwn('announcements', 'delete', row.author_id)
  if (!g.ok) return { success: false, message: g.message }
  if (row.family_code !== g.familyCode) return { success: false, message: 'Announcement not found' }

  const { error } = await admin.from('announcements').delete().eq('id', id).eq('family_code', g.familyCode)
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
  // Not an ownership call like delete: pinning puts an announcement on every
  // member's dashboard, so it takes the unrestricted grant even over your own.
  const g = await requireEdit('announcements')
  if (!g.ok) return { success: false, message: g.message }

  const admin = createAdminClient()
  const { error } = await admin
    .from('announcements').update({ pinned }).eq('id', id).eq('family_code', g.familyCode)
  if (error) return { success: false, message: error.message }
  revalidatePath('/announcements')
  revalidatePath('/dashboard')
  revalidatePath('/admin/announcements')
  return { success: true }
}
