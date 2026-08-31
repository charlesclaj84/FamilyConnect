import type { Metadata } from 'next'
import Link from 'next/link'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { AuthAside, AsideTerm } from '@/components/auth/AuthAside'
import { peekInvitation } from '@/app/actions/invitations'
import { StructuredData } from '@/components/marketing/StructuredData'
import { authPageGraph } from '@/lib/structured-data'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_NAME } from '@/lib/brand'
import { callerI18n } from '@/lib/i18n/server'
import { localizedAlternates } from '@/lib/i18n/route-locale'
import { sellablePlanParam } from '@/lib/signup-plan'

/**
 * `generateMetadata` rather than a static `metadata` export, because this route's
 * indexability depends on its query string.
 *
 * `/register` is the conversion page and is in the sitemap deliberately. But it
 * ALSO answers as `/register?invite=<token>` — the address in every invitation
 * email — and that URL carries a credential. robots.txt disallows `/invite/` and
 * says nothing about this one, because until now there was nothing to say: a
 * static metadata export cannot see the parameter that makes the difference.
 *
 * So the two cases are separated here. Invited: `noindex`, and no canonical, since
 * pointing at the bare page would invite a crawler to walk to it. Ordinary: a
 * self-referencing canonical, which also folds any other stray parameter — a
 * campaign tag, a referrer — back onto the one URL worth ranking.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>
}): Promise<Metadata> {
  const { invite } = await searchParams
  const { t, locale } = await callerI18n(null)

  if (invite) {
    return {
      title: t('auth.meta.inviteTitle'),
      robots: { index: false, follow: false, nocache: true },
    }
  }

  return {
    // LENGTHENED 2026-08-12. 'Create Account' rendered as 24 characters once the
    // template appended the product name — too short to fill a search result and
    // missing the words somebody looking for this actually types. This renders at 41
    // against the ~60 Google displays. The word "Free" is not marketing licence: the
    // landing page's closing button says "Create your free account", and a title must
    // not promise what the page does not (same rule as lib/structured-data.ts).
    title: t('auth.meta.registerTitle'),
    description: t('auth.meta.registerDescription', { app: APP_NAME }),
    alternates: localizedAlternates('/register', locale),
  }
}

/**
 * `?invite=<token>` puts the form into invitation mode.
 *
 * Resolved on the SERVER rather than in the form: the token has to be exchanged for the
 * family name and the invited address before anything renders, and doing that in a
 * client effect would flash the ordinary "join or create" form first — offering an
 * invited person a family-code field they cannot answer.
 *
 * An invalid or spent token falls through to the ordinary form rather than erroring.
 * The invitation is re-checked in `registerUser` regardless, so nothing is decided here;
 * this only chooses which questions to ask.
 *
 * THE ADDRESS ALREADY HAS AN ACCOUNT is the third case, and it gets no form at all.
 * There is nothing to register: signUp cannot be aimed at an existing address, so every
 * field below would be filled in to earn an error. registerUser refuses this
 * independently — it is a public endpoint and this page is not in its request path —
 * but a refusal is the wrong shape for something with an obvious next step, so the step
 * is what renders. See 20260810000000.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; plan?: string }>
}) {
  const { invite, plan } = await searchParams
  // See lib/auth/locale.ts: the address bar first, so /es/register is Spanish whatever
  // the reader's browser asks for.
  const { t } = await callerI18n(null)
  const invitation = invite ? await peekInvitation(invite) : null

  // ── `?plan=` — WHICH PLAN THE PRICING PAGE SENT THEM HERE FOR ─────────────────────
  //
  // NARROWED ON THE SERVER, and `sellablePlanParam` is the same function `registerUser`
  // narrows with — so the form cannot preselect a plan the action would then drop, and a
  // hand-typed `?plan=premium` preselects nothing rather than promising a checkout for a
  // tier that is priced and not sold.
  //
  // A HINT AND NOT A DECISION. It preselects a card; the member can change it, and every
  // paid plan is offered again on `/admin/settings` whatever happens here. It is also
  // ignored entirely for an invited registrant and in join mode — a plan belongs to a
  // family, and somebody joining one is not the person who buys it.
  const chosenPlan = sellablePlanParam(plan)

  if (invitation?.valid && invitation.hasAccount) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle as="h1" className="text-2xl">{t('auth.alreadyAccount')}</CardTitle>
          <CardDescription>
            {t('reg.alreadyRegistered', {
              email: invitation.email, app: APP_NAME,
            })}{' '}
            <span className="font-medium">{invitation.familyName}</span> and join it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={`/login?next=${encodeURIComponent(`/invite/${invite}`)}`}
            className="inline-flex rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90"
          >{t('auth.signAccept')}</Link>
        </CardContent>
      </Card>
    )
  }

  if (invitation?.valid) {
    return (
      <RegisterForm
        inviteToken={invite}
        invitedEmail={invitation.email}
        invitedFamilyName={invitation.familyName}
        invitedFirstName={invitation.firstName}
        invitedLastName={invitation.lastName}
      />
    )
  }

  // The ORDINARY page, and the only one of the three that is indexable — so the only one
  // that gets a graph, and the only one that gets the prose below it. The two invited
  // branches above are `noindex` and their URL carries a credential; describing them to a
  // search engine is the opposite of the intent, and someone arriving from an invitation
  // email already knows which family they are joining — the card names it — so explaining
  // the product to them would push the fields they came to fill down the page to answer a
  // question they did not ask.
  return (
    <>
      <StructuredData
        graph={authPageGraph({
          path: '/register',
          // The visible h1 in RegisterForm, not the <title>. See the note in login/page.tsx.
          name: t('auth.meta.registerGraphName'),
          description: t('auth.meta.registerDescription', { app: APP_NAME }),
        })}
      />
      {/* The auth layout's <main> is `flex items-center justify-center`, which is a ROW —
          two siblings there would sit side by side. `max-w-md` matches the card's own. */}
      <div className="w-full max-w-md space-y-6">
        <RegisterForm plan={chosenPlan} />

        {/* ── What the account is, and what happens after you make one ───────────
            THE SECOND HALF IS THE USEFUL HALF. This is the conversion page and the
            highest-priority URL in the sitemap after the landing page, and it was
            ~30 words of visible text, then ~116. But padding it would be the wrong
            fix: what it actually lacked was an answer to the question everybody asks
            after pressing the button, which support then answers one email at a time.

            Every step below is what the code really does, not a sketch of it:
              1. `enable_confirmations = true` (supabase/config.toml) — registration
                 sends a link and the account is inactive until it is opened.
              2. `registerUser` sets no membership_status; the stamp trigger from
                 20260806000011 makes a family's founder approved and every later
                 joiner pending, and a pending member lands on the holding screen in
                 app/(protected)/dashboard rather than being locked out.
              3. CODE_LENGTH is 6, from the unambiguous alphabet in the same file.

            The free claim is checkable on /pricing — "$0 forever", no card, no
            per-member fee — which is the rule lib/structured-data.ts is written to:
            claim nothing that is not said somewhere it can be verified. If the free
            tier ever changes, this paragraph changes in the same commit as that page. */}
        <AuthAside heading={t('auth.aside.joiningHeading', { app: APP_NAME })}>
          <p>{t('auth.aside.joiningLede', { app: APP_NAME })}</p>
          {/* ── THE FIRST BULLET SOLD A RETIRED PRODUCT AND A FEATURE THAT NEVER EXISTED ──
              Corrected 2026-08-23. It read "Plan reunions and events, and see who is
              coming", and both halves were wrong in different ways:

                * EVENTS IS GONE (20260819000006). Thirteen tables, four routes and six
                  action modules were deleted, and Gatherings replaced it. This is the
                  drift the Gatherings retirement swept out of `/pricing`, `/features`,
                  `/how-it-works`, `/why-us` and `lib/plans.ts` — and it survived here,
                  on the conversion page, because nothing walks this prose.
                * "SEE WHO IS COMING" IS AN RSVP, and RSVPs are explicitly NOT replaced —
                  no attendee count, no room block, no check-in list, anywhere in the
                  product. A step of a gathering can ASK a relative for any of it; nothing
                  counts the answers.

              What replaces it is the sentence the product uses about itself everywhere
              else — `TIER_TAGLINE.standard`, the help chapter and `lib/features.ts` all
              say "who is doing what" — so this now claims the thing Gatherings actually
              answers. */}
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('auth.aside.can1')}</li>
            <li>{t('auth.aside.can2')}</li>
            <li>{t('auth.aside.can3')}</li>
            <li>{t('auth.aside.can4')}</li>
          </ul>

          <p className="font-medium text-foreground">{t('auth.aside.nextHeading')}</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              <AsideTerm>{t('auth.aside.confirmTerm')}</AsideTerm>{' '}
              {t('auth.aside.confirmBody')}
            </li>
            <li>
              <AsideTerm>{t('auth.aside.joiningTerm')}</AsideTerm>{' '}
              {t('auth.aside.joiningBody')}
            </li>
            <li>
              <AsideTerm>{t('auth.aside.startingTerm')}</AsideTerm>{' '}
              {t('auth.aside.startingBody')}
            </li>
          </ol>

          <p>
            {t('auth.aside.freeForever')}{' '}
            <Link href="/pricing" className="font-medium text-primary hover:underline">
              {t('auth.aside.seeTiers')}
            </Link>
            {t('auth.aside.orSep')}{' '}
            <Link href="/" className="font-medium text-primary hover:underline">
              {t('auth.aside.readHow')}
            </Link>{' '}
            {t('auth.aside.first')}
          </p>
        </AuthAside>
      </div>
    </>
  )
}
