'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface MyAssignment {
  id: string
  event_id: string
  event_name: string
  event_date: string | null
  event_time: string | null
  blueprint_item_title: string
  due_date: string | null
  response_type: 'text' | 'date' | 'checkbox' | 'list'
  response: string | null
  response_status: 'pending' | 'submitted' | 'approved'
  approved_at: string | null
}

export async function getMyAssignments(): Promise<MyAssignment[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()

  const { data } = await admin
    .from('event_assignments')
    .select('id, event_id, response, response_status, approved_at, event_blueprint_items(title, due_date, response_type), events(name, event_date, event_time)')
    .eq('assigned_to', user.id)
    .order('created_at', { ascending: false })

  return (data ?? []).map(a => ({
    id:                   a.id,
    event_id:             a.event_id,
    event_name:           (a.events as { name: string } | null)?.name ?? 'Unknown Event',
    event_date:           (a.events as { event_date: string | null } | null)?.event_date ?? null,
    event_time:           (a.events as { event_time: string | null } | null)?.event_time ?? null,
    blueprint_item_title: (a.event_blueprint_items as { title: string } | null)?.title ?? '',
    due_date:             (a.event_blueprint_items as { due_date: string | null } | null)?.due_date ?? null,
    response_type:        ((a.event_blueprint_items as { response_type: string } | null)?.response_type ?? 'text') as 'text' | 'date' | 'checkbox',
    response:             a.response ?? null,
    response_status:      (a.response_status ?? 'pending') as 'pending' | 'submitted' | 'approved',
    approved_at:          a.approved_at ?? null,
  }))
}

export async function getMyAssignmentCount(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const admin = createAdminClient()
  const { count } = await admin
    .from('event_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', user.id)

  return count ?? 0
}

export async function submitAssignmentResponse(
  assignmentId: string,
  response: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()

  // Verify this assignment belongs to the user and isn't approved
  const { data: existing } = await admin
    .from('event_assignments')
    .select('assigned_to, response_status')
    .eq('id', assignmentId)
    .single()

  if (!existing) return { success: false, error: 'Assignment not found' }
  if (existing.assigned_to !== user.id) return { success: false, error: 'Not authorized' }
  if (existing.response_status === 'approved') return { success: false, error: 'This response has been approved and cannot be edited' }

  const { error } = await admin
    .from('event_assignments')
    .update({ response: response.trim(), response_status: 'submitted' })
    .eq('id', assignmentId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/event-planning')
  return { success: true }
}
