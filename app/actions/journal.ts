'use server'

import { revalidatePath } from 'next/cache'
import { confirmWrite } from '@/lib/confirmed-write'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/auth/guard'
import { can } from '@/lib/auth/permissions'
import { embedOne, type PersonNameRow } from '@/lib/supabase/embed'
import { formatBoardTitle } from '@/lib/board-positions'

/**
 * Officer Notes — an OFFICE's notebook, read and written by whoever holds it.
 *
 * ── THE FILE IS STILL `journal.ts` WHILE THE SCREEN IS `/library/officer-notes` ──
 * Said here so it reads as a decision rather than a miss. The ROUTE and the KEY had to move
 * when the caption became plural — AGENTS.md leaves nothing to decide about that — and a
 * module path, a component directory and a table name are none of those things. Renaming them
 * would churn every `mod:` string in `tests/rls/cases.mjs` and every `from(...)` in this file
 * to change nothing anybody can see, which is the `events` category's own argument: "a caption
 * is one line here; a category is a column three resolvers agree about."
 *
 * ── WHAT DECIDES ACCESS HERE IS NOT A GRANT ────────────────────────────────────────
 * `20260821000005` and `20260822000001` put eleven policies across three tables and not one of
 * them evaluates `auth_permission`. What they test is whether the caller holds the office —
 * `auth_holds_family_role(role_id)` on an entry, and `auth_holds_journal_entry_office(entry_id)`
 * on the notes, which resolves the same question through the parent. So:
 *
 *   * a member with no office sees an empty screen, whatever their template says;
 *   * an administrator with `library/officer-notes:view` at 'any' sees THEIR OWN offices and
 *     no others;
 *   * a successor sees everything their predecessors recorded, which is the feature.
 *
 * The `library/officer-notes` key still does real work and it is exactly one thing: it gates
 * the SCREEN, so
 * a family can switch the screen off. That is §2c's distinction between a key that gates a table
 * and a key that gates a screen band, and the migrations argue it at length.
 *
 * ── AN ENTRY IS A TOPIC, AND THE NOTES ARE THE CONVERSATION ────────────────────────
 * `20260822000001` moved `body` off the entry onto `position_journal_notes`, and the write
 * rules moved with it. The three that matter here, because every function below is shaped by
 * them:
 *
 *   * ANY HOLDER may add a note to ANY topic — that is the rolling conversation. A successor
 *     answers a predecessor underneath what they wrote instead of beside it.
 *   * EACH NOTE is editable and deletable by its own AUTHOR and by nobody else, at any
 *     position in the thread. Somebody else's paragraph stays theirs.
 *   * THE TOPIC — its title — belongs to whoever started it. A successor who
 *     disagrees with how it was framed answers underneath rather than restating it.
 *
 * ── SO EVERY WRITE HERE GOES THROUGH THE USER CLIENT ───────────────────────────────
 * Deliberately, and it is the opposite of the Gatherings pattern. AGENTS.md's preference is
 * "prefer the user's client where RLS can do the work", and here RLS can do ALL of it: every
 * rule above is a predicate over the row being written, so the policies are the boundary
 * rather than a courtesy, and `tests/rls` can attack them.
 *
 * The ADMIN client appears exactly twice, and both are reads that RLS cannot answer for the
 * caller — `getMyOffices`, which says why on itself.
 *
 * ── AND EVERY NARROWED WRITE IS `confirmWrite` ─────────────────────────────────────
 * UPDATE and DELETE narrowed by RLS are exactly the shape §8b exists for: a statement refused
 * by a policy is `{ error: null }` and zero rows, so without it an author whose office had
 * changed hands would be told their edit saved. INSERT is never wrapped — the retry is only
 * safe on the idempotent two, and an INSERT refused by RLS raises 42501 and is already honest.
 *
 * ── §8: EVERY `people` EMBED HERE NAMES ITS CONSTRAINT ─────────────────────────────
 * `position_journal_attendees` USED TO make this pair many-to-many, so a bare `people(...)`
 * embed from either journal table was PGRST201 — which is `[]` with the error discarded. That
 * table is gone (`20260822000019`, with the meeting half), and every `.select()` below STILL
 * names its constraint. Deliberately: the hazard was never that table specifically, it was that
 * ANY two-column join table added later reintroduces it on a table nobody edited, which is the
 * `announcement_unpins` incident. Removing the qualifiers now would be removing the guard
 * because the last thing to trip it happened to be deleted.
 *
 * ── THE MEETING HALF LEFT ON 2026-08-22 ──────────────────────────
 * An entry carried a `kind` of 'note' or 'meeting', with `met_on` and an attendee list beside
 * it. `20260822000019` dropped all three and Meeting Minutes (`/library/meeting-minutes`) is
 * where a meeting lives now. The reason is that a meeting is not a topic in one office's
 * notebook: it belongs to the FAMILY, it has a SECRETARY (one named person, which this file's
 * "any holder of the office" rule cannot express), and it has VOTES, which a journal has
 * nowhere to put.
 *
 * WHAT IS LEFT IS THE THING THIS FILE WAS ALWAYS FOR: a rolling topic in one office's notebook,
 * readable only by whoever holds that office.
 */

export interface JournalOffice {
  role_id: string
  /** The bare position name, as the family typed it — "Treasurer", "Chapter Chair". */
  name: string
  /**
   * The position AND the place, as one phrase: "National Treasurer", "Austin Chapter Chair".
   *
   * From `formatBoardTitle`, which is the SAME function the Member Directory's Position column
   * and Members & Access's row and dialog all print. Three surfaces reading one formatter is
   * what stopped "Eastern Region President" and "Regional President" both being things this
   * product said, and this screen was the fourth surface — it printed the bare `name`, so a
   * member chairing Austin and a member chairing Houston both saw "Chapter Chair" and could not
   * tell their own rail item from each other's.
   */
  title: string
  /** 'executive_officer' | 'appointed_position' — the family's own grouping. */
  category: string
  /**
   * 'national' | 'regional' | 'chapter', from the ASSIGNMENT and not from the position.
   *
   * `user_roles.scope` rather than `family_roles.scope`, matching `getBoardPositionHolders`:
   * the assignment is what carries the chapter or the region, so reading the scope from
   * anywhere else could name a place the row does not hold.
   */
  scope: string
  /** The chapter this office is held for, on a chapter-scoped assignment. Null otherwise. */
  chapter_name: string | null
  /** The region, on a regional one. Null otherwise. A row never carries both. */
  region_name: string | null
  sort_order: number
}

/** One paragraph in a topic's thread. */
export interface JournalNote {
  id: string
  entry_id: string
  body: string
  author_id: string | null
  /** "Martha Allen", or null where the author has left the family. */
  author_name: string | null
  /** Whether the CALLER wrote it — what the edit and delete controls hang off. */
  mine: boolean
  created_at: string
  updated_at: string
}

export interface JournalEntry {
  id: string
  role_id: string
  title: string
  author_id: string | null
  author_name: string | null
  /** Whether the CALLER started the topic — which decides the title controls. */
  mine: boolean
  created_at: string
  updated_at: string
  /** Oldest first: a conversation is read down the page. */
  notes: JournalNote[]
}

/** What the composer needs to open a new topic. */
export interface NewEntryInput {
  title: string
  /** The opening paragraph. Optional: a topic may be titled today and written in tomorrow. */
  firstNote?: string
}



/**
 * The offices the caller holds in the family they are viewing.
 *
 * ── THE ADMIN CLIENT, AND IT IS A CORRECTION RATHER THAN A CHOICE ──────────────────
 * `user_roles` and `family_roles` are read together, and `family_roles` carries
 * `perm:authenticated can read roles` — but `user_roles` is gated on
 * `admin/members/board-positions`, which an ordinary officer does not hold. Through the user
 * client an officer would therefore read NO assignment at all and PostgREST answers that with
 * `[]` rather than an error (§8), so every officer in the family would be told they hold no
 * office and Officer Notes would be permanently empty for exactly the people it is for.
 *
 * The same conclusion `familyPlaces` reached about chapters, and the same shape: §3 is
 * discharged by hand — `.eq('family_code', …)` on both reads, and the user id is the caller's
 * own, which is narrower than the family.
 *
 * IT IS NOT A SECURITY DECISION. Nothing here is published that the caller may not see: it is
 * a list of the offices they themselves hold.
 */
export async function getMyOffices(): Promise<JournalOffice[]> {
  const g = await requireMember()
  if (!g.ok) return []
  if (!(await can(g.userId, 'library/officer-notes', 'view'))) return []

  const admin = createAdminClient()
  // THREE READS, NOT ONE EMBEDDED QUERY, and the two extra are the places. `chapters` and
  // `regions` are read whole and family-scoped, exactly as `getBoardPositionHolders` reads
  // them: their composed SELECT policies demand `admin/chapters:view` at 'any', so an
  // embed would resolve to null for every ordinary officer and the rail would print "Chapter
  // Chair" with no chapter — which is the silent one-field-wrong failure
  // `app/actions/announcements.ts` records at length about `chapters(name)`.
  //
  // §3 BY HAND on all three: `.eq('family_code', ...)` from the caller's own membership, never
  // from an argument. This function takes no parameters, so there is no id to verify (§4).
  const [rolesRes, chaptersRes, regionsRes] = await Promise.all([
    admin.from('user_roles')
      // ONE path to `family_roles`, so a bare embed is unambiguous — `user_roles.role_id` is
      // the only foreign key between the two. `assigned_by` points at `auth.users`, not
      // `people`. Worth stating because §8's rule is that a migration adding a second FK
      // anywhere makes this line PGRST201, which is `[]` with the error discarded.
      .select('role_id, scope, chapter_id, region_id, family_roles(name, category, sort_order)')
      .eq('user_id', g.userId)
      .eq('family_code', g.familyCode),
    admin.from('chapters').select('id, name').eq('family_code', g.familyCode),
    admin.from('regions').select('id, name').eq('family_code', g.familyCode),
  ])
  const { data, error } = rolesRes
  if (error) {
    console.error(`[journals] could not read the caller's offices in ${g.familyCode}: `
      + error.message + ' — Officer Notes will look empty to an officer who holds one.')
    return []
  }
  // §8, AND A DIFFERENT ANSWER FOR THE PLACES THAN FOR THE OFFICES. A refused `chapters` read
  // costs a NAME and no structure — the office is still listed, its notebook still opens, and
  // the title falls back to "Chapter Chair" the way it read before 2026-08-22. Failing the
  // whole screen because a caption is unavailable would withhold the notes over a label.
  if (chaptersRes.error || regionsRes.error) {
    console.error(`[journals] could not name the places for ${g.familyCode}: `
      + (chaptersRes.error?.message ?? regionsRes.error?.message)
      + ' — a scoped office will print without its chapter or region.')
  }
  const chapterName = new Map(((chaptersRes.data ?? []) as { id: string; name: string }[])
    .map(c => [c.id, c.name]))
  const regionName = new Map(((regionsRes.data ?? []) as { id: string; name: string }[])
    .map(r => [r.id, r.name]))

  type Row = {
    role_id: string
    scope: string | null
    chapter_id: string | null
    region_id: string | null
    family_roles: { name: string; category: string; sort_order: number } | null
  }
  return ((data ?? []) as unknown as Row[])
    // A NULL EMBED IS DROPPED rather than rendered as an office with no name. `role_id` is
    // NOT NULL with a cascading foreign key so this should be unreachable; it is handled
    // because the alternative is a blank row in a list of offices.
    .filter(r => r.family_roles != null)
    .map(r => {
      const scope = r.scope ?? 'national'
      const chapter = r.chapter_id ? chapterName.get(r.chapter_id) ?? null : null
      const region = r.region_id ? regionName.get(r.region_id) ?? null : null
      return {
        role_id: r.role_id,
        name: r.family_roles!.name,
        // ONE FORMATTER, FOUR SURFACES. See `title` on the interface: this screen was the one
        // printing the bare name, so two chapter chairs saw the same rail item.
        title: formatBoardTitle({
          positionName: r.family_roles!.name,
          scope,
          chapterName: chapter,
          regionName: region,
        }),
        category: r.family_roles!.category,
        scope,
        chapter_name: chapter,
        region_name: region,
        sort_order: r.family_roles!.sort_order,
      }
    })
    // SORTED ON THE FULL TITLE at the tie, not on the bare name: an officer holding the same
    // position in two chapters has two rows with one `name`, and ordering them by something
    // they share means the rail reorders itself between requests.
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))
}

/**
 * Every topic on one office, each with its whole thread and its attendee list.
 *
 * ── THE USER CLIENT, AND THE POLICIES ARE THE WHOLE BOUNDARY ───────────────────────
 * All three reads are refused for an office the caller does not hold, which is why this
 * function checks that itself nowhere: there is nothing a second check would add that the
 * policies do not already refuse, and a duplicated rule is one that drifts.
 *
 * ── THREE QUERIES, NOT ONE EMBED, AND THAT IS A DECISION ───────────────────────────
 * Notes and attendees could both be nested embeds on the entries select. They are separate
 * round trips because a nested embed is a join in its own right and owes the same
 * disambiguation as a top-level one — `photo_tags → people` is the worked example in
 * AGENTS.md, where one unqualified join one level down emptied a page whose top-level embeds
 * were all correct. Three flat queries joined in TypeScript cannot fail that way, and each
 * one's error is readable on its own.
 *
 * WHAT IT DOES OWE IS §8: every error is read. An empty journal and a refused read look
 * identical, and the second would tell an officer their predecessors left them nothing.
 */
export async function getJournalEntries(roleId: string): Promise<JournalEntry[]> {
  const g = await requireMember()
  if (!g.ok) return []
  if (!(await can(g.userId, 'library/officer-notes', 'view'))) return []

  const supabase = await createClient()
  const { data: entryRows, error } = await supabase
    .from('position_journal_entries')
    // ONE STRING LITERAL, not a concatenation. supabase-js derives the row type from the
    // literal it is handed, so `'a, b' + 'c'` types every column as GenericStringError and the
    // whole projection stops compiling — which is the useful direction of that inference and
    // is exactly what the first draft of this line did.
    .select('id, role_id, title, author_id, created_at, updated_at, people!position_journal_entries_author_id_fkey(first_name, last_name)')
    .eq('role_id', roleId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error(`[journals] entry read failed for office ${roleId}: ${error.message}`)
    return []
  }

  const entries: JournalEntry[] = (entryRows ?? []).map(row => {
    const author = embedOne<PersonNameRow>(row.people)
    return {
      id: row.id,
      role_id: row.role_id,
      title: row.title,
      author_id: row.author_id,
      // NULL WHERE THE AUTHOR HAS LEFT, and the screen prints "a former officer" for it. The
      // column is ON DELETE SET NULL precisely so the office keeps the note; rendering
      // "Unknown" would make that read like data loss.
      author_name: author ? `${author.first_name} ${author.last_name}` : null,
      mine: row.author_id != null && row.author_id === g.personId,
      created_at: row.created_at,
      updated_at: row.updated_at,
      notes: [],
    }
  })
  if (!entries.length) return entries

  const entryIds = entries.map(e => e.id)
  const byId = new Map(entries.map(e => [e.id, e]))

  const { data: noteRows, error: noteError } = await supabase
    .from('position_journal_notes')
    .select('id, entry_id, body, author_id, created_at, updated_at, people!position_journal_notes_author_id_fkey(first_name, last_name)')
    .in('entry_id', entryIds)
    // OLDEST FIRST, unlike the topics above: a conversation is read down the page.
    .order('created_at', { ascending: true })
  if (noteError) {
    // REPORTED AND NOT SWALLOWED, and the topics are still returned. A thread that failed to
    // load renders as a topic with nothing under it, which is indistinguishable from an empty
    // one — so the log line is the only place this is visible and it says what it cost.
    console.error(`[journals] note read failed for office ${roleId}: ${noteError.message}`
      + ' — every topic will render as though nothing had been written in it.')
  }
  for (const row of noteRows ?? []) {
    const author = embedOne<PersonNameRow>(row.people)
    byId.get(row.entry_id)?.notes.push({
      id: row.id,
      entry_id: row.entry_id,
      body: row.body,
      author_id: row.author_id,
      author_name: author ? `${author.first_name} ${author.last_name}` : null,
      mine: row.author_id != null && row.author_id === g.personId,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }

  // A THIRD ROUND TRIP USED TO GO HERE, for a meeting's attendee list. It left with the
  // meeting half (`20260822000019`). Two queries now: the topics, and their notes.

  return entries
}

/**
 * Open a new topic in an office's journal.
 *
 * ── `author_id` IS NEVER A PARAMETER ───────────────────────────────────────────────
 * It comes from the caller's own guard, and the INSERT policy pins it to `auth_person_id()`
 * as a CONJUNCT — so a wrong value is a refused write rather than an entry filed under
 * somebody else's byline. AGENTS.md §2b: never take an identity as a parameter.
 *
 * ── `family_code` IS WRITTEN, AND THE TRIGGERS ARE WHY THAT IS SAFE ────────────────
 * The column is denormalised off `role_id` so the policies can scope on it without a join per
 * row, and `tg_journal_entry_same_family` refuses a row whose `family_code` disagrees with its
 * office's. That is §4 in the database: the row's own `family_code` satisfies every policy
 * while `role_id` could point elsewhere, and nothing but the trigger asks.
 *
 * ── IT IS THREE WRITES, SO IT REPORTS A PARTIAL SUCCESS ────────────────────────────
 * The topic, its opening note and its attendee list are three statements and PostgREST has no
 * transaction across them. The topic is what the officer typed a title into, so it lands
 * first and is never rolled back; if a later step fails the caller is TOLD which one, in the
 * `propagateChapterToChildren` shape — a bare `{ success: true }` over a topic whose first
 * note did not save is the silence AGENTS.md §8b is about, and reporting outright failure over
 * a topic that really was created would be worse.
 */
export async function addJournalEntry(
  roleId: string,
  input: NewEntryInput,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!g.personId) return { success: false, message: 'Profile not found' }

  const title = (input?.title ?? '').trim()
  // The CHECK constraint refuses a blank title with a constraint name; this supplies a
  // sentence. Both are wanted — the constraint is what holds when somebody posts to the
  // endpoint directly, and this is what an officer reads.
  if (!title) return { success: false, message: 'Give the entry a title.' }

  const supabase = await createClient()
  const { data: created, error } = await supabase
    .from('position_journal_entries')
    .insert({
      family_code: g.familyCode,
      role_id: roleId,
      title,
      author_id: g.personId,
    })
    .select('id')
    .single()
  if (error || !created) {
    // 42501 is the INSERT policy refusing, and the likeliest reason by far is that the caller
    // does not hold this office — either they never did, or it changed hands while the page
    // was open. Said plainly rather than guessed at from a code.
    if (error?.code === '42501') {
      return {
        success: false,
        message: 'That entry was refused. A journal is only writable by whoever holds the '
          + 'office — reload the page to see which ones are yours.',
      }
    }
    return { success: false, message: error?.message ?? 'That entry could not be saved.' }
  }

  const partial: string[] = []

  const firstNote = (input?.firstNote ?? '').trim()
  if (firstNote) {
    const { error: noteError } = await supabase.from('position_journal_notes').insert({
      family_code: g.familyCode,
      entry_id: created.id,
      body: firstNote,
      author_id: g.personId,
    })
    if (noteError) partial.push('the first note was not saved')
  }

  revalidatePath('/library/officer-notes')
  if (partial.length) {
    return {
      success: false,
      message: `The entry was created, but ${partial.join(' and ')}. `
        + 'Open it and add what is missing.',
    }
  }
  return { success: true }
}

/**
 * Retitle a topic.
 *
 * The topic is the AUTHOR's, so both halves of `perm:authors can edit their own journal
 * entries` apply and this function checks neither: a successor may not retitle a handover
 * note, and a former officer may not edit the office's journal from outside. What a successor
 * does instead is add a note, which is the same answer `reopenGatheringTask` gives.
 *
 * IT TOOK A `metOn` UNTIL 2026-08-22, for the meeting half that has moved to Meeting Minutes.
 *
 * `confirmWrite` because the refusal is silent otherwise (§8b): an UPDATE the policy declines
 * is zero rows and `{ error: null }`, and telling somebody their correction saved when the
 * office has changed hands is the worst version of that lie on this screen.
 */
export async function updateJournalEntry(
  entryId: string,
  title: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }

  const trimmed = (title ?? '').trim()
  if (!trimmed) return { success: false, message: 'Give the entry a title.' }

  const supabase = await createClient()
  const outcome = await confirmWrite(() => supabase
    .from('position_journal_entries')
    .update({ title: trimmed })
    .eq('id', entryId)
    .select('id'))
  if (!outcome.ok) {
    return {
      success: false,
      message: 'That entry could not be changed. Only the person who recorded it can, and '
        + 'only while they still hold the office.',
    }
  }

  revalidatePath('/library/officer-notes')
  return { success: true }
}

/** Remove a topic, and the thread under it. Same rule as retitling. */
export async function deleteJournalEntry(
  entryId: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }

  const supabase = await createClient()
  const outcome = await confirmWrite(() => supabase
    .from('position_journal_entries')
    .delete()
    .eq('id', entryId)
    .select('id'))
  if (!outcome.ok) {
    return {
      success: false,
      message: 'That entry could not be removed. Only the person who recorded it can, and '
        + 'only while they still hold the office.',
    }
  }

  revalidatePath('/library/officer-notes')
  return { success: true }
}

/**
 * Add a note to a topic.
 *
 * ── ANY HOLDER, AND THAT IS THE FEATURE ────────────────────────────────────────────
 * `perm:officeholders can add journal notes` tests the OFFICE and pins the byline; it does not
 * test who opened the topic. So two officers holding one office have a conversation on the
 * page, and a successor answers a predecessor underneath what they wrote rather than beside
 * it. It is the one place in this module where the office test and the author test come apart,
 * and it is deliberate — `20260822000001`'s header argues it.
 */
export async function addJournalNote(
  entryId: string,
  body: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!g.personId) return { success: false, message: 'Profile not found' }

  const trimmed = (body ?? '').trim()
  if (!trimmed) return { success: false, message: 'Write something first.' }

  const supabase = await createClient()
  const { error } = await supabase.from('position_journal_notes').insert({
    family_code: g.familyCode,
    entry_id: entryId,
    body: trimmed,
    author_id: g.personId,
  })
  if (error) {
    if (error.code === '42501') {
      return {
        success: false,
        message: 'That note was refused. A journal is only writable by whoever holds the '
          + 'office — reload the page to see which ones are yours.',
      }
    }
    return { success: false, message: error.message }
  }

  revalidatePath('/library/officer-notes')
  return { success: true }
}

/**
 * Edit one note — your own, at any position in the thread, while you still hold the office.
 *
 * "Any position" is what the thread bought: there is no "only the latest" rule anywhere, in
 * the policy or here. What there IS is the byline — `author_id = auth_person_id()` on both
 * sides of the UPDATE policy — so a note somebody else wrote is refused however old it is.
 */
export async function updateJournalNote(
  noteId: string,
  body: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }

  const trimmed = (body ?? '').trim()
  if (!trimmed) return { success: false, message: 'Write something first.' }

  const supabase = await createClient()
  const outcome = await confirmWrite(() => supabase
    .from('position_journal_notes')
    .update({ body: trimmed })
    .eq('id', noteId)
    .select('id'))
  if (!outcome.ok) {
    return {
      success: false,
      message: 'That note could not be changed. Only the person who wrote it can, and only '
        + 'while they still hold the office.',
    }
  }

  revalidatePath('/library/officer-notes')
  return { success: true }
}

/** Remove one note from a thread. Same rule as editing it. */
export async function deleteJournalNote(
  noteId: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }

  const supabase = await createClient()
  const outcome = await confirmWrite(() => supabase
    .from('position_journal_notes')
    .delete()
    .eq('id', noteId)
    .select('id'))
  if (!outcome.ok) {
    return {
      success: false,
      message: 'That note could not be removed. Only the person who wrote it can, and only '
        + 'while they still hold the office.',
    }
  }

  revalidatePath('/library/officer-notes')
  return { success: true }
}
