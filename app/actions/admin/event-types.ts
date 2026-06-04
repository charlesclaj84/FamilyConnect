'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface EventType {
  id: string
  family_code: string
  name: string
  description: string | null
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
  response_type: 'text' | 'date' | 'checkbox' | 'list'
  created_at: string
}

async function getAuthenticatedAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, admin: null, familyCode: '' }

  const adminClient = createAdminClient()
  const { data: person } = await adminClient
    .from('people')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!person?.is_admin) return { user: null, admin: null, familyCode: '' }

  const familyCode: string = user.user_metadata?.family_code ?? ''
  return { user, admin: adminClient, familyCode }
}

// ── Event Types ────────────────────────────────────────────────────────────────

export async function getEventTypes(): Promise<EventType[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode: string = user.user_metadata?.family_code ?? ''
  const admin = createAdminClient()
  const { data } = await admin
    .from('event_types')
    .select('*')
    .eq('family_code', familyCode)
    .order('name')

  return (data ?? []) as EventType[]
}

export async function createEventType(
  name: string,
  description?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { user, admin, familyCode } = await getAuthenticatedAdmin()
  if (!admin) return { success: false, error: 'Not authorized' }

  const { data, error } = await admin
    .from('event_types')
    .insert({ name: name.trim(), description: description?.trim() || null, family_code: familyCode, created_by: user!.id })
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

// ── Blueprint Items ────────────────────────────────────────────────────────────

export async function getBlueprintItems(eventTypeId: string): Promise<BlueprintItem[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('event_blueprint_items')
    .select('*')
    .eq('event_type_id', eventTypeId)
    .order('sort_order')
    .order('created_at')

  return (data ?? []) as BlueprintItem[]
}

export async function addBlueprintItem(
  eventTypeId: string,
  title: string,
  options?: { description?: string; due_date?: string; response_type?: 'text' | 'date' | 'checkbox' }
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
  options?: { description?: string; due_date?: string; response_type?: 'text' | 'date' | 'checkbox' }
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
