'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRead } from '@/lib/auth/guard'
import { canAny } from '@/lib/auth/permissions'
import { getMyFamilyCode } from '@/lib/auth/family'
import { createNotification } from '@/lib/notifications'

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
  note: string | null
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
  const g = await requireRead('admin/approvals')
  if (!g.ok) return { pending: [], decided: [], canDecide: false }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('people')
    // One string literal, not a concatenation: the typed client infers the row shape
    // from the literal, and a computed select string degrades every column to
    // GenericStringError.
    .select('id, first_name, last_name, primary_email, primary_phone, membership_status, membership_requested_at, membership_decided_at, membership_decided_by, membership_note')
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
  })

  return {
    pending: rows.filter(r => r.membership_status === 'pending').map(toApplicant),
    decided: rows.filter(r => r.membership_status === 'rejected').map(toApplicant),
    // Drives the UI only. The RPC decides for real.
    canDecide: await canAny(g.userId, 'admin/approvals', 'edit'),
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
  const g = await requireRead('admin/approvals')
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

async function decide(
  personId: string,
  status: 'approved' | 'rejected',
  note?: string,
): Promise<ApprovalResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }

  // The friendly layer. canAny and not can(): admitting a stranger to the family has
  // no coherent "own" version — the row a member would own is their own application,
  // and self-approval is the abuse case the RPC also refuses outright.
  if (!(await canAny(user.id, 'admin/approvals', 'edit'))) {
    return { success: false, message: 'Not authorized' }
  }

  // USER client. See the header.
  const { data, error } = await supabase
    .rpc('set_membership_status', {
      p_person_id: personId,
      p_status: status,
      p_note: note?.trim() ? note.trim() : null,
    })
    .maybeSingle<{ ok: boolean; message: string | null }>()

  if (error) return { success: false, message: 'Could not record that decision. Please try again.' }
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

  // The queue renders on Members & Access now (its Pending Approval tab). Revalidating
  // the old /admin/approvals route would refresh a redirect that holds no data.
  revalidatePath('/admin/users')
  revalidatePath('/dashboard')
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
