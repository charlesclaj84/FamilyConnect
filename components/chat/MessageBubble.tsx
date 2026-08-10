import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/app/actions/chat'

interface Props {
  message: ChatMessage
  senderName: string
  isOwn: boolean
}

export function MessageBubble({ message, senderName, isOwn }: Props) {
  const time = new Date(message.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={cn('flex flex-col gap-0.5 max-w-[75%]', isOwn ? 'self-end items-end' : 'self-start items-start')}>
      {!isOwn && (
        <span className="text-xs text-muted-foreground px-1">{senderName}</span>
      )}
      <div
        className={cn(
          'rounded-2xl px-4 py-2 text-sm break-words',
          isOwn
            ? 'bg-brand-navy text-brand-tint rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm',
        )}
      >
        {message.body}
      </div>
      <span className="text-xs text-muted-foreground px-1">{time}</span>
    </div>
  )
}
