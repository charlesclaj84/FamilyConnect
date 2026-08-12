'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck, UserX, Clock, Mail, Phone, ShieldCheck, Send } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm'
import { useServerState } from '@/lib/use-server-state'
import { approveApplicant, rejectApplicant, type Applicant } from '@/app/actions/admin/approvals'
import { revokeInvitation, resendInvitation, type FamilyInvitation, type ResendResult } from '@/app/actions/invitations'
import { InviteMemberDialog } from '@/components/invitations/InviteMemberDialog'
import { formatDate } from '@/lib/date-utils'
import { cn } from '@/lib/utils'

/**
 * Review the join queue.
 *
 * `canDecide` only decides what renders. The grant is checked again in the action and
 * a third time inside set_membership_status(), which is the one that actually holds:
 * hiding a button protects nothing, because the action behind it has a URL.
 */
export function AdminApprovalsClient({
  pending: pendingProp,
  decided: decidedProp,
  canDecide,
  invitations: invitationsProp,
}: {
  pending: Applicant[]
  decided: Applicant[]
  canDecide: boolean
  invitations: FamilyInvitation[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, setPending] = useServerState(pendingProp)
  const [decided] = useServerState(decidedProp)
  const [invitations] = useServerState(invitationsProp)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [rejecting, setRejecting] = useState<Applicant | null>(null)
  const [reason, setReason] = useState('')
  // The outcome of the last resend, kept so the panel below the list can say what was
  // actually sent. Narrowed to the success shape — a failure goes to `error` like any other.
  const [resent, setResent] = useState<Extract<ResendResult, { success: true }> | null>(null)
  const [isPending, startTransition] = useTransition()

  // Accepted and revoked invitations are history, not work. An accepted one has already
  // become a row in one of the two lists above.
  const openInvitations = invitations.filter(i => !i.acceptedAt && !i.revokedAt)

  const name = (a: Applicant) => `${a.firstName} ${a.lastName}`.trim() || a.email || 'This person'

  function run(applicant: Applicant, action: () => Promise<{ success: boolean; message?: string }>) {
    setError('')
    setBusyId(applicant.personId)
    startTransition(async () => {
      const result = await action()
      setBusyId('')
      if (result.success) {
        // Dropped locally so the row leaves the queue immediately; the
        // revalidatePath in the action then replaces the whole list.
        setPending(current => current.filter(p => p.personId !== applicant.personId))
        router.refresh()
      } else {
        setError(result.message ?? 'Something went wrong.')
      }
    })
  }

  async function onApprove(applicant: Applicant) {
    const ok = await confirm({
      title: `Admit ${name(applicant)}?`,
      description:
        'They will get immediate access to everything your family has made visible to members.',
      confirmLabel: 'Approve',
    })
    if (!ok) return
    run(applicant, () => approveApplicant(applicant.personId))
  }

  function onReject(applicant: Applicant) {
    setReason('')
    setRejecting(applicant)
  }

  /**
   * Reverse a decline from the Declined list.
   *
   * NO NEW SERVER ACTION, deliberately. `approveApplicant` already does exactly this —
   * set_membership_status accepts 'rejected' → 'approved' (it refuses only a 'disabled'
   * target and no-ops when the status is unchanged, 20260807000000:998-1029) — and it
   * brings the notification and the approval email with it, which a re-admitted person
   * needs just as much as a first-time one. Every export of a 'use server' file is a
   * public endpoint, so a second action that resolves to the same RPC call would be new
   * attack surface bought for a synonym.
   *
   * Until 2026-08-11 nothing in the app could do this at all: the Declined list rendered
   * no controls, so a decline was permanent even though the RPC had always allowed it.
   */
  /**
   * Resend an invitation, and say what that turned out to mean.
   *
   * No confirmation dialog: it is not destructive in any way a person would want to stop,
   * and the one side effect worth knowing — the old link stops working — is stated in the
   * panel afterwards rather than guarded in front.
   */
  function onResend(invitation: FamilyInvitation) {
    setError('')
    setResent(null)
    setBusyId(invitation.id)
    startTransition(async () => {
      const r = await resendInvitation(invitation.id)
      setBusyId('')
      if (r.success) {
        setResent(r)
        // The RPC revoked the old row and minted a new one, so the list this is rendered
        // from is stale by exactly one row in each direction.
        router.refresh()
      } else {
        setError(r.message)
      }
    })
  }

  async function onReadmit(applicant: Applicant) {
    const ok = await confirm({
      title: `Admit ${name(applicant)} after all?`,
      description:
        'They were declined before. Admitting them now gives them immediate access to everything your family has made visible to members, and they will be told.',
      confirmLabel: 'Admit',
    })
    if (!ok) return
    run(applicant, () => approveApplicant(applicant.personId))
  }

  function submitRejection() {
    const applicant = rejecting
    if (!applicant) return
    setRejecting(null)
    run(applicant, () => rejectApplicant(applicant.personId, reason))
  }

  return (
    /*
     * NO CARD BOXES. The rail above names this pane, and the three lists below used to
     * sit in three bordered cards inside it — a box for the pane inside a box for the
     * page. The HEADINGS stay, and that is the difference from the other panes that lost
     * theirs: "Waiting for approval", "Invitations sent" and "Declined" are three
     * different lists in one pane, so the rail's single word cannot name them. Only the
     * borders and fills went; each ROW keeps its own, which separates one applicant from
     * the next.
     */
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-4 w-4" /> Waiting for approval
              {pending.length > 0 && (
                <span className="rounded-full bg-brand-primary px-2 py-0.5 text-xs font-semibold text-brand-on-primary">
                  {pending.length}
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              {pending.length === 0
                ? 'Nobody is waiting. Requests appear here when someone joins with your family code.'
                : 'Check that you recognise the person before admitting them.'}
            </p>
          </div>

          {/* preApproved — the distinguishing thing about inviting from THIS page. The
              person clicking it is the person who would otherwise approve the
              applicant, so routing them through the queue would be asking them to
              confirm their own decision. Only rendered for someone who can actually
              decide; the server grants it independently of this prop. */}
          {canDecide && <InviteMemberDialog preApproved />}
        </div>

        {pending.length > 0 && (
          <div className="space-y-2">
            {pending.map(applicant => {
              const busy = isPending && busyId === applicant.personId
              return (
                <div
                  key={applicant.personId}
                  className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name(applicant)}</p>
                    <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      {applicant.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {applicant.email}
                        </span>
                      )}
                      {applicant.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {applicant.phone}
                        </span>
                      )}
                      {applicant.requestedAt && (
                        <span>Asked {formatDate(applicant.requestedAt)}</span>
                      )}
                      {/* THIS PERSON HAS BEEN HERE BEFORE. Since 20260811000001 a declined
                          person can be asked back, and accepting returns them to this
                          queue — with membership_note, _decided_at and _decided_by
                          deliberately preserved, so the administrator deciding again can
                          see that somebody already said no once, and why.

                          `decidedAt` is an exact test for it on a PENDING row: the stamp
                          trigger nulls it for an ordinary joiner (20260806000011:139), the
                          re-open leaves it alone, and nothing else in the app writes
                          'pending' over a decided row. */}
                      {applicant.decidedAt && (
                        <span className="inline-flex items-center gap-1">
                          <UserX className="h-3 w-3" />
                          Previously declined {formatDate(applicant.decidedAt)}
                          {applicant.note ? ` — ${applicant.note}` : ''}
                        </span>
                      )}
                    </div>

                    {/* THEIR REPLY, attributed and visually separated, because it is the
                        one thing on this screen the applicant wrote. Rendering it in the
                        same muted run as the family's own metadata would read as the
                        family's words — and this is text a stranger supplied. */}
                    {applicant.appeal && (
                      <blockquote className="mt-2 border-l-2 border-brand-primary/40 bg-brand-soft/40 px-3 py-2 text-xs">
                        <p className="font-medium">They asked you to look again:</p>
                        <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">
                          {applicant.appeal}
                        </p>
                      </blockquote>
                    )}
                  </div>

                  {canDecide && (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onApprove(applicant)}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-primary px-2.5 py-1 text-xs font-medium text-brand-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        <UserCheck className="h-3 w-3" />
                        {busy ? 'Saving…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onReject(applicant)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-60"
                      >
                        <UserX className="h-3 w-3" /> Decline
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {openInvitations.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Mail className="h-4 w-4" /> Invitations sent
            </h2>
            <p className="text-sm text-muted-foreground">
              Not yet accepted. Cancelling one stops the link working — worth doing if it
              went to the wrong address, since only that address can use it.
            </p>
          </div>
          <div className="space-y-2">
            {openInvitations.map(invitation => {
              const busy = isPending && busyId === invitation.id
              return (
                <div
                  key={invitation.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="truncate">{invitation.email}</span>
                      {invitation.preApproved && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-on-primary">
                          <ShieldCheck className="h-3 w-3" /> Pre-approved
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {invitation.invitedBy ? `Invited by ${invitation.invitedBy}` : 'Invited'}
                      {invitation.expiresAt ? ` · expires ${formatDate(invitation.expiresAt)}` : ''}
                    </p>
                  </div>
                  {canDecide && (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onResend(invitation)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-60"
                      >
                        <Send className="h-3 w-3" />
                        {busy ? 'Sending…' : 'Resend'}
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setError('')
                          setBusyId(invitation.id)
                          startTransition(async () => {
                            const r = await revokeInvitation(invitation.id)
                            setBusyId('')
                            if (r.success) router.refresh()
                            else setError(r.message ?? 'Something went wrong.')
                          })
                        }}
                        className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-60"
                      >
                        {busy ? 'Cancelling…' : 'Cancel'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* WHAT THE RESEND ACTUALLY DID, in the administrator's words rather than ours.
              A bare "sent" is the failure mode this whole flow exists to remove: the case
              that prompted it was an invitee who could not sign in, where three resends of
              the invitation changed nothing and nobody was told why. */}
          {resent && (
            <div className="rounded-xl border border-brand-primary/30 bg-brand-soft/50 px-4 py-3 text-sm">
              <p className="font-medium">
                {resent.emailed
                  ? <>A new invitation is on its way to {resent.email}.</>
                  : <>A new invitation was created for {resent.email}, but we could not email it.</>}
              </p>
              <p className="mt-1 text-muted-foreground">
                {resent.confirmationRequested
                  ? <>They already have an account but never confirmed their email address, so
                      they could not have signed in to accept. We have asked for the
                      confirmation email to be sent again as well — they need to click that
                      one first.</>
                  : resent.account === 'confirmed'
                    ? <>Their account is confirmed, so the link will take them straight to
                        sign-in and join.</>
                    : resent.account === 'none'
                      ? <>There is no account for that address yet, so the link will take them
                          to create one. They will not need the family code.</>
                      : <>We could not check whether that address has an account, so if they
                          still cannot get in, it is worth asking whether they ever confirmed
                          their email.</>}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The previous link has stopped working — a resend always issues a new one.
              </p>
            </div>
          )}
        </section>
      )}

      {decided.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Declined</h2>
            <p className="text-sm text-muted-foreground">
              {canDecide
                ? <>Kept rather than deleted, so the record of the decision survives. You can
                    admit somebody after all, and any member can send them a fresh
                    invitation.</>
                : <>Kept rather than deleted, so the record of the decision survives.</>}
            </p>
          </div>
          <div className="space-y-2">
            {decided.map(applicant => {
              const busy = isPending && busyId === applicant.personId
              return (
                <div
                  key={applicant.personId}
                  className={cn('flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm', 'bg-muted/40')}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{name(applicant)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Declined{applicant.decidedAt ? ` ${formatDate(applicant.decidedAt)}` : ''}
                      {applicant.decidedBy ? ` by ${applicant.decidedBy}` : ''}
                      {applicant.note ? ` — ${applicant.note}` : ''}
                    </p>
                  </div>

                  {/* GATED SEPARATELY, because this SECTION is not. It renders for anyone
                      holding admin/approvals:view, and only an editor may reverse a
                      decision — the action and set_membership_status both check again. */}
                  {canDecide && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => onReadmit(applicant)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-60"
                    >
                      <UserCheck className="h-3 w-3" />
                      {busy ? 'Saving…' : 'Admit after all'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <Dialog
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={`Decline ${rejecting ? name(rejecting) : ''}?`}
        description="They will be told, and may be given a reason. Their record is kept rather than deleted."
      >
        <div className="space-y-4">
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason (optional — shown to them)"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejecting(null)}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitRejection}
              className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90"
            >
              Decline request
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
