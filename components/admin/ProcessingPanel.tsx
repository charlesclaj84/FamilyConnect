'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, ExternalLink, RefreshCw, Unplug } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  DEFAULT_CONNECT_COUNTRY, connectCountry, enabledConnectCountries, hasConnectCountryChoice,
} from '@/lib/stripe/connect-countries'
import { EmailedCodeField, PasswordReauthField } from '@/components/ui/challenge-fields'
// THE THROWAWAY CLIENT, deliberately — never the app's own. Signing in on the app's client
// would replace the session, and a new session's `created_at` resets GoTrue's 24-hour
// reauthentication window. AGENTS.md states that rule where the Password panel lives.
import { verifyCurrentPassword } from '@/lib/supabase/client'
import { grossUpCents } from '@/lib/stripe-fees'
import {
  disconnectProcessor, refreshProcessorStatus, requestProcessorDisconnectCode,
  startProcessorOnboarding, setProcessingFeePolicy, setProcessorCountry, type ProcessorStatus,
} from '@/app/actions/admin/processing'
import { useT } from '@/components/layout/LocaleProvider'
import { useMoney } from '@/components/layout/MoneyProvider'
import type { T } from '@/lib/i18n/t'

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
/**
 * What disconnecting actually does, in one place, for every screen that has to say it.
 *
 * ── THE IRREVERSIBLE CLAUSE IS THE WHOLE REASON THIS IS A FUNCTION ─────────────────
 * The reversible half is obvious and was the only half the product used to state: members
 * stop being able to pay online, nothing recorded is lost, the family's own Stripe account is
 * untouched, and reconnecting is one press. All true — and a treasurer who reads only that
 * concludes a mistaken disconnect costs them a click. It does not: every recurring payment is
 * cancelled AT STRIPE on the way out, a cancelled subscription cannot be un-cancelled, and so
 * each of those relatives has to set theirs up again. That sentence has to appear wherever the
 * act is described, which is why it is not typed at three call sites.
 *
 * THE COUNT CHANGES THE SENTENCE, because "4 relatives" is a different decision from
 * "nobody" — and a family with no autopays should not be warned about an unwinding that will
 * not happen to them.
 */
function disconnectConsequence(autopayCount: number, t: T): string {
  // THREE WHOLE SENTENCES rather than a base plus two spliced fragments. The old form built
  // "1 relative currently pays" / "4 relatives currently pay" and "that relative" / "each of
  // them" separately and joined them — three English agreement rules in the source, none of
  // which survives translation. Same split as `email.disconnect.autopay*`, which says the
  // same thing to the same reader.
  const base = t('proc.consequenceBase')
  if (autopayCount === 0) return `${base} ${t('proc.consequenceNone')}`
  return `${base} ${autopayCount === 1
    ? t('proc.consequenceOne')
    : t('proc.consequenceMany', { n: autopayCount })}`
}

export function ProcessingPanel({ status }: { status: ProcessorStatus | null }) {
  const t = useT()
  const router = useRouter()
  const confirm = useConfirm()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, startTransition] = useTransition()
  // ── A SECOND BUSY FLAG, FOR THE ONE FLOW THAT WAITS ON A PERSON ───────────────────
  // Every other control here is one server call and `useTransition` covers it. The
  // disconnection is a password, then a mail, then a code, then the act — so it awaits a
  // human twice in the middle, and a transition held open across two dialogs would report
  // the app as busy while it is in fact waiting for typing. Every button reads
  // `pending || busy`, so the flow still locks the panel behind it.
  const [busy, setBusy] = useState(false)
  // Neither is ever carried between two confirmations: a cancelled dialog reopened must ask
  // again, and a password or a code left in a ref is one a later action could spend. Both are
  // refs rather than state for the reason `components/ui/challenge-fields.tsx` gives — the
  // field lives inside a node `confirm()` captured and never re-renders from here.
  const passwordRef = useRef('')
  const codeRef = useRef('')

  // ── COMING BACK FROM STRIPE, WHICH NOTHING USED TO NOTICE ─────────────────────────
  // `startProcessorOnboarding` sends Stripe two addresses and both come back here with a
  // marker: `?connect=return` when the family finishes, `?connect=refresh` when the link they
  // were using had expired. Until 2026-08-25 NOTHING READ EITHER, while
  // `refreshProcessorStatus`' own header claimed "the return page from onboarding calls it".
  //
  // What that cost is bigger than a stale badge, and it is why this is a fix rather than a
  // nicety. `ensureConnectedAccount` returns early when a row already exists and writes
  // nothing, so `disconnected_at` is cleared by exactly two things: the first-ever create, and
  // this refresh. A family that disconnected and then reconnected therefore came back with
  // `disconnected_at` still set, `connected` still false, and the panel still offering them
  // **Connect a Stripe account** — forever, however many times they pressed it.
  //
  // ── FOUR THINGS ABOUT THE SHAPE ──────────────────────────────────────────────────
  //   * IT IS AN EFFECT, NOT A CALL DURING RENDER. `refreshProcessorStatus` writes to the
  //     database and calls `revalidatePath`, and Next refuses that inside a render.
  //   * `window.location.search`, NOT `useSearchParams()`. The value is wanted once, on mount,
  //     and the hook drags a Suspense boundary requirement onto a component that needs none.
  //   * ONCE, guarded by a ref, and the marker is stripped from the address before the action
  //     is even sent. `router.refresh()` re-renders this component, and a reload of a URL that
  //     still carried the marker would re-fire it.
  //   * ONLY FOR SOMEBODY WHO MAY WRITE. The action is `requireEdit`, so firing it for a
  //     read-only viewer returns a refusal and paints an error on a screen where they have
  //     done nothing wrong.
  //
  // It is placed ABOVE the early returns on purpose: three branches below return before the
  // end of this function, and a hook after them would run conditionally.
  const synced = useRef(false)
  const canManage = status?.canManage === true
  useEffect(() => {
    if (synced.current || !canManage) return
    const params = new URLSearchParams(window.location.search)
    const marker = params.get('connect')
    if (marker !== 'return' && marker !== 'refresh') return

    synced.current = true
    params.delete('connect')
    const query = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''))

    startTransition(async () => {
      const result = await refreshProcessorStatus()
      if (!result.success) {
        setError(result.message)
        return
      }
      // ── THE EXPIRED-LINK CASE GETS ITS OWN SENTENCE, AND NO AUTOMATIC REDIRECT ─────
      // Stripe's `refresh_url` is meant to mint a new link and send the family straight back,
      // and this deliberately does not: minting on page load turns a link that keeps expiring
      // into an unbreakable bounce between Stripe and this screen, with no way out from the
      // UI. The state is synced, the reason is stated, and the family presses the button —
      // one click to buy an escape hatch.
      setNotice(marker === 'refresh'
        ? t('proc.linkExpired')
        : result.message)
      router.refresh()
    })
  }, [canManage, router, t])

  /**
   * Which country the family's account is created in — and, since 2026-09-01, the currency its
   * BOOKS are kept in.
   *
   * ── IT IS SEEDED FROM THE FAMILY NOW, NOT FROM A CONSTANT ───────────────────────
   * This said *"NOT SEEDED FROM `status.country`: on the branch where this is rendered there is
   * no account and therefore no country"* — true while the only place a country lived was the
   * Stripe row. `families.connect_country` exists from the moment the family does, because a
   * family recording cash dues has a currency before it has a merchant account. So the seed is
   * `status.country`, which is `'us'` for every family created before the column existed —
   * genuinely American rather than merely unasked, which is what `DEFAULT_CONNECT_COUNTRY`
   * already said.
   *
   * ── CHANGING IT SAVES IMMEDIATELY, RATHER THAN WAITING FOR ONBOARDING ───────────
   * Because it decides the family's currency and not only Stripe's paperwork. Leaving it as an
   * argument to `startProcessorOnboarding` would leave every family that never connects Stripe
   * on dollars with no way to say otherwise — a family in Monterrey keeping its books in pesos
   * must not have to open a merchant account to do it.
   *
   * `useServerState` so a save landing elsewhere (or a family switch) re-syncs it, and so the
   * optimistic value survives the `router.refresh()` the save fires.
   *
   * ── DECLARED HERE, ABOVE THE TWO EARLY RETURNS ──────────────────────────────────
   * Not beside the picker it feeds. This component returns early when `status` is null and
   * again when the deployment cannot take payments, so a hook below either of those is called
   * conditionally — `react-hooks/rules-of-hooks` caught it, and it is a real defect: the hook
   * order would differ between a render that has a status and one that does not.
   */
  const [country, setCountry] = useState(status?.country ?? DEFAULT_CONNECT_COUNTRY)

  /**
   * Save the country, and with it the currency.
   *
   * The action re-checks both locks (an account exists; a payment has been recorded) because
   * the control in front of it is a convenience and not a gate — and `families_guard_currency`
   * refuses the write regardless. What this adds is a sentence a treasurer can act on instead
   * of a 42501.
   *
   * ON FAILURE THE SELECT SNAPS BACK, which matters more here than it usually would: leaving a
   * picker showing a country the family is not in would misstate which currency their figures
   * are in on every screen.
   */
  const chooseCountry = useCallback((next: string) => {
    const previous = country
    setCountry(next)
    setError('')
    setNotice('')
    startTransition(async () => {
      const result = await setProcessorCountry(next)
      if (!result.success) {
        setCountry(previous)
        setError(result.message)
        return
      }
      setNotice(result.message)
      router.refresh()
    })
  }, [country, router, setCountry])

  // Null means the read was refused or failed — NOT "no processor" (§8). Saying so is the
  // point: the alternative invites a treasurer to connect a second account on top of a working
  // one, and `family_code` is UNIQUE so the second attempt would fail in a way nobody could
  // read.
  if (!status) {
    return (
      <Panel>
        <p className="text-sm font-medium">{t('proc.loadFailed')}</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{t('adm.refreshPageIfKeeps')}</p>
      </Panel>
    )
  }

  if (!status.available) {
    return (
      <Panel>
        <p className="text-sm font-medium">{t('proc.notOn')}</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{status.unavailable}</p>
        <p className="text-xs text-muted-foreground">{t('adm.duesRecordedHandFrom')}</p>
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
      setError(result.message ?? t('meet.wentWrong'))
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

  /**
   * Disconnecting: a password, then a code from the mailbox, then the act.
   *
   * ── WHY TWO FACTORS FOR SOMETHING THAT LOOKS UNDOABLE ────────────────────────────
   * Because only half of it is. Reconnecting is one press and brings the SAME Stripe account
   * back — but every member's recurring payment is cancelled at Stripe on the way out, and a
   * cancelled subscription cannot be un-cancelled. So the screen offers something that reads
   * as reversible and is not, which is the same shape as removing a family and now gets the
   * same gate.
   *
   * ── WHAT EACH STEP IS WORTH, STATED HONESTLY ─────────────────────────────────────
   * The PASSWORD is checked here, in the browser, on a throwaway client — so it is not a gate
   * and the copy must not claim one: the caller already holds `admin/accounting/processing`
   * at edit and this is a public endpoint either way. It stops an accident, and it stops
   * somebody at an unlocked screen. The CODE is the real factor, verified in SQL.
   *
   * ── THE ORDER IS PASSWORD FIRST, AND THAT IS DELIBERATE ──────────────────────────
   * The mail is only sent once somebody has proved they are sitting here. Minting first would
   * make this endpoint a way to put a "confirm disconnecting Stripe" email in a treasurer's
   * inbox on demand — noise at best, and a plausible phishing lure at worst.
   */
  async function beginDisconnect() {
    passwordRef.current = ''
    const okPassword = await confirm({
      title: t('proc.disconnectConfirm'),
      description: disconnectConsequence(status?.liveAutopayCount ?? 0, t),
      body: (
        <PasswordReauthField
          valueRef={passwordRef}
          id="processor-disconnect-password"
          hint={t('proc.passwordHint')}
        />
      ),
      confirmLabel: t('action.continue'),
      destructive: true,
      verify: async () => {
        const result = await verifyCurrentPassword(passwordRef.current)
        return result.ok ? null : result.message
      },
    })
    passwordRef.current = ''
    if (!okPassword) return

    setError('')
    setNotice('')
    setBusy(true)
    try {
      const requested = await requestProcessorDisconnectCode()
      if (!requested.success) {
        setError(requested.message)
        return
      }
      // THE MAIL MAY NOT HAVE GONE, and `sendEmail` never throws (see lib/email/send.ts). A
      // code box over an email that did not arrive is the failure `inviteMember` was
      // rewritten to avoid, so the note is surfaced rather than swallowed.
      if (!requested.emailed) {
        setError(requested.note
          ?? t('proc.codeFailed'))
        return
      }

      codeRef.current = ''
      const okCode = await confirm({
        title: t('proc.enterCode'),
        description: disconnectConsequence(requested.autopayCount, t),
        body: (
          <EmailedCodeField
            valueRef={codeRef}
            id="processor-disconnect-code"
            sentTo={requested.sentTo}
          />
        ),
        confirmLabel: t('proc.disconnectStripe'),
        destructive: true,
        // A SHAPE CHECK AND NOTHING MORE. This runs in the browser and cannot know whether the
        // code is right — only `consume_family_action_challenge` decides that. What it buys is
        // that an empty or half-typed box refuses inside the dialog instead of spending one of
        // five attempts and closing it.
        verify: async () =>
          /^\d{6}$/.test(codeRef.current.trim())
            ? null
            : t('set.enterCode'),
      })
      const typed = codeRef.current.trim()
      codeRef.current = ''
      if (!okCode) return

      const result = await disconnectProcessor(typed)
      if (!result.success) {
        // A refused code closes the dialog and says why HERE, beside the button that caused
        // it. The code is spent either way, so the next attempt starts from the beginning —
        // which is why the Disconnect button stays on screen.
        setError(result.message)
        return
      }
      setNotice(result.message)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!status.connected) {
    // ── DISCONNECTED IS NOT THE SAME AS NEVER CONNECTED ─────────────────────────────
    // A family that has disconnected still HAS a `family_stripe_accounts` row carrying its
    // `acct_…`; only `disconnected_at` is stamped. Pressing the button returns that same
    // account rather than creating a second one — `ensureConnectedAccount` looks the row up
    // and returns early — so calling it "Connect a Stripe account" describes something that
    // does not happen and invites a treasurer to think they are about to start over with a
    // new merchant account and new bank details. It says **Reconnect** since 2026-08-25.
    const returning = status.accountId != null
    return (
      <Panel>
        <p className="text-sm font-medium">
          {returning ? t('proc.disconnected') : t('proc.noProcessor')}
        </p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {returning
            ? t('proc.cannotPay')
            : t('proc.connectHint')}
        </p>
        {/* THE CLAUSE, ON THIS SCREEN TOO. Somebody looking at a disconnected panel is
            usually somebody deciding whether to undo it, and "the same account comes back"
            is exactly the half that would let them assume the payments do as well. */}
        {returning && (
          <p className="text-sm text-brand-withheld max-w-md mx-auto">{t('adm.anyRecurringPaymentsRunning')}</p>
        )}
        <p className="text-xs text-muted-foreground max-w-md mx-auto">{t('adm.accountBelongsFamilyNot')}</p>
        {status.canManage
          ? (
            <>
              {/* ── WHERE THE FAMILY BANKS, ASKED ONCE AND NEVER AGAIN ─────────────────
                  `identity.country` decides the payout currency, which identity documents
                  Stripe demands and which regulations apply, and **Stripe does not let it
                  change afterwards** — so this is the one control on this panel whose answer
                  is permanent, and the copy under it says so rather than leaving a treasurer
                  to discover it during onboarding.

                  ONLY ON THE NO-ACCOUNT BRANCH, and only when there is more than one country
                  to choose between: a family reconnecting has already decided, and a picker
                  offering one option is furniture. `hasConnectCountryChoice()` is the whole
                  condition, so narrowing `CONNECT_COUNTRIES` back to one enabled country
                  removes this control rather than leaving a dead one.

                  A NATIVE `<select>`, per AGENTS.md's rule about member pickers: three
                  options, no icons, no per-row actions, and the platform gives keyboard
                  handling, mobile presentation and type-ahead for free. */}
              {hasConnectCountryChoice() && !status.countryLocked && (
                <div className="mx-auto max-w-xs space-y-1.5 text-start">
                  <Label htmlFor="connect-country" required>{t('proc.countryLabel')}</Label>
                  <Select
                    id="connect-country"
                    value={country}
                    onChange={e => chooseCountry(e.target.value)}
                    disabled={pending || busy}
                  >
                    {enabledConnectCountries().map(c => (
                      <option key={c.code} value={c.code}>{t(`country.${c.code}`)}</option>
                    ))}
                  </Select>
                  {/* WHAT IT DECIDES, IN THE SAME BREATH. The currency is derived from the
                      country and a treasurer choosing Canada is choosing to keep the family's
                      books in Canadian dollars — which is a bigger consequence than the
                      paperwork, and one nothing else on this screen would tell them. */}
                  <p className="text-xs text-muted-foreground">
                    {t('proc.countryDecidesCurrency', {
                      currency: (connectCountry(country)?.currency ?? 'usd').toUpperCase(),
                    })}
                  </p>
                  <p className="text-xs text-brand-withheld">{t('proc.countryPermanent')}</p>
                </div>
              )}

              {/* LOCKED, AND IT SAYS WHICH LOCK. Two independent reasons — Stripe cannot move
                  `identity.country` after creation, and the ledger is append-only and carries
                  no currency of its own — and a treasurer looking for the control needs to
                  know which of them applies to them. Absent rather than disabled would leave
                  somebody hunting for a setting that is not missing, it is settled. */}
              {status.countryLocked && (
                <p className="mx-auto max-w-md text-xs text-muted-foreground">
                  {t(status.countryLockedBy === 'payments'
                    ? 'proc.currencyFixedByPayments'
                    : 'proc.currencyFixedByAccount',
                    {
                      country: t(`country.${status.country}`),
                      currency: status.currency.toUpperCase(),
                    })}
                </p>
              )}
              <Button onClick={() => go(() => startProcessorOnboarding(country))} disabled={pending || busy}>
                <CreditCard className="h-4 w-4" />
                {pending
                  ? t('proc.opening')
                  : returning ? t('proc.reconnect') : t('proc.connect')}
              </Button>
              <FormError message={error} />
              {/* THE NOTICE BELONGS IN THIS BRANCH TOO, and it was in the connected one
                  alone until 2026-08-25. A family bounced back by an expired link lands here,
                  still not connected — which is exactly when the sentence explaining why is
                  worth reading, and exactly where it used to have nowhere to render. */}
              {notice && <p className="text-sm text-brand-accent">{notice}</p>}
            </>
          )
          : (
            <p className="text-xs text-muted-foreground">{t('adm.canSeeSectionBut')}</p>
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
                ? t('proc.cardsOn')
                : status.awaitingFamily
                  ? t('proc.stripeNeeds')
                  : t('proc.stripeReviewing')}
            </p>
            <p className="text-sm text-muted-foreground">
              {status.chargesReady
                ? t('proc.membersSeeButton')
                : status.awaitingFamily
                  ? t('proc.finishFirst')
                  : t('proc.nothingMore')}
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
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('proc.stripeAccount')}</dt>
            {/* SHOWN IN FULL. It is the family's own identifier and it is the first thing
                Stripe support asks for; hiding it would be security theatre over a string
                that is useless without our platform key. */}
            <dd className="font-mono text-xs break-all">{status.accountId}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('proc.payingAuto')}
            </dt>
            <dd>{status.liveAutopayCount}</dd>
          </div>
        </dl>

        {/* ── WHO PAYS THE PROCESSING FEE ─────────────────────────────────────────────
            Under the account details, above the buttons that connect and disconnect it: it is
            a setting ABOUT this account, and it is meaningless without one. A family that has
            not connected never sees it, because there is nothing yet for it to govern. */}
        <FeePolicyFields status={status} />

        {status.canManage && (
          <div className="flex flex-wrap gap-2">
            {!status.chargesReady && (
              <Button onClick={() => go(startProcessorOnboarding)} disabled={pending || busy}>
                <ExternalLink className="h-4 w-4" />
                {t('proc.continueStripe')}
              </Button>
            )}
            <Button variant="outline" onClick={() => go(refreshProcessorStatus)} disabled={pending || busy}>
              <RefreshCw className="h-4 w-4" />
              {t('proc.checkStripe')}
            </Button>
            <Button variant="outline" disabled={pending || busy} onClick={beginDisconnect}>
              <Unplug className="h-4 w-4" />
              {t('proc.disconnect')}
            </Button>
          </div>
        )}

        {/* ── THE CLAUSE, BEFORE THE BUTTON IS PRESSED RATHER THAN INSIDE THE DIALOG ───
            The confirmation says this too, and saying it twice is the point: a treasurer
            weighing whether to disconnect at all should not have to open a destructive dialog
            to find out that the recurring payments do not come back. `disconnectConsequence`
            is the one sentence, so the two cannot drift, and it goes quiet — `--brand-withheld`
            — when nobody is affected. Not `--destructive`: nothing has failed and nothing is
            deleted, which is the line AGENTS.md draws between the two tokens. */}
        {status.canManage && status.liveAutopayCount > 0 && (
          <p className="text-xs text-brand-withheld">
            {disconnectConsequence(status.liveAutopayCount, t)}
          </p>
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

/**
 * Who bears Stripe's processing fee, and at what stated rate.
 *
 * ── THE QUOTE IS SHOWN, BECAUSE THE SETTING IS OTHERWISE ABSTRACT ───────────────────
 * "The member covers the fee" does not tell a treasurer what a relative will actually be
 * asked for, and the answer is not the one most people would guess: grossing up $40 at
 * 2.9% + 30c is $41.50, not $41.46, because the fee applies to the grossed-up charge too. So
 * the panel works the example with the family's own rate, live, as they type it.
 *
 * `grossUpCents` rather than a second copy of the arithmetic — the SAME function
 * `startDuesCheckout` charges with, so the figure quoted here cannot come to differ from the
 * figure a member is charged. That is the whole reason it is a pure module in `lib/`.
 *
 * ── AND WHAT THEY HAVE ACTUALLY PAID, BESIDE IT ─────────────────────────────────────
 * `feesPaidCents` is measured — the sum of every `balance_transaction.fee` recorded. It is
 * shown next to the stated rate because that juxtaposition is the only way anybody would ever
 * notice their stated rate is wrong for the cards their family really uses: the difference is
 * silently absorbed by the family, so nothing else will ever raise it.
 *
 * ── IT IS A CLIENT COMPONENT AND OWNS `'use client'` THROUGH ITS PARENT ─────────────
 * Declared in this file rather than its own, so it inherits the directive at the top. It takes
 * no `t` prop and calls `useT()` because it is only ever rendered by `ProcessingPanel`, which
 * is itself a client component — the second row of AGENTS.md's table, not the first.
 */
function FeePolicyFields({ status }: { status: ProcessorStatus }) {
  const t = useT()
  const money = useMoney()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [feePayer, setFeePayer] = useState<'family' | 'member'>(status.feePayer)
  // Held as typed, in the units a person thinks in — a percentage and dollars — and converted
  // on save. Basis points in an input box would be a control asking somebody to do arithmetic
  // in their head to enter a rate their processor states as "2.9%".
  const [percent, setPercent] = useState((status.feePercentBps / 100).toString())
  const [fixed, setFixed] = useState((status.feeFixedCents / 100).toFixed(2))
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const rate = {
    percentBps: Math.round((parseFloat(percent) || 0) * 100),
    fixedCents: Math.round((parseFloat(fixed) || 0) * 100),
  }
  // THE WORKED EXAMPLE, on a round $40 so the arithmetic is legible. Null when the typed rate
  // has no fixed point, which the save below refuses anyway — the example simply goes quiet
  // rather than printing a figure derived from a rate nobody can be charged at.
  const example = grossUpCents(EXAMPLE_OWED_CENTS, rate)

  const dirty = feePayer !== status.feePayer
    || rate.percentBps !== status.feePercentBps
    || rate.fixedCents !== status.feeFixedCents

  function save() {
    setError('')
    setSaved(false)
    startTransition(async () => {
      const result = await setProcessingFeePolicy({
        feePayer,
        feePercentBps: rate.percentBps,
        feeFixedCents: rate.fixedCents,
      })
      if (!result.success) { setError(result.message); return }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div>
        <h3 className="text-sm font-semibold">{t('proc.feeHeading')}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('proc.feeBlurb')}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fee-payer">{t('proc.feeWhoPays')}</Label>
        <Select
          id="fee-payer"
          value={feePayer}
          disabled={!status.canManage || pending}
          onChange={e => { setFeePayer(e.target.value === 'member' ? 'member' : 'family'); setSaved(false) }}
        >
          <option value="family">{t('proc.feePayerFamily')}</option>
          <option value="member">{t('proc.feePayerMember')}</option>
        </Select>
      </div>

      {/* THE RATE ONLY MATTERS WHEN SOMEBODY IS BEING CHARGED IT. Under 'family' the gross-up
          is never computed, so a rate box would be a control that changes nothing — the same
          objection AGENTS.md makes to a permission switch nothing consults. It stays mounted
          rather than unmounting so a treasurer comparing the two options does not lose what
          they typed. */}
      {feePayer === 'member' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fee-percent">{t('proc.feePercent')}</Label>
            <Input
              id="fee-percent" type="number" min="0" max="50" step="0.01"
              value={percent} disabled={!status.canManage || pending}
              onChange={e => { setPercent(e.target.value); setSaved(false) }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fee-fixed">{t('proc.feeFixed')}</Label>
            <Input
              id="fee-fixed" type="number" min="0" max="10" step="0.01"
              value={fixed} disabled={!status.canManage || pending}
              onChange={e => { setFixed(e.target.value); setSaved(false) }}
            />
          </div>
        </div>
      )}

      {/* WHAT IT MEANS, IN ONE SENTENCE, FOR EACH CHOICE. Not a restatement of the option
          label: each says what happens to a member's balance, because that is the half a
          treasurer cannot infer and the half a relative will ask about. */}
      <p className="text-xs text-muted-foreground">
        {feePayer === 'family'
          ? t('proc.feeExplainFamily')
          : example != null
            ? t('proc.feeExplainMember', {
                owed: money(EXAMPLE_OWED_CENTS),
                charged: money(example),
              })
            : t('proc.feeRateUnusable')}
      </p>

      {status.feesPaidCents > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('proc.feesPaidSoFar', { amount: money(status.feesPaidCents) })}
        </p>
      )}

      <FormError message={error} />

      {status.canManage && (
        <div className="flex items-center gap-3">
          <Button size="sm" variant="affirm" onClick={save} disabled={!dirty || pending}>
            {t('action.save')}
          </Button>
          {/* Quiet, and only after a save that landed. `--brand-affirm` is the create/record/pay
              role and this is a record; it is not a `FormMessage`, which owns refusals. */}
          {saved && !dirty && (
            <span className="text-xs text-brand-affirm">{t('proc.feePolicySaved')}</span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The amount the worked example is quoted on.
 *
 * A ROUND $40, chosen so the arithmetic is legible rather than because it resembles anybody's
 * dues. The point of the sentence is the RELATIONSHIP between the two figures — that the
 * surcharge is a little more than the fee on the original amount — and a lumpy number would
 * bury that in decimals.
 */
const EXAMPLE_OWED_CENTS = 4000
