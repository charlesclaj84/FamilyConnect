'use client'

import { useState } from 'react'
import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { createClient, createPasswordCheckClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/ui/form-message'

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
 * WHAT PROTECTS THE PASSWORD CHANGE, in one place because it is asked three ways. Three
 * things happen on submit, and only the third is enforced:
 *
 *   1. the current password, checked by us — stops somebody using this form, and nothing
 *      more, since GoTrue's own endpoint takes the session token directly;
 *   2. the emailed code, checked by GoTrue — but only on sessions older than 24 hours;
 *   3. every other session revoked, server-side and irreversibly.
 *
 * Neither (1) nor (2) is a gate on its own and the copy on screen promises neither. The
 * reasoning, and the reason the check does not run on the app's own client, is in
 * `submitPassword` and in `createPasswordCheckClient`.
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
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState('')

  async function requestCode() {
    setPwError('')
    setPwBusy(true)
    const supabase = createClient()
    // Sends the reauthentication email — the one GoTrue template that carries a code
    // instead of a link, because the user is already signed in and is proving it is
    // still them at the keyboard. Eight digits: auth.email.otp_length in config.toml,
    // which the copy and placeholder below both restate. It was 6 in all three places
    // and 8 on hosted until 2026-08-12.
    const { error } = await supabase.auth.reauthenticate()
    setPwBusy(false)

    if (error) setPwError(error.message)
    else setPwStage('code-sent')
  }

  async function submitPassword() {
    setPwError('')
    if (!code.trim()) {
      setPwError('Enter the code from your email')
      return
    }
    if (!currentPassword) {
      setPwError('Enter your current password')
      return
    }
    if (password.length < 8) {
      setPwError('New password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setPwError('New passwords do not match')
      return
    }
    if (password === currentPassword) {
      setPwError('That is already your password. Choose a different one.')
      return
    }

    setPwBusy(true)

    // ── 1. Check the current password ────────────────────────────────────────────
    //
    // WHAT THIS IS AND IS NOT. It is not a gate, and must never be described as one:
    // `PUT /auth/v1/user` is a public GoTrue endpoint that accepts this browser's session
    // token, so anyone able to open devtools can change the password without ever loading
    // this form. No check we write here can prevent that, because the check runs on the
    // attacker's side of the wire.
    //
    // It is still worth the field, for the one attacker it does stop: somebody who sits
    // down at an unlocked screen and uses the product. That is the realistic version of
    // this threat, and until now the screen asked such a person for nothing they did not
    // already have — because the emailed code below is not checked either on a session
    // less than 24 hours old (matrix in config.toml beside `secure_password_change`), and
    // the mailbox it goes to is usually signed in on the same machine.
    //
    // The two proofs cover each other's blind spot, which is why both are asked for. The
    // code catches somebody who knows a password leaked from somewhere else and has no
    // access to the mailbox; the field catches somebody at the session who knows neither.
    //
    // `createPasswordCheckClient()` and not `createClient()` — signing in on the app's own
    // client would replace the live session and reset the 24-hour clock that decides
    // whether the code gets checked at all, disabling the other half of this on the way
    // past. Its doc comment has the rest.
    const probe = createPasswordCheckClient()
    const { error: currentPwError } = await probe.auth.signInWithPassword({
      email: signInEmail,
      password: currentPassword,
    })

    if (currentPwError) {
      setPwBusy(false)
      const wrongPassword =
        currentPwError.code === 'invalid_credentials' ||
        /invalid login credentials/i.test(currentPwError.message)
      // Anything else is a rate limit (each check spends a `sign_in_sign_ups` slot) or an
      // outage, and telling someone their password is wrong when it is not sends them to
      // the recovery flow for no reason.
      setPwError(wrongPassword
        ? 'That is not your current password.'
        : `We could not check your current password just now: ${currentPwError.message}`)
      return
    }

    // ── 2. Change it ─────────────────────────────────────────────────────────────
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password,
      nonce: code.trim(),
    })

    if (error) {
      setPwBusy(false)
      setPwError(error.message)
      return
    }

    // ── 3. Evict every other session ─────────────────────────────────────────────
    //
    // THE COMMONEST REASON ANYONE IS ON THIS SCREEN is believing somebody else is in their
    // account, and a password change that leaves the intruder's session live does not
    // accomplish that. This is also the one part of the screen that IS enforced rather
    // than advisory: the refresh tokens are revoked server-side and cannot be un-revoked
    // from a browser.
    //
    // It also sweeps the throwaway session step 1 just created.
    //
    // `scope: 'others'` keeps THIS browser signed in — the member stays where they are
    // and every other device has to sign in again with the new password. A plain
    // `signOut()` defaults to `'global'` and would sign them out of the screen they are
    // reading the confirmation on.
    //
    // MEASURED 2026-08-12 against a local stack: GoTrue ALREADY revokes every other
    // session on a password change by itself, and leaves the changing session alive. So
    // this call is redundant in the happy path — and kept deliberately, because the
    // guarantee the copy below states should belong to a line in our code rather than to
    // an undocumented internal that can change under us on a Supabase upgrade.
    //
    // The result is deliberately not surfaced, for the same reason: the eviction has
    // already happened by the time this runs, so a failure here does not mean the other
    // devices are still signed in, and copy that said so would be wrong in the common
    // case. Nothing to tell the user either way.
    await supabase.auth.signOut({ scope: 'others' })

    setPwBusy(false)
    setPwStage('done')
    setCode(''); setCurrentPassword(''); setPassword(''); setConfirmPassword('')
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
            <FormError message={emailError} />
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
        // Deliberately states what is REQUIRED rather than what is prevented. An earlier
        // version promised "a password cannot be changed by someone who simply found your
        // screen unlocked", which is more than either proof delivers — see submitPassword.
        description="Changing it takes your current password and a short code we email you. Your other devices are signed out afterwards."
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
              <p>We sent an 8-digit code to {signInEmail}. It expires in an hour.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reauth-code">Code from your email</Label>
              <Input
                id="reauth-code"
                value={code}
                onChange={e => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="12345678"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
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

            <FormError message={pwError} />

            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={pwBusy}>
                {pwBusy ? 'Saving…' : 'Save new password'}
              </Button>
              <Button
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => {
                  setPwStage('idle')
                  setPwError('')
                  // Do not leave a typed password sitting in component state for the rest
                  // of the page's life just because they changed their mind.
                  setCode(''); setCurrentPassword(''); setPassword(''); setConfirmPassword('')
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {pwStage === 'done' && (
          <div className="rounded-lg border bg-brand-soft/40 px-4 py-3 text-sm">
            {/*
              Stated flatly because it is now measured rather than hoped for: the eviction
              is done by GoTrue as part of the change and again by our own `scope: 'others'`
              call. The old copy — "It applies the next time you sign in" — implied the
              opposite, which is the sentence somebody reads after changing their password
              because they think a relative is in their account.
            */}
            <p>
              Your password has been changed, and every other device signed in to this
              account has been signed out. They will need the new password.
            </p>
          </div>
        )}
      </Panel>
    </div>
  )
}
