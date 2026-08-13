'use client'

import { useState } from 'react'
import { Search, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/Avatar'
import { formatPersonName } from '@/lib/name-utils'
import { cn } from '@/lib/utils'
import { COLLAPSING_CELL, RowMeta, MetaIf } from '@/components/ui/table-collapse'
import type { MemberRecord } from '@/app/actions/members'

interface Props {
  members: MemberRecord[]
}

export function MemberDirectoryClient({ members }: Props) {
  const [query, setQuery] = useState('')
  const [chapterFilter, setChapterFilter] = useState('')

  const chapters = [...new Set(members.map(m => m.chapter_name).filter(Boolean))] as string[]

  const filtered = members.filter(m => {
    const fullName = `${m.prefix ?? ''} ${m.first_name} ${m.last_name} ${m.nick_name ?? ''}`.toLowerCase()
    const matchesQuery = !query || fullName.includes(query.toLowerCase())
    const matchesChapter = !chapterFilter || m.chapter_name === chapterFilter
    return matchesQuery && matchesChapter
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        {chapters.length > 0 && (
          <select
            aria-label="Filter by chapter"
            value={chapterFilter}
            onChange={e => setChapterFilter(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-sm"
          >
            <option value="">All Chapters</option>
            {chapters.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="mx-auto h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No members match your search.</p>
        </div>
      ) : (
        /*
         * A real <table>, one row per member, matching the Members table on Members &
         * Access column for column — the two lists answer the same question about the
         * same people, and reading one should not require relearning the other.
         *
         * It replaced a three-column card grid. The cards stacked six labelled facts
         * vertically inside each tile, so comparing two members' phone numbers meant
         * hunting for the same line in two different places; a column does that for
         * free.
         *
         * BELOW `sm` THE COLUMNS FOLD RATHER THAN SCROLL. This was a `min-w-[52rem]`
         * table in an `overflow-x-auto` box, which on a 390px screen meant two thirds of
         * every member was off to the right behind a sideways drag — and the heading row
         * slid away with the columns it named, so what you dragged to was unlabelled.
         * Phone, Email, City/State and Group are `hidden sm:table-cell` now and restated
         * under the name, which is the same contact block the card grid had, without
         * giving up the columns on a screen wide enough to line them up. The four
         * `<th>`s go with their cells, so the mobile table is one column with one
         * heading rather than five headings over one.
         */
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-semibold">Name</th>
                <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Phone</th>
                <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Email</th>
                <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>City, State</th>
                <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Group</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(member => {
                const displayName = [member.prefix, formatPersonName(member)].filter(Boolean).join(' ')
                const initials = [member.first_name[0], member.last_name[0]].filter(Boolean).join('').toUpperCase()
                return (
                  <tr key={member.id} className="border-b last:border-0 align-middle">
                    {/* The avatar, the Minor badge and the role stay ON the name: each
                        qualifies who this person is, and none of them is a column of its
                        own — a Role column would be empty for almost every family. */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar url={member.avatar_url} initials={initials} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('font-medium', !member.is_active && 'text-muted-foreground')}>
                              {displayName}
                            </span>
                            {member.is_minor && (
                              <span className="shrink-0 rounded-full bg-brand-warm px-1.5 py-0.5 text-[10px] font-medium text-brand-on-warm">
                                Minor
                              </span>
                            )}
                          </div>
                          {member.primary_role_title && (
                            <p className="text-xs font-semibold text-primary">{member.primary_role_title}</p>
                          )}
                          {/* Was a tick or a cross with a title attribute — invisible to
                              anyone not hovering, and a bare icon in a table column reads
                              as decoration. Said in words, and only when it is true. */}
                          {!member.is_active && (
                            <p className="text-xs text-muted-foreground">Not yet registered</p>
                          )}
                          {/* The folded columns, below sm only. A contact block reads
                              down rather than across, so this one stacks — `RowMeta`'s
                              default inline run is for two or three short values. */}
                          <RowMeta className="flex-col items-start gap-y-0.5">
                            <MetaIf value={member.primary_phone} />
                            {member.primary_email && (
                              <span className="break-all">{member.primary_email}</span>
                            )}
                            <MetaIf value={member.location} />
                            {member.group_name && (
                              <span className="mt-0.5 inline-block whitespace-nowrap rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-on-soft">
                                {member.group_name}
                              </span>
                            )}
                          </RowMeta>
                        </div>
                      </div>
                    </td>
                    <td className={cn('px-3 py-2.5 text-muted-foreground whitespace-nowrap', COLLAPSING_CELL)}>
                      {member.primary_phone ?? '—'}
                    </td>
                    <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>{member.primary_email ?? '—'}</td>
                    <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>{member.location ?? '—'}</td>
                    <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>
                      {member.group_name
                        ? (
                          <span className="inline-block whitespace-nowrap rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-on-soft">
                            {member.group_name}
                          </span>
                        )
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {filtered.length} of {members.length} member{members.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
