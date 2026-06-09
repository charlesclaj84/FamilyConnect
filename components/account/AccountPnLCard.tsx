import { TrendingUp, TrendingDown, Scale, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PnLData } from '@/app/actions/dues'

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}` }

interface Props {
  data: PnLData
}

export function AccountPnLCard({ data }: Props) {
  const net = data.totalIncomeCents - data.totalExpenseCents
  const isPositive = net >= 0

  return (
    <div className="space-y-5">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Income */}
        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-full bg-green-100">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Total Income</span>
          </div>
          <p className="text-3xl font-bold">{fmt(data.totalIncomeCents)}</p>
          <p className="text-xs text-muted-foreground">
            {data.payments.length === 0
              ? 'No dues collected'
              : `${data.payments.length} payment${data.payments.length !== 1 ? 's' : ''} collected`}
          </p>
        </div>

        {/* Total Expenses */}
        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-full bg-rose-100">
              <TrendingDown className="h-4 w-4 text-rose-600" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Total Expenses</span>
          </div>
          <p className="text-3xl font-bold">{fmt(data.totalExpenseCents)}</p>
          <p className="text-xs text-muted-foreground">
            {data.eventBudgets.length === 0
              ? 'No event budgets set'
              : `${data.eventBudgets.length} event budget${data.eventBudgets.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Net Balance */}
        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-full ${isPositive ? 'bg-green-100' : 'bg-rose-100'}`}>
              <Scale className={`h-4 w-4 ${isPositive ? 'text-green-600' : 'text-rose-600'}`} />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Net Balance</span>
          </div>
          <p className={`text-3xl font-bold ${isPositive ? 'text-green-600' : 'text-rose-600'}`}>
            {isPositive ? '+' : ''}{fmt(net)}
          </p>
          <p className="text-xs text-muted-foreground">
            {isPositive ? 'Running a surplus' : 'Running a deficit'}
          </p>
        </div>
      </div>

      {/* ── Detail breakdowns ── */}
      {(data.payments.length > 0 || data.eventBudgets.length > 0) && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base flex items-center gap-2">
              <ChevronDown className="h-4 w-4 text-muted-foreground" /> Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.payments.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium text-green-700 hover:text-green-800 py-1">
                  Income — {fmt(data.totalIncomeCents)} ({data.payments.length} payment{data.payments.length !== 1 ? 's' : ''})
                </summary>
                <ul className="mt-1 space-y-0.5 max-h-48 overflow-y-auto pl-1">
                  {data.payments.map(p => (
                    <li key={p.id} className="flex justify-between text-muted-foreground px-1 py-0.5">
                      <span>{p.person_name ?? 'Unknown'} · {p.schedule_label ?? 'Misc'} · {p.payment_date}</span>
                      <span className="text-green-600 ml-4 shrink-0">{fmt(p.amount_cents)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {data.eventBudgets.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium text-rose-700 hover:text-rose-800 py-1">
                  Expenses — {fmt(data.totalExpenseCents)} ({data.eventBudgets.length} event{data.eventBudgets.length !== 1 ? 's' : ''})
                </summary>
                <ul className="mt-1 space-y-0.5 pl-1">
                  {data.eventBudgets.map(e => (
                    <li key={e.id} className="flex justify-between text-muted-foreground px-1 py-0.5">
                      <span>{e.name}</span>
                      <span className="text-rose-600 ml-4 shrink-0">{fmt(e.budget_amount_cents)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
