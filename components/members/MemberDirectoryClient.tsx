'use client'

import { useState } from 'react'
import { Search, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/Avatar'
import { NickName } from '@/components/ui/person-name'
import { cn } from '@/lib/utils'
import { COLLAPSING_CELL, RowMeta, MetaIf } from '@/components/ui/table-collapse'
import type { MemberRecord } from '@/app/actions/members'
import {
  MemberDetailsDialog, MemberDetailsTrigger, regionLabel,
  type MemberDetails,
} from '@/components/members/MemberDetailsDialog'

interface Props {
  members: MemberRecord[]
}

/**
 * The Member Directory.
 *
 * ── FOUR COLUMNS, AND THREE OF THE OLD SIX ARE NOW A DIALOG ─────────────────────────
 * Name · Region · Chapter · Group, since 2026-08-19. Phone, Email and City/State left the
 * table and moved into `MemberDetailsDialog`, which the name cell opens.
 *
 * The reason is what a COLUMN is for. A column exists so a fact can be compared down a
 * list of a hundred and forty people; a dialog exists so every fact about one of them can
 * be read at once. Nobody has ever scanned this table comparing phone numbers — they scan
 * it looking for one person and then want that person's number — whereas *which region and
 * chapter is this member in* is precisely a down-the-column question, and since
 * 20260817000008 it is the question that decides who owes a regional or chapter due. So
 * the two facts people compare are columns and the three they look up are one click away.
 *
 * NOTHING WAS REMOVED FROM THE PRODUCT and nothing was re-gated. The action fetches
 * exactly what it fetched before, under the same `members:view` grant; only where the
 * values are drawn changed. See the dialog's header for the §5 argument.
 *
 * ── IT STILL MATCHES MEMBERS & ACCESS COLUMN FOR COLUMN ─────────────────────────────
 * Which is the rule AGENTS.md's "A table is a table" states, and the rule is why both
 * tables changed in one commit rather than one of them: the two lists answer the same
 * question about the same people, so reading one must not require relearning the other.
 * Members & Access adds a row menu on the end because it can act on a row; that is the
 * only difference, and it was the only difference before.
 */
export function MemberDirectoryClient({ members }: Props) {
  const [query, setQuery] = useState('')
  const [chapterFilter, setChapterFilter] = useState('')
  /**
   * Which member's dialog is open, held as an ID rather than as the row.
   *
   * The row is looked up from `members` on every render, so a refreshed server payload is
   * what the open dialog shows — holding the object would pin a member's phone number to
   * whatever it was when the dialog opened. It also means a member who has left the list
   * closes the dialog rather than freezing a copy of a row that no longer exists.
   *
   * Plain `useState` and not `useServerState`: this is which dialog is open, which is
   * UI-local state in the sense AGENTS.md draws the line — it did not come from a
   * family-scoped prop and nothing is written back to one. The switch-family remount is
   * handled one level up, by the `key={familyCode}` on the protected layout's `<main>`.
   */
  const [viewingId, setViewingId] = useState<string | null>(null)

  const chapters = [...new Set(members.map(m => m.chapter_name).filter(Boolean))] as string[]

  const filtered = members.filter(m => {
    const fullName = `${m.prefix ?? ''} ${m.first_name} ${m.last_name} ${m.nick_name ?? ''}`.toLowerCase()
    const matchesQuery = !query || fullName.includes(query.toLowerCase())
    const matchesChapter = !chapterFilter || m.chapter_name === chapterFilter
    return matchesQuery && matchesChapter
  })

  const viewed = members.find(m => m.id === viewingId) ?? null

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
         * free. That argument then chose its own successor: the facts worth comparing
         * are the ones that stayed, and the three that were only ever looked up one at
         * a time are in the row's dialog now.
         *
         * BELOW `sm` THE COLUMNS FOLD RATHER THAN SCROLL. This was a `min-w-[52rem]`
         * table in an `overflow-x-auto` box, which on a 390px screen meant two thirds of
         * every member was off to the right behind a sideways drag — and the heading row
         * slid away with the columns it named, so what you dragged to was unlabelled.
         * Region, Chapter and Group are `hidden sm:table-cell` and restated under the
         * name, and each `<th>` goes with its cells: hide three cells and leave four
         * headings and every remaining cell is announced under the wrong column.
         */
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-semibold">Name</th>
                <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Region</th>
                <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Chapter</th>
                <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Group</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(member => {
                // `first_name last_name`, NOT formatPersonName — that appends "(Nick)",
                // and the nickname is printed on its own line below by <NickName>.
                const displayName = [member.prefix, member.first_name, member.last_name]
                  .filter(Boolean).join(' ')
                const initials = [member.first_name[0], member.last_name[0]].filter(Boolean).join('').toUpperCase()
                return (
                  <tr key={member.id} className="border-b last:border-0 align-top sm:align-middle">
                    {/* The avatar, the Minor badge and the role stay ON the name: each
                        qualifies who this person is, and none of them is a column of its
                        own — a Role column would be empty for almost every family. */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar url={member.avatar_url} initials={initials} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {/* THE NAME IS THE BUTTON, and it is the only way into the
                                dialog — the `<tr>` carries no click handler. A row that is
                                only clickable is unreachable by keyboard, and a screen
                                reader announces this one as the person's name because the
                                person's name is the button's text. */}
                            <MemberDetailsTrigger
                              name={displayName}
                              onOpen={() => setViewingId(member.id)}
                              className={cn(!member.is_active && 'text-muted-foreground')}
                            />
                            {member.is_minor && (
                              <span className="shrink-0 rounded-full bg-brand-warm px-1.5 py-0.5 text-[10px] font-medium text-brand-on-warm">
                                Minor
                              </span>
                            )}
                          </div>
                          {/* Under the name, not beside it — same treatment as the tree's
                              cards, so the two screens that list the same people print
                              them the same way. */}
                          <NickName nickName={member.nick_name} />
                          {member.primary_role_title && (
                            <p className="text-xs font-semibold text-primary">{member.primary_role_title}</p>
                          )}
                          {/* Was a tick or a cross with a title attribute — invisible to
                              anyone not hovering, and a bare icon in a table column reads
                              as decoration. Said in words, and only when it is true. */}
                          {!member.is_active && (
                            <p className="text-xs text-muted-foreground">Not yet registered</p>
                          )}
                          {/* The folded columns, below sm only. Stacked rather than run
                              inline, and LABELLED: two proper nouns in a row are a coin
                              toss once the headings that told them apart have gone —
                              "Eastern · Austin" could be read either way round. That is
                              the case AGENTS.md means by "label a folded value when its
                              heading was doing the work", and it is the same call
                              AdminRegionsChaptersClient makes about a bare "National"
                              under a chapter name. Region is never omitted, because every
                              member is under one; Chapter is, because plenty are not in a
                              chapter and a "Chapter —" line is a fact about nothing. */}
                          <RowMeta className="flex-col items-start gap-y-0.5">
                            <MetaIf value={regionLabel(member.region_name)} prefix="Region" />
                            <MetaIf value={member.chapter_name} prefix="Chapter" />
                            {member.group_name && (
                              <span className="mt-0.5 inline-block whitespace-nowrap rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-on-soft">
                                {member.group_name}
                              </span>
                            )}
                          </RowMeta>
                        </div>
                      </div>
                    </td>
                    {/* NEVER AN EM-DASH FOR REGION. A member with no chapter, and a member
                        whose chapter sits under no region, are both under National — the
                        absence of a region rather than a missing value (20260817000008) —
                        so there is nothing here we do not know. Chapter genuinely can be
                        absent and takes the em-dash. */}
                    <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>
                      {regionLabel(member.region_name)}
                    </td>
                    <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>
                      {member.chapter_name ?? '—'}
                    </td>
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

      {/* ── One member, in full ──
          The shared dialog, so this screen and Members & Access print one person's
          record identically. What the Directory adds through `extra` is what only it
          knows: the board title it already prints under the name, the preferred name,
          the Group as a plain row rather than a pill, and whether the person has an
          account at all. Everything in here was already in `members` — moving a value
          into a dialog does not fetch anything new (§5). */}
      <MemberDetailsDialog
        member={viewed ? directoryDetails(viewed) : null}
        onClose={() => setViewingId(null)}
      />
    </div>
  )
}

/**
 * One `MemberRecord`, as the shared dialog wants it.
 *
 * A function rather than inline JSX so the mapping reads as a mapping and the row's
 * markup above is not interrupted by it. The five shared facts are positional; everything
 * below them is this screen's own and its order is chosen here.
 */
function directoryDetails(member: MemberRecord): MemberDetails {
  return {
    name: [member.prefix, member.first_name, member.last_name].filter(Boolean).join(' '),
    // The board title is the one line under the name worth repeating as the dialog's
    // subtitle: it says what this person IS in the family, which is the frame for every
    // other fact in the panel. The nickname is a field below rather than a subtitle,
    // because a preferred name is an alternative to the title above it, not a gloss on it.
    subtitle: member.primary_role_title,
    phone: member.primary_phone,
    email: member.primary_email,
    location: member.location,
    chapterName: member.chapter_name,
    regionName: member.region_name,
    extra: [
      { label: 'Preferred name', value: member.nick_name },
      // "Group" and not "Permission template", matching the column heading this screen
      // prints — AGENTS.md: captions come from the screen, and an administrator matching
      // a switch to the thing it switches off should not have to translate.
      { label: 'Group', value: member.group_name },
      // A statement, never blank: "no account" is a real and useful fact about a
      // great-uncle recorded on the tree, and an em-dash here would read as unknown.
      {
        label: 'Account',
        value: member.is_active ? 'Registered' : 'Not yet registered',
      },
    ],
  }
}
