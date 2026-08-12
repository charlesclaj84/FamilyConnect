import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

// `noindex`, which is what app/sitemap.ts's intent already amounts to: it leaves
// this page out "for a duller reason — nobody searches for it". Excluded from the
// sitemap but still indexable is a half-signal, and what it earns is a thin page
// in the index competing with /login for the same brand queries. A sitemap is an
// invitation, not an instruction; this is the instruction.
export const metadata = {
  title: 'Reset Password',
  robots: { index: false, follow: true },
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
