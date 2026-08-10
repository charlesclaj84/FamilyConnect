import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import {
  getOrCreateFamilyRoom,
  getRoomList,
  getFamilyMembersWithAccounts,
} from '@/app/actions/chat'
import { ChatShell } from '@/components/chat/ChatShell'

export const metadata = { title: 'Chat' }

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'chat')

  const [{ room: familyRoom, error: chatError }, rooms, familyMembers] = await Promise.all([
    getOrCreateFamilyRoom(),
    getRoomList(),
    getFamilyMembersWithAccounts(),
  ])

  if (!familyRoom) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-2">
        <p className="text-sm font-medium text-destructive">Unable to load chat</p>
        {chatError && (
          <p className="text-xs text-muted-foreground font-mono bg-muted rounded px-3 py-2 text-left">
            {chatError}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Make sure the chat migration has been applied in your Supabase project.
        </p>
      </div>
    )
  }

  return (
    <ChatShell
      initialRooms={rooms}
      familyRoomId={familyRoom.id}
      currentUserId={user.id}
      familyMembers={familyMembers}
    />
  )
}
