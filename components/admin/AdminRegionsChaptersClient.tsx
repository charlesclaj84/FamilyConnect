'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { COLLAPSING_CELL, RowMeta, MetaDot, MetaIf } from '@/components/ui/table-collapse'
import { cn } from '@/lib/utils'
import { useServerState } from '@/lib/use-server-state'
import type { ScopeAttached } from '@/lib/scope-attached'
import {
  createRegion, deleteRegion, createChapter, deleteChapter, setChapterRegion,
  type Region, type Chapter, type ScopeUsage,
} from '@/app/actions/admin/chapters'

/**
 * Regions & Chapters — two tables and two forms.
 *
 * ── WHY IT IS TWO TABLES AND NOT THE OLD ACCORDION ─────────────────────────────────
 * It was a stack of collapsible region cards, each holding a flex row per chapter with a
 * bin icon on the right. Three things were wrong with that and only the third is cosmetic:
 *
 *   * **A chapter's region could never be corrected.** The region was fixed at creation and
 *     the accordion had nowhere to put a control that changed it. That was a shrug while a
 *     region was a heading; since 20260817000008 it decides who owes a REGIONAL DUE, so a
 *     chapter created under the wrong region was a bill sent to the wrong half of the
 *     family, permanently. The Region cell is now a `<Select>`.
 *   * **Nothing said why a delete would fail.** `people.chapter_id` refuses the delete at
 *     the database, so a chapter with members in it produced a raw foreign-key error. The
 *     Members and Dues columns are what make that predictable, and they come from
 *     `getScopeUsage()`.
 *   * **Flex rows dressed as a table.** AGENTS.md: a screen reader announces the column when
 *     it reads the cell, and "14" on its own is not the same fact as "Members: 14". These
 *     are real `<table>`s with `<th scope="col">`, and the columns that are not the row's
 *     subject fold with `COLLAPSING_CELL` into a `RowMeta` line rather than scrolling
 *     sideways.
 *
 * ── NATIONAL IS A ROW IN THE REGION SELECT AND NOT A REGION ────────────────────────
 * The absence of a region. It has no row in `regions`, cannot be created (`createRegion`
 * refuses the name) and cannot be deleted, so it appears as the empty option in the Region
 * cell and as a group heading in the chapter count. Everything a family has not filed
 * somewhere is under it, which is what makes it exist on every plan for free.
 *
 * ── THE THREE GRANTS ARRIVE AS PROPS ──────────────────────────────────────────────
 * Create, edit and delete are separate grants on `admin/chapters`, resolved on the server
 * (§5: the page decides, the UI follows). Withholding a control is not the protection —
 * every action re-checks — it is so nobody is offered a button that answers "Not
 * authorized".
 */

interface Props {
  initialRegions: Region[]
  initialChapters: Chapter[]
  usage: ScopeUsage
  mayCreate: boolean
  mayEdit: boolean
  mayDelete: boolean
}

/** What a row has attached, when nothing has been fetched for it. */
const NOTHING: ScopeAttached = {
  any: false, members: 0, schedules: 0, announcements: 0, positions: 0, chaptersMoving: 0,
}

/**
 * "14 members · 1 dues schedule", or null when a row has nothing attached.
 *
 * Null rather than "0 members" so `MetaIf` drops the whole item: an empty chapter is the
 * ordinary state of a chapter somebody has just created, and a column of zeroes reads as a
 * problem.
 */
function attachedCaption(a: ScopeAttached): string | null {
  const parts: string[] = []
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  if (a.members) parts.push(plural(a.members, 'member', 'members'))
  if (a.schedules) parts.push(plural(a.schedules, 'due', 'dues'))
  if (a.announcements) parts.push(plural(a.announcements, 'announcement', 'announcements'))
  if (a.positions) parts.push(plural(a.positions, 'position', 'positions'))
  return parts.length ? parts.join(' · ') : null
}

export function AdminRegionsChaptersClient({
  initialRegions, initialChapters, usage, mayCreate, mayEdit, mayDelete,
}: Props) {
  const confirm = useConfirm()
  // `useServerState` rather than `useState`: every write below refreshes, and a plain
  // initializer would be read once per visit and every later server render ignored — which
  // is what made a freshly added region show up only after leaving the page.
  const [regions, setRegions] = useServerState(initialRegions)
  const [chapters, setChapters] = useServerState(initialChapters)
  const [newRegion, setNewRegion] = useState('')
  const [newChapter, setNewChapter] = useState('')
  const [newChapterRegion, setNewChapterRegion] = useState('')
  const [regionError, setRegionError] = useState('')
  const [chapterError, setChapterError] = useState('')
  const [isPending, startTransition] = useTransition()

  const usageOfRegion = (id: string) => usage.regions[id] ?? NOTHING
  const usageOfChapter = (id: string) => usage.chapters[id] ?? NOTHING
  const chaptersInRegion = (id: string) => chapters.filter(c => c.region_id === id).length
  const nationalCount = chapters.filter(c => !c.region_id).length

  function handleAddRegion() {
    const name = newRegion.trim()
    if (!name) return
    setRegionError('')
    startTransition(async () => {
      const result = await createRegion(name)
      if (!result.success) { setRegionError(result.error ?? 'Could not add that region'); return }
      setNewRegion('')
      setRegions(prev => [...prev, {
        id: result.id!, family_code: '', name, created_at: new Date().toISOString(),
      }].sort((a, b) => a.name.localeCompare(b.name)))
    })
  }

  async function handleDeleteRegion(region: Region) {
    const moving = chaptersInRegion(region.id)
    const ok = await confirm({
      title: 'Delete region',
      // The chapters moving to National is the whole of what deleting a region does to
      // anything else, so the number is in the sentence rather than in a note beside it.
      description: moving
        ? `Delete the ${region.name} region? Its ${moving === 1 ? 'chapter moves' : `${moving} chapters move`} to National, and every member in them stays exactly where they are. This cannot be undone.`
        : `Delete the ${region.name} region? This cannot be undone.`,
      confirmLabel: 'Delete region',
      destructive: true,
    })
    if (!ok) return
    setRegionError('')
    startTransition(async () => {
      const result = await deleteRegion(region.id)
      if (!result.success) { setRegionError(result.error ?? 'Could not delete that region'); return }
      setRegions(prev => prev.filter(r => r.id !== region.id))
      // The database moved them (ON DELETE SET NULL); this keeps the table on screen saying
      // the same thing without a round trip.
      setChapters(prev => prev.map(c =>
        c.region_id === region.id ? { ...c, region_id: null, region_name: null } : c))
    })
  }

  function handleAddChapter() {
    const name = newChapter.trim()
    if (!name) return
    setChapterError('')
    startTransition(async () => {
      const regionId = newChapterRegion || null
      const result = await createChapter(name, regionId)
      if (!result.success) { setChapterError(result.error ?? 'Could not add that chapter'); return }
      setNewChapter('')
      setChapters(prev => [...prev, {
        id: result.id!, family_code: '', name, region_id: regionId,
        region_name: regionId ? (regions.find(r => r.id === regionId)?.name ?? null) : null,
        created_at: new Date().toISOString(),
      }].sort((a, b) => a.name.localeCompare(b.name)))
    })
  }

  async function handleDeleteChapter(chapter: Chapter) {
    const ok = await confirm({
      title: 'Delete chapter',
      description: `Delete the ${chapter.name} chapter? This cannot be undone.`,
      confirmLabel: 'Delete chapter',
      destructive: true,
    })
    if (!ok) return
    setChapterError('')
    startTransition(async () => {
      const result = await deleteChapter(chapter.id)
      if (!result.success) { setChapterError(result.error ?? 'Could not delete that chapter'); return }
      setChapters(prev => prev.filter(c => c.id !== chapter.id))
    })
  }

  function handleMoveChapter(chapter: Chapter, regionId: string) {
    const next = regionId || null
    if (next === chapter.region_id) return
    setChapterError('')
    // Optimistic, and reverted on refusal: the select is the state, so leaving it showing
    // the new region after a failed write would be the control lying about the row.
    setChapters(prev => prev.map(c => c.id === chapter.id
      ? { ...c, region_id: next, region_name: next ? (regions.find(r => r.id === next)?.name ?? null) : null }
      : c))
    startTransition(async () => {
      const result = await setChapterRegion(chapter.id, next)
      if (!result.success) {
        setChapterError(result.error ?? 'Could not move that chapter')
        setChapters(prev => prev.map(c => c.id === chapter.id ? chapter : c))
      }
    })
  }

  return (
    <div className="space-y-10">
      {/* ── REGIONS ──────────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg">Regions</h2>
          <p className="text-sm text-muted-foreground">
            A group of chapters — “Texas”, “Eastern”, “Southeast”. Optional: a family can run
            on chapters alone, or on neither.
          </p>
        </div>

        {mayCreate && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-xs">
              <Label htmlFor="new-region">Add a region</Label>
              <Input
                id="new-region"
                placeholder="e.g. Texas"
                value={newRegion}
                onChange={e => { setNewRegion(e.target.value); setRegionError('') }}
                onKeyDown={e => { if (e.key === 'Enter') handleAddRegion() }}
              />
            </div>
            <Button disabled={!newRegion.trim() || isPending} onClick={handleAddRegion}>
              <Plus className="h-4 w-4" /> Add region
            </Button>
          </div>
        )}
        <FormError message={regionError} />

        {regions.length === 0 ? (
          <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
            No regions yet. Every chapter sits under National until you add one.
          </p>
        ) : (
          <div className="overflow-visible rounded-xl border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-semibold">Region</th>
                  <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Chapters</th>
                  <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Attached</th>
                  <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {regions.map(region => {
                  const attached = usageOfRegion(region.id)
                  const count = chaptersInRegion(region.id)
                  return (
                    <tr key={region.id} className="border-b align-top last:border-0 sm:align-middle">
                      <td className="px-3 py-2.5">
                        <span className="font-medium">{region.name}</span>
                        <RowMeta className="gap-x-2">
                          <MetaIf value={`${count} ${count === 1 ? 'chapter' : 'chapters'}`} />
                          {attachedCaption(attached) && <MetaDot />}
                          <MetaIf value={attachedCaption(attached)} />
                        </RowMeta>
                      </td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums text-muted-foreground', COLLAPSING_CELL)}>{count}</td>
                      <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>
                        {attachedCaption(attached) ?? '—'}
                      </td>
                      <td className="w-px px-3 py-2.5">
                        <div className="flex items-center justify-end">
                          {mayDelete && (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              disabled={isPending || attached.any}
                              /* Disabled WITH a reason, because a greyed-out bin with
                                 nothing beside it reads as a bug. The action re-derives
                                 this and returns the same sentence, so the title is a
                                 courtesy rather than the gate. */
                              title={attached.any
                                ? `${region.name} still has ${attachedCaption(attached)} attached, so it cannot be deleted.`
                                : `Delete the ${region.name} region`}
                              aria-label={`Delete the ${region.name} region`}
                              onClick={() => handleDeleteRegion(region)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── CHAPTERS ─────────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg">Chapters</h2>
          <p className="text-sm text-muted-foreground">
            Where a member actually belongs. {nationalCount === 0
              ? 'Nothing is under National.'
              : `${nationalCount} ${nationalCount === 1 ? 'chapter is' : 'chapters are'} under National.`}{' '}
            A member picks their chapter on their own profile.
          </p>
        </div>

        {mayCreate && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-xs">
              <Label htmlFor="new-chapter">Add a chapter</Label>
              <Input
                id="new-chapter"
                placeholder="e.g. Houston"
                value={newChapter}
                onChange={e => { setNewChapter(e.target.value); setChapterError('') }}
                onKeyDown={e => { if (e.key === 'Enter') handleAddChapter() }}
              />
            </div>
            <div className="min-w-0 space-y-1.5 sm:w-48">
              <Label htmlFor="new-chapter-region">In region</Label>
              <Select
                id="new-chapter-region"
                value={newChapterRegion}
                onChange={e => setNewChapterRegion(e.target.value)}
              >
                <option value="">National</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </div>
            <Button disabled={!newChapter.trim() || isPending} onClick={handleAddChapter}>
              <Plus className="h-4 w-4" /> Add chapter
            </Button>
          </div>
        )}
        <FormError message={chapterError} />

        {chapters.length === 0 ? (
          <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
            No chapters yet. Until there are, every member is under National and owes only
            the family-wide dues.
          </p>
        ) : (
          <div className="overflow-visible rounded-xl border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-semibold">Chapter</th>
                  <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Region</th>
                  <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>Members</th>
                  <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>Attached</th>
                  <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {chapters.map(chapter => {
                  const attached = usageOfChapter(chapter.id)
                  // ONE ELEMENT, RENDERED TWICE — see table-collapse.tsx. Both copies exist
                  // in the DOM, only one is ever visible or focusable, and both are bound to
                  // the same state, so the field cannot go read-only on a phone. No `id` on
                  // it (that would duplicate); the aria-label names the row instead of the
                  // heading that has folded away.
                  const regionSelect = mayEdit ? (
                    <Select
                      className="h-7 w-full sm:w-44"
                      value={chapter.region_id ?? ''}
                      disabled={isPending}
                      aria-label={`Region for the ${chapter.name} chapter`}
                      onChange={e => handleMoveChapter(chapter, e.target.value)}
                    >
                      <option value="">National</option>
                      {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </Select>
                  ) : (
                    <span className="text-muted-foreground">{chapter.region_name ?? 'National'}</span>
                  )
                  return (
                    <tr key={chapter.id} className="border-b align-top last:border-0 sm:align-middle">
                      <td className="px-3 py-2.5">
                        <span className="font-medium">{chapter.name}</span>
                        <RowMeta className="gap-x-2">
                          {/* LABELLED, because "National" under a chapter name is not
                              self-evident as the region once the heading has gone. */}
                          <span className="flex items-center gap-1.5">
                            <span>Region</span>
                            {regionSelect}
                          </span>
                          <MetaDot />
                          <MetaIf value={`${attached.members} ${attached.members === 1 ? 'member' : 'members'}`} />
                          {(attached.schedules || attached.announcements || attached.positions) ? <MetaDot /> : null}
                          <MetaIf value={attachedCaption({ ...attached, members: 0 })} />
                        </RowMeta>
                      </td>
                      <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>{regionSelect}</td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums text-muted-foreground', COLLAPSING_CELL)}>{attached.members}</td>
                      <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>
                        {attachedCaption({ ...attached, members: 0 }) ?? '—'}
                      </td>
                      <td className="w-px px-3 py-2.5">
                        <div className="flex items-center justify-end">
                          {mayDelete && (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              disabled={isPending || attached.any}
                              title={attached.any
                                ? `${chapter.name} still has ${attachedCaption(attached)} attached, so it cannot be deleted.`
                                : `Delete the ${chapter.name} chapter`}
                              aria-label={`Delete the ${chapter.name} chapter`}
                              onClick={() => handleDeleteChapter(chapter)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
