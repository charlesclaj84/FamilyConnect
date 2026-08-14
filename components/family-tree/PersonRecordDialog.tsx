'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, Mail } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/ui/form-message'
import { GENDERS, GENDER_LABELS } from '@/lib/gender'
import { cn } from '@/lib/utils'
import {
  editPersonRecord, invitePersonRecord, setRelationshipKind, setRelationshipType,
  type TreeEdge, type TreePerson,
} from '@/app/actions/family-tree'
import {
  LINK_KINDS, SPOUSE_TYPES, linkKindLabel, relationshipMeta, type LinkKind,
} from '@/lib/family-tree'

/**
 * Managing somebody on the tree who has no account.
 *
 * ── WHAT THIS REPLACED ──────────────────────────────────────────────────────────────
 * `/direct-lineage`, where a child was a record its parent owned and "Convert to Adult"
 * was a button that flipped `people.is_minor` and wrote an email address onto the row.
 * Both halves of that are gone, and this dialog is where each of them landed:
 *
 *   Details    anybody in the family may correct a record nobody has claimed. Not just
 *              its creator — a tree is built collaboratively, and `created_by` leaves a
 *              record frozen the day its author leaves the family.
 *   Invite     the honest version of "convert to adult". It sends a real invitation and
 *              they join the approvals queue; nobody becomes a member because a column
 *              changed. When they accept, the account attaches to THIS record rather
 *              than making a second one, so the tree edges around them survive.
 *
 * ── WHY THE EMAIL FIELD IS NOT IN THE DETAILS HALF ──────────────────────────────────
 * A record here carries a GENERATED address plus `email_is_placeholder` and a stated
 * reason. Typing a real address into the details form would leave those two flags
 * describing an address that is no longer generated — and anything that checks before
 * mailing would then refuse a mailbox that works. So the address is only ever changed by
 * redeeming an invitation, which is the one path that clears both flags at the moment the
 * account attaches. `editPersonRecord` drops `primary_email` server-side too; this is the
 * UI agreeing with it rather than the enforcement.
 *
 * ── GENDER IS HERE ON PURPOSE ───────────────────────────────────────────────────────
 * It is not decoration on a tree: it decides which of the Father/Mother slots is filled,
 * and it is what lets `inverseTypeFor` name the edge pointing back — "Samuel has a
 * Daughter, Martha" rather than a nameless link. A record entered without one is the
 * common case, and this is where it gets fixed.
 *
 * THE DIALOG IS ONLY MOUNTED FOR SOMEBODY WITH NO ACCOUNT, so its state initializers run
 * fresh per opening (same reasoning as `AddRelativeDialog`) and there is no effect
 * re-imposing a default while it is up.
 */
export function PersonRecordDialog({
  open, onClose, person, name, edge, edgeLabel, focusName, spouseEdge, spouseType,
}: {
  open: boolean
  onClose: () => void
  person: TreePerson
  /** The disambiguated name, so two Martha Allens are told apart in the title. */
  name: string
  /**
   * The connection this card was reached by, when there is one. Given only for a
   * non-marriage edge — a marriage is never blood and the database corrects it anyway
   * (`person_relationships_marriage_is_not_blood`), so offering the choice would be
   * offering a control that does nothing.
   */
  edge?: TreeEdge
  /** "Son", "Daughter", "Father" — what the relationship is called. */
  edgeLabel?: string
  /** Whose son/daughter: the focus person's name, for the sentence. */
  focusName?: string
  /**
   * A MARRIAGE, when this card was reached by one. Its own prop rather than reusing
   * `edge`, because the two offer opposite controls: a marriage can be renamed (Wife to
   * Ex-Wife) and cannot be made blood; everything else is the other way round.
   */
  spouseEdge?: TreeEdge
  /** The current `relationship_types.name` on `spouseEdge` — 'Wife', 'Ex-Husband'. */
  spouseType?: string
}) {
  const router = useRouter()
  const [kind, setKind] = useState<LinkKind>(edge?.kind ?? 'blood')
  const [kindSaved, setKindSaved] = useState(false)
  const [spouse, setSpouse] = useState(spouseType ?? '')
  const [spouseSaved, setSpouseSaved] = useState(false)
  const [firstName, setFirstName] = useState(person.firstName ?? '')
  const [lastName, setLastName] = useState(person.lastName ?? '')
  const [nickName, setNickName] = useState(person.nickName ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(person.dateOfBirth ?? '')
  const [gender, setGender] = useState(person.gender ?? '')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [invited, setInvited] = useState<{ emailed: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  function close() {
    onClose()
    setError('')
    setSaved(false)
    setKindSaved(false)
    setInvited(null)
    setEmail('')
  }

  function saveSpouseType(next: string) {
    if (!spouseEdge) return
    const previous = spouse
    setSpouse(next)
    setError('')
    setSpouseSaved(false)
    startTransition(async () => {
      // `person.id` is the subject: the word describes the person on this card. The edge
      // may have been reached from either end and the action turns it round if needed —
      // see the parameter's note there.
      const r = await setRelationshipType(spouseEdge.id, next, person.id)
      if (!r.success) {
        setError(r.message ?? 'Could not change that connection.')
        setSpouse(previous)   // put the control back where the database still is
        return
      }
      setSpouseSaved(true)
      router.refresh()
    })
  }

  function saveKind(next: LinkKind) {
    if (!edge) return
    setKind(next)
    setError('')
    setKindSaved(false)
    startTransition(async () => {
      const r = await setRelationshipKind(edge.id, next)
      if (!r.success) {
        setError(r.message ?? 'Could not change that connection.')
        setKind(edge.kind)   // put the control back where the database still is
        return
      }
      setKindSaved(true)
      router.refresh()
    })
  }

  function saveDetails() {
    setError('')
    setSaved(false)
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter a first and last name')
      return
    }
    startTransition(async () => {
      const r = await editPersonRecord(person.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        // Empty means "not recorded", and the columns are nullable — '' would be a
        // birthday of the empty string, which `computeIsMinor` and every date format
        // helper would then have to defend against.
        nick_name: nickName.trim() || null,
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
      })
      if (!r.success) { setError(r.message ?? 'Could not save that.'); return }
      setSaved(true)
      router.refresh()
    })
  }

  function invite() {
    setError('')
    startTransition(async () => {
      const r = await invitePersonRecord(person.id, email)
      if (!r.success) { setError(r.message ?? 'Could not invite them.'); return }
      setInvited({ emailed: Boolean(r.emailed) })
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={`Manage ${name}`}
      description={person.hasAccount
        ? 'They manage their own profile, so only the connection is yours to change.'
        : 'They have no account, so anyone in the family can keep this record right.'}
    >
      <div className="space-y-6">
        {/* A MARRIAGE — the word for it, which is the one thing about a spouse card that
            is always somebody's to change. Blood is not offered here: a marriage never
            carries it and the database says so
            (`person_relationships_marriage_is_not_blood`). */}
        {spouseEdge && (
          <div className="space-y-2">
            <Label>
              {focusName ? `How is ${name} related to ${focusName}?` : 'What is this relationship?'}
            </Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {SPOUSE_TYPES.map(t => {
                const active = spouse === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => saveSpouseType(t)}
                    disabled={isPending}
                    aria-pressed={active}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-60',
                      active
                        ? 'border-brand-primary bg-brand-soft text-brand-on-soft'
                        : 'border-input text-muted-foreground hover:border-brand-primary/40 hover:text-foreground',
                    )}
                  >
                    {relationshipMeta(t)?.label ?? t}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              A former marriage stays on the tree beside {focusName ?? 'them'} — it is
              usually where half the children came from.
              {spouseSaved && <span className="ml-1 font-medium text-brand-affirm">Saved.</span>}
            </p>
          </div>
        )}

        {/* HOW THEY ARE RELATED — first, because it is the half that is offered for
            everybody. The details below are only editable for somebody with no account,
            so for a member with one this is the whole dialog. */}
        {edge && (
          <div className="space-y-2">
            <Label htmlFor="link-kind">
              {focusName ? `How is ${name} ${focusName}'s ${(edgeLabel ?? 'relative').toLowerCase()}?` : 'How are they related?'}
            </Label>
            <div className="grid gap-2 sm:grid-cols-4">
              {LINK_KINDS.map(k => {
                const active = kind === k
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => saveKind(k)}
                    disabled={isPending}
                    aria-pressed={active}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-xs font-medium capitalize transition-colors disabled:opacity-60',
                      active
                        ? 'border-brand-primary bg-brand-soft text-brand-on-soft'
                        : 'border-input text-muted-foreground hover:border-brand-primary/40 hover:text-foreground',
                    )}
                  >
                    {k}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {kind === 'blood'
                ? `Blood relatives appear in the Bloodline view. ${edgeLabel ? `Recorded as ${linkKindLabel(kind, edgeLabel)}.` : ''}`
                : `Only blood relatives appear in the Bloodline view, so ${name} will not. ${edgeLabel ? `Recorded as ${linkKindLabel(kind, edgeLabel)}.` : ''}`}
              {kindSaved && <span className="ml-1 font-medium text-brand-affirm">Saved.</span>}
            </p>
          </div>
        )}

        {!person.hasAccount && (
        <form
          className="space-y-4"
          onSubmit={e => { e.preventDefault(); saveDetails() }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="record-first">First name</Label>
              <Input
                id="record-first"
                value={firstName}
                onChange={e => { setFirstName(e.target.value); setSaved(false) }}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="record-last">Last name</Label>
              <Input
                id="record-last"
                value={lastName}
                onChange={e => { setLastName(e.target.value); setSaved(false) }}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="record-nick">Nickname</Label>
              <Input
                id="record-nick"
                value={nickName}
                onChange={e => { setNickName(e.target.value); setSaved(false) }}
                placeholder="Optional"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="record-dob">Date of birth</Label>
              <Input
                id="record-dob"
                type="date"
                value={dateOfBirth}
                onChange={e => { setDateOfBirth(e.target.value); setSaved(false) }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="record-gender">Gender</Label>
            <select
              id="record-gender"
              value={gender}
              onChange={e => { setGender(e.target.value); setSaved(false) }}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            >
              <option value="">Not stated</option>
              {GENDERS.map(g => (
                <option key={g} value={g}>{GENDER_LABELS[g]}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              This decides whether they fill the father or the mother slot, and lets us
              name the connection back to them.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-brand-affirm" aria-hidden="true" />
                Saved
              </span>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? 'Saving…' : 'Save details'}
            </button>
          </div>
        </form>
        )}

        {!person.hasAccount && (
        <div className="border-t pt-5">
          {!invited ? (
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); invite() }}>
              <div className="space-y-1.5">
                <Label htmlFor="record-email">Invite them</Label>
                <Input
                  id="record-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="them@example.com"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Got an email address now? Send them an invitation. When they accept it,
                their account joins <em>this</em> card instead of making a second one —
                everything you have drawn around them stays. An administrator approves
                them, the same as anybody joining from My Families.
              </p>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isPending || !email.trim()}
                  className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
                >
                  {isPending ? 'Inviting…' : 'Send invitation'}
                </button>
              </div>
            </form>
          ) : (
            /* Two separable facts, reported separately — an invitation can be minted and
               the email still fail (lib/email/README.md), and telling somebody their
               cousin was contacted when nothing went is the failure that costs most. */
            <div
              className={cn(
                'flex items-start gap-2 rounded-xl border px-4 py-3 text-sm',
                invited.emailed ? 'bg-muted/40' : 'border-destructive/30 bg-destructive/10',
              )}
            >
              {invited.emailed
                ? <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />}
              <p className={invited.emailed ? 'text-muted-foreground' : ''}>
                {invited.emailed
                  ? 'We emailed them an invitation. When they accept it, their account joins this card.'
                  : 'The invitation was created but we could not email it. Resend it from Admin › Members › Pending Approval.'}
              </p>
            </div>
          )}
        </div>
        )}

        <FormError message={error} />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Done
          </button>
        </div>
      </div>
    </Dialog>
  )
}
