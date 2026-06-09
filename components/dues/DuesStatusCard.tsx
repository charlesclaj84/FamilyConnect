import Link from 'next/link'
import { DollarSign, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import type { DuesSummary } from '@/app/actions/dues'

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

interface Props {
  summary: DuesSummary[]
  showViewLink?: boolean
}

export function DuesStatusCard({ summary, showViewLink = true }: Props) {
  if (summary.length === 0) {
    return (
      <Card className="max-w-sm w-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <DollarSign className="h-4 w-4" />
            </div>
            Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No dues schedules configured.</p>
        </CardContent>
      </Card>
    )
  }

  const unpaid = summary.filter(s => !s.paid)
  const totalDueCents = unpaid.reduce((sum, s) => sum + s.schedule.amount_cents, 0)

  return (
    <Card className="max-w-sm w-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
          <div className={`p-1.5 rounded-md ${unpaid.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
            <DollarSign className="h-4 w-4" />
          </div>
          Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {unpaid.length === 0 ? (
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">All dues paid — thank you!</span>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-semibold">{formatDollars(totalDueCents)}</span>
              <span className="text-sm text-muted-foreground mb-0.5">outstanding</span>
            </div>
            <ul className="space-y-1">
              {unpaid.map(s => (
                <li key={s.schedule.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                  {s.schedule.label} — {formatDollars(s.schedule.amount_cents)}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {summary.length} schedule{summary.length !== 1 ? 's' : ''}
        </div>
        {showViewLink && (
          <Link href="/account-summary" className={buttonVariants({ size: 'sm', variant: 'outline' }) + ' w-full justify-center'}>
            View Account
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
