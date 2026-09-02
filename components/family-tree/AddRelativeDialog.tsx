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
import { HelpLink } from '@/components/help/HelpLink'
import { cn } from '@/lib/utils'
import { addRelative, type AddRelativeMode, type TreePerson } from '@/app/actions/family-tree'
import { relationshipMeta } from '@/lib/family-tree'
import { useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

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

// A FUNCTION of `t` since Phase 5: the captions come from the reader's catalogue. The IDS
// and the ICONS stay, which is what this list is for — `AddRelativeMode` is what the
// action is sent.
function modes(t: T): { id: AddRelativeMode; label: string; hint: string; icon: typeof UserCheck }[] {
  return [
    { id: 'existing', label: t('rel.alreadyHere'), hint: t('rel.alreadyHereHint'), icon: UserCheck },
    { id: 'invite', label: t('rel.inviteThem'), hint: t('rel.inviteHint'), icon: Mail },
    { id: 'record', label: t('rel.noEmail'), hint: t('rel.noEmailHint'), icon: FileText },
  ]
}

/**
 * The record mode's hint, worded for what is being recorded.
 *
 * A child with no email is the commonest use of this path and the general wording buried
 * it at the end of a list — so somebody adding a son saw "for relatives who have passed"
 * first and reasonably concluded this was the wrong door. The child version leads with
 * the child, and says why a birthday is being asked for, which is the one thing about
 * this form that is not self-evident.
 */
function recordHint(isChild: boolean, t: T): string {
  return isChild
    ? t('rel.noEmailChildHint')
    : t('rel.noEmailHint')
}

export function AddRelativeDialog({
  open, onClose, anchor, relationshipType, candidates, coParents = [],
}: {
  open: boolean
  onClose: () => void
  /** The person the relative is being attached TO. */
  anchor: TreePerson
  /** A `relationship_types.name` from TREE_RELATIONSHIPS. */
  relationshipType: string
  /** Everyone eligible to be linked — the roster minus the anchor and existing relatives. */
  candidates: TreePerson[]
  /**
   * People who could ALSO be a parent of whoever is being added — the anchor's parents
   * when adding a sibling, the anchor's spouses when adding a child.
   *
   * Empty when there is nothing to ask, and the question then does not appear. That is
   * most of a young tree, which is why this is a question and not a step.
   */
  coParents?: { id: string; name: string }[]
}) {
  const t = useT()
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
  const [dateOfBirth, setDateOfBirth] = useState('')
  // NOT TICKED BY DEFAULT, unlike `sharedParents` below, and the two defaults disagree on
  // purpose. `people.is_bloodline` is `NOT NULL DEFAULT false` and `dues_schedules
  // .bloodline_only` prices against it, so a ticked default would bill a step-son whom
  // nobody had thought about the moment a family turned that flag on. A missed tick is a
  // relative left out of the Bloodline view, which somebody notices and fixes; a wrong
  // tick is a bill.
  const [isBloodline, setIsBloodline] = useState(false)
  // TICKED BY DEFAULT. Sharing both parents is what "brother" means to most families most
  // of the time, and a half-sibling is the case somebody unticks — the opposite default
  // makes the ordinary addition take an extra decision and leaves the tree half-built when
  // nobody notices the question.
  const [sharedParents, setSharedParents] = useState<string[]>(() => coParents.map(p => p.id))
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
    setDateOfBirth('')
    setIsBloodline(false)
    setSharedParents(coParents.map(p => p.id))
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

  // A CHILD recorded with no email owes a birthday, because dues can start at an age and
  // an unrecorded age reads as an adult's everywhere in the product. `addRelative`
  // refuses it independently — this is the button agreeing with the action rather than
  // the thing that enforces it. See the input's own note there.
  const isChild = meta?.relation === 'child'
  const needsBirthday = mode === 'record' && isChild

  const complete =
    mode === 'existing' ? Boolean(existingPersonId)
      : mode === 'invite' ? Boolean(firstName.trim() && lastName.trim() && email.trim())
        : Boolean(firstName.trim() && lastName.trim() && reason.trim()
          && (!needsBirthday || dateOfBirth))

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
        dateOfBirth,
        isBloodline,
        sharedParentIds: sharedParents,
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
      title={result ? t('rel.addedToTree') : `Add ${anchorName}'s ${relationLabel}`}
      description={result ? undefined : t('rel.chooseHow')}
    >
      {!result && (
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); submit() }}>
          {/* The three modes as a segmented control rather than a <select>: they are not
              interchangeable options, they are three different amounts of commitment, and
              each needs a sentence saying what it does. Same treatment the announcement
              composer gives its audience picker. */}
          <div className="space-y-2">
            <Label>{t('rel.how')}</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {modes(t).map(m => {
                const Icon = m.icon
                const active = mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setMode(m.id); setError('') }}
                    aria-pressed={active}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-xl border px-3 py-2 text-start text-xs font-medium transition-colors',
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
              {mode === 'record' ? recordHint(isChild, t) : modes(t).find(m => m.id === mode)!.hint}
            </p>
            {/* ON THE RECORD MODE ONLY, because it is the only one of the three whose
                consequences are not visible from the form. "No email address" reads like a
                lesser kind of person and is not one — it is the same `people` row, editable
                by any approved member, and it stops being a record the day somebody invites
                them. That there is no "convert to adult" step is the specific thing people
                come looking for, and `family-tree#records` is where it is answered.

                Inline rather than an icon: this is a sentence's worth of explanation, the
                dialog has the width for the words, and a bare question mark sitting under a
                hint paragraph would read as being about the paragraph.

                The other two modes need nothing here — linking someone already present and
                emailing an invitation both do exactly what their hint says. */}
            {mode === 'record' && (
              <HelpLink
                variant="inline"
                slug="family-tree"
                section="records"
                label={t('rel.whatRecordIs')}
                className="text-xs"
              />
            )}
          </div>

          {/* IS THIS PERSON IN THE FAMILY'S BLOODLINE.
              `people.is_bloodline`, and the whole of what used to be a four-way picker over
              `person_relationships.link_kind` — blood, step, adopted, foster — asked about
              the LINK. `20260902000000` argues the change at length; what matters here is
              why it is still asked at CREATION rather than left to the person's card:
              somebody adding a step-son knows it at that moment and will not come back.

              NOT OFFERED FOR mode 'existing'. That person already has an answer recorded,
              and restating it as a side effect of drawing a second relationship would let
              this dialog overwrite it — `addRelative` ignores the field there for the same
              reason, so offering the control would be offering one that does nothing.

              NOT NARROWED TO NON-SPOUSE LINKS, which the old picker was. A marriage was
              never blood and the database corrected a link that claimed to be, so asking
              was asking a question whose answer was overruled. This is a fact about the
              PERSON: a wife who married in is not in the bloodline, and a cousin somebody
              married is, and only the family knows which. */}
          {mode !== 'existing' && (
            <div className="space-y-2 rounded-xl border bg-muted/30 px-4 py-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isBloodline}
                  onChange={e => setIsBloodline(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <span>{t('rel.inBloodlineQuestion')}</span>
              </label>
              <p className="text-xs text-muted-foreground">
                {t('rel.inBloodlineHint', { control: t('tree.bloodline') })}
              </p>
            </div>
          )}

          {/* THE FOLLOW-UP QUESTION, and it is the one that keeps the tree consistent from
              both ends. A sibling edge says two people are siblings and nothing about whose
              children they are, so a sister added here was invisible from her own father's
              card until this existed. Ticked by default; unticking is what a half-sibling
              looks like. */}
          {coParents.length > 0 && (
            <div className="space-y-2 rounded-xl border bg-muted/30 px-4 py-3">
              <Label>
                {meta?.relation === 'sibling'
                  ? t('rel.shareParentsQuestion', { name: anchorName })
                  : t('rel.whoElseIsParent', { relation: relationLabel })}
              </Label>
              <div className="space-y-1.5">
                {coParents.map(p => {
                  const on = sharedParents.includes(p.id)
                  return (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setSharedParents(
                          on ? sharedParents.filter(id => id !== p.id) : [...sharedParents, p.id],
                        )}
                        className="h-4 w-4 rounded border-input"
                      />
                      {p.name}
                    </label>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('rel.tickingRecordsParent', { name: anchorName })}
              </p>
            </div>
          )}

          {/* ── AND THE CASE WHERE THERE IS NOTHING TO ASK, WHICH WAS SILENT ──────────
              Reported 2026-09-01: a sister added as BLOOD got no droplet and vanished from
              the Bloodline view, with nothing anywhere saying why.

              Nothing was wrong with the walk. `bloodlineIds` conducts along PARENT edges
              only — a sibling edge says two people are siblings and nothing about whose
              children they are, and guessing the shared parent is exactly how a
              step-daughter once got a droplet. The block above is the fix for that: it asks
              whose children they are, and recording it puts them in.

              **But it only renders when the anchor already HAS recorded parents.** Add a
              sibling to somebody at the top of the tree and there is nothing to offer, so
              the question was never put, no parent edge was written, and the member — who
              had just explicitly chosen Blood — watched the product disagree with them for
              no stated reason.

              So this says it. It is not a warning and must not be dressed as one: the
              sibling edge is recorded correctly and the relationship is true. What is
              missing is a fact nobody has entered yet, which is what `--brand-warm` reads
              as here (AGENTS.md: never `--destructive`, which is for a failure).

              SHOWN ONLY WHEN THEY ARE BEING MARKED AS BLOODLINE. A step-sister is not in
              it either way, so telling somebody adding one that she will not appear in the
              Bloodline view is noise about a thing they did not ask for. It was
              `linkKind === 'blood'` until `20260902000000`; the condition asks the same
              question of the person instead of the link. */}
          {meta?.relation === 'sibling' && coParents.length === 0 && isBloodline && (
            <div className="rounded-xl border border-brand-warm bg-brand-warm/10 px-4 py-3">
              <p className="text-xs text-brand-warm">
                {t('rel.siblingNeedsSharedParent', {
                  name: anchorName,
                  // The toggle's OWN label, not a second copy of the word. Same rule the
                  // manual keeps about naming controls verbatim: a sentence pointing at a
                  // button must not be able to drift from what the button says.
                  view: t('tree.bloodline'),
                })}
              </p>
            </div>
          )}

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
              label={t('rel.whoIsWhose', {
                name: anchorName, relation: relationLabel,
              })}
              emptyMessage={t('rel.everyoneAttached')}
            />
          )}

          {mode !== 'existing' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="relative-first">{t('field.firstNameLower')}</Label>
                <Input
                  id="relative-first"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder={t('field.ph.firstName')}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="relative-last">{t('field.lastNameLower')}</Label>
                <Input
                  id="relative-last"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder={anchor.lastName || t('field.ph.lastName')}
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {mode === 'invite' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="relative-email">{t('field.emailAddress')}</Label>
                <Input
                  id="relative-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('field.ph.cousinEmail')}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <p className="text-sm text-muted-foreground">{t('ui.theyGoTreeStraight')}<em>this</em> card rather than
                making a second one. An administrator still approves them, the same as
                anybody joining from My Families.
              </p>
            </>
          )}

          {mode === 'record' && (
            <>
              {/* THE BIRTHDAY, and only on this path. Required for a child, because dues
                  can start at an age (`dues_schedules.start_age`) and a record with no
                  birthday is treated as fully liable — the same "never guess at an age"
                  rule that is right everywhere else and exactly wrong for a five-year-old.
                  Offered for everybody else because it is the moment somebody knows it,
                  and it is what the tree disambiguates two identical names by.

                  `max` is today: nobody on this tree was born tomorrow, and a typo in the
                  year is the commonest thing to get wrong in a date field. */}
              <div className="space-y-1.5">
                <Label htmlFor="relative-dob" required={needsBirthday}>
                  {t(needsBirthday ? 'rel.dateOfBirth' : 'rel.dateOfBirthOptional')}
                </Label>
                <Input
                  id="relative-dob"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                />
                {needsBirthday && (
                  <p className="text-xs text-muted-foreground">{t('ui.duesCanStartAge')}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="relative-reason">{t('rel.whyNoEmail')}</Label>
                <Textarea
                  id="relative-reason"
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder={isChild
                    ? t('rel.tooYoung')
                    : t('rel.reasonExamples')}
                />
              </div>
              <div className="flex items-start gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>{t('ui.shouldRareWeGenerate')}</p>
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
              {t('action.cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending || !complete}
              className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? t('rel.adding') : `Add ${relationLabel}`}
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
                  ? t('rel.emailedInvite')
                  : result.invited
                    ? t('rel.inviteNotEmailed')
                    : t('rel.onTreeNoInvite')}
              </p>
            </div>
          )}

          {result.placeholderEmail && (
            <div className="space-y-1.5 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
              <p className="text-muted-foreground">
                {t('rel.generated')}
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
              {t('action.done')}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
