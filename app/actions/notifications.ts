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
    // DISMISSED ENTRIES ARE OUT OF THE BELL AND STILL IN THE ARCHIVE — 20260903000003.
    // `app/actions/updates.ts` deliberately does NOT carry this conjunct: the bell is a
    // list of what is outstanding and `/community/updates` is the history, so clearing
    // forty entries empties one and leaves the other complete.
    .is('dismissed_at', null)
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
    // THE BADGE HAS TO AGREE WITH THE LIST. Without this, dismissing an unread entry leaves
    // a badge counting something the bell no longer shows — a member opens it looking for
    // the one unread item and finds nothing, which reads as the badge being broken.
    .is('dismissed_at', null)

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
    // Only what is IN the bell. A dismissed entry is not something the member is being shown
    // and not something "mark all read" is about — and stamping it would rewrite the archive
    // to say they had read something they had cleared without reading.
    .is('dismissed_at', null)
}

/**
 * Clear one entry from the bell.
 *
 * ── FROM THE BELL ONLY, WHICH IS THE WHOLE FEATURE ────────────────────────────────
 * `20260903000003` argues it at length: the row survives and `/community/updates` still shows
 * it, because that archive is the history of what happened to this member. A DELETE was not
 * available anyway — `notifications` carries exactly a SELECT and an UPDATE policy, asserted
 * by two migrations, so per AGENTS.md §2c the browser cannot delete from it.
 *
 * ── THE USER CLIENT, SO RLS IS THE BOUNDARY (§3's preferred path) ─────────────────
 * No `.eq('recipient_id', …)` beside the id, and that is deliberate rather than an omission:
 * the UPDATE policy admits a member's write to their own notification rows and nothing else,
 * so adding the filter by hand would duplicate a conjunct the policy already states — which
 * AGENTS.md §7 warns HIDES that conjunct from the test suite. `markNotificationRead` above
 * has the same shape for the same reason.
 *
 * ── IT RETURNS `void`, MATCHING ITS NEIGHBOURS ────────────────────────────────────
 * §8b's rule is about an action that reports success over a write that did not happen. There
 * is no report here: the bell removes the row optimistically and re-reads its list on every
 * navigation, so a refused dismissal SHOWS ITSELF by the entry coming back. That is the same
 * argument the two mark-read actions make, and it is why `confirmWrite` is not used — it is
 * for actions whose caller is told something.
 */
export async function dismissNotification(id: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
}

/**
 * Clear everything currently in the bell.
 *
 * Scoped to the caller's own person id like `markAllNotificationsRead`, and to rows not
 * already dismissed so a second press rewrites no timestamps.
 */
export async function dismissAllNotifications(): Promise<void> {
  const supabase = await createClient()
  const { user } = await currentUser()
  if (!user) return

  const personId = await getMyPersonId(user.id)
  if (!personId) return

  await supabase
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('recipient_id', personId)
    .is('dismissed_at', null)
}
