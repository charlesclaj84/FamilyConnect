'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { RoomList } from './RoomList'
import { MessageThread } from './MessageThread'
import { NewDmDialog } from './NewDmDialog'
import { CreateGroupDialog } from './CreateGroupDialog'
import { deleteDm, markRoomRead, type RoomWithMeta } from '@/app/actions/chat'
import { createClient } from '@/lib/supabase/client'

interface Props {
  initialRooms: RoomWithMeta[]
  familyRoomId: string
  currentUserId: string
  familyMembers: { userId: string; firstName: string | null; lastName: string | null }[]
}

export function ChatShell({ initialRooms, familyRoomId, currentUserId, familyMembers }: Props) {
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

  async function handleDeleteDm(roomId: string) {
    await deleteDm(roomId)
    setRooms(prev => prev.filter(r => r.id !== roomId))
    if (activeRoomId === roomId) {
      setActiveRoomId(familyRoomId)
      setShowThread(false)
    }
  }

  return (
    <>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
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
