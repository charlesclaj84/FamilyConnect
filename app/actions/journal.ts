'use server'

import { revalidatePath } from 'next/cache'
import { confirmWrite } from '@/lib/confirmed-write'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/auth/guard'
import { belongsToFamily } from '@/lib/auth/family'
import { can } from '@/lib/auth/permissions'
import { embedOne, type PersonNameRow } from '@/lib/supabase/embed'

/**
 * Journals — an OFFICE's notebook, read and written by whoever holds it.
 *
 * ── THE FILE IS STILL `journal.ts` WHILE THE SCREEN IS `/journals` ─────────────────
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
 * on the notes and the attendee list, which resolves the same question through the parent. So:
 *
 *   * a member with no office sees an empty screen, whatever their template says;
 *   * an administrator with `journals:view` at 'any' sees THEIR OWN offices and no others;
 *   * a successor sees everything their predecessors recorded, which is the feature.
 *
 * The `journals` key still does real work and it is exactly one thing: it gates the SCREEN, so
 * a family can switch Journals off. That is §2c's distinction between a key that gates a table
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
 *   * THE TOPIC — its title, its meeting date, its attendee list — belongs to whoever
 *     recorded it. An officer who was left off a meeting's list adds a note saying so.
 *
 * ── SO EVERY WRITE HERE GOES THROUGH THE USER CLIENT ───────────────────────────────
 * Deliberately, and it is the opposite of the Gatherings pattern. AGENTS.md's preference is
 * "prefer the user's client where RLS can do the work", and here RLS can do ALL of it: every
 * rule above is a predicate over the row being written, so the policies are the boundary
 * rather than a courtesy, and `tests/rls` can attack them.
 *
 * The ADMIN client appears exactly twice, and both are reads that RLS cannot answer for the
 * caller — `getMyOffices` and `getJournalAttendeeOptions`. Each says why on itself.
 *
 * ── AND EVERY NARROWED WRITE IS `confirmWrite` ─────────────────────────────────────
 * UPDATE and DELETE narrowed by RLS are exactly the shape §8b exists for: a statement refused
 * by a policy is `{ error: null }` and zero rows, so without it an author whose office had
 * changed hands would be told their edit saved. INSERT is never wrapped — the retry is only
 * safe on the idempotent two, and an INSERT refused by RLS raises 42501 and is already honest.
 *
 * ── §8: EVERY `people` EMBED HERE NAMES ITS CONSTRAINT ─────────────────────────────
 * `position_journal_attendees` joins entries to people, so PostgREST reports a many-to-many
 * path between that pair on top of `author_id`. A bare `people(...)` embed from either journal
 * table is therefore PGRST201 — which is `[]` with the error discarded — and that is the
 * `announcement_unpins` incident exactly: an ordinary two-column join table breaking a correct
 * embed on a table nobody edited. Every `.select()` below names the constraint, including the
 * ones that would still be unambiguous on their own.
 */

export interface JournalOffice {
  role_id: string
  name: string
  /** 'executive_officer' | 'appointed_position' — the family's own grouping. */
  category: string
  /** 'national' | 'regional' | 'chapter'. Printed so two same-named offices are tellable. */
  scope: string
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

/** Somebody who was in the room. */
export interface JournalAttendee {
  person_id: string
  name: string
}

export interface JournalEntry {
  id: string
  role_id: string
  title: string
  /** 'note' | 'meeting'. A meeting carries `met_on` and an attendee list; a note carries neither. */
  kind: string
  /** `YYYY-MM-DD`, and only on a meeting. A bare DATE — there is no time of day here. */
  met_on: string | null
  author_id: string | null
  author_name: string | null
  /** Whether the CALLER recorded the topic — which decides the title and attendee controls. */
  mine: boolean
  created_at: string
  updated_at: string
  /** Oldest first: a conversation is read down the page. */
  notes: JournalNote[]
  /** Empty for a plain note, and for a meeting nobody has listed yet. */
  attendees: JournalAttendee[]
}

/** What the composer needs to open a new topic. */
export interface NewEntryInput {
  title: string
  kind: string
  /** Required when `kind` is 'meeting', and refused otherwise — the CHECK runs both ways. */
  metOn?: string | null
  /** The opening paragraph. Optional: a topic may be titled today and written in tomorrow. */
  firstNote?: string
  /** `people.id`s, for a meeting. Every one is verified against the family before it lands. */
  attendeeIds?: string[]
}

/** A member as `PersonMultiSelect` names them — see `SelectablePerson`. */
export interface JournalAttendeeOption {
  id: string
  first_name: string
  last_name: string
  nick_name: string | null
  date_of_birth: string | null
}

const ENTRY_KINDS = ['note', 'meeting']

/**
 * The offices the caller holds in the family they are viewing.
 *
 * ── THE ADMIN CLIENT, AND IT IS A CORRECTION RATHER THAN A CHOICE ──────────────────
 * `user_roles` and `family_roles` are read together, and `family_roles` carries
 * `perm:authenticated can read roles` — but `user_roles` is gated on
 * `admin/members/board-positions`, which an ordinary officer does not hold. Through the user
 * client an officer would therefore read NO assignment at all and PostgREST answers that with
 * `[]` rather than an error (§8), so every officer in the family would be told they hold no
 * office and Journals would be permanently empty for exactly the people it is for.
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
  if (!(await can(g.userId, 'journals', 'view'))) return []

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_roles')
    // ONE path to `family_roles`, so a bare embed is unambiguous — `user_roles.role_id` is the
    // only foreign key between the two. `assigned_by` points at `auth.users`, not `people`.
    // Worth stating because §8's rule is that a migration adding a second FK anywhere makes
    // this line PGRST201, which is `[]` with the error discarded.
    .select('role_id, family_roles(name, category, scope, sort_order)')
    .eq('user_id', g.userId)
    .eq('family_code', g.familyCode)
  if (error) {
    console.error(`[journals] could not read the caller's offices in ${g.familyCode}: `
      + error.message + ' — Journals will look empty to an officer who holds one.')
    return []
  }

  type Row = {
    role_id: string
    family_roles: { name: string; category: string; scope: string; sort_order: number } | null
  }
  return ((data ?? []) as unknown as Row[])
    // A NULL EMBED IS DROPPED rather than rendered as an office with no name. `role_id` is
    // NOT NULL with a cascading foreign key so this should be unreachable; it is handled
    // because the alternative is a blank row in a list of offices.
    .filter(r => r.family_roles != null)
    .map(r => ({
      role_id: r.role_id,
      name: r.family_roles!.name,
      category: r.family_roles!.category,
      scope: r.family_roles!.scope,
      sort_order: r.family_roles!.sort_order,
    }))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
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
  if (!(await can(g.userId, 'journals', 'view'))) return []

  const supabase = await createClient()
  const { data: entryRows, error } = await supabase
    .from('position_journal_entries')
    // ONE STRING LITERAL, not a concatenation. supabase-js derives the row type from the
    // literal it is handed, so `'a, b' + 'c'` types every column as GenericStringError and the
    // whole projection stops compiling — which is the useful direction of that inference and
    // is exactly what the first draft of this line did.
    .select('id, role_id, title, kind, met_on, author_id, created_at, updated_at, people!position_journal_entries_author_id_fkey(first_name, last_name)')
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
      kind: row.kind,
      met_on: row.met_on,
      author_id: row.author_id,
      // NULL WHERE THE AUTHOR HAS LEFT, and the screen prints "a former officer" for it. The
      // column is ON DELETE SET NULL precisely so the office keeps the note; rendering
      // "Unknown" would make that read like data loss.
      author_name: author ? `${author.first_name} ${author.last_name}` : null,
      mine: row.author_id != null && row.author_id === g.personId,
      created_at: row.created_at,
      updated_at: row.updated_at,
      notes: [],
      attendees: [],
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

  // ASKED FOR ONLY WHERE IT CAN EXIST. A plain note may never carry attendees — the guard
  // trigger refuses it — so a family whose officers keep no minutes makes no third round trip.
  const meetingIds = entries.filter(e => e.kind === 'meeting').map(e => e.id)
  if (meetingIds.length) {
    const { data: attendeeRows, error: attendeeError } = await supabase
      .from('position_journal_attendees')
      .select('entry_id, person_id, people!position_journal_attendees_person_id_fkey(first_name, last_name)')
      .in('entry_id', meetingIds)
    if (attendeeError) {
      console.error(`[journals] attendee read failed for office ${roleId}: `
        + attendeeError.message + ' — every meeting will render as though nobody attended.')
    }
    for (const row of attendeeRows ?? []) {
      const person = embedOne<PersonNameRow>(row.people)
      if (!person) continue
      byId.get(row.entry_id)?.attendees.push({
        person_id: row.person_id,
        name: `${person.first_name} ${person.last_name}`,
      })
    }
    for (const entry of entries) {
      entry.attendees.sort((a, b) => a.name.localeCompare(b.name))
    }
  }

  return entries
}

/**
 * The family members an officer can list as having attended a meeting.
 *
 * ── THE ADMIN CLIENT, AND WHAT GATES IT IS THE OFFICE ──────────────────────────────
 * `people`'s SELECT policy is keyed on `community/directory`, so through the user client an
 * officer in a family that has restricted its Directory would get `[]` and the attendee picker
 * would offer nobody — a screen that cannot record who was in the room. So this reads on the
 * admin client with §3 discharged by hand (`.eq('family_code', …)`), and what admits the
 * caller is holding an office, which is the access model of this whole feature.
 *
 * TWO THINGS KEEP THAT NARROW. It returns NAMES ONLY — the four fields `PersonMultiSelect`
 * needs to tell two Martha Allens apart, and no address, no phone, no chapter. And the list it
 * produces is only ever readable back inside an office's own notebook, because
 * `position_journal_attendees` is gated on the office like everything else here.
 *
 * ── EVERY APPROVED PERSON, ACCOUNT OR NOT ──────────────────────────────────────────
 * A recorded grandmother with no email address can sit in a meeting, so this is not the
 * "accounts only" list a PICKER usually wants (AGENTS.md, on projections versus pickers). What
 * it does exclude is a pending, rejected or disabled membership: somebody who has not been
 * admitted has not joined the family yet.
 */
export async function getJournalAttendeeOptions(): Promise<JournalAttendeeOption[]> {
  const g = await requireMember()
  if (!g.ok) return []
  if (!(await can(g.userId, 'journals', 'view'))) return []
  // GATE THE FETCH, NOT THE PICKER (§5). A roster is PII that reaches the browser in the RSC
  // payload whether a control renders it or not, so somebody holding no office must not have
  // it fetched at all.
  if (!(await getMyOffices()).length) return []

  const { data, error } = await createAdminClient()
    .from('people')
    .select('id, first_name, last_name, nick_name, date_of_birth')
    .eq('family_code', g.familyCode)
    .eq('membership_status', 'approved')
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
  if (error) {
    console.error(`[journals] attendee options read failed for ${g.familyCode}: ${error.message}`)
    return []
  }
  return (data ?? []) as JournalAttendeeOption[]
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
 * `propagateChapterToChildren` shape — a bare `{ success: true }` over a meeting with no
 * attendees is the silence AGENTS.md §8b is about, and reporting outright failure over a
 * topic that really was created would be worse.
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

  const kind = input?.kind === 'meeting' ? 'meeting' : 'note'
  if (!ENTRY_KINDS.includes(kind)) return { success: false, message: 'Unknown entry type.' }

  // A MEETING NEEDS A DAY. The CHECK refuses it either way; this is the sentence, and it is
  // the same rule stated at the one place somebody can act on it.
  const metOn = kind === 'meeting' ? (input?.metOn ?? '').trim() : null
  if (kind === 'meeting' && !metOn) {
    return { success: false, message: 'Say which day the meeting was.' }
  }

  const attendeeIds = kind === 'meeting'
    ? Array.from(new Set(input?.attendeeIds ?? [])).filter(Boolean)
    : []
  // §4: EVERY ID FROM THE CLIENT IS VERIFIED BEFORE IT IS WRITTEN ONTO A ROW. The row's own
  // `family_code` is the caller's, so every policy is satisfied while `person_id` could point
  // into another family — and the guard trigger underneath would refuse it with a constraint
  // name where this refuses it with a sentence.
  for (const personId of attendeeIds) {
    if (!(await belongsToFamily('people', personId, g.familyCode))) {
      return { success: false, message: 'One of the people you listed is not in this family.' }
    }
  }

  const supabase = await createClient()
  const { data: created, error } = await supabase
    .from('position_journal_entries')
    .insert({
      family_code: g.familyCode,
      role_id: roleId,
      title,
      kind,
      met_on: metOn,
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

  if (attendeeIds.length) {
    const { error: attendeeError } = await supabase
      .from('position_journal_attendees')
      .insert(attendeeIds.map(personId => ({
        family_code: g.familyCode,
        entry_id: created.id,
        person_id: personId,
      })))
    if (attendeeError) partial.push('the attendee list was not saved')
  }

  revalidatePath('/journals')
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
 * Retitle a topic, or move a meeting's date.
 *
 * The topic is the RECORDER's, so both halves of `perm:authors can edit their own journal
 * entries` apply and this function checks neither: a successor may not retitle a handover
 * note, and a former officer may not edit the office's journal from outside. What a successor
 * does instead is add a note, which is the same answer `reopenGatheringTask` gives.
 *
 * `metOn` IS PASSED STRAIGHT THROUGH, including as null. The CHECK constraint is what decides
 * whether the pair is coherent — a meeting must keep a date and a plain note may never gain
 * one — and it is a constraint rather than a branch here because this action does not read the
 * row's `kind` and must not guess it.
 *
 * `confirmWrite` because the refusal is silent otherwise (§8b): an UPDATE the policy declines
 * is zero rows and `{ error: null }`, and telling somebody their correction saved when the
 * office has changed hands is the worst version of that lie on this screen.
 */
export async function updateJournalEntry(
  entryId: string,
  title: string,
  metOn: string | null = null,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }

  const trimmed = (title ?? '').trim()
  if (!trimmed) return { success: false, message: 'Give the entry a title.' }
  const day = (metOn ?? '').trim() || null

  const supabase = await createClient()
  const outcome = await confirmWrite(() => supabase
    .from('position_journal_entries')
    .update({ title: trimmed, met_on: day })
    .eq('id', entryId)
    .select('id'))
  if (!outcome.ok) {
    return {
      success: false,
      message: 'That entry could not be changed. Only the person who recorded it can, and '
        + 'only while they still hold the office.',
    }
  }

  revalidatePath('/journals')
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

  revalidatePath('/journals')
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

  revalidatePath('/journals')
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

  revalidatePath('/journals')
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

  revalidatePath('/journals')
  return { success: true }
}

/**
 * Say who was in the room, as a whole list.
 *
 * ── WHOEVER RECORDED THE MEETING, WHICH IS NOT THE NOTE RULE ───────────────────────
 * `auth_authored_journal_entry` gates both attendee policies. An attendee list has no byline —
 * it is one assertion about one room — so two officers editing it would be overwriting each
 * other with no trace of who said what. An officer who was there and was left off adds a NOTE
 * saying so, and the record then shows both.
 *
 * ── ADD BEFORE REMOVE, AND THAT ORDER IS THE WHOLE DESIGN ──────────────────────────
 * There is no transaction across two PostgREST calls, so one of them can fail with the other
 * already applied. Inserting first means a failure leaves TOO MANY names rather than none —
 * a list somebody can see is wrong, instead of minutes quietly emptied.
 *
 * ── AND IT IS WHAT MAKES THE REFUSAL HONEST (§8b) ──────────────────────────────────
 * An INSERT refused by RLS raises 42501, so a caller who did not record the meeting is told.
 * A DELETE refused by RLS is zero rows and `{ error: null }` — indistinguishable from "there
 * was nothing to remove" — so where there is nothing to insert (somebody CLEARING the list),
 * the current list is read first: if it is already empty there is nothing to do, and if it is
 * not, `confirmWrite` turns a zero-row delete back into the refusal it was.
 */
export async function setMeetingAttendees(
  entryId: string,
  personIds: string[],
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }

  const wanted = Array.from(new Set(personIds ?? [])).filter(Boolean)
  // §4 again: every id from the client, before any of them is written onto a row.
  for (const personId of wanted) {
    if (!(await belongsToFamily('people', personId, g.familyCode))) {
      return { success: false, message: 'One of the people you listed is not in this family.' }
    }
  }

  const supabase = await createClient()

  if (wanted.length) {
    const { error } = await supabase
      .from('position_journal_attendees')
      // `ignoreDuplicates` so re-saving an unchanged list is not a unique violation. The
      // primary key is `(entry_id, person_id)`, which is what makes this safe to repeat.
      .upsert(
        wanted.map(personId => ({
          family_code: g.familyCode,
          entry_id: entryId,
          person_id: personId,
        })),
        { onConflict: 'entry_id,person_id', ignoreDuplicates: true },
      )
    if (error) {
      if (error.code === '42501') {
        return {
          success: false,
          message: 'That list could not be saved. Only the person who recorded the meeting '
            + 'can change who attended, and only while they still hold the office.',
        }
      }
      return { success: false, message: error.message }
    }

    // Everything not on the list goes. The INSERT above having landed proves the caller may
    // write here, so a zero-row answer to this genuinely means there was nothing to remove.
    const { error: pruneError } = await supabase
      .from('position_journal_attendees')
      .delete()
      .eq('entry_id', entryId)
      .not('person_id', 'in', `(${wanted.join(',')})`)
    if (pruneError) {
      return {
        success: false,
        message: 'The names were added, but the ones you took off could not be removed. '
          + 'Reload the meeting and try again.',
      }
    }
    revalidatePath('/journals')
    return { success: true }
  }

  // CLEARING THE LIST, which is the one path with no insert to prove anything. Read it first,
  // so "already empty" and "refused" stop looking alike.
  const { data: existing, error: readError } = await supabase
    .from('position_journal_attendees')
    .select('person_id')
    .eq('entry_id', entryId)
  if (readError) return { success: false, message: readError.message }
  if (!(existing ?? []).length) {
    revalidatePath('/journals')
    return { success: true }
  }

  const outcome = await confirmWrite(() => supabase
    .from('position_journal_attendees')
    .delete()
    .eq('entry_id', entryId)
    .select('person_id'))
  if (!outcome.ok) {
    return {
      success: false,
      message: 'That list could not be cleared. Only the person who recorded the meeting can '
        + 'change who attended, and only while they still hold the office.',
    }
  }

  revalidatePath('/journals')
  return { success: true }
}
