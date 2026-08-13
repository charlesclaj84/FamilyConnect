import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The two ways this app tells somebody something is wrong with what they typed.
 *
 * ── WHY THIS IS A COMPONENT AND NOT A CLASS STRING ───────────────────────────────────
 *
 * There were four treatments in the tree for one job, and nobody had chosen any of them:
 *
 *   `text-sm text-destructive`                                    38 sites — bare red text
 *   `text-xs text-destructive`                                    14 sites — bare, smaller
 *   `rounded-md bg-destructive/10 px-3 py-2 text-sm …`            12 sites — a tinted box
 *   `rounded-xl bg-destructive/10 px-4 py-3 text-sm …`             1 site  — the same box,
 *                                                                            different metrics
 *
 * So the same failure looked like a footnote on one screen and an alert on the next, and
 * the bare-text version — the majority — is the one that reads as out of place: a line of
 * flat red with no ground under it, no icon, and nothing separating it from the label
 * above it. It has the visual weight of a caption and the meaning of a stop sign.
 *
 * This is the same failure mode, and the same fix, as the required-field asterisk in
 * `components/ui/label.tsx`: a small piece of styling repeated by hand at forty call
 * sites drifts, and the drift is invisible until you put two screens side by side.
 *
 * ── THE TWO ROLES ARE DIFFERENT AND MUST STAY DIFFERENT ──────────────────────────────
 *
 * `FormError` is about the OPERATION — a save that was refused, a server action that
 * came back unsuccessful, a sign-in that failed. It is one per form, it appears next to
 * the button that caused it, and it gets the full alert treatment: a tinted ground, a
 * hairline, and an icon. It has to survive being the only new thing on a screen that
 * otherwise did not change.
 *
 * `FieldError` is about ONE INPUT, and it sits directly under it. It is deliberately
 * quieter — no ground, no border, a smaller icon — because the field it belongs to is
 * already identified by position, and a tinted box under every one of RegisterForm's
 * seven fields would turn a form with two mistakes in it into a wall of red.
 *
 * Neither renders anything for an empty message, so a call site is
 * `<FormError message={error} />` rather than `{error && <FormError … />}` — which is
 * also what stops the `''` initial state of every `useState('')` in this codebase from
 * painting an empty box.
 *
 * ── `role="alert"` ───────────────────────────────────────────────────────────────────
 *
 * On both, because both appear in response to something the person just did and neither
 * moves focus. Without it a screen-reader user submits a form, hears nothing, and is
 * left on a page that looks to them exactly as it did before. It is an assertive live
 * region, which is right for a refusal and would be wrong for anything routine — do not
 * reach for these two components to render an ordinary hint.
 *
 * THE ICON IS `aria-hidden`. It repeats what the text and the role already say, and an
 * unlabelled decorative glyph announced as "alert circle" in front of every message is
 * noise, not information.
 */

interface MessageProps {
  /** Nothing renders when this is empty, null or undefined. */
  message?: string | null
  className?: string
}

/** A refused operation: one per form, beside the control that triggered it. */
function FormError({ message, className }: MessageProps) {
  if (!message) return null
  return (
    <p
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive',
        className,
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{message}</span>
    </p>
  )
}

/** One input's validation message, directly under it. */
function FieldError({ message, className }: MessageProps) {
  if (!message) return null
  return (
    <p
      role="alert"
      className={cn('flex items-start gap-1.5 text-xs font-medium text-destructive', className)}
    >
      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{message}</span>
    </p>
  )
}

export { FormError, FieldError }
