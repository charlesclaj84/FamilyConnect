'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, FormError } from '@/components/ui/form-message'
import {
  confirmMyMobileNumber, grantSmsConsent, removeMyMobileNumber, resendMyPhoneCode,
  setMyMobileNumber, withdrawSmsConsent,
  type MySmsSettings,
} from '@/app/actions/sms-consent'
import { SMS_BLOCK_TEXT } from '@/lib/sms/consent'

/**
 * My Profile → Text Messages.
 *
 * ── WHAT THIS SCREEN IS CAREFUL ABOUT, AND WHY IT IS NOT THE USUAL CARE ────────────
 * Every other form in this product is careful about saving the right thing. This one is careful
 * about a legal record: FutureFeature.md §5 puts US TCPA damages at **$500–$1,500 per message**,
 * so the two facts this screen collects — a confirmed number, and permission to use it — are the
 * evidence that a text was lawful. Three rules follow and none of them is cosmetic:
 *
 *   1. **The two acts stay two.** Confirming a number and agreeing to be texted are separate
 *      controls, in that order, and neither implies the other. A single "enable texts" toggle
 *      that took a number and inferred permission from somebody having typed it is precisely the
 *      shape a complaint is about.
 *   2. **Turning it OFF is never harder than turning it on.** One press, no confirm dialog, no
 *      explanation asked for. `confirm.tsx` guards destructive controls all over this codebase
 *      and is deliberately absent here — a dialog between a member and the "stop texting me"
 *      button is an obstacle, and reads as one.
 *   3. **The screen never claims a text will arrive.** `smsAvailable` is false today because no
 *      provider is wired, and the panel says so rather than offering a code that cannot come.
 *
 * ── STOPPED IS A DEAD END AND THE SCREEN SAYS SO ───────────────────────────────────
 * A member who replied STOP cannot be re-enabled from here — a carrier-level opt-out is revoked
 * by the handset. So the controls are replaced by the one instruction that works. Offering a
 * disabled toggle with a tooltip would leave somebody clicking at it.
 *
 * ── THE NUMBER IS NEVER RENDERED BACK, ONLY ITS LAST FOUR DIGITS ───────────────────
 * `getMySmsSettings` returns `numberEnding` and not the number. A confirmed mobile is the kind of
 * thing a screenshot leaks and a shared laptop shows, and the member typed it — they do not need
 * it read back to them.
 */
export function TextMessagesSection({
  visible,
  settings,
}: {
  visible: boolean
  /** Resolved on the server so the panel paints with no flash of an empty state. */
  settings: MySmsSettings
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [editingNumber, setEditingNumber] = useState(false)

  if (!visible) return null

  const act = (
    fn: () => Promise<{ success: boolean; message?: string }>,
    onOk?: () => void,
  ) => {
    setError(''); setNotice(''); setPhoneError(''); setCodeError('')
    startTransition(async () => {
      const result = await fn()
      if (!result.success) {
        setError(result.message ?? 'That did not work')
      } else {
        setNotice(result.message ?? 'Saved')
        onOk?.()
      }
      // REFRESHED EITHER WAY. A failed confirmation still burns an attempt and a failed send
      // still wrote a challenge row, so the panel's state has moved even when the answer was no.
      router.refresh()
    })
  }

  const stopped = settings.status === 'stopped'

  return (
    <section className="space-y-6" aria-labelledby="text-messages-heading">
      <div>
        <h2 id="text-messages-heading" className="text-lg font-semibold text-brand-ink">
          Text Messages
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A mobile number your family can reach you on for safety check-ins.
        </p>
      </div>

      {/*
        THE HONEST NOTICE, FIRST. Nothing is wired yet, and a member who adds a number and waits
        for a code deserves to know that before they start rather than after.

        `--brand-withheld` and not `--destructive`: nothing has failed and nothing is an error.
        This is a capability that is not switched on yet, which is exactly what that token is for.
      */}
      {!settings.smsAvailable && (
        <p className="rounded-lg border border-brand-withheld/40 bg-brand-withheld/10 px-3 py-2.5 text-sm text-brand-withheld">
          Text messages are not switched on yet. You can add your number and record your choice
          now, and we will confirm the number as soon as they are.
        </p>
      )}

      {stopped ? (
        /*
          A DEAD END, AND THE ONLY INSTRUCTION THAT WORKS. No controls at all — see the header.
        */
        <div className="rounded-lg border px-4 py-3">
          <p className="text-sm font-medium">You replied STOP to one of our text messages.</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            We cannot text this number again, and we cannot switch it back on from here — that is
            a rule your mobile network enforces, not a setting we hold. Text{' '}
            <strong>START</strong> to the number that messaged you if you want them back.
          </p>
        </div>
      ) : (
        <>
          {/* ── 1. THE NUMBER ─────────────────────────────────────────────────── */}
          <div className="space-y-3 rounded-lg border px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Mobile number</p>
                {settings.hasNumber ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Ending <span className="font-medium tabular-nums">{settings.numberEnding}</span>
                    {settings.verified ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-brand-affirm">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        Confirmed
                      </span>
                    ) : (
                      <span className="ml-2 text-brand-withheld">Not confirmed yet</span>
                    )}
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-muted-foreground">None on file.</p>
                )}
              </div>
              {settings.hasNumber && !editingNumber && (
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" disabled={pending}
                    onClick={() => { setEditingNumber(true); setPhone('') }}>
                    Change
                  </Button>
                  <Button variant="ghost" size="sm" disabled={pending}
                    className="text-destructive"
                    onClick={() => act(removeMyMobileNumber)}>
                    Remove
                  </Button>
                </div>
              )}
            </div>

            {(editingNumber || !settings.hasNumber) && (
              <div className="space-y-1.5">
                <Label htmlFor="sms-phone">Mobile number</Label>
                <Input
                  id="sms-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  placeholder="512-555-0134"
                  onChange={e => { setPhone(e.target.value); setPhoneError('') }}
                />
                {/*
                  WHY THIS IS NOT THE DIRECTORY NUMBER, said where somebody is typing it. The two
                  columns are deliberately separate (`20260823000002`'s header argues it) and
                  without this line a member reasonably assumes changing one changes the other.
                */}
                <p className="text-xs text-muted-foreground">
                  This is only used for text messages. The phone number in your{' '}
                  <strong>General</strong> details is what relatives see in the Directory, and
                  changing one does not change the other.
                </p>
                <FieldError message={phoneError} />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" disabled={pending || !phone.trim()}
                    onClick={() => act(
                      () => setMyMobileNumber({ phone }),
                      () => { setEditingNumber(false); setPhone('') },
                    )}>
                    {settings.smsAvailable ? 'Save and send a code' : 'Save number'}
                  </Button>
                  {settings.hasNumber && (
                    <Button variant="outline" size="sm" disabled={pending}
                      onClick={() => { setEditingNumber(false); setPhone(''); setPhoneError('') }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ── 2. THE CODE ───────────────────────────────────────────────── */}
            {settings.hasNumber && !settings.verified && !editingNumber && (
              <div className="space-y-1.5 border-t pt-3">
                <Label htmlFor="sms-code">Confirmation code</Label>
                <Input
                  id="sms-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  placeholder="123456"
                  onChange={e => { setCode(e.target.value); setCodeError('') }}
                />
                <FieldError message={codeError} />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" disabled={pending || code.replace(/\D/g, '').length !== 6}
                    onClick={() => act(
                      () => confirmMyMobileNumber({ code }),
                      () => setCode(''),
                    )}>
                    Confirm number
                  </Button>
                  <Button variant="outline" size="sm" disabled={pending}
                    onClick={() => act(resendMyPhoneCode)}>
                    {settings.codeOutstanding ? 'Send a new code' : 'Send a code'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ── 3. CONSENT, AND IT IS A SEPARATE ACT ───────────────────────────── */}
          <div className="space-y-3 rounded-lg border px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Safety check-ins by text</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {settings.status === 'granted'
                    ? 'You have agreed to be texted when your family raises a safety check-in.'
                    : 'Your family cannot text you until you agree to it.'}
                </p>
              </div>
              <div className="shrink-0">
                {settings.status === 'granted' ? (
                  /* ONE PRESS, NO CONFIRM DIALOG. See rule 2 in the header. */
                  <Button variant="outline" size="sm" disabled={pending}
                    onClick={() => act(withdrawSmsConsent)}>
                    Turn off
                  </Button>
                ) : (
                  <Button variant="affirm" size="sm" disabled={pending}
                    onClick={() => act(grantSmsConsent)}>
                    <MessageSquare aria-hidden="true" />
                    Agree to texts
                  </Button>
                )}
              </div>
            </div>

            {settings.status === 'granted' && settings.grantedAt && (
              <p className="text-xs text-muted-foreground">
                Agreed on {new Date(settings.grantedAt).toLocaleDateString(undefined, {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}. You can turn this off at any time, and replying STOP to any message turns it
                off too.
              </p>
            )}

            {/*
              WHY WE STILL WOULD NOT TEXT THEM, in the words `SMS_BLOCK_TEXT` holds. This is the
              line that stops the two controls above reading as independent switches: somebody who
              has agreed but not confirmed their number needs to be told which step is missing,
              and "Agreed" on its own would tell them they are done.

              Suppressed once everything is in place, and while consent is off — where the reason
              would just restate the button beside it.
            */}
            {settings.blockedBecause
              && settings.blockedBecause !== 'no_consent'
              && settings.blockedBecause !== 'withdrawn' && (
              <p className="text-sm text-brand-withheld">
                Not yet: {SMS_BLOCK_TEXT[settings.blockedBecause].toLowerCase()}.
              </p>
            )}
          </div>
        </>
      )}

      <FormError message={error} />
      {notice && <p className="text-sm text-brand-affirm">{notice}</p>}
    </section>
  )
}
