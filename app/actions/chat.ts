'use server'

import { createClient } from '@/lib/supabase/server'
import { getMyFamilyCode } from '@/lib/auth/family'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChatRoom {
  id: string
  kind: 'family' | 'dm' | 'group'
  family_code: string
  name: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ChatParticipant {
  user_id: string
  first_name: string | null
  last_name: string | null
}

export interface ChatMessage {
  id: string
  room_id: string
  sender_id: string
  body: string
  created_at: string
}

export interface RoomWithMeta extends ChatRoom {
  participants: ChatParticipant[]
  last_message_at: string | null
  can_reply: boolean
  has_unread: boolean
}

export type SenderMap = Record<string, { first_name: string | null; last_name: string | null }>

// ── Internal helper ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichRoom(admin: any, room: ChatRoom, familyCode: string, canReply = true, lastReadAt: string | null = null): Promise<RoomWithMeta> {
  const { data: participantRows } = await admin
    .from('chat_participants')
    .select('user_id')
    .eq('room_id', room.id)
    .eq('is_hidden', false)

  const userIds: string[] = (participantRows ?? []).map((p: { user_id: string }) => p.user_id)

  const { data: people } = userIds.length
    ? await admin
        .from('people')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds)
        .eq('family_code', familyCode)
    : { data: [] }

  const participants: ChatParticipant[] = (people ?? []).map((p: { user_id: string; first_name: string | null; last_name: string | null }) => ({
    user_id:    p.user_id,
    first_name: p.first_name,
    last_name:  p.last_name,
  }))

  const { data: lastMsg } = await admin
    .from('chat_messages')
    .select('created_at')
    .eq('room_id', room.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastMessageAt = lastMsg?.created_at ?? null
  const has_unread = lastMessageAt !== null && (lastReadAt === null || lastMessageAt > lastReadAt)

  return { ...room, participants, last_message_at: lastMessageAt, can_reply: canReply, has_unread }
}

// ── Family room ────────────────────────────────────────────────────────────────

export async function getOrCreateFamilyRoom(): Promise<{ room: ChatRoom | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { room: null, error: 'Not authenticated' }

  const familyCode = await getMyFamilyCode(user.id)
  if (!familyCode) return { room: null, error: 'No family code found on your account' }

  const admin = createAdminClient()

  const { data: existing, error: selectError } = await admin
    .from('chat_rooms')
    .select('*')
    .eq('family_code', familyCode)
    .eq('kind', 'family')
    .maybeSingle()

  if (selectError) return { room: null, error: `Failed to load room: ${selectError.message}` }

  let room: ChatRoom | null = existing as ChatRoom | null

  if (!room) {
    const { data: created, error: insertError } = await admin
      .from('chat_rooms')
      .insert({ kind: 'family', family_code: familyCode, name: null, created_by: user.id })
      .select('*')
      .single()

    if (insertError?.code === '23505') {
      const { data: fallback } = await admin
        .from('chat_rooms')
        .select('*')
        .eq('family_code', familyCode)
        .eq('kind', 'family')
        .single()
      room = fallback as ChatRoom | null
    } else if (insertError) {
      return { room: null, error: `Failed to create room: ${insertError.message}` }
    } else {
      room = created as ChatRoom | null
    }
  }

  if (!room) return { room: null, error: 'Could not find or create the family room' }

  const { data: familyPeople } = await admin
    .from('people')
    .select('user_id')
    .eq('family_code', familyCode)
    .not('user_id', 'is', null)

  if (familyPeople?.length) {
    const rows = familyPeople
      .filter(p => p.user_id)
      .map(p => ({ room_id: room!.id, user_id: p.user_id as string }))

    const { error: participantError } = await admin
      .from('chat_participants')
      .upsert(rows, { onConflict: 'room_id,user_id', ignoreDuplicates: true })

    if (participantError) return { room: null, error: `Failed to enroll members: ${participantError.message}` }
  }

  return { room }
}

// ── DM room ────────────────────────────────────────────────────────────────────

export async function getOrCreateDmRoom(
  otherUserId: string
): Promise<{ room: RoomWithMeta | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { room: null, error: 'Not authenticated' }

  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()

  const { data: otherPerson } = await admin
    .from('people')
    .select('user_id, first_name, last_name')
    .eq('user_id', otherUserId)
    .eq('family_code', familyCode)
    .maybeSingle()

  if (!otherPerson) return { room: null, error: 'User not found in your family' }

  const { data: myRooms } = await admin
    .from('chat_participants')
    .select('room_id')
    .eq('user_id', user.id)

  const { data: theirRooms } = await admin
    .from('chat_participants')
    .select('room_id')
    .eq('user_id', otherUserId)

  const myRoomIds = new Set((myRooms ?? []).map(r => r.room_id))
  const sharedIds = (theirRooms ?? []).map(r => r.room_id).filter(id => myRoomIds.has(id))

  if (sharedIds.length) {
    const { data: dmRoom } = await admin
      .from('chat_rooms')
      .select('*')
      .in('id', sharedIds)
      .eq('kind', 'dm')
      .maybeSingle()

    if (dmRoom) {
      // Restore visibility if the user previously deleted this DM
      await admin
        .from('chat_participants')
        .update({ is_hidden: false, can_reply: true })
        .eq('room_id', dmRoom.id)
        .eq('user_id', user.id)

      const room = await enrichRoom(admin, dmRoom as ChatRoom, familyCode)
      return { room }
    }
  }

  const { data: newRoom, error: roomError } = await admin
    .from('chat_rooms')
    .insert({ kind: 'dm', family_code: familyCode, name: null, created_by: user.id })
    .select('*')
    .single()

  if (roomError || !newRoom) return { room: null, error: roomError?.message ?? 'Failed to create room' }

  await admin.from('chat_participants').insert([
    { room_id: newRoom.id, user_id: user.id },
    { room_id: newRoom.id, user_id: otherUserId },
  ])

  const room = await enrichRoom(admin, newRoom as ChatRoom, familyCode)
  return { room }
}

export async function deleteDm(
  roomId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()

  // Hide the room for the deleter
  await admin
    .from('chat_participants')
    .update({ is_hidden: true })
    .eq('room_id', roomId)
    .eq('user_id', user.id)

  // Revoke reply permission for the other participant
  await admin
    .from('chat_participants')
    .update({ can_reply: false })
    .eq('room_id', roomId)
    .neq('user_id', user.id)

  return { success: true }
}

// ── Group room ─────────────────────────────────────────────────────────────────

export async function createGroupRoom(
  name: string,
  memberUserIds: string[]
): Promise<{ room: RoomWithMeta | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { room: null, error: 'Not authenticated' }

  const familyCode = await getMyFamilyCode(user.id)
  const trimmedName = name.trim()
  if (!trimmedName) return { room: null, error: 'Group name is required' }

  const admin = createAdminClient()

  const { data: newRoom, error: roomError } = await admin
    .from('chat_rooms')
    .insert({ kind: 'group', family_code: familyCode, name: trimmedName, created_by: user.id })
    .select('*')
    .single()

  if (roomError || !newRoom) return { room: null, error: roomError?.message ?? 'Failed to create group' }

  const uniqueIds = Array.from(new Set([user.id, ...memberUserIds]))
  await admin.from('chat_participants').insert(
    uniqueIds.map(uid => ({ room_id: newRoom.id, user_id: uid }))
  )

  const room = await enrichRoom(admin, newRoom as ChatRoom, familyCode)
  return { room }
}

export async function addGroupMember(
  roomId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: room } = await admin
    .from('chat_rooms')
    .select('created_by')
    .eq('id', roomId)
    .eq('kind', 'group')
    .single()

  if (!room) return { success: false, error: 'Group not found' }
  if (room.created_by !== user.id) return { success: false, error: 'Only the group creator can add members' }

  const { error } = await admin
    .from('chat_participants')
    .upsert({ room_id: roomId, user_id: userId, is_hidden: false, can_reply: true }, { onConflict: 'room_id,user_id' })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function removeGroupMember(
  roomId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: room } = await admin
    .from('chat_rooms')
    .select('created_by')
    .eq('id', roomId)
    .eq('kind', 'group')
    .single()

  if (!room) return { success: false, error: 'Group not found' }
  if (room.created_by !== user.id) return { success: false, error: 'Only the group creator can remove members' }
  if (userId === user.id) return { success: false, error: 'Cannot remove yourself from the group' }

  await admin
    .from('chat_participants')
    .update({ is_hidden: true, can_reply: false })
    .eq('room_id', roomId)
    .eq('user_id', userId)

  return { success: true }
}

// ── Room list ──────────────────────────────────────────────────────────────────

export async function getRoomList(): Promise<RoomWithMeta[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()

  // Fetch only rooms where the current user is visible (not hidden)
  const { data: participations } = await admin
    .from('chat_participants')
    .select('room_id, can_reply, last_read_at')
    .eq('user_id', user.id)
    .eq('is_hidden', false)

  if (!participations?.length) return []

  const canReplyMap  = new Map(participations.map(p => [p.room_id, p.can_reply as boolean]))
  const lastReadMap  = new Map(participations.map(p => [p.room_id, p.last_read_at as string | null]))
  const roomIds = participations.map(p => p.room_id)

  const { data: rooms } = await admin
    .from('chat_rooms')
    .select('*')
    .in('id', roomIds)

  if (!rooms?.length) return []

  const enriched = await Promise.all(
    (rooms as ChatRoom[]).map(r =>
      enrichRoom(admin, r, familyCode, canReplyMap.get(r.id) ?? true, lastReadMap.get(r.id) ?? null)
    )
  )

  return enriched.sort((a, b) => {
    if (!a.last_message_at && !b.last_message_at) return 0
    if (!a.last_message_at) return 1
    if (!b.last_message_at) return -1
    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  })
}

// ── Messages ───────────────────────────────────────────────────────────────────

export async function getMessages(roomId: string): Promise<ChatMessage[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('chat_messages')
    .select('id, room_id, sender_id, body, created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(200)

  return (data ?? []) as ChatMessage[]
}

export async function getSenderMap(roomId: string): Promise<SenderMap> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()

  const { data: participants } = await admin
    .from('chat_participants')
    .select('user_id')
    .eq('room_id', roomId)

  if (!participants?.length) return {}

  const userIds = participants.map(p => p.user_id)

  const { data: people } = await admin
    .from('people')
    .select('user_id, first_name, last_name')
    .in('user_id', userIds)
    .eq('family_code', familyCode)

  const map: SenderMap = {}
  for (const p of people ?? []) {
    if (p.user_id) map[p.user_id] = { first_name: p.first_name, last_name: p.last_name }
  }
  return map
}

export async function getFamilyMembersWithAccounts(): Promise<
  { userId: string; firstName: string | null; lastName: string | null }[]
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const familyCode = await getMyFamilyCode(user.id)

  const { data } = await supabase
    .from('people')
    .select('user_id, first_name, last_name')
    .eq('family_code', familyCode)
    .not('user_id', 'is', null)
    .neq('user_id', user.id)

  return (data ?? []).map(p => ({
    userId:    p.user_id as string,
    firstName: p.first_name,
    lastName:  p.last_name,
  }))
}

export async function markRoomRead(roomId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()
  await admin
    .from('chat_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('user_id', user.id)
}

export async function sendMessage(
  roomId: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const trimmed = body.trim()
  if (!trimmed || trimmed.length > 4000) return { success: false, error: 'Invalid message' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('chat_messages')
    .insert({ room_id: roomId, sender_id: user.id, body: trimmed })

  if (error) return { success: false, error: error.message }

  // Notify other participants (best-effort)
  try {
    const admin = createAdminClient()
    const [roomResult, senderResult] = await Promise.all([
      admin.from('chat_rooms').select('kind, name, family_code').eq('id', roomId).single(),
      admin.from('people').select('first_name, last_name').eq('user_id', user.id).maybeSingle(),
    ])
    const room = roomResult.data
    const sender = senderResult.data
    if (room && sender) {
      const senderName = [sender.first_name, sender.last_name].filter(Boolean).join(' ') || 'Someone'
      const notifTitle =
        room.kind === 'dm'    ? `New Message From: ${senderName}` :
        room.kind === 'group' ? `${room.name ?? 'Group Chat'} — New Message From: ${senderName}` :
                                `Family Chat — New Message From: ${senderName}`

      const { data: participants } = await admin
        .from('chat_participants')
        .select('user_id')
        .eq('room_id', roomId)
        .eq('is_hidden', false)
        .neq('user_id', user.id)

      if (participants?.length) {
        const otherUserIds = participants.map(p => p.user_id)
        const { data: people } = await admin
          .from('people')
          .select('id, user_id')
          .in('user_id', otherUserIds)
          .eq('family_code', room.family_code)

        if (people?.length) {
          const link = '/chat'
          // Replace any existing unread chat notification for this room per recipient
          for (const person of people) {
            await admin.from('notifications')
              .delete()
              .eq('recipient_id', person.id)
              .eq('link', link)
              .eq('type', 'chat')
              .is('read_at', null)
            await admin.from('notifications').insert({
              family_code: room.family_code,
              recipient_id: person.id,
              type: 'chat',
              title: notifTitle,
              link,
            })
          }
        }
      }
    }
  } catch {
    // Notifications are best-effort; don't fail the send
  }

  return { success: true }
}
