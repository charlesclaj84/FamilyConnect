import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/date-utils'
// TYPE-ONLY, and it has to stay that way. `lib/auth/permissions.ts` imports `next/navigation`
// and React's `cache`, and one call site of this module — registerUser — runs on a request
// with no session at all; an `import type` is erased before the bundle is built, so nothing
// of that module reaches this one at runtime. The alternative is a local copy of the four
// action names, and a second spelling of a closed set is how two of them come to disagree.
import type { PermissionAction } from '@/lib/auth/permissions'

/**
 * Notification writers, for server code to call — NOT server actions.
 *
 * These live here, and not in app/actions/notifications.ts, precisely because they
 * must not be reachable from a browser. Every one of them takes `familyCode` as an
 * argument and writes with the service-role client, so as exported members of a
 * `'use server'` module they were public endpoints: anyone signed in could post any
 * family's code with an arbitrary title, body and LINK, and have it appear in the
 * notification bell of every member of that family. A plain module has no URL.
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
const APPROVALS_LINK = '/admin/members?tab=approvals'

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
 * Notify everyone in a family who holds a particular grant.
 *
 * "Who can act on this" is resolved from the PERMISSION MODEL rather than from a template
 * name or an is_admin flag: whoever is on a template granting `resourceKey` at `action`,
 * scope 'any'. A family that delegates approvals to a Membership Committee, or gathering
 * organizing to a Reunion Committee, gets its committee notified without anything here
 * knowing the template exists.
 *
 * Resolved with the service-role client on purpose. For the membership messages the
 * alternative — reading the permission tables as the applicant — cannot work at all: the
 * applicant is pending, so 20260806000011's sweep denies them `permission_templates` and
 * `template_permissions` outright. The person who needs to be told is precisely the person
 * the caller may not look up. The same client serves the gathering messages for a duller
 * reason: a submission notification must reach every organizer, not only the ones the
 * submitting member happens to be allowed to see.
 *
 * WHY THIS IS THE GENERAL FORM AND `notifyApprovers` IS NOW A CALL INTO IT. This function
 * was `notifyApprovers`, with `'admin/members/approvals'` and `'edit'` written into its two queries
 * as literals. Gatherings needs the identical resolver for `admin/gatherings:edit`, and the
 * one thing that must not happen is a second copy of it — that is the rule the rest of this
 * module is built on, and the two membership messages had already drifted from each other
 * before they were centralised here. So the key and the action became parameters and nothing
 * else changed. `notifyApprovers` keeps its name because 'approvers' is a real thing to a
 * reader of the membership call sites, and because the resolver's behaviour through it
 * is unchanged in every respect a caller or an operator can observe — including both
 * `console.warn` sentences below, which still read exactly as they did (`no template grants
 * admin/approvals:edit at scope 'any'`) because `${grant}` interpolates to the literal they
 * used to spell out.
 *
 * THE ONE DELIBERATE CHANGE IS THE `reportFailure` LABEL, and it is a change on purpose. It
 * used to read `notifyApprovers(<type>) resolving approvers`; it now names this function and
 * the grant it was resolving. Keeping the old label would have a log line naming a function
 * that did not run and a resource it may have nothing to do with — a `task_submitted` failure
 * reporting "resolving approvers" sends whoever reads the log to the approvals queue, which
 * is the wrong screen entirely. The `type` is still in there, so the event is still
 * identifiable; what is added is which grant was being resolved when it failed.
 *
 * As with its siblings above, `familyCode` must be a value the caller has already
 * established, never one from the client — this is a plain module and has no URL, but it
 * writes with the service role.
 */
export async function notifyGrantHolders(opts: {
  familyCode: string
  /** The `permission_resources.key` whose holders should hear about this. */
  resourceKey: string
  /** Which action on that key marks somebody as able to act. Usually 'edit'. */
  action: PermissionAction
  type: string
  title: string
  body?: string
  link?: string
}): Promise<void> {
  const admin = createAdminClient()
  // One string, used by every log line below, so a reader of the server log can see which
  // grant was being resolved and not merely which event failed to be announced.
  const grant = `${opts.resourceKey}:${opts.action}`

  const { data: grants, error: grantsError } = await admin
    .from('template_permissions')
    .select('template_id, permission_templates!inner(family_code)')
    .eq('resource_key', opts.resourceKey)
    .eq('action', opts.action)
    .eq('scope', 'any')
    .eq('permission_templates.family_code', opts.familyCode)

  // A refused query and a family with no holders both arrive as an empty list and mean
  // opposite things — §8. This one is an inner join on an embed, which is exactly the
  // shape PostgREST refuses with PGRST200/201 when a constraint is renamed underneath it.
  if (grantsError) {
    reportFailure(`notifyGrantHolders(${opts.type}) resolving ${grant} templates`, grantsError.message)
    return
  }

  const templateIds = (grants ?? []).map(g => g.template_id as string)
  if (!templateIds.length) {
    console.warn(`[notify] ${opts.type} in ${opts.familyCode} reached nobody: no template grants ${grant} at scope 'any'.`)
    return
  }

  // Re-scoped to the family as well as to the template ids: this is the service-role
  // client, so nothing else is applying it. Approved members only — a pending or
  // disabled member holds nothing whatever their template says, so mailing them a
  // screen they cannot open would be noise.
  const { data: people, error: peopleError } = await admin
    .from('people')
    .select('id')
    .eq('family_code', opts.familyCode)
    .eq('membership_status', 'approved')
    .in('permission_template_id', templateIds)

  if (peopleError) {
    reportFailure(`notifyGrantHolders(${opts.type}) resolving ${grant} recipients`, peopleError.message)
    return
  }

  const recipients = new Set((people ?? []).map(p => p.id as string))
  // Worth its own line in the log rather than a silent return: a family whose templates
  // grant this to nobody has a screen no notification can reach, and that is a real
  // configuration to be able to find afterwards — not an error.
  if (!recipients.size) {
    console.warn(`[notify] ${opts.type} in ${opts.familyCode} reached nobody: no approved member holds ${grant} at scope 'any'.`)
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
  if (error) reportFailure(`notifyGrantHolders(${opts.type})`, error.message)
}

/**
 * Notify everyone in a family who can act on a membership application.
 *
 * `admin/approvals` at 'edit', scope 'any' — the queue on Members & Access. Kept as a named
 * function rather than four call sites each spelling out the key, so the answer to "who
 * approves members here" lives in one place and cannot drift between the five doors listed
 * on `notifyMembershipRequest`.
 */
export async function notifyApprovers(opts: {
  familyCode: string
  type: string
  title: string
  body?: string
  link?: string
}): Promise<void> {
  await notifyGrantHolders({ ...opts, resourceKey: 'admin/members/approvals', action: 'edit' })
}

// ── GATHERINGS ───────────────────────────────────────────────────────────────────────────────
//
// Four notification types, and NO MIGRATION FOR ANY OF THEM. `notifications.type` is free
// TEXT with no CHECK constraint, and 20260609000002's own column comment already names
// 'task_assigned' and 'task_approved' among its examples — the table was designed for
// exactly this. `NotificationBell` renders title, body and link and switches on nothing, so
// a type it has never seen displays correctly the first time. Adding a CHECK now would turn
// every future notification into a migration; leaving it open is the decision that table
// already made.
//
// THE THREE WRITERS BELOW COVER A ROUND TRIP, not three unrelated announcements: an
// organizer hands out a task (assigned), the relative answers it (submitted), an organizer
// rules on the answer (approved or denied). A denial that reached nobody would leave the
// member believing they were finished, which is the one failure this feature cannot have —
// so `review_notes` travels in the BODY of the denial. The bell is the only channel that
// carries it; nothing here sends email.
//
// TITLES ARE LITERALS AND EVERY INTERPOLATION IS IN THE BODY, matching the membership
// messages above. The gathering's title, the task's label and an organizer's notes are all
// free text somebody typed into a form, and the title is the line the bell renders largest
// and truncates hardest — a 200-character task label there is a notification that says
// nothing. `clip` bounds each one; React escapes them on the way out, so this is about a
// readable notification rather than about safety.
//
// `link` IS A PARAMETER HERE, unlike APPROVALS_LINK above, and that is worth stating because
// the constant exists on the argument that "nothing here is caller-chosen". The argument
// still holds: APPROVALS_LINK is a literal because one of its call sites — registration —
// runs with no session at all, so there is nobody whose judgement could be trusted. Every
// call site of these three is a server action behind `requireEdit` or `requireMember`, and
// only the caller knows the gathering id the link has to name. A caller must still compose
// it from ids it has already established belong to this family, exactly as it must for
// `familyCode`.

/**
 * An organizer has handed a gathering task to a named relative.
 *
 * ONE RECIPIENT, resolved by `people.id` and not by an auth id — a gathering task is keyed
 * on `people.id` precisely so an account-less relative can hold one (AGENTS.md §4b), and
 * `notifications.recipient_id` is a `people.id` too, so the two line up with no join. A
 * recorded relative with no account will never see the bell; the row is written anyway,
 * because it becomes visible the day they finish registering and the alternative is a silent
 * branch here deciding who is worth telling.
 *
 * Delegated to `createNotification`, which already reads its `error` and reports it. A second
 * read here would be a second copy of the one thing this module is careful about.
 */
export async function notifyGatheringTaskAssigned(opts: {
  familyCode: string
  /** The assignee's `people.id`. */
  assigneePersonId: string
  gatheringTitle: string
  taskLabel: string
  /** ISO YYYY-MM-DD, or null when the task has no deadline. */
  dueOn?: string | null
  link: string
}): Promise<void> {
  // AN EMPTY STRING IS NOT A UUID, and `getMyPersonId` returns one for a caller with no
  // membership. Passed through, Postgres answers `invalid input syntax for type uuid: ""` —
  // which app/actions/funds.ts records surfacing to a treasurer as the whole of an error
  // message. Here it would be swallowed by the call site's try/catch and lost entirely, so
  // the refusal is stated rather than left to be discovered.
  if (!opts.assigneePersonId) {
    console.warn(`[notify] task_assigned in ${opts.familyCode} reached nobody: no assignee person id was resolved.`)
    return
  }

  const due = formatDate(opts.dueOn)
  const what = `“${clip(opts.taskLabel)}” for ${clip(opts.gatheringTitle)}`

  await createNotification({
    familyCode: opts.familyCode,
    recipientPersonId: opts.assigneePersonId,
    type: 'task_assigned',
    title: 'You have a new gathering task',
    body: due ? `${what}, due ${due}.` : `${what}.`,
    link: opts.link,
  })
}

/**
 * A relative has submitted an answer. Tell whoever can rule on it.
 *
 * `admin/gatherings` at 'edit', scope 'any' — the same grant `reviewGatheringTask` demands,
 * which is the point: the people told are exactly the people who can act, resolved from the
 * permission model rather than from a template name. A family that hands organizing to a
 * Reunion Committee gets its committee notified and nothing here learns the template exists.
 *
 * NOT `notifyAllMembers`. A submission is one person's answer to one task and is of no
 * interest to the other hundred and thirty relatives; a bell that announces everything is a
 * bell nobody reads. The submitting member is not told either — they pressed the button.
 */
export async function notifyGatheringTaskSubmitted(opts: {
  familyCode: string
  gatheringTitle: string
  taskLabel: string
  /** The submitting member's display name, already disambiguated by the caller. */
  submitterName: string
  link: string
}): Promise<void> {
  const who = clip(opts.submitterName) || 'Someone'
  await notifyGrantHolders({
    familyCode: opts.familyCode,
    resourceKey: 'admin/gatherings',
    action: 'edit',
    type: 'task_submitted',
    title: 'A gathering task is waiting for review',
    body: `${who} has submitted “${clip(opts.taskLabel)}” for ${clip(opts.gatheringTitle)}.`,
    link: opts.link,
  })
}

/**
 * An organizer has approved or denied a submission. Tell the assignee.
 *
 * THE DENIAL IS THE WHOLE REASON THIS EXISTS. An approval is pleasant to receive and
 * optional; a denial is an instruction, and `review_notes` IS the instruction. The notes go
 * in the body because that is the only place the bell will show them, and a denial the member
 * cannot read is a task that silently stops moving — the member believes they have finished
 * and the organizer believes they have been told. `reviewGatheringTask` requires notes on a
 * denial for that reason; this is the half that delivers them.
 *
 * TWO TYPES RATHER THAN ONE WITH A FLAG, because 20260609000002 already names
 * 'task_approved', and because a surface that ever filters the bell by outcome — "show me
 * what came back" — needs the outcome in the row rather than in the prose of the body.
 *
 * The notes clip at 300 rather than the default 120: they are the payload here, and it is the
 * same length `notifyMembershipAppeal` allows an applicant's own sentence.
 */
export async function notifyGatheringTaskReviewed(opts: {
  familyCode: string
  /** The assignee's `people.id` — whoever submitted, not the organizer who ruled. */
  assigneePersonId: string
  gatheringTitle: string
  taskLabel: string
  decision: 'approved' | 'denied'
  reviewNotes?: string | null
  link: string
}): Promise<void> {
  // Same reasoning as notifyGatheringTaskAssigned: a task with no assignee has nobody to
  // tell, and '' is not a uuid.
  if (!opts.assigneePersonId) {
    console.warn(`[notify] task_${opts.decision} in ${opts.familyCode} reached nobody: no assignee person id was resolved.`)
    return
  }

  const what = `“${clip(opts.taskLabel)}” for ${clip(opts.gatheringTitle)}`
  const notes = clip(opts.reviewNotes, 300)
  const approved = opts.decision === 'approved'

  const body = approved
    ? (notes ? `${what} has been approved: “${notes}”` : `${what} has been approved.`)
    // "sent back" rather than "denied" or "rejected". The task is open to the member again
    // and they are being asked to change something — a resubmission is a NEW submission row,
    // never an edit of the refused one — so the sentence describes what happened to the work
    // rather than passing judgement on the person who did it.
    : (notes ? `${what} was sent back with notes: “${notes}”` : `${what} was sent back for another look.`)

  await createNotification({
    familyCode: opts.familyCode,
    recipientPersonId: opts.assigneePersonId,
    type: approved ? 'task_approved' : 'task_denied',
    title: approved ? 'A gathering task was approved' : 'A gathering task needs another look',
    body,
    link: opts.link,
  })
}

/**
 * An organizer has REOPENED a task they had already approved.
 *
 * ── WHY THIS IS NOT `notifyGatheringTaskReviewed({ decision: 'denied' })` ────────────
 * `reopenGatheringTask` shipped calling that, with a careful argument for it: from the member's
 * side both events end with their task back in their hands and the organizer's reason attached,
 * and that writer's copy already says so. The argument is good and it is still wrong, for one
 * reason the action could not see from where it sits — WHAT THE MEMBER LAST HEARD.
 *
 * A send-back follows a submission the member is waiting on, so "was sent back with notes" names
 * the thing they just did. A reopen follows an APPROVAL: the last word that member had on this
 * task was "approved", quite possibly weeks ago, and telling them it "was sent back with notes"
 * reads as their latest answer having been refused. It was not — it was accepted, and then an
 * organizer changed their mind. That is a different fact about their work, and a member who
 * cannot tell the two apart will go looking for a submission they never made.
 *
 * So the sentence is its own, and the `type` is its own. `notifications.type` is free TEXT with
 * no CHECK (20260609000002), so this needs no migration.
 *
 * ── AND THE QUERY THE ACTION WAS RIGHT TO WORRY ABOUT ───────────────────────────────
 * "Show me what came back to me" must include a reopen, and with a separate type it now has to
 * name both — `type IN ('task_denied', 'task_reopened')`. That is the correct trade: a surface
 * asking that question can enumerate two words, and no surface can un-conflate two events that
 * were stored as one. Nothing filters on `type` today; the bell renders every row.
 */
export async function notifyGatheringTaskReopened(opts: {
  familyCode: string
  /** The CURRENT assignee's `people.id` — after a reopen, only they can do the work. */
  assigneePersonId: string
  gatheringTitle: string
  taskLabel: string
  /** The organizer's reason. Optional here, unlike on a send-back, and the copy handles both. */
  reason?: string | null
  link: string
}): Promise<void> {
  // Same reasoning as its two siblings: a task with no assignee has nobody to tell, and '' is
  // not a uuid.
  if (!opts.assigneePersonId) {
    console.warn(`[notify] task_reopened in ${opts.familyCode} reached nobody: no assignee person id was resolved.`)
    return
  }

  const what = `“${clip(opts.taskLabel)}” for ${clip(opts.gatheringTitle)}`
  const reason = clip(opts.reason, 300)

  await createNotification({
    familyCode: opts.familyCode,
    recipientPersonId: opts.assigneePersonId,
    type: 'task_reopened',
    title: 'A gathering task was reopened',
    // "was approved and has been reopened" in both branches, because the approval is the half
    // that makes this message make sense: without it the member has no idea why a finished task
    // is asking for something again. Their previous answer is still on it — `reopenGatheringTask`
    // leaves the answer and every submission row standing — so the copy says so rather than
    // implying they start over.
    body: reason
      ? `${what} was approved and has been reopened: “${reason}”. Your previous answer is still there.`
      : `${what} was approved and has been reopened. Your previous answer is still there.`,
    link: opts.link,
  })
}

/**
 * A meeting has been scheduled. Tell everybody who is expected in the room.
 *
 * ── NOT `notifyAllMembers`, AND THAT IS THE WHOLE POINT ────────────────────
 * A meeting of the board is of no interest to the other hundred and thirty relatives, and a
 * bell that announces everything is a bell nobody reads. The recipients are the ATTENDEE LIST
 * — the same list that decides who may vote — so being told and being able to act are the
 * same set by construction, which is the property `notifyGatheringTaskSubmitted` argues for
 * when it resolves recipients from the permission model rather than from a template name.
 *
 * ── THE SCHEDULER IS NOT TOLD ────────────────────────────────────
 * `excludePersonId` is the caller. They pressed the button; a notification about their own act
 * is noise, and it is the same exclusion `notifyAllMembers` makes for the same reason. They
 * are still on the attendee list and still vote — this is about the bell, not the room.
 *
 * ── IT FAILS SOFT, AND EACH RECIPIENT FAILS ON THEIR OWN ───────────────
 * `createNotification` reads its own error and logs it, because supabase-js RETURNS errors
 * rather than throwing them — so the `try/catch` the call site wraps this in would catch
 * nothing PostgREST produced. One recipient's row failing must not cost the other eleven
 * theirs, which is why this awaits them together rather than in a loop that can throw.
 */
export async function notifyMeetingScheduled(opts: {
  familyCode: string
  /** Every attendee's `people.id`. The secretary is among them. */
  attendeePersonIds: readonly string[]
  /** The caller, who is not told about their own act. */
  excludePersonId?: string
  title: string
  /** `YYYY-MM-DD`. Rendered by `formatDate`, which is UTC-pinned. */
  meetsOn: string
  link: string
}): Promise<void> {
  // AN EMPTY STRING IS NOT A UUID, and `getMyPersonId` answers one for a caller with no
  // membership. Passed through, Postgres reports `invalid input syntax for type uuid: ""`,
  // which the call site's try/catch would swallow entirely.
  const recipients = opts.attendeePersonIds
    .filter(id => Boolean(id) && id !== opts.excludePersonId)
  if (recipients.length === 0) return

  const when = formatDate(opts.meetsOn)
  await Promise.all(recipients.map(recipientPersonId => createNotification({
    familyCode: opts.familyCode,
    recipientPersonId,
    type: 'meeting_scheduled',
    title: 'You are expected at a meeting',
    body: when
      ? `${clip(opts.title)} on ${when}. It is on your calendar.`
      : `${clip(opts.title)}. It is on your calendar.`,
    link: opts.link,
  })))
}
