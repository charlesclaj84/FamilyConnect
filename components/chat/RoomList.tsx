import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RoomListItem } from './RoomListItem'
import type { RoomWithMeta } from '@/app/actions/chat'

interface Props {
  rooms: RoomWithMeta[]
  activeRoomId: string
  currentUserId: string
  onSelect: (roomId: string) => void
  onNewDm: () => void
  onNewGroup: () => void
  onDeleteDm: (roomId: string) => void
}

function SectionHeader({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      {action}
    </div>
  )
}

export function RoomList({ rooms, activeRoomId, currentUserId, onSelect, onNewDm, onNewGroup, onDeleteDm }: Props) {
  const familyRoom = rooms.find(r => r.kind === 'family')
  const dmRooms    = rooms.filter(r => r.kind === 'dm')
  const groupRooms = rooms.filter(r => r.kind === 'group')

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-3 border-b shrink-0">
        <h2 className="text-sm font-semibold text-brand-ink">Messages</h2>
        <Button size="sm" onClick={onNewDm} className="h-7 px-2 text-xs gap-1">
          <Plus className="h-3 w-3" /> New DM
        </Button>
      </div>

      <nav className="flex flex-col gap-0.5 p-2 overflow-y-auto flex-1">

        {familyRoom && (
          <RoomListItem
            room={familyRoom}
            currentUserId={currentUserId}
            isActive={activeRoomId === familyRoom.id}
            onClick={() => onSelect(familyRoom.id)}
          />
        )}

        {dmRooms.length > 0 && (
          <>
            <SectionHeader label="Direct Messages" />
            {dmRooms.map(room => (
              <RoomListItem
                key={room.id}
                room={room}
                currentUserId={currentUserId}
                isActive={activeRoomId === room.id}
                onClick={() => onSelect(room.id)}
                onDelete={() => onDeleteDm(room.id)}
              />
            ))}
          </>
        )}

        <SectionHeader
          label="Group Messages"
          action={
            <button
              onClick={onNewGroup}
              className="text-xs text-brand-ink hover:opacity-70 transition-opacity flex items-center gap-0.5"
            >
              <Plus className="h-3 w-3" /> New
            </button>
          }
        />
        {groupRooms.length > 0 ? (
          groupRooms.map(room => (
            <RoomListItem
              key={room.id}
              room={room}
              currentUserId={currentUserId}
              isActive={activeRoomId === room.id}
              onClick={() => onSelect(room.id)}
            />
          ))
        ) : (
          <p className="text-xs text-muted-foreground px-3 py-1">No groups yet.</p>
        )}

      </nav>
    </div>
  )
}
