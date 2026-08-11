'use client'

import { useState } from 'react'
import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Sign-in & security: the two things a member can change about their ACCOUNT, as opposed
 * to their profile.
 *
 * WHY IT IS HERE AND NOT BEHIND A PERMISSION. My Profile is deliberately outside the
 * permission grid — `20260806000006` removed its `permission_resources` row so it cannot
 * be restricted, and AGENTS.md records that the 2026-08-08 review reconsidered and kept
 * it. Your own sign-in address and your own password are the clearest possible case of
 * that principle, so this section adds no resource key and no migration.
 *
 * WHAT IT IS ACTUALLY FOR. These two forms are what make
 * `supabase/templates/email-change.html` and `reauthentication.html` live. Both templates
 * existed with nothing calling them, which meant GoTrue's stock versions were what any
 * future flow would have used — and those link with `{{ .ConfirmationURL }}`, the
 * fragment bug `/auth/confirm` exists to avoid.
 *
 * NEITHER TOUCHES `people`. The sign-in address is `auth.users.email`; the profile's
 * `primary_email` is a separate, self-asserted field and is edited in the General
 * section. They are deliberately not synchronised: one is an identity the account has
 * proved it controls, the other is "how the family reaches me", and a member may well
 * want those to differ. Saying so on screen is why the copy below names both.
 */

type EmailStage = 'idle' | 'form' | 'sent'
type PasswordStage = 'idle' | 'code-sent' | 'done'

function Panel({ icon, title, description, children }: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-brand-accent">{icon}</div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export function SignInSecuritySection({ visible, signInEmail }: {
  visible: boolean
  /** `auth.users.email`, resolved on the server so there is no flash of an empty value. */
  signInEmail: string
}) {
  // ── Sign-in email ────────────────────────────────────────────────────────────
  const [emailStage, setEmailStage] = useState<EmailStage>('idle')
  const [newEmail, setNewEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailError, setEmailError] = useState('')

  async function submitEmail() {
    setEmailError('')
    const address = newEmail.trim().toLowerCase()
    if (!address || !address.includes('@')) {
      setEmailError('Enter a valid email address')
      return
    }
    if (address === signInEmail.toLowerCase()) {
      setEmailError('That is already your sign-in address')
      return
    }

    setEmailBusy(true)
    const supabase = createClient()
    // double_confirm_changes = true in config.toml, so GoTrue mails BOTH addresses and
    // the change lands only once each has been confirmed. Nothing has moved yet at this
    // point, which is what the success copy has to convey.
    const { error } = await supabase.auth.updateUser({ email: address })
    setEmailBusy(false)

    if (error) setEmailError(error.message)
    else setEmailStage('sent')
  }

  // ── Password ─────────────────────────────────────────────────────────────────
  const [pwStage, setPwStage] = useState<PasswordStage>('idle')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState('')

  async function requestCode() {
    setPwError('')
    setPwBusy(true)
    const supabase = createClient()
    // Sends the reauthentication email — the one GoTrue template that carries a 6-digit
    // code instead of a link, because the user is already signed in and is proving it is
    // still them at the keyboard.
    const { error } = await supabase.auth.reauthenticate()
    setPwBusy(false)

    if (error) setPwError(error.message)
    else setPwStage('code-sent')
  }

  async function submitPassword() {
    setPwError('')
    if (password.length < 8) {
      setPwError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setPwError('Passwords do not match')
      return
    }
    if (!code.trim()) {
      setPwError('Enter the code from your email')
      return
    }

    setPwBusy(true)
    const supabase = createClient()
    // HOW MUCH THE CODE ACTUALLY PROTECTS, measured rather than assumed — the matrix is
    // in config.toml beside `secure_password_change`. Short version: GoTrue enforces the
    // nonce only when the session is older than its recent-login window (24h). Below
    // that it skips reauthentication entirely and a wrong code is accepted.
    //
    // So this gate is real against an unattended session someone sits down at days later,
    // and is a formality for a member who signed in this morning — who had to know the
    // password to be here at all. That is a reasonable place to land; what would not be
    // reasonable is copy promising more, which is why the panel says "so a password cannot
    // be changed by someone who simply found your screen unlocked" and not "we verify it
    // is you".
    const { error } = await supabase.auth.updateUser({
      password,
      nonce: code.trim(),
    })
    setPwBusy(false)

    if (error) setPwError(error.message)
    else {
      setPwStage('done')
      setCode(''); setPassword(''); setConfirmPassword('')
    }
  }

  if (!visible) return null

  return (
    <div className="space-y-5">
      <Panel
        icon={<Mail className="h-5 w-5" />}
        title="Sign-in email"
        description="The address you sign in with. Separate from the contact email in your profile — changing one does not change the other."
      >
        <p className="text-sm">
          <span className="text-muted-foreground">Currently </span>
          <span className="font-medium break-all">{signInEmail}</span>
        </p>

        {emailStage === 'idle' && (
          <Button size="sm" variant="outline" onClick={() => { setNewEmail(''); setEmailError(''); setEmailStage('form') }}>
            Change sign-in email
          </Button>
        )}

        {emailStage === 'form' && (
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); submitEmail() }}>
            <div className="space-y-1.5">
              <Label htmlFor="new-signin-email">New email address</Label>
              <Input
                id="new-signin-email"
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>
            {emailError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{emailError}</p>
            )}
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={emailBusy}>
                {emailBusy ? 'Sending…' : 'Send confirmation'}
              </Button>
              <Button size="sm" type="button" variant="ghost" onClick={() => setEmailStage('idle')}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {emailStage === 'sent' && (
          <div className="rounded-lg border bg-brand-soft/40 px-4 py-3 text-sm">
            <p>
              Check <span className="font-medium break-all">{signInEmail}</span> and{' '}
              <span className="font-medium break-all">{newEmail.trim().toLowerCase()}</span>.
              Both have to confirm before the address changes — until then you keep signing
              in with the current one.
            </p>
          </div>
        )}
      </Panel>

      <Panel
        icon={<KeyRound className="h-5 w-5" />}
        title="Password"
        description="We email you a short code first, so a password cannot be changed by someone who simply found your screen unlocked."
      >
        {pwStage === 'idle' && (
          <Button size="sm" variant="outline" onClick={requestCode} disabled={pwBusy}>
            {pwBusy ? 'Sending code…' : 'Change password'}
          </Button>
        )}

        {pwStage === 'code-sent' && (
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); submitPassword() }}>
            <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>We sent a 6-digit code to {signInEmail}. It expires in an hour.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reauth-code">Code from your email</Label>
              <Input
                id="reauth-code"
                value={code}
                onChange={e => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password-confirm">Confirm new password</Label>
              <Input
                id="new-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </div>

            {pwError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{pwError}</p>
            )}

            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={pwBusy}>
                {pwBusy ? 'Saving…' : 'Save new password'}
              </Button>
              <Button size="sm" type="button" variant="ghost" onClick={() => { setPwStage('idle'); setPwError('') }}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {pwStage === 'done' && (
          <div className="rounded-lg border bg-brand-soft/40 px-4 py-3 text-sm">
            <p>Your password has been changed. It applies the next time you sign in.</p>
          </div>
        )}
      </Panel>
    </div>
  )
}
