import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Notification writers, for server code to call — NOT server actions.
 *
 * These live here, and not in app/actions/notifications.ts, precisely because they
 * must not be reachable from a browser. Both take `familyCode` as an argument and
 * write with the service-role client, so as exported members of a `'use server'`
 * module they were public endpoints: anyone signed in could post any family's code
 * with an arbitrary title, body and LINK, and have it appear in the notification bell
 * of every member of that family. A plain module has no URL.
 *
 * The rule this came from, in AGENTS.md: everything exported from a `'use server'`
 * file is an endpoint. "Internal helper" is a comment, not a boundary.
 *
 * A caller must therefore pass a `familyCode` it has already established belongs to
 * the acting user — `getMyFamilyCode(user.id)`, never a value from the client.
 */

/**
 * WHY EVERY WRITE BELOW READS ITS ERROR.
 *
 * supabase-js RETURNS errors rather than throwing them, so the `try { … } catch {}` that
 * wraps every call site in this codebase — deliberately, because a notification must
 * never undo the decision it was announcing — catches nothing PostgREST actually
 * produces. Discarding `error` on top of that made a refused insert indistinguishable
 * from a delivered one at every layer: nothing threw, nothing logged, and the bell was
 * simply empty. That is AGENTS.md §8 in its purest form, on the one path whose entire
 * job is to tell somebody something happened.
 *
 * Logged rather than thrown, because the swallowing is still correct — the caller has
 * already committed a join, an approval or an appeal, and none of those may be rolled
 * back over a bell entry. What changes is that the failure is now visible in the server
 * log instead of nowhere.
 */
function reportFailure(where: string, message: string): void {
  console.error(`[notify] ${where} failed: ${message}. The event happened; nobody was told.`)
}

export async function createNotification(opts: {
  familyCode: string
  recipientPersonId: string
  type: string
  title: string
  body?: string
  link?: string
}): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('notifications').insert({
    family_code: opts.familyCode,
    recipient_id: opts.recipientPersonId,
    type: opts.type,
    title: opts.title,
    body: opts.body ?? null,
    link: opts.link ?? null,
  })
  if (error) reportFailure(`createNotification(${opts.type})`, error.message)
}

/** Notify every member of a family except the actor — event publish, announcements. */
export async function notifyAllMembers(opts: {
  familyCode: string
  excludePersonId?: string
  type: string
  title: string
  body?: string
  link?: string
}): Promise<void> {
  const admin = createAdminClient()

  // Approved members only. An applicant awaiting approval is not part of the family
  // yet, and a notification is family data: the title and body of an announcement or
  // a published event, plus a link into a page they cannot open. It would also be the
  // one thing that reached them through the gate, since the bell is otherwise
  // suppressed for them.
  const { data: members } = await admin
    .from('people')
    .select('id')
    .eq('family_code', opts.familyCode)
    .eq('membership_status', 'approved')
    .not('user_id', 'is', null)

  if (!members?.length) return

  const rows = members
    .filter(m => m.id !== opts.excludePersonId)
    .map(m => ({
      family_code: opts.familyCode,
      recipient_id: m.id,
      type: opts.type,
      title: opts.title,
      body: opts.body ?? null,
      link: opts.link ?? null,
    }))

  if (!rows.length) return
  const { error } = await admin.from('notifications').insert(rows)
  if (error) reportFailure(`notifyAllMembers(${opts.type})`, error.message)
}

/**
 * Somebody has asked to join. Tell whoever can act on it.
 *
 * ONE FUNCTION BECAUSE THERE ARE FIVE DOORS, and until 2026-08-14 only one of them was
 * knocking. Every one of these lands the same pending row in the same queue:
 *
 *   /register with a family code       registerUser, mode 'join'
 *   /register from an invitation       registerUser + redeem_family_invitation, where the
 *                                      invitation does NOT pre-approve
 *   /my-families with a family code    joinFamilyByCode          ← the only one that told anybody
 *   an invitation accepted while signed in   acceptInvitation, again where it does not pre-approve
 *   an appeal of a decline             appealMembershipDecision, which puts the row BACK
 *                                      in the queue — see notifyMembershipAppeal below
 *
 * So whether a family heard about an applicant depended on which page the applicant
 * happened to start from, which is not a distinction anyone chose.
 *
 * The message lives here rather than at five call sites for the reason the rest of this
 * module does: five copies of one sentence are five answers to "what does this say", and
 * the two that existed had already drifted — one named the applicant only by their email
 * address, because at that call site it was the only thing to hand.
 *
 * `familyName` is passed in rather than looked up: every caller has just resolved it, and
 * a second query here would be a second chance to disagree about which family this is.
 *
 * NOTHING HERE IS CALLER-CHOSEN. The title, body shape and link are literals; the only
 * variables are the family and the applicant's own name and address. That matters because
 * one call site — registration — is reachable without a session at all.
 */
export async function notifyMembershipRequest(opts: {
  familyCode: string
  familyName: string
  /** The applicant's own name, when the flow collected one. */
  applicantName?: string | null
  applicantEmail?: string | null
}): Promise<void> {
  await notifyApprovers({
    familyCode: opts.familyCode,
    type: 'membership_request',
    title: 'A new member is waiting for approval',
    body: `${describeApplicant(opts)} has asked to join ${opts.familyName}.`,
    link: APPROVALS_LINK,
  })
}

/**
 * A refused applicant has asked the family to look again.
 *
 * ITS OWN MESSAGE, not `notifyMembershipRequest` with a different subject, because the
 * two are different events for the administrator reading them: one is a stranger at the
 * door, the other is a decision this family has already taken being questioned. The
 * appeal also carries something no ordinary request does — the applicant's own words —
 * and 20260811000002's whole stated rationale for the feature is that "the whole value to
 * the administrator is the sentence explaining why they should reconsider". Until now that
 * sentence reached no administrator by any channel at all.
 *
 * The note is the applicant's, so it is clipped rather than trusted to be short, and it is
 * never presented as though the family wrote it — the same care `Applicant.appeal` takes
 * on the approvals queue.
 */
export async function notifyMembershipAppeal(opts: {
  familyCode: string
  familyName: string
  applicantName?: string | null
  applicantEmail?: string | null
  note?: string | null
}): Promise<void> {
  const who = describeApplicant(opts)
  const note = clip(opts.note, 300)
  await notifyApprovers({
    familyCode: opts.familyCode,
    type: 'membership_appeal',
    title: 'A declined request has been appealed',
    body: note
      ? `${who} has asked ${opts.familyName} to look at their request again: “${note}”`
      : `${who} has asked ${opts.familyName} to look at their request again.`,
    link: APPROVALS_LINK,
  })
}

/** Where both of the above send an administrator. One copy, so the two cannot diverge. */
const APPROVALS_LINK = '/admin/users?tab=approvals'

/**
 * Bounded, because every field here is free text the applicant typed and it ends up in
 * every approver's bell. React escapes it on the way out, so this is about a readable
 * notification rather than about safety.
 */
const clip = (s: string | null | undefined, max = 120) => (s ?? '').trim().slice(0, max)

/** "Ada Okonkwo (ada@example.com)", degrading to whichever half the flow collected. */
function describeApplicant(opts: { applicantName?: string | null; applicantEmail?: string | null }): string {
  const name = clip(opts.applicantName)
  const email = clip(opts.applicantEmail)
  return name && email ? `${name} (${email})` : name || email || 'Someone'
}

/**
 * Notify everyone in a family who can act on a membership application.
 *
 * "Who can act on it" is resolved from the permission model rather than from a
 * template name or an is_admin flag: whoever is on a template granting admin/approvals
 * at 'edit' scope 'any'. A family that delegates approvals to a Membership Committee
 * gets its committee notified without anything here knowing the template exists.
 *
 * Resolved with the service-role client on purpose. The alternative — reading the
 * permission tables as the applicant — cannot work: the applicant is pending, so
 * 20260806000011's sweep denies them permission_templates and template_permissions
 * outright. The person who needs to be told is precisely the person the caller may
 * not look up.
 *
 * As with its siblings above, `familyCode` must be a value the caller has already
 * established, never one from the client — this is a plain module and has no URL, but
 * it writes with the service role.
 */
export async function notifyApprovers(opts: {
  familyCode: string
  type: string
  title: string
  body?: string
  link?: string
}): Promise<void> {
  const admin = createAdminClient()

  const { data: grants, error: grantsError } = await admin
    .from('template_permissions')
    .select('template_id, permission_templates!inner(family_code)')
    .eq('resource_key', 'admin/approvals')
    .eq('action', 'edit')
    .eq('scope', 'any')
    .eq('permission_templates.family_code', opts.familyCode)

  // A refused query and a family with no approvers both arrive as an empty list and mean
  // opposite things — §8. This one is an inner join on an embed, which is exactly the
  // shape PostgREST refuses with PGRST200/201 when a constraint is renamed underneath it.
  if (grantsError) {
    reportFailure(`notifyApprovers(${opts.type}) resolving approvers`, grantsError.message)
    return
  }

  const templateIds = (grants ?? []).map(g => g.template_id as string)
  if (!templateIds.length) {
    console.warn(`[notify] ${opts.type} in ${opts.familyCode} reached nobody: no template grants admin/approvals:edit at scope 'any'.`)
    return
  }

  // Re-scoped to the family as well as to the template ids: this is the service-role
  // client, so nothing else is applying it. Approved members only — a pending or
  // disabled member holds nothing whatever their template says, so mailing them a
  // queue they cannot open would be noise.
  const { data: people, error: peopleError } = await admin
    .from('people')
    .select('id')
    .eq('family_code', opts.familyCode)
    .eq('membership_status', 'approved')
    .in('permission_template_id', templateIds)

  if (peopleError) {
    reportFailure(`notifyApprovers(${opts.type}) resolving recipients`, peopleError.message)
    return
  }

  const recipients = new Set((people ?? []).map(p => p.id as string))
  // Worth its own line in the log rather than a silent return: a family whose template
  // grants admin/approvals to nobody has an approvals queue no notification can reach,
  // and that is a real configuration to be able to find afterwards — not an error.
  if (!recipients.size) {
    console.warn(`[notify] ${opts.type} in ${opts.familyCode} reached nobody: no approved member holds admin/approvals:edit at scope 'any'.`)
    return
  }

  const { error } = await admin.from('notifications').insert([...recipients].map(personId => ({
    family_code: opts.familyCode,
    recipient_id: personId,
    type: opts.type,
    title: opts.title,
    body: opts.body ?? null,
    link: opts.link ?? null,
  })))
  if (error) reportFailure(`notifyApprovers(${opts.type})`, error.message)
}
