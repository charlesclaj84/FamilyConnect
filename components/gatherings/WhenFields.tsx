'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { FieldError } from '@/components/ui/form-message'
import { cn } from '@/lib/utils'
import { TIMEZONES, TIMEZONE_LABELS } from '@/lib/date-utils'
import {
  WHEN_PROBLEM_TEXT, whenProblems,
  type GatheringOccurrence, type GatheringWhen,
} from '@/lib/gathering-when'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * **When** — the one place a gathering's dates and times are entered.
 *
 * ── IT REPLACED "First day" AND "Last day", WHICH ANSWERED TOO LITTLE ──────────────
 * Two bare date boxes could not say what time the picnic starts, and could not tell a
 * three-day reunion apart from a committee that meets on three Saturdays — the calendar drew
 * both as a bar across a fortnight, which for the second is a fortnight the family is not
 * gathering for.
 *
 * So: **Starts** and **Ends**, each with an optional time, a checkbox for more than one day,
 * and — behind that checkbox — the one question the old form had no way to ask, which is
 * whether those days are one block or several occasions.
 *
 * ── ONE COMPONENT, TWO FORMS ───────────────────────────────────────────────────────
 * The member's scheduling dialog and the organizer's edit panel both render this. Two copies
 * would be two answers to "is the end allowed to be before the start" the moment one is
 * edited, which is the same argument `components/gatherings/status.ts` makes about a colour and
 * `lib/gathering-when.ts` makes about the rules themselves.
 *
 * ── THE RULES ARE NOT HERE ─────────────────────────────────────────────────────────
 * `whenProblems` decides what is wrong and `WHEN_PROBLEM_TEXT` says it. This component renders
 * the answer against the row it belongs to and nothing else — so the form refuses exactly what
 * the action refuses, because it is the same function, and the database's three CHECK
 * constraints are the third statement of the same three rules.
 *
 * ── A TIME IS OPTIONAL, EVERYWHERE, AND THAT IS THE COMMON CASE ────────────────────
 * "The reunion is on 4 July" is a complete answer and most gatherings are entered that way. So
 * no time field is ever required, an empty one means "no time given" rather than midnight, and
 * `<input type="time">` is used rather than a text box because the browser's own picker is
 * better than anything worth building here and it enforces `HH:MM` for free.
 *
 * ── AND `min` ON EVERY END PICKER ──────────────────────────────────────────────────
 * The database refuses an end before a start and the action turns that into a sentence, which
 * is the right boundary and the wrong first line of defence: a picker that greys out the
 * impossible days never produces one, so nobody meets the refusal. Both stay.
 */
export function WhenFields({ value, onChange, idPrefix = 'when', disabled }: {
  value: GatheringWhen
  onChange: (next: GatheringWhen) => void
  /** Unique per form on the page, so two of these cannot collide on an input id. */
  idPrefix?: string
  disabled?: boolean
}) {
  const t = useT()
  const problems = whenProblems(value)
  const problemAt = (index: number) =>
    problems.find(p => 'index' in p && p.index === index)?.code ?? null
  const spanning = value.occurrences.length > 1 || !!value.occurrences[0]?.endsOn

  /**
   * Is this a more-than-one-day gathering?
   *
   * DERIVED rather than held in its own state, which is the same decision `ScheduleDialog`'s
   * audience selection makes: a checkbox with its own boolean beside data that already answers
   * the question is two facts that disagree the moment somebody clears a date. It is true when
   * there is an end date or a second occasion — either of which is a gathering over more than
   * one day, however it was reached.
   */
  const multiDay = spanning || !value.isContinuous

  const first: GatheringOccurrence =
    value.occurrences[0] ?? { startsOn: '', startTime: null, endsOn: null, endTime: null }

  const patchFirst = (patch: Partial<GatheringOccurrence>) => {
    const next = [...value.occurrences]
    next[0] = { ...first, ...patch }
    onChange({ ...value, occurrences: next })
  }

  const patchAt = (index: number, patch: Partial<GatheringOccurrence>) => {
    onChange({
      ...value,
      occurrences: value.occurrences.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    })
  }

  /**
   * Turning "more than one day" off.
   *
   * IT KEEPS THE FIRST OCCASION AND DROPS THE REST, rather than clearing everything. Somebody
   * who ticks the box, adds two dates, and unticks it has changed their mind about the shape and
   * not about the date they started from — throwing that away would make the checkbox feel
   * destructive and make them type it again.
   */
  function setMultiDay(on: boolean) {
    if (on) {
      onChange({ ...value, isContinuous: true, occurrences: [{ ...first, endsOn: first.endsOn ?? '' }] })
    } else {
      onChange({ ...value, isContinuous: true, occurrences: [{ ...first, endsOn: null }] })
    }
  }

  /**
   * Switching between one block and several occasions.
   *
   * Continuous keeps ONE row (the rule `whenProblems` enforces) and separate keeps them all, so
   * going one way and back does not silently discard dates in between — the same reasoning as
   * `setMultiDay` above, one level down.
   */
  function setContinuous(on: boolean) {
    if (on) {
      onChange({ ...value, isContinuous: true, occurrences: [{ ...first, endsOn: first.endsOn ?? '' }] })
    } else {
      onChange({
        ...value,
        isContinuous: false,
        // The first occasion loses its end DATE: a separate-days series is a list of days, and
        // an occasion that itself spans two of them is a shape nothing on the calendar could
        // distinguish from the continuous case. Its TIMES are kept.
        occurrences: [{ ...first, endsOn: null }],
      })
    }
  }

  function addOccurrence() {
    onChange({
      ...value,
      occurrences: [
        ...value.occurrences,
        { startsOn: '', startTime: null, endsOn: null, endTime: null },
      ],
    })
  }

  function removeOccurrence(index: number) {
    // NEVER BELOW ONE. A gathering with no date is not a gathering, and the action refuses it —
    // so the last row's remove button is absent rather than refused.
    if (value.occurrences.length <= 1) return
    onChange({
      ...value,
      occurrences: value.occurrences.filter((_, i) => i !== index),
    })
  }

  return (
    <fieldset className="space-y-3">
      {/* A `<fieldset>`/`<legend>`, not a `Label`: this group is several controls and a
          `<label>` may name only one of them. */}
      <legend className="text-sm font-medium">When</legend>

      {/* ── THE SHAPE, ASKED FIRST ────────────────────────────────────────────────
          Before the dates, because it decides which boxes are on the screen — a checkbox
          underneath the fields it changes makes the form rearrange itself under the cursor. */}
      <label className="flex cursor-pointer items-start gap-2 select-none">
        <input
          type="checkbox"
          checked={multiDay}
          disabled={disabled}
          onChange={e => setMultiDay(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
        />
        <span className="text-sm">{t('gath.runsOverMoreThan')}</span>
      </label>

      {multiDay && (
        <div className="space-y-2 rounded-xl border p-3">
          {/* RADIOS, not a second checkbox: the two are exclusive and each needs a sentence of
              its own to be choosable at all. Somebody who has never thought about the
              distinction cannot pick from two bare words. */}
          <ShapeChoice
            name={`${idPrefix}-shape`}
            checked={value.isContinuous}
            disabled={disabled}
            onSelect={() => setContinuous(true)}
            label="One continuous block"
            hint="A reunion running Friday evening to Sunday lunchtime. It draws as one bar across those days on the calendar."
          />
          <ShapeChoice
            name={`${idPrefix}-shape`}
            checked={!value.isContinuous}
            disabled={disabled}
            onSelect={() => setContinuous(false)}
            label="Separate days, same gathering"
            hint="A committee meeting on three Saturdays. Each day draws as its own entry, all carrying this gathering's title."
          />
        </div>
      )}

      {/* ── ONE BLOCK: STARTS AND ENDS ────────────────────────────────────────────
          The single-day case is this one with `multiDay` false, which is why there is no third
          branch: an end DATE box that appears and disappears is the only difference, and the
          end TIME is asked either way. A picnic on one afternoon has an end time and no end
          date, which two date boxes could never say. */}
      {value.isContinuous ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-starts`} required>Starts</Label>
              <Input
                id={`${idPrefix}-starts`}
                type="date"
                value={first.startsOn}
                disabled={disabled}
                onChange={e => patchFirst({ startsOn: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-start-time`}>{t('gath.startTime')}</Label>
              <Input
                id={`${idPrefix}-start-time`}
                type="time"
                value={first.startTime ?? ''}
                disabled={disabled}
                onChange={e => patchFirst({
                  startTime: e.target.value || null,
                  // CLEARING THE START CLEARS THE END. "Ends at 4pm" with no start is half an
                  // answer, and the database refuses the pair — so the form cannot produce it
                  // rather than being told off for it.
                  ...(e.target.value ? {} : { endTime: null }),
                })}
              />
              <p className="text-xs text-muted-foreground">{t('gath.optional')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {multiDay && (
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-ends`}>Ends</Label>
                <Input
                  id={`${idPrefix}-ends`}
                  type="date"
                  min={first.startsOn || undefined}
                  value={first.endsOn ?? ''}
                  disabled={disabled}
                  onChange={e => patchFirst({ endsOn: e.target.value || null })}
                />
                <p className="text-xs text-muted-foreground">{t('gath.leaveEmptyIfAll')}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-end-time`}>{t('gath.endTime')}</Label>
              <Input
                id={`${idPrefix}-end-time`}
                type="time"
                value={first.endTime ?? ''}
                disabled={disabled || !first.startTime}
                onChange={e => patchFirst({ endTime: e.target.value || null })}
              />
              <p className="text-xs text-muted-foreground">
                {first.startTime ? 'Optional.' : 'Give a start time first.'}
              </p>
            </div>
          </div>

          <ZoneRow value={value} onChange={onChange} idPrefix={idPrefix} disabled={disabled} />

          <FieldError message={problemAt(0) ? WHEN_PROBLEM_TEXT[problemAt(0)!] : ''} />
        </div>
      ) : (
        /* ── SEPARATE DAYS ───────────────────────────────────────────────────────
           One row per occasion, in the order they were entered — NOT sorted. A family adding a
           forgotten Saturday to the middle of a series should not have the list resequence
           itself under the cursor; `position` on the table carries that order, and the
           one-line summary is the only thing that sorts (see `formatWhen`). */
        <div className="space-y-2">
          {value.occurrences.map((o, index) => (
            <div key={index} className="space-y-1.5 rounded-xl border p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[9rem] flex-1 space-y-1.5">
                  <Label htmlFor={`${idPrefix}-day-${index}`} required>
                    {index === 0 ? 'First day' : `Day ${index + 1}`}
                  </Label>
                  <Input
                    id={`${idPrefix}-day-${index}`}
                    type="date"
                    value={o.startsOn}
                    disabled={disabled}
                    onChange={e => patchAt(index, { startsOn: e.target.value })}
                  />
                </div>
                <div className="w-28 space-y-1.5">
                  <Label htmlFor={`${idPrefix}-day-${index}-from`}>From</Label>
                  <Input
                    id={`${idPrefix}-day-${index}-from`}
                    type="time"
                    value={o.startTime ?? ''}
                    disabled={disabled}
                    onChange={e => patchAt(index, {
                      startTime: e.target.value || null,
                      ...(e.target.value ? {} : { endTime: null }),
                    })}
                  />
                </div>
                <div className="w-28 space-y-1.5">
                  <Label htmlFor={`${idPrefix}-day-${index}-to`}>To</Label>
                  <Input
                    id={`${idPrefix}-day-${index}-to`}
                    type="time"
                    value={o.endTime ?? ''}
                    disabled={disabled || !o.startTime}
                    onChange={e => patchAt(index, { endTime: e.target.value || null })}
                  />
                </div>
                {/* ABSENT ON THE LAST ROW rather than disabled: a gathering with no date is not
                    a gathering, so there is nothing for the control to do and a greyed-out bin
                    is something somebody keeps pressing. */}
                {value.occurrences.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    aria-label={`Remove day ${index + 1}`}
                    onClick={() => removeOccurrence(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <FieldError
                message={problemAt(index) ? WHEN_PROBLEM_TEXT[problemAt(index)!] : ''}
              />
            </div>
          ))}

          <Button variant="outline" size="sm" disabled={disabled} onClick={addOccurrence}>
            <Plus className="h-3.5 w-3.5" />{t('gath.addAnotherDay')}</Button>
          <p className="text-xs text-muted-foreground">
            Every day here is its own entry on the calendar, all named{' '}
            <span className="italic">this</span> gathering.
          </p>
        </div>
      )}

      {/* THE PROBLEMS THAT BELONG TO NO ROW — an empty list, or a continuous gathering somehow
          carrying several occasions. Both are states the controls above cannot reach, and both
          are worth reporting rather than being silently corrected: the action refuses them too,
          and a form that quietly rewrites what somebody entered is worse than one that says
          what is wrong with it. */}
      {problems.filter(p => !('index' in p)).map(p => (
        <FieldError key={p.code} message={WHEN_PROBLEM_TEXT[p.code]} />
      ))}
    </fieldset>
  )
}

/** One of the two shape choices — a radio, its name, and the sentence that makes it choosable. */
function ShapeChoice({ name, checked, disabled, onSelect, label, hint }: {
  name: string
  checked: boolean
  disabled?: boolean
  onSelect: () => void
  label: string
  hint: string
}) {
  return (
    <label className={cn(
      'flex cursor-pointer items-start gap-2 rounded-lg p-2 select-none transition-colors',
      checked ? 'bg-brand-soft/60' : 'hover:bg-muted/50',
    )}>
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 accent-primary"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  )
}

/**
 * WHICH TIMEZONE THE TIMES ABOVE ARE IN.
 *
 * ── IT APPEARS ONLY ONCE A TIME HAS BEEN GIVEN ──────────────────────────────────────
 * A date-only gathering has nothing for a zone to qualify — "the reunion is on 4 July" is a
 * complete answer — and `normaliseWhen` clears the field in that case, so showing the control
 * would be offering a choice the server discards. It is not DISABLED but absent: a greyed-out
 * timezone box next to two empty time boxes reads as something being wrong.
 *
 * ── THE LABEL SAYS WHAT IT DOES, WHICH IS THE OPPOSITE OF WHAT PEOPLE EXPECT ────────
 * Every relative sees the time as it is typed here, WITH this zone named beside it. Nothing is
 * converted for anybody — that is `20260826000001`'s rule and `20260826000003` only qualifies
 * it — so the hint has to say so, or a member will reasonably assume a cousin in London is
 * being shown 5pm for their 11am and will enter 11am meaning something else.
 *
 * ── THE LIST IS `TIMEZONES` FROM `date-utils`, WHICH IS THE SAME ONE MY PROFILE USES ─
 * One list, so the zone a member picked for themselves is offered here too and the two screens
 * cannot drift into different vocabularies. A zone stored on a gathering from outside that list
 * still renders — `zoneAbbrev` and `formatInstant` take any IANA name — so the list is a
 * convenience rather than a constraint, which is why the CHECK on this column does not exist.
 */
function ZoneRow({ value, onChange, idPrefix, disabled }: {
  value: GatheringWhen
  onChange: (next: GatheringWhen) => void
  idPrefix: string
  disabled?: boolean
}) {
  const t = useT()
  const anyTimed = value.occurrences.some(o => o.startTime)
  if (!anyTimed) return null

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${idPrefix}-zone`} required>Timezone</Label>
      <Select
        id={`${idPrefix}-zone`}
        value={value.timeZone ?? ''}
        disabled={disabled}
        onChange={e => onChange({ ...value, timeZone: e.target.value || null })}
      >
        <option value="">{t('gath.chooseTimezone')}</option>
        {TIMEZONES.map(tz => (
          <option key={tz} value={tz}>{TIMEZONE_LABELS[tz] ?? tz}</option>
        ))}
      </Select>
      <p className="text-xs text-muted-foreground">{t('gath.everyoneSeesTimeExactly')}</p>
    </div>
  )
}

/**
 * A fresh, empty `when` — one continuous occasion with nothing filled in.
 *
 * `zone` DEFAULTS THE TIMEZONE RATHER THAN LEAVING IT BLANK, and the caller passes the author's
 * own. A required field that starts empty is a field somebody stares at; a member scheduling a
 * picnic in the town they live in should not have to state which zone they are in. It stays a
 * DEFAULT and decides nothing on the server — `scheduleGathering` validates whatever it is sent
 * either way, because the form in front of it is a convenience (§2).
 *
 * It is only ever CONSULTED when a time is given: `normaliseWhen` clears it otherwise, so a
 * date-only gathering does not carry a zone qualifying nothing.
 */
export function emptyWhen(zone: string): GatheringWhen {
  return {
    timeZone: zone,
    isContinuous: true,
    occurrences: [{ startsOn: '', startTime: null, endsOn: null, endTime: null }],
  }
}
