'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode } from '@/lib/auth/family'
import { requireEdit, requireDelete } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/date-utils'

export interface Election {
  id: string
  title: string
  description: string | null
  status: 'draft' | 'nominations' | 'voting' | 'closed'
  nominations_open_at: string | null
  nominations_close_at: string | null
  voting_open_at: string | null
  voting_close_at: string | null
  created_at: string
}

export interface ElectionPosition {
  id: string
  election_id: string
  title: string
  max_winners: number
  sort_order: number
}

export interface ElectionNomination {
  id: string
  position_id: string
  nominee_id: string
  nominee_name: string
  accepted: boolean | null
}

export interface ElectionVoteCount {
  position_id: string
  nominee_id: string
  nominee_name: string
  vote_count: number
}

export async function getActiveElections(): Promise<Election[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('elections')
    .select('*')
    .in('status', ['nominations', 'voting'])
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getAllElections(): Promise<Election[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('elections')
    .select('*')
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getElectionDetail(id: string): Promise<{
  election: Election | null
  positions: ElectionPosition[]
  nominations: ElectionNomination[]
  myVotes: Record<string, string>
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { election: null, positions: [], nominations: [], myVotes: {} }

  const [electionRes, positionsRes, nominationsRes] = await Promise.all([
    supabase.from('elections').select('*').eq('id', id).maybeSingle(),
    supabase.from('election_positions').select('*').eq('election_id', id).order('sort_order'),
    supabase
      .from('election_nominations')
      .select('id, position_id, nominee_id, accepted, people(first_name, last_name)')
      .eq('election_id', id),
  ])

  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()
  let myVotes: Record<string, string> = {}
  if (myPerson) {
    const { data: votes } = await supabase
      .from('election_votes')
      .select('position_id, nominee_id')
      .eq('election_id', id)
      .eq('voter_id', myPerson.id)
    for (const v of votes ?? []) myVotes[v.position_id] = v.nominee_id
  }

  return {
    election: electionRes.data ?? null,
    positions: positionsRes.data ?? [],
    nominations: (nominationsRes.data ?? []).map(n => ({
      id: n.id,
      position_id: n.position_id,
      nominee_id: n.nominee_id,
      nominee_name: n.people
        ? `${(n.people as any).first_name} ${(n.people as any).last_name}`
        : 'Unknown',
      accepted: n.accepted,
    })),
    myVotes,
  }
}

export async function getElectionResults(id: string): Promise<ElectionVoteCount[]> {
  const admin = createAdminClient()
  const { data: votes } = await admin
    .from('election_votes')
    .select('position_id, nominee_id, people(first_name, last_name)')
    .eq('election_id', id)

  const counts = new Map<string, { nominee_name: string; count: number }>()
  for (const v of votes ?? []) {
    const key = `${v.position_id}::${v.nominee_id}`
    const name = v.people
      ? `${(v.people as any).first_name} ${(v.people as any).last_name}`
      : 'Unknown'
    const existing = counts.get(key)
    counts.set(key, { nominee_name: name, count: (existing?.count ?? 0) + 1 })
  }

  return [...counts.entries()].map(([key, val]) => {
    const [position_id, nominee_id] = key.split('::')
    return { position_id, nominee_id, nominee_name: val.nominee_name, vote_count: val.count }
  })
}

export async function submitNomination(
  electionId: string,
  positionId: string,
  nomineeId: string
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()

  const { error } = await supabase.from('election_nominations').insert({
    election_id: electionId,
    position_id: positionId,
    nominee_id: nomineeId,
    nominated_by: myPerson?.id ?? null,
    // Self-nominations are accepted automatically; nominations of others await acceptance.
    accepted: myPerson?.id === nomineeId ? true : null,
  })
  if (error) return { success: false, message: error.message }
  revalidatePath(`/elections/${electionId}`)
  return { success: true }
}

export async function respondToNomination(
  nominationId: string,
  accepted: boolean,
  electionId: string
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('election_nominations')
    .update({ accepted })
    .eq('id', nominationId)
  if (error) return { success: false, message: error.message }
  revalidatePath(`/elections/${electionId}`)
  return { success: true }
}

export async function castVote(
  electionId: string,
  positionId: string,
  nomineeId: string
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()
  if (!myPerson) return { success: false, message: 'Profile not found' }

  const { error } = await supabase.from('election_votes').upsert(
    { election_id: electionId, position_id: positionId, voter_id: myPerson.id, nominee_id: nomineeId },
    { onConflict: 'election_id,position_id,voter_id' }
  )
  if (error) return { success: false, message: error.message }
  revalidatePath(`/elections/${electionId}`)
  return { success: true }
}

export async function createElection(input: {
  title: string
  description: string
  nominations_open_at: string | null
  nominations_close_at: string | null
  voting_open_at: string | null
  voting_close_at: string | null
  positions: { title: string; max_winners: number }[]
  announce?: boolean
}): Promise<{ success: boolean; id?: string; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const familyCode = await getMyFamilyCode(user.id)
  const { data: myPerson } = await supabase.from('people').select('id').eq('user_id', user.id).maybeSingle()

  const { data: election, error } = await supabase.from('elections').insert({
    family_code: familyCode,
    title: input.title.trim(),
    description: input.description.trim() || null,
    nominations_open_at: input.nominations_open_at,
    nominations_close_at: input.nominations_close_at,
    voting_open_at: input.voting_open_at,
    voting_close_at: input.voting_close_at,
    created_by: myPerson?.id ?? null,
  }).select('id').single()
  if (error) return { success: false, message: error.message }

  if (input.positions.length) {
    await supabase.from('election_positions').insert(
      input.positions.map((p, i) => ({
        election_id: election.id,
        title: p.title,
        max_winners: p.max_winners,
        sort_order: i,
      }))
    )
  }

  // Optionally post a family announcement about the new election.
  if (input.announce) {
    const nomOpen = formatDate(input.nominations_open_at)
    const parts = [
      `A new election, "${input.title.trim()}", has been created.`,
      input.description.trim() || null,
      nomOpen ? `Nominations open ${nomOpen}.` : 'Watch for nominations to open soon.',
    ].filter(Boolean)
    await supabase.from('announcements').insert({
      family_code: familyCode,
      title: `New Election: ${input.title.trim()}`,
      body: parts.join(' '),
      scope: 'national',
      pinned: false,
      author_id: myPerson?.id ?? null,
    })
    revalidatePath('/announcements')
    revalidatePath('/dashboard')
    revalidatePath('/admin/announcements')
  }

  revalidatePath('/elections')
  revalidatePath('/admin/elections')
  return { success: true, id: election.id }
}

export async function updateElectionStatus(
  id: string,
  status: Election['status']
): Promise<{ success: boolean; message?: string }> {
  // Opening and closing a ballot is a family-wide act, so it needs the unrestricted
  // grant — and the family filter below, because the service-role client applies no
  // RLS and an id alone would otherwise reach another family's election.
  const g = await requireEdit('elections')
  if (!g.ok) return { success: false, message: g.message }

  const admin = createAdminClient()
  const { error } = await admin
    .from('elections').update({ status }).eq('id', id).eq('family_code', g.familyCode)
  if (error) return { success: false, message: error.message }
  revalidatePath('/elections')
  revalidatePath('/admin/elections')
  return { success: true }
}

export async function deleteElection(id: string): Promise<{ success: boolean; message?: string }> {
  // Deleting takes every nomination and vote with it, so it is gated on the delete
  // grant rather than edit.
  const g = await requireDelete('elections')
  if (!g.ok) return { success: false, message: g.message }

  const admin = createAdminClient()
  const { error } = await admin
    .from('elections').delete().eq('id', id).eq('family_code', g.familyCode)
  if (error) return { success: false, message: error.message }
  revalidatePath('/elections')
  revalidatePath('/admin/elections')
  return { success: true }
}
