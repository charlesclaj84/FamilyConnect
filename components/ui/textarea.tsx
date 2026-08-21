"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TextareaProps extends React.ComponentProps<"textarea"> {
  /**
   * Grow to fit the text as it wraps, instead of scrolling inside a fixed box.
   *
   * ── IT IS THE DEFAULT NOW, AND THE OLD ARGUMENT AGAINST IT WAS SOLVABLE ──────────
   * This defaulted to `false` and said: "A textarea in a grid of fields is often sized
   * deliberately — `rows={2}` next to two single-line inputs is a layout decision — and
   * a box that silently changes height as somebody types would move every control below
   * it. Opting in keeps the choice at the call site."
   *
   * Half of that was right and it pointed at the wrong remedy. The layout decision worth
   * protecting is the box's MINIMUM height, which is what `rows` was always saying — and
   * `fitToContent` now floors on it, so a `rows={4}` description box opens at four rows
   * whether it is empty or not. What the old default protected was the box's MAXIMUM, and
   * nobody wanted that: a member typing a paragraph into a two-row window scrolls inside
   * a 40px viewport while a screen full of empty space sits underneath.
   *
   * "Controls below it move" is true and is the point. They move DOWN, once, as the text
   * needs the room — which is what every messaging app on the member's phone does. The
   * failure it was guarding against is a box that grows without limit and pushes a Save
   * button off-screen, and that is `maxRows`' job, not the default's.
   *
   * Pass `autoGrow={false}` for a box that genuinely must not change size. Nothing in the
   * tree does today.
   */
  autoGrow?: boolean
  /**
   * The cap on `autoGrow`, in rows. Past it the box stops growing and scrolls, so a
   * pasted essay cannot push a dialog's Save button off the bottom of a phone — the
   * same failure `components/ui/dialog.tsx` caps its own height to avoid.
   */
  maxRows?: number
}

/**
 * THE AUTO-GROW MEASUREMENT, and the two things that make it correct.
 *
 * `scrollHeight` is the content height INCLUDING padding but excluding the border, and
 * it only ever reports the content's full extent when the element is not already
 * constrained — so the height has to be reset to `auto` before it is read, or the box
 * can grow and never shrink back when text is deleted.
 *
 * The cap is computed from the element's own resolved `line-height` rather than from a
 * hard-coded pixel figure, because this input is `text-base` below `md` and `text-sm`
 * above it: a fixed cap would be a different number of visible rows on a phone than on
 * a laptop. `line-height: normal` resolves to the string rather than a length in some
 * engines, hence the fallback.
 */
function fitToContent(el: HTMLTextAreaElement, maxRows: number, minRows: number) {
  el.style.height = 'auto'
  const styles = window.getComputedStyle(el)
  const lineHeight = parseFloat(styles.lineHeight) || parseFloat(styles.fontSize) * 1.5 || 20
  const frame =
    parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom) +
    parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth)
  const cap = lineHeight * maxRows + frame
  // THE FLOOR IS WHAT MADE THE DEFAULT SAFE TO FLIP. `scrollHeight` on an empty box is one
  // row, so without this every `rows={4}` field in the app would have opened one line tall
  // and grown from there — which is not "auto-grow", it is throwing away the layout the call
  // site asked for. Computed from the same line-height as the cap, so a field is the same
  // number of VISIBLE rows on a phone (`text-base`) as on a laptop (`text-sm`).
  const floor = lineHeight * minRows + frame
  el.style.height = `${Math.min(Math.max(el.scrollHeight, floor), cap)}px`
  // Only scroll once it has stopped growing. A permanent `overflow-y: auto` reserves a
  // scrollbar gutter in some engines, which makes the wrap point disagree with the
  // measurement above by the width of the gutter.
  el.style.overflowY = el.scrollHeight > cap ? 'auto' : 'hidden'
  // Nothing sets `overflowY` back to a stylesheet value, and it must not: the element is
  // `resize-none`, so this property is entirely ours to own.
}

function Textarea({
  className, autoGrow = true, maxRows = 8, ref, onInput, ...props
}: TextareaProps) {
  const inner = React.useRef<HTMLTextAreaElement | null>(null)

  // `rows` IS the minimum, which is what it already meant at every call site — a
  // deliberately short box says `rows={2}` and a description box says `rows={4}`. Two when
  // it is unset, because one row reads as a single-line input and invites the wrong answer.
  // `Number(...)` because `rows` is typed `number` but arrives from JSX, where a string is
  // a valid thing for a caller to have written.
  const minRows = Math.max(1, Number(props.rows) || 2)

  const attachRef = React.useCallback((node: HTMLTextAreaElement | null) => {
    inner.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }, [ref])

  // Layout effect, not an effect: this runs BEFORE paint, so a value arriving from the
  // server (an existing note being edited) is never shown one frame at one row and the
  // next at four. `props.value` is in the dependency list so a controlled box re-fits
  // when its parent changes the text — a reset after submit, or an optimistic edit —
  // which no `onInput` handler would ever hear about.
  React.useLayoutEffect(() => {
    if (autoGrow && inner.current) fitToContent(inner.current, maxRows, minRows)
  }, [autoGrow, maxRows, minRows, props.value])

  return (
    <textarea
      data-slot="textarea"
      ref={attachRef}
      // `onInput` rather than `onChange`, so an uncontrolled box and a paste both fit
      // immediately. A controlled one is covered twice over, which is harmless — the
      // measurement is idempotent.
      onInput={e => {
        if (autoGrow) fitToContent(e.currentTarget, maxRows, minRows)
        onInput?.(e)
      }}
      className={cn(
        "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
