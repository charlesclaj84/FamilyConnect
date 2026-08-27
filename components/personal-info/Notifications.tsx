'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/form-message'
import { COLLAPSING_CELL } from '@/components/ui/table-collapse'
import { cn } from '@/lib/utils'
import {
  CHANNELS, channelLabel, notificationLabel, notificationDescription,
  NOTIFICATIONS, channelDefault, prefEnabled,
  type NotificationChannel,
} from '@/lib/notification-prefs'
import {
  setMyNotificationPref, type MyNotificationSettings,
} from '@/app/actions/notification-prefs'
import { useT } from '@/components/layout/LocaleProvider'
import { InlineText } from '@/components/ui/inline-text'

/**
 * My Profile → Notifications.
 *
 * ── IT WAS "TEXT MESSAGES", AND THE RENAME IS THE SMALLER HALF ─────────────────────
 * That section held a mobile number, a confirmation code and one consent toggle — three
 * controls about one channel, on a screen named after the channel. So a member looking for
 * "stop emailing me about check-ins" found nothing, and the product had no place to put the
 * second notification it sends.
 *
 * This is a GRID: a row per notification, a column per channel, a cell somebody can turn on or
 * off. `lib/notification-prefs.ts` is the catalogue and the defaults; this renders it and takes
 * no view on what is in it, so a second notification is one entry there and nothing here.
 *
 * ── THE CONTACT DETAILS ARE THE ONES ALREADY ON FILE ───────────────────────────────
 * No number entry and no code entry. A notification goes to the address and the number on the
 * member's profile, which is stated at the top with a link to change them. Collecting a second
 * mobile number here is what the old screen did, and two columns describing one fact is how
 * they come to disagree — AGENTS.md §4b's `is_minor` trap, one layer down.
 *
 * ── WHAT THIS SCREEN IS STILL CAREFUL ABOUT ────────────────────────────────────────
 * The SMS column is a legal record, not a preference. `lib/sms/consent.ts` puts US TCPA damages
 * at **$500–$1,500 per message**, and three of the old screen's rules survive the rewrite
 * unchanged:
 *
 *   1. **SMS is never on by default.** The catalogue marks it `'opt-in'` and
 *      `lib/notification-prefs.test.ts` asserts no notification may default it on.
 *   2. **Turning it OFF is never harder than turning it on.** One press, no confirmation
 *      dialog, no reason asked for. `confirm.tsx` guards destructive controls all over this
 *      codebase and is deliberately absent here.
 *   3. **The screen never claims a text will arrive.** Where no provider is wired, or the
 *      number is unconfirmed, it says so under the grid rather than letting "On" imply delivery.
 *
 * ── STOPPED IS A DEAD END AND THE SCREEN SAYS SO ───────────────────────────────────
 * A member who replied STOP cannot be re-enabled from here — a carrier-level opt-out is revoked
 * by the handset. The SMS cell says **Stopped** and offers no control, with the one instruction
 * that works underneath. Offering a switch with a tooltip would leave somebody clicking at it.
 */
export function NotificationsSection({
  visible, settings,
}: {
  visible: boolean
  /** Resolved on the server so the grid paints with real answers, never a flash of defaults. */
  settings: MyNotificationSettings
}) {
  const t = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  /**
   * Cells changed since the last server answer.
   *
   * OPTIMISTIC, KEYED PER CELL. A `useTransition` around a grid would otherwise leave every
   * cell reading its old value until the round trip landed, and a switch that does not move
   * when pressed reads as a broken control. Keyed rather than a single boolean so pressing two
   * cells in a row cannot make the first one flicker back.
   */
  const [moved, setMoved] = useState<Record<string, boolean>>({})

  if (!visible) return null

  const cellKey = (key: string, channel: NotificationChannel) => `${key}:${channel}`

  const isOn = (key: string, channel: NotificationChannel) => {
    const local = moved[cellKey(key, channel)]
    if (local !== undefined) return local
    // THE SMS COLUMN READS THE CONSENT LEDGER, not just the pref row. The two are written
    // together by `setMyNotificationPref`, and the ledger is the one that can be moved from
    // outside this screen — a STOP reply, an admin record — so it wins. A grid that showed
    // "On" for somebody the ledger says we may not text would be the one lie this screen
    // cannot afford.
    if (channel === 'sms' && settings.smsConsent !== 'granted') return false
    return prefEnabled(settings.prefs, key, channel)
  }

  function toggle(key: string, channel: NotificationChannel, next: boolean) {
    setError('')
    setMoved(m => ({ ...m, [cellKey(key, channel)]: next }))
    startTransition(async () => {
      const result = await setMyNotificationPref({
        notificationKey: key, channel, optedIn: next,
      })
      if (!result.success) {
        // PUT IT BACK. A refused write with the switch left in its new position is the
        // §8b failure in a checkbox: the member is told it worked and finds it undone later.
        setMoved(m => {
          const rest = { ...m }
          delete rest[cellKey(key, channel)]
          return rest
        })
        setError(result.message ?? t('notify.failed'))
      }
      // REFRESHED EITHER WAY. A refused SMS opt-in may still have written a consent event or
      // adopted a number, so the server's answer has moved even when the answer was no.
      router.refresh()
    })
  }

  const stopped = settings.smsConsent === 'stopped'
  const emailUsable = Boolean(settings.contact.email) && !settings.contact.emailIsPlaceholder

  return (
    <section className="space-y-6" aria-labelledby="notifications-heading">
      <div>
        <h2 id="notifications-heading" className="text-lg font-semibold text-brand-ink">
          Notifications
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What your family may contact you about, and how. Everything here is yours to set and
          nobody else can set it for you.
        </p>
      </div>

      {/* ── WHERE A NOTIFICATION WOULD GO ─────────────────────────────────────────
          Stated before the grid, because a switch marked On over an address that is not
          there is the thing this screen must not do. Both are read-only here and link to
          General, which is the one place a contact detail is edited. */}
      <dl className="grid gap-3 rounded-lg border px-4 py-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('notify.channel.email')}
          </dt>
          <dd className="mt-0.5 truncate text-sm">
            {emailUsable
              ? settings.contact.email
              : <span className="text-brand-withheld">
                  {settings.contact.email
                    ? t('notify.placeholderAddress')
                    : t('notify.noneOnFile')}
                </span>}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('notify.channel.sms')}
          </dt>
          {/* LAST FOUR DIGITS ONLY. `getMyNotificationSettings` never sends the whole number
              back — a mobile number is the kind of thing a screenshot leaks. */}
          <dd className="mt-0.5 text-sm">
            {settings.contact.phoneEnding
              ? t('notify.endingIn', { digits: settings.contact.phoneEnding })
              : <span className="text-brand-withheld">{t('notify.noneOnFile')}</span>}
          </dd>
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          <InlineText text={t('notify.fromGeneral')} />
        </p>
      </dl>

      {/* ── THE GRID ──────────────────────────────────────────────────────────────
          A real `<table>` with `<th scope="col">`, so a screen reader announces the channel
          when it reads the cell (AGENTS.md, "A table is a table"). Below `sm` the two
          unavailable-today columns fold and the row restates nothing — see the cells. */}
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                {t('notify.colNotification')}
              </th>
              {CHANNELS.map(c => (
                <th
                  key={c}
                  scope="col"
                  className={cn(
                    'px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap',
                    // Push folds on a phone: it is the one column with nothing to press, and
                    // three switch columns plus a name do not fit 390px.
                    c === 'push' && COLLAPSING_CELL,
                  )}
                >
                  {channelLabel(t, c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NOTIFICATIONS.map(n => (
              <tr key={n.key} className="border-b align-top last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{notificationLabel(t, n.key)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {notificationDescription(t, n.key)}
                  </p>
                </td>
                {CHANNELS.map(c => {
                  const fallback = channelDefault(n.key, c)
                  return (
                    <td
                      key={c}
                      className={cn('px-3 py-3', c === 'push' && COLLAPSING_CELL)}
                    >
                      {fallback === 'unavailable' ? (
                        // NOT A DISABLED SWITCH. A control nobody can move is one somebody
                        // keeps pressing; this says what it is waiting for instead.
                        <span className="text-xs text-muted-foreground">{t('notify.notBuilt')}</span>
                      ) : c === 'sms' && stopped ? (
                        <span className="text-xs text-brand-withheld">{t('notify.stopped')}</span>
                      ) : (
                        <ChannelToggle
                          on={isOn(n.key, c)}
                          disabled={pending}
                          label={t('notify.toggleLabel', {
                            channel: channelLabel(t, c),
                            notification: notificationLabel(t, n.key),
                          })}
                          onChange={next => toggle(n.key, c, next)}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── WHY SOMETHING MARKED ON MIGHT STILL NOT ARRIVE ────────────────────────
          Rule 3 in the header. Each of these is a fact about delivery rather than about the
          member's choice, so none of them is allowed to change a switch — the switch says
          what they asked for, and these say what stands in the way.

          `--brand-withheld` and not `--destructive`: nothing has failed and nothing is an
          error. These are capabilities that are not in place yet, which is what that token is
          for. */}
      <div className="space-y-2 text-sm">
        {!emailUsable && (
          <p className="text-brand-withheld">
            <InlineText text={t('notify.noEmail')} />
          </p>
        )}
        {stopped ? (
          <p className="text-brand-withheld">
            <InlineText text={t('notify.stoppedNote')} />
          </p>
        ) : (
          <>
            {!settings.smsAvailable && (
              <p className="text-brand-withheld">
                <InlineText text={t('notify.smsNotOn')} />
              </p>
            )}
            {settings.smsConsent === 'granted' && !settings.contact.phoneEnding && (
              <p className="text-brand-withheld">
                <InlineText text={t('notify.noMobile')} />
              </p>
            )}
            {settings.smsConsent === 'granted'
              && settings.contact.phoneEnding
              && !settings.smsNumberVerified && (
              <p className="text-brand-withheld">
                <InlineText text={t('notify.willConfirm')} />
              </p>
            )}
          </>
        )}
      </div>

      <FormError message={error} />
    </section>
  )
}

/**
 * One cell of the grid — on or off, in one press.
 *
 * ── A `role="switch"` BUTTON, WHICH IS A PROMISE THIS ONE CAN KEEP ─────────────────
 * Unlike `MainRail` refusing `role="tablist"` and `RowMenu` refusing `role="menu"`, this role
 * asks for nothing that is not implemented: a two-state control, activated by Enter or Space
 * (which a `<button>` gives free), reporting its state through `aria-checked`. So it is claimed.
 *
 * NOT a `<input type="checkbox">`, because the visible label is the column heading and a
 * checkbox would want one of its own in every cell — nine `sr-only` labels saying what
 * `aria-label` says once.
 *
 * ── IT SAYS "ON" AND "OFF", NOT JUST A COLOUR ─────────────────────────────────────
 * Colour alone is not information. The word is in the control, so a member who cannot
 * distinguish the two fills reads the state, and the `aria-label` names the cell — "SMS for
 * Safety Check" — because nine identical switches tell a screen-reader user nothing about
 * which one they are on.
 */
function ChannelToggle({ on, disabled, label, onChange }: {
  on: boolean
  disabled: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <Button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      size="sm"
      variant={on ? 'affirm' : 'outline'}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="w-20 justify-center"
    >
      {on
        ? <><Check className="h-3.5 w-3.5" aria-hidden="true" /> On</>
        : <><X className="h-3.5 w-3.5" aria-hidden="true" /> Off</>}
    </Button>
  )
}

/** The rail's icon for this section, kept beside the component that owns it. */
export const NOTIFICATIONS_ICON = Bell
