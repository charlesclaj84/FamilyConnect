import type { Metadata } from 'next'
import Link from 'next/link'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { peekInvitation } from '@/app/actions/invitations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_NAME } from '@/lib/brand'

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

  if (invite) {
    return {
      title: 'Accept Your Invitation',
      robots: { index: false, follow: false, nocache: true },
    }
  }

  return {
    title: 'Create Account',
    description: `Create your free ${APP_NAME} account and bring your family together — reunions, dues, photos and your family tree in one private place.`,
    alternates: { canonical: '/register' },
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
  searchParams: Promise<{ invite?: string }>
}) {
  const { invite } = await searchParams
  const invitation = invite ? await peekInvitation(invite) : null

  if (invitation?.valid && invitation.hasAccount) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">You already have an account</CardTitle>
          <CardDescription>
            <span className="font-medium">{invitation.email}</span> is already registered
            with {APP_NAME}, so there is nothing to create. Sign in and you will come
            straight back to your invitation to{' '}
            <span className="font-medium">{invitation.familyName}</span> and join it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={`/login?next=${encodeURIComponent(`/invite/${invite}`)}`}
            className="inline-flex rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90"
          >
            Sign in to accept
          </Link>
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
      />
    )
  }

  return <RegisterForm />
}
