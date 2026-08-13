'use client'

import { DollarSign, Users, Calendar, TrendingUp, ShirtIcon, Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { COLLAPSING_CELL, RowMeta, MetaDot } from '@/components/ui/table-collapse'
import { cn } from '@/lib/utils'
import type { OrgStats } from '@/app/actions/admin/reports'
import { formatCurrency as formatDollars } from '@/lib/currency-utils'
import { formatDateNumeric } from '@/lib/date-utils'

interface Props {
  stats: OrgStats
}

export function AdminReportsClient({ stats }: Props) {
  return (
    <div className="space-y-8">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalMembers}</p>
            <p className="text-xs text-muted-foreground">+ {stats.totalMinors} minors</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalEvents}</p>
            <p className="text-xs text-muted-foreground">{stats.upcomingEvents} upcoming</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> RSVP Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {stats.avgRsvpRate !== null ? `${stats.avgRsvpRate}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">events with responses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" /> Dues Collected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatDollars(stats.duesCollectedCents)}</p>
            <p className="text-xs text-muted-foreground">{formatDollars(stats.duesOutstandingCents)} pending</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Members by Chapter */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Members by Chapter</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.membersByChapter.length === 0 ? (
              <p className="text-sm text-muted-foreground">No chapter data yet.</p>
            ) : (
              <ul className="space-y-2">
                {stats.membersByChapter.map(c => {
                  const pct = stats.totalMembers > 0 ? Math.round((c.count / stats.totalMembers) * 100) : 0
                  return (
                    <li key={c.chapter_name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="truncate">{c.chapter_name}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">{c.count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* T-Shirt Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-1.5">
              <ShirtIcon className="h-4 w-4" /> T-Shirt Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.tshirtBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No RSVP data yet.</p>
            ) : (
              <ul className="divide-y">
                {stats.tshirtBreakdown.map((row, i) => (
                  <li key={i} className="flex items-center justify-between py-1.5 text-sm">
                    <span>{row.category} — {row.size}</span>
                    <span className="font-medium">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Financial Activity — who recorded each money entry */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Receipt className="h-4 w-4" /> Recent Financial Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No financial activity recorded yet.</p>
          ) : (
            /* TYPE leads below `sm`, not Date. The columns fold left-to-right in
                importance, and what this table answers is "what happened, for how much"
                — the date and who keyed it in are how you audit an entry once you have
                found it. So Type becomes the row's subject and Date joins Recorded by
                on the meta line. See components/ui/table-collapse.tsx. */
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className={cn('py-2 pr-3 text-left text-xs font-medium text-muted-foreground', COLLAPSING_CELL)}>Date</th>
                    <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                    <th className="py-2 pr-3 text-right text-xs font-medium text-muted-foreground">Amount</th>
                    <th className={cn('py-2 text-left text-xs font-medium text-muted-foreground', COLLAPSING_CELL)}>Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentActivity.map(a => (
                    <tr key={a.id} className="border-b align-top last:border-0 sm:align-middle">
                      <td className={cn('py-2 pr-3 whitespace-nowrap text-muted-foreground text-xs', COLLAPSING_CELL)}>{formatDateNumeric(a.date)}</td>
                      <td className="py-2 pr-3">
                        {a.type}
                        <RowMeta>
                          <span>{formatDateNumeric(a.date)}</span>
                          {a.recordedBy && <><MetaDot /><span>{a.recordedBy}</span></>}
                        </RowMeta>
                      </td>
                      <td className={`py-2 pr-3 text-right font-medium whitespace-nowrap ${a.amountCents < 0 ? 'text-destructive' : 'text-brand-affirm'}`}>
                        {a.amountCents < 0 ? '−' : ''}{formatDollars(Math.abs(a.amountCents))}
                      </td>
                      <td className={cn('py-2 text-muted-foreground', COLLAPSING_CELL)}>{a.recordedBy ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
