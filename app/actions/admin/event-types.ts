'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { requireRead } from '@/lib/auth/guard'
import { getMyFamilyCode, belongsToFamily } from '@/lib/auth/family'
import { createAdminClient } from '@/lib/supabase/admin'

export interface EventType {
  id: string
  family_code: string
  name: string
  description: string | null
  sort_order: number
  created_by: string | null
  created_at: string
}

export interface BlueprintItem {
  id: string
  event_type_id: string
  title: string
  description: string | null
  sort_order: number
  due_date: string | null
  response_type: 'text' | 'date' | 'checkbox' | 'list' | 'members'
  created_at: string
}

async function getAuthenticatedAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, admin: null, familyCode: '' }

  const adminClient = createAdminClient()
  if (!(await can(user.id, 'admin/event-types', 'edit'))) return { user: null, admin: null, familyCode: '' }

  const familyCode = await getMyFamilyCode(user.id)
  return { user, admin: adminClient, familyCode }
}

// ── Event Types ────────────────────────────────────────────────────────────────

export async function getEventTypes(): Promise<EventType[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()
  const { data } = await admin
    .from('event_types')
    .select('*')
    .eq('family_code', familyCode)
    .order('sort_order')
    .order('name')

  return (data ?? []) as EventType[]
}

export async function createEventType(
  name: string,
  description?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { user, admin, familyCode } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  // New templates go to the end of the family's list.
  const { data: last } = await admin
    .from('event_types').select('sort_order').eq('family_code', familyCode)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()

  const { data, error } = await admin
    .from('event_types')
    .insert({ name: name.trim(), description: description?.trim() || null, family_code: familyCode, sort_order: (last?.sort_order ?? 0) + 1, created_by: user!.id })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/event-types')
  return { success: true, id: data.id }
}

export async function updateEventType(
  id: string,
  name: string,
  description?: string
): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { error } = await admin
    .from('event_types')
    .update({ name: name.trim(), description: description?.trim() || null })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/event-types')
  return { success: true }
}

export async function deleteEventType(id: string): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { error } = await admin.from('event_types').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/event-types')
  return { success: true }
}

export async function moveEventType(
  id: string,
  direction: 'up' | 'down'
): Promise<{ success: boolean; error?: string }> {
  const { admin, familyCode } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  // Same order as the list (sort_order, then name) so neighbours match the UI.
  const { data: items } = await admin
    .from('event_types')
    .select('id, sort_order')
    .eq('family_code', familyCode)
    .order('sort_order')
    .order('name')

  if (!items?.length) return { success: false, error: 'No templates found' }

  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return { success: false, error: 'Template not found' }

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= items.length) return { success: true } // at a boundary

  const current = items[idx]
  const swap    = items[swapIdx]
  await admin.from('event_types').update({ sort_order: swap.sort_order }).eq('id', current.id)
  await admin.from('event_types').update({ sort_order: current.sort_order }).eq('id', swap.id)

  revalidatePath('/admin/event-types')
  return { success: true }
}

// ── Sub-template links ───────────────────────────────────────────────────────
// A template can auto-include other templates as sub-events.

export interface SubTemplate {
  link_id: string
  child_event_type_id: string
  name: string
  sort_order: number
}

/**
 * Templates nested inside one template. The parent id comes from the client and the
 * link table is keyed only on it, so the parent is confirmed into the caller's family
 * before anything is read, and the child lookup is family-scoped too.
 */
export async function getSubTemplates(eventTypeId: string): Promise<SubTemplate[]> {
  const g = await requireRead('admin/event-types')
  if (!g.ok) return []
  if (!(await belongsToFamily('event_types', eventTypeId, g.familyCode))) return []

  const admin = createAdminClient()
  const { data: links } = await admin
    .from('event_type_sub_templates')
    .select('id, child_event_type_id, sort_order')
    .eq('parent_event_type_id', eventTypeId)
    .order('sort_order')

  if (!links?.length) return []

  const childIds = links.map(l => l.child_event_type_id)
  const { data: types } = await admin.from('event_types').select('id, name')
    .eq('family_code', g.familyCode).in('id', childIds)
  const nameById = Object.fromEntries((types ?? []).map(t => [t.id, t.name]))

  return links.map(l => ({
    link_id:             l.id,
    child_event_type_id: l.child_event_type_id,
    name:                nameById[l.child_event_type_id] ?? 'Unknown template',
    sort_order:          l.sort_order,
  }))
}

export async function addSubTemplate(
  parentEventTypeId: string,
  childEventTypeId: string
): Promise<{ success: boolean; error?: string }> {
  const { admin, familyCode } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }
  if (parentEventTypeId === childEventTypeId) return { success: false, error: 'A template cannot include itself.' }

  // Both templates must belong to this family.
  const { data: types } = await admin
    .from('event_types').select('id').eq('family_code', familyCode).in('id', [parentEventTypeId, childEventTypeId])
  if ((types?.length ?? 0) < 2) return { success: false, error: 'Template not found' }

  const { data: last } = await admin
    .from('event_type_sub_templates').select('sort_order').eq('parent_event_type_id', parentEventTypeId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()

  const { error } = await admin
    .from('event_type_sub_templates')
    .insert({ parent_event_type_id: parentEventTypeId, child_event_type_id: childEventTypeId, sort_order: (last?.sort_order ?? 0) + 1 })

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/event-types')
  return { success: true }
}

export async function removeSubTemplate(linkId: string): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { error } = await admin.from('event_type_sub_templates').delete().eq('id', linkId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/event-types')
  return { success: true }
}

// ── Blueprint Items ────────────────────────────────────────────────────────────

/**
 * The checklist attached to one template. Rendered on both Event Templates and the
 * Event Management detail screen, so either view grant admits.
 */
export async function getBlueprintItems(eventTypeId: string): Promise<BlueprintItem[]> {
  const g = await requireRead('admin/event-types', 'admin/events')
  if (!g.ok) return []
  if (!(await belongsToFamily('event_types', eventTypeId, g.familyCode))) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('event_blueprint_items')
    .select('*')
    .eq('family_code', g.familyCode)
    .eq('event_type_id', eventTypeId)
    .order('sort_order')
    .order('created_at')

  return (data ?? []) as BlueprintItem[]
}

export async function addBlueprintItem(
  eventTypeId: string,
  title: string,
  options?: { description?: string; due_date?: string; response_type?: 'text' | 'date' | 'checkbox' | 'list' | 'members' }
): Promise<{ success: boolean; error?: string }> {
  const { user, admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { data: existing } = await admin
    .from('event_blueprint_items')
    .select('sort_order')
    .eq('event_type_id', eventTypeId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (existing?.sort_order ?? 0) + 1

  const { error } = await admin
    .from('event_blueprint_items')
    .insert({
      event_type_id: eventTypeId,
      title:         title.trim(),
      description:   options?.description?.trim() || null,
      due_date:      options?.due_date || null,
      response_type: options?.response_type ?? 'text',
      sort_order:    nextOrder,
      created_by:    user!.id,
    })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateBlueprintItemFull(
  id: string,
  title: string,
  options?: { description?: string; due_date?: string; response_type?: 'text' | 'date' | 'checkbox' | 'list' | 'members' }
): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { error } = await admin
    .from('event_blueprint_items')
    .update({
      title:         title.trim(),
      description:   options?.description?.trim() || null,
      due_date:      options?.due_date || null,
      response_type: options?.response_type ?? 'text',
    })
    .eq('id', id)

  return error ? { success: false, error: error.message } : { success: true }
}

export async function updateBlueprintItem(
  id: string,
  title: string,
  description?: string
): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { error } = await admin
    .from('event_blueprint_items')
    .update({ title: title.trim(), description: description?.trim() || null })
    .eq('id', id)

  return error ? { success: false, error: error.message } : { success: true }
}

export async function deleteBlueprintItem(id: string): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { error } = await admin.from('event_blueprint_items').delete().eq('id', id)
  return error ? { success: false, error: error.message } : { success: true }
}

export async function moveBlueprintItem(
  id: string,
  eventTypeId: string,
  direction: 'up' | 'down'
): Promise<{ success: boolean; error?: string }> {
  const { admin } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  // Get all items for this event type sorted by sort_order
  const { data: items } = await admin
    .from('event_blueprint_items')
    .select('id, sort_order')
    .eq('event_type_id', eventTypeId)
    .order('sort_order')

  if (!items?.length) return { success: false, error: 'No items found' }

  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return { success: false, error: 'Item not found' }

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= items.length) return { success: true } // already at boundary

  const current = items[idx]
  const swap    = items[swapIdx]

  // Swap sort_orders
  await admin.from('event_blueprint_items').update({ sort_order: swap.sort_order }).eq('id', current.id)
  await admin.from('event_blueprint_items').update({ sort_order: current.sort_order }).eq('id', swap.id)

  return { success: true }
}
