'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm'
import { FormError, FieldError } from '@/components/ui/form-message'
import { COLLAPSING_CELL, RowMeta, MetaDot } from '@/components/ui/table-collapse'
import { PersonPicker } from '@/components/ui/person-picker'
import { useServerState } from '@/lib/use-server-state'
import { cn } from '@/lib/utils'
import {
  createBoardPosition, renameBoardPosition, deleteBoardPosition,
  assignBoardPosition, revokeBoardPosition,
  type BoardPosition, type BoardPositionHolder, type AssignableMember,
} from '@/app/actions/admin/chapters'
import {
  POSITION_CATEGORIES, POSITION_SCOPES, POSITION_NAME_MAX,
  POSITION_CATEGORY_LABELS as CATEGORY_LABELS,
  POSITION_SCOPE_LABELS as SCOPE_LABELS,
  type PositionCategory, type PositionScope,
} from '@/lib/board-positions'

/**
 * Board Positions — the family's list of offices, and who holds each.
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
 * `members`, `regions` and `chapters` are empty for a caller who cannot assign, because they
 * exist only to fill the dialog and a roster is PII in the RSC payload (§5).
 */

/**
 * Where a scoped assignment sits, as one phrase.
 *
 * A national position reads "National" rather than an em-dash, because it is somewhere rather
 * than nowhere — the same word `MemberRecord.region_name`'s absence prints and the same word a
 * nationally scoped due uses. The fall-backs ('Chapter', 'Regional') are for a name the read
 * could not resolve, which `getBoardPositionHolders` can only produce for a chapter or region
 * deleted between its five queries.
 */
function whereOf(h: BoardPositionHolder): string {
  if (h.scope === 'chapter') return h.chapter_name ? `${h.chapter_name} Chapter` : 'Chapter'
  if (h.scope === 'regional') return h.region_name ? `${h.region_name} Region` : 'Regional'
  return 'National'
}

export function AdminBoardPositionsClient({
  initialPositions, initialHolders, members, regions, chapters,
  mayCreate, mayEdit, mayDelete,
}: {
  initialPositions: BoardPosition[]
  initialHolders: BoardPositionHolder[]
  members: AssignableMember[]
  regions: { id: string; name: string }[]
  chapters: { id: string; name: string }[]
  mayCreate: boolean
  mayEdit: boolean
  mayDelete: boolean
}) {
  const router = useRouter()
  const confirm = useConfirm()

  // `useServerState`: every write here refreshes rather than building a row, so adopting the
  // refreshed props is what makes a new position and a new assignment appear. Switching
  // family remounts the whole page through the layout key, so neither list can be stale for
  // the family the caller just left.
  const [positions] = useServerState(initialPositions)
  const [holders]   = useServerState(initialHolders)

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

  const [assignTo, setAssignTo]     = useState<BoardPosition | null>(null)
  const [assignPerson, setAssignPerson] = useState('')
  const [assignWhere, setAssignWhere]   = useState('')
  const [assignError, setAssignError]   = useState('')
  const [assigning, setAssigning]   = useState(false)

  const holdersByPosition = useMemo(() => {
    const out = new Map<string, BoardPositionHolder[]>()
    for (const h of holders) {
      const list = out.get(h.position_id)
      if (list) list.push(h)
      else out.set(h.position_id, [h])
    }
    return out
  }, [holders])

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
    if (!result.success) { setCreateError(result.error ?? 'Could not add that position'); return }
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
    if (!result.success) { setRenameError(result.error ?? 'Could not rename that position'); return }
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
        `${position.holders} ${position.holders === 1 ? 'person holds' : 'people hold'} `
        + `"${position.name}". Take it away from them first.`,
      )
      return
    }
    const ok = await confirm({
      title: 'Remove position',
      description: `Remove "${position.name}" from the positions your family keeps? `
        + 'Nothing else about the family changes.',
      confirmLabel: 'Remove position',
      destructive: true,
    })
    if (!ok) return
    setBusyId(position.id)
    const result = await deleteBoardPosition(position.id)
    setBusyId(null)
    // The action REFUSES while anybody holds the position, and says how many — so this
    // message is information rather than a failure, and it belongs beside the table it is
    // about rather than in a dialog that has already closed.
    if (!result.success) { setListError(result.error ?? 'Could not remove that position'); return }
    router.refresh()
  }

  function openAssign(position: BoardPosition) {
    setAssignTo(position)
    setAssignPerson('')
    setAssignWhere('')
    setAssignError('')
  }

  async function handleAssign() {
    if (!assignTo) return
    if (!assignPerson) { setAssignError('Choose who holds it'); return }
    setAssigning(true)
    setAssignError('')
    const result = await assignBoardPosition({
      positionId: assignTo.id,
      personId:   assignPerson,
      chapterId:  assignTo.scope === 'chapter'  ? assignWhere || null : null,
      regionId:   assignTo.scope === 'regional' ? assignWhere || null : null,
    })
    setAssigning(false)
    if (!result.success) { setAssignError(result.error ?? 'Could not assign that position'); return }
    setAssignTo(null)
    router.refresh()
  }

  async function handleRevoke(holder: BoardPositionHolder) {
    if (busyId) return
    setListError('')
    const ok = await confirm({
      title: 'Take away position',
      description: `Take "${holder.position_name}" away from ${holder.person_name}? `
        + 'They stay a member of the family.',
      confirmLabel: 'Take it away',
      destructive: true,
    })
    if (!ok) return
    setBusyId(holder.assignment_id)
    const result = await revokeBoardPosition(holder.assignment_id)
    setBusyId(null)
    if (!result.success) { setListError(result.error ?? 'Could not take that position away'); return }
    router.refresh()
  }

  const scopeNeedsPlace = assignTo?.scope === 'chapter' || assignTo?.scope === 'regional'
  const placeOptions    = assignTo?.scope === 'chapter' ? chapters : regions

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
                <Plus className="h-3.5 w-3.5" /> Add Position
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormError message={listError} />

          {positions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {mayCreate
                ? 'No positions yet. Add the offices your family keeps — President, Treasurer, a Reunion Chair, whatever you actually have.'
                : 'Your family has not set up any board positions yet.'}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2">Position</th>
                    <th scope="col" className={cn('px-3 py-2', COLLAPSING_CELL)}>Category</th>
                    <th scope="col" className={cn('px-3 py-2', COLLAPSING_CELL)}>Scope</th>
                    <th scope="col" className="px-3 py-2">Held by</th>
                    {(mayEdit || mayDelete) && (
                      <th scope="col" className="px-3 py-2 text-right"><span className="sr-only">Actions</span></th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {positions.map(p => {
                    const held = holdersByPosition.get(p.id) ?? []
                    const editing = editingId === p.id
                    return (
                      <tr key={p.id} className="align-top sm:align-middle">
                        <td className="px-3 py-2 font-medium">
                          {editing ? (
                            <div className="space-y-1.5">
                              <Input
                                aria-label={`Rename the ${p.name} position`}
                                value={editingName}
                                maxLength={POSITION_NAME_MAX}
                                autoFocus
                                onChange={e => { setEditingName(e.target.value); setRenameError('') }}
                                // Enter saves and Escape cancels, because a text box inside a
                                // table row is not a form and would otherwise have no keyboard
                                // path at all — Enter here would submit nothing.
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); void handleRename(p) }
                                  if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
                                }}
                              />
                              <FieldError message={renameError} />
                            </div>
                          ) : (
                            <>
                              {p.name}
                              <RowMeta>
                                <span>{CATEGORY_LABELS[p.category]}</span>
                                <MetaDot />
                                <span>{SCOPE_LABELS[p.scope]}</span>
                              </RowMeta>
                            </>
                          )}
                        </td>
                        <td className={cn('px-3 py-2 text-muted-foreground', COLLAPSING_CELL)}>
                          {CATEGORY_LABELS[p.category]}
                        </td>
                        <td className={cn('px-3 py-2 text-muted-foreground', COLLAPSING_CELL)}>
                          {SCOPE_LABELS[p.scope]}
                        </td>
                        <td className="px-3 py-2">
                          {held.length === 0
                            ? <span className="text-muted-foreground">Nobody yet</span>
                            : (
                              <ul className="space-y-0.5">
                                {held.map(h => (
                                  <li key={h.assignment_id} className="flex items-center gap-1.5">
                                    <span>{h.person_name}</span>
                                    <span className="text-xs text-muted-foreground">{whereOf(h)}</span>
                                    {mayEdit && (
                                      // `p-1` and not a bare glyph. A 14px hit target on a
                                      // destructive control is the mis-tap AGENTS.md makes the
                                      // argument about for `PersonMultiSelect`'s chips, and
                                      // these sit one line apart in a list of officers.
                                      <button
                                        type="button"
                                        disabled={busyId !== null}
                                        onClick={() => handleRevoke(h)}
                                        aria-label={`Take ${h.position_name} away from ${h.person_name}`}
                                        className="-my-1 p-1 text-destructive transition-colors hover:text-destructive/80 disabled:opacity-50"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
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
                                    {renaming ? 'Saving…' : 'Save'}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={cancelRename}>
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  {mayEdit && (
                                    <button
                                      type="button"
                                      onClick={() => startRename(p)}
                                      aria-label={`Rename the ${p.name} position`}
                                      className="p-1 text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {mayEdit && (
                                    <Button size="sm" variant="outline" onClick={() => openAssign(p)}>
                                      <UserPlus className="h-3.5 w-3.5" /> Assign
                                    </Button>
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
                                        ? `${p.holders} ${p.holders === 1 ? 'person holds' : 'people hold'} this — take it away from them first`
                                        : undefined}
                                      aria-label={p.holders > 0
                                        ? `Cannot remove the ${p.name} position: ${p.holders} ${p.holders === 1 ? 'person holds' : 'people hold'} it`
                                        : `Remove the ${p.name} position`}
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
        title="Add a board position"
        description="An office your family keeps. You choose who holds it afterwards."
        className="max-w-lg"
      >
        <form onSubmit={e => { e.preventDefault(); void handleCreate() }} className="mt-2 space-y-3">
          <div className="space-y-1.5">
            <Label required htmlFor="position-name">Position</Label>
            <Input
              id="position-name"
              placeholder="e.g. Reunion Treasurer"
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
              <Label htmlFor="position-category">Category</Label>
              <Select
                id="position-category"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as PositionCategory }))}
              >
                {POSITION_CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="position-scope">Scope</Label>
              <Select
                id="position-scope"
                value={form.scope}
                onChange={e => setForm(f => ({ ...f, scope: e.target.value as PositionScope }))}
              >
                {POSITION_SCOPES.map(s => (
                  <option key={s} value={s}>{SCOPE_LABELS[s]}</option>
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
            A <strong>Regional</strong> or <strong>Chapter</strong> position is held for one
            region or one chapter, and you choose which when you give it to somebody. The same
            title can exist once at each scope — a national <strong>President</strong> and a
            regional <strong>President</strong> are two positions.
          </p>

          <FormError message={createError} />

          {/* THE BUTTONS ARE THE DIALOG'S LAST ROW and keep the page's affirm-then-outline
              order. `justify-end` rather than the inline form's `flex gap-2`, which is the
              convention every other dialog in the tree follows. */}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={closeAdd}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Adding…' : 'Add Position'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={assignTo !== null}
        onClose={() => setAssignTo(null)}
        title={assignTo ? `Assign ${assignTo.name}` : 'Assign position'}
        description={assignTo
          ? `A ${SCOPE_LABELS[assignTo.scope].toLowerCase()} ${CATEGORY_LABELS[assignTo.category].toLowerCase()}.`
          : undefined}
      >
        <div className="mt-2 space-y-4">
          {/* ACCOUNTS ONLY, and the copy says so rather than letting somebody hunt for a
              relative who cannot appear: `user_roles` keys its holder on an auth account, so
              a recorded grandmother has nothing to attach a position to. */}
          <PersonPicker
            people={members}
            value={assignPerson}
            onChange={next => { setAssignPerson(next); setAssignError('') }}
            label="Who holds it"
            hint="Only relatives who have finished registering can hold a position."
            emptyMessage="Nobody in this family has an account yet."
          />

          {scopeNeedsPlace && (
            <div className="space-y-1.5">
              {/* THE LABEL ONLY EXISTS WHEN ITS CONTROL DOES. `<Label required htmlFor>` was
                  rendered unconditionally, so a family with no chapters got a dead click
                  target and an `sr-only` "(required)" for a `<Select>` that is not in the
                  document. */}
              {placeOptions.length > 0 && (
                <Label required htmlFor="assign-where">
                  {assignTo?.scope === 'chapter' ? 'Chapter' : 'Region'}
                </Label>
              )}
              {placeOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Your family has no {assignTo?.scope === 'chapter' ? 'chapters' : 'regions'} yet, so
                  this position cannot be given to anybody until it does. Set them up under
                  Members &amp; Access → Organization.
                </p>
              ) : (
                <Select
                  id="assign-where"
                  value={assignWhere}
                  onChange={e => { setAssignWhere(e.target.value); setAssignError('') }}
                >
                  <option value="">Choose one…</option>
                  {placeOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              )}
            </div>
          )}

          {/* The message sits with the button rather than with the field it is about, which
              is the rule in AGENTS.md and is what this dialog's own layout enforces: the body
              scrolls, so a message beside the picker can be off-screen at the moment somebody
              presses Assign again. */}
          <FormError message={assignError} />
          <div className="flex gap-2 pt-1">
            {/* Disabled when the position needs a place and the family has none, rather than
                round-tripping to the server to be told to choose from an empty list — under a
                paragraph that has just explained there is nothing to choose. */}
            <Button
              className="flex-1"
              disabled={assigning || (scopeNeedsPlace && placeOptions.length === 0)}
              onClick={handleAssign}
            >
              {assigning ? 'Assigning…' : 'Assign'}
            </Button>
            <Button variant="outline" onClick={() => setAssignTo(null)}>Cancel</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
