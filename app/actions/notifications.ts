'use server'

import { createClient } from '@/lib/supabase/server'
import { getMyPersonId } from '@/lib/auth/family'
import { currentUser } from '@/lib/auth/current-user'

export interface Notification {
  id: string
  type: string
  /**
   * The English the writer composed, and the FALLBACK — not what a reader normally sees.
   *
   * ── THE ROW IS RENDERED FROM `title_key`, SINCE `20260901000004` ─────────────────
   * A notification is composed at EVENT time and read later by somebody else, so English
   * chosen by the writer is the language of whoever triggered it. `notificationText()` below
   * resolves the key in the READER's language and falls back to this — for rows written before
   * that migration, for a `type` nobody has keyed yet, and for a key that fails to resolve,
   * where English beats a bell entry reading `notify.taskSubmitted.title`.
   */
  title: string
  body: string | null
  /** Catalogue key for the title. Null on a row written before the migration. */
  title_key: string | null
  /** Catalogue key for the body, where there is one. */
  body_key: string | null
  /** Interpolation values for both keys. Strings only — a CHECK on the column enforces it. */
  params: Record<string, string> | null
  link: string | null
  read_at: string | null
  created_at: string
}

export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createClient()
  const { user } = await currentUser()
  if (!user) return []

  // Notifications hang off a family-scoped people row, so only the active
  // family's notifications are relevant here.
  const personId = await getMyPersonId(user.id)
  if (!personId) return []

  const { data } = await supabase
    .from('notifications')
    .select('id, type, title, body, title_key, body_key, params, link, read_at, created_at')
    .eq('recipient_id', personId)
    .order('created_at', { ascending: false })
    .limit(30)

  return data ?? []
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient()
  const { user } = await currentUser()
  if (!user) return 0

  const personId = await getMyPersonId(user.id)
  if (!personId) return 0

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', personId)
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
  const { user } = await currentUser()
  if (!user) return

  const personId = await getMyPersonId(user.id)
  if (!personId) return

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', personId)
    .is('read_at', null)
}
