'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm'
import { FormError, FieldError } from '@/components/ui/form-message'
import { COLLAPSING_CELL, RowMeta, MetaDot } from '@/components/ui/table-collapse'
import { SortTh, useTableSort } from '@/components/ui/sortable-header'
import { useServerState } from '@/lib/use-server-state'
import { cn } from '@/lib/utils'
import {
  createBoardPosition, renameBoardPosition, deleteBoardPosition,
  type BoardPosition,
} from '@/app/actions/admin/chapters'
import {
  POSITION_CATEGORIES, POSITION_SCOPES, POSITION_NAME_MAX,
  positionCategoryLabel, positionScopeLabel,
  type PositionCategory, type PositionScope,
} from '@/lib/board-positions'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * Board Positions — the family's list of offices. WHO HOLDS THEM IS NOT DECIDED HERE.
 *
 * ── ONE JOB SINCE 2026-08-20: WHICH OFFICES EXIST ──────────────────────────────────
 * This pane used to do both — a "Held by" column listing every officer, an **Assign** button
 * per row opening a person picker, and an × beside each name to take a position away. All of
 * it moved to the Members table, where each member's row has a **Position** column and its
 * row menu opens a dialog to set one.
 *
 * The split is by WHO THE READER IS THINKING ABOUT. Setting up the offices a family keeps is a
 * decision about the family — done once, revisited yearly — and it belongs beside the regions
 * and chapters it sits next to. Giving Ada the Treasurer's job is a decision about ADA, and
 * every other decision about Ada is on her row: her permission template, whether her access is
 * on, her profile. Assigning from here meant finding the office and then finding the person
 * inside it; assigning from there means finding the person, which is what an administrator
 * actually has in mind.
 *
 * WHAT STAYED, AND WHY IT LOOKS LIKE A LEFTOVER: `BoardPosition.holders`, the count. It is not
 * an assignment control — it is the reason the delete button is disabled, and the sentence
 * beside it ("2 people hold this — take it away from them first") is what stops a greyed bin
 * reading as a bug. The count comes from `getBoardPositions`, which this pane already needed.
 *
 * ── WHAT THIS REPLACED, AND WHY IT IS A REWRITE ─────────────────────────────────────
 * `AdminUserRolesClient` was two cards over a hybrid table: "Standard Board Positions",
 * where a family ticked which of 25 built-ins it used, and "Custom Roles" beneath. It went
 * with the built-ins (20260819000004) — a family's positions are its own now, starting
 * empty — and it was the worst-conforming client in the admin tree besides:
 *
 *   * three lists of four columns built from flex rows dressed as tables, so Category and
 *     Scope were announced with no column name at all;
 *   * `alert(result.error)` on a refused delete, one of three in the whole tree;
 *   * ONE error string feeding two `<FormError>`s in different cards, so a failed toggle
 *     painted its message inside the other card's create form;
 *   * a hand-rolled `<select className="…">` twice, beside a `Select` that exists;
 *   * "Name is required" — one input being wrong — rendered through `FormError`.
 *
 * All six are fixed here rather than patched there, because the shape of the screen changed.
 *
 * ── ONE ERROR STRING PER OPERATION, NOT PER SCREEN ──────────────────────────────────
 * Three `FormError`s: `createError` (under the add form), `listError` (a refused REVOKE, beside
 * the table it refers to) and `assignError` (inside the dialog, immediately above the button).
 * And two `FieldError`s, `nameError` and `renameError`, each under the one input it is about.
 * Five strings rather than one, because the alternative is a refused rename painting its
 * message inside the create form, which is what the client this replaced did.
 *
 * `assignError` sits with the button for the reason AGENTS.md gives, and NOT for the mechanism
 * it names: this repo's `Dialog` has no `shrink-0` footer — only its title bar is pinned, and
 * every child including the buttons is inside the one `overflow-y-auto` body. So the message
 * scrolls with the button rather than being held in view beside it. Adjacency is what is being
 * bought here; `confirm.tsx` is the component that really does have a fixed footer.
 *
 * A REFUSED DELETE IS NOT IN THAT LIST ANY MORE. The bin is disabled with its reason on the
 * row when somebody holds the position, because a `FormError` above a twenty-row table paints
 * where the reader is not looking.
 *
 * ── THE TABLES ARE TABLES ───────────────────────────────────────────────────────────
 * Real `<table>` with `<th scope="col">`, and the columns that are not the row's subject
 * carry `COLLAPSING_CELL` with a `<RowMeta>` restating them inside the first cell. No
 * `overflow-x-auto`, no `min-w-*`: a phone gets a narrower table rather than a window onto a
 * wider one.
 *
 * ── WRITE RIGHTS ARRIVE AS PROPS ────────────────────────────────────────────────────
 * `mayCreate`/`mayEdit`/`mayDelete`, resolved on the page with `canAny` — the same helper
 * every action behind them uses, so a control that renders is a control that can succeed.
 *
 * `members`, `regions` and `chapters` USED TO ARRIVE HERE TOO and no longer do: they existed
 * only to fill the assignment dialog, and a roster is PII in the RSC payload (§5). They are
 * sent to the Members pane now, under the same grant, and only to a caller who may assign.
 */

export function AdminBoardPositionsClient({
  initialPositions, mayCreate, mayEdit, mayDelete,
}: {
  initialPositions: BoardPosition[]
  mayCreate: boolean
  mayEdit: boolean
  mayDelete: boolean
}) {
  const t = useT()
  const router = useRouter()
  const confirm = useConfirm()

  // `useServerState`: every write here refreshes rather than building a row, so adopting the
  // refreshed props is what makes a new position and a new assignment appear. Switching
  // family remounts the whole page through the layout key, so neither list can be stale for
  // the family the caller just left.
  const [positions] = useServerState(initialPositions)

  // ── SORTING, AND THIS IS THE ONE TABLE IN THE PASS WHOSE DEFAULT ORDER CHANGES ────
  // `getBoardPositions` orders by `sort_order`, which looks like a curated hierarchy and is
  // not: `createBoardPosition` writes `max(sort_order) + 1` and there is no reorder control
  // anywhere, so the column records the order somebody happened to add the offices in. That
  // is not a fact the screen prints or a reader could infer, so replacing it with Position
  // ascending displaces nothing — unlike the routing waterfall two screens over, where the
  // ordinal IS the datum and the table is therefore deliberately not sortable.
  //
  // CATEGORY AND SCOPE SORT ON THE PRINTED LABEL, which is the rule this pass took everywhere
  // an enum reaches a cell through a lookup: alphabetical by the word in the cell is what the
  // reader can predict, and it is locale-correct for free because `useTableSort` threads the
  // reader's `Intl` tag. Sorting on the raw enum would order by the English identifier in
  // every language. A hierarchy — national above regional above chapter — is the tempting
  // alternative for Scope and is refused for the same reason it was on the staff console: an
  // order the heading does not describe is a control that means something other than it says.
  const { rows, sortProps } = useTableSort(positions, {
    position: p => p.name,
    category: p => positionCategoryLabel(t, p.category),
    scope: p => positionScopeLabel(t, p.scope),
  }, 'position')

  const [showAdd, setShowAdd]       = useState(false)
  const [form, setForm]             = useState<{ name: string; category: PositionCategory; scope: PositionScope }>({
    name: '', category: 'executive_officer', scope: 'national',
  })
  const [saving, setSaving]         = useState(false)
  const [nameError, setNameError]   = useState('')
  const [createError, setCreateError] = useState('')
  const [listError, setListError]   = useState('')

  // Inline rename, one row at a time. `editingId` is the row and `editingName` is the draft —
  // UI-local state in the sense AGENTS.md means: it came from a prop but it is being typed
  // into, and it is discarded rather than written back on anything but Save.
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [renameError, setRenameError] = useState('')
  const [renaming, setRenaming]       = useState(false)

  // IN-FLIGHT GUARDS ON BOTH DESTRUCTIVE PATHS. Without them a second press lands after the
  // first has succeeded and the screen reports a failure for an operation that worked:
  // `deleteBoardPosition` answers "Position not found" and `revokeBoardPosition` "That
  // assignment no longer exists", both over a table where the row is correctly gone. The
  // sibling `AdminRegionsChaptersClient` guards all four of its writes the same way.
  const [busyId, setBusyId] = useState<string | null>(null)

  /**
   * Shut the add dialog and clear both of its messages.
   *
   * ONE FUNCTION FOR THREE CALLERS — Cancel, the dialog's own dismiss, and a successful
   * create — because the state it resets is what makes reopening it clean. The inline panel
   * this replaced cleared the errors at two of its three exits and not the third, so
   * reopening after a refused name showed the old refusal above an empty box.
   *
   * The FORM is deliberately not reset here. `handleCreate` clears it on success only, so a
   * refused submission keeps what was typed and Cancel is what throws it away — which is the
   * behaviour every other dialog in the tree has.
   */
  function closeAdd() {
    setShowAdd(false)
    setCreateError('')
    setNameError('')
  }

  async function handleCreate() {
    const name = form.name.trim()
    if (!name) { setNameError('A position needs a name'); return }
    setSaving(true)
    setNameError('')
    setCreateError('')
    const result = await createBoardPosition({ ...form, name })
    setSaving(false)
    if (!result.success) { setCreateError(result.error ?? t('pos.addFailed')); return }
    setForm({ name: '', category: 'executive_officer', scope: 'national' })
    closeAdd()
    router.refresh()
  }

  function startRename(position: BoardPosition) {
    setEditingId(position.id)
    setEditingName(position.name)
    setRenameError('')
    setListError('')
  }

  function cancelRename() {
    setEditingId(null)
    setEditingName('')
    setRenameError('')
  }

  async function handleRename(position: BoardPosition) {
    const next = editingName.trim()
    if (!next) { setRenameError('A position needs a name'); return }
    // Unchanged is not a save. The action answers `{ success: true }` for it too, so this is a
    // round trip avoided rather than a rule enforced here.
    if (next === position.name) { cancelRename(); return }
    setRenaming(true)
    setRenameError('')
    const result = await renameBoardPosition(position.id, next)
    setRenaming(false)
    // A `FieldError` and not a `FormError`, deliberately. Every way this can fail is a complaint
    // about the NAME — blank, too long, or already used by another of the family's positions —
    // and the input is the whole form, so the quiet treatment is the right one. A tinted alert
    // box inside a table cell would also push every row below it down.
    if (!result.success) { setRenameError(result.error ?? t('pos.renameFailed')); return }
    cancelRename()
    router.refresh()
  }

  async function handleDelete(position: BoardPosition) {
    if (busyId) return
    setListError('')
    // SAID BEFORE THE CONFIRMATION RATHER THAN AFTER IT. The action refuses while anybody holds
    // the position and is the authority — this is the same answer arrived at a beat earlier,
    // from the count already on the row, so nobody confirms a delete that was never going to
    // happen. The server check is not weakened by it and is what a caller past this screen hits.
    if (position.holders > 0) {
      setListError(
        t(position.holders === 1 ? 'pos.holdersBlockOne' : 'pos.holdersBlockMany',
          { n: String(position.holders), name: position.name }),
      )
      return
    }
    const ok = await confirm({
      title: t('pos.remove'),
      description: t('pos.removeNamedLede', { name: position.name })
        + t('pos.removeBody'),
      confirmLabel: t('pos.remove'),
      destructive: true,
    })
    if (!ok) return
    setBusyId(position.id)
    const result = await deleteBoardPosition(position.id)
    setBusyId(null)
    // The action REFUSES while anybody holds the position, and says how many — so this
    // message is information rather than a failure, and it belongs beside the table it is
    // about rather than in a dialog that has already closed.
    if (!result.success) { setListError(result.error ?? t('pos.removeFailed')); return }
    router.refresh()
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">
              Positions
              {positions.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {positions.length} {positions.length === 1 ? 'position' : 'positions'}
                </span>
              )}
            </CardTitle>
            {mayCreate && (
              // A PLAIN OPEN, not a toggle. It was `setShowAdd(s => !s)` while the form was
              // an inline panel, where toggling was the only way to shut it; a dialog has its
              // own dismiss and a Cancel button, and leaving the toggle in meant the trigger
              // behind an open dialog would close it — a control doing the opposite of what
              // it says while covered by the thing it opened.
              <Button size="sm" onClick={() => { setShowAdd(true); setCreateError(''); setNameError('') }}>
                <Plus className="h-3.5 w-3.5" /> {t('pos.add')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormError message={listError} />

          {positions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {mayCreate
                ? t('pos.none')
                : t('pos.noneShort')}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <SortTh label={t('pos.position')} {...sortProps('position')} className="px-3 py-2" />
                    <SortTh label={t('common.category')} {...sortProps('category')} className={cn('px-3 py-2', COLLAPSING_CELL)} />
                    <SortTh label={t('common.scope')} {...sortProps('scope')} className={cn('px-3 py-2', COLLAPSING_CELL)} />
                    {(mayEdit || mayDelete) && (
                      <th scope="col" className="px-3 py-2 text-right"><span className="sr-only">{t('money.actions')}</span></th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map(p => {
                    const editing = editingId === p.id
                    return (
                      <tr key={p.id} className="align-top sm:align-middle">
                        <td className="px-3 py-2 font-medium">
                          {editing ? (
                            <div className="space-y-1.5">
                              <Input
                                aria-label={t('pos.renameAria', { name: p.name })}
                                value={editingName}
                                maxLength={POSITION_NAME_MAX}
                                autoFocus
                                onChange={e => { setEditingName(e.target.value); setRenameError('') }}
                                // Enter saves and Escape cancels, because a text box inside a
                                // table row is not a form and would otherwise have no keyboard
                                // path at all — Enter here would submit nothing.
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); void handleRename(p) }
                                  if (e.key === t('pos.escape')) { e.preventDefault(); cancelRename() }
                                }}
                              />
                              <FieldError message={renameError} />
                            </div>
                          ) : (
                            <>
                              {p.name}
                              <RowMeta>
                                <span>{positionCategoryLabel(t, p.category)}</span>
                                <MetaDot />
                                <span>{positionScopeLabel(t, p.scope)}</span>
                              </RowMeta>
                            </>
                          )}
                        </td>
                        <td className={cn('px-3 py-2 text-muted-foreground', COLLAPSING_CELL)}>
                          {positionCategoryLabel(t, p.category)}
                        </td>
                        <td className={cn('px-3 py-2 text-muted-foreground', COLLAPSING_CELL)}>
                          {positionScopeLabel(t, p.scope)}
                        </td>
                        {(mayEdit || mayDelete) && (
                          <td className="px-3 py-2">
                            {/* ONE ROW, ONE MODE. While a row is being renamed its actions are
                                Save and Cancel and nothing else — offering Assign and Delete
                                beside a half-typed name invites pressing one and losing the
                                edit with no warning. */}
                            <div className="flex items-center justify-end gap-1.5">
                              {editing ? (
                                <>
                                  <Button size="sm" disabled={renaming} onClick={() => handleRename(p)}>
                                    {renaming ? t('action.saving') : 'Save'}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={cancelRename}>
                                    {t('action.cancel')}
                                  </Button>
                                </>
                              ) : (
                                <>
                                  {mayEdit && (
                                    <button
                                      type="button"
                                      onClick={() => startRename(p)}
                                      aria-label={t('pos.renameAria', { name: p.name })}
                                      className="p-1 text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {mayDelete && (
                                    // THE REASON IS ON THE ROW, not in a message above a table
                                    // the row may have scrolled out of. A position that
                                    // somebody holds cannot be removed — the action refuses —
                                    // and a bin that answers that from fifteen rows away reads
                                    // as a dead button. Disabled WITH a stated reason, which is
                                    // the sibling's pattern: "a greyed-out bin with nothing
                                    // beside it reads as a bug".
                                    <button
                                      type="button"
                                      disabled={p.holders > 0 || busyId !== null}
                                      onClick={() => handleDelete(p)}
                                      title={p.holders > 0
                                        ? t(p.holders === 1
                                            ? 'pos.heldBlockTitleOne'
                                            : 'pos.heldBlockTitleMany',
                                          { n: String(p.holders) })
                                        : undefined}
                                      aria-label={p.holders > 0
                                        ? t(p.holders === 1
                                            ? 'pos.cannotRemoveAriaOne'
                                            : 'pos.cannotRemoveAriaMany',
                                          { name: p.name, n: String(p.holders) })
                                        : t('pos.removeAria', { name: p.name })}
                                      className="p-1 text-destructive transition-colors hover:text-destructive/80 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-60"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── ADDING A POSITION IS A DIALOG, NOT AN INLINE PANEL ──────────────────────
          It was a bordered `<form>` that unfolded above the table until 2026-08-20, and the
          move is worth arguing because the inline version was not obviously worse:

          IT PUSHED THE TABLE DOWN. Three fields, a hint and two buttons is about 170px, so
          opening the form scrolled every existing position out of view — on the screen whose
          whole job is "what does this family already have?", which is the question somebody
          adding a position is in the middle of answering. Below `sm` it was worse: the three
          fields stack, and the table started off the bottom of the phone.

          IT ALSO DISAGREED WITH ITS OWN NEIGHBOUR. Assigning somebody to a position has always
          been a dialog on this screen, so the two create-shaped actions on one page opened two
          different ways. Now both are dialogs and the page has one idiom.

          The form ELEMENT survives inside it, for the reason the note it replaces gave: a real
          `<form>` is what makes Enter in the name box submit, and it was a `<div>` for an
          afternoon during which Enter did nothing at all. */}
      <Dialog
        open={showAdd && mayCreate}
        onClose={closeAdd}
        title={t('pos.addTitle')}
        description={t('pos.addHint')}
        className="max-w-lg"
      >
        <form onSubmit={e => { e.preventDefault(); void handleCreate() }} className="mt-2 space-y-3">
          <div className="space-y-1.5">
            <Label required htmlFor="position-name">{t('pos.position')}</Label>
            <Input
              id="position-name"
              placeholder={t('pos.namePh')}
              value={form.name}
              maxLength={POSITION_NAME_MAX}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setNameError(''); setCreateError('') }}
            />
            <FieldError message={nameError} />
          </div>

          {/* SIDE BY SIDE FROM `sm`, STACKED BELOW IT. Two selects fit a dialog's measure at
              every width the app supports; the three-across grid this replaced only ever had
              room because it spanned the page. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="position-category">{t('common.category')}</Label>
              <Select
                id="position-category"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as PositionCategory }))}
              >
                {POSITION_CATEGORIES.map(c => (
                  <option key={c} value={c}>{positionCategoryLabel(t, c)}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="position-scope">{t('common.scope')}</Label>
              <Select
                id="position-scope"
                value={form.scope}
                onChange={e => setForm(f => ({ ...f, scope: e.target.value as PositionScope }))}
              >
                {POSITION_SCOPES.map(s => (
                  <option key={s} value={s}>{positionScopeLabel(t, s)}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* THE SECOND SENTENCE IS NEW, and it is the whole of what 20260820000000 bought.
              The uniqueness key is `(family_code, name, scope)` now rather than
              `(family_code, name)`, so a family with a national President and a President in
              each region no longer has to invent "Regional President" for one of them. Nobody
              would guess that from a Scope select, and the refusal it replaces — "your family
              already has a position called President" — was the product forcing a workaround
              and then printing it on the screen. */}
          <p className="text-xs text-muted-foreground">
            A <strong>{t('pos.regional')}</strong> or <strong>{t('field.chapter')}</strong> position is held for one
            region or one chapter, and you choose which when you give it to somebody. The same
            title can exist once at each scope — a national <strong>{t('pos.president')}</strong> and a
            regional <strong>{t('pos.president')}</strong> are two positions.
          </p>

          <FormError message={createError} />

          {/* THE BUTTONS ARE THE DIALOG'S LAST ROW and keep the page's affirm-then-outline
              order. `justify-end` rather than the inline form's `flex gap-2`, which is the
              convention every other dialog in the tree follows. */}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={closeAdd}>{t('action.cancel')}</Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('action.adding') : t('pos.add')}
            </Button>
          </div>
        </form>
      </Dialog>

    </div>
  )
}
