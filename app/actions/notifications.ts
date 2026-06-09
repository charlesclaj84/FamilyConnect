'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: myPerson } = await supabase
    .from('people')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!myPerson) return []

  const { data } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('recipient_id', myPerson.id)
    .order('created_at', { ascending: false })
    .limit(30)

  return data ?? []
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { data: myPerson } = await supabase
    .from('people')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!myPerson) return 0

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', myPerson.id)
    .is('read_at', null)

  return count ?? 0
}

export async function markNotificationRead(
  id: string
): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: myPerson } = await supabase
    .from('people')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!myPerson) return

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', myPerson.id)
    .is('read_at', null)
}

// Internal helper — called from other server actions (uses admin client to bypass RLS for inserts)
export async function createNotification(opts: {
  familyCode: string
  recipientPersonId: string
  type: string
  title: string
  body?: string
  link?: string
}): Promise<void> {
  const admin = createAdminClient()
  await admin.from('notifications').insert({
    family_code: opts.familyCode,
    recipient_id: opts.recipientPersonId,
    type: opts.type,
    title: opts.title,
    body: opts.body ?? null,
    link: opts.link ?? null,
  })
}

// Notify all family members (excluding sender) — used for event publish, announcements, etc.
export async function notifyAllMembers(opts: {
  familyCode: string
  excludePersonId?: string
  type: string
  title: string
  body?: string
  link?: string
}): Promise<void> {
  const admin = createAdminClient()

  const { data: members } = await admin
    .from('people')
    .select('id')
    .eq('family_code', opts.familyCode)
    .not('user_id', 'is', null)

  if (!members?.length) return

  const rows = members
    .filter(m => m.id !== opts.excludePersonId)
    .map(m => ({
      family_code: opts.familyCode,
      recipient_id: m.id,
      type: opts.type,
      title: opts.title,
      body: opts.body ?? null,
      link: opts.link ?? null,
    }))

  if (rows.length) await admin.from('notifications').insert(rows)
}
