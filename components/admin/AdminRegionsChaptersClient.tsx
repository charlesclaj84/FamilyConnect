'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog } from '@/components/ui/dialog'
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
import { useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

/**
 * Regions & Chapters — two tables, and a create dialog behind each.
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
  any: false, members: 0, schedules: 0, announcements: 0, positions: 0, elections: 0,
  chaptersMoving: 0,
}

/**
 * "14 members · 1 dues schedule", or null when a row has nothing attached.
 *
 * Null rather than "0 members" so `MetaIf` drops the whole item: an empty chapter is the
 * ordinary state of a chapter somebody has just created, and a column of zeroes reads as a
 * problem.
 */
function attachedCaption(a: ScopeAttached, t: T): string | null {
  const parts: string[] = []
  // ONE AND MANY ARE TWO KEYS PER COUNTABLE. The old `plural(n, one, many)` helper was an
  // English rule in the source: a language with three plural forms cannot use it, and one
  // that inflects the noun differently after a number cannot either.
  const plural = (n: number, stem: string) => n === 1
    ? t(`org.attached.${stem}One`)
    : t(`org.attached.${stem}Many`, { n })
  if (a.members) parts.push(plural(a.members, 'member'))
  if (a.schedules) parts.push(plural(a.schedules, 'due'))
  if (a.announcements) parts.push(plural(a.announcements, 'announcement'))
  if (a.positions) parts.push(plural(a.positions, 'position'))
  if (a.elections) parts.push(plural(a.elections, 'election'))
  return parts.length ? parts.join(' · ') : null
}

export function AdminRegionsChaptersClient({
  initialRegions, initialChapters, usage, mayCreate, mayEdit, mayDelete,
}: Props) {
  const t = useT()
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
  // ── THE TWO ADD FORMS ARE DIALOGS, SINCE 2026-08-20 ──────────────────────────────
  // They were inline blocks sitting above their tables, and the argument for moving them is
  // the one `AdminBoardPositionsClient` already made on this same screen: the thing an
  // administrator comes here to READ is the table, and a create form parked above it pushes
  // the answer down the page every time — worst below `sm`, where the chapter form's three
  // fields stack and the table starts off the bottom of the phone.
  //
  // AND IT DISAGREED WITH ITS OWN NEIGHBOUR. Adding a board position is a dialog on the very
  // same Organization pane, so the three create-shaped actions on one screen opened two
  // different ways. All three are dialogs now and the pane has one idiom.
  //
  // The ERROR STATE IS SHARED between the dialog and the table, deliberately: a create can
  // only fail while its dialog is open, and a DELETE reports through the same `FormError`
  // under the table. Two error slots per section would mean the same sentence in two places.
  const [showAddRegion, setShowAddRegion] = useState(false)
  const [showAddChapter, setShowAddChapter] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Closing is not the same as cancelling and both land here: the draft is dropped and the
  // error with it, so re-opening never shows a refusal about something nobody typed.
  function closeAddRegion() {
    setShowAddRegion(false)
    setNewRegion('')
    setRegionError('')
  }
  function closeAddChapter() {
    setShowAddChapter(false)
    setNewChapter('')
    setNewChapterRegion('')
    setChapterError('')
  }

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
      if (!result.success) { setRegionError(result.error ?? t('org.addRegionFailed')); return }
      // Closed only on success. A refusal — a duplicate name, the reserved word "National" —
      // leaves the dialog open with what was typed still in it, because the fix is one edit
      // away and re-typing a name to read the reason is the wrong way round.
      closeAddRegion()
      setRegions(prev => [...prev, {
        id: result.id!, family_code: '', name, created_at: new Date().toISOString(),
      }].sort((a, b) => a.name.localeCompare(b.name)))
    })
  }

  async function handleDeleteRegion(region: Region) {
    const moving = chaptersInRegion(region.id)
    const ok = await confirm({
      title: t('org.deleteRegion'),
      // The chapters moving to National is the whole of what deleting a region does to
      // anything else, so the number is in the sentence rather than in a note beside it.
      description: moving
        ? `Delete the ${region.name} region? Its ${moving === 1 ? 'chapter moves' : `${moving} chapters move`} to National, and every member in them stays exactly where they are. This cannot be undone.`
        : `Delete the ${region.name} region? This cannot be undone.`,
      confirmLabel: t('org.deleteRegion'),
      destructive: true,
    })
    if (!ok) return
    setRegionError('')
    startTransition(async () => {
      const result = await deleteRegion(region.id)
      if (!result.success) { setRegionError(result.error ?? t('org.deleteRegionFailed')); return }
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
      if (!result.success) { setChapterError(result.error ?? t('org.addChapterFailed')); return }
      // Closed only on success — see `handleAddRegion`. The chosen region is read into
      // `regionId` above before the close clears it, so the optimistic row below still knows
      // which region it landed in.
      closeAddChapter()
      setChapters(prev => [...prev, {
        id: result.id!, family_code: '', name, region_id: regionId,
        region_name: regionId ? (regions.find(r => r.id === regionId)?.name ?? null) : null,
        created_at: new Date().toISOString(),
      }].sort((a, b) => a.name.localeCompare(b.name)))
    })
  }

  async function handleDeleteChapter(chapter: Chapter) {
    const ok = await confirm({
      title: t('org.deleteChapter'),
      description: `Delete the ${chapter.name} chapter? This cannot be undone.`,
      confirmLabel: t('org.deleteChapter'),
      destructive: true,
    })
    if (!ok) return
    setChapterError('')
    startTransition(async () => {
      const result = await deleteChapter(chapter.id)
      if (!result.success) { setChapterError(result.error ?? t('org.deleteChapterFailed')); return }
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
        setChapterError(result.error ?? t('org.moveChapterFailed'))
        setChapters(prev => prev.map(c => c.id === chapter.id ? chapter : c))
      }
    })
  }

  return (
    <div className="space-y-10">
      {/* ── REGIONS ──────────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        {/* THE TRIGGER SITS ON THE HEADING ROW, opposite the section title, which is where
            every other create trigger in the admin area sits. It is the whole of what the
            inline form left behind: one button, and the table starts immediately under it. */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg">{t('org.regions')}</h2>
            <p className="text-sm text-muted-foreground">{t('adm.groupChaptersTexasEastern')}</p>
          </div>
          {mayCreate && (
            <Button size="sm" className="shrink-0" onClick={() => { setRegionError(''); setShowAddRegion(true) }}>
              <Plus className="h-4 w-4" /> {t('org.addRegion')}
            </Button>
          )}
        </div>

        {/* ONE ERROR STATE, ONE PLACE TO SHOW IT. Creating and deleting share `regionError`,
            and while the dialog is open the dialog is the place — a refusal rendered in both
            would be the same sentence twice, once underneath a scrim. AGENTS.md is explicit
            that a message inside a scrolling panel belongs with the buttons rather than with
            the field, and the corollary is that it belongs in exactly one panel. */}
        <FormError message={showAddRegion ? '' : regionError} />

        {regions.length === 0 ? (
          <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
            {t('org.noRegions')}
          </p>
        ) : (
          <div className="overflow-visible rounded-xl border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-semibold">{t('dir.region')}</th>
                  <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>{t('rep.chapters')}</th>
                  <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>{t('org.attached')}</th>
                  <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">{t('money.actions')}</span></th>
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
                          {attachedCaption(attached, t) && <MetaDot />}
                          <MetaIf value={attachedCaption(attached, t)} />
                        </RowMeta>
                      </td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums text-muted-foreground', COLLAPSING_CELL)}>{count}</td>
                      <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>
                        {attachedCaption(attached, t) ?? '—'}
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
                                ? t('org.stillAttached', { name: region.name, what: attachedCaption(attached, t) ?? '' })
                                : `Delete the ${region.name} region`}
                              aria-label={t('org.deleteRegionAria', { name: region.name })}
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg">{t('rep.chapters')}</h2>
            <p className="text-sm text-muted-foreground">
              Where a member actually belongs. {nationalCount === 0
                ? t('org.nothingNational')
                : `${nationalCount} ${nationalCount === 1 ? 'chapter is' : 'chapters are'} under National.`}{' '}
              A member picks their chapter on their own profile.
            </p>
          </div>
          {mayCreate && (
            <Button size="sm" className="shrink-0" onClick={() => { setChapterError(''); setShowAddChapter(true) }}>
              <Plus className="h-4 w-4" /> {t('org.addChapter')}
            </Button>
          )}
        </div>

        <FormError message={showAddChapter ? '' : chapterError} />

        {chapters.length === 0 ? (
          <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">{t('adm.noChaptersYetUntil')}</p>
        ) : (
          <div className="overflow-visible rounded-xl border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-semibold">{t('field.chapter')}</th>
                  <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>{t('dir.region')}</th>
                  <th scope="col" className={cn('px-3 py-2 text-right font-semibold', COLLAPSING_CELL)}>{t('rep.members')}</th>
                  <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>{t('org.attached')}</th>
                  <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">{t('money.actions')}</span></th>
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
                      aria-label={t('org.regionForAria', { name: chapter.name })}
                      onChange={e => handleMoveChapter(chapter, e.target.value)}
                    >
                      <option value="">{t('common.national')}</option>
                      {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </Select>
                  ) : (
                    <span className="text-muted-foreground">{chapter.region_name ?? t('common.national')}</span>
                  )
                  return (
                    <tr key={chapter.id} className="border-b align-top last:border-0 sm:align-middle">
                      <td className="px-3 py-2.5">
                        <span className="font-medium">{chapter.name}</span>
                        <RowMeta className="gap-x-2">
                          {/* LABELLED, because "National" under a chapter name is not
                              self-evident as the region once the heading has gone. */}
                          <span className="flex items-center gap-1.5">
                            <span>{t('dir.region')}</span>
                            {regionSelect}
                          </span>
                          <MetaDot />
                          <MetaIf value={`${attached.members} ${attached.members === 1 ? 'member' : 'members'}`} />
                          {(attached.schedules || attached.announcements || attached.positions || attached.elections) ? <MetaDot /> : null}
                          <MetaIf value={attachedCaption({ ...attached, members: 0 }, t)} />
                        </RowMeta>
                      </td>
                      <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>{regionSelect}</td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums text-muted-foreground', COLLAPSING_CELL)}>{attached.members}</td>
                      <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>
                        {attachedCaption({ ...attached, members: 0 }, t) ?? '—'}
                      </td>
                      <td className="w-px px-3 py-2.5">
                        <div className="flex items-center justify-end">
                          {mayDelete && (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              disabled={isPending || attached.any}
                              title={attached.any
                                ? t('org.stillAttached', { name: chapter.name, what: attachedCaption(attached, t) ?? '' })
                                : `Delete the ${chapter.name} chapter`}
                              aria-label={t('org.deleteChapterAria', { name: chapter.name })}
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

      {/* ── THE TWO CREATE DIALOGS ────────────────────────────────────────────────────
          A real `<form>` inside each, which is what makes Enter in the name box submit —
          the inline versions bought that with an `onKeyDown` handler per input, and a form
          element does it for every field at once and for the right reasons. `AdminBoardPositions`
          on this same pane spent an afternoon as a `<div>` during which Enter did nothing.

          BOTH ARE GATED ON `mayCreate` AS WELL AS ON THEIR OWN FLAG. The trigger is already
          withheld without the grant, so the flag can never be set — the second condition is
          for the same reason the actions re-check: a control that cannot be reached is not a
          gate, and this one costs a boolean. */}
      <Dialog
        open={showAddRegion && mayCreate}
        onClose={closeAddRegion}
        title={t('org.addRegionTitle')}
        description={t('org.addRegionHint')}
      >
        <form onSubmit={e => { e.preventDefault(); handleAddRegion() }} className="mt-2 space-y-3">
          <div className="space-y-1.5">
            <Label required htmlFor="new-region">{t('dir.region')}</Label>
            <Input
              id="new-region"
              placeholder={t('org.regionPh')}
              autoFocus
              value={newRegion}
              onChange={e => { setNewRegion(e.target.value); setRegionError('') }}
            />
          </div>
          {/* NAMED HERE rather than left to the refusal, because "National" is the one name
              `createRegion` rejects and the reason is not guessable: it is the ABSENCE of a
              region, which is why it needs no row. */}
          <p className="text-xs text-muted-foreground">
            {t('org.underNational')} <strong>{t('common.national')}</strong>, so
            there is no need to create one for it — and “National” is not a name a region can
            take.
          </p>
          <FormError message={regionError} />
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={closeAddRegion}>{t('action.cancel')}</Button>
            <Button type="submit" disabled={!newRegion.trim() || isPending}>
              {isPending ? t('action.adding') : t('org.addRegion')}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={showAddChapter && mayCreate}
        onClose={closeAddChapter}
        title={t('org.addChapterTitle')}
        description={t('org.addChapterHint')}
      >
        <form onSubmit={e => { e.preventDefault(); handleAddChapter() }} className="mt-2 space-y-3">
          <div className="space-y-1.5">
            <Label required htmlFor="new-chapter">{t('field.chapter')}</Label>
            <Input
              id="new-chapter"
              placeholder={t('org.chapterPh')}
              autoFocus
              value={newChapter}
              onChange={e => { setNewChapter(e.target.value); setChapterError('') }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-chapter-region">{t('org.inRegion')}</Label>
            <Select
              id="new-chapter-region"
              value={newChapterRegion}
              onChange={e => setNewChapterRegion(e.target.value)}
            >
              <option value="">{t('common.national')}</option>
              {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </div>
          {/* THE CONSEQUENCE, SAID ONCE, WHERE THE CHOICE IS MADE. Since 20260817000008 a
              region decides who owes a REGIONAL DUE, so this select is not a filing
              convenience — and it is correctable afterwards from the Region column, which is
              what keeps the sentence reassuring rather than alarming. */}
          <p className="text-xs text-muted-foreground">{t('adm.chapterSRegionDecides')}<strong>{t('dir.region')}</strong> column.
          </p>
          <FormError message={chapterError} />
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={closeAddChapter}>{t('action.cancel')}</Button>
            <Button type="submit" disabled={!newChapter.trim() || isPending}>
              {isPending ? t('action.adding') : t('org.addChapter')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
