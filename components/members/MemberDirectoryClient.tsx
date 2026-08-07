'use client'

import { useState } from 'react'
import { Search, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/Avatar'
import { formatPersonName } from '@/lib/name-utils'
import { cn } from '@/lib/utils'
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
         * free. It scrolls inside this container rather than widening the page — six
         * columns do not fit a phone, and the alternative is maintaining a second
         * stacked rendering of every row.
         */
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-semibold">Name</th>
                <th scope="col" className="px-3 py-2 font-semibold">Phone</th>
                <th scope="col" className="px-3 py-2 font-semibold">Email</th>
                <th scope="col" className="px-3 py-2 font-semibold">City, State</th>
                <th scope="col" className="px-3 py-2 font-semibold">Group</th>
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
                              <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
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
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {member.primary_phone ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{member.primary_email ?? '—'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{member.location ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      {member.group_name
                        ? (
                          <span className="inline-block whitespace-nowrap rounded-full bg-[#e6ecfa] px-2.5 py-1 text-xs font-medium text-[#0f2540]">
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
