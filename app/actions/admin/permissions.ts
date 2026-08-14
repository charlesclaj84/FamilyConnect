'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyActiveMembership } from '@/lib/auth/family'
import { isFeatureFuture, requiredTier } from '@/lib/features'
import { getMyFamilyTier } from '@/lib/auth/tier'
import { tierMeets } from '@/lib/tiers'
import { MEMBER_PAGE_SIZE } from '@/lib/pagination'
import {
  can,
  getMyPermissionSet,
  PERMISSION_ACTIONS,
  type PermissionAction,
  type PermissionScope,
} from '@/lib/auth/permissions'
import type { MembershipStatus } from '@/lib/auth/family'

/**
 * Members & Access — the whole of the family's authorization surface.
 *
 * THE MODEL, since 20260807000000
 *   A template is a named grid: per resource, per action, a scope. A person is
 *   assigned exactly ONE template and it is the entirety of their access. There is
 *   no membership table, no per-person override, and so no precedence rule to
 *   explain — which is what let User Management and Groups & Permissions become one
 *   screen instead of two showing half an answer each.
 *
 * WHICH CLIENT, AND WHY
 *   The TEMPLATE side runs on the service role and re-applies family scoping by hand
 *   on every read, write and delete (AGENTS.md §3) — `.eq('family_code', …)` from the
 *   caller's own people row, never from an argument, and every client-supplied id
 *   confirmed into that family before it is used.
 *
 *   The two PERSON-level mutations do not. Applying a template and switching a member
 *   off both write to `people`, whose UPDATE policy deliberately admits a member's
 *   write to their own row — so those go through SECURITY DEFINER RPCs called on the
 *   USER client, which derive the caller from auth.uid() and do the authorization in
 *   the database. Calling them with the admin client would leave auth.uid() NULL and
 *   every check inside evaluating against nothing; both refuse a NULL caller outright
 *   so that mistake fails loudly. Same division as Member Approvals.
 *
 * TWO KEYS, since 20260808000000, matching the two tabs this file serves:
 *
 *   admin/users            the roster. Who is in the family, which template each
 *                          person is on, and the switch that turns a member off.
 *   admin/users/templates  the grids. What a template grants, and which templates
 *                          exist at all.
 *
 * They are separated because the second can invent authority and the first can only
 * hand out authority that already exists. "Add this person, put them on Treasurer" and
 * "decide what Treasurer means" are different jobs, and a family wanting a roster
 * administrator who cannot quietly promote themselves could not express that while
 * both rode on one grant.
 *
 * The RLS policies on permission_templates and template_permissions name the second
 * key; the two SECURITY DEFINER RPCs that write to `people` name the first. The code
 * and the database must never disagree about who may do what.
 */

const RESOURCE = 'admin/users'
const TEMPLATE_RESOURCE = 'admin/users/templates'

export type AdminResult = { success: true } | { success: false; message: string }

export interface TemplateSummary {
  id: string
  name: string
  description: string | null
  /** Seeded with the family. Renameable and editable, but not deletable. */
  isSystem: boolean
  /** How many people are currently assigned to it. */
  memberCount: number
  /**
   * True when this template can administer other people — it grants edit on
   * `admin/users` (re-assign a member's template, switch them off) or on
   * `admin/users/templates` (rewrite what any template grants), or both.
   */
  grantsAdmin: boolean
}

export interface MemberSummary {
  personId: string
  name: string
  email: string | null
  phone: string | null
  /**
   * "City, State" — pre-joined here rather than as two fields, because the Members
   * table renders it as one cell and every caller would otherwise repeat the same
   * comma-and-fallback logic. Null when the member has recorded neither.
   */
  location: string | null
  templateId: string | null
  templateName: string | null
  status: MembershipStatus
  /** True for the caller's own row, which they may not disable. */
  isSelf: boolean
}

export interface MemberPage {
  rows: MemberSummary[]
  /** Total matching the query, for paging controls. */
  total: number
}

export interface ResourceSummary {
  key: string
  label: string
  category: string
  /**
   * Third display level inside a category, e.g. Accounting > Transactions. Null for
   * an ordinary row, which renders directly under its category heading.
   */
  subsection: string | null
  /** Ordering within the category. Sub-section rows are contiguous by construction. */
  sortOrder: number
  /**
   * Which actions are MEANINGFUL for this resource. "Payment Reversals" has only
   * `create` and "Transactions" has only `view`; rendering the rest would be switches
   * wired to nothing, and one of them reading as a privacy control being honoured when
   * nothing consults it is the worst version of that.
   */
  actions: PermissionAction[]
}

/** A template's grid, keyed `${resource}:${action}`. */
export type PolicyMap = Record<string, PermissionScope>

/**
 * Resolve the caller and check one (resource, action).
 *
 * `resource` is explicit on every call rather than defaulted, because the whole point
 * of the 20260808000000 split is that this file serves two of them and the wrong
 * default would be invisible — a template mutation checking the roster key reads
 * exactly like a correct one.
 */
async function requireAccessAdmin(
  resource: string,
  action: PermissionAction = 'edit',
): Promise<{ ok: true; userId: string; familyCode: string } | { ok: false; message: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Not authenticated.' }

  const { familyCode } = await getMyActiveMembership(user.id)
  if (!familyCode) return { ok: false, message: 'No family associated with your account.' }

  if (!(await can(user.id, resource, action))) {
    return {
      ok: false,
      message: resource === TEMPLATE_RESOURCE
        ? (action === 'delete'
            ? 'You do not have permission to delete templates.'
            : 'You do not have permission to change permission templates.')
        : 'You do not have permission to manage access.',
    }
  }
  return { ok: true, userId: user.id, familyCode }
}

/** What the caller may do on one of the two keys. Drives the UI; never the enforcement. */
export interface AccessRights {
  view: boolean
  create: boolean
  edit: boolean
  remove: boolean
}

const NO_RIGHTS: AccessRights = { view: false, create: false, edit: false, remove: false }

async function rightsOn(userId: string, resource: string): Promise<AccessRights> {
  const [view, create, edit, remove] = await Promise.all([
    can(userId, resource, 'view'),
    can(userId, resource, 'create'),
    can(userId, resource, 'edit'),
    can(userId, resource, 'delete'),
  ])
  return { view, create, edit, remove }
}

/**
 * Both halves of the page's rights, in one round trip.
 *
 * Returned as two objects rather than merged, because merging them is the bug the
 * split exists to prevent: `edit` means "may re-template a member" on one and "may
 * rewrite what a template grants" on the other, and a single flag would have to
 * choose which, silently, for every control on the screen.
 */
export async function canManageAccess(): Promise<{
  members: AccessRights
  templates: AccessRights
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { members: NO_RIGHTS, templates: NO_RIGHTS }
  const [members, templates] = await Promise.all([
    rightsOn(user.id, RESOURCE),
    rightsOn(user.id, TEMPLATE_RESOURCE),
  ])
  return { members, templates }
}

// ── Reads ───────────────────────────────────────────────────────────────────

/**
 * The family's templates, with a head count and whether each one can administer.
 *
 * Gated on EITHER key, deliberately. The Members tab's row menu is a list of templates
 * to put someone on, so a roster administrator has to be able to read their names and
 * ids without holding the grant that edits their grids — and the templates grid needs
 * the same list for its left column. What it returns is names, ids and counts; the
 * grants themselves are getTemplatePolicy(), which is gated on the template key alone.
 */
export async function getTemplates(): Promise<TemplateSummary[]> {
  const asRoster = await requireAccessAdmin(RESOURCE, 'view')
  const auth = asRoster.ok ? asRoster : await requireAccessAdmin(TEMPLATE_RESOURCE, 'view')
  if (!auth.ok) return []

  const admin = createAdminClient()
  const { data: templates } = await admin
    .from('permission_templates')
    .select('id, name, description, is_system')
    .eq('family_code', auth.familyCode)
    .order('is_system', { ascending: false })
    .order('name')

  const rows = (templates ?? []) as {
    id: string; name: string; description: string | null; is_system: boolean
  }[]
  if (rows.length === 0) return []

  const ids = rows.map(t => t.id)
  const [{ data: assigned }, { data: adminGrants }] = await Promise.all([
    admin.from('people').select('permission_template_id').in('permission_template_id', ids),
    // EITHER key, since 20260808000000 split them. A template that can only re-assign
    // members is administrative, and so is one that can only rewrite grids — the badge
    // answers "does putting somebody on this hand them authority over other people",
    // and both of them do.
    admin.from('template_permissions')
      .select('template_id')
      .in('template_id', ids)
      .in('resource_key', [RESOURCE, TEMPLATE_RESOURCE])
      .eq('action', 'edit')
      .neq('scope', 'none'),
  ])

  const counts = new Map<string, number>()
  for (const p of (assigned ?? []) as { permission_template_id: string }[]) {
    counts.set(p.permission_template_id, (counts.get(p.permission_template_id) ?? 0) + 1)
  }
  const administers = new Set(
    ((adminGrants ?? []) as { template_id: string }[]).map(g => g.template_id),
  )

  return rows.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    isSystem: t.is_system,
    memberCount: counts.get(t.id) ?? 0,
    grantsAdmin: administers.has(t.id),
  }))
}

interface PersonRow {
  id: string
  first_name: string
  last_name: string
  primary_email: string | null
  primary_phone: string | null
  city: string | null
  state: string | null
  membership_status: MembershipStatus | null
  permission_template_id: string | null
}

/** "City, State", either half on its own, or null when neither is recorded. */
const location = (p: PersonRow) =>
  [p.city, p.state].filter(Boolean).join(', ') || null

const displayName = (p: PersonRow) =>
  [p.first_name, p.last_name].filter(Boolean).join(' ') || '(no name)'

/**
 * PostgREST's `or` filter is a comma/parenthesis-delimited mini-language, so a
 * raw query string could break the filter or smuggle in extra conditions. Keep
 * only characters that are meaningful in a name or email.
 */
function safeQuery(query: string): string {
  return query.trim().replace(/[^\p{L}\p{N}\s@._'-]/gu, '').slice(0, 60)
}

/**
 * One page of the family's members, optionally filtered by name or email.
 *
 * Paged and searched in the database on purpose: a family can run to several hundred
 * people, and shipping them all to the browser to filter client-side does not scale.
 *
 * Gated on 'admin/users' rather than 'members'. This runs on the service role, so RLS
 * never narrows it, and it returns more than the directory does — every member's
 * email, their template, and whether their access is switched off. That is this
 * page's data, and this page's key governs it.
 */
export async function searchMembers(opts: {
  query?: string
  offset?: number
  limit?: number
} = {}): Promise<MemberPage> {
  const auth = await requireAccessAdmin(RESOURCE, 'view')
  if (!auth.ok) return { rows: [], total: 0 }

  const { personId: myPersonId } = await getMyActiveMembership(auth.userId)

  const limit = opts.limit ?? MEMBER_PAGE_SIZE
  const offset = opts.offset ?? 0
  const q = safeQuery(opts.query ?? '')

  const admin = createAdminClient()
  let builder = admin
    .from('people')
    .select(
      // phone, city and state are for the Members table's columns. They are roster PII
      // and this action is gated on 'admin/users' rather than 'members' — see the doc
      // comment — so widening the projection does not widen who can read it.
      //
      // Kept as ONE literal rather than split across lines: supabase-js parses the select
      // at the type level, and a concatenated string is just `string` to it, which
      // collapses the result to GenericStringError and takes the PersonRow cast with it.
      'id, first_name, last_name, primary_email, primary_phone, city, state, membership_status, permission_template_id',
      { count: 'exact' },
    )
    .eq('family_code', auth.familyCode)
    // Rows with no user_id are relatives entered by somebody else — a child, an
    // ancestor. They hold no permissions and have no access to switch off.
    .not('user_id', 'is', null)
    // A declined application is not a member. Member Approvals owns those rows and is
    // the only place that can reverse the decision, so listing them here would offer a
    // menu with nothing in it for every applicant a family has ever turned away.
    // PENDING rows stay: their template can usefully be set before they are admitted.
    .neq('membership_status', 'rejected')

  if (q) {
    builder = builder.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,primary_email.ilike.%${q}%`,
    )
  }

  const { data, count } = await builder
    .order('last_name')
    .order('first_name')
    .range(offset, offset + limit - 1)

  const rows = (data ?? []) as PersonRow[]

  // Resolve template names for the rows on this page only. Scoped to the family as
  // well as to the ids, so a stale assignment pointing at another family's template
  // renders as "no template" rather than naming it.
  const templateIds = [...new Set(rows.map(r => r.permission_template_id).filter(Boolean))] as string[]
  const names = new Map<string, string>()
  if (templateIds.length) {
    const { data: templates } = await admin
      .from('permission_templates')
      .select('id, name')
      .eq('family_code', auth.familyCode)
      .in('id', templateIds)
    for (const t of (templates ?? []) as { id: string; name: string }[]) {
      names.set(t.id, t.name)
    }
  }

  return {
    rows: rows.map(p => {
      const templateId = p.permission_template_id && names.has(p.permission_template_id)
        ? p.permission_template_id
        : null
      return {
        personId: p.id,
        name: displayName(p),
        email: p.primary_email,
        phone: p.primary_phone,
        location: location(p),
        templateId,
        templateName: templateId ? names.get(templateId)! : null,
        status: (p.membership_status ?? 'approved') as MembershipStatus,
        isSelf: p.id === myPersonId,
      }
    }),
    total: count ?? 0,
  }
}

export async function getResources(): Promise<ResourceSummary[]> {
  const auth = await requireAccessAdmin(TEMPLATE_RESOURCE, 'view')
  if (!auth.ok) return []

  // The family's plan, for the second filter below. Resolved once for the whole grid
  // rather than per row — `getMyFamilyTier` is `cache()`d, so this is one query however
  // many resources come back.
  const tier = await getMyFamilyTier(auth.userId)

  const admin = createAdminClient()
  const { data: resources } = await admin
    .from('permission_resources')
    .select('key, label, category, subsection, sort_order, actions')
    .order('sort_order')

  type Row = {
    key: string; label: string; category: string
    subsection: string | null; sort_order: number; actions: string[] | null
  }

  return ((resources ?? []) as Row[])
    // A page that hasn't shipped has nothing to permission yet — showing its row
    // would invite configuring access to something nobody can reach. Flip the
    // feature to 'live' in lib/features.ts and it appears here automatically.
    // Keys with no feature entry are not roadmap-gated: that covers the capability
    // rows under Accounting > Transactions, which have no route of their own. Their
    // `transactions/` prefix matters — getFeature() longest-prefix-matches, so
    // `transactions/*` resolves to the live /transactions entry. A key prefixed
    // `family-finances/` or `admin/` would inherit a 'future' entry and vanish from
    // the grid with no error.
    .filter(r => !isFeatureFuture(`/${r.key}`))
    // ...and neither has a page the family's PLAN does not include. Same argument as the
    // line above, one step along: a switch for a screen nobody in this family can open
    // reads as a control being honoured, and an administrator who grants it and then
    // watches nothing change has been told a small lie by the grid.
    //
    // IT IS A PRESENTATION FILTER AND NOTHING ELSE. The grants themselves are untouched —
    // a family that upgrades finds its templates exactly as they were, and one that
    // downgrades loses no configuration, only the row that displays it. That is the same
    // promise `requireTier` makes about data, and it is what makes moving between plans
    // survivable rather than destructive.
    .filter(r => tierMeets(tier, requiredTier(`/${r.key}`)))
    .map(r => ({
      key: r.key,
      label: r.label,
      category: r.category,
      subsection: r.subsection,
      sortOrder: r.sort_order,
      // Older rows predate the column; treat a missing value as "all four".
      actions: (r.actions?.length ? r.actions : [...PERMISSION_ACTIONS]) as PermissionAction[],
    }))
}

/**
 * One template's grid. Reading a family's permission configuration is itself
 * privileged — it is the map of who may do what — so this gates on view over
 * 'admin/users' rather than being treated as harmless lookup data.
 *
 * `templateId` arrives from the client and the read runs on the service role, so the
 * template is confirmed to belong to the caller's family before anything is returned.
 * Without that, `.eq('template_id', id)` alone hands any signed-in user any family's
 * policy — the query is keyed on a column that carries no family of its own.
 */
export async function getTemplatePolicy(templateId: string): Promise<PolicyMap> {
  const auth = await requireAccessAdmin(TEMPLATE_RESOURCE, 'view')
  if (!auth.ok) return {}

  const admin = createAdminClient()
  const { data: template } = await admin
    .from('permission_templates')
    .select('id')
    .eq('id', templateId)
    .eq('family_code', auth.familyCode)
    .maybeSingle()
  if (!template) return {}

  const { data } = await admin
    .from('template_permissions')
    .select('resource_key, action, scope')
    .eq('template_id', templateId)

  const out: PolicyMap = {}
  for (const row of (data ?? []) as { resource_key: string; action: PermissionAction; scope: PermissionScope }[]) {
    out[`${row.resource_key}:${row.action}`] = row.scope
  }
  return out
}

/** The caller's own effective permissions — used to render the UI honestly. */
export async function getMyEffectivePermissions(): Promise<{ legacy: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { legacy: false }
  const perms = await getMyPermissionSet(user.id)
  return { legacy: perms.legacy }
}

// ── Templates ───────────────────────────────────────────────────────────────

/**
 * Create a template, blank or as a copy of one the family already has.
 *
 * `copyFromTemplateId` is a COPY and never a link: the new grid is what the source
 * granted at this moment, and the two have nothing to do with each other afterwards.
 * Anything else would be a second layer of resolution, which is the thing 20260807000000
 * removed — see the "one template per member" note in AGENTS.md.
 *
 * TWO GRANTS FOR A COPY, and this is the part worth not undoing. Creating is gated on
 * `create` and rewriting a grid on `edit`, so a family can hand out "may add a template"
 * without "may decide what a template grants". Copying does both in one call — it is
 * exactly `createTemplate` followed by `setTemplatePermission` for every cell — so a
 * caller holding `create` alone could otherwise clone Administrators and mint the
 * authority that split exists to withhold. Blank creation still needs only `create`.
 */
export async function createTemplate(
  name: string,
  description: string,
  copyFromTemplateId?: string | null,
): Promise<AdminResult> {
  const auth = await requireAccessAdmin(TEMPLATE_RESOURCE, 'create')
  if (!auth.ok) return { success: false, message: auth.message }

  const trimmed = name.trim()
  if (!trimmed) return { success: false, message: 'Template name is required.' }

  const admin = createAdminClient()

  // Resolve the source BEFORE anything is inserted, so a copy that cannot be honoured
  // leaves no half-made template behind. Silently falling back to a blank grid was the
  // alternative and is worse than refusing: the caller asked to copy, and a template
  // that grants nothing looks identical to one whose source granted nothing.
  let sourceGrid: PolicyMap | null = null
  if (copyFromTemplateId) {
    if (!(await can(auth.userId, TEMPLATE_RESOURCE, 'edit'))) {
      return {
        success: false,
        message: 'You do not have permission to copy what a template grants. Create a blank template instead.',
      }
    }

    // §4: the id arrives from the client and this runs on the service role, so the
    // source is confirmed into the caller's own family before it is read. Without it,
    // `.eq('id', …)` alone copies any family's access map into this one.
    const { data: source } = await admin
      .from('permission_templates')
      .select('id')
      .eq('id', copyFromTemplateId)
      .eq('family_code', auth.familyCode)
      .maybeSingle()
    if (!source) return { success: false, message: 'The template to copy was not found in your family.' }

    // The error is read rather than discarded (§8) precisely because an empty result is
    // indistinguishable from a template that grants nothing — and here that difference
    // is the whole content of the operation.
    const { data: grants, error: grantsError } = await admin
      .from('template_permissions')
      .select('resource_key, action, scope')
      .eq('template_id', copyFromTemplateId)
    if (grantsError) return { success: false, message: 'Could not read the template to copy.' }

    sourceGrid = {}
    for (const g of (grants ?? []) as { resource_key: string; action: PermissionAction; scope: PermissionScope }[]) {
      sourceGrid[`${g.resource_key}:${g.action}`] = g.scope
    }
  }

  const { data: created, error } = await admin
    .from('permission_templates')
    .insert({
      family_code: auth.familyCode,
      name: trimmed,
      description: description.trim() || null,
      created_by: auth.userId,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, message: 'A template with that name already exists.' }
    return { success: false, message: 'Could not create the template.' }
  }

  // A new template starts as a complete grid rather than an empty one, copy or not.
  // The grid on screen is the whole answer to "what may these people do", and a
  // template with no rows would fall through to resource_visibility for 'view' —
  // so it would silently grant every unrestricted page while showing nothing.
  //
  // Built from permission_resources and OVERLAID with the source, never copied row for
  // row: that is what fills in a resource registered after the source template was last
  // touched (§6 — those rows do not exist on an older template) and what drops a stale
  // grant for an action the resource no longer declares.
  const { data: resources } = await admin
    .from('permission_resources')
    .select('key, actions')

  const rows: { template_id: string; resource_key: string; action: string; scope: string }[] = []
  for (const r of (resources ?? []) as { key: string; actions: string[] | null }[]) {
    for (const action of r.actions?.length ? r.actions : PERMISSION_ACTIONS) {
      rows.push({
        template_id: created.id,
        resource_key: r.key,
        action,
        scope: sourceGrid?.[`${r.key}:${action}`] ?? 'none',
      })
    }
  }
  if (rows.length) {
    await admin.from('template_permissions')
      .upsert(rows, { onConflict: 'template_id,resource_key,action' })
  }

  revalidatePath('/admin/users')
  return { success: true }
}

export async function renameTemplate(
  templateId: string,
  name: string,
  description: string,
): Promise<AdminResult> {
  const auth = await requireAccessAdmin(TEMPLATE_RESOURCE)
  if (!auth.ok) return { success: false, message: auth.message }

  const trimmed = name.trim()
  if (!trimmed) return { success: false, message: 'Template name is required.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('permission_templates')
    .update({ name: trimmed, description: description.trim() || null })
    .eq('id', templateId)
    .eq('family_code', auth.familyCode)

  if (error) {
    if (error.code === '23505') return { success: false, message: 'A template with that name already exists.' }
    return { success: false, message: 'Could not rename the template.' }
  }
  revalidatePath('/admin/users')
  return { success: true }
}

export async function deleteTemplate(templateId: string): Promise<AdminResult> {
  const auth = await requireAccessAdmin(TEMPLATE_RESOURCE, 'delete')
  if (!auth.ok) return { success: false, message: auth.message }

  const admin = createAdminClient()
  const { data: template } = await admin
    .from('permission_templates')
    .select('is_system, name')
    .eq('id', templateId)
    .eq('family_code', auth.familyCode)
    .maybeSingle()

  if (!template) return { success: false, message: 'Template not found.' }
  if ((template as { is_system: boolean }).is_system) {
    return {
      success: false,
      message: 'Administrators and General are built in and cannot be deleted. Edit what they grant instead.',
    }
  }

  // people.permission_template_id is ON DELETE RESTRICT, so the database refuses
  // this anyway. Counting first turns a foreign-key violation into a sentence that
  // says what to do about it.
  const { count } = await admin
    .from('people')
    .select('id', { count: 'exact', head: true })
    .eq('family_code', auth.familyCode)
    .eq('permission_template_id', templateId)

  if ((count ?? 0) > 0) {
    return {
      success: false,
      message: `${count} member${count === 1 ? ' is' : 's are'} on this template. Move them to another one first.`,
    }
  }

  const { error } = await admin
    .from('permission_templates')
    .delete()
    .eq('id', templateId)
    .eq('family_code', auth.familyCode)
  if (error) return { success: false, message: 'Could not delete the template.' }

  revalidatePath('/admin/users')
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function setTemplatePermission(
  templateId: string,
  resourceKey: string,
  action: PermissionAction,
  scope: PermissionScope,
): Promise<AdminResult> {
  const auth = await requireAccessAdmin(TEMPLATE_RESOURCE)
  if (!auth.ok) return { success: false, message: auth.message }

  const admin = createAdminClient()
  const { data: template } = await admin
    .from('permission_templates').select('id').eq('id', templateId)
    .eq('family_code', auth.familyCode).maybeSingle()
  if (!template) return { success: false, message: 'Template not found in your family.' }

  // Never let the family revoke its own last route back in. Removing either of the two
  // grants that govern THIS page is the edit with no undo: the screen that could
  // restore it is the screen it just locked.
  //
  // BOTH keys, since 20260808000000 split them, and each is a separate lockout with a
  // different shape:
  //   admin/users:edit            nobody can put a member on a different template, so
  //                               a grid can be rewritten but reaches no one.
  //   admin/users/templates:edit  nobody can change what any template grants, so every
  //                               grid in the family is frozen exactly as it stands.
  // Neither is recoverable from the UI, so neither is allowed to reach zero.
  if ((resourceKey === RESOURCE || resourceKey === TEMPLATE_RESOURCE)
      && action === 'edit' && scope === 'none') {
    const lockout = await wouldLoseLastAdmin(resourceKey, templateId, auth.familyCode)
    if (lockout) return { success: false, message: lockout }
  }

  const { error } = await admin.from('template_permissions').upsert(
    {
      template_id: templateId,
      resource_key: resourceKey,
      action,
      scope,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'template_id,resource_key,action' },
  )
  if (error) return { success: false, message: 'Could not save the permission.' }

  revalidatePath('/admin/users')
  revalidatePath('/', 'layout')
  return { success: true }
}

/** How each of the two lockouts reads to the person about to cause it. */
const LOCKOUT_SUBJECT: Record<string, string> = {
  [RESOURCE]: 'manage access',
  [TEMPLATE_RESOURCE]: 'change permission templates',
}

/**
 * Returns an error message when stripping `resourceKey`:edit from `templateId` would
 * leave the family with nobody holding it.
 *
 * The TypeScript twin of family_has_other_admin() in 20260807000000, asked about a
 * template rather than a person: everyone on this template is about to lose the
 * grant, so the question is whether anyone NOT on it still holds it.
 *
 * The database has no twin for the TEMPLATE key and does not need one — every template
 * mutation in this file runs on the service role, so this is the only layer that sees
 * the edit. family_has_other_admin() stays keyed on `admin/users` because its callers
 * are the two RPCs that write to `people`, which are Members-tab operations.
 */
async function wouldLoseLastAdmin(
  resourceKey: string,
  templateId: string,
  familyCode: string,
): Promise<string | null> {
  const admin = createAdminClient()
  const subject = LOCKOUT_SUBJECT[resourceKey] ?? 'manage access'

  const { data: capable } = await admin
    .from('template_permissions')
    .select('template_id, permission_templates!inner(family_code)')
    .eq('resource_key', resourceKey)
    .eq('action', 'edit')
    .neq('scope', 'none')

  const otherIds = ((capable ?? []) as { template_id: string; permission_templates: unknown }[])
    .filter(r => {
      const rel = Array.isArray(r.permission_templates) ? r.permission_templates[0] : r.permission_templates
      return (rel as { family_code?: string } | null)?.family_code === familyCode
    })
    .map(r => r.template_id)
    .filter(id => id !== templateId)

  if (otherIds.length === 0) {
    return `This is the only template that can ${subject}. Grant it to another template first.`
  }

  // A template nobody is on is not a way back in. Only APPROVED members count — a
  // pending applicant holds no permissions whatever their template says, and a
  // disabled one holds none by definition.
  const { count } = await admin
    .from('people')
    .select('id', { count: 'exact', head: true })
    .eq('family_code', familyCode)
    .eq('membership_status', 'approved')
    .not('user_id', 'is', null)
    .in('permission_template_id', otherIds)

  return (count ?? 0) === 0
    ? `No other template that can ${subject} has any members. Put someone on one first.`
    : null
}

// ── Members ─────────────────────────────────────────────────────────────────

/**
 * Put one member on one template.
 *
 * The TypeScript check is the friendly layer; apply_permission_template() is the real
 * one. USER client, always — see the header. The RPC re-derives the caller from
 * auth.uid(), confirms both ids into the caller's family, and refuses the move that
 * would leave the family with no administrator.
 */
export async function applyTemplate(personId: string, templateId: string): Promise<AdminResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated.' }

  // canAny would be the guard-file equivalent; assigning permissions has no coherent
  // "own" version, and the row a member would own is their own access.
  if ((await can(user.id, RESOURCE, 'edit')) === false) {
    return { success: false, message: 'You do not have permission to manage access.' }
  }

  const { data, error } = await supabase
    .rpc('apply_permission_template', { p_person_id: personId, p_template_id: templateId })
    .maybeSingle<{ ok: boolean; message: string | null }>()

  if (error) return { success: false, message: 'Could not apply that template. Please try again.' }
  if (!data?.ok) return { success: false, message: data?.message ?? 'Not authorized' }

  revalidatePath('/admin/users')
  revalidatePath('/', 'layout')
  return { success: true }
}

/**
 * Switch a member's access off, or back on.
 *
 * 'disabled' is a membership_status, so this needs no new gate anywhere: every check
 * in the app and every policy in the database tests positively for 'approved', and a
 * disabled member fails all of them at once.
 *
 * USER client for the same reason as above. set_member_enabled() refuses to let the
 * caller disable themselves or the family's last administrator.
 */
export async function setMemberEnabled(personId: string, enabled: boolean): Promise<AdminResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated.' }

  if ((await can(user.id, RESOURCE, 'edit')) === false) {
    return { success: false, message: 'You do not have permission to manage access.' }
  }

  const { data, error } = await supabase
    .rpc('set_member_enabled', { p_person_id: personId, p_enabled: enabled })
    .maybeSingle<{ ok: boolean; message: string | null }>()

  if (error) return { success: false, message: 'Could not change that member. Please try again.' }
  if (!data?.ok) return { success: false, message: data?.message ?? 'Not authorized' }

  revalidatePath('/admin/users')
  revalidatePath('/', 'layout')
  return { success: true }
}
