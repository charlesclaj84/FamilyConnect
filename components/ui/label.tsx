"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useT } from "@/components/layout/LocaleProvider"

/**
 * The "this field is required" marker, in one place.
 *
 * WHAT IT REPLACED, AND WHY IT LOOKED WRONG. Forty call sites wrote
 * `<span className="text-destructive">*</span>` by hand, and the result was out of place
 * for three reasons that compounded:
 *
 *   * **It was full size.** A marker set at the same size as the label it annotates does
 *     not read as an annotation; it reads as part of the name of the field.
 *   * **It was `--destructive`.** That token means an error — a failed save, a delete
 *     button, a validation message. A field that has not been filled in yet is not in an
 *     error state, so the one colour in the app reserved for "something has gone wrong"
 *     was on screen from the moment a form opened. `--brand-accent` is the foreground
 *     accent role, which is what this is.
 *   * **It sat eight pixels away from the label.** `Label` is a `flex` row with `gap-2`,
 *     so a bare `<span>` beside the text became a second flex ITEM and took the gap with
 *     it — "First Name        *". This is the part no amount of recolouring would have
 *     fixed, and it is why the mark now renders inside a wrapper (see `Label` below)
 *     rather than as a sibling of the text.
 *
 * IT IS ALSO NOT ANNOUNCED AS "STAR" ANY MORE. The glyph is `aria-hidden` and carries an
 * `sr-only` "(required)" beside it, so a screen reader reads the field's purpose instead
 * of punctuation. Note this is a LABEL, not a constraint: it does not set `required` on
 * the control, because every form here validates on submit and shows its own message —
 * the native bubble would be a second, differently-worded refusal.
 */
function RequiredMark({ className }: { className?: string }) {
  const t = useT()
  return (
    <>
      <span
        aria-hidden="true"
        className={cn("ms-0.5 align-top text-[0.7em] leading-none text-brand-accent", className)}
      >
        *
      </span>
      <span className="sr-only">{t('field.required')}</span>
    </>
  )
}

interface LabelProps extends React.ComponentProps<"label"> {
  /** Append the required marker. See `RequiredMark` for what it is and what it is not. */
  required?: boolean
}

function Label({ className, required, children, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {/* ONE FLEX ITEM, NOT TWO. This element is `display: flex` with `gap-2`, which is
          right for the labels that genuinely hold two things — a caption and a muted
          parenthetical — and wrong for a marker that belongs against the last letter of
          the word. Wrapping the pair puts the mark in an inline context where `ms-0.5`
          is the whole distance between them. Only when `required`, so a label with real
          sibling children keeps the gap it was written for. */}
      {required ? <span>{children}<RequiredMark /></span> : children}
    </label>
  )
}

export { Label, RequiredMark }
