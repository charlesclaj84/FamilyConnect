import Link from 'next/link'
import { DollarSign, CheckCircle, AlertCircle, Clock, HeartHandshake } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { formatCurrency } from '@/lib/currency-utils'
import { isOutstanding } from '@/lib/dues-utils'
import { type DuesSummary } from '@/app/actions/dues'

interface Props {
  summary: DuesSummary[]
  showViewLink?: boolean
}

/**
 * The dashboard's one money card.
 *
 * STILL ONE KPI. The headline figure is what the member is REQUIRED to pay and has not —
 * that is the number with a consequence attached, and splitting the card in two would
 * have given equal weight to a figure they are free to ignore. Optional dues are shown
 * underneath as a separate, quieter line, so "you owe $50" can never silently include
 * $200 of things nobody is asking them for.
 *
 * Opted-out dues appear nowhere. `isOutstanding` excludes them: a member who has declined
 * an optional due is not carrying a balance on it, and listing it as "optional, unpaid"
 * would re-ask a question they have already answered.
 */
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

  const outstanding = summary.filter(isOutstanding)
  const requiredDue = outstanding.filter(s => s.required)
  const optionalDue = outstanding.filter(s => !s.required)
  const requiredCents = requiredDue.reduce((sum, s) => sum + s.remainingBalanceCents, 0)
  const optionalCents = optionalDue.reduce((sum, s) => sum + s.remainingBalanceCents, 0)
  const declinedCount = summary.filter(s => s.optedOut).length

  return (
    <Card className="max-w-sm w-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
          {/* Amber only for REQUIRED money outstanding. An optional due left unpaid is not
              a problem the member needs flagging, and colouring the card for it would
              make the signal meaningless. */}
          <div className={`p-1.5 rounded-md ${requiredCents > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
            <DollarSign className="h-4 w-4" />
          </div>
          Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requiredCents === 0 ? (
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {/* "Required dues", not "All dues": with an optional due outstanding below,
                  a bare "all dues paid" would contradict the very next line. */}
              {optionalCents > 0 ? 'Required dues all paid' : 'All dues paid — thank you!'}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-semibold">{formatCurrency(requiredCents)}</span>
              <span className="text-sm text-muted-foreground mb-0.5">required</span>
            </div>
            <ul className="space-y-1">
              {requiredDue.map(s => (
                <li key={s.schedule.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                  {s.schedule.label} — {formatCurrency(s.installmentCents)}/{s.cadence}
                </li>
              ))}
            </ul>
          </>
        )}

        {/* The optional half. Present only when there is something in it.
            The word "optional" carries it — the explanatory clause that used to follow
            ("yours to give or decline") is gone. It restated the definition of the word
            in front of it, and My Summary is where the choice is actually made.
            Each line gets its own icon, exactly as the required lines above do: without
            one the two lists were indented differently and read as different kinds of
            thing. HeartHandshake rather than the required AlertCircle — same slot, same
            size, and the app's established glyph for money given rather than owed. */}
        {optionalCents > 0 && (
          <div className="rounded-lg bg-muted/50 px-2.5 py-2 space-y-1">
            <p className="text-xs">
              <span className="font-medium">{formatCurrency(optionalCents)}</span>
              <span className="text-muted-foreground"> optional</span>
            </p>
            <ul className="space-y-0.5">
              {optionalDue.map(s => (
                <li key={s.schedule.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <HeartHandshake className="h-3 w-3 shrink-0 text-muted-foreground" />
                  {s.schedule.label} — {formatCurrency(s.installmentCents)}/{s.cadence}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {summary.length} schedule{summary.length !== 1 ? 's' : ''}
          {declinedCount > 0 && ` · ${declinedCount} declined`}
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
