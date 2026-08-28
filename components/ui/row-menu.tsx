'use client'

import {
  useCallback, useEffect, useId, useRef, useState,
  type ComponentType, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'
import { useDismissWhenIdle } from '@/lib/use-dismiss-when-idle'
import { cn } from '@/lib/utils'

/**
 * The row overflow menu.
 *
 * Hand-rolled rather than pulled from a library because the project's ui/ primitives
 * are plain elements and one more dependency for a popover is not worth it. What it
 * still owes: closing on outside click and on Escape, and returning focus to the
 * trigger, or a keyboard user is stranded inside it.
 *
 * ── ONE OF THESE, NOT ONE PER TABLE ─────────────────────────────────────────────────
 * It lived inside `AdminAccessClient.tsx` until 2026-08-25, when the dues table wanted
 * one too. Copying it would have been the shape AGENTS.md warns about at
 * `lib/chapter-propagation.ts` — a correct implementation beside a second one that
 * drifts — and the drift here would not be cosmetic: everything below about portalling,
 * dismissal and the refused ARIA role is a decision that has to be made identically at
 * every call site or one of the menus is quietly broken for somebody.
 *
 * A DISCLOSURE, NOT AN ARIA MENU, deliberately. `role="menu"` is a promise about
 * keyboard behaviour — arrow keys move a roving focus between items, Home/End jump to
 * the ends, Tab leaves the whole widget — and a screen reader announces it as such and
 * changes its own key handling to match. This implements none of that, so claiming the
 * role would leave those users pressing arrow keys at something that does not respond.
 * As a plain expanding panel of buttons and links, Tab works, which is true of what is
 * actually here.
 *
 * THE PANEL IS PORTALLED TO document.body, and that is not decoration. The members table
 * scrolled horizontally inside its own container, and a container with `overflow-x: auto`
 * has `overflow-y: visible` computed to `auto` — so an absolutely positioned panel inside
 * it is clipped at the row, which is how this menu became unusable the moment the list
 * became a table. Rendering into the body with `position: fixed`, anchored to the
 * trigger's measured rect, takes it out of every ancestor's overflow.
 */
export function RowMenu({ label, disabled, className, children }: {
  label: string
  disabled?: boolean
  /** Sizing or spacing from the call site — the wrapper, never the panel. */
  className?: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  // Measured on open rather than tracked continuously: the panel closes on the first
  // scroll or resize (below), so a stale rect can never be shown.
  const [rect, setRect] = useState<{ top: number; right: number } | null>(null)
  const panelId = useId()
  const wrap = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  // Ref-free on purpose. `children` is a render prop, so anything handed to it is
  // traced into the render pass — a close() that read trigger.current would count as
  // dereferencing a ref during render. Returning focus to the trigger therefore lives
  // in the Escape handler below, inside an effect, where reading a ref is fine.
  const close = useCallback(() => setOpen(false), [])

  // Closes itself a few seconds after the pointer and focus have both left it — the same
  // hook the three header panels use, so every dropdown in the app goes on the same beat.
  // `parts` looks the portalled panel up by id for the reason the outside-click handler
  // below does: it is not inside `wrap`, so there is no single subtree to test.
  useDismissWhenIdle({
    open,
    close,
    parts: () => [wrap.current, document.getElementById(panelId)],
  })

  useEffect(() => {
    if (!open) return
    // The panel lives outside `wrap`, so an outside-click test against `wrap` alone
    // would treat every click INSIDE the panel as outside and close it before the button
    // fired. Both subtrees count as inside.
    function onPointer(e: MouseEvent) {
      const target = e.target as Node
      if (wrap.current?.contains(target)) return
      if (document.getElementById(panelId)?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    // A fixed panel does not travel with the page. Closing is the honest response to
    // either — cheaper than re-measuring on every frame, and it is what a menu whose
    // anchor has moved should do anyway. Capture, so a scroll inside a table's own
    // overflow container counts and not just one on the window.
    function onMove() { setOpen(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    document.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, panelId])

  function toggle() {
    if (open) { setOpen(false); return }
    const r = trigger.current?.getBoundingClientRect()
    // Right-aligned to the trigger, which is what the absolute version did with
    // `right-0`. Kept in viewport coordinates because the panel is position: fixed.
    if (r) setRect({ top: r.bottom + 4, right: window.innerWidth - r.right })
    setOpen(true)
  }

  const expanded: 'true' | 'false' = open ? 'true' : 'false'

  return (
    <div ref={wrap} className={cn('relative shrink-0', className)}>
      <button ref={trigger} type="button" disabled={disabled}
        onClick={toggle}
        aria-expanded={expanded} aria-controls={panelId} aria-label={label}
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40">
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && rect && createPortal(
        <div id={panelId} aria-label={label}
          style={{ top: rect.top, right: rect.right }}
          className="fixed z-50 w-64 overflow-hidden rounded-xl border bg-card py-1 shadow-lg">
          {children(close)}
        </div>,
        document.body,
      )}
    </div>
  )
}

/**
 * One item in a `RowMenu` panel.
 *
 * A plain `<button>` carrying the panel's own metrics, so two call sites cannot disagree
 * about the padding, the hover well or where the icon sits. `destructive` is the only
 * variant, and it is shadcn's alarm hue rather than `--brand-withheld` because the things
 * it marks really are deletions — see AGENTS.md, "Colours live in one place".
 */
export function RowMenuItem({ icon: Icon, destructive, disabled, onClick, children }: {
  icon?: ComponentType<{ className?: string }>
  destructive?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
        'hover:bg-brand-soft disabled:opacity-40 disabled:hover:bg-transparent',
        destructive && 'text-destructive',
      )}>
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </button>
  )
}

/**
 * A caption over a group of items, for a panel holding more than one kind of thing.
 *
 * Presentational only — it is NOT `aria-labelledby`-wired to a group, because this is a
 * disclosure rather than a menu (see above) and inventing grouping semantics on top of a
 * refused role is the same over-claim in miniature.
 */
export function RowMenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  )
}

/** A plain sentence inside a panel, for the case where there is nothing to offer. */
export function RowMenuNote({ children }: { children: ReactNode }) {
  return <p className="px-3 py-1.5 text-xs text-muted-foreground">{children}</p>
}
