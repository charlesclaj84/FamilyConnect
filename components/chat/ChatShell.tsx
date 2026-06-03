'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { RoomList } from './RoomList'
import { MessageThread } from './MessageThread'
import { NewDmDialog } from './NewDmDialog'
import { CreateGroupDialog } from './CreateGroupDialog'
import { deleteDm, type RoomWithMeta } from '@/app/actions/chat'

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

  const activeRoom = rooms.find(r => r.id === activeRoomId) ?? rooms[0]

  function handleSelectRoom(roomId: string) {
    setActiveRoomId(roomId)
    setShowThread(true)
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
