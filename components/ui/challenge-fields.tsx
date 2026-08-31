'use client'

import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * The two fields that stand in front of an irreversible act: a password, and an emailed code.
 *
 * ── WHY THEY LIVE HERE RATHER THAN BESIDE THE ONE SCREEN THAT HAD THEM ─────────────
 * Both were private to a single component — `DowngradeReauth` inside `PlanPanel`,
 * `RemovalCodeField` inside `FamilySettingsClient` — which was right while each had one
 * caller. Disconnecting Stripe went behind BOTH steps on 2026-08-25, and copying them would
 * have made three versions of two fields whose details are not decoration: the
 * `autoComplete` values, the digits-only paste handling, the sentence explaining what the
 * factor buys. `lib/action-challenge.ts` is the same move on the server side of this feature.
 *
 * ── A REF, NOT STATE FROM THE CALLER, AND THAT IS FORCED ───────────────────────────
 * Both render inside `confirm()`'s `body`, which is a node captured at the moment `confirm()`
 * is called and never re-rendered by the calling component again. A controlled input bound to
 * state up there would sit frozen at the empty string. So each field owns its own value and
 * writes it out through the ref, and the caller reads it at the moment it is asked.
 *
 * The caller CLEARS the ref before every confirmation and again after reading it. A password
 * or a code left in a ref is one a later action could spend.
 */

/**
 * The caller's sign-in password.
 *
 * ── IT IS NOT A GATE, AND THE COPY MUST NOT PROMISE ONE ────────────────────────────
 * It is checked in the BROWSER, against a throwaway Supabase client, so anybody who can open
 * devtools can skip it — and the action behind it is a `'use server'` export with a URL that
 * the caller already holds the grant for. What it buys is real and smaller: it stops an
 * accident, and it stops somebody who sits down at an unlocked screen and uses the product.
 * AGENTS.md records the Password panel promising more than that and having to be rewritten;
 * `label` and `hint` are per-caller so each can say what is true of its own act, and neither
 * should say "only you can do this".
 *
 * `autoComplete="current-password"` so a password manager offers the right entry rather than
 * treating this as a new one to save over the account's real password.
 */
export function PasswordReauthField({ valueRef, id, label, hint }: {
  valueRef: { current: string }
  /** Unique per screen: two of these in one document would collide on the label's `htmlFor`. */
  id: string
  label?: string
  hint: string
}) {
  // The DEFAULT label lives here rather than in the parameter list: a default parameter cannot
  // call a hook, and an English default on a shared control is the worst place for one — every
  // caller that does not pass a label gets it.
  const t = useT()
  const [value, setValue] = useState('')

  return (
    <div className="mt-4 rounded-xl border border-brand-withheld/40 bg-brand-withheld/5 p-4">
      <Label htmlFor={id}>{label ?? t('cf.confirmWithPassword')}</Label>
      <Input
        id={id}
        type="password"
        autoComplete="current-password"
        value={value}
        onChange={e => {
          setValue(e.target.value)
          valueRef.current = e.target.value
        }}
        className="mt-1.5 max-w-sm"
      />
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

/**
 * The six digits emailed to the person doing it.
 *
 * ── THIS ONE IS A REAL FACTOR ──────────────────────────────────────────────────────
 * Unlike the password above, nothing about this is decided in the browser:
 * `consume_family_action_challenge` verifies and spends it in one statement under
 * `FOR UPDATE`, owns the five-attempt cap and the fifteen-minute expiry, and refuses every
 * JWT role but `service_role`. What it proves is that whoever holds this session also holds
 * the mailbox — which matters because a grant may have been given months ago to somebody who
 * has since walked away from an unlocked screen.
 *
 * DIGITS ONLY ON THE WAY IN, so a pasted "123 456" or "123-456" works rather than failing a
 * shape check whose reason the person cannot see. `one-time-code` lets a phone offer the code
 * straight from the notification.
 */
export function EmailedCodeField({ valueRef, id, sentTo }: {
  valueRef: { current: string }
  /** Unique per screen — see `PasswordReauthField`. */
  id: string
  /** The address it went to. The caller's OWN, so this discloses nothing new. */
  sentTo: string
}) {
  const t = useT()
  const [value, setValue] = useState('')

  return (
    <div className="rounded-xl border border-brand-withheld/40 bg-brand-withheld/5 p-4">
      <Label htmlFor={id}>{t('ui.confirmationCode')}</Label>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        value={value}
        onChange={e => {
          const next = e.target.value.replace(/\D/g, '').slice(0, 6)
          setValue(next)
          valueRef.current = next
        }}
        className="mt-1.5 max-w-[12rem] font-mono text-lg tracking-[0.4em]"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        {t('cf.sixDigitsEmailed', { email: sentTo })}
      </p>
    </div>
  )
}
