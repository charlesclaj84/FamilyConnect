import { Pin } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { Announcement } from '@/app/actions/announcements'
import { formatDate } from '@/lib/date-utils'

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return formatDate(iso) ?? ''
}

export function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  return (
    <Card className={announcement.pinnedForMe ? 'border-primary/40 bg-primary/5' : ''}>
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-tight">{announcement.title}</h3>
          {announcement.pinnedForMe && <Pin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {announcement.author_name && <span>{announcement.author_name}</span>}
          <span>·</span>
          <span>{formatRelative(announcement.published_at)}</span>
          {announcement.scope !== 'national' && (
            <>
              <span>·</span>
              <span className="capitalize">{announcement.scope}</span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{announcement.body}</p>
      </CardContent>
    </Card>
  )
}
