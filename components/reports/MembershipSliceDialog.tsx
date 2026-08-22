'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, CheckCircle, Loader2, MailPlus, Cake } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { FieldError, FormError } from '@/components/ui/form-message'
import { MemberSearchBox } from '@/components/admin/MemberSearch'
import { matchesPersonQuery } from '@/lib/person-search'
import { setMemberChapter, updateUserProfile } from '@/app/actions/admin/users'
import { invitePersonRecord } from '@/app/actions/family-tree'
import {
  getMembershipSlice, type MembershipSlice, type MembershipSliceMember,
} from '@/app/actions/reports'
import {
  mayRepair, sliceRepair,
  type MembershipBreakdown, type MembershipRepair, type MembershipRepairRights,
} from '@/lib/membership-drill'
import type { CountSlice } from '@/lib/membership-report'

/**
 * Who is in one slice of one of the Membership report's charts, and the one repair that slice
 * is pointing at.
 *
 * ── THE ROSTER IS FETCHED WHEN THE DIALOG OPENS, NEVER BEFORE ───────────────────────
 * AGENTS.md §5, and here it is the whole design rather than an optimisation. The report itself
 * publishes COUNTS and place names and nothing else — that smaller surface is what lets
 * `membership-report` be a `community` resource rather than an admin one, and its action's
 * header says so. Sending every slice's roster down with the page so a dialog could hide seven
 * of them would undo that in one prop: props are serialized into the RSC payload whether a
 * component renders them or not.
 *
 * So there are eight slices on this screen and at most one roster in the browser, belonging to
 * the slice somebody actually pressed. `getMembershipSlice` re-resolves BOTH grants itself
 * (`membership-report:view` and `community/directory:view`), because a `'use server'` export has
 * a URL whether or not a dialog exists (AGENTS.md §2) — `null` back means the answer is
 * withheld, and that is said in words rather than drawn as an empty list.
 *
 * ── ONE REPAIR, DECIDED IN ONE PLACE ────────────────────────────────────────────────
 * `lib/membership-drill.ts` says which slice offers what and which grant each needs; this file
 * draws it. Three shapes, and every one of them is an EXISTING action reused rather than a new
 * endpoint:
 *
 *   assign-chapter    `setMemberChapter`      — `admin/members:edit` at canAny
 *   send-invitation   `invitePersonRecord`    — `community/family-tree:edit` at canAny
 *   record-birthday   `updateUserProfile`     — `admin/members:edit` at canAny
 *
 * Reusing them is what keeps this dialog from being a second, weaker Members & Access reached
 * through a pie chart: every rule those three enforce — the family scoping, the column
 * allow-list, the placeholder-address rule, the propagation to children under eighteen — holds
 * here with nothing restated.
 *
 * ── ONE ROW AT A TIME, DELIBERATELY, AND NO BULK APPLY ──────────────────────────────
 * A "file all fourteen of these in Austin" button is the obvious next thought and is refused
 * here. Each of these repairs is a statement about ONE person — which chapter they are in, when
 * they were born, whether to ask them to join — and a bulk apply is how a whole slice ends up
 * asserting something nobody checked. `setMemberChapter` additionally moves that member's
 * children under eighteen with them (`propagateChapterToChildren`), so a bulk apply would move
 * people who are in no slice on this screen.
 *
 * ── IT REFETCHES AFTER A REPAIR, AND REFRESHES THE PAGE UNDER IT ────────────────────
 * A repair changes which slice the person belongs to, so the list they are in has to change or
 * the reader is looking at a stale answer to the question they just fixed. `reload()` re-asks
 * for this slice and `router.refresh()` re-renders the charts behind the dialog — the counts on
 * every one of the four move when a chapter is set, because a chapter carries a region with it.
 */
export function MembershipSliceDialog({
  breakdown, slice, chartTitle, rights, onClose,
}: {
  breakdown: MembershipBreakdown
  slice: CountSlice
  chartTitle: string
  rights: MembershipRepairRights
  onClose: () => void
}) {
  const router = useRouter()
  const [data, setData] = useState<MembershipSlice | null>(null)
  const [loading, setLoading] = useState(true)
  const [withheld, setWithheld] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  const repair = sliceRepair(breakdown, slice.key)
  const offered = mayRepair(repair, rights) ? repair : null

  async function load() {
    const result = await getMembershipSlice(breakdown, slice.key)
    // `null` IS "WITHHELD", NOT "EMPTY", and the two must not render alike: an empty list over
    // a refusal tells a reader their family has nobody in a chapter that has four people in it.
    setWithheld(result === null)
    setData(result)
    setLoading(false)
  }

  // THE FIRST FETCH IS WRITTEN OUT RATHER THAN CALLING `load`, and the difference is the
  // `live` flag: this one can be unmounted mid-flight (the reader presses Escape while it is
  // in the air) and must not write state afterwards, while `load` only ever runs from a repair
  // the reader is watching. Keyed on the slice by the parent, so it runs exactly once per open.
  useEffect(() => {
    let live = true
    getMembershipSlice(breakdown, slice.key).then(result => {
      if (!live) return
      setWithheld(result === null)
      setData(result)
      setLoading(false)
    })
    return () => { live = false }
  }, [breakdown, slice.key])

  function afterRepair(message: string) {
    setDone(message)
    setError('')
    startTransition(async () => {
      await load()
      router.refresh()
    })
  }

  const members = (data?.members ?? []).filter(m => matchesPersonQuery(
    { first_name: m.firstName, last_name: m.lastName, nick_name: m.nickName },
    m.name,
    query,
  ))

  return (
    <Dialog
      open
      onClose={onClose}
      title={slice.label}
      description={`${chartTitle} · ${slice.count} ${slice.count === 1 ? 'member' : 'members'}`
        + ` · ${slice.percent}% of the family`}
      className="max-w-lg"
    >
      {/* NO SCROLL CONTAINER HERE. `Dialog` already caps its own height and scrolls its body
          (`min-h-0 flex-1 overflow-y-auto`), which is the whole point of that primitive owning
          the cap rather than eight call sites passing their own. A second one nested inside it
          gives a panel with two scrollbars and a body that stops short of its own edge. */}
      <div className="space-y-3">
        {loading && (
          <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Looking up who is
            in this group…
          </p>
        )}

        {/* WITHHELD IS SAID, NOT DRAWN AS EMPTINESS. See `load`. */}
        {!loading && withheld && (
          <p className="py-8 text-sm text-muted-foreground">
            Who is in this group is not yours to see. The figures on the chart are; the names
            need the Member Directory as well.
          </p>
        )}

        {!loading && !withheld && (
          <>
            {/* THE FILTER IS WHAT MAKES THIS WORK AT A HUNDRED AND FORTY, and it is the reason
                the cap in `getMembershipSlice` is a payload bound rather than a screen
                decision. AGENTS.md: "Build every member list for a hundred-member family" —
                a slice really can be the whole roster. `matchesPersonQuery` is the shared
                matcher, so this searches accents and punctuation the same way both person
                pickers do. */}
            {(data?.members.length ?? 0) > 8 && (
              <MemberSearchBox value={query} onChange={setQuery}
                placeholder="Filter these members by name…" />
            )}

            {done && (
              <p className="flex items-start gap-2 rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand-on-soft">
                <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {done}
              </p>
            )}
            <FormError message={error} />

            {members.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {query
                  ? 'Nobody in this group matches that filter.'
                  : 'Nobody is in this group.'}
              </p>
            ) : (
              <ul className="divide-y">
                {members.map(m => (
                  <MemberRow
                    key={m.personId}
                    member={m}
                    repair={offered}
                    chapters={data?.chapters ?? []}
                    busy={isPending}
                    onDone={afterRepair}
                    onError={setError}
                  />
                ))}
              </ul>
            )}

            {/* NEVER A SILENT CAP. */}
            {(data?.truncated ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                {data!.truncated} more {data!.truncated === 1 ? 'member is' : 'members are'} in
                this group and are not listed here. Members &amp; Access lists the whole family.
              </p>
            )}

            {/* WHY THERE IS NO CONTROL, when there could have been one. Two different reasons
                and they must not read alike: the slice has nothing to repair, or the caller does
                not hold the grant. Saying neither leaves somebody looking for a button. */}
            {repair && !offered && (
              <p className="text-xs text-muted-foreground">
                {REPAIR_UNGRANTED[repair]}
              </p>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}

/** What to say when the slice offers a repair and the caller may not make it. */
const REPAIR_UNGRANTED: Record<MembershipRepair, string> = {
  'assign-chapter':
    'Filing somebody in a chapter needs permission to edit members, which you have not been given.',
  'send-invitation':
    'Sending an invitation needs permission to edit the family tree, which you have not been given.',
  'record-birthday':
    'Recording a birthday needs permission to edit members, which you have not been given.',
}

/**
 * One person, and the one thing this slice lets you do about them.
 *
 * THE CONTROL IS INLINE AND NOT A SECOND DIALOG. Every one of the three repairs is a single
 * field, and a dialog over a dialog to type one date is a worse screen than a row that opens.
 * The row's own state is which control is showing, which is genuinely UI-local (AGENTS.md,
 * "Switching family remounts the page") and needs no keying.
 */
function MemberRow({ member, repair, chapters, busy, onDone, onError }: {
  member: MembershipSliceMember
  repair: MembershipRepair | null
  chapters: { id: string; name: string }[]
  busy: boolean
  onDone: (message: string) => void
  onError: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [isPending, startTransition] = useTransition()

  // AN ACCOUNT-HOLDER CANNOT BE INVITED, and the action refuses it — so the row does not offer
  // it. That is the same rule `invitePersonRecord` enforces ("They already have an account."),
  // honoured here rather than restated: a control that cannot work is worse than no control.
  const offered = repair === 'send-invitation' && member.hasAccount ? null : repair

  function submit() {
    setFieldError('')
    const trimmed = value.trim()
    if (offered === 'send-invitation' && !trimmed) {
      setFieldError('Enter an email address to send the invitation to')
      return
    }
    if (offered === 'record-birthday' && !trimmed) {
      setFieldError('Enter a date of birth')
      return
    }
    startTransition(async () => {
      if (offered === 'assign-chapter') {
        // '' IS A LEGITIMATE VALUE — "no chapter" — and `setMemberChapter` normalises it. The
        // picker offers it, because moving somebody OUT of a chapter is as real an edit as
        // moving them in.
        const r = await setMemberChapter(member.personId, trimmed || null)
        if (!r.success) { onError(r.error ?? 'Could not save that chapter.'); return }
        setOpen(false)
        // The action's own partial-success message is carried through when it sends one: it
        // reports how many children under eighteen moved with them, and swallowing that would
        // hide a write this dialog caused.
        onDone(r.message ?? `${member.name} filed.`)
        return
      }
      if (offered === 'send-invitation') {
        const r = await invitePersonRecord(member.personId, trimmed)
        if (!r.success) { onError(r.message ?? 'Could not send that invitation.'); return }
        setOpen(false)
        // `emailed` FALSE IS NOT A FAILURE and must not be reported as success either: the
        // invitation exists and the mail did not go. `inviteMember` fails soft by design
        // (AGENTS.md, "Sending fails soft, so the UI owes the truth").
        onDone(r.emailed === false
          ? `${member.name} was invited, but the email could not be sent. `
            + 'Members & Access can resend it.'
          : `${member.name} has been invited.`)
        return
      }
      if (offered === 'record-birthday') {
        const r = await updateUserProfile(member.personId, { date_of_birth: trimmed })
        if (!r.success) { onError(r.error ?? 'Could not save that date.'); return }
        setOpen(false)
        onDone(`${member.name}'s date of birth recorded.`)
      }
    })
  }

  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{member.name}</p>
          {/* WHERE THEY ARE AND WHETHER THEY CAN SIGN IN, which are the two facts that make the
              list actionable — and the second is why an invitation is or is not offered. Both
              read as an em-dash-free sentence rather than a row of bare proper nouns: "Austin ·
              Texas" could be read either way round once the headings are gone, which is the
              same argument the members table's folded `RowMeta` makes. */}
          <p className="text-xs text-muted-foreground">
            {member.chapterName ? `Chapter: ${member.chapterName}` : 'No chapter'}
            {member.regionName && ` · Region: ${member.regionName}`}
            {' · '}
            {member.hasAccount ? 'Can sign in' : INVITATION_WORD[member.invitation] ?? 'No account'}
          </p>
        </div>

        {offered && !open && (
          <Button size="sm" variant="outline" disabled={busy || isPending}
            onClick={() => setOpen(true)}>
            {REPAIR_ICON[offered]} {REPAIR_LABEL[offered]}
          </Button>
        )}
      </div>

      {offered && open && (
        <div className="mt-2 space-y-2 rounded-lg border bg-muted/30 p-2.5">
          {offered === 'assign-chapter' && (
            <div className="space-y-1">
              <Label className="text-xs" htmlFor={`chapter-${member.personId}`}>Chapter</Label>
              <Select id={`chapter-${member.personId}`} value={value}
                onChange={e => setValue(e.target.value)}>
                <option value="">No chapter</option>
                {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <p className="text-xs text-muted-foreground">
                Their region follows their chapter. Sons and daughters under eighteen with no
                account of their own move with them.
              </p>
            </div>
          )}

          {offered === 'send-invitation' && (
            <div className="space-y-1">
              <Label className="text-xs" htmlFor={`email-${member.personId}`}>
                Email address
              </Label>
              <Input id={`email-${member.personId}`} type="email" value={value}
                placeholder="them@example.com"
                onChange={e => setValue(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Their record holds a placeholder address, so the invitation needs a real one.
              </p>
            </div>
          )}

          {offered === 'record-birthday' && (
            <div className="space-y-1">
              <Label className="text-xs" htmlFor={`dob-${member.personId}`}>Date of birth</Label>
              <Input id={`dob-${member.personId}`} type="date" value={value}
                onChange={e => setValue(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Adult or minor is worked out from this every time the report loads; nothing is
                stored about their age.
              </p>
            </div>
          )}

          <FieldError message={fieldError} />

          <div className="flex gap-2">
            <Button size="sm" variant="affirm" disabled={isPending} onClick={submit}>
              {REPAIR_CONFIRM[offered]}
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending}
              onClick={() => { setOpen(false); setFieldError('') }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

/** The three words Dues Projections prints, so the two screens cannot come to disagree. */
const INVITATION_WORD: Record<string, string> = {
  'active': 'Can sign in',
  'invited': 'Invitation open',
  'pending-invite': 'Never invited',
}

const REPAIR_LABEL: Record<MembershipRepair, string> = {
  'assign-chapter': 'Set chapter',
  'send-invitation': 'Invite',
  'record-birthday': 'Add birthday',
}

const REPAIR_CONFIRM: Record<MembershipRepair, string> = {
  'assign-chapter': 'Save chapter',
  'send-invitation': 'Send invitation',
  'record-birthday': 'Save date',
}

const REPAIR_ICON: Record<MembershipRepair, React.ReactNode> = {
  'assign-chapter': <Building2 />,
  'send-invitation': <MailPlus />,
  'record-birthday': <Cake />,
}
