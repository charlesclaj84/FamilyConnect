'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { RoomList } from './RoomList'
import { MessageThread } from './MessageThread'
import { NewDmDialog } from './NewDmDialog'
import { CreateGroupDialog } from './CreateGroupDialog'
import { useConfirm } from '@/components/ui/confirm'
import { deleteDm, markRoomRead, type RoomWithMeta, type ChatParticipant } from '@/app/actions/chat'
import { createClient } from '@/lib/supabase/client'

interface Props {
  initialRooms: RoomWithMeta[]
  familyRoomId: string
  currentUserId: string
  familyMembers: { userId: string; firstName: string | null; lastName: string | null }[]
  /** The reader's timezone, resolved by the page. Message timestamps are instants. */
  zone: string
}

export function ChatShell({ initialRooms, familyRoomId, currentUserId, familyMembers, zone }: Props) {
  const confirm = useConfirm()
  const [rooms, setRooms]               = useState<RoomWithMeta[]>(initialRooms)
  const [activeRoomId, setActiveRoomId] = useState(familyRoomId)
  const [showThread, setShowThread]     = useState(false)
  const [showNewDm, setShowNewDm]       = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const activeRoomIdRef = useRef(activeRoomId)

  const activeRoom = rooms.find(r => r.id === activeRoomId) ?? rooms[0]

  // Global subscription: mark rooms unread when a new message arrives in a non-active room
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('shell_unread_tracker')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const { room_id, sender_id } = payload.new as { room_id: string; sender_id: string }
          if (room_id !== activeRoomIdRef.current && sender_id !== currentUserId) {
            setRooms(prev => prev.map(r => r.id === room_id ? { ...r, has_unread: true } : r))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [currentUserId])

  function handleSelectRoom(roomId: string) {
    setActiveRoomId(roomId)
    activeRoomIdRef.current = roomId
    setShowThread(true)
    // Clear unread and persist read timestamp
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, has_unread: false } : r))
    markRoomRead(roomId)
  }

  function handleRoomCreated(room: RoomWithMeta) {
    setRooms(prev => prev.some(r => r.id === room.id) ? prev : [room, ...prev])
    handleSelectRoom(room.id)
  }

  /** The thread renders participants from this list, so membership edits land here. */
  function handleParticipantsChange(roomId: string, next: ChatParticipant[]) {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, participants: next } : r))
  }

  async function handleDeleteDm(roomId: string) {
    const room = rooms.find(r => r.id === roomId)
    const other = room?.participants.find(p => p.user_id !== currentUserId)
    const withWhom = other
      ? ([other.first_name, other.last_name].filter(Boolean).join(' ') || 'this family member')
      : 'this family member'
    const ok = await confirm({
      title: 'Delete conversation',
      description: `Delete your conversation with ${withWhom}? The messages are removed and cannot be recovered.`,
      confirmLabel: 'Delete conversation',
      destructive: true,
    })
    if (!ok) return
    await deleteDm(roomId)
    setRooms(prev => prev.filter(r => r.id !== roomId))
    if (activeRoomId === roomId) {
      setActiveRoomId(familyRoomId)
      setShowThread(false)
    }
  }

  return (
    <>
      {/* THE HEIGHT IS THE PAGE'S, NOT THIS COMPONENT'S. This was
          `h-[calc(100vh-4rem)]` — the viewport less the TopBar — which meant the shell
          claimed the whole screen and nothing could be rendered above it without pushing
          the composer off the bottom. `app/(protected)/chat/page.tsx` now owns that
          measurement and puts the page's h1 above this; `min-h-0` is what lets a flex
          child shrink below its content height so the panes scroll instead of the page.

          THE MEASURE IS THE PAGE'S TOO, and the border is what makes this look like one of
          the app's pages rather than a full-bleed app pinned inside one. The page insets
          this to `PAGE_MEASURE`; `rounded-xl border bg-card` is the same treatment every
          section on every other page gets, so the two panes read as a panel on the cream
          instead of as the window's own edges. The room list keeps its `bg-background`,
          which now reads as a tinted list beside a white thread rather than as the page
          ground running underneath both. `overflow-hidden` was already here for the panes
          and is what clips them to the round. */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border bg-card">
        {/* Left panel */}
        <aside className={cn('w-full md:w-64 shrink-0 border-r bg-background flex-col', showThread ? 'hidden md:flex' : 'flex')}>
          <RoomList
            rooms={rooms}
            activeRoomId={activeRoomId}
            currentUserId={currentUserId}
            onSelect={handleSelectRoom}
            onNewDm={() => setShowNewDm(true)}
            onNewGroup={() => setShowNewGroup(true)}
            onDeleteDm={handleDeleteDm}
          />
        </aside>

        {/* Right panel */}
        <main className={cn('flex-1 flex-col min-w-0', showThread ? 'flex' : 'hidden md:flex')}>
          {activeRoom ? (
            <MessageThread
              room={activeRoom}
              currentUserId={currentUserId}
              onBack={() => setShowThread(false)}
              onParticipantsChange={handleParticipantsChange}
              zone={zone}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a conversation to start chatting.
            </div>
          )}
        </main>
      </div>

      <NewDmDialog
        open={showNewDm}
        onClose={() => setShowNewDm(false)}
        familyMembers={familyMembers}
        onRoomCreated={handleRoomCreated}
      />

      <CreateGroupDialog
        open={showNewGroup}
        onClose={() => setShowNewGroup(false)}
        familyMembers={familyMembers}
        onRoomCreated={handleRoomCreated}
      />
    </>
  )
}
