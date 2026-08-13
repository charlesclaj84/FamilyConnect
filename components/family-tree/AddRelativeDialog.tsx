'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck, Mail, FileText, AlertTriangle, Check } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormError } from '@/components/ui/form-message'
import { PersonPicker } from '@/components/ui/person-picker'
import { cn } from '@/lib/utils'
import { addRelative, type AddRelativeMode, type TreePerson } from '@/app/actions/family-tree'
import { relationshipMeta } from '@/lib/family-tree'

/**
 * Adding one relative to somebody already on the tree.
 *
 * ── THREE WAYS IN, RANKED ───────────────────────────────────────────────────────────
 * The order of the modes is the order of preference, and the ranking is the design rather
 * than a layout accident:
 *
 *   Someone already here    Free, instant, and creates nothing. Most additions in a real
 *                           family are this — the tree is being drawn over people who
 *                           already have accounts.
 *   Invite them             Creates the record now and emails an invitation. They join
 *                           the approvals queue exactly as they would from My Families;
 *                           putting somebody on a tree is not a decision about who gets
 *                           into the family.
 *   Record without an email LAST, and worded as the exception it is. For the dead, for
 *                           elders with no address, and for children.
 *
 * ── WHY THE THIRD ONE ASKS FOR A REASON ─────────────────────────────────────────────
 * Because it is the escape hatch from "every relative gets invited", and an escape hatch
 * with no friction becomes the default route — a family would end up with forty synthetic
 * addresses and no record of why any of them exists. One sentence is the difference
 * between a tree somebody can audit later and one nobody can.
 *
 * The address is generated (`{familycode}_{first}_{last}_{8 hex}@genorra.com`) and the
 * dialog SHOWS IT on success rather than hiding it, because the member will meet it again
 * in the Directory and an address nobody explained reads as a bug.
 *
 * ── WHAT THE SUCCESS SCREEN MAY CLAIM ───────────────────────────────────────────────
 * Only what the server reported. `invited` and `emailed` come back separately for the
 * reason `InviteMemberDialog` keeps them separate: mail sending fails soft, and a screen
 * that says "invitation sent" over a message that did not go leaves one person believing
 * their cousin was contacted and the cousin waiting on nothing.
 */

const MODES: { id: AddRelativeMode; label: string; hint: string; icon: typeof UserCheck }[] = [
  {
    id: 'existing',
    label: 'Someone already here',
    hint: 'Link a relative who is already in your family.',
    icon: UserCheck,
  },
  {
    id: 'invite',
    label: 'Invite them',
    hint: 'We email an invitation. They join once an administrator approves them.',
    icon: Mail,
  },
  {
    id: 'record',
    label: 'No email address',
    hint: 'Record them without one — for relatives who have passed, elders, and children.',
    icon: FileText,
  },
]

export function AddRelativeDialog({
  open, onClose, anchor, relationshipType, candidates,
}: {
  open: boolean
  onClose: () => void
  /** The person the relative is being attached TO. */
  anchor: TreePerson
  /** A `relationship_types.name` from TREE_RELATIONSHIPS. */
  relationshipType: string
  /** Everyone eligible to be linked — the roster minus the anchor and existing relatives. */
  candidates: TreePerson[]
}) {
  const router = useRouter()
  const [mode, setMode] = useState<AddRelativeMode>('existing')
  const [existingPersonId, setExistingPersonId] = useState('')
  const [firstName, setFirstName] = useState('')
  // Seeded from the anchor, and this initializer really does run per opening: the canvas
  // mounts the dialog only while `adding` is set, so closing it unmounts the component
  // and the next open starts a fresh one. That is why the prefill does not need an effect
  // and why editing it survives — nothing re-imposes the default while the dialog is up.
  const [lastName, setLastName] = useState(anchor.lastName ?? '')
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    invited: boolean; emailed: boolean; placeholderEmail?: string; name: string
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  const meta = relationshipMeta(relationshipType)
  const anchorName = `${anchor.firstName} ${anchor.lastName}`.trim() || 'this person'
  const relationLabel = meta?.label.toLowerCase() ?? 'relative'

  // The surname prefill is a GUESS and an editable one — most relatives added to a tree
  // share it, and a field somebody retypes forty times is a field that gets typed wrong.
  function reset() {
    setMode('existing')
    setExistingPersonId('')
    setFirstName('')
    setLastName(anchor.lastName ?? '')
    setEmail('')
    setReason('')
    setError('')
    setResult(null)
  }

  function close() {
    onClose()
    // Refresh only when something was created — otherwise a cancelled dialog would
    // discard optimistic state elsewhere on the page for nothing.
    if (result) router.refresh()
    reset()
  }

  const complete =
    mode === 'existing' ? Boolean(existingPersonId)
      : mode === 'invite' ? Boolean(firstName.trim() && lastName.trim() && email.trim())
        : Boolean(firstName.trim() && lastName.trim() && reason.trim())

  function submit() {
    setError('')
    const name = `${firstName.trim()} ${lastName.trim()}`.trim()
    startTransition(async () => {
      const r = await addRelative({
        anchorPersonId: anchor.id,
        relationshipType,
        mode,
        existingPersonId,
        firstName,
        lastName,
        email,
        noEmailReason: reason,
      })
      if (!r.success) { setError(r.message); return }
      setResult({
        invited: r.invited,
        emailed: r.emailed,
        placeholderEmail: r.placeholderEmail,
        name: mode === 'existing'
          ? (candidates.find(c => c.id === existingPersonId)
            ? `${candidates.find(c => c.id === existingPersonId)!.firstName} ${candidates.find(c => c.id === existingPersonId)!.lastName}`.trim()
            : 'They')
          : name,
      })
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={result ? 'Added to the tree' : `Add ${anchorName}'s ${relationLabel}`}
      description={result ? undefined : 'Choose how this person joins the tree.'}
    >
      {!result && (
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); submit() }}>
          {/* The three modes as a segmented control rather than a <select>: they are not
              interchangeable options, they are three different amounts of commitment, and
              each needs a sentence saying what it does. Same treatment the announcement
              composer gives its audience picker. */}
          <div className="space-y-2">
            <Label>How</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {MODES.map(m => {
                const Icon = m.icon
                const active = mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setMode(m.id); setError('') }}
                    aria-pressed={active}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors',
                      active
                        ? 'border-brand-primary bg-brand-soft text-brand-on-soft'
                        : 'border-input text-muted-foreground hover:border-brand-primary/40 hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {m.label}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {MODES.find(m => m.id === mode)!.hint}
            </p>
          </div>

          {mode === 'existing' && (
            <PersonPicker
              people={candidates.map(c => ({
                id: c.id,
                first_name: c.firstName,
                last_name: c.lastName,
                nick_name: c.nickName,
                date_of_birth: c.dateOfBirth,
              }))}
              value={existingPersonId}
              onChange={setExistingPersonId}
              label={`Who is ${anchorName}'s ${relationLabel}?`}
              emptyMessage="Everyone in the family is already attached here. Invite somebody, or record them without an email."
            />
          )}

          {mode !== 'existing' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="relative-first">First name</Label>
                <Input
                  id="relative-first"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Ada"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="relative-last">Last name</Label>
                <Input
                  id="relative-last"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder={anchor.lastName || 'Okonkwo'}
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {mode === 'invite' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="relative-email">Email address</Label>
                <Input
                  id="relative-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="cousin@example.com"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                They go on the tree straight away. We&apos;ll email them an invitation, and
                when they accept it their account joins <em>this</em> card rather than
                making a second one. An administrator still approves them, the same as
                anybody joining from My Families.
              </p>
            </>
          )}

          {mode === 'record' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="relative-reason">Why is there no email address?</Label>
                <Textarea
                  id="relative-reason"
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Passed away in 1998 · No email, phone only · Too young for an account"
                />
              </div>
              <div className="flex items-start gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>
                  This should be rare. We generate an address so the record can exist, and
                  we never send anything to it — so this person cannot sign in, and nothing
                  will reach them. If they might ever want an account, invite them instead.
                </p>
              </div>
            </>
          )}

          <FormError message={error} />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !complete}
              className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? 'Adding…' : `Add ${relationLabel}`}
            </button>
          </div>
        </form>
      )}

      {result && (
        <div className="space-y-4">
          <p className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-affirm" aria-hidden="true" />
            <span>
              <span className="font-medium">{result.name}</span> is now {anchorName}&apos;s{' '}
              {relationLabel}.
            </span>
          </p>

          {/* Three separable facts, reported separately. Only the first is guaranteed by
              the time we get here; an invitation can fail after the record was made, and
              the email can fail after the invitation was minted. */}
          {mode === 'invite' && (
            <div
              className={cn(
                'flex items-start gap-2 rounded-xl border px-4 py-3 text-sm',
                result.emailed ? 'bg-muted/40' : 'border-destructive/30 bg-destructive/10',
              )}
            >
              {result.emailed
                ? <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
              <p className={result.emailed ? 'text-muted-foreground' : ''}>
                {result.emailed
                  ? 'We emailed them an invitation. When they accept it, their account joins this card.'
                  : result.invited
                    ? 'The invitation was created but we could not email it. Resend it from Admin › Members › Pending Approval.'
                    : 'They are on the tree, but we could not create an invitation — most often because that address is already in your family. Link the existing person instead.'}
              </p>
            </div>
          )}

          {result.placeholderEmail && (
            <div className="space-y-1.5 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
              <p className="text-muted-foreground">
                We generated an address so the record could exist. Nothing is ever sent to it.
              </p>
              <p className="break-all font-mono text-xs">{result.placeholderEmail}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={close}
              className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
