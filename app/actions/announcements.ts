'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { getMyFamilyCode, belongsToFamily } from '@/lib/auth/family'
import { requireEdit, requireOwn, requireMember } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Family announcements.
 *
 * THERE IS ONE SCREEN NOW. `/admin/announcements` was retired by 20260813000000 —
 * everything it did, Community > Announcements does, gated per control by the grant
 * that governs it (`announcements:create` to post, `:edit` to pin family-wide, `:delete`
 * to remove). The key it used to gate, `admin/announcements`, named no table and
 * appeared in no policy, so removing it moved nothing.
 *
 * THERE ARE TWO KINDS OF PIN and they must not be confused:
 *
 *   announcements.pinned        the FAMILY's pin. An administrator holding
 *   + announcements.pinned_until announcements:edit decides it, it applies to everybody,
 *                               and it may expire. `togglePinAnnouncement` owns it.
 *
 *   announcement_unpins         the READER's dismissal. Any member may dismiss a pinned
 *                               announcement from the top of their own Recent Updates,
 *                               and put it back. Self-service, one row per (announcement,
 *                               person). `unpinAnnouncementForMe` owns it.
 *
 * Dismissing does not hide the announcement — it drops out of the pinned block and back
 * into the feed in `published_at` order, which is the whole difference between this and
 * the localStorage banner it replaces. See 20260813000001.
 */

export interface Announcement {
  id: string
  title: string
  body: string
  scope: string
  pinned: boolean
  pinned_until: string | null
  published_at: string
  author_name: string | null
  author_id: string | null
  chapter_id: string | null
  chapter_name: string | null
}

/** An announcement as Recent Updates sees it — the family's pin, narrowed by the reader's. */
export interface FeedAnnouncement extends Announcement {
  /** Pinned by the family, still in date, and not dismissed by THIS reader. */
  pinnedForMe: boolean
}

export interface AnnouncementInput {
  title: string
  body: string
  scope: 'national' | 'regional' | 'chapter'
  pinned: boolean
  pinned_until?: string | null
  chapter_id?: string | null
}

/** The family's pin, honouring its expiry. Says nothing about any one reader. */
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

/**
 * ONE STRING LITERAL, not a concatenation, and that is a typing requirement rather than
 * a style choice: supabase-js parses the select at the TYPE level, so a value of type
 * `string` (which is what `'a, b' + 'c'` is) resolves the row to `GenericStringError`
 * and every `as RawAnnouncement` below stops compiling. Keep it on one line.
 *
 * THE `people` EMBED NAMES ITS CONSTRAINT, and it did not have to until 2026-08-13 —
 * `announcements` has exactly one foreign key to `people` (author_id), which is why this
 * read as unambiguous for a year. What changed is that `announcement_unpins`
 * (20260813000001) has foreign keys to BOTH tables, so PostgREST now sees a second,
 * many-to-many path and refuses the bare embed with PGRST201 — which takes the WHOLE
 * query down, not just the embed, and returns `[]` from an action that discards the error.
 *
 * AGENTS.md §8 is written about exactly this and its list of two-path tables now includes
 * this pair. The lesson worth carrying is the second-order one: **adding a junction table
 * can break an embed on a table you did not touch.** After adding one, grep for bare
 * embeds of either table it joins. The RLS suite's positive control is what caught this
 * — the attack half passed happily, because `[]` contains no ALPHA markers.
 */
const SELECT_COLUMNS = 'id, title, body, scope, pinned, pinned_until, published_at, author_id, chapter_id, people!announcements_author_id_fkey(first_name, last_name), chapters(name)'

type RawAnnouncement = {
  id: string; title: string; body: string; scope: string; pinned: boolean
  pinned_until?: string | null; published_at: string; author_id: string | null
  chapter_id: string | null; people: unknown; chapters: unknown
}

function mapAnnouncement(a: RawAnnouncement): Announcement {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    scope: a.scope,
    pinned: a.pinned,
    pinned_until: a.pinned_until ?? null,
    published_at: a.published_at,
    author_id: a.author_id ?? null,
    chapter_id: a.chapter_id,
    chapter_name: a.chapters ? (a.chapters as { name: string }).name : null,
    author_name: a.people
      ? `${(a.people as { first_name: string; last_name: string }).first_name} ${(a.people as { first_name: string; last_name: string }).last_name}`
      : null,
  }
}

/**
 * Announcements addressed to this reader.
 *
 * Chapter-scoped rows are dropped for a member of a different chapter. National and
 * regional reach everybody, and a chapter announcement with no chapter named is treated
 * as family-wide rather than as invisible — an author who chose "Chapter" and left the
 * picker empty meant to publish something, and silently showing it to nobody is the
 * worse failure.
 *
 * Declared once because it was written out three times and the three copies had already
 * begun to differ.
 */
function addressedTo(myChapterId: string | null) {
  return (a: RawAnnouncement) => {
    if (a.scope === 'chapter') return !a.chapter_id || a.chapter_id === myChapterId
    return true
  }
}

/** Family pin first, then newest first. The order both the board and the feed use. */
function byPinThenDate(a: Announcement, b: Announcement): number {
  const aPin = isPinActive(a) ? 1 : 0
  const bPin = isPinActive(b) ? 1 : 0
  if (aPin !== bPin) return bPin - aPin
  return new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
}

/** The caller's chapter IN THE FAMILY BEING VIEWED — chapter_id is per-family. */
async function myChapterId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('people').select('chapter_id')
    .eq('user_id', user.id)
    .eq('family_code', await getMyFamilyCode(user.id))
    .maybeSingle()
  return (data as { chapter_id: string | null } | null)?.chapter_id ?? null
}

/**
 * Every announcement in the family, unfiltered by chapter — the board's own list.
 *
 * The chapter filter is deliberately NOT applied here. `/announcements` is the family's
 * notice board and shows what has been posted; narrowing it would make an author unable
 * to see their own chapter post from a different chapter, and would make the list
 * disagree with the delete button beside each row.
 */
export async function getAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('announcements')
    .select(SELECT_COLUMNS)
    .order('published_at', { ascending: false })
    .limit(50)

  return (data ?? []).map(a => mapAnnouncement(a as RawAnnouncement)).sort(byPinThenDate)
}

/** Only what this member is addressed by — national/regional, plus their own chapter. */
export async function getMyAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const chapter = await myChapterId()

  const { data } = await supabase
    .from('announcements')
    .select(SELECT_COLUMNS)
    .order('published_at', { ascending: false })
    .limit(50)

  return ((data ?? []) as RawAnnouncement[])
    .filter(addressedTo(chapter))
    .map(mapAnnouncement)
    .sort(byPinThenDate)
}

/**
 * The announcements Recent Updates renders, each carrying whether THIS reader still has
 * it pinned.
 *
 * The unpins are read on the USER client on purpose (AGENTS.md §3: prefer it where RLS
 * can do the work). The policy on `announcement_unpins` releases only rows whose
 * `person_id` is `auth_person_id()`, so "the dismissals I can see" and "my dismissals"
 * are the same set by construction and there is nothing here to narrow by hand.
 *
 * A refused query and an empty one are not distinguished, and that is a deliberate
 * choice rather than the §8 mistake: the failure mode of losing this list is that a
 * dismissed announcement reappears at the top once. Failing the whole feed to avoid
 * that would be the worse trade.
 */
export async function getAnnouncementFeed(limit = 20): Promise<FeedAnnouncement[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const chapter = await myChapterId()

  const [{ data }, { data: unpins }] = await Promise.all([
    supabase
      .from('announcements')
      .select(SELECT_COLUMNS)
      .order('published_at', { ascending: false })
      .limit(limit + 20),
    supabase.from('announcement_unpins').select('announcement_id'),
  ])

  const dismissed = new Set(
    ((unpins ?? []) as { announcement_id: string }[]).map(r => r.announcement_id),
  )

  return ((data ?? []) as RawAnnouncement[])
    .filter(addressedTo(chapter))
    .map(mapAnnouncement)
    .map(a => ({ ...a, pinnedForMe: isPinActive(a) && !dismissed.has(a.id) }))
    .sort(byPinThenDate)
    .slice(0, limit)
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
  // only admins can pin to everyone's Recent Updates.
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
  return { success: true }
}

export async function togglePinAnnouncement(
  id: string,
  pinned: boolean
): Promise<{ success: boolean; message?: string }> {
  // Not an ownership call like delete: pinning puts an announcement at the top of every
  // member's Recent Updates, so it takes the unrestricted grant even over your own.
  const g = await requireEdit('announcements')
  if (!g.ok) return { success: false, message: g.message }

  const admin = createAdminClient()
  const { error } = await admin
    .from('announcements').update({ pinned }).eq('id', id).eq('family_code', g.familyCode)
  if (error) return { success: false, message: error.message }
  revalidatePath('/announcements')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Stop holding a pinned announcement at the top of MY Recent Updates.
 *
 * SELF-SERVICE (AGENTS.md §2). Every member may dismiss a notice addressed to them —
 * `create` defaults to scope 'none', so demanding a grant would mean nobody could ever
 * dismiss anything — and what it owes instead is the two checks self-service always
 * owes: that the caller is an approved member (`requireMember`), and that the id they
 * sent belongs to their own family.
 *
 * `belongsToFamily` is §4 exactly: the row being written is legitimately the caller's,
 * so every policy on it is satisfied, while the `announcement_id` it carries could point
 * into another family. The database checks it too — the INSERT policy in 20260813000001
 * carries the same EXISTS — and both are wanted: the policy is what holds when somebody
 * calls PostgREST directly, this is what returns a sentence instead of a raw error.
 */
export async function unpinAnnouncementForMe(
  announcementId: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!g.personId) return { success: false, message: 'Not a member of this family' }
  if (!(await belongsToFamily('announcements', announcementId, g.familyCode))) {
    return { success: false, message: 'Announcement not found' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('announcement_unpins')
    .upsert(
      { announcement_id: announcementId, person_id: g.personId, family_code: g.familyCode },
      { onConflict: 'announcement_id,person_id' },
    )

  if (error) return { success: false, message: 'Could not dismiss that announcement.' }
  revalidatePath('/dashboard')
  return { success: true }
}

/** Put it back at the top of my Recent Updates — the withdrawal of a dismissal. */
export async function repinAnnouncementForMe(
  announcementId: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!g.personId) return { success: false, message: 'Not a member of this family' }

  // No belongsToFamily here, and it is not an omission: this only ever DELETES a row
  // the policy already restricts to `person_id = auth_person_id()`, so an id from
  // another family matches nothing rather than reaching anything. There is no row being
  // written whose references need checking, which is what §4 is about.
  const supabase = await createClient()
  const { error } = await supabase
    .from('announcement_unpins')
    .delete()
    .eq('announcement_id', announcementId)
    .eq('person_id', g.personId)

  if (error) return { success: false, message: 'Could not pin that announcement.' }
  revalidatePath('/dashboard')
  return { success: true }
}
