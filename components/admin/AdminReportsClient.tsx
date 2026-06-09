'use client'

import { DollarSign, Users, Calendar, TrendingUp, ShirtIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OrgStats } from '@/app/actions/admin/reports'

function formatDollars(cents: number) { return `$${(cents / 100).toFixed(2)}` }

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
    </div>
  )
}
