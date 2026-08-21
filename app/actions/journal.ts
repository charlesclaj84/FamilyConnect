'use server'

import { revalidatePath } from 'next/cache'
import { confirmWrite } from '@/lib/confirmed-write'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/auth/guard'
import { can } from '@/lib/auth/permissions'
import { embedOne, type PersonNameRow } from '@/lib/supabase/embed'

/**
 * The Journal — notes that belong to an OFFICE rather than to whoever holds it.
 *
 * ── WHAT DECIDES ACCESS HERE IS NOT A GRANT ────────────────────────────────────────
 * `20260821000005` puts four policies on `position_journal_entries` and not one of them
 * evaluates `auth_permission`. What they test is `auth_holds_family_role(role_id)` — do you
 * hold this office, in the family you are viewing — so:
 *
 *   * a member with no office sees an empty screen, whatever their template says;
 *   * an administrator with `journal:view` at 'any' sees THEIR OWN offices and no others;
 *   * a successor sees everything their predecessors recorded, which is the feature.
 *
 * The `journal` key still does real work and it is exactly one thing: it gates the SCREEN, so
 * a family can switch the Journal off. That is §2c's distinction between a key that gates a
 * table and a key that gates a screen band, and the migration's header argues it at length.
 *
 * ── SO EVERY WRITE HERE GOES THROUGH THE USER CLIENT ───────────────────────────────
 * Deliberately, and it is the opposite of the Gatherings pattern. AGENTS.md's preference is
 * "prefer the user's client where RLS can do the work", and here RLS can do ALL of it: the
 * rules are predicates over the row being written, so the policies are the boundary rather
 * than a courtesy, and `tests/rls` can attack them.
 *
 * The one place the ADMIN client appears is reading the caller's own offices — see
 * `getMyOffices` for why that read cannot be the user client's.
 *
 * ── AND EVERY WRITE IS `confirmWrite` ──────────────────────────────────────────────
 * These are UPDATE and DELETE narrowed by RLS, which is exactly the shape §8b exists for: a
 * statement refused by a policy is `{ error: null }` and zero rows, so without it an author
 * whose office had changed hands would be told their edit saved. INSERT is never wrapped —
 * the retry is only safe on the idempotent two, and an INSERT refused by RLS raises 42501 and
 * is already honest.
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

export interface JournalEntry {
  id: string
  role_id: string
  title: string
  body: string
  author_id: string | null
  /** "Martha Allen", or null where the author has left the family. */
  author_name: string | null
  /** Whether the CALLER wrote it — what the edit and delete controls hang off. */
  mine: boolean
  created_at: string
  updated_at: string
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
 * office and the Journal would be permanently empty for exactly the people it is for.
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
  if (!(await can(g.userId, 'journal', 'view'))) return []

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
    console.error(`[journal] could not read the caller's offices in ${g.familyCode}: `
      + error.message + ' — the Journal will look empty to an officer who holds one.')
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
 * Every entry on one office.
 *
 * ── THE USER CLIENT, AND THE POLICY IS THE WHOLE BOUNDARY ──────────────────────────
 * `perm:officeholders can read the journal` tests `auth_holds_family_role(role_id)`, so a
 * `roleId` naming an office the caller does not hold answers `[]` — which is why this function
 * does not check that itself. There is nothing here a second check would add that the policy
 * does not already refuse, and a duplicated rule is one that drifts.
 *
 * WHAT IT DOES OWE IS §8: the error is read. An empty journal and a refused read look
 * identical, and the second would tell an officer their predecessors left them nothing.
 */
export async function getJournalEntries(roleId: string): Promise<JournalEntry[]> {
  const g = await requireMember()
  if (!g.ok) return []
  if (!(await can(g.userId, 'journal', 'view'))) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('position_journal_entries')
    // `people!…_author_id_fkey`: one path today, and named anyway. This table will acquire a
    // second people-shaped column the first time somebody adds "acknowledged_by", and a bare
    // embed would then be PGRST201 — that is, `[]` — on a query nobody had edited (§8).
    // ONE STRING LITERAL, not a concatenation, and it is long rather than wrapped for that
    // reason. supabase-js derives the row type from the literal it is handed, so
    // `'a, b' + 'c'` types every column as GenericStringError and the whole projection stops
    // compiling — which is the useful direction of that inference and is exactly what the
    // first draft of this line did. `getMemberProfileForEdit` carries the same note.
    .select('id, role_id, title, body, author_id, created_at, updated_at, people!position_journal_entries_author_id_fkey(first_name, last_name)')
    .eq('role_id', roleId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error(`[journal] entry read failed for office ${roleId}: ${error.message}`)
    return []
  }

  return (data ?? []).map(row => {
    const author = embedOne<PersonNameRow>(row.people)
    return {
      id: row.id,
      role_id: row.role_id,
      title: row.title,
      body: row.body ?? '',
      author_id: row.author_id,
      // NULL WHERE THE AUTHOR HAS LEFT, and the screen prints "a former officer" for it. The
      // column is ON DELETE SET NULL precisely so the office keeps the note; rendering
      // "Unknown" would make that read like data loss.
      author_name: author ? `${author.first_name} ${author.last_name}` : null,
      mine: row.author_id != null && row.author_id === g.personId,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  })
}

/**
 * Write a new entry in an office's journal.
 *
 * ── `author_id` IS NEVER A PARAMETER ───────────────────────────────────────────────
 * It comes from the caller's own guard, and the INSERT policy pins it to `auth_person_id()`
 * as a CONJUNCT — so a wrong value is a refused write rather than an entry filed under
 * somebody else's byline. AGENTS.md §2b: never take an identity as a parameter.
 *
 * ── `family_code` IS WRITTEN, AND THE TRIGGER IS WHY THAT IS SAFE ──────────────────
 * The column is denormalised off `role_id` so four policies can scope on it without a join
 * per row, and `tg_journal_entry_same_family` refuses a row whose `family_code` disagrees with
 * its office's. That is §4 in the database: the row's own `family_code` satisfies every
 * policy while `role_id` could point elsewhere, and nothing but the trigger asks.
 */
export async function addJournalEntry(
  roleId: string,
  title: string,
  body: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!g.personId) return { success: false, message: 'Profile not found' }

  const trimmed = (title ?? '').trim()
  // The CHECK constraint refuses a blank title with a constraint name; this supplies a
  // sentence. Both are wanted — the constraint is what holds when somebody posts to the
  // endpoint directly, and this is what an officer reads.
  if (!trimmed) return { success: false, message: 'Give the entry a title.' }

  const supabase = await createClient()
  const { error } = await supabase.from('position_journal_entries').insert({
    family_code: g.familyCode,
    role_id: roleId,
    title: trimmed,
    body: (body ?? '').trim(),
    author_id: g.personId,
  })
  if (error) {
    // 42501 is the INSERT policy refusing, and the likeliest reason by far is that the caller
    // does not hold this office — either they never did, or it changed hands while the page
    // was open. Said plainly rather than guessed at from a code.
    if (error.code === '42501') {
      return {
        success: false,
        message: 'That entry was refused. The Journal is only writable by whoever holds the '
          + 'office — reload the page to see which ones are yours.',
      }
    }
    return { success: false, message: error.message }
  }

  revalidatePath('/journal')
  return { success: true }
}

/**
 * Edit an entry — the author's own, and only while they still hold the office.
 *
 * Both halves are conjuncts of `perm:authors can edit their own journal entries`, so this
 * function checks neither: a successor may not rewrite a handover note, and a former officer
 * may not edit the office's journal from outside. See the migration's header for why that is
 * not in tension with "the notes follow the position" — the office owns the RECORD, and a
 * record a successor can quietly rewrite is not one.
 *
 * `confirmWrite` because the refusal is silent otherwise (§8b): an UPDATE the policy declines
 * is zero rows and `{ error: null }`, and telling somebody their correction saved when the
 * office has changed hands is the worst version of that lie on this screen.
 */
export async function updateJournalEntry(
  entryId: string,
  title: string,
  body: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }

  const trimmed = (title ?? '').trim()
  if (!trimmed) return { success: false, message: 'Give the entry a title.' }

  const supabase = await createClient()
  const outcome = await confirmWrite(() => supabase
    .from('position_journal_entries')
    .update({ title: trimmed, body: (body ?? '').trim() })
    .eq('id', entryId)
    .select('id'))
  if (!outcome.ok) {
    return {
      success: false,
      message: 'That entry could not be changed. Only the person who wrote it can, and only '
        + 'while they still hold the office.',
    }
  }

  revalidatePath('/journal')
  return { success: true }
}

/** Remove an entry. Same rule as editing, and the same reason for `confirmWrite`. */
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
      message: 'That entry could not be removed. Only the person who wrote it can, and only '
        + 'while they still hold the office.',
    }
  }

  revalidatePath('/journal')
  return { success: true }
}
