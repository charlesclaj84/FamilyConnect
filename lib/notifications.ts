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

export async function createNotification(opts: {
  familyCode: string
  recipientPersonId: string
  type: string
  title: string
  body?: string
  link?: string
}): Promise<void> {
  const admin = createAdminClient()
  await admin.from('notifications').insert({
    family_code: opts.familyCode,
    recipient_id: opts.recipientPersonId,
    type: opts.type,
    title: opts.title,
    body: opts.body ?? null,
    link: opts.link ?? null,
  })
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

  if (rows.length) await admin.from('notifications').insert(rows)
}

/**
 * Notify everyone in a family who can act on a membership application.
 *
 * "Who can act on it" is resolved from the permission model rather than from a group
 * name or an is_admin flag: whoever holds admin/approvals at 'edit' scope 'any',
 * through a group or an individual override. A family that delegates approvals to a
 * Membership Committee gets its committee notified without anything here knowing the
 * group exists.
 *
 * Resolved with the service-role client on purpose. The alternative — reading the
 * permission tables as the applicant — cannot work: the applicant is pending, so
 * 20260806000011's sweep denies them user_groups and group_permissions outright. The
 * person who needs to be told is precisely the person the caller may not look up.
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

  const [groupGrants, personGrants] = await Promise.all([
    admin.from('group_permissions')
      .select('group_id, user_groups!inner(family_code)')
      .eq('resource_key', 'admin/approvals')
      .eq('action', 'edit')
      .eq('scope', 'any')
      .eq('user_groups.family_code', opts.familyCode),
    admin.from('person_permissions')
      .select('person_id, people!inner(family_code, membership_status)')
      .eq('resource_key', 'admin/approvals')
      .eq('action', 'edit')
      .eq('scope', 'any')
      .eq('people.family_code', opts.familyCode),
  ])

  const recipients = new Set<string>()

  const groupIds = (groupGrants.data ?? []).map(g => g.group_id as string)
  if (groupIds.length) {
    // Re-scoped to the family by the group ids above; person_id alone is not
    // family-scoped, and this is the service-role client.
    const { data: members } = await admin
      .from('user_group_members')
      .select('person_id, people!inner(family_code, membership_status)')
      .in('group_id', groupIds)
      .eq('people.family_code', opts.familyCode)
      .eq('people.membership_status', 'approved')
    for (const m of members ?? []) recipients.add(m.person_id as string)
  }

  for (const p of personGrants.data ?? []) {
    const person = p.people as unknown as { membership_status: string } | null
    if (person?.membership_status === 'approved') recipients.add(p.person_id as string)
  }

  if (!recipients.size) return

  await admin.from('notifications').insert([...recipients].map(personId => ({
    family_code: opts.familyCode,
    recipient_id: personId,
    type: opts.type,
    title: opts.title,
    body: opts.body ?? null,
    link: opts.link ?? null,
  })))
}
