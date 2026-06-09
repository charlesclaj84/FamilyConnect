'use client'

import { useState } from 'react'
import { Search, Users, Phone, Mail, CheckCircle, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/Avatar'
import { formatPersonName } from '@/lib/name-utils'
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(member => {
            const displayName = [member.prefix, formatPersonName(member)].filter(Boolean).join(' ')
            const initials = [member.first_name[0], member.last_name[0]].filter(Boolean).join('').toUpperCase()
            return (
              <div key={member.id} className="rounded-xl border bg-card p-4 flex items-start gap-3">
                <Avatar url={member.avatar_url} initials={initials} size="sm" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm truncate">{displayName}</p>
                    {member.is_active ? (
                      <span title="Active in Family Connect"><CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" /></span>
                    ) : (
                      <span title="Not yet registered"><XCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" /></span>
                    )}
                  </div>

                  {member.primary_role_title && (
                    <p className="text-xs font-semibold text-primary">{member.primary_role_title}</p>
                  )}

                  {member.chapter_name && (
                    <p className="text-xs text-muted-foreground">{member.chapter_name}</p>
                  )}

                  {member.primary_phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3 shrink-0" />
                      {member.primary_phone}
                    </p>
                  )}

                  {member.primary_email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3 shrink-0" />
                      {member.primary_email}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {filtered.length} of {members.length} member{members.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
