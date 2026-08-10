import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Clock, ShieldCheck, Ban } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { peekInvitation, redeemInvitation } from '@/app/actions/invitations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Invitation — Family Connect' }

/**
 * Where an invitation link lands.
 *
 * OUTSIDE (protected), on purpose: the whole point is that the visitor may have no
 * account yet. The token is the credential, and `peekInvitation` runs against the anon
 * client so the page can name the family before anyone signs in.
 *
 * Three cases:
 *   invalid            expired, already used, revoked, or never existed — one message
 *                      for all four, because distinguishing them tells someone holding a
 *                      guessed token which guesses are close.
 *   not signed in      name the family, name the address it was sent to, and point at
 *                      register or sign-in. Redemption needs an account: the invitation
 *                      is bound to an email, and matching it is what makes a forwarded
 *                      link useless to anyone else.
 *
 *                      WHICH OF THE TWO LEADS IS DECIDED BY `hasAccount`, and it has to
 *                      be. "Create an account" led unconditionally, so someone already
 *                      in one family who was invited to a second pressed the button that
 *                      sounds like accepting and hit a registration failure — signUp
 *                      cannot be aimed at an address that already exists, and it fails
 *                      in two different unusable ways depending on whether email
 *                      confirmation is on. See 20260810000000. When the address already
 *                      has an account, Sign in leads and registration is not offered at
 *                      all: there is nothing to register.
 *
 *                      BOTH LINKS CARRY THE TOKEN, and that is the whole flow rather
 *                      than a nicety. `/register` on its own is the ordinary form, which
 *                      requires a family code an invited person has never been told —
 *                      a dead end, and the one this page shipped with. `?invite=` puts
 *                      the form into invitation mode: the family comes from the token,
 *                      so they answer first name, last name and password and are done.
 *                      Sign-in gets `?next=` for the same reason: an existing account
 *                      should come back here and be redeemed, not be told to find the
 *                      email again.
 *   signed in          redeem immediately and go where the result says.
 *
 * Redeeming on GET is deliberate and safe here: it is idempotent in the direction that
 * matters (a spent token yields "no longer valid" rather than a second membership), and
 * requiring a click would strand people who followed a link from their email client.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invitation = await peekInvitation(token)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!invitation.valid) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ban className="h-4 w-4" /> This invitation is not valid
          </CardTitle>
          <CardDescription>
            It may have expired, been cancelled, or already been used. Ask whoever
            invited you to send a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Go to sign in
          </Link>
        </CardContent>
      </Shell>
    )
  }

  if (!user) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle className="text-lg">
            You have been invited to {invitation.familyName}
          </CardTitle>
          <CardDescription>
            {invitation.hasAccount
              ? <>This invitation was sent to{' '}
                  <span className="font-medium">{invitation.email}</span>, which already has
                  a Family Connect account. Sign in and you will come straight back here and
                  join — you will not need a family code, this invitation is your way in.</>
              : <>This invitation was sent to{' '}
                  <span className="font-medium">{invitation.email}</span>. Create an account
                  with that address to accept it — you will not need a family code, this
                  invitation is your way in. Already have an account? Sign in and you will
                  come straight back here.</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
            {invitation.preApproved
              ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              : <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
            <p className={invitation.preApproved ? '' : 'text-muted-foreground'}>
              {invitation.preApproved
                ? 'You will have full access as soon as you accept.'
                : 'An administrator will review your request once you accept.'}
            </p>
          </div>
          {/* Filled button = the one that will work. For an address that already has an
              account, registration is not offered as a secondary either: signUp cannot
              be aimed at it, so a quieter version of the same dead end is still a dead
              end. */}
          <div className="flex flex-wrap gap-2">
            {invitation.hasAccount ? (
              <Link
                href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                className="rounded-lg bg-[#0f2540] px-3 py-1.5 text-sm font-medium text-[#e6ecfa] transition-opacity hover:opacity-90"
              >
                Sign in to accept
              </Link>
            ) : (
              <>
                <Link
                  href={`/register?invite=${encodeURIComponent(token)}`}
                  className="rounded-lg bg-[#0f2540] px-3 py-1.5 text-sm font-medium text-[#e6ecfa] transition-opacity hover:opacity-90"
                >
                  Create an account
                </Link>
                <Link
                  href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                  className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </CardContent>
      </Shell>
    )
  }

  const result = await redeemInvitation(token)

  if (!result.success) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ban className="h-4 w-4" /> Could not accept this invitation
          </CardTitle>
          <CardDescription>{result.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
            Go to your dashboard
          </Link>
        </CardContent>
      </Shell>
    )
  }

  // Pre-approved members are already in, so send them straight to the family. Everyone
  // else lands on the dashboard, which renders the awaiting-approval screen for them —
  // the one place that explains what happens next.
  redirect('/dashboard')
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-16 sm:px-6">
      <Card className="w-full">{children}</Card>
    </div>
  )
}
