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
  editPersonRecord, invitePersonRecord, setPersonBloodline,
  type TreePerson,
} from '@/app/actions/family-tree'
import { useT } from '@/components/layout/LocaleProvider'

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
  open, onClose, person, name,
}: {
  open: boolean
  onClose: () => void
  person: TreePerson
  /** The disambiguated name, so two Martha Allens are told apart in the title. */
  name: string
}) {
  const t = useT()
  const router = useRouter()
  // ONE BOOLEAN FOR THE PERSON, where this used to be a `Record<relationshipId, LinkKind>`
  // — four independent controls on a person with four connections. Seeded from the row and
  // corrected on refusal, which is what keeps the control showing what the database holds
  // rather than what was clicked.
  const [isBloodline, setIsBloodline] = useState(person.isBloodline)
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

  /**
   * Close, discarding anything unsaved.
   *
   * IT RESETS THE FIELDS NOW, which it did not have to while every control wrote as it was
   * touched. `FamilyTreeBuilder` renders this as `{managing && <PersonRecordDialog …>}` and
   * keys it on the person, so a fresh dialog gets fresh state — but Cancel must not leave a
   * half-typed name behind for the same person reopened, which would read as the product
   * having saved it.
   */
  function close() {
    setIsBloodline(person.isBloodline)
    setFirstName(person.firstName ?? '')
    setLastName(person.lastName ?? '')
    setNickName(person.nickName ?? '')
    setDateOfBirth(person.dateOfBirth ?? '')
    setGender(person.gender ?? '')
    setError('')
    setSaved(false)
    setInvited(null)
    setEmail('')
    onClose()
  }

  // Whose row this is decides what Save may touch. `editPersonRecord` refuses a row with a
  // `user_id` — its owner is the authority on their own name, which is what
  // `saveProfileSection` is for (AGENTS.md §4b's three editing surfaces) — so for a member
  // with an account the bloodline tick is the whole of this dialog.
  const canEditDetails = !person.hasAccount

  // ── NOTHING HERE SAVES UNTIL SAVE IS PRESSED — 2026-09-03 ──────────────────────
  // The bloodline tick used to write on `change` and the marriage-type buttons wrote on
  // `click`, so this dialog committed three different things at three different moments and
  // its only footer button said "Done" — which is a word for a dialog that has already
  // saved. Asked for as: the popups should not autosave, you must click Save, and Cancel
  // simply closes.
  //
  // WHAT IS DIRTY IS DERIVED, never a `hasChanges` flag. A stored flag is the `is_minor`
  // trap in miniature — it goes stale the first time a field is edited back to its original
  // value, and then Save is offered for a write that would change nothing.
  const bloodlineDirty = isBloodline !== person.isBloodline
  const detailsDirty = canEditDetails && (
    firstName !== (person.firstName ?? '')
    || lastName !== (person.lastName ?? '')
    || nickName !== (person.nickName ?? '')
    || dateOfBirth !== (person.dateOfBirth ?? '')
    || gender !== (person.gender ?? '')
  )
  const dirty = bloodlineDirty || detailsDirty

  /**
   * Save what changed, and only what changed.
   *
   * ── ONLY WHAT CHANGED, BECAUSE THE TWO WRITES HAVE DIFFERENT GATES ───────────────
   * Not an optimisation. `setPersonBloodline` is `canAny('community/family-tree', 'edit')`
   * — it decides money through `dues_schedules.bloodline_scope`, so the browser role is
   * refused outright by `people_guard_bloodline` and it runs on the admin client.
   * `editPersonRecord` needs only `requireMember()`. So a member who may correct a
   * grandmother's birthday but not answer the bloodline question would, under a
   * save-everything button, be refused for a field they never touched.
   *
   * ── THE BLOODLINE GOES FIRST, AND IS NOT REVERTED IF THE DETAILS THEN FAIL ───────
   * A partial success is reported as one rather than tidied away: the tick really is saved
   * at that point, so putting the control back would be the screen lying about the
   * database. The same judgement `saveChapterAndPropagate` makes about a propagation that
   * half-worked.
   */
  function save() {
    setError('')
    setSaved(false)
    // Only when the details are actually part of this save. A person WITH an account has no
    // details form at all, so validating their names would refuse a bloodline change over
    // fields that are not on screen.
    if (detailsDirty && (!firstName.trim() || !lastName.trim())) {
      setError(t('rec.needNames'))
      return
    }
    startTransition(async () => {
      if (bloodlineDirty) {
        const r = await setPersonBloodline(person.id, isBloodline)
        if (!r.success) {
          setError(r.message ?? t('rec.bloodlineFailed'))
          // Put the control back where the database still is, so nobody reads a permission
          // they do not have off their own screen.
          setIsBloodline(person.isBloodline)
          return
        }
      }
      if (detailsDirty) {
        const r = await editPersonRecord(person.id, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          // Empty means "not recorded", and the columns are nullable — '' would be a
          // birthday of the empty string, which `isMinorOn` and every date format helper
          // would then have to defend against.
          nick_name: nickName.trim() || null,
          date_of_birth: dateOfBirth || null,
          gender: gender || null,
        })
        if (!r.success) { setError(r.message ?? t('rec.saveFailed')); return }
      }
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
        {/* ── IS THIS PERSON IN THE FAMILY'S BLOODLINE ────────────────────────────
            `people.is_bloodline`, and the whole of what four pickers over
            `person_relationships.link_kind` used to be asking indirectly.

            ABOVE THE CONNECTIONS, and offered whether or not there are any. A person
            attached to nobody yet still has an answer to this — which the old design could
            not express at all, because the question lived on links they did not have.

            IT SAYS WHAT ELSE IT DECIDES. The tick drives the Bloodline view AND
            `dues_schedules.bloodline_only`, so a family that ticks it is answering a money
            question as well as a display one. Naming that here is the only place a person
            doing it would find out. */}
        <div className="space-y-2 rounded-xl border bg-muted/30 px-3 py-3">
          <label className="flex items-start gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={isBloodline}
              disabled={isPending}
              onChange={e => { setIsBloodline(e.target.checked); setSaved(false) }}
              className="mt-0.5 h-4 w-4 rounded border-input disabled:opacity-60"
            />
            <span>{t('rec.inBloodline', { name })}</span>
          </label>
          <p className="text-xs text-muted-foreground">
            {t('rec.inBloodlineHint', { view: t('tree.bloodline') })}
          </p>
        </div>

        {!person.hasAccount && (
        <form
          className="space-y-4"
          onSubmit={e => { e.preventDefault(); save() }}
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

          {/* NO BUTTON OF ITS OWN. There is one Save for the whole dialog, in the footer,
              because the bloodline tick and these fields are two writes a member makes in
              one sitting — a "Save details" button beside a tick that saved itself was
              exactly the inconsistency this change removes. The `<form>` stays for the
              keyboard: Enter in any field submits, which `onSubmit` routes to that one Save. */}
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

        {/* ── CANCEL DISCARDS, SAVE COMMITS — 2026-09-03 ───────────────────────────
            This was a single button reading "Done", which is the right word for a dialog
            whose controls have already written and the wrong one for a dialog holding
            unsaved edits: it says the work is finished where Cancel says it is being thrown
            away. Both are `type="button"` — the footer sits OUTSIDE the details form, so a
            submit here would do nothing at all.

            SAVE IS DISABLED UNTIL SOMETHING IS DIRTY, so pressing it can never be a write
            that changes nothing, and a member who opened the dialog to read it is not
            invited to save. */}
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-brand-affirm" aria-hidden="true" />
              {t('rec.savedShort')}
            </span>
          )}
          <button
            type="button"
            onClick={close}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            {t('action.cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isPending || !dirty}
            className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? t('action.saving') : t('action.save')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
