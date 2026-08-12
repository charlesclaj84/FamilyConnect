import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'
import { APP_NAME } from '@/lib/brand'

/**
 * A self-referencing canonical, for the reason set out on the landing page: this
 * build answers on both genorra.com and the `.vercel.app` alias, and without one
 * the two copies of this page compete.
 *
 * It also collapses the `?next=` variants. `/login?next=/invite/<token>` is a real
 * link the register page emits, and every distinct value of that parameter is a
 * separate URL to a crawler — one of which would carry an invitation token into
 * the index. The canonical names the bare path as the one page they all are.
 *
 * The description is this page's own rather than the site-wide one: a snippet
 * describing the whole product under a "Sign In" title reads as a mismatch, and
 * Google rewrites snippets it judges unrepresentative anyway.
 */
export const metadata = {
  title: 'Sign In',
  description: `Sign in to your ${APP_NAME} family portal to plan reunions, manage dues, and keep your family connected.`,
  alternates: { canonical: '/login' },
}

export default function LoginPage() {
  // LoginForm reads ?error= (set by /auth/confirm when a confirmation link is invalid
  // or already used), and useSearchParams() opts a client component out of the static
  // prerender unless it sits under a boundary. Without this the build fails rather than
  // silently degrading — the fallback keeps /login static and streams the form in.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
