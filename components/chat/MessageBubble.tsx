import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/date-utils'
import { timeIn } from '@/lib/tz'
import type { ChatMessage } from '@/app/actions/chat'

interface Props {
  message: ChatMessage
  senderName: string
  isOwn: boolean
  /**
   * The reader's timezone, resolved by the page.
   *
   * `created_at` is an INSTANT. This used to be
   * `new Date(message.created_at).toLocaleTimeString('en-US', …)`, which reads whichever
   * zone the RUNTIME is in — the browser's here, UTC if this ever renders on the server —
   * so the same message could carry two different times depending on which side drew it.
   * It also pinned `en-US`, which is a locale decision made in a component.
   */
  zone: string
}

export function MessageBubble({ message, senderName, isOwn, zone }: Props) {
  // The app's one time voice (`formatTime`) over the instant resolved into the reader's
  // zone — so a message reads the same whoever renders it. See lib/tz.ts.
  const time = formatTime(timeIn(message.created_at, zone)) ?? ''

  return (
    <div className={cn('flex flex-col gap-0.5 max-w-[75%]', isOwn ? 'self-end items-end' : 'self-start items-start')}>
      {!isOwn && (
        <span className="text-xs text-muted-foreground px-1">{senderName}</span>
      )}
      <div
        className={cn(
          'rounded-2xl px-4 py-2 text-sm break-words',
          isOwn
            ? 'bg-brand-primary text-brand-on-primary rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm',
        )}
      >
        {message.body}
      </div>
      <span className="text-xs text-muted-foreground px-1">{time}</span>
    </div>
  )
}
