'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Target, Award, HeartHandshake, Check } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { contributeToFund, type FundWithStats } from '@/app/actions/funds'
import { formatCurrency as fmt, dollarsToCents } from '@/lib/currency-utils'

// Member "open contributions" feature is hidden for now; flip to re-enable.
const SHOW_OPEN_CONTRIBUTIONS = false

interface Props {
  funds: FundWithStats[]
  isAdmin: boolean
}

function pctLabel(bps: number) {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`
}

export function FundsSection({ funds, isAdmin }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (funds.length === 0 && !isAdmin) return null

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-4 w-4 text-primary" />
          Family Funds
        </CardTitle>
        {isAdmin && (
          <Link href="/admin/account#funds" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            Manage Funds
          </Link>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {funds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No funds set up yet.</p>
        ) : (
          funds.map(fund => {
            // Status bar = money currently IN the fund (balance) toward its target
            // (the goal if set, otherwise the minimum balance).
            const target = fund.goal_cents ?? (fund.minimum_cents > 0 ? fund.minimum_cents : null)
            const pct = target
              ? Math.max(0, Math.min(100, Math.round((fund.balance_cents / target) * 100)))
              : null
            const isOpen = expanded === fund.id
            return (
              <div key={fund.id} className="rounded-lg border overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : fund.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                >
                  <Target className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{fund.name}</p>
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{pctLabel(fund.allocation_bps)} of dues</span>
                      {SHOW_OPEN_CONTRIBUTIONS && fund.open_contributions && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Open</span>}
                    </div>
                    {fund.description && (
                      <p className="text-xs text-muted-foreground truncate">{fund.description}</p>
                    )}
                    {pct !== null && (
                      <div className="mt-1 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 text-xs text-muted-foreground">
                    <p className="font-medium text-sm text-foreground">{fmt(fund.balance_cents)}</p>
                    <p>balance</p>
                    {target && <p>of {fmt(target)} {fund.goal_cents ? 'goal' : 'minimum'}</p>}
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="border-t bg-muted/20 px-3 py-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Receives {pctLabel(fund.allocation_bps)} of routed dues.
                      {fund.minimum_cents > 0 && ` Minimum balance ${fmt(fund.minimum_cents)}.`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Contributed {fmt(fund.total_contributed_cents)} · Disbursed {fmt(fund.total_disbursed_cents)} · Balance {fmt(fund.balance_cents)}
                    </p>
                    {SHOW_OPEN_CONTRIBUTIONS && fund.open_contributions && <ContributeForm fundId={fund.id} fundName={fund.name} />}
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

function ContributeForm({ fundId, fundName }: { fundId: string; fundName: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [msg, setMsg] = useState('')

  function submit() {
    const cents = dollarsToCents(amount)
    if (cents <= 0) { setMsg('Enter an amount greater than $0.'); return }
    setMsg('')
    startTransition(async () => {
      const res = await contributeToFund({ fund_id: fundId, amount_cents: cents, notes: notes.trim() || null })
      if (!res.success) { setMsg(res.message ?? 'Could not contribute'); return }
      setAmount(''); setNotes(''); setMsg(`Thank you! Contributed to ${fundName}.`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium flex items-center gap-1.5"><HeartHandshake className="h-3.5 w-3.5 text-emerald-600" /> Contribute to this fund</p>
      <div className="flex flex-wrap items-end gap-2">
        <Input
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="25.00"
          inputMode="decimal"
          className="h-8 w-28"
        />
        <Input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Note (optional)"
          className="h-8 w-44"
        />
        <Button size="sm" disabled={isPending} onClick={submit}>
          <Check className="h-3.5 w-3.5" /> {isPending ? 'Sending…' : 'Contribute'}
        </Button>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  )
}
