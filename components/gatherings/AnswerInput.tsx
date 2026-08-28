'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { dollarsToCents } from '@/lib/currency-utils'
import { parseAnswer, type GatheringTaskKind } from '@/lib/gatherings'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * The control an assignee answers ONE gathering task with, and the two conversions either
 * side of it.
 *
 * ── WHY THE DRAFT IS ALWAYS A STRING ────────────────────────────────────────────────
 * Seven step kinds, one draft type. Every control below is an `<input>` or a `<textarea>`,
 * so what the DOM hands back is a string in every case — and holding a union of
 * `string | number | boolean | string[]` in the caller's state would mean the caller has to
 * know which kind it is holding before it can render, clear or compare it. It does not: it
 * holds a string, hands it to `answerFromDraft`, and the one place that knows what a `money`
 * field means is this file.
 *
 * `list` is the case that proves it. A textarea posts one string with newlines and
 * `parseAnswer('list', …)` splits it and drops the blanks itself, so the "array" never has
 * to exist on the client at all.
 *
 * ── WHY THE CONVERSIONS LIVE BESIDE THE CONTROL AND NOT IN `lib/` ───────────────────
 * `answerFromDraft` is the exact inverse of what these controls DRAW, which makes it part of
 * the control rather than part of the vocabulary: a money field showing dollars is a decision
 * this component makes (nobody types 45000 for $450), and the conversion back to integer
 * cents is that decision's other half. Put it in `lib/gatherings.ts` and the two halves can
 * be changed independently, which is how a form comes to post dollars into a `*_cents`
 * column.
 *
 * What is NOT duplicated here is the RULE. `parseAnswer` decides what a well-formed answer
 * is, on the server and on the client, and `draftFromAnswer` reads a stored answer back out
 * through it rather than pattern-matching the JSONB itself. `isCompleteAnswer` — which the
 * caller uses for its "have you answered this" check — is defined as `parseAnswer(…) !== null`
 * in that module, so the form and the action cannot disagree about whether a submission is
 * usable. That mattered enough to be said twice in the spec: a member who fills a field in
 * and is then told the answer is unusable has no way to see why.
 *
 * ── MONEY IS THE ONE CONVERSION THAT CAN BE WRONG BY A FACTOR OF A HUNDRED ──────────
 * `parseAnswer('money', 12.34)` is `null` ON PURPOSE — 12.34 could be $12.34 or 12.34 cents
 * and nothing in the value says which. So the field is a DOLLAR string and `answerFromDraft`
 * converts once with `dollarsToCents` before the action is ever called. Posting the raw field
 * would fail every money submission with "that is not a usable answer", which is the failure
 * this comment exists to stop somebody reintroducing by simplifying the money branch away.
 *
 * The empty string is the trap inside the trap: `dollarsToCents('')` is `0`, and `{ cents: 0 }`
 * is a perfectly well-formed answer, so a blank money field would submit $0.00 and read as
 * answered on every screen afterwards. The branch below refuses a blank and a non-numeric
 * string BEFORE the conversion, so "nothing typed" stays "nothing typed".
 */

/**
 * What a stored answer looks like in the field — the inverse of `answerFromDraft`.
 *
 * Read back through `parseAnswer` rather than by reaching into the JSONB, so an answer this
 * build cannot make sense of seeds an EMPTY field rather than the string `[object Object]`.
 * `parseAnswer` is idempotent on its own output, which is what makes that safe.
 */
export function draftFromAnswer(kind: GatheringTaskKind, answer: unknown): string {
  const parsed = parseAnswer(kind, answer)
  if (!parsed) return ''
  if ('text' in parsed) return parsed.text
  if ('date' in parsed) return parsed.date
  // One per line, which is exactly what the textarea posts back and what `parseAnswer`
  // splits on. A comma-joined draft would silently merge two items the moment somebody
  // wrote a comma inside one — `describeAnswer` joins with commas for a one-line SUMMARY,
  // which is a different job.
  if ('items' in parsed) return parsed.items.join('\n')
  // The literal words the radio pair posts. See the radio branch below for why there is no
  // truthiness anywhere near this.
  if ('yes' in parsed) return parsed.yes ? 'yes' : 'no'
  // Cents back to a dollar string with both decimal places, so the field re-opens showing
  // "450.00" rather than "450" and an untouched edit converts back to the same integer.
  if ('cents' in parsed) return (parsed.cents / 100).toFixed(2)
  return String(parsed.number)
}

/**
 * What the field posts to `submitGatheringTask` — see the header.
 *
 * Every kind but `money` hands the string straight through, because `parseAnswer` already
 * accepts the loose form shape for each of them (a numeric string, a `YYYY-MM-DD` string, a
 * newline-separated list, one of the four yes/no words). A conversion here for those would be
 * a second normaliser standing in front of the only one.
 */
export function answerFromDraft(kind: GatheringTaskKind, draft: string): unknown {
  if (kind !== 'money') return draft

  const trimmed = draft.trim()
  // Not `dollarsToCents(trimmed)`: it answers 0 for both the empty string and "abc", and
  // `{ cents: 0 }` is a well-formed answer. A blank field must stay unanswered.
  if (trimmed.length === 0) return null
  const dollars = Number(trimmed)
  if (!Number.isFinite(dollars)) return null
  // Rounds to the cent, which is `dollarsToCents`'s stated behaviour and the right one here:
  // the column is integer cents and "12.345" is a typo, not a third of a cent.
  return dollarsToCents(dollars)
}

export interface AnswerInputProps {
  kind: GatheringTaskKind
  /** The draft, always a string — see the header. */
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  /**
   * The id the caller's `<Label htmlFor>` points at. On the yes/no pair it lands on the
   * **Yes** radio, which is a labelable control, so the visible label still names something
   * real rather than a `<div>`.
   */
  fieldId: string
  /**
   * The radios' shared `name`, and it must be unique on the page: two hand-rolled radio
   * groups sharing a `name` are ONE group, so choosing in the second silently clears the
   * first — which on this screen means answering one task un-answers another. The caller
   * derives it from the task id.
   */
  groupName: string
  /**
   * What this field is FOR, for a screen reader, and it reaches EVERY branch.
   *
   * The only caller's visible `<Label>` says the literal words "Your answer" — the task's own
   * name is an `<h3>` above the card and its help text a `<p>`, neither associated with the
   * control — so the accessible name a member hears on a bare `<Input>` here is "Your answer"
   * and nothing else. That is useless on a screen holding a dozen of them, so every branch
   * below sets `aria-label` from this rather than only the radiogroup, and the caller passes
   * the task label in it.
   *
   * `aria-label` OVERRIDES the `<Label htmlFor>` rather than adding to it, which is fine only
   * because this string BEGINS with the visible words: WCAG 2.5.3 asks that the accessible
   * name contain the visible label, so a speech-input user saying "Your answer" still hits it.
   * Keep that property if the caller's wording changes.
   */
  ariaLabel: string
}

/** Money, a count and a date do not want the whole width of a card. */
const NARROW = 'sm:max-w-48'

export function AnswerInput({
  kind, value, onChange, disabled, fieldId, groupName, ariaLabel,
}: AnswerInputProps) {
  const t = useT()
  switch (kind) {
    case 'yes_no':
      return (
        // A real pair of native radios sharing one `name`, which is what gives arrow-key
        // navigation and single-selection for free. `role="radiogroup"` on the wrapper is
        // claimed deliberately, and it is the one ARIA role anything here claims: unlike
        // `role="tablist"` or `role="combobox"` — which promise key handling nothing in this
        // codebase implements — a group of same-named radios genuinely behaves the way the
        // role says it does.
        <div role="radiogroup" aria-label={ariaLabel} className="flex items-center gap-4">
          {([['yes', 'Yes'], ['no', 'No']] as const).map(([token, caption], index) => (
            <label key={token} className="flex cursor-pointer items-center gap-2 select-none">
              <input
                type="radio"
                // The literal words `parseAnswer` accepts. NEVER a boolean coerced out of a
                // checkbox: `Boolean('')` is `false`, so a coercing control would record
                // "No" for a member who answered nothing at all — the one wrong answer that
                // looks exactly like a real one on every screen afterwards.
                value={token}
                name={groupName}
                id={index === 0 ? fieldId : undefined}
                checked={value === token}
                disabled={disabled}
                onChange={() => onChange(token)}
                className="h-4 w-4 border-input accent-primary"
              />
              <span className="text-sm font-medium">{caption}</span>
            </label>
          ))}
        </div>
      )

    case 'money':
      return (
        <div className={cn('flex items-center gap-1.5', NARROW)}>
          {/* The dollar sign is chrome, not content: the field holds "450.00" and
              `answerFromDraft` turns that into 45000 cents. It is `aria-hidden` because the
              UNIT IS IN THE FIELD'S OWN NAME instead — see below. It was `aria-hidden` on the
              claim that "the label above already says the field is an amount", and the only
              caller's label says "Your answer", so the one unit indicator on the screen was
              being removed from the accessibility tree and nothing replaced it. On the branch
              where the control draws DOLLARS and the column stores CENTS, that is the field
              where the unit matters most. */}
          <span aria-hidden="true" className="text-sm text-muted-foreground">$</span>
          <Input
            id={fieldId}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            // ", in dollars" rather than describing the `$` by `aria-describedby`: a name is
            // announced on focus and a description is not always, and this is the same shape
            // `AdminGatheringTemplatesClient` already uses for its suggested-budget box.
            aria-label={`${ariaLabel}, in dollars`}
            value={value}
            disabled={disabled}
            onChange={e => onChange(e.target.value)}
          />
        </div>
      )

    case 'number':
      return (
        <Input
          id={fieldId}
          type="number"
          inputMode="decimal"
          aria-label={ariaLabel}
          // No `min` and no `step`: a fraction is legal for this kind and only this kind —
          // "how many pounds of brisket" is a real step and 12.5 is a real answer. Money is
          // the `money` kind, in cents.
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          className={NARROW}
        />
      )

    case 'date':
      return (
        <Input
          id={fieldId}
          type="date"
          aria-label={ariaLabel}
          // A bare `YYYY-MM-DD` string, straight to `parseAnswer`, which round-trips it
          // through `Date.UTC` to check it is a real calendar date. No `new Date(value)`
          // anywhere near it: that is UTC midnight and reads as the day before in any
          // negative offset.
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          className={NARROW}
        />
      )

    case 'list':
      return (
        <Textarea
          id={fieldId}
          autoGrow
          rows={2}
          // The list's shape is part of what this field IS, so it is in the name as well as in
          // the placeholder — a placeholder is not an accessible name and disappears on typing.
          aria-label={`${ariaLabel}, one item per line`}
          // Said in the placeholder because the shape of the answer is the whole instruction
          // here, and `GATHERING_STEP_KIND_HINT` is written for the person AUTHORING the
          // template rather than for the assignee.
          placeholder={t('tasks.onePerLine')}
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
        />
      )

    case 'long_text':
      return (
        <Textarea
          id={fieldId}
          autoGrow
          rows={1}
          aria-label={ariaLabel}
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
        />
      )

    case 'location':
      return (
        // A PLACE, AND ITS OWN BRANCH RATHER THAN A FALL-THROUGH TO `text`. It stores the
        // same `{ text }` shape, so the difference is entirely in the field: a placeholder
        // that says what a place looks like, and `autoComplete="street-address"`, which is
        // what lets a phone offer the addresses it already knows. Neither belongs on a
        // short-answer box asking for a caterer's phone number.
        //
        // Full width, unlike a date or an amount: an address is long, and `NARROW` would put
        // "Zilker Park, 2100 Barton Springs Rd" behind a horizontal scroll on a phone.
        <Input
          id={fieldId}
          aria-label={ariaLabel}
          autoComplete="street-address"
          placeholder={t('tasks.wherePh')}
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
        />
      )

    case 'text':
      return (
        <Input
          id={fieldId}
          aria-label={ariaLabel}
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
        />
      )
  }
}
