'use client'

import { useMemo, useState, useTransition } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label, RequiredMark } from '@/components/ui/label'
import { FieldError, FormError } from '@/components/ui/form-message'
import { PersonMultiSelect } from '@/components/ui/person-multi-select'
import { raiseCheckIn } from '@/app/actions/safety-check-ins'
import type { CheckInAudienceOption, CheckInPickerPerson } from '@/app/actions/safety-check-ins'
import type { CheckInScope } from '@/lib/safety-check-in'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * Raising a check-in.
 *
 * ── THE AUDIENCE IS THE ONLY HARD PART, AND IT HAS FOUR ANSWERS ────────────────────
 * FutureFeature.md's second decision is the whole reason this dialog is shaped as it is:
 *
 *     *"An area is not a chapter, and neither answer works alone. A chapter is how a family
 *     ORGANISED itself; a disaster addresses where people ARE. All three — chapter, geography,
 *     hand-picked names — must resolve to one explicit roster at raise time."*
 *
 * So the picker offers the family, each region, each chapter, AND a hand-picked list — and the
 * last of those is not a fallback, it is the answer for the relative who moved last year, who is
 * exactly the person an organised audience silently drops.
 *
 * ── EVERY AUDIENCE SHOWS ITS COUNT, AND ITS UNREACHABLE COUNT, BEFORE YOU SEND ─────
 * *"Everyone in the family — 141 relatives, 4 with no email"*. That line is the whole reason
 * `getCheckInComposer` resolves counts server-side, and it does two jobs:
 *
 *   * it lets somebody check the audience against what they MEANT, which is the only moment
 *     checking is any use — after the ask, a hundred and forty people have already been woken;
 *   * it states the unreachable number IN ADVANCE, so it reads as a fact about the family rather
 *     than as a failure discovered mid-emergency.
 *
 * ── NO CONFIRM STEP, AND THAT IS DELIBERATE ────────────────────────────────────────
 * `confirm.tsx` guards destructive controls throughout this codebase and it is not used here.
 * The count line is the confirmation — it says exactly how many people this reaches, next to the
 * button — and an extra modal between somebody watching a storm and asking their family if they
 * are alive is being careful in the wrong place. What protects against a false alarm is the
 * GRANT (`canAny` on `create`), which is where FutureFeature.md puts it.
 *
 * ── ONE THING IT WILL NOT DO: PROMISE DELIVERY ─────────────────────────────────────
 * The submit button says "Ask them", not "Alert everyone", and the result message reports how
 * many were addressed and how many have no mailbox. Nothing here says the message arrived,
 * because `sendEmail` fails soft and nothing in this product can know that it did.
 */
export function RaiseCheckInDialog({
  open,
  onClose,
  audiences,
  people,
  onRaised,
}: {
  open: boolean
  onClose: () => void
  audiences: readonly CheckInAudienceOption[]
  people: readonly CheckInPickerPerson[]
  /** Called with the new id, so the parent can start driving the ask queue. */
  onRaised: (checkInId: string) => void
}) {
  const t = useT()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [titleError, setTitleError] = useState('')
  const [audienceError, setAudienceError] = useState('')

  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  // The composite key, because a region id and a chapter id are both uuids from different tables
  // and would otherwise collide — the same reason `boardKey` in `lib/meeting-boards.ts` is
  // prefixed. `named` is its own value with no id.
  const [choice, setChoice] = useState('family:')
  const [personIds, setPersonIds] = useState<string[]>([])

  const selected = useMemo(
    () => audiences.find(a => `${a.scope}:${a.id ?? ''}` === choice) ?? null,
    [audiences, choice],
  )
  const isNamed = choice === 'named:'

  const namedUnreachable = useMemo(
    () => people.filter(p => personIds.includes(p.personId) && p.unreachable).length,
    [people, personIds],
  )

  const reset = () => {
    setTitle(''); setDetail(''); setChoice('family:'); setPersonIds([])
    setError(''); setTitleError(''); setAudienceError('')
  }

  const submit = () => {
    setError(''); setTitleError(''); setAudienceError('')

    // CHECKED HERE AND AGAIN IN THE ACTION. The dialog is a convenience, not a gate (AGENTS.md
    // §2) — `raiseCheckIn` refuses a blank title and an empty named list on its own, because it
    // is a public HTTP endpoint. These checks exist so the message lands next to the field.
    if (!title.trim()) {
      setTitleError(t('safety.sayWhat'))
      return
    }
    if (isNamed && personIds.length === 0) {
      setAudienceError(t('safety.chooseOne'))
      return
    }

    const scope: CheckInScope = isNamed ? 'named' : (selected?.scope ?? 'family')

    startTransition(async () => {
      const result = await raiseCheckIn({
        title: title.trim(),
        detail: detail.trim() || undefined,
        scope,
        areaId: isNamed ? null : (selected?.id ?? null),
        personIds: isNamed ? personIds : undefined,
      })
      if (!result.success || !result.checkInId) {
        setError(result.message ?? t('safety.raiseFailed'))
        return
      }
      onRaised(result.checkInId)
      reset()
      onClose()
    })
  }

  // WHAT THIS ASK REACHES, in the same words for both kinds of audience. The named case is
  // counted on the client because the client is what holds the selection; the area cases are
  // counted on the server, where the roster is.
  const addressed = isNamed ? personIds.length : (selected?.addressed ?? 0)
  const unreachable = isNamed ? namedUnreachable : (selected?.unreachable ?? 0)

  return (
    <Dialog
      open={open}
      onClose={() => { reset(); onClose() }}
      title={t('safety.askIfSafe')}
      description={t('safety.oneQuestion')}
      className="max-w-lg"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="check-in-title">
            {t('safety.whatHappening')}<RequiredMark />
          </Label>
          <Input
            id="check-in-title"
            value={title}
            maxLength={120}
            placeholder={t('safety.titlePh')}
            onChange={e => { setTitle(e.target.value); setTitleError('') }}
          />
          <p className="text-xs text-muted-foreground">
            {t('safety.subjectHint')}
          </p>
          <FieldError message={titleError} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="check-in-detail">{t('safety.anythingElse')}</Label>
          <Textarea
            id="check-in-detail"
            rows={3}
            value={detail}
            maxLength={2000}
            placeholder={t('safety.detailPh')}
            onChange={e => setDetail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="check-in-audience">
            {t('safety.whoToAsk')}<RequiredMark />
          </Label>
          <Select
            id="check-in-audience"
            value={choice}
            onChange={e => { setChoice(e.target.value); setAudienceError('') }}
          >
            {audiences.map(a => (
              <option key={`${a.scope}:${a.id ?? ''}`} value={`${a.scope}:${a.id ?? ''}`}>
                {a.label} — {t(a.addressed === 1
                  ? 'safety.relativeOne'
                  : 'safety.relativesMany', { n: String(a.addressed) })}
                {a.unreachable > 0
                  ? t('safety.withNoEmail', { n: String(a.unreachable) })
                  : ''}
              </option>
            ))}
            {/*
              THE ESCAPE HATCH, AND IT IS LAST because it is the most work to use. An area is the
              right answer most of the time; naming people is what you reach for when the family's
              own geography does not match the disaster's.
            */}
            <option value="named:">{t('safety.justNamed')}</option>
          </Select>
          {!isNamed && selected?.scope === 'region' && (
            // THE ONE THING ABOUT AREA AUDIENCES THAT READS AS A BUG UNLESS IT IS SAID. A member
            // in no chapter is in no region, so a regional ask does not reach them —
            // `lib/safety-check-in.ts` argues why that narrowing is right, and this is the
            // sentence that stops it being a surprise.
            <p className="text-xs text-muted-foreground">{t('ui.relativeWhoNotTold')}<strong>{t('safety.justNamed')}</strong> to
              include them.
            </p>
          )}
          <FieldError message={audienceError} />
        </div>

        {isNamed && (
          <PersonMultiSelect
            label={t('safety.relativesToAsk')}
            hint={t('safety.emailedOne')}
            people={people.map(p => ({
              id: p.personId,
              first_name: p.firstName,
              last_name: p.lastName,
            }))}
            selected={personIds}
            onChange={setPersonIds}
            emptyMessage={t('safety.noRelatives')}
          />
        )}

        {/*
          THE COUNT LINE, WHICH IS THIS DIALOG'S CONFIRMATION STEP. It never says the message will
          arrive — `sendEmail` fails soft — and it names the unreachable relatives as a job for a
          person rather than as a failure of the product.
        */}
        <div className="rounded-lg border border-brand-urgent bg-brand-urgent/10 px-3 py-2.5 text-sm">
          {addressed === 0 ? (
            <p className="text-muted-foreground">
              {t('safety.nobodySelected')}
            </p>
          ) : (
            <>
              <p className="font-medium text-brand-urgent">
                {t(addressed === 1
                  ? 'safety.willBeAskedOne'
                  : 'safety.willBeAskedMany', { n: String(addressed) })}
              </p>
              {unreachable > 0 && (
                <p className="mt-1 text-muted-foreground">
                  {t(unreachable === 1
                    ? 'safety.noEmailPhoneOne'
                    : 'safety.noEmailPhoneMany', { n: String(unreachable) })}
                </p>
              )}
            </>
          )}
        </div>

        <FormError message={error} />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => { reset(); onClose() }} disabled={pending}>
            {t('action.cancel')}
          </Button>
          <Button
            onClick={submit}
            disabled={pending || addressed === 0}
            className="bg-brand-urgent text-brand-on-urgent hover:opacity-90"
          >
            {pending ? t('safety.asking') : t('safety.askThem')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
