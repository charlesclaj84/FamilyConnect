'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { markIdleActivity } from '@/lib/idle-timeout'
import { trackPixelEvent } from '@/lib/meta/pixel'
import { registerUser } from '@/app/actions/register'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, FormError } from '@/components/ui/form-message'
import { APP_NAME } from '@/lib/brand'
import { TIER_IS_SOLD, TIER_PRICE, formatPlanPrice } from '@/lib/plans'
import { TIERS, TIER_LABEL, TIER_TAGLINE, type FamilyTier } from '@/lib/tiers'
import { cn } from '@/lib/utils'
import { useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

type Mode = 'join' | 'create'

/**
 * The plans this form may offer: Free, plus every tier that is actually on sale.
 *
 * DERIVED FROM `TIER_IS_SOLD` rather than listed, so a tier going on or off sale changes
 * one boolean in `lib/plans.ts` and this form follows. A hand-written list here is how
 * Premium comes to be offered on the signup screen months before anything can deliver it.
 *
 * THE PRICE IS CHECKED TOO, because a sold tier with no figure is a card with a blank
 * where the amount goes — `lib/plans.test.ts` asserts that combination cannot exist, and
 * this is the render-time half of the same rule.
 */
const PLAN_CHOICES: readonly FamilyTier[] = TIERS.filter(
  t => t === 'free' || (TIER_IS_SOLD[t] && TIER_PRICE[t] != null),
)

// A FACTORY, not a constant: the messages are copy and a schema built at module load
// cannot reach the reader's catalogue. `FormData` is inferred from the RETURN type.
const schema = (t: T) => z
  .object({
    firstName: z.string().min(1, t('reg.needFirstName')),
    lastName: z.string().min(1, t('reg.needLastName')),
    email: z.string().email(t('auth.badEmail')),
    password: z.string().min(8, t('auth.tooShort')),
    confirmPassword: z.string(),
    familyCode: z.string().optional(),
    familyName: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: t('auth.noMatch'),
    path: ['confirmPassword'],
  })

type FormData = z.infer<ReturnType<typeof schema>>

/**
 * `invite` turns this into a third mode that is not on the toggle.
 *
 * An invited registrant has no family code — they were never told one, which is the
 * whole point of an invitation — so the code field would be an unanswerable required
 * question. Instead the family comes from the token, the email is fixed to the address
 * the invitation was sent to, and the mode toggle is hidden because neither of its
 * options applies.
 *
 * The lock on the email field is a courtesy, not a control: `registerUser` re-checks
 * the address against the invitation server-side and refuses a mismatch, because a
 * readOnly attribute is a suggestion to a browser and nothing to an HTTP client.
 */
export function RegisterForm({
  inviteToken,
  invitedEmail,
  invitedFamilyName,
  invitedFirstName,
  invitedLastName,
  plan,
}: {
  inviteToken?: string
  invitedEmail?: string
  invitedFamilyName?: string
  /**
   * The plan `/pricing` sent them here for, already narrowed by `sellablePlanParam` on
   * the server — so it is a tier that exists AND is on sale, or null.
   *
   * PRESELECTS, NEVER COMMITS. It also flips the mode toggle to Create, because somebody
   * who pressed "Start with Plus" is not here to join a family that already has a plan.
   */
  plan?: FamilyTier | null
  /**
   * The name on the invitation (20260813000002), used ONLY to prefill.
   *
   * Unlike the email, these fields stay editable — the address is what the invitation is
   * bound to and a mismatch is refused server-side, whereas the name is the inviter's
   * guess at what their cousin calls themselves. The person registering is the better
   * authority, and `redeem_family_invitation` agrees: it prefers the account's own
   * metadata and falls back to the invitation only when there is none.
   */
  invitedFirstName?: string
  invitedLastName?: string
} = {}) {
  const t = useT()
  const router = useRouter()
  // A plan can only be bought by the family that is being created, so arriving with one
  // opens on Create. Without this the pricing page's button lands on a family-code field,
  // which asks somebody buying a plan for a code they were never given.
  const [mode, setMode] = useState<Mode>(plan ? 'create' : 'join')
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState(false)
  const [newFamilyCode, setNewFamilyCode] = useState('')
  const [autoSignedIn, setAutoSignedIn] = useState(false)
  /**
   * Which plan the new family is being started on. `null` is Free.
   *
   * LOCAL STATE SEEDED FROM A PROP, which is the shape "Switching family remounts the
   * page" is about — and it is safe here for the reason that section gives about
   * `[id]` routes: this component is not inside `<main key={familyCode}>`, there is no
   * family to switch, and the whole form unmounts on success.
   */
  const [chosenPlan, setChosenPlan] = useState<FamilyTier | null>(plan ?? null)
  /** The plan actually recorded against the family, as the SERVER reported it. */
  const [recordedPlan, setRecordedPlan] = useState<FamilyTier | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema(t)),
    defaultValues: {
      ...(invitedEmail ? { email: invitedEmail } : {}),
      ...(invitedFirstName ? { firstName: invitedFirstName } : {}),
      ...(invitedLastName ? { lastName: invitedLastName } : {}),
    },
  })

  function switchMode(next: Mode) {
    if (next === mode) return
    setMode(next)
    setServerError('')
  }

  async function onSubmit(data: FormData) {
    setServerError('')

    // Neither family question applies to an invitation — the token answers both.
    if (!inviteToken && mode === 'join' && !data.familyCode?.trim()) {
      setError('familyCode', { message: t('reg.needCode') })
      return
    }
    if (!inviteToken && mode === 'create' && !data.familyName?.trim()) {
      setError('familyName', { message: t('reg.needFamilyName') })
      return
    }

    const result = await registerUser({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password,
      mode,
      familyCode: data.familyCode,
      familyName: data.familyName,
      inviteToken,
      // Sent only in create mode. `registerUser` drops it for a join or an invitation
      // anyway — this is the convenience half of that, not the control.
      plan: !inviteToken && mode === 'create' && chosenPlan ? chosenPlan : undefined,
    })

    if (!result.success) {
      if (result.field === 'familyCode' || result.field === 'familyName' || result.field === 'email') {
        setError(result.field as keyof FormData, { message: result.message })
      } else {
        setServerError(result.message)
      }
      return
    }

    // ── Advertising measurement, browser half ────────────────────────────────
    // The server has already reported both of these to Meta's Conversions API and has
    // handed back the event ids it used. Firing them here with the SAME ids is what makes
    // the pair deduplicate into one conversion rather than count as two.
    //
    // FIRED BEFORE THE REDIRECT BELOW, deliberately: `router.push('/dashboard')` unmounts
    // this component, and an event queued after it can be lost with the page.
    //
    // Each id is null unless the server actually sent that event — tracking off, consent
    // refused, or an id already spent — so the browser cannot report a conversion the
    // server declined to. There is no `&&` on a separate consent check here for the same
    // reason: one decision, made once, on the server.
    if (result.meta?.completeRegistration) {
      trackPixelEvent('CompleteRegistration', {
        eventId: result.meta.completeRegistration,
        customData: {
          content_name: 'GENORRA Account',
          content_category: `Registration: ${inviteToken ? 'invite' : mode}`,
        },
      })
    }
    if (result.meta?.createFamily) {
      trackPixelEvent('CreateFamily', {
        eventId: result.meta.createFamily,
        customData: { content_name: 'Family Workspace', content_category: 'Activation' },
      })
    }

    // Attempt auto sign-in so the user lands in an authenticated state.
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (!signInError) {
      // Same reason as LoginForm: the idle timer reads the shared marker once, at mount,
      // and a marker left by whoever used this browser last is not this member's.
      markIdleActivity()
      setAutoSignedIn(true)
      // For join mode go straight to dashboard; create mode shows the family code first.
      // An invitation is a join: the membership already exists, pre-approved or queued.
      if (inviteToken || mode === 'join') {
        router.push('/dashboard')
        router.refresh()
        return
      }
    }

    if (result.familyCode) setNewFamilyCode(result.familyCode)
    // THE SERVER'S ANSWER, not what was asked for. A plan it declined to record — one we
    // do not sell, or a write that failed — must not leave the screen below promising a
    // checkout that will never be offered.
    setRecordedPlan(result.plan ?? null)
    setSuccess(true)
  }

  if (success && newFamilyCode) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle as="h1" className="text-2xl text-primary">{t('reg.familyCreated')}</CardTitle>
          <CardDescription>
            {t('reg.shareCode')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <div className="w-full rounded-lg border-2 border-primary/30 bg-primary/5 px-8 py-5 text-center">
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{t('reg.yourCode')}</p>
            <p className="text-4xl font-bold tracking-widest text-primary">{newFamilyCode}</p>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {t('reg.writeDown')}
          </p>
          {!autoSignedIn && (
            <p className="text-center text-sm text-muted-foreground">
              {t('reg.alsoSent')}
            </p>
          )}
          {/* ── THE PLAN IS WAITING, AND THIS SAYS SO IN THOSE WORDS ──────────────
              Somebody who chose Plus on the pricing page has pressed a button
              captioned "Start with Plus" and then been handed a family code — so
              without this line the reasonable conclusion is that the plan was
              forgotten, or worse, that they have already been charged for it.

              IT READS OFF `recordedPlan`, the server's answer, so a plan that was
              not recorded says nothing at all rather than promising a checkout
              nobody will offer. And it never claims a payment has been taken: the
              family is on Free until Stripe says otherwise. */}
          {recordedPlan && (
            <p className="text-center text-sm text-brand-on-soft">
              {t('reg.startsOn')} <span className="font-medium">Free</span>. Nothing has
              been charged — sign in and {APP_NAME} will ask you to set up{' '}
              <span className="font-medium">{TIER_LABEL[recordedPlan]}</span>.
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          {autoSignedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
            >
              {t('reg.goToDashboard')}
            </Link>
          ) : (
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              {t('auth.backToSignIn')}
            </Link>
          )}
        </CardFooter>
      </Card>
    )
  }

  if (success) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle as="h1" className="text-2xl text-primary">{t('reg.checkEmail')}</CardTitle>
          <CardDescription>
            {t('reg.confirmSent')}
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            {t('auth.backToSignIn')}
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle as="h1" className="text-2xl">{t('reg.createYours')}</CardTitle>
        <CardDescription>
          {inviteToken
            ? <>You have been invited to join{' '}
                <span className="font-medium">{invitedFamilyName}</span>.</>
            : mode === 'join'
              ? `Join your family on ${APP_NAME}`
              : `Start a new family on ${APP_NAME}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Hidden for an invitation: neither option applies. The token already names the
            family, and "Create a Family" would throw away the invitation silently. */}
        <div className={`mb-5 rounded-lg border p-1 ${inviteToken ? 'hidden' : 'flex'}`}>
          <button
            type="button"
            onClick={() => switchMode('join')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === 'join'
                ? 'bg-brand-primary text-brand-on-primary shadow-sm'
                : 'text-brand-ink hover:bg-brand-primary/10'
            }`}
          >
            {t('reg.joinFamily')}
          </button>
          <button
            type="button"
            onClick={() => switchMode('create')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === 'create'
                ? 'bg-brand-primary text-brand-on-primary shadow-sm'
                : 'text-brand-ink hover:bg-brand-primary/10'
            }`}
          >
            {t('reg.startFamily')}
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">{t('field.firstNameLower')}</Label>
              <Input id="firstName" placeholder={t('reg.firstNamePh')} autoComplete="given-name" {...register('firstName')} />
              <FieldError message={errors.firstName?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">{t('field.lastNameLower')}</Label>
              <Input id="lastName" placeholder={t('reg.lastNamePh')} autoComplete="family-name" {...register('lastName')} />
              <FieldError message={errors.lastName?.message} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">{t('field.email')}</Label>
            {/* readOnly for an invitation, because only this address can redeem it —
                registering under another one would create an account the redemption
                then refuses. A courtesy for the browser only: registerUser compares the
                address to the invitation server-side and refuses a mismatch there. */}
            <Input
              id="email"
              type="email"
              placeholder={t('field.ph.email')}
              autoComplete="email"
              readOnly={Boolean(inviteToken)}
              className={inviteToken ? 'bg-muted' : undefined}
              {...register('email')}
            />
            {inviteToken && (
              <p className="text-xs text-muted-foreground">
                {t('reg.invitedAddress')}
              </p>
            )}
            <FieldError message={errors.email?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input id="password" type="password" placeholder={t('security.ph.minChars')} autoComplete="new-password" {...register('password')} />
            <FieldError message={errors.password?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{t('reg.confirmPassword')}</Label>
            <Input id="confirmPassword" type="password" placeholder="••••••••" autoComplete="new-password" {...register('confirmPassword')} />
            <FieldError message={errors.confirmPassword?.message} />
          </div>

          {!inviteToken && mode === 'join' && (
            <div className="space-y-1.5">
              <Label htmlFor="familyCode">{t('fam.codeHeading')}</Label>
              <Input
                id="familyCode"
                placeholder={t('reg.codePh')}
                autoComplete="off"
                className="uppercase"
                {...register('familyCode')}
              />
              <p className="text-xs text-muted-foreground">{t('reg.codeShared')}</p>
              <FieldError message={errors.familyCode?.message} />
            </div>
          )}

          {!inviteToken && mode === 'create' && (
            <div className="space-y-1.5">
              <Label htmlFor="familyName">{t('set.familyName')}</Label>
              <Input
                id="familyName"
                placeholder={t('reg.familyNamePh')}
                autoComplete="off"
                {...register('familyName')}
              />
              <p className="text-xs text-muted-foreground">{t('reg.codeGenerated')}</p>
              <FieldError message={errors.familyName?.message} />
            </div>
          )}

          {/* ── WHICH PLAN TO START ON ────────────────────────────────────────────
              CREATE MODE ONLY. A plan belongs to the family, so the question is only
              answerable by the person making one — a member joining an existing
              family cannot commit it to a bill, and `registerUser` drops the
              parameter for them regardless.

              NOTHING IS CHARGED ON THIS SCREEN and the caption says so. There is no
              family yet to be the Stripe customer and no session yet to authorize a
              checkout, so what this collects is a CHOICE that is recorded and offered
              back once both exist. Promising otherwise here would be the "the button
              press is not the payment" rule broken at the very first press.

              REAL RADIOS IN A FIELDSET, not divs with click handlers. A screen reader
              gets the group name, the count and the current selection for free, and
              arrow keys work — none of which a `role`-less clickable card provides.
              Same argument MainRail makes for refusing `role="tablist"`. */}
          {!inviteToken && mode === 'create' && (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">{t('set.pane.plan')}</legend>
              <div className="space-y-2">
                {PLAN_CHOICES.map(tier => {
                  const price = TIER_PRICE[tier]
                  const selected = (chosenPlan ?? 'free') === tier
                  return (
                    <label
                      key={tier}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                        selected
                          ? 'border-brand-primary bg-brand-soft'
                          : 'border-border hover:bg-muted',
                      )}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={tier}
                        checked={selected}
                        onChange={() => setChosenPlan(tier === 'free' ? null : tier)}
                        className="mt-1 accent-[var(--brand-primary)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <span className={cn('text-sm font-medium', selected && 'text-brand-on-soft')}>
                            {TIER_LABEL[tier]}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {price ? `${formatPlanPrice(price.monthlyCents)}/month` : t('reg.freeForever')}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {TIER_TAGLINE[tier]}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {chosenPlan
                  ? `Nothing is charged now. Once your family exists you will be asked to set up payment for ${TIER_LABEL[chosenPlan]}, and you can stay on Free instead.`
                  : t('reg.canMove')}
              </p>
            </fieldset>
          )}

          <FormError message={serverError} />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting
              ? mode === 'join' ? t('reg.joining') : t('reg.creatingFamily')
              : mode === 'join' ? t('reg.joinAction') : t('reg.createAction')}
          </Button>
        </form>
      </CardContent>
      {/* ── The "what the account is for" block MOVED OUT on 2026-08-12 ─────────
          It is now `AuthAside` in app/(auth)/register/page.tsx, with the three steps
          that follow registration added to it. Two things were wrong with it here.
          It is static text inside a `'use client'` component, so it shipped in the
          JavaScript bundle as well as the HTML; and it was conditional on
          `!inviteToken`, which the page can now answer structurally — the aside is
          rendered only by the branch that has no invitation, so there is no flag to
          get wrong.

          The card keeps only what belongs to the task. `inviteToken` is the reason
          the sign-in link stays here: it carries the token into `?next=`, so an
          invited person who turns out to have an account already comes back to the
          invitation instead of being stranded on the dashboard. */}
      <CardFooter className="text-sm">
        <p>
          <span className="text-muted-foreground">{t('reg.haveAccount')}</span>
          {/* An invited visitor who turns out to have an account already must come back to
              the invitation after signing in, or the token is simply lost and they are in
              no family. Plain /login would strand them on the dashboard. */}
          <Link
            href={
              inviteToken
                ? `/login?next=${encodeURIComponent(`/invite/${inviteToken}`)}`
                : '/login'
            }
            className="font-medium text-primary hover:underline"
          >
            {t('auth.signIn')}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
