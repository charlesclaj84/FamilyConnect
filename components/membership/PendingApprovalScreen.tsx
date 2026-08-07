'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Clock, Ban, Mail, Home } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { resendConfirmationEmail } from '@/app/actions/membership'
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
 * The family name itself is safe: they typed the code and confirmed the name in order
 * to get here — and a disabled member was in the family until a moment ago.
 *
 * THREE STATES, THREE MESSAGES, and the third is why this is a switch rather than a
 * boolean. 'disabled' arrived with 20260807000000 and reaches every gate that
 * 'pending' does, so without a branch of its own a member an administrator had just
 * switched off would be told their request was awaiting approval — advice to wait for
 * something that is not going to happen.
 */
export function PendingApprovalScreen({
  familyName,
  status,
  emailConfirmed,
  otherFamilies,
}: {
  familyName: string
  status: MembershipStatus
  /** False only when a confirmation is genuinely outstanding — see the action. */
  emailConfirmed: boolean
  /** Approved memberships elsewhere, so a multi-family account is not stranded. */
  otherFamilies: { familyCode: string; familyName: string }[]
}) {
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function resend() {
    setMessage('')
    startTransition(async () => {
      const result = await resendConfirmationEmail()
      setMessage(result.success
        ? 'Sent. Check your inbox.'
        : result.message)
    })
  }

  const waiting = status === 'pending'

  const heading = {
    pending:  <><Clock className="h-4 w-4" /> Waiting for approval</>,
    rejected: <><Ban className="h-4 w-4" /> Request declined</>,
    disabled: <><Ban className="h-4 w-4" /> Access switched off</>,
    approved: <><Clock className="h-4 w-4" /> Waiting for approval</>,
  }[status]

  const body = {
    pending: <>Your request to join <span className="font-medium">{familyName}</span> is with
      its administrators. You will be able to see the family once one of them approves you.</>,
    rejected: <>An administrator of <span className="font-medium">{familyName}</span> declined
      your request to join. Get in touch with them if you think that was a mistake.</>,
    disabled: <>An administrator of <span className="font-medium">{familyName}</span> has
      switched off your access. Your account and your profile are untouched — get in touch
      with them if you think that was a mistake.</>,
    approved: <>Your request to join <span className="font-medium">{familyName}</span> is with
      its administrators.</>,
  }[status]

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">{heading}</CardTitle>
          <CardDescription>{body}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {waiting && (
            <p className="text-sm text-muted-foreground">
              In the meantime you can fill in{' '}
              <Link href="/personal-info" className="text-primary hover:underline">
                your profile
              </Link>
              , so the family recognises you when they review the request.
            </p>
          )}

          {/* Only while a decision is still outstanding. Telling someone whose access
              was declined or switched off to confirm their email advertises a route
              back in that confirming an address does not open. */}
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
    </div>
  )
}
