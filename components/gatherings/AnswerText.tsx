import { formatCurrency } from '@/lib/currency-utils'
import { describeAnswer, type GatheringTaskKind } from '@/lib/gatherings'

/**
 * One line of an answer, as the member gave it.
 *
 * ── WHY THIS IS A COMPONENT AND NOT A CALL TO `describeAnswer` ──────────────────────
 * `describeAnswer` needs a money formatter passed in — deliberately, so `lib/gatherings.ts`
 * never has to choose between `formatCurrency` and the whole-dollar variant `/pricing` uses —
 * and four screens render an answer (`/gatherings/[id]`, `/gatherings/my-tasks`,
 * `/admin/gatherings`, `/admin/gatherings/[id]`). Four call sites each passing their own
 * formatter is four chances for one of them to print `$1,204.995`, and four chances for one to
 * decide differently what an absent answer looks like. Both decisions are made once here.
 *
 * ── `''` RENDERS `null`, WHICH IS THE WHOLE OF THE ABSENCE POLICY ───────────────────
 * `describeAnswer` returns an empty string for an answer that is missing, malformed, or of the
 * wrong shape for its kind — it does not invent a dash, because the SCREEN is what knows
 * whether absence should read as "—" (a table cell, which has to hold the grid open) or as
 * nothing at all (a meta line, where a value we do not have is simply not a line). So this
 * returns `null` and the caller supplies its own placeholder:
 *
 *     <AnswerText kind={task.kind} answer={task.answer} /> ?? '—'   // NO: JSX, not a string
 *     {answered ? <AnswerText … /> : <span className="text-muted-foreground">—</span>}
 *
 * ── IT CARRIES NO STYLING AND TAKES NO `className` ──────────────────────────────────
 * A `<span>` and nothing else, so it inherits whatever it is dropped into — a table cell, a
 * meta line, the body of a submission card. `break-words` is the one class it does set, because
 * a `long_text` answer or a `list` of eight items is genuinely long and a table cell with no
 * wrapping opportunity pushes the whole row wide, which is the thing "On a phone a table
 * narrows" exists to prevent.
 */
export function AnswerText({ kind, answer }: { kind: GatheringTaskKind; answer: unknown }) {
  const text = describeAnswer(kind, answer, formatCurrency)
  if (!text) return null
  return <span className="break-words">{text}</span>
}
