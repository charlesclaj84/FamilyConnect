'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Copy, Check, ShieldCheck, Clock, AlertTriangle } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/ui/form-message'
import { inviteMember } from '@/app/actions/invitations'
import { cn } from '@/lib/utils'
import { useT } from '@/components/layout/LocaleProvider'

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
 * THE EMAIL IS SENT FOR YOU, since 2026-08-11. The copy-this-link step it replaced was
 * never a design choice — it was what an app with no mail layer could honestly offer.
 *
 * The link box survives as the FAILURE path and only that. When `emailed` comes back
 * false the action also returns the token, and the dialog says plainly that the message
 * did not go out rather than showing a success screen over an email nobody received.
 * On the happy path there is no token in the payload at all, so there is nothing to
 * copy and nothing to leak.
 */
export function InviteMemberDialog({
  preApproved = false,
  label,
  className,
  familyCode,
  familyName,
  renderTrigger,
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
  /**
   * A trigger of your own, given the function that opens the dialog.
   *
   * WHY A RENDER PROP RATHER THAN A SECOND DIALOG. The Dashboard's Add Member quick
   * action is a round accent chip over a caption, which no amount of `className` can
   * make out of the bordered pill below — the icon and the label are inside the default
   * trigger's markup, not around it. The alternative was a second copy of this dialog
   * with a different button on it, and a second copy is how one of them ends up not
   * carrying the failure path, or the name fields, or the pre-approval wording.
   *
   * The trigger is the ONLY thing this swaps. Everything a caller must not get wrong —
   * the fields, what is reported back, and the token being shown only when the email
   * did not go — is below and is not overridable.
   */
  renderTrigger?: (open: () => void) => React.ReactNode
}) {
  const t = useT()
  // THE DEFAULT IS RESOLVED HERE, not in the parameter list: a default value is evaluated
  // where the parameter is declared, and `t` does not exist yet at that point.
  const triggerLabel = label ?? t('inv.title')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState<{
    name: string
    email: string
    preApproved: boolean
    emailed: boolean
    token?: string
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  const complete = Boolean(firstName.trim() && lastName.trim() && email.trim())

  // Only ever set on the failure path, where the action hands the token back so the
  // invitation is not stranded. Composed in the browser so there is no origin to guess —
  // the link is for whatever host the inviter is actually using.
  const inviteLink = result?.token ? `${window.location.origin}/invite/${result.token}` : ''

  function reset() {
    setFirstName('')
    setLastName('')
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
    const name = { firstName: firstName.trim(), lastName: lastName.trim() }
    startTransition(async () => {
      const r = await inviteMember(email, name, preApproved, familyCode)
      if (r.success) {
        setResult({
          // Held from the form rather than echoed by the action, deliberately: the
          // action returns what the DATABASE recorded about the invitation, and the
          // name is not part of that answer — it is a label, not a decision. The two
          // fields the success screen must not invent are `preApproved` and `emailed`,
          // and both come back from the server.
          name: `${name.firstName} ${name.lastName}`.trim(),
          email: r.email,
          preApproved: r.preApproved,
          emailed: r.emailed,
          token: r.token,
        })
      } else setError(r.message)
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

  function launch() {
    reset()
    setOpen(true)
  }

  return (
    <>
      {renderTrigger ? renderTrigger(launch) : (
        <button
          type="button"
          onClick={launch}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted',
            className,
          )}
        >
          <UserPlus className="h-4 w-4" /> {triggerLabel}
        </button>
      )}

      <Dialog
        open={open}
        onClose={close}
        title={result ? (result.emailed ? t('inv.sent') : t('inv.created')) : triggerLabel}
        description={
          result
            ? undefined
            : preApproved
              ? t('inv.noSecondApproval')
              : familyName
                ? `They will join ${familyName} once an administrator approves them.`
                : t('inv.needsApproval')
        }
      >
        {!result && (
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); submit() }}>
            {/* NAME FIRST, AND BOTH HALVES REQUIRED, since 2026-08-13. Two things needed
                it, and neither is cosmetic: the approvals queue used to be a list of bare
                email addresses, which is not an answer to "who is waiting"; and a member
                who already had an account and merely signed in to accept arrived in the
                directory with no name at all, because the person row was seeded from
                account metadata that is frequently empty.

                Side by side above the address rather than below it, because this is the
                order the inviter is thinking in — they know who their cousin is before
                they go looking for the address. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-first">{t('field.firstNameLower')}</Label>
                <Input
                  id="invite-first"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder={t('field.ph.firstName')}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-last">{t('field.lastNameLower')}</Label>
                <Input
                  id="invite-last"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder={t('field.ph.lastName')}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-email">{t('field.emailAddress')}</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('field.ph.cousinEmail')}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              We&apos;ll email them an invitation. Only this address can use it, and it
              expires in 14 days. The name is what your family sees while they are waiting
              to be admitted.
            </p>

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
                {isPending ? t('action.creating') : t('inv.create')}
              </button>
            </div>
          </form>
        )}

        {result && (
          <div className="space-y-4">
            <p className="text-sm">
              {result.emailed ? (
                <>
                  {t('inv.emailedTo')} <span className="font-medium">{result.name}</span>
                  {' '}at <span className="font-medium">{result.email}</span>.
                </>
              ) : (
                <>
                  {t('inv.anInvitationFor')} <span className="font-medium">{result.name}</span>
                  {' '}at <span className="font-medium">{result.email}</span>.
                </>
              )}
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
                  ? t('inv.admittedAtOnce')
                  : t('inv.willAppearInQueue')}
              </p>
            </div>

            {/*
              The old copy-a-link flow, kept as the failure path and nothing else. If the
              email did not go out, saying "invitation sent" would leave the inviter
              believing their cousin has been contacted and the cousin waiting on nothing.
            */}
            {!result.emailed && (
              <>
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p>
                    The invitation was created, but we could not email it. Send them this
                    link instead — it works exactly the same.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="invite-link">{t('inv.sendThisLink')}</Label>
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
                      {copied ? t('action.copied') : 'Copy'}
                    </button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Treat it like a password — anyone who gets hold of it and has that email
                  address can use it. It is shown once.
                </p>

                {/* Opening it yourself is the obvious thing to do with a link you have just
                    been handed, and it cannot work: redemption requires the session's
                    address to match the invited one. The invitation is not spent by the
                    attempt, but saying so here is cheaper than the trip to that screen. */}
                <p className="text-sm text-muted-foreground">
                  Opening it yourself won&apos;t accept it — only {result.email} can. Following
                  it while signed in as you shows a page explaining that, and does not use
                  the invitation up.
                </p>
              </>
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
    </>
  )
}
