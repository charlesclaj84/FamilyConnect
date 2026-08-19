'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { getMyFamilyCode, belongsToFamily } from '@/lib/auth/family'
import { requireEdit, requireOwn, requireMember, requireRead } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { addressedTo, readMyChapterId } from '@/lib/announcement-audience'
import { todayLocal } from '@/lib/date-utils'
import { upcomingBirthdays, type UpcomingBirthday } from '@/lib/birthdays'

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

/**
 * Every chapter in one family, by id and name — the composer's picker and the name printed on
 * a chapter-scoped announcement, from one read.
 *
 * ── IT IS THE ADMIN CLIENT, AND THAT IS A CORRECTION RATHER THAN A CHOICE ───────────
 * The composed SELECT policy on `chapters` demands `admin/chapters:view = 'any'` —
 * `permission_table_map` gives that table `own_expr = 'false'` and `20260618000001` composed
 * the rest — so through the USER client an ordinary member reads NO chapter at all. This read
 * used to be on the user client, and the consequence was not cosmetic: PostgREST does not
 * error for a policy that releases nothing, it returns `[]`, so
 *
 *   * the Chapter picker in `NewAnnouncementForm` offered "— Select chapter —" and nothing
 *     else, and the form then refused submission with "Choose which chapter to notify." — an
 *     error the member could not clear, on a control the product had just invited them to use;
 *   * every existing chapter-scoped announcement printed `chapter_name: null` for them,
 *     because `SELECT_COLUMNS` embedded a bare `chapters(name)` evaluated under the same
 *     policy.
 *
 * `app/actions/members.ts` corrects the same defect on the same two tables in the same commit,
 * and `familyChapterRegions` / `getDuesScopeOptions` in `app/actions/dues.ts` had already
 * argued it out: NAMES OF CHAPTERS ARE FAMILY STRUCTURE RATHER THAN PII. What `admin/chapters`
 * protects is EDITING the family's shape, and every write in `app/actions/admin/chapters.ts`
 * still demands it. Publishing the list here adds nothing a member could not already read —
 * `getChapters()` in that module is `requireMember()` and the admin client for exactly this
 * reason, because /personal-info cannot offer a member a chapter to belong to without it.
 *
 * ── §3, BY HAND, BECAUSE THE SERVICE ROLE APPLIES NO RLS ───────────────────────
 * `.eq('family_code', familyCode)`, and the code arrives from the caller's own membership —
 * never from a parameter. `.order('name')` so the picker and the board read in one order.
 *
 * ── §8: THE ERROR IS READ ───────────────────────────────────────────
 * `data` alone cannot tell a refused query from a family with no chapters, and those are very
 * different facts to be drawing: the first is a dead end the member cannot get out of, the
 * second is a Free family that has never had a chapter. It still returns `[]`, because an empty
 * picker is the only honest thing to draw; what changes is that it is reported.
 */
async function readChapters(familyCode: string): Promise<Chapter[]> {
  if (!familyCode) return []

  const { data, error } = await createAdminClient()
    .from('chapters')
    .select('id, name')
    .eq('family_code', familyCode)
    .order('name')

  if (error) {
    console.error(`[announcements] chapter read failed for ${familyCode}: ${error.message}`)
    return []
  }
  return (data ?? []) as Chapter[]
}

/**
 * The chapters the composer may address, in the caller's own family.
 *
 * `requireMember()` and nothing more, matching `getChapters()` in
 * `app/actions/admin/chapters.ts` exactly — any approved member may post an announcement, so
 * any approved member needs the list of chapters to post it to, and demanding
 * `admin/chapters:view` here would leave the Chapter option on the form permanently unusable
 * for everybody but an administrator. `create` defaults to scope 'none' (AGENTS.md §2), so
 * this is the self-service case, and what it owes is the check self-service always owes: that
 * the caller is an APPROVED member of the family this list belongs to.
 *
 * IT IS NOT A RE-EXPORT OF THAT FUNCTION, and the duplication is deliberate. The two return
 * different things: that one is the whole row — `family_code`, `region_id`, `region_name`,
 * `created_at` — for the screen that arranges the family's shape, and this one is the two
 * columns a `<select>` needs. §5 is about the payload as much as the gate, so shipping four
 * extra columns per chapter into the composer's RSC payload to save a projection would be the
 * wrong trade in the one direction that matters.
 */
export async function getChapters(): Promise<Chapter[]> {
  const g = await requireMember()
  if (!g.ok) return []
  return readChapters(g.familyCode)
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
const SELECT_COLUMNS = 'id, title, body, scope, pinned, pinned_until, published_at, author_id, chapter_id, people!announcements_author_id_fkey(first_name, last_name)'

/**
 * `chapters(name)` USED TO BE IN THAT SELECT AND DELIBERATELY IS NOT ANY MORE.
 *
 * A PostgREST embed is evaluated under the RLS of the table being embedded, and the composed
 * SELECT policy on `chapters` demands `admin/chapters:view = 'any'`. So the embed resolved to
 * `null` for every reader without the administrator grant, and a chapter-scoped announcement
 * printed with no chapter beside it — on the board, in Recent Updates, and on the dashboard.
 * Not an error, not empty: one field of one row, wrong, for almost everybody. `readChapters`
 * above resolves the names on the admin client and carries the argument for why that publishes
 * nothing new.
 *
 * The `people` embed keeps its named constraint, and the header above says why at length: it is
 * the PGRST201 that `announcement_unpins` introduced by existing. Removing this second embed
 * does not weaken that — if anything it removes one more path from a table that AGENTS.md §8
 * now warns can gain one from a migration nobody here reviewed.
 */
function chapterNamesFor(
  familyCode: string,
  rows: readonly RawAnnouncement[],
): Promise<ReadonlyMap<string, string>> {
  // Skipped entirely when nothing on the page is chapter-scoped, which is most families —
  // `/admin/chapters` is `tier: 'plus'`. The board and Recent Updates therefore cost no extra
  // round trip to name a chapter they will never print.
  if (!rows.some(r => r.chapter_id)) {
    return Promise.resolve(new Map<string, string>())
  }
  return readChapters(familyCode)
    .then(chapters => new Map(chapters.map(c => [c.id, c.name])))
}

type RawAnnouncement = {
  id: string; title: string; body: string; scope: string; pinned: boolean
  pinned_until?: string | null; published_at: string; author_id: string | null
  chapter_id: string | null; people: unknown
}

/**
 * `chapterNames` is passed in rather than looked up, so the map is read ONCE per screen and
 * every row on that screen agrees about what a chapter is called. An unresolved id reads as
 * "no chapter" — the same answer a national announcement gives, and reachable only two ways,
 * both accounted for: a refused read, which `readChapters` logs, and a `chapter_id` belonging
 * to another family, which `createAnnouncement`'s `belongsToFamily` check exists to prevent and
 * the family conjunct on the lookup is there to strand.
 */
function mapAnnouncement(
  a: RawAnnouncement,
  chapterNames: ReadonlyMap<string, string>,
): Announcement {
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
    chapter_name: a.chapter_id ? chapterNames.get(a.chapter_id) ?? null : null,
    author_name: a.people
      ? `${(a.people as { first_name: string; last_name: string }).first_name} ${(a.people as { first_name: string; last_name: string }).last_name}`
      : null,
  }
}

/**
 * `addressedTo` AND `myChapterId` MOVED TO lib/announcement-audience.ts ON 2026-08-19.
 *
 * `/updates` is the fourth reader of the audience rule and the comment that used to sit here
 * already said why there must be one copy: it was written out three times and the three had
 * begun to differ. A `'use server'` file cannot share a helper — everything exported from one
 * gets a URL — so the rule lives in a plain module both actions import, which is the same shape
 * `lib/notifications.ts` and `lib/invitations.ts` use. That module also holds the SQL twin of
 * the rule, which `/updates` needs because it pages, and the argument for why two expressions
 * of one rule are admissible there.
 */

/** Family pin first, then newest first. The order both the board and the feed use. */
function byPinThenDate(a: Announcement, b: Announcement): number {
  const aPin = isPinActive(a) ? 1 : 0
  const bPin = isPinActive(b) ? 1 : 0
  if (aPin !== bPin) return bPin - aPin
  return new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('announcements')
    .select(SELECT_COLUMNS)
    .order('published_at', { ascending: false })
    .limit(50)

  // §8, and on THE select whose PGRST201 incident this file's own header records at length.
  // The error used to be discarded, which made a refusal and an empty family the same thing on
  // screen: an empty notice board over a family that has one, with nothing anywhere saying so.
  // AGENTS.md §8 now warns that ANY migration adding a foreign key can make a bare embed
  // ambiguous on a table nobody touched, so the next one of these will arrive from a file whose
  // author had no reason to look here — which is precisely why it has to be reported rather
  // than inferred. The return is unchanged; an empty board is the only honest thing to draw.
  if (error) {
    console.error(`[announcements] board read failed: ${error.message}`)
    return []
  }

  const rows = (data ?? []) as unknown as RawAnnouncement[]
  const chapterNames = await chapterNamesFor(await getMyFamilyCode(user.id), rows)
  return rows.map(a => mapAnnouncement(a, chapterNames)).sort(byPinThenDate)
}

/** Only what this member is addressed by — national/regional, plus their own chapter. */
export async function getMyAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const chapter = await readMyChapterId()

  const { data, error } = await supabase
    .from('announcements')
    .select(SELECT_COLUMNS)
    .order('published_at', { ascending: false })
    .limit(50)

  // §8 — same select, same reasoning as `getAnnouncements` above.
  if (error) {
    console.error(`[announcements] addressed-to read failed: ${error.message}`)
    return []
  }

  const rows = ((data ?? []) as unknown as RawAnnouncement[]).filter(addressedTo(chapter))
  const chapterNames = await chapterNamesFor(await getMyFamilyCode(user.id), rows)
  return rows.map(a => mapAnnouncement(a, chapterNames)).sort(byPinThenDate)
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

  const chapter = await readMyChapterId()

  const [{ data, error }, { data: unpins }] = await Promise.all([
    supabase
      .from('announcements')
      .select(SELECT_COLUMNS)
      .order('published_at', { ascending: false })
      .limit(limit + 20),
    supabase.from('announcement_unpins').select('announcement_id'),
  ])

  // §8 on the announcements half, and NOT on the unpins half — the paragraph above argues
  // that asymmetry out and it stands: losing the dismissals costs one reappearing notice,
  // losing the announcements empties the dashboard's Recent Updates over a family that has
  // posted forty.
  if (error) {
    console.error(`[announcements] feed read failed: ${error.message}`)
    return []
  }

  const dismissed = new Set(
    ((unpins ?? []) as { announcement_id: string }[]).map(r => r.announcement_id),
  )

  const rows = ((data ?? []) as unknown as RawAnnouncement[]).filter(addressedTo(chapter))
  const chapterNames = await chapterNamesFor(await getMyFamilyCode(user.id), rows)
  return rows
    .map(a => mapAnnouncement(a, chapterNames))
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

  // §4. This insert runs on the SERVICE-ROLE client — deliberately, so an ordinary member
  // can post at all — so there is no policy underneath it, and the `chapter_id` arriving
  // from the client was written onto the row unchecked. The row carries the caller's own
  // family_code and would satisfy every policy anyway; the chapter it names could be
  // another family's, which is precisely the shape §4 is about and the same one the
  // `people.chapter_id` cases in tests/rls exist for.
  //
  // The damage was small and real: `addressedTo` matches such a post to nobody in this
  // family, so an announcement written for "a chapter" would be readable on the board and
  // addressed to no one — a foreign id filed inside this family's records either way.
  if (scope === 'chapter' && input.chapter_id
      && !(await belongsToFamily('chapters', input.chapter_id, familyCode))) {
    return { success: false, message: 'Chapter not found' }
  }

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

// ── Birthdays ──────────────────────────────────────────────────────────────────
//
// THE SECOND PANE OF /announcements, AND IT IS NOT AN ANNOUNCEMENT. It lives in this file
// because it is the other half of one screen and the two are fetched by one page; it shares
// nothing else with the code above — no row, no table, no pin. `announcements/birthdays` is
// its own resource (20260819000002 §B), which is what "one rail item, one permission
// resource" means, and it declares `view` and nothing else because nothing writes a
// birthday: the date is edited on a member's own profile, under the rules `people` already
// has.
//
// THE ARITHMETIC IS NOT HERE, DELIBERATELY. `lib/birthdays.ts` takes `today` as a parameter
// and is tested by mutation (AGENTS.md §7b); this action fetches, gates, and hands the rows
// over. Anything about leap days, the year boundary or an untrustworthy year belongs there,
// where it is runnable — and every one of those cases IS pinned there. Resist adding a
// filter, a sort or a date comparison to this function: the two halves of a date bug living
// in two files is how the product ends up with two answers.
//
// A COMPONENT IMPORTS `UpcomingBirthday`, `BIRTHDAY_HORIZON_DAYS` and `birthdayWeekday`
// STRAIGHT FROM `@/lib/birthdays`, and there is deliberately no re-export of any of them
// here. That module is pure and client-safe, so a `'use client'` pane takes the type and the
// two helpers without pulling a `'use server'` file into its graph — and the type belongs to
// the module that computes the value, not to whichever action happens to hand it over. Every
// other interface in this file is declared here because nothing else defines it; this one is
// not, and copying it would be two shapes to keep in step.

/**
 * Whose birthday is coming up in the next sixty days, soonest first.
 *
 * ── WHAT GATES IT, AND WHAT STILL DECIDES THE ROWS ─────────────────────────────────
 * `requireRead('announcements/birthdays')` gates the FETCH, which is the whole of AGENTS.md
 * §5: the roster reaches the browser in the RSC payload whether the pane renders it or not,
 * so a caller without the grant must never have it read on their behalf. `requireRead` uses
 * `can()`, so scope 'own' passes — and that is correct here rather than sloppy, because the
 * QUERY is then what narrows, which is exactly what the next paragraph is about.
 *
 * ── THE USER CLIENT, AND THIS IS THE DECISION IN THIS FUNCTION ─────────────────────
 * The roster is read through `createClient()`, so the composed SELECT policy on `people` —
 * the `members` key, `own_expr = 'user_id = auth.uid()'` — decides which rows come back.
 * 20260819000002 §B states the intent in those terms: "the sub-key is an app-layer gate on
 * whether the section is fetched, and the map row is still what decides which rows come
 * back", the same standing `account-summary/funds` has. So `announcements/birthdays` answers
 * *may this member open the pane*, and `members` answers *whose names may they see in it*.
 *
 * The service role would have been the other way, and it is the wrong way. A DATE OF BIRTH
 * AND A FULL NAME ARE PII — not family structure, which is the distinction
 * `getDuesScopeOptions` turns on when it reaches for the admin client to read region names —
 * so a family that has deliberately restricted its Directory must not find the same roster
 * published back to everybody through a birthday list. The cost is stated rather than hidden:
 * in such a family this pane is narrow, possibly down to the reader's own birthday, and it
 * cannot tell that apart from a quiet sixty days. The family's remedy is the grant they
 * already hold — widen `members`, or restrict this pane so it is not offered at all — and
 * that is the right place for the decision, because it is the same decision they made about
 * the Directory.
 *
 * There is therefore no `.eq('family_code', …)` here and §3 does not apply: the policy
 * carries `family_code = auth_family_code()` itself. This is AGENTS.md's preference — "reach
 * for the admin client only when the query genuinely needs to see past" RLS — and the reason
 * `getMembers` reads the same table the same way.
 *
 * ── THREE CONJUNCTS, AND THE MIDDLE ONE IS THE ONE NOBODY WOULD THINK OF ───────────
 *  1. `membership_status = 'approved'`, for the reason `getMembers` states at length: the
 *     `people` SELECT policy admits a non-approved row to anyone holding
 *     `admin/approvals:view`, so without this an administrator's birthday pane would carry
 *     people the family has not admitted. Unclaimed rows are unaffected — the stamp trigger
 *     returns early for a row with no `user_id`, so a recorded relative keeps the column
 *     default, which is 'approved'.
 *  2. **`sunset_date IS NULL`. A DEAD RELATIVE HAS NO NEXT BIRTHDAY.** `lib/birthdays.ts`
 *     does not know about this column, deliberately and in capitals in its own header: a
 *     great-uncle who died in 1998 is a perfectly ordinary `people` row (AGENTS.md §4b) with
 *     a real `date_of_birth`, and the pure module would turn it into "12 days away, turning
 *     94" without a qualm. Withholding the row is the FETCH's job (§5), so it is done here,
 *     and it is the single most important line in this function.
 *  3. Nothing about `user_id`, which is the next paragraph.
 *
 * ── ACCOUNT-LESS PEOPLE ARE IN, AND THAT IS THE §4b DECISION MADE ON PURPOSE ────────
 * AGENTS.md §4b divides surfaces into PICKERS, which are accounts-only because a record
 * cannot pay or be paid, and PROJECTIONS, which are everybody because a projection is about
 * what is TRUE of the family rather than about who can act. **A birthday list is neither a
 * picker nor money; it is the family's own knowledge of itself, and the projection reasoning
 * is the one that transfers.** A grandmother recorded on the family tree who never had an
 * email address has a birthday exactly as much as her son who signed in this morning, and
 * she is the reader most likely to be phoned rather than messaged — which is to say, the
 * person a birthday list is most useful FOR. Excluding her would not make the pane
 * conservative; it would make it wrong, and wrong in the direction that hides the people an
 * organizer most needs reminding about. That is Dues Projections' argument verbatim, and it
 * applies here with nothing at stake financially.
 *
 * The Directory agrees with this already and needed no change to: unclaimed rows are
 * 'approved' by default, so they have always been listed. This pane simply does not add a
 * `user_id` filter that the surfaces which genuinely need one do add.
 *
 * ── `todayLocal()`, ON THE SERVER, BECAUSE AN ACTION IS THE LAYER ALLOWED TO DECIDE ─
 * `getPremierGathering` in app/actions/gatherings.ts says it in those words, and the same
 * rule holds here: the pure module takes `today` as a parameter so it can be tested, and an
 * action is where a clock may be read. `todayLocal()` rather than an ISO instant sliced to
 * ten characters, because `date_of_birth` is a bare `DATE` with no time and no zone — the
 * slice is UTC, which is a day out for half the country every evening, and that is precisely
 * the class of bug `lib/birthdays.ts` exists to make impossible downstream of this line.
 *
 * The residual imprecision is worth naming so nobody reads more into this than is there:
 * "today" is the SERVER's today, and on hosted that is UTC, so between midnight and dawn UTC
 * a family in the Americas is told about a day that has not begun for them. Every date read
 * in this product has that property, `/calendar` and `/gatherings` included, and the fix
 * would be a `today` parameter arriving from the browser — which is a value from a caller, on
 * a public endpoint, deciding what the answer is. Not worth it for a birthday, and it is a
 * horizon of sixty days: the row is on the list either way, one day out on its countdown.
 *
 * ── NO ARGUMENTS, ON PURPOSE ───────────────────────────────────────────────────────
 * Not even the horizon. This is a public HTTP endpoint like every other export from a
 * `'use server'` file, and a `horizonDays` parameter would be a knob no screen needs, on
 * which the only interesting values are the ones that make the query expensive. The number
 * is `BIRTHDAY_HORIZON_DAYS`, in one place, and the pane's empty-state sentence reads it from
 * there too so the two cannot disagree.
 */
export async function getUpcomingBirthdays(): Promise<UpcomingBirthday[]> {
  const g = await requireRead('announcements/birthdays')
  if (!g.ok) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('people')
    // FOUR COLUMNS, AND THE OTHER TWENTY DELIBERATELY NOT (§5). The Directory's projection
    // is the wrong one to copy here: this pane prints a name and a date, so an address, a
    // phone number and a city would be PII published into the RSC payload for a screen that
    // has nowhere to put them.
    .select('id, first_name, last_name, date_of_birth')
    .eq('membership_status', 'approved')
    // A dead relative has no next birthday. See conjunct 2 above — this line is why the
    // pure module can stay ignorant of the column.
    .is('sunset_date', null)

  // §8. A refused query and a family with no birthdays are the same shape and different
  // facts, and the pane's empty state is a SENTENCE — "no birthdays in the next 60 days" —
  // which would be a false statement in the product's own voice over a read that failed.
  // The return is still empty, because there is nothing honest to draw; what changes is that
  // it is reported rather than inferred.
  if (error) {
    console.error(`[announcements] birthday roster read failed for ${g.familyCode}: ${error.message}`)
    return []
  }

  const roster = ((data ?? []) as { id: string; first_name: string; last_name: string; date_of_birth: string | null }[])
    .map(p => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      dateOfBirth: p.date_of_birth,
    }))

  // No sort, no filter, no date comparison here — see the section header. `upcomingBirthdays`
  // returns a total order, soonest first, with a null or impossible `date_of_birth` already
  // dropped.
  return upcomingBirthdays(roster, todayLocal())
}
