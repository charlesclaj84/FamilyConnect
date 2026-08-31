'use client'

import { useState, useTransition } from 'react'
import { Cake, PenLine, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormError } from '@/components/ui/form-message'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'
import { formatDate } from '@/lib/date-utils'
import { composeBirthdayGreeting, dismissBirthdayPrompt } from '@/app/actions/birthdays'
import { BIRTHDAY_COMPOSE_LEAD_DAYS, type BirthdayPrompt } from '@/lib/birthday-greetings'

/**
 * "Ada's birthday is in nine days. Would you like to say something?"
 *
 * ── THE PROMPT IS THE FEATURE, AND THE COMPOSER IS ALREADY OPEN ────────────────────
 * TODO.md's first decision: the product PROMPTS and the family WRITES. So this is not a list
 * with a "compose" link — pressing the relative's name opens a title and a message with a
 * suggested first line already in them, because the distance between "somebody should say
 * something" and "somebody said something" is entirely made of friction.
 *
 * The suggestion is a STARTING POINT and is editable to the last character. It is not the
 * product speaking: nothing is posted until a person presses the button, and what gets posted
 * is whatever is in the box then.
 *
 * ── AND "NOT THIS YEAR" IS BESIDE IT, NOT BURIED ──────────────────────────────────
 * `dismissBirthdayPrompt` is one press. A family that greets in person, a relative who has
 * asked not to be named, a recorded ancestor who died — all three are ordinary, and a prompt
 * that cannot be put away is a prompt people learn to scroll past. `app/actions/birthdays.ts`
 * argues it; the reason it is on the same row rather than in a menu is that turning something
 * OFF must never be harder than turning it on, which is the rule the notification grid keeps.
 */
export function BirthdayComposer({ prompts, canCompose, failed, onDone }: {
  prompts: BirthdayPrompt[]
  canCompose: boolean
  /** A read was refused (§8). Says so rather than reporting a family with no birthdays. */
  failed: boolean
  /** Re-read the pane after a greeting or a dismissal. */
  onDone: () => void
}) {
  const t = useT()
  const intl = useIntlTag()
  const [openFor, setOpenFor] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  if (failed) {
    return (
      <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-brand-withheld">
        {t('birthday.promptReadFailed')}
      </p>
    )
  }
  // NOTHING AT ALL when there is nothing coming up. Not an empty state: the pane below this
  // already lists the next sixty days and says so when that list is empty, and a second
  // "no birthdays" sentence above it would be the same fact twice.
  if (prompts.length === 0) return null

  function open(p: BirthdayPrompt) {
    setError('')
    setOpenFor(p.id)
    // The suggestion. Seeded on OPEN rather than held in state per person, so switching
    // relatives cannot carry one person's half-written message onto another's greeting —
    // the shape `StaffDeleteFamilyDialog` clears on the way in for the same reason.
    setTitle(t('birthday.suggestedTitle', { name: p.firstName }))
    setBody(t('birthday.suggestedBody', { name: p.firstName }))
  }

  function post(personId: string) {
    setError('')
    startTransition(async () => {
      const result = await composeBirthdayGreeting({ personId, title, body })
      if (!result.success) { setError(result.message); return }
      setOpenFor(null)
      onDone()
    })
  }

  function putAway(personId: string) {
    setError('')
    startTransition(async () => {
      const result = await dismissBirthdayPrompt(personId)
      if (!result.success) { setError(result.message); return }
      onDone()
    })
  }

  return (
    <section
      className="rounded-xl border border-brand-legacy/40 bg-brand-soft/40 p-4"
      aria-labelledby="birthday-prompt-heading"
    >
      <div className="flex items-start gap-2.5">
        <Cake className="mt-0.5 size-5 shrink-0 text-brand-legacy" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 id="birthday-prompt-heading" className="font-semibold text-brand-ink">
            {t('birthday.promptHeading')}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t('birthday.promptLede', { days: String(BIRTHDAY_COMPOSE_LEAD_DAYS) })}
          </p>

          <ul className="mt-3 space-y-2">
            {prompts.map(p => (
              <li key={p.id} className="rounded-lg border bg-card px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{`${p.firstName} ${p.lastName}`.trim()}</p>
                    <p className="text-xs text-muted-foreground">
                      {/* THE DAY AND THE COUNT, both. A date alone makes somebody work out
                          whether it is soon; a count alone makes them work out which day to
                          write it for. */}
                      {p.daysAway === 0
                        ? t('birthday.isToday')
                        : t('birthday.inDays', {
                            days: String(p.daysAway),
                            on: formatDate(p.onDate, intl) ?? p.onDate,
                          })}
                    </p>
                  </div>
                  {canCompose && (
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={openFor === p.id ? 'outline' : 'affirm'}
                        onClick={() => (openFor === p.id ? setOpenFor(null) : open(p))}
                        disabled={pending}
                      >
                        <PenLine className="size-3.5" aria-hidden="true" />
                        {openFor === p.id ? t('action.cancel') : t('birthday.saySomething')}
                      </Button>
                      {/* NO CONFIRMATION. Putting a prompt away is reversible by writing the
                          greeting anyway next time somebody looks, and a dialog in front of it
                          would make the quiet choice the expensive one. */}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => putAway(p.id)}
                        disabled={pending}
                        aria-label={t('birthday.notThisYearFor', { name: p.firstName })}
                      >
                        <X className="size-3.5" aria-hidden="true" />
                        {t('birthday.notThisYear')}
                      </Button>
                    </div>
                  )}
                </div>

                {openFor === p.id && (
                  <div className="mt-3 space-y-2.5 border-t pt-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`bd-title-${p.id}`} required>{t('field.title')}</Label>
                      <Input
                        id={`bd-title-${p.id}`}
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        disabled={pending}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`bd-body-${p.id}`} required>{t('field.message')}</Label>
                      <Textarea
                        id={`bd-body-${p.id}`}
                        autoGrow
                        rows={3}
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        disabled={pending}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{t('birthday.editFirst')}</p>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="affirm"
                        onClick={() => post(p.id)}
                        disabled={pending || !title.trim() || !body.trim()}
                      >
                        {pending ? t('birthday.posting') : t('birthday.postGreeting')}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <FormError message={error} />
        </div>
      </div>
    </section>
  )
}
