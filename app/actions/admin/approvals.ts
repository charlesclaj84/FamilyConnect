'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRead } from '@/lib/auth/guard'
import { canAny, scopeInFamilies } from '@/lib/auth/permissions'
import { getMyFamilyCode, getMyFamilies } from '@/lib/auth/family'
import { createNotification } from '@/lib/notifications'
import { sendEmail, emailOrigin } from '@/lib/email/send'
import { membershipApprovedEmail } from '@/lib/email/templates'
import { storedLocale } from '@/lib/i18n/locales'
import { currentUser } from '@/lib/auth/current-user'
import { callerI18n } from '@/lib/i18n/server'

/**
 * Member Approvals: review, admit or refuse the people who have asked to join.
 *
 * WHY THE DECISIONS GO THROUGH AN RPC AND NOT THROUGH THIS FILE
 *   set_membership_status() (20260806000011 §7c) is SECURITY DEFINER and does its own
 *   authorization from auth.uid(). It is called on the USER client, which is the whole
 *   point: the house style of reaching for createAdminClient() would leave auth.uid()
 *   NULL, and a function whose checks all key on it would then be checking nothing.
 *   That failure mode was the second of the four blockers recorded against this phase.
 *   The RPC refuses a NULL auth.uid() outright, so the mistake fails loudly instead of
 *   quietly, but the rule stands: user client here, always.
 *
 *   So the TypeScript check below is the friendly layer and the SQL check is the real
 *   one — the same division as requireView() versus RLS everywhere else in the app.
 *
 * WHY THE LIST IS READ ON THE SERVICE ROLE
 *   The opposite choice, and for a reason. A REJECTED row is outside the `people`
 *   SELECT policy's reach: that policy admits a non-approved row only to a caller who
 *   can view Member Approvals, and it is exactly this page. Reading the queue as the
 *   user works for pending rows but would make a rejected one invisible to the screen
 *   that has to show it was rejected. Being the service role, every query below
 *   re-applies the family scoping RLS would have done — `.eq('family_code', …)` on the
 *   family resolved from the caller's own people row, never from an argument.
 */

export interface Applicant {
  personId: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  status: 'pending' | 'approved' | 'rejected'
  requestedAt: string | null
  decidedAt: string | null
  /** Display name of the administrator who decided, when known. */
  decidedBy: string | null
  /** The administrator's reason for declining, shown to the applicant. */
  note: string | null
  /**
   * What the applicant said when asking for the decision to be looked at again. Their
   * words, not the family's — never render it as though the family wrote it.
   */
  appeal: string | null
}

export type ApprovalResult =
  | { success: true }
  | { success: false; message: string }

/**
 * The queue, plus recently decided applications so a decision is visibly recorded
 * rather than vanishing.
 *
 * Only ever the caller's own family. `requireRead` establishes the view grant; the
 * family code comes from getMyFamilyCode(), which derives it from the caller's people
 * row — the authority for family membership, never user_metadata.
 */
export async function getApplicants(): Promise<{
  pending: Applicant[]
  decided: Applicant[]
  canDecide: boolean
}> {
  const g = await requireRead('admin/members/approvals')
  if (!g.ok) return { pending: [], decided: [], canDecide: false }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('people')
    // One string literal, not a concatenation: the typed client infers the row shape
    // from the literal, and a computed select string degrades every column to
    // GenericStringError.
    .select('id, first_name, last_name, primary_email, primary_phone, membership_status, membership_requested_at, membership_decided_at, membership_decided_by, membership_note, membership_appeal')
    .eq('family_code', g.familyCode)
    .not('user_id', 'is', null)
    .in('membership_status', ['pending', 'rejected'])
    .order('membership_requested_at', { ascending: true })

  // An empty result and a refused query are different things, and `data` alone
  // cannot tell them apart — see AGENTS.md §8.
  if (error) return { pending: [], decided: [], canDecide: false }

  const rows = data ?? []

  // Resolve decider names in one pass. These are people rows in the same family, so
  // the family scoping is already applied.
  const deciderIds = [...new Set(rows
    .map(r => r.membership_decided_by as string | null)
    .filter((v): v is string => Boolean(v)))]
  const names = new Map<string, string>()
  if (deciderIds.length) {
    const { data: deciders } = await admin
      .from('people')
      .select('user_id, first_name, last_name')
      .eq('family_code', g.familyCode)
      .in('user_id', deciderIds)
    for (const d of deciders ?? []) {
      names.set(d.user_id as string, `${d.first_name} ${d.last_name}`.trim())
    }
  }

  const toApplicant = (r: Record<string, unknown>): Applicant => ({
    personId: r.id as string,
    firstName: (r.first_name as string) ?? '',
    lastName: (r.last_name as string) ?? '',
    email: (r.primary_email as string) || null,
    phone: (r.primary_phone as string) || null,
    status: r.membership_status as Applicant['status'],
    requestedAt: (r.membership_requested_at as string) ?? null,
    decidedAt: (r.membership_decided_at as string) ?? null,
    decidedBy: names.get(r.membership_decided_by as string) ?? null,
    note: (r.membership_note as string) ?? null,
    // The applicant's own words, when they have asked a refusal to be looked at again
    // (20260811000002). Distinct from `note`, which is the administrator's reason for the
    // refusal — two authors, and the queue renders them as such.
    appeal: (r.membership_appeal as string) ?? null,
  })

  return {
    pending: rows.filter(r => r.membership_status === 'pending').map(toApplicant),
    decided: rows.filter(r => r.membership_status === 'rejected').map(toApplicant),
    // Drives the UI only. The RPC decides for real.
    canDecide: await canAny(g.userId, 'admin/members/approvals', 'edit'),
  }
}

/**
 * How many people are waiting on a decision, for the notification bell.
 *
 * A COUNT AND NOTHING ELSE. The bell hangs on every page in the app, so this runs on
 * every render, and the alternative — calling getApplicants() and reading `.length` —
 * would pull every applicant's name, email and phone into the navbar's props on every
 * page load, for a number. Props are serialized into the RSC payload whether a
 * component reads them or not (AGENTS.md §5), so that is a roster published to the
 * browser, not a wasted query. `head: true` sends no rows at all.
 *
 * Returns 0 rather than throwing for a caller without the grant, because the bell is
 * rendered for everyone and only some of them can act on this. The guard is what makes
 * it 0: a member with no admin/approvals view never reaches the query, so the number
 * they cannot act on is never computed and never reaches their browser.
 *
 * `.not('user_id', 'is', null)` matters as much here as in getApplicants(). A `people`
 * row can be pending WITHOUT anyone waiting behind it — that is what pre-entering a
 * relative creates, and one of those sat in 23HAYW until 2026-08-08. Counting those
 * would put a number on the bell that the approvals queue does not show and no
 * decision can clear.
 *
 * 'pending' only, never `<> 'approved'`: 'rejected' and 'disabled' are decided states,
 * and testing positively for the one state that means "waiting" is the rule
 * 20260807000000 set for this column.
 */
export async function getPendingApprovalCount(): Promise<number> {
  const g = await requireRead('admin/members/approvals')
  if (!g.ok) return 0

  const admin = createAdminClient()
  const { count, error } = await admin
    .from('people')
    .select('id', { count: 'exact', head: true })
    .eq('family_code', g.familyCode)
    .not('user_id', 'is', null)
    .eq('membership_status', 'pending')

  // A refused query and an empty queue are different things and `count` cannot tell
  // them apart — AGENTS.md §8. Nothing on screen distinguishes them either, so the
  // honest failure is to show no badge rather than a wrong one.
  if (error) return 0
  return count ?? 0
}

/**
 * One waiting queue per family the caller can work — INCLUDING the ones they are not
 * currently looking at.
 *
 * ── THE BUG THIS EXISTS FOR ─────────────────────────────────────────────────────────
 * Everything about the bell is scoped to the ACTIVE family and every piece of it was
 * right to be: `getNotifications` filters on the caller's people row in that family
 * (`getMyPersonId`), the realtime channel filters on the same id, and
 * `getPendingApprovalCount` above resolves its family from `requireRead`. Notifications
 * hang off a family-scoped row, so that is what a notification IS.
 *
 * The consequence nobody chose is that an administrator of two families, sitting in the
 * first, cannot be told that somebody is waiting in the second. The row is in the queue,
 * the notification is in the table, and the only way to find either is to switch family
 * and look — which is exactly the thing you do not do when you have no reason to think
 * anything has happened. Adding the missing notifications to the join paths did not fix
 * that and could not: the notification was never the missing part.
 *
 * So this answers the whole question at once, and `NotificationBell` renders one standing
 * row per family with somebody in it.
 *
 * ── WHAT IT DOES AND DOES NOT PUBLISH (AGENTS.md §5) ────────────────────────────────
 * COUNTS AND FAMILY NAMES, nothing else — no applicant name, email, phone or date, in any
 * family. `getApplicants` is still the only thing that returns a person, and it is still
 * scoped to one family behind its own guard. The names here are the caller's own
 * memberships, which `FamilySwitcher` already renders in the same bar.
 *
 * And a family only appears when the caller genuinely holds `admin/approvals:view`
 * THERE. `scopeInFamilies` resolves that per family from the same rules `resolveScope`
 * applies, so an administrator of ALPHA who is an ordinary member of BRAVO learns nothing
 * about BRAVO's queue — the count is never computed rather than computed and hidden.
 *
 * The service role, necessarily: this reads across families, which is precisely what RLS
 * exists to prevent, so §3's obligation is discharged by hand — the family codes come
 * from the caller's OWN memberships and the one query below is `.in()`-scoped to them.
 */
export interface PendingQueue {
  familyCode: string
  familyName: string
  count: number
  /** True for the family the caller is already acting in — that row needs no switch. */
  isActive: boolean
}

export async function getPendingApprovalQueues(): Promise<PendingQueue[]> {
  const { user } = await currentUser()
  if (!user) return []

  const [families, scopes] = await Promise.all([
    getMyFamilies(user.id),
    scopeInFamilies(user.id, 'admin/members/approvals', 'view'),
  ])

  const workable = families.filter(f => (scopes.get(f.familyCode) ?? 'none') !== 'none')
  if (!workable.length) return []

  // ONE query for every family rather than one per family: a count-per-family is a
  // `GROUP BY` PostgREST will not give us, so the pending ids come back and are tallied
  // here. `id` alone — nothing identifying leaves the server.
  //
  // `.not('user_id', 'is', null)` matters for the same reason it does in the two
  // functions above: a `people` row can be pending with NOBODY waiting behind it, which
  // is what pre-entering a relative creates. Counting those would put a number on the
  // bell that the approvals queue does not show and no decision can clear.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('people')
    .select('id, family_code')
    .in('family_code', workable.map(f => f.familyCode))
    .not('user_id', 'is', null)
    .eq('membership_status', 'pending')

  // A refused query and an empty queue are the same `[]` and mean opposite things (§8).
  // No badge is the honest answer to "I do not know", the same choice the count above
  // makes.
  if (error) return []

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const code = row.family_code as string
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }

  return workable
    .map(f => ({
      familyCode: f.familyCode,
      familyName: f.familyName,
      count: counts.get(f.familyCode) ?? 0,
      isActive: f.isActive,
    }))
    .filter(q => q.count > 0)
    // The family being viewed first — its row is the one that needs no switch to act on
    // — then the rest by name, so the list does not reorder as counts change.
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.familyName.localeCompare(b.familyName))
}

async function decide(
  personId: string,
  status: 'approved' | 'rejected',
  note?: string,
): Promise<ApprovalResult> {
  const supabase = await createClient()
  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) return { success: false, message: t('act.notAuthenticated') }

  // The friendly layer. canAny and not can(): admitting a stranger to the family has
  // no coherent "own" version — the row a member would own is their own application,
  // and self-approval is the abuse case the RPC also refuses outright.
  if (!(await canAny(user.id, 'admin/members/approvals', 'edit'))) {
    return { success: false, message: t('act.notAuthorized') }
  }

  // USER client. See the header.
  const { data, error } = await supabase
    .rpc('set_membership_status', {
      p_person_id: personId,
      p_status: status,
      p_note: note?.trim() ? note.trim() : null,
    })
    .maybeSingle<{ ok: boolean; message: string | null }>()

  if (error) return { success: false, message: t('act.couldNotRecordDecisionPlease') }
  if (!data?.ok) return { success: false, message: data?.message ?? 'Not authorized' }

  // Tell the applicant. Their own notification, in the family they applied to — the
  // one thing they may read while pending, and the reason the bell is suppressed for
  // them rather than the notifications themselves being withheld.
  const familyCode = await getMyFamilyCode(user.id)
  if (familyCode) {
    try {
      await createNotification({
        familyCode,
        recipientPersonId: personId,
        type: status === 'approved' ? 'membership_approved' : 'membership_rejected',
        title: status === 'approved'
          ? 'You have been approved'
          : 'Your membership request was declined',
        body: status === 'approved'
          ? 'Welcome to the family. Everything is now available to you.'
          : note?.trim() || undefined,
        link: status === 'approved' ? '/dashboard' : undefined,
      })
    } catch {
      // The decision is recorded; failing to announce it must not undo it.
    }
  }

  // ...and email them, if they got in.
  //
  // BOTH, NOT EITHER. The notification above is what an approved member sees if they
  // happen to come back; the email is what brings them back. Somebody who applied, was
  // told to wait and closed the tab has no reason to look again on the day a decision is
  // made, and nothing else in the product reaches them — the bell is deliberately
  // suppressed while pending.
  //
  // Nothing is emailed on rejection, and that is a decision. A refusal is a message from
  // a family to a person, and the family is the right author of it; an automated "you
  // were declined" with a free-text reason attached lands badly and cannot be softened.
  // The in-app notification carries the note for anyone who comes looking.
  if (status === 'approved' && familyCode) {
    try {
      const admin = createAdminClient()

      // Service role: RLS is off, so the family scoping is re-applied by hand on both
      // reads — AGENTS.md §3. `familyCode` is the ACTOR's, resolved from their own people
      // row, and set_membership_status() has already refused a cross-family decision, so
      // a personId that survives to here is in this family. The .eq is what makes that
      // true of the query rather than merely true of the argument.
      const { data: person } = await admin
        .from('people')
        .select('first_name, user_id, locale')
        .eq('family_code', familyCode)
        .eq('id', personId)
        .maybeSingle()

      const { data: family } = await admin
        .from('families')
        .select('family_name')
        .eq('family_code', familyCode)
        .maybeSingle()

      // The AUTH address, NOT people.primary_email. primary_email is a profile field its
      // owner can set to anything — it is on the allow-list in lib/profile-columns.ts and
      // a pending member may edit their own profile — so mailing it would let an applicant
      // aim this message at a third party. The auth address is the one the account signs
      // in with and, with confirmations on, has demonstrably received mail at.
      const userId = person?.user_id as string | null
      const authEmail = userId
        ? (await admin.auth.admin.getUserById(userId)).data.user?.email ?? null
        : null

      if (authEmail) {
        const mail = membershipApprovedEmail({
          origin: emailOrigin(),
          firstName: (person?.first_name as string) ?? '',
          familyName: (family?.family_name as string) ?? familyCode,
          // THE APPLICANT'S OWN CHOICE, off the row already read above — never
          // `resolveLocale`, which would fall through to the APPROVER's `Accept-Language`
          // and mail a Spanish-speaking applicant in the administrator's language. A
          // pending member can set this on My Profile while they wait, so it is real
          // evidence rather than a column nobody has touched.
          locale: storedLocale(person?.locale as string | null),
        })
        await sendEmail({ to: authEmail, subject: mail.subject, html: mail.html, tag: mail.tag })
      }
    } catch {
      // sendEmail() does not throw, so reaching here means a lookup failed. The member is
      // approved either way; the worst case is that they find out on their next visit.
    }
  }

  // LAYOUT SCOPE, not two page paths, and this action was the last grant-changing one in
  // the app still using page scope — `applyTemplate`, `setTemplatePermission`,
  // `deleteTemplate`, `setMemberEnabled` and `setFamilyTier` all call
  // `revalidatePath('/', 'layout')` already.
  //
  // What page scope missed is the APPROVER'S OWN SHELL. The bell's queue rows are
  // resolved in app/(protected)/layout.tsx via TopBar, not on either of the two pages
  // named here, so admitting somebody left the badge sitting at its old number until
  // something else happened to re-render the layout. It is also what makes the sidebar
  // right for an administrator whose own access changed in the same breath.
  //
  // It does NOT help the applicant, and cannot: this runs in the approver's request and
  // reaches the approver's caches. That half is components/layout/ShellWatcher.tsx.
  //
  // (The old /admin/approvals route is only a redirect now — the queue is the Pending
  // Approval tab on Members & Access — so revalidating it refreshed nothing either way.)
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function approveApplicant(personId: string): Promise<ApprovalResult> {
  return decide(personId, 'approved')
}

/**
 * Refusing an application sets 'rejected' rather than deleting the row, and that is a
 * decision rather than an oversight: people(id) is referenced ON DELETE CASCADE from
 * four tables, and deleting also strands the auth account with
 * app_metadata.family_code still naming the family it can no longer reach.
 */
export async function rejectApplicant(personId: string, reason?: string): Promise<ApprovalResult> {
  return decide(personId, 'rejected', reason)
}
