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
import { useT } from '@/components/layout/LocaleProvider'

/**
 * One connection this person has, as the dialog needs it.
 *
 * The EDGE plus the name and the word for the person at the other end — everything the
 * two controls need, resolved by the canvas where the adjacency and the disambiguated
 * names already are. Declared here rather than in the builder because this is the shape's
 * consumer; the builder imports the type.
 */
export interface TreeConnection {
  edge: TreeEdge
  /** The `people.id` at the far end. `edge.typeName` names THEM. */
  otherId: string
  otherName: string
  /** "Son", "Father", "Wife" — the word for the other person relative to this one. */
  label: string
}

/**
 * Managing somebody on the tree: how they are related, and — for a record nobody has
 * claimed — who they are.
 *
 * The two halves have different audiences. The connections are offered for EVERYBODY on
 * the canvas, member or record, because how two people are related is a fact about the
 * family; the details below them are editable only where there is no account, because a
 * member is the authority on their own name.
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
 * THE DIALOG IS MOUNTED PER SUBJECT — the canvas renders it only while `managing` holds a
 * person — so its state initializers run fresh per opening (same reasoning as
 * `AddRelativeDialog`) and there is no effect re-imposing a default while it is up. That
 * is what lets the connection controls be seeded straight from the edges.
 */
export function PersonRecordDialog({
  open, onClose, person, name, connections,
}: {
  open: boolean
  onClose: () => void
  person: TreePerson
  /** The disambiguated name, so two Martha Allens are told apart in the title. */
  name: string
  /**
   * EVERY connection this person has, in the canvas's own order.
   *
   * ── WHY ALL OF THEM AND NOT THE ONE THE CARD WAS REACHED BY ──────────────────────
   * This used to take a single `edge` — the link from the focus person — plus a separate
   * `spouseEdge`, and what could be corrected therefore depended on which card had been
   * clicked. A grandparent is drawn from their child's card and has no edge to the focus
   * at all, so their card offered nothing: there was no way anywhere in the product to
   * record that a grandmother was a step-grandmother, on the one screen whose Bloodline
   * toggle depends on that answer.
   *
   * Each connection gets the control its own relation admits, which is why they are one
   * list rather than two props: a marriage can be RENAMED (Wife to Ex-Wife) and can never
   * be blood — `person_relationships_marriage_is_not_blood` rewrites it if it claims to
   * be — and everything else is exactly the other way round.
   */
  connections: TreeConnection[]
}) {
  const t = useT()
  const router = useRouter()
  // Keyed by relationship id, so a person with four connections has four independent
  // controls and a save on one does not put the others back. Seeded from the edges and
  // corrected on refusal, which is what keeps a control showing what the database holds
  // rather than what was clicked.
  const [kinds, setKinds] = useState<Record<string, LinkKind>>(
    () => Object.fromEntries(connections.map(c => [c.edge.id, c.edge.kind])),
  )
  const [types, setTypes] = useState<Record<string, string>>(
    () => Object.fromEntries(
      connections.filter(c => c.edge.typeName).map(c => [c.edge.id, c.edge.typeName as string]),
    ),
  )
  const [savedId, setSavedId] = useState<string | null>(null)
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
    setSavedId(null)
    setInvited(null)
    setEmail('')
  }

  function saveType(connection: TreeConnection, next: string) {
    const previous = types[connection.edge.id] ?? ''
    setTypes(prev => ({ ...prev, [connection.edge.id]: next }))
    setError('')
    setSavedId(null)
    startTransition(async () => {
      // THE SUBJECT IS THE OTHER PERSON, because `next` is the word for them: the edge
      // points out of the person this dialog is about, and `typeName` on it names the far
      // end. The action turns the word round when the stored row runs the other way — see
      // `subjectPersonId` there, and note that getting this wrong is a SILENT inversion
      // rather than an error.
      const r = await setRelationshipType(connection.edge.id, next, connection.otherId)
      if (!r.success) {
        setError(r.message ?? t('rec.connectionFailed'))
        // Put the control back where the database still is.
        setTypes(prev => ({ ...prev, [connection.edge.id]: previous }))
        return
      }
      setSavedId(connection.edge.id)
      router.refresh()
    })
  }

  function saveKind(connection: TreeConnection, next: LinkKind) {
    setKinds(prev => ({ ...prev, [connection.edge.id]: next }))
    setError('')
    setSavedId(null)
    startTransition(async () => {
      const r = await setRelationshipKind(connection.edge.id, next)
      if (!r.success) {
        setError(r.message ?? t('rec.connectionFailed'))
        setKinds(prev => ({ ...prev, [connection.edge.id]: connection.edge.kind }))
        return
      }
      setSavedId(connection.edge.id)
      router.refresh()
    })
  }

  function saveDetails() {
    setError('')
    setSaved(false)
    if (!firstName.trim() || !lastName.trim()) {
      setError(t('rec.needNames'))
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
      if (!r.success) { setError(r.message ?? t('rec.saveFailed')); return }
      setSaved(true)
      router.refresh()
    })
  }

  function invite() {
    setError('')
    startTransition(async () => {
      const r = await invitePersonRecord(person.id, email)
      if (!r.success) { setError(r.message ?? t('rec.inviteFailed')); return }
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
        ? t('rec.theirOwnProfile')
        : t('rec.noAccountAnyone')}
    >
      <div className="space-y-6">
        {/* ── EVERY CONNECTION, EACH WITH THE CONTROL ITS RELATION ADMITS ────────────
            A marriage offers the WORD (Wife → Ex-wife) and never blood, because a
            marriage cannot carry it and the database rewrites one that says it does. Every
            other link offers the KIND, which is what the Bloodline view walks and the only
            way to say that a child is a step-child or that a grandmother married in.

            First in the dialog, because it is the half offered for everybody: the details
            below are editable only for somebody with no account, so for a member with one
            this is the whole dialog. */}
        {connections.length > 0 && (
          <div className="space-y-4">
            <div>
              <Label>{t('rec.howRelated', { name })}</Label>
              <p className="mt-1 text-xs text-muted-foreground">{t('ui.onlyBloodLinksCarry')}</p>
            </div>

            {connections.map(connection => {
              const isMarriage = connection.edge.relation === 'spouse'
              const kind = kinds[connection.edge.id] ?? connection.edge.kind
              const type = types[connection.edge.id] ?? ''
              const saved = savedId === connection.edge.id
              return (
                <div key={connection.edge.id} className="space-y-2 rounded-xl border px-3 py-3">
                  <p className="text-xs font-medium">
                    {/* WHO, THEN WHAT THEY ARE TO THIS PERSON. `label` names the far end
                        relative to the person this dialog is about — that is the direction
                        the edge itself carries — so it reads "Samuel Allen · Charles's
                        father". A bare "father" would be unreadable in a list of four. */}
                    {connection.otherName}
                    <span className="text-muted-foreground">
                      {' · '}{name}&apos;s {connection.label.toLowerCase()}
                    </span>
                  </p>

                  <div className={cn('grid gap-2', isMarriage ? 'sm:grid-cols-3' : 'sm:grid-cols-4')}>
                    {(isMarriage ? SPOUSE_TYPES : LINK_KINDS).map(option => {
                      const active = isMarriage ? type === option : kind === option
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => isMarriage
                            ? saveType(connection, option)
                            : saveKind(connection, option as LinkKind)}
                          disabled={isPending}
                          aria-pressed={active}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-60',
                            !isMarriage && 'capitalize',
                            active
                              ? 'border-brand-primary bg-brand-soft text-brand-on-soft'
                              : 'border-input text-muted-foreground hover:border-brand-primary/40 hover:text-foreground',
                          )}
                        >
                          {isMarriage ? (relationshipMeta(option)?.label ?? option) : option}
                        </button>
                      )
                    })}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {isMarriage
                      ? t('rec.formerMarriageNote', { name })
                      : t('rec.recordedAs', {
                          name,
                          kind: linkKindLabel(kind, connection.label).toLowerCase(),
                        })
                        + (kind === 'blood'
                          ? t('rec.bloodCarries')
                          : t('rec.noBloodThroughLink', {
                              name: connection.otherName,
                            }))}
                    {saved && <span className="ms-1 font-medium text-brand-affirm">{t('rec.saved')}</span>}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {!person.hasAccount && (
        <form
          className="space-y-4"
          onSubmit={e => { e.preventDefault(); saveDetails() }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="record-first">{t('field.firstNameLower')}</Label>
              <Input
                id="record-first"
                value={firstName}
                onChange={e => { setFirstName(e.target.value); setSaved(false) }}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="record-last">{t('field.lastNameLower')}</Label>
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
              <Label htmlFor="record-nick">{t('field.nickname')}</Label>
              <Input
                id="record-nick"
                value={nickName}
                onChange={e => { setNickName(e.target.value); setSaved(false) }}
                placeholder={t('common.optional')}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="record-dob">{t('field.dobLower')}</Label>
              <Input
                id="record-dob"
                type="date"
                value={dateOfBirth}
                onChange={e => { setDateOfBirth(e.target.value); setSaved(false) }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="record-gender">{t('field.gender')}</Label>
            <select
              id="record-gender"
              value={gender}
              onChange={e => { setGender(e.target.value); setSaved(false) }}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            >
              <option value="">{t('common.notStated')}</option>
              {GENDERS.map(g => (
                <option key={g} value={g}>{GENDER_LABELS[g]}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t('ui.decidesWhetherTheyFill')}</p>
          </div>

          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-brand-affirm" aria-hidden="true" />
                {t('rec.savedShort')}
              </span>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? t('action.saving') : t('rec.saveDetails')}
            </button>
          </div>
        </form>
        )}

        {!person.hasAccount && (
        <div className="border-t pt-5">
          {!invited ? (
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); invite() }}>
              <div className="space-y-1.5">
                <Label htmlFor="record-email">{t('rel.inviteThem')}</Label>
                <Input
                  id="record-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('field.ph.theirEmail')}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <p className="text-sm text-muted-foreground">{t('ui.gotEmailAddressNow')}<em>this</em> card instead of making a second one —
                everything you have drawn around them stays. An administrator approves
                them, the same as anybody joining from My Families.
              </p>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isPending || !email.trim()}
                  className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
                >
                  {isPending ? t('rec.inviting') : t('rec.sendInvitation')}
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
                  ? t('rel.emailedInvite')
                  : t('rel.inviteNotEmailed')}
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
            {t('action.done')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
