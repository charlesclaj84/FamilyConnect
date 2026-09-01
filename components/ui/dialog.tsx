"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={onClose}
      />
      {/*
        THE HEIGHT CAP AND THE SCROLL LIVE HERE, not at the call site. Eight dialogs
        used to pass `max-h-[90vh] overflow-y-auto` themselves and they were wrong in
        the same two ways.

        `vh` is the LARGE viewport on a phone — the height the page would have with the
        address bar scrolled away — so on a browser currently showing its chrome, 90vh
        is taller than what you can see. A form's Record and Cancel buttons ended up
        underneath the URL bar with nothing indicating they were there. `dvh` is the
        viewport as it actually is at this moment, and it shrinks and grows as the
        chrome does.

        Scrolling the WHOLE panel took the title and the close button away with it, so
        a long form on a small screen had no visible way out but the scrim. The panel is
        a flex column now: the title bar is pinned, and only the body moves.
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className={cn(
          // `text-left` IS LOAD-BEARING, and it is not a default anybody chose for taste.
          //
          // This panel is `fixed`, which changes its CONTAINING BLOCK and not its place in
          // the DOM — so it goes on inheriting from whatever it was rendered inside. Both
          // staff delete dialogs are rendered from a `<td className="… text-right">`, and
          // `text-align` inherited straight through: the title, the destructive paragraph
          // and the field hints all came out right-aligned, while the labels did not,
          // because a flex container's items ignore `text-align` and mask it. Reported as
          // "the popup is right aligned", guessed at as a locale problem, and it was a table
          // cell three levels up.
          //
          // A panel that positions itself independently of its parent must not take its
          // typography from that parent. Asserting the alignment here fixes every caller at
          // once and cannot be undone by the next screen that opens a dialog from a cell.
          //
          // THE DEEPER FIX IS A PORTAL, which is what `RowMenu` already does and what
          // AGENTS.md endorses for the clipping version of this same problem — a `fixed`
          // panel inside an `overflow` ancestor. That would end inheritance of everything
          // rather than of one property, and it is a change to every dialog in the product;
          // TODO.md carries it.
          "relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-xl bg-card text-card-foreground text-start shadow-lg",
          // Underscores are Tailwind's escape for the spaces `calc()` requires around
          // a `-` — `calc(100dvh-2rem)` is not valid CSS and silently drops the rule.
          "max-h-[calc(100dvh_-_1.5rem)] sm:max-h-[calc(100dvh_-_2rem)]",
          className
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-5 pb-2 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <h2 id="dialog-title" className="text-lg font-semibold leading-snug">
              {title}
            </h2>
            {description && (
              <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="-me-1 shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* `min-h-0` is what makes the flex child actually shrink — without it a flex
            item's floor is its content height and the panel grows past its own cap
            instead of scrolling. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 pt-2 sm:px-6 sm:pb-6">
          {children}
        </div>
      </div>
    </div>
  )
}

export { Dialog }
