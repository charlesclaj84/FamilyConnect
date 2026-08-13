'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clearIdleActivity } from '@/lib/idle-timeout'

/**
 * The two exits from the "this invitation is for a different address" screen.
 *
 * Both live in one component because they are two halves of one decision — "I am the
 * invited person on the wrong account" and "I am the inviter and need to pass this on" —
 * and they share one error line.
 *
 * SIGNING OUT REFRESHES THIS PAGE RATHER THAN NAVIGATING TO /login, and that is what
 * keeps the token. `proxy.ts:57` bounces a signed-in visitor away from BOTH /login and
 * /register to /dashboard, dropping the `?next=` that was carrying the invitation — so a
 * hatch that routes through either one is a hatch that loses the credential exactly when
 * sign-out has not taken effect. Staying on /invite/<token> cannot lose it: the URL never
 * changes, and the page's own no-session branch already renders the correct next step
 * (Sign in, or Create an account, decided by `hasAccount`).
 *
 * `scope: 'local'` clears this browser's session and leaves the account's other sessions
 * alone. Somebody accepting a family invitation on their phone should not be signed out
 * of their laptop.
 */
export function InviteMismatchActions({ token }: { token: string }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function signOutAndStay() {
    setError('')
    const supabase = createClient()

    // HONOUR THE RESULT. gotrue-js clears the local session only after a logout call
    // that succeeded (or returned 401/403/404); on a network failure or a 5xx the session
    // is still live. Refreshing then re-renders this same mismatch screen, which reads as
    // the button doing nothing — so say what happened instead.
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })

    if (signOutError) {
      setError('We could not sign you out just now. Your invitation link is still in the address bar — try again, or open it in a private window.')
      return
    }

    // Only on success, for the same reason the error branch returns: a sign-out that
    // failed leaves the session live, and the idle timer is still guarding it.
    clearIdleActivity()

    startTransition(() => router.refresh())
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be refused (permissions, insecure origin). The link is in the
      // address bar either way, so this is a nicety failing rather than the feature.
      setError('We could not copy it. The link is in your address bar.')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={signOutAndStay}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {isPending ? 'Signing out…' : 'Sign out and continue'}
        </button>

        {/* For the inviter, who is the likeliest visitor to this screen: the dialog that
            minted this invitation hands them the link and they open it to see what their
            cousin will see. They need to pass it on, not sign out. */}
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Link copied' : 'Copy invitation link'}
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
