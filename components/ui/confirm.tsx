'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ConfirmOptions {
  /** Short headline, e.g. "Delete chapter". */
  title: string
  /** What is about to happen and to what. Name the record where you can. */
  description?: React.ReactNode
  /** Label on the affirmative button. Defaults to "Confirm". */
  confirmLabel?: string
  cancelLabel?: string
  /** Deletions and other irreversible actions — renders the red treatment. */
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = React.createContext<ConfirmFn | null>(null)

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void
}

/**
 * Puts a promise-returning `confirm()` in context so every edit and delete in the
 * app can gate itself behind an explicit yes:
 *
 *   if (!(await confirm({ title: 'Delete event', destructive: true }))) return
 *
 * Reads like the native `window.confirm` it replaces, but is styled, keyboard
 * accessible, and — unlike the native dialog — cannot be suppressed by the
 * browser's "prevent this page from creating additional dialogs" checkbox.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null)

  const confirm = React.useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    []
  )

  const settle = React.useCallback((answer: boolean) => {
    setPending((current) => {
      current?.resolve(answer)
      return null
    })
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog pending={pending} onSettle={settle} />
    </ConfirmContext.Provider>
  )
}

/**
 * Returns the confirm function. Falls back to the native dialog when rendered
 * outside a provider so a stray component can never silently skip the prompt.
 */
export function useConfirm(): ConfirmFn {
  const contextConfirm = React.useContext(ConfirmContext)
  return React.useMemo<ConfirmFn>(
    () =>
      contextConfirm ??
      (async ({ title, description }) =>
        window.confirm(
          [title, typeof description === 'string' ? description : null]
            .filter(Boolean)
            .join('\n\n')
        )),
    [contextConfirm]
  )
}

function ConfirmDialog({
  pending,
  onSettle,
}: {
  pending: PendingConfirm | null
  onSettle: (answer: boolean) => void
}) {
  const confirmButtonRef = React.useRef<HTMLButtonElement>(null)
  const open = pending !== null

  // Escape always cancels; Enter takes the affirmative. Both are scoped to the
  // window because the dialog owns focus for as long as it is open.
  //
  // CAPTURE PHASE, and it stops propagation — because a confirm can now open ON TOP OF a
  // Dialog (the schedule editor in AdminIncomeClient is the first). `Dialog` closes itself
  // on Escape from its own document listener, and a bubble-phase listener here does not
  // prevent that one from also firing: Escape would cancel the confirm AND close the
  // editor underneath it, throwing away the edits. A capture listener on `document` runs
  // before any bubble listener on `document`, so stopping propagation there means the
  // topmost modal is the only thing that answers the key — which is what "modal" means.
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onSettle(false)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        onSettle(true)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onSettle])

  React.useEffect(() => {
    if (open) confirmButtonRef.current?.focus()
  }, [open])

  if (!pending || typeof document === 'undefined') return null

  const destructive = pending.destructive ?? false
  const Icon = destructive ? AlertTriangle : Pencil

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={() => onSettle(false)} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={pending.description ? 'confirm-description' : undefined}
        className="relative z-10 w-full max-w-sm rounded-xl bg-card text-card-foreground shadow-lg"
      >
        <div className="flex gap-4 px-6 pt-6">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              destructive ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base font-semibold leading-6">
              {pending.title}
            </h2>
            {pending.description && (
              <div id="confirm-description" className="mt-1.5 text-sm text-muted-foreground">
                {pending.description}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6 pt-5">
          <button
            type="button"
            onClick={() => onSettle(false)}
            className="h-9 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            {pending.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={() => onSettle(true)}
            className={cn(
              'h-9 rounded-lg px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              destructive
                ? 'bg-destructive focus-visible:ring-destructive'
                : 'bg-brand-navy focus-visible:ring-brand-navy'
            )}
          >
            {pending.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
