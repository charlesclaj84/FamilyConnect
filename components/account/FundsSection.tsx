'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Target, Award } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FundWithStats } from '@/app/actions/funds'

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}` }

interface Props {
  funds: FundWithStats[]
  isAdmin: boolean
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
            const pct = fund.goal_cents
              ? Math.min(100, Math.round((fund.total_disbursed_cents / fund.goal_cents) * 100))
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
                    <p className="text-sm font-medium">{fund.name}</p>
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
                    <p className="font-medium text-sm text-foreground">{fmt(fund.total_disbursed_cents)}</p>
                    {fund.goal_cents && <p>of {fmt(fund.goal_cents)} goal</p>}
                    <p>{fund.milestone_count} milestone{fund.milestone_count !== 1 ? 's' : ''}</p>
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                </button>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
