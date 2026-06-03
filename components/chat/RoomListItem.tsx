import { MessageCircle, Users, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RoomWithMeta } from '@/app/actions/chat'

interface Props {
  room: RoomWithMeta
  currentUserId: string
  isActive: boolean
  onClick: () => void
  onDelete?: () => void
}

export function RoomListItem({ room, currentUserId, isActive, onClick, onDelete }: Props) {
  const label =
    room.kind === 'family'
      ? 'Family Chat'
      : room.kind === 'group'
      ? (room.name ?? 'Group')
      : (() => {
          const other = room.participants.find(p => p.user_id !== currentUserId)
          if (!other) return 'Direct Message'
          return [other.first_name, other.last_name].filter(Boolean).join(' ') || 'Family Member'
        })()

  return (
    <div className="group/item flex items-center gap-1">
      <button
        onClick={onClick}
        className={cn(
          'flex-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-colors min-w-0',
          isActive
            ? 'bg-[#0f2540] text-[#e6ecf1] font-medium'
            : 'text-[#0f2540] hover:bg-[#0f2540]/10',
        )}
      >
        {room.kind === 'family'
          ? <Users className="h-4 w-4 shrink-0 opacity-70" />
          : room.kind === 'group'
          ? <Users className="h-4 w-4 shrink-0 opacity-70" />
          : <MessageCircle className="h-4 w-4 shrink-0 opacity-70" />
        }
        <span className="truncate flex-1">{label}</span>
        {!room.can_reply && room.kind === 'dm' && (
          <span className="text-xs opacity-60 shrink-0">ended</span>
        )}
        {room.has_unread && (
          <span className="h-2 w-2 rounded-full bg-[#1aa88a] shrink-0" aria-label="Unread messages" />
        )}
      </button>

      {room.kind === 'dm' && onDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover/item:opacity-100 p-1.5 rounded text-muted-foreground hover:text-destructive transition-all shrink-0"
          title="Delete conversation"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
