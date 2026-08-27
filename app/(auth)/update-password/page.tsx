import Link from 'next/link'
import { UpdatePasswordForm } from '@/components/auth/UpdatePasswordForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { currentUser } from '@/lib/auth/current-user'

// `noindex` as well as the `Disallow: /update-password` in robots.txt — same
// reasoning as /invite/[token]. This page is only reachable holding a live
// recovery session, and a search result is never how anyone should arrive at it.
export const metadata = {
  title: 'Choose a New Password',
  robots: { index: false, follow: false, nocache: true },
}

/**
 * Where a password-reset link lands, after `/auth/confirm` has exchanged its token_hash
 * for a session.
 *
 * THE SESSION CHECK IS THE WHOLE PAGE. Reaching here without one means the link expired,
 * had already been used, or somebody typed the URL — and all three want the same answer:
 * ask for a fresh link. Deciding it on the server means the visitor never sees a password
 * form that was never going to work, and there is no flash of one either.
 *
 * getUser() rather than getSession(): it revalidates the token with the auth server
 * instead of trusting a cookie this page did not write.
 */
export default async function UpdatePasswordPage() {
  const { user } = await currentUser()

  if (!user) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">That link is no longer valid</CardTitle>
          <CardDescription>
            Reset links work once and expire after an hour. Request a new one and it will
            arrive in a moment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/forgot-password"
            className="text-primary font-medium hover:underline"
          >
            Send me a new link
          </Link>
        </CardContent>
      </Card>
    )
  }

  return <UpdatePasswordForm />
}
