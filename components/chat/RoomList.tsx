'use client'

// ── IT IS A CLIENT COMPONENT AND ALWAYS WAS. The directive was missing until 2026-08-29.
// Every prop below that starts with `on` is a FUNCTION, so this can only ever be rendered by
// another client component — `ChatShell`, its one caller, is `'use client'`. So it was already
// compiled into the browser bundle and `useT()` worked; what it lacked was the line SAYING so,
// which is what would stop a Server Component importing it one day and crashing. Unlike the
// seven dual-use cards fixed the same day, there is nothing here to keep off the client.
// `npm run audit:client-hooks` is the gate.

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RoomListItem } from './RoomListItem'
import type { RoomWithMeta } from '@/app/actions/chat'
import { useT } from '@/components/layout/LocaleProvider'

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
  const t = useT()
  const familyRoom = rooms.find(r => r.kind === 'family')
  const dmRooms    = rooms.filter(r => r.kind === 'dm')
  const groupRooms = rooms.filter(r => r.kind === 'group')

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-3 border-b shrink-0">
        <h2 className="text-sm font-semibold text-brand-ink">{t('chat.messages')}</h2>
        <Button size="sm" onClick={onNewDm} className="h-7 px-2 text-xs gap-1">
          <Plus className="h-3 w-3" /> {t('chat.newDm')}
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
            <SectionHeader label={t('chat.directMessages')} />
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
          label={t('chat.groupMessages')}
          action={
            <button
              onClick={onNewGroup}
              className="text-xs text-brand-ink hover:opacity-70 transition-opacity flex items-center gap-0.5"
            >
              <Plus className="h-3 w-3" /> {t('chat.new')}
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
          <p className="text-xs text-muted-foreground px-3 py-1">{t('chat.noGroups')}</p>
        )}

      </nav>
    </div>
  )
}
