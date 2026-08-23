'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, ExternalLink, RefreshCw, Unplug } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import {
  disconnectProcessor, refreshProcessorStatus, startProcessorOnboarding,
  type ProcessorStatus,
} from '@/app/actions/admin/processing'

/**
 * Accounting → Processing: the family's own Stripe account.
 *
 * ── IT REPLACED A PLACEHOLDER THAT WAS RIGHT TO BE ONE ──────────────────────────────
 * This pane read *"Stripe support is planned for a future release"* and lived inside
 * `AdminAccountShell` as a props-free function. Its neighbour `BankInfoPanel` still does, and
 * still says why both were inert: *"a form that looked functional would invite a treasurer to
 * type a real account and routing number into fields that discard them."*
 *
 * THE ANSWER IS NOT A BETTER FORM. There is no field on this screen. A treasurer presses a
 * button, Stripe collects everything on its own hosted pages, and what comes back to us is an
 * `acct_…` — an identifier, not a credential. `payment_info.md` §4 is the argument and
 * `20260823000005`'s verify block is what stops a future migration adding a column that could
 * hold a key.
 *
 * ── WHY IT MOVED OUT OF THE SHELL ───────────────────────────────────────────────────
 * It needs a prop now, and the shell's other panels are already at the edge of what one file
 * should hold. More importantly the shell keeps every panel MOUNTED at all times so nothing
 * loses a half-filled form on a nav click (see its header) — this panel holds no form, so it
 * has nothing to lose and does not need to be part of that arrangement.
 *
 * ── FOUR STATES, AND EACH ONE SAYS SOMETHING DIFFERENT ──────────────────────────────
 * The temptation is a connected/not-connected boolean, and it would be wrong three ways:
 *
 *   not available    this deployment holds no Stripe credentials. Nobody's fault, nothing to
 *                    do, and offering a button would produce a failure at the API call.
 *   not connected    the family has not started. One button.
 *   awaiting them    Stripe wants something from the family. The button says CONTINUE, because
 *                    "connect" would read as starting over.
 *   under review     the family is finished and Stripe has not decided. There is nothing for
 *                    them to do, and a screen that keeps asking them to act is worse than one
 *                    that says wait.
 *
 * `chargesReady` is the ONLY flag that opens the member-facing Pay Online button, and it comes
 * from `card_payments.status === 'active'` rather than from `charges_enabled` — the two
 * disagree precisely during "under review", which is the window in which a Pay button produces
 * a checkout that fails after somebody has decided to pay.
 */
export function ProcessingPanel({ status }: { status: ProcessorStatus | null }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, startTransition] = useTransition()

  // Null means the read was refused or failed — NOT "no processor" (§8). Saying so is the
  // point: the alternative invites a treasurer to connect a second account on top of a working
  // one, and `family_code` is UNIQUE so the second attempt would fail in a way nobody could
  // read.
  if (!status) {
    return (
      <Panel>
        <p className="text-sm font-medium">Payment settings could not be loaded</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Refresh the page. If this keeps happening, do not try to connect an account — ask an
          administrator to check, because the family may already have one.
        </p>
      </Panel>
    )
  }

  if (!status.available) {
    return (
      <Panel>
        <p className="text-sm font-medium">Online payments are not switched on yet</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{status.unavailable}</p>
        <p className="text-xs text-muted-foreground">
          Dues are recorded by hand from the Transactions ledgers in the meantime, and every
          payment already recorded stays exactly where it is.
        </p>
      </Panel>
    )
  }

  const go = (
    run: () => Promise<{ success: boolean; message?: string; url?: string }>,
  ) => startTransition(async () => {
    setError('')
    setNotice('')
    const result = await run()
    if (!result.success) {
      setError(result.message ?? 'Something went wrong.')
      return
    }
    // A URL means Stripe's own hosted page, and the browser goes there rather than opening a
    // tab: an account link is single-use, so a tab the treasurer leaves open holds a link that
    // has already been spent. `refresh_url` on our side mints a fresh one when that happens.
    if (result.url) {
      window.location.href = result.url
      return
    }
    setNotice(result.message ?? '')
    router.refresh()
  })

  if (!status.connected) {
    return (
      <Panel>
        <p className="text-sm font-medium">No payment processor connected</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Connect this family&rsquo;s own Stripe account and members can pay their dues by card.
          Payments post to the ledger and route into funds on their own, exactly as a payment
          keyed in by hand does.
        </p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          The account belongs to the family, not to GENORRA. Money goes straight to the
          family&rsquo;s own bank, Stripe&rsquo;s fees come out of the family&rsquo;s side, and
          the family keeps its own Stripe dashboard. GENORRA never sees or stores a Stripe key
          and takes no cut of what the family collects.
        </p>
        {status.canManage
          ? (
            <>
              <Button onClick={() => go(startProcessorOnboarding)} disabled={pending}>
                <CreditCard className="h-4 w-4" />
                {pending ? 'Opening Stripe…' : 'Connect a Stripe account'}
              </Button>
              <FormError message={error} />
            </>
          )
          : (
            <p className="text-xs text-muted-foreground">
              You can see this section but not change it. Ask an administrator with payment
              settings access to connect an account.
            </p>
          )}
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {status.chargesReady
                ? 'Card payments are switched on'
                : status.awaitingFamily
                  ? 'Stripe still needs something from this family'
                  : 'Stripe is reviewing this account'}
            </p>
            <p className="text-sm text-muted-foreground">
              {status.chargesReady
                ? 'Members see a Pay Online button beside each due they owe.'
                : status.awaitingFamily
                  ? 'Members cannot pay online until this is finished. Continue in Stripe to complete it.'
                  : 'Nothing more is needed from the family. Members cannot pay online until Stripe finishes.'}
            </p>
          </div>
          {/* THE STATUS IN STRIPE'S OWN WORD, not a translation of it. A treasurer on the
              phone to Stripe support needs the string Stripe uses, and `--brand-withheld` is
              the right marker for "not yet" rather than `--destructive`: nothing has failed. */}
          <span
            className={
              status.chargesReady
                ? 'rounded-full bg-brand-affirm px-3 py-1 text-xs text-brand-on-affirm'
                : 'rounded-full border border-brand-warm px-3 py-1 text-xs text-brand-warm'
            }
          >
            {status.cardPaymentsStatus ?? 'unknown'}
          </span>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Stripe account</dt>
            {/* SHOWN IN FULL. It is the family's own identifier and it is the first thing
                Stripe support asks for; hiding it would be security theatre over a string
                that is useless without our platform key. */}
            <dd className="font-mono text-xs break-all">{status.accountId}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Members paying automatically
            </dt>
            <dd>{status.liveAutopayCount}</dd>
          </div>
        </dl>

        {status.canManage && (
          <div className="flex flex-wrap gap-2">
            {!status.chargesReady && (
              <Button onClick={() => go(startProcessorOnboarding)} disabled={pending}>
                <ExternalLink className="h-4 w-4" />
                Continue in Stripe
              </Button>
            )}
            <Button variant="outline" onClick={() => go(refreshProcessorStatus)} disabled={pending}>
              <RefreshCw className="h-4 w-4" />
              Check with Stripe
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={async () => {
                // ── THE CONFIRMATION NAMES THE CONSEQUENCE, AND THE COUNT IS THE POINT ──
                // Disconnecting cancels every member's recurring payment, because leaving
                // relatives charged monthly for a processor the family removed is the worse
                // outcome and — once we stop acting on that account — one nothing here could
                // fix. A treasurer has to know that before pressing it, not after.
                const ok = await confirm({
                  title: 'Disconnect Stripe?',
                  description: status.liveAutopayCount > 0
                    ? `${status.liveAutopayCount} member${status.liveAutopayCount === 1 ? '' : 's'} pay automatically. Disconnecting stops those payments as well. Every payment already recorded is kept, and the family's Stripe account is untouched.`
                    : 'Members will no longer be able to pay online. Every payment already recorded is kept, and the family\'s Stripe account is untouched.',
                  confirmLabel: 'Disconnect',
                  destructive: true,
                })
                if (ok) go(disconnectProcessor)
              }}
            >
              <Unplug className="h-4 w-4" />
              Disconnect
            </Button>
          </div>
        )}

        <FormError message={error} />
        {notice && <p className="text-sm text-brand-accent">{notice}</p>}
      </div>
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-8 text-center space-y-3">
      <CreditCard className="h-8 w-8 mx-auto text-muted-foreground" />
      {children}
    </div>
  )
}
