'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isEmailNotConfirmed } from '@/lib/auth/auth-errors'
import { markIdleActivity } from '@/lib/idle-timeout'
import { safeNext } from '@/lib/safe-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, FormError } from '@/components/ui/form-message'
import { APP_NAME } from '@/lib/brand'
import { useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

// A FACTORY, not a constant: the messages are copy and a schema built at module load
// cannot reach the reader's catalogue. `FormData` is inferred from the RETURN type, so
// the shape is still checked exactly as before.
const schema = (t: T) => z.object({
  email: z.string().email(t('auth.badEmail')),
  password: z.string().min(1, t('auth.needPassword')),
})

type FormData = z.infer<ReturnType<typeof schema>>

/**
 * THE QUERY STRING ARRIVES AS PROPS, read on the server by the page.
 *
 * It used to be read here with `useSearchParams()`, and that had a cost nobody could see
 * in the browser: the hook opts a client component out of the static prerender, so the
 * page had to wrap this in `<Suspense fallback={null}>` — and `null` is what the SERVER
 * therefore sent. The initial HTML of /login was an empty shell. Everything below,
 * including the heading, reached the page only after React hydrated.
 *
 * That is invisible to a user on a normal connection and total to anything that reads
 * HTML without running scripts. An SEO audit on 2026-08-12 scored the page for having no
 * `h1` and "~2 words of visible text" — both were there in the component and neither was
 * in the response. Reading the parameters on the server and passing them down puts the
 * whole page in the first byte.
 *
 * The trade, stated because it is real: /login is now server-rendered per request rather
 * than static, since reading `searchParams` is a dynamic operation. For a sign-in form
 * that is the right side of the trade — the page is cheap, and an empty shell ranks and
 * reads as nothing.
 */
export function LoginForm({
  /**
   * /auth/confirm redirects here with ?error=… when a confirmation link is invalid,
   * expired or already used. Without it the user lands on a bare sign-in form with no
   * hint that the link they just clicked did anything at all.
   */
  linkError = '',
  /**
   * Raw `?next=`. Still validated here rather than at the call site: it arrives in a URL
   * and is therefore attacker-controlled, and keeping `safeNext` next to its use is what
   * stops a future caller passing it through unchecked — lib/safe-next.ts, shared with
   * /auth/confirm.
   */
  nextParam,
}: {
  linkError?: string
  nextParam?: string
}) {
  const t = useT()
  const router = useRouter()
  // Where to go after signing in. /invite/<token> sends people here with one, so an
  // invitee who already has an account lands back on the invitation and has it redeemed,
  // instead of arriving at the dashboard and being told to go find the email again.
  const next = safeNext(nextParam)
  // Someone who came from an invitation, then found they have no account, must not be
  // handed the ordinary register form — it asks for a family code they were never told,
  // which is the dead end this whole flow exists to close. Carry the token across.
  // `next` is already decoded by searchParams.get(), so the token is taken as-is —
  // decoding it a second time would both mangle a legitimate value and throw on a
  // malformed escape (`?next=/invite/%zz`), which is a crash an attacker picks.
  const inviteToken = next.startsWith('/invite/')
    ? next.slice('/invite/'.length).split(/[?#/]/)[0]
    : ''
  const registerHref = inviteToken
    ? `/register?invite=${encodeURIComponent(inviteToken)}`
    : '/register'
  const [serverError, setServerError] = useState('')

  // ── An unconfirmed account was a dead end, and this is the way out ──────────────────
  // `enable_confirmations = true` (supabase/config.toml), so somebody who registered and
  // never opened the emailed link CANNOT SIGN IN AT ALL — GoTrue refuses the correct
  // password with `email_not_confirmed`, forever, and until 2026-08-17 nothing in the
  // product offered to send that link again. The only fix was a support conversation.
  //
  // THE ADDRESS IS SNAPSHOTTED HERE, at the moment the refusal arrives, rather than read
  // back out of the field when the button is pressed. Somebody who fails a sign-in, then
  // edits the email box, then presses resend would otherwise silently mail a DIFFERENT
  // address — on a shared browser, somebody else's. What the panel offers to mail is the
  // address that was actually refused, and the panel says which one that is.
  //
  // Empty means "no offer": set only for `email_not_confirmed`, cleared at the top of every
  // attempt, so the panel cannot outlive the failure that justified it.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('')
  // The address a resend was asked for, and the flag that retires the button. Sticky for
  // the life of the page ON PURPOSE and deliberately NOT cleared by a later attempt: there
  // is no cooldown timer here (no such thing exists anywhere in this codebase, and a
  // countdown would be inventing a mechanism to dress up a limit we are not told the shape
  // of), so one press per page load is the whole rate control the UI contributes. GoTrue's
  // own frequency limiter is the real one — `max_frequency` is 60s in production.
  const [resendAskedFor, setResendAskedFor] = useState('')
  const [resending, setResending] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema(t)),
  })

  async function onSubmit(data: FormData) {
    setServerError('')
    setUnconfirmedEmail('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) {
      setServerError(error.message)
      // Measured against the local stack: the password is checked FIRST, so a wrong
      // password on an unconfirmed account comes back `invalid_credentials` and only a
      // correct one reaches `email_not_confirmed`. The offer therefore appears for people
      // who have proved they own the account — which is why it may name their address back
      // to them. The predicate and the measurements are in lib/auth/auth-errors.ts.
      if (isEmailNotConfirmed(error)) setUnconfirmedEmail(data.email)
    } else {
      // SIGNING IN IS ACTIVITY, and the idle timer has to be told before the page it
      // guards mounts. `IdleTimeout` reads the shared marker once, at mount, and whoever
      // used this browser last left one behind — an expired one is refused, but a marker
      // 74 minutes old is not, and it would put this member a minute from the warning
      // dialog before they had done anything.
      markIdleActivity()
      router.push(next)
      router.refresh()
    }
  }

  /**
   * Ask GoTrue to send the sign-up confirmation again.
   *
   * ── THE BROWSER CALLS GoTrue DIRECTLY. THERE IS NO SERVER ACTION HERE ─────────────
   * Three reasons, and each one is on its own sufficient:
   *
   *   * `POST /auth/v1/resend` is ALREADY a public endpoint, reachable with the anon key
   *     that ships in this bundle. A `'use server'` wrapper would not close anything — it
   *     would publish a SECOND public endpoint whose only job is to reach the first.
   *   * That wrapper would take an email address as a parameter, which makes it an
   *     address-parameterised mail trigger on our own origin: see the refusal at the top
   *     of `resendConfirmationEmail` in app/actions/membership.ts, which takes no arguments
   *     precisely so the only person anyone can mail is themselves. The signed-in screen
   *     can honour that rule because it has a session to read the address from; this one
   *     has no session by definition, so the rule cannot be met and the endpoint must not
   *     be created.
   *   * Rate limiting. A proxy inserts a hop with NO limiter of its own in front of the
   *     only one there is, and every request then reaches GoTrue from our server's address
   *     rather than the caller's — so whatever per-IP metering GoTrue applies would meter
   *     the entire product as a single client. Mail endpoints are exactly the ones where
   *     that matters.
   *
   * `ForgotPasswordForm` is the standing precedent — `resetPasswordForEmail`, from the
   * browser, unauthenticated, no action — and this is the same shape for the same reasons.
   *
   * NO `options.emailRedirectTo`, deliberately: supabase/templates/confirmation.html builds
   * its link from `{{ .SiteURL }}` with `next=/dashboard` hard-coded and never renders
   * `.RedirectTo`, so passing one would be configuration that nothing reads.
   *
   * ── AND IT CANNOT REPORT WHAT HAPPENED, SO IT DOES NOT TRY ────────────────────────
   * GoTrue answers 200 for an unconfirmed address, an already-confirmed one and an address
   * with no account at all alike — measured, and recorded in lib/auth/account-state.ts's
   * header. The one thing that DOES vary is the frequency limiter: measured 2026-08-17,
   * a second press against an address with a pending confirmation is refused
   * `over_email_send_rate_limit`, while the same double press against a CONFIRMED address
   * is accepted twice. So the refusal is itself the account-enumeration answer the 200 was
   * shaped to withhold, and surfacing it — or wording success differently from it — would
   * hand that back, on a signed-out page that is indexed and reachable by anybody.
   *
   * Hence: the result is discarded, and one settled sentence is shown whatever comes back.
   * `PendingApprovalScreen` is entitled to say "Sent" where this is not, because it read
   * `email_confirmed_at` off a real session before offering the button. Nothing here knows
   * that much, and the copy must never sound as though it does.
   */
  async function resendConfirmation() {
    // `resendAskedFor` is what retires the button for the life of the page, and it is set
    // BEFORE the await so the retirement does not wait on the network. Checking it here as
    // well as through `disabled` covers a held key: two presses are two separate tasks with
    // a React flush between them, so the second one reads the state the first one set.
    if (!unconfirmedEmail || resendAskedFor) return
    setResendAskedFor(unconfirmedEmail)
    setResending(true)
    try {
      await createClient().auth.resend({ type: 'signup', email: unconfirmedEmail })
    } catch {
      // A transport failure is reported exactly as a success is, for the reason above:
      // any difference between the two outcomes describes the address to whoever is
      // typing. supabase-js returns its own errors rather than throwing them, so this
      // catch is here for the network layer beneath it.
    } finally {
      setResending(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        {/* THE PAGE'S h1. This card is the whole page, so its title is the only thing
            that could be — and until 2026-08-12 there was no h1 here at all, which
            leaves a screen-reader user nothing to jump to. See CardTitle's `as`. */}
        <CardTitle as="h1" className="text-2xl">{t('auth.welcomeBack')}</CardTitle>
        <CardDescription>{t('auth.signInToYour', { app: APP_NAME })}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('field.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('field.ph.email')}
              autoComplete="email"
              {...register('email')}
            />
            <FieldError message={errors.email?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              {...register('password')}
            />
            <FieldError message={errors.password?.message} />
            <Link href="/forgot-password" className="text-sm text-primary hover:underline block text-end">
              {t('auth.forgot')}
            </Link>
          </div>

          {/* A failed confirmation link, until they try to sign in and get a live
              answer — at which point the sign-in error is the more useful one. */}
          {linkError && !serverError && (
            <div className="rounded-md bg-brand-soft px-3 py-2 text-sm text-brand-on-soft">
              {linkError}
            </div>
          )}

          <FormError message={serverError} />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
          </Button>
        </form>

        {/* ── The way out of an unconfirmed account ──────────────────────────────────
            CONDITIONAL, AND OUTSIDE THE FORM. Both halves are decisions.

            It renders only for `email_not_confirmed`, because a mail-sending control with
            a free-text address beside it, sitting permanently on an indexed signed-out
            page, is a different and much worse thing than an offer made to somebody the
            service has just refused for exactly this reason. Nobody who has not hit the
            dead end is shown a way out of it.

            It sits BELOW the Sign In button rather than above it: the refusal belongs
            next to the control that caused it (`FormError`, above), and the way out
            belongs under both. Putting a panel between the password field and the button
            would push the button off a phone screen at the moment somebody is trying to
            press it — the same argument that moved the orientation prose out of this card.

            IT IS NOT AN ERROR AND MUST NOT LOOK LIKE ONE. Quiet panel, `Mail` icon, the
            same markup as the resend panel in `PendingApprovalScreen` — not
            `--destructive`, not `--brand-withheld`, and no second `role="alert"` competing
            with the FormError a screen reader has just been read. */}
        {unconfirmedEmail && (
          <div className="mt-4 rounded-xl border bg-muted/40 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Mail className="h-4 w-4" /> {t('auth.confirmEmail')}
            </p>
            {resendAskedFor && !resending ? (
              /* The settled sentence, which replaces the button for the life of the page.
                 It names the address it asked about — the one that was refused, not
                 whatever is in the box now — and promises nothing, because GoTrue tells us
                 nothing. See `resendConfirmation`. */
              <p className="mt-1 text-sm text-muted-foreground">
                We have asked for a new confirmation link to be sent to{' '}
                <span className="font-medium">{resendAskedFor}</span>. If that address has
                an account waiting to be confirmed, it is on its way — we are not told
                either way, so nothing here can promise it arrived. Use the newest message:
                the link works once and expires after an hour.
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted-foreground">{t('ui.accountConfirmedBeforeCan')}</p>
                <button
                  type="button"
                  onClick={resendConfirmation}
                  disabled={resending}
                  className="mt-3 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
                >
                  {resending ? t('security.sending') : t('auth.sendLinkAgain')}
                </button>
              </>
            )}
            {/* The two states a resend cannot fix, named rather than left to be discovered
                by waiting: an address that never finished registering has nothing to
                confirm, and an invitation token binds an account to a family, so a stale
                invitation is re-sent by the family rather than by us. `registerHref` and
                not '/register' — it carries an invitation token across when there is one,
                which is the whole reason that variable exists. */}
            <p className="mt-2 text-sm text-muted-foreground">
              {t('login.stillNothing')}{' '}
              <Link href={registerHref} className="font-medium text-primary hover:underline">
                {t('auth.createAccount')}
              </Link>{' '}
              if you never finished registering, or ask whoever invited you to send a fresh
              invitation.
            </p>
          </div>
        )}
      </CardContent>
      {/* ── The orientation prose MOVED OUT on 2026-08-12 ───────────────────────
          It is now `AuthAside` in app/(auth)/login/page.tsx, along with the four
          reasons a sign-in fails. Two things were wrong with it here. It is static
          text inside a `'use client'` component, so it shipped in the JavaScript
          bundle as well as the HTML for no reason; and it was growing, which inside
          the card means pushing the Sign In button down a phone screen to court a
          crawler — a real user's task traded for an imagined one.

          The card keeps ONLY what belongs to the task: the fields, and the way out
          for somebody who has no account. `registerHref` is the reason that link
          stays here rather than joining the rest — it carries the invitation token
          across, which the page-level copy knows nothing about. */}
      <CardFooter className="text-sm">
        <p>
          <span className="text-muted-foreground">{t('auth.noAccount')}</span>
          <Link href={registerHref} className="text-primary font-medium hover:underline">
            {t('auth.createOne')}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
