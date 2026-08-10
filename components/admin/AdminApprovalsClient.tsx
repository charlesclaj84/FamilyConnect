'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck, UserX, Clock, Mail, Phone, ShieldCheck } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm'
import { useServerState } from '@/lib/use-server-state'
import { approveApplicant, rejectApplicant, type Applicant } from '@/app/actions/admin/approvals'
import { revokeInvitation, type FamilyInvitation } from '@/app/actions/invitations'
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
                <span className="rounded-full bg-brand-navy px-2 py-0.5 text-xs font-semibold text-brand-tint">
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
                    </div>
                  </div>

                  {canDecide && (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onApprove(applicant)}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-2.5 py-1 text-xs font-medium text-brand-tint transition-opacity hover:opacity-90 disabled:opacity-60"
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
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-navy px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-tint">
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
                      className="shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-60"
                    >
                      {busy ? 'Cancelling…' : 'Cancel'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {decided.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Declined</h2>
            <p className="text-sm text-muted-foreground">
              Kept rather than deleted, so a request cannot be silently re-submitted and
              so the record of the decision survives.
            </p>
          </div>
          <div className="space-y-2">
            {decided.map(applicant => (
              <div
                key={applicant.personId}
                className={cn('rounded-xl border px-4 py-3 text-sm', 'bg-muted/40')}
              >
                <p className="font-medium">{name(applicant)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Declined{applicant.decidedAt ? ` ${formatDate(applicant.decidedAt)}` : ''}
                  {applicant.decidedBy ? ` by ${applicant.decidedBy}` : ''}
                  {applicant.note ? ` — ${applicant.note}` : ''}
                </p>
              </div>
            ))}
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
