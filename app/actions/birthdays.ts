'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/auth/guard'
import { can } from '@/lib/auth/permissions'
import { belongsToFamily } from '@/lib/auth/family'
import { createAnnouncement } from '@/app/actions/announcements'
import {
  BIRTHDAY_COMPOSE_LEAD_DAYS, greetingYearFor, isBirthdayToday,
  type BirthdayPrompt, type MyBirthdayBanner,
} from '@/lib/birthday-greetings'
import { upcomingBirthdays, type BirthdayPerson } from '@/lib/birthdays'
import { todayLocal } from '@/lib/date-utils'

/**
 * Greeting a relative on their birthday, and the prompt that asks the family to.
 *
 * ── THE PRODUCT PROMPTS; THE FAMILY WRITES. THAT IS THE WHOLE DESIGN ───────────────
 * Two weeks before a birthday, anybody who may post an announcement sees the relative's name
 * with a composer already open. On the day, the birthday member's own dashboard says so with a
 * gold band and confetti. **Nothing is ever posted in the family's name that a person did not
 * type.** `20260831000002`'s header carries the decision; the short version is that a warm
 * message a relative realises was generated has told them the family did not remember.
 *
 * ── SO THERE ARE TWO SURFACES AND ONLY ONE OF THEM CAN BE AUTOMATIC ───────────────
 *   the pinned announcement    exists ONLY when a member composed it. `composeBirthdayGreeting`
 *                              is the one writer, and it goes through `createAnnouncement` so
 *                              the result is an ordinary announcement the family can edit,
 *                              unpin and delete like any other.
 *   the dashboard band         rendered for the birthday member from `people.date_of_birth`,
 *                              every year, with no row anywhere. It is the product wishing one
 *                              person a happy birthday to their face, which nobody can mistake
 *                              for the family having spoken.
 *
 * ── AND A NULL BIRTHDAY IS NOT A BIRTHDAY ─────────────────────────────────────────
 * `isMinorOn`'s reading, applied again: nobody with a blank `date_of_birth` is ever greeted,
 * ever prompted for, or ever counted as missed. Most of an older generation on a real family
 * tree has no recorded birthday, and inventing one would be the `is_minor` trap.
 */

export interface BirthdayPromptPage {
  /** Relatives with a birthday inside the lead window whom nobody has greeted yet. */
  prompts: BirthdayPrompt[]
  /** May the caller post an announcement at all? Decides whether a composer is offered. */
  canCompose: boolean
  /**
   * True when a read was refused (§8).
   *
   * A prompt list that came back empty because PostgREST refused it is indistinguishable from
   * a family with no birthdays coming up — and the second is a fact the screen states. So the
   * caller says which.
   */
  failed: boolean
}

export type BirthdayActionResult =
  | { success: true; message: string }
  | { success: false; message: string }

/**
 * Who is coming up, and has anybody said anything.
 *
 * ── GATED ON THE ANNOUNCEMENTS KEY, WHICH IS THE SCREEN THE PROMPT ACTS ON ─────────
 * `community/announcements` at `view`, then `create` for the composer — the same pair the
 * Birthdays pane already resolves. A prompt is an invitation to post, so offering one to
 * somebody who would be refused at the composer is the dead affordance this codebase refuses
 * everywhere (AGENTS.md, `QUICK_ACTION_GRANT`).
 *
 * ── THE ADMIN CLIENT, §3 BY HAND, AND WHY ─────────────────────────────────────────
 * The roster read is family-scoped by hand because it must see EVERY approved relative, not
 * the subset the caller may read: a prompt list narrowed by the reader's Directory grant would
 * quietly skip relatives, and "we did not remind you about your aunt" is a worse failure than
 * a refusal. Same argument the four activity reports make.
 */
export async function getBirthdayPrompts(): Promise<BirthdayPromptPage> {
  const g = await requireMember()
  if (!g.ok || !g.familyCode) return { prompts: [], canCompose: false, failed: false }
  if (!(await can(g.userId, 'community/announcements', 'view'))) {
    return { prompts: [], canCompose: false, failed: false }
  }

  const admin = createAdminClient()
  const today = todayLocal()

  const [roster, greeted] = await Promise.all([
    admin.from('people')
      .select('id, first_name, last_name, date_of_birth')
      .eq('family_code', g.familyCode)
      .eq('membership_status', 'approved')
      .not('date_of_birth', 'is', null)
      // A DEAD RELATIVE HAS NO NEXT BIRTHDAY, and this line is the only thing that knows it.
      // `lib/birthdays.ts` walks the calendar and deliberately knows nothing about
      // `sunset_date` — `getUpcomingBirthdays` says so at length and filters at the FETCH for
      // the same reason. Left out, this prompt asks the family to write a birthday message
      // for somebody who died in 1998. Found by `tests/rls`' positive control, not by
      // reading: the attack half passed, because a leaked row is a leaked row either way.
      .is('sunset_date', null),
    admin.from('birthday_greetings')
      .select('person_id, status')
      .eq('family_code', g.familyCode)
      .eq('greeting_year', greetingYearFor(today)),
  ])

  // §8: `const { data }` discards the error, and the two failures here are different lies —
  // a refused roster is "no birthdays coming up", and a refused greetings read is "nobody has
  // said anything", which would re-prompt a family that already greeted everybody.
  if (roster.error || greeted.error) {
    console.error('[birthdays] a read was refused: '
      + [roster.error?.message, greeted.error?.message].filter(Boolean).join(' · '))
    return { prompts: [], canCompose: false, failed: true }
  }

  const done = new Set((greeted.data ?? []).map(r => r.person_id as string))

  const people: BirthdayPerson[] = (roster.data ?? []).map(p => ({
    id: p.id as string,
    firstName: (p.first_name as string | null) ?? '',
    lastName: (p.last_name as string | null) ?? '',
    dateOfBirth: (p.date_of_birth as string | null) ?? null,
  }))

  // `upcomingBirthdays` is the one definition of the horizon walk and takes `today` as a
  // parameter (§7b), so the whole of this is checkable by value. A SHORTER horizon than the
  // Birthdays pane's sixty days, deliberately: that pane is a list an organizer browses, and
  // this is a prompt about something imminent. Two weeks is enough time to write something and
  // not so much that the prompt becomes furniture.
  const prompts = upcomingBirthdays(people, today, BIRTHDAY_COMPOSE_LEAD_DAYS)
    .filter(b => !done.has(b.id))
    .map(b => ({ ...b, greeted: false }))

  return {
    prompts,
    canCompose: await can(g.userId, 'community/announcements', 'create'),
    failed: false,
  }
}

/**
 * Post a birthday greeting the family wrote, and record that it happened.
 *
 * ── IT GOES THROUGH `createAnnouncement`, WHICH IS NOT A DETAIL ────────────────────
 * The result is an ordinary `announcements` row: the family can edit the words, unpin it,
 * delete it, and every reader can dismiss it from their own Recent Updates. A second writer
 * with its own table would be a second kind of announcement nobody could manage from the
 * screen where announcements are managed.
 *
 * `pinned: true` is REQUESTED and may be refused — `createAnnouncement` honours a pin only for
 * a caller holding `edit`, so an ordinary member's greeting posts unpinned and still reaches
 * the board. That is the right degradation and is not worth a second message: the greeting
 * arrived either way.
 *
 * ── AND THE RECORD IS WRITTEN EVEN IF THE PIN WAS NOT ─────────────────────────────
 * `birthday_greetings` says a greeting HAPPENED. Whether it was pinned is a fact about the
 * poster's grant, not about whether the family greeted somebody.
 */
export async function composeBirthdayGreeting(input: {
  personId: string
  title: string
  body: string
}): Promise<BirthdayActionResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.familyCode) return { success: false, message: t('act.youDoNotBelongFamily') }

  // `create`, not `view` — a composer is a promise that posting works.
  if (!(await can(g.userId, 'community/announcements', 'create'))) {
    return { success: false, message: t('act.notAuthorized') }
  }

  const personId = (input?.personId ?? '').trim()
  const title = (input?.title ?? '').trim()
  const body = (input?.body ?? '').trim()
  if (!personId) return { success: false, message: t('act.chooseRelative') }
  if (!title || !body) return { success: false, message: t('act.titleMessageRequired') }

  // §4: the id arrives from the client and is written onto a row whose own `family_code` is
  // the caller's, so every policy would be satisfied while the row pointed into another
  // family. The guard trigger on the table refuses it underneath this; this is what tells the
  // caller rather than letting them watch a 23514.
  if (!(await belongsToFamily('people', personId, g.familyCode))) {
    return { success: false, message: t('act.personNotFound') }
  }

  // AND THE PROMPT LIST IS NOT A GATE (§2). `getBirthdayPrompts` withholds a departed
  // relative, and this action is a public HTTP endpoint that takes the id anyway — so the
  // check has to be here as well or the greeting can still be posted by sending the id.
  // Read on the ADMIN client, family-scoped by hand (§3), because `people`'s SELECT policy
  // admits a record belonging to nobody only through the resource key this action does not
  // resolve.
  const admin = createAdminClient()
  const { data: person, error: personError } = await admin
    .from('people').select('sunset_date')
    .eq('id', personId).eq('family_code', g.familyCode).maybeSingle()
  // §8: a refused read must not be read as "they are alive". Refuse rather than post.
  if (personError || !person) {
    return { success: false, message: t('act.personNotFound') }
  }
  if (person.sunset_date) {
    return { success: false, message: t('act.relativeHasDied') }
  }

  const posted = await createAnnouncement({
    title, body,
    // NATIONAL, always. A birthday is not a chapter's business — the audience rule exists so
    // a chapter meeting does not reach the whole family, and this is the opposite case.
    scope: 'national',
    pinned: true,
    // ── THE PIN EXPIRES, AND THAT IS WHY IT IS SAFE TO PIN AT ALL ──────────────────
    // A permanent pin on a birthday greeting is a board that fills up with last year's
    // birthdays. Two days: the day itself and the one after, so somebody who opens the app
    // the following morning still sees it. `pinned_until` is honoured by `isPinActive`.
    pinned_until: pinUntil(),
  })
  if (!posted.success) {
    return { success: false, message: posted.message ?? t('act.couldNotPostThat') }
  }

  const { error } = await admin.from('birthday_greetings').upsert({
    family_code: g.familyCode,
    person_id: personId,
    greeting_year: greetingYearFor(todayLocal()),
    status: 'composed',
    announcement_id: posted.id ?? null,
    acted_by: g.personId,
  }, { onConflict: 'person_id,greeting_year' })

  // NOT FATAL, and reported rather than swallowed. The greeting is POSTED — the family has
  // said the thing — and rolling that back because the bookkeeping row failed would be
  // deleting a real message over a record of it. What the failure costs is that the prompt
  // reappears, which is the survivable direction.
  if (error) {
    console.error(`[birthdays] greeting posted but not recorded for ${personId}: ${error.message}`)
    return { success: true, message: t('act.greetingPostedNotRecorded') }
  }

  revalidatePath('/community/announcements')
  revalidatePath('/dashboard')
  return { success: true, message: t('act.greetingPosted') }
}

/**
 * "Not this year."
 *
 * ── WITHOUT THIS THE PROMPT IS A NAG, WHICH IS THE FEATURE FAILING ────────────────
 * A family that greets in person, a relative who has asked not to be named, a recorded
 * ancestor who died and whose birthday nobody wants a card about — all three are ordinary, and
 * a prompt that cannot be put away is a prompt people learn to scroll past. It records
 * `dismissed` rather than deleting anything, so "did anyone say anything to Ada?" still has an
 * answer, and next year starts clean because the row is keyed on the YEAR.
 */
export async function dismissBirthdayPrompt(personId: string): Promise<BirthdayActionResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.familyCode) return { success: false, message: t('act.youDoNotBelongFamily') }

  // The same grant the composer needs. Dismissing is a decision on the family's behalf, and
  // somebody who could not post cannot decide the family will not.
  if (!(await can(g.userId, 'community/announcements', 'create'))) {
    return { success: false, message: t('act.notAuthorized') }
  }

  const id = (personId ?? '').trim()
  if (!id) return { success: false, message: t('act.chooseRelative') }
  if (!(await belongsToFamily('people', id, g.familyCode))) {
    return { success: false, message: t('act.personNotFound') }
  }

  const { error } = await createAdminClient().from('birthday_greetings').upsert({
    family_code: g.familyCode,
    person_id: id,
    greeting_year: greetingYearFor(todayLocal()),
    status: 'dismissed',
    announcement_id: null,
    acted_by: g.personId,
  }, { onConflict: 'person_id,greeting_year' })
  if (error) {
    console.error(`[birthdays] could not dismiss the prompt for ${id}: ${error.message}`)
    return { success: false, message: t('act.couldNotSavePleaseTry') }
  }

  revalidatePath('/community/announcements')
  return { success: true, message: t('act.promptPutAway') }
}

/**
 * Is it the CALLER's own birthday today, and did their family say anything?
 *
 * ── THE ONE READ ON THIS SCREEN THAT IS ABOUT THE READER ──────────────────────────
 * Everything else in this module is about the family's relatives. This is the band on the
 * member's own dashboard, so it reads their own `people` row and nothing else — no roster, no
 * grant, no permission key. There is nothing to withhold: it is their birthday and their own
 * date of birth.
 *
 * ── AND IT IS RENDERED WHETHER OR NOT ANYBODY GREETED THEM ────────────────────────
 * `greeted` is passed through so the band can say "your family posted something" and link to
 * it — but the band appears either way, which is the decision TODO.md's first question
 * settles: the product greets the person to their face, and only a person's words ever reach
 * the family's board.
 */
export async function getMyBirthdayBanner(): Promise<MyBirthdayBanner | null> {
  const g = await requireMember()
  if (!g.ok || !g.familyCode || !g.personId) return null

  const admin = createAdminClient()
  const { data: me, error } = await admin.from('people')
    .select('first_name, date_of_birth')
    .eq('family_code', g.familyCode)
    .eq('id', g.personId)
    .maybeSingle()
  // §8, and here the honest answer to a failure IS silence: the alternative is a celebration
  // banner over a read that did not answer, on somebody's dashboard, possibly on a day that is
  // not their birthday. Logged so it is not invisible.
  if (error) {
    console.error(`[birthdays] could not read the caller's own row: ${error.message}`)
    return null
  }

  const dob = (me?.date_of_birth as string | null) ?? null
  const today = todayLocal()
  // A NULL BIRTHDAY IS NOT A BIRTHDAY. See the module header.
  if (!dob || !isBirthdayToday(dob, today)) return null

  const { data: greeting } = await admin.from('birthday_greetings')
    .select('announcement_id, status')
    .eq('family_code', g.familyCode)
    .eq('person_id', g.personId)
    .eq('greeting_year', greetingYearFor(today))
    .maybeSingle()

  return {
    firstName: (me?.first_name as string | null) ?? '',
    // `dismissed` is NOT a greeting, and this is the one place that distinction reaches a
    // screen: a member whose prompt the family put away must not be shown "your family posted
    // something" with a link to nothing.
    greetedAnnouncementId: greeting?.status === 'composed'
      ? ((greeting.announcement_id as string | null) ?? null)
      : null,
  }
}

/**
 * When a birthday pin stops being pinned: the end of tomorrow.
 *
 * Two days rather than one, so somebody who opens the app the morning after still sees it —
 * and not more, because a board of last month's birthdays is what `pinned_until` exists to
 * prevent. An ISO instant, which is what the column is.
 */
function pinUntil(): string {
  const at = new Date()
  at.setUTCDate(at.getUTCDate() + 2)
  at.setUTCHours(0, 0, 0, 0)
  return at.toISOString()
}
