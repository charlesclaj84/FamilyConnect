'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Copy, Check, ShieldCheck, Clock } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inviteMember } from '@/app/actions/invitations'
import { cn } from '@/lib/utils'

/**
 * Invite someone by email. Used in two places with two different meanings:
 *
 *   My Families      preApproved={false} — the invitee joins the approval queue like
 *                    anyone else, because an ordinary member is not deciding who gets in.
 *   Member Approvals preApproved={true}  — the invitee is admitted on acceptance,
 *                    because the person inviting them is the person who would have
 *                    approved them.
 *
 * The prop is a REQUEST. `create_family_invitation()` grants pre-approval only to a
 * caller holding admin/approvals:edit and quietly downgrades otherwise, so a member who
 * posts `preApproved: true` at the endpoint directly gets an ordinary invitation. What
 * comes back is what actually happened, and that — not the prop — is what the success
 * screen reports.
 *
 * NO EMAIL IS SENT. There is no mail layer in this app and SMTP is unconfigured, so the
 * dialog hands back a link to send. Saying so on screen is the point: an invite button
 * that silently sends nothing is worse than one that gives you something that works.
 */
export function InviteMemberDialog({
  preApproved = false,
  label = 'Invite Member',
  className,
  familyCode,
  familyName,
}: {
  preApproved?: boolean
  label?: string
  className?: string
  /**
   * Invite into a family other than the one being viewed. Omit for "the family I am
   * looking at", which is what Member Approvals wants. /my-families passes it per row.
   */
  familyCode?: string
  /** Only for the wording; the family is decided by `familyCode` server-side. */
  familyName?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState<{ token: string; email: string; preApproved: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  // Composed in the browser rather than on the server so there is no origin to guess
  // or configure — the link is for whatever host the inviter is actually using.
  const inviteLink = result ? `${window.location.origin}/invite/${result.token}` : ''

  function reset() {
    setEmail('')
    setError('')
    setCopied(false)
    setResult(null)
  }

  function close() {
    setOpen(false)
    if (result) router.refresh()
    reset()
  }

  function submit() {
    setError('')
    startTransition(async () => {
      const r = await inviteMember(email, preApproved, familyCode)
      if (r.success) setResult({ token: r.token, email: r.email, preApproved: r.preApproved })
      else setError(r.message)
    })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be refused (permissions, insecure origin). The link is on screen
      // and selectable, so this is a nicety failing rather than the feature.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { reset(); setOpen(true) }}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted',
          className,
        )}
      >
        <UserPlus className="h-4 w-4" /> {label}
      </button>

      <Dialog
        open={open}
        onClose={close}
        title={result ? 'Invitation ready' : label}
        description={
          result
            ? undefined
            : preApproved
              ? 'They will be admitted as soon as they accept — no second approval.'
              : familyName
                ? `They will join ${familyName} once an administrator approves them.`
                : 'They will still need an administrator to approve them.'
        }
      >
        {!result && (
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); submit() }}>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="cousin@example.com"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              We will generate an invitation link for you to send. Only this address can
              use it, and it expires in 14 days.
            </p>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}

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
                disabled={isPending || !email.trim()}
                className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? 'Creating…' : 'Create invitation'}
              </button>
            </div>
          </form>
        )}

        {result && (
          <div className="space-y-4">
            <p className="text-sm">
              An invitation for <span className="font-medium">{result.email}</span>.
            </p>

            <div
              className={cn(
                'flex items-start gap-2 rounded-xl border px-4 py-3 text-sm',
                result.preApproved ? 'bg-brand-soft/50' : 'bg-muted/40',
              )}
            >
              {result.preApproved
                ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                : <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
              <p className={result.preApproved ? '' : 'text-muted-foreground'}>
                {result.preApproved
                  ? 'They will be admitted the moment they accept — they will not appear in the approvals queue.'
                  : 'When they accept they will appear in Member Approvals, waiting for an administrator.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-link">Send them this link</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-link"
                  readOnly
                  value={inviteLink}
                  onFocus={e => e.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              We cannot email this for you yet, so send it however you normally reach
              them. Treat it like a password — anyone who gets hold of it and has that
              email address can use it. It is shown once.
            </p>

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
    </>
  )
}
