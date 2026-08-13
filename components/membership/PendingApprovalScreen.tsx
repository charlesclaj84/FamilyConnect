'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Clock, Ban, Mail, Home } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { resendConfirmationEmail, appealMembershipDecision } from '@/app/actions/membership'
import type { MembershipStatus } from '@/lib/auth/family'

/**
 * What a member sees while they are not a member.
 *
 * The ONLY thing rendered for a pending, rejected or disabled membership. It
 * deliberately names the family and nothing else about it: no member count, no events,
 * no announcements, no roster. The gate is in the database — a non-approved caller
 * resolves to no person, so every policy denies — but a page that fetched family data
 * and then chose not to render it would still have published it, because props are
 * serialized into the RSC payload whether a component uses them or not (AGENTS.md §5).
 * So the pages that show this screen return here BEFORE they fetch anything.
 *
 * The family names themselves are safe: they typed the code, or followed an invitation,
 * and confirmed the name in order to get here — and a disabled member was in the family
 * until a moment ago.
 *
 * THREE STATES, THREE MESSAGES, and the third is why this is a lookup rather than a
 * boolean. 'disabled' arrived with 20260807000000 and reaches every gate that 'pending'
 * does, so without a branch of its own a member an administrator had just switched off
 * would be told their request was awaiting approval — advice to wait for something that
 * is not going to happen.
 *
 * ONE FAMILY OR SEVERAL. An account can be waiting on more than one at a time, and the
 * statuses need not match — declined by one family while queued at another is an
 * ordinary state, not an edge case. So the single-family case keeps its own sentence,
 * because a list of one reads like a form, and anything above one becomes a list where
 * each row carries its own status.
 */

interface PendingFamily {
  familyCode: string
  familyName: string
  status: MembershipStatus
}

/** Heading, and the sentence that belongs under it, per status. */
const COPY: Record<MembershipStatus, { heading: React.ReactNode; line: string }> = {
  pending:  { heading: <><Clock className="h-4 w-4" /> Waiting for approval</>, line: 'With its administrators for review.' },
  rejected: { heading: <><Ban className="h-4 w-4" /> Request declined</>,       line: 'An administrator declined your request to join.' },
  disabled: { heading: <><Ban className="h-4 w-4" /> Access switched off</>,    line: 'An administrator has switched off your access.' },
  // Unreachable — this screen renders only for a non-approved membership. Present so
  // the lookup is total and a status can never resolve to `undefined.heading`.
  approved: { heading: <><Clock className="h-4 w-4" /> Waiting for approval</>, line: 'With its administrators for review.' },
}

export function PendingApprovalScreen({
  pending,
  emailConfirmed,
  otherFamilies,
}: {
  /** Every membership of this account that is not approved. Never empty. */
  pending: PendingFamily[]
  /** False only when a confirmation is genuinely outstanding — see the action. */
  emailConfirmed: boolean
  /** Approved memberships elsewhere, so a multi-family account is not stranded. */
  otherFamilies: { familyCode: string; familyName: string }[]
}) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  // Which declined family the appeal box is open for, and what it says. Keyed by family
  // code rather than a boolean: an account can be declined by more than one family at
  // once, and each refusal is its own conversation with its own administrators.
  const [appealing, setAppealing] = useState('')
  const [appealNote, setAppealNote] = useState('')
  const [appealError, setAppealError] = useState('')
  const [appealed, setAppealed] = useState<string[]>([])

  function resend() {
    setMessage('')
    startTransition(async () => {
      const result = await resendConfirmationEmail()
      setMessage(result.success
        ? 'Sent. Check your inbox.'
        : result.message)
    })
  }

  function submitAppeal(familyCode: string) {
    setAppealError('')
    startTransition(async () => {
      const result = await appealMembershipDecision(familyCode, appealNote)
      if (result.success) {
        // Recorded locally as well as revalidated, because the row this screen was
        // rendered from is now 'pending' and the server will re-render it as a waiting
        // family — this keeps the confirmation on screen through that transition rather
        // than having the panel vanish with nothing said.
        setAppealed(current => [...current, familyCode])
        setAppealing('')
        setAppealNote('')
        router.refresh()
      } else {
        setAppealError(result.message)
      }
    })
  }

  // A decision is still outstanding somewhere. Drives the two panels that are only
  // useful while one is: filling in a profile the reviewers will read, and confirming
  // an address the approval waits on. Telling someone whose access was declined or
  // switched off to confirm their email advertises a route back in that confirming an
  // address does not open — so with nothing pending, neither panel renders.
  const waiting = pending.some(f => f.status === 'pending')

  // Positively 'rejected', never "not pending": 'disabled' also reaches this screen and an
  // appeal must not be offered for it — that exclusion was made under a different grant
  // (set_member_enabled, admin/users) and the RPC refuses it, so offering the button would
  // advertise a route back that does not open. Same rule as everywhere else here.
  const declined = pending.filter(f => f.status === 'rejected')

  const single = pending.length === 1 ? pending[0] : null

  const heading = single
    ? COPY[single.status].heading
    : waiting
      ? <><Clock className="h-4 w-4" /> Waiting for approval</>
      : <><Ban className="h-4 w-4" /> Your family requests</>

  const body = single
    ? {
        pending: <>Your request to join <span className="font-medium">{single.familyName}</span> is with
          its administrators. You will be able to see the family once one of them approves you.</>,
        rejected: <>An administrator of <span className="font-medium">{single.familyName}</span> declined
          your request to join. Get in touch with them if you think that was a mistake.</>,
        disabled: <>An administrator of <span className="font-medium">{single.familyName}</span> has
          switched off your access. Your account and your profile are untouched — get in touch
          with them if you think that was a mistake.</>,
        approved: <>Your request to join <span className="font-medium">{single.familyName}</span> is with
          its administrators.</>,
      }[single.status]
    : <>You are waiting on {pending.length} families. Each one is reviewed by its own
        administrators, so they may not answer at the same time.</>

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">{heading}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* One row per family, only when there is more than one to tell apart. */}
        {!single && (
          <ul className="space-y-2">
            {pending.map(family => (
              <li
                key={family.familyCode}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3"
              >
                <span className="text-sm font-medium">{family.familyName}</span>
                {family.status === 'pending' ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-legacy px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-on-legacy">
                    <Clock className="h-3 w-3" /> Pending
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Ban className="h-3 w-3" /> {family.status === 'rejected' ? 'Declined' : 'Switched off'}
                  </span>
                )}
                <span className="w-full text-xs text-muted-foreground sm:w-auto sm:flex-1">
                  {COPY[family.status].line}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* ASKING THEM TO LOOK AGAIN — one panel per declined family.
            A refusal is not always final and is quite often a misidentification: a large
            family reviewing a name nobody on the committee recognises is the ordinary way
            this goes wrong. So a declined applicant may reply once, in writing, and that
            reply puts them back in the queue with the note attached.

            Once per refusal, enforced in the database rather than here: the RPC requires
            the row to BE 'rejected' and its own success makes it 'pending', so the button
            cannot be used twice until a human has declined them again. This panel simply
            stops rendering, because the family's status is no longer 'rejected'. */}
        {declined.map(family => (
          <div key={family.familyCode} className="rounded-xl border px-4 py-3">
            {appealed.includes(family.familyCode) ? (
              <>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4" /> Sent to {family.familyName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your request is back with their administrators, with your note attached.
                  They will see who declined it before and what you have said about it.
                </p>
              </>
            ) : appealing === family.familyCode ? (
              <>
                <label
                  htmlFor={`appeal-${family.familyCode}`}
                  className="text-sm font-medium"
                >
                  Ask {family.familyName} to look again
                </label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Say who you are and how you are related, so whoever reviews it can place
                  you. This goes to the family&apos;s administrators.
                </p>
                <Textarea
                  id={`appeal-${family.familyCode}`}
                  value={appealNote}
                  onChange={e => setAppealNote(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="mt-3"
                  placeholder="I'm Martha's youngest — my mother was born in Bastrop and my cousin Ada is already a member."
                />
                {appealError && (
                  <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {appealError}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => submitAppeal(family.familyCode)}
                    disabled={isPending || !appealNote.trim()}
                    className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {isPending ? 'Sending…' : 'Send to the administrators'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAppealing(''); setAppealError('') }}
                    className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Think that was a mistake?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  You can send {family.familyName}&apos;s administrators a note and ask them
                  to look at your request again. You get one reply per decision, so it is
                  worth saying how you are related.
                </p>
                <button
                  type="button"
                  onClick={() => { setAppealing(family.familyCode); setAppealNote(''); setAppealError('') }}
                  className="mt-3 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Ask them to look again
                </button>
              </>
            )}
          </div>
        ))}

        {waiting && (
          <p className="text-sm text-muted-foreground">
            In the meantime you can fill in{' '}
            <Link href="/personal-info" className="text-primary hover:underline">
              your profile
            </Link>
            , so the family recognises you when they review the request.
          </p>
        )}

        {waiting && !emailConfirmed && (
          <div className="rounded-xl border bg-muted/40 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Mail className="h-4 w-4" /> Confirm your email address
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              We sent a confirmation link when you signed up. Your request cannot be
              approved until you have used it.
            </p>
            <button
              type="button"
              onClick={resend}
              disabled={isPending}
              className="mt-3 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
            >
              {isPending ? 'Sending…' : 'Send it again'}
            </button>
            {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
          </div>
        )}

        {otherFamilies.length > 0 && (
          <div className="rounded-xl border px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Home className="h-4 w-4" /> Your other families
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              You are already a member of{' '}
              {otherFamilies.map(f => f.familyName).join(', ')}. Switch to one from{' '}
              <Link href="/my-families" className="text-primary hover:underline">
                My Families
              </Link>
              .
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
