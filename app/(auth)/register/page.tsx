import { RegisterForm } from '@/components/auth/RegisterForm'
import { peekInvitation } from '@/app/actions/invitations'

export const metadata = { title: 'Create Account — Family Connect' }

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
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>
}) {
  const { invite } = await searchParams
  const invitation = invite ? await peekInvitation(invite) : null

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
