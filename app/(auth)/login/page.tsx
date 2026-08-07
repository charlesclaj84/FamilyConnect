import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata = { title: 'Sign In — Family Connect' }

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
