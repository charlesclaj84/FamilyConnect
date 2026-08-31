'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Pencil } from 'lucide-react'
import { FormError } from '@/components/ui/form-message'
import { cn } from '@/lib/utils'

export interface ConfirmOptions {
  /** Short headline, e.g. "Delete chapter". */
  title: string
  /** What is about to happen and to what. Name the record where you can. */
  description?: React.ReactNode
  /**
   * Content below the header, at the FULL width of the panel rather than indented under
   * the icon beside the description. For a consequence that is a list or a comparison
   * instead of a sentence — the plan panel's two columns of what a family gains and keeps
   * is the first, and the reason this exists.
   *
   * Keep the `description` as well: it says what the body means, and it is the only half
   * `aria-describedby` names.
   */
  body?: React.ReactNode
  /** Room for a `body` that needs it. Without one there is nothing to widen for. */
  wide?: boolean
  /**
   * A check that must pass before the affirmative is taken. Resolve `null` to let it
   * through, or a message to refuse: the dialog shows it, stays open, and the promise
   * this `confirm()` returned is still unsettled, so the caller sees nothing at all.
   *
   * DELIBERATELY GENERIC — it takes and returns nothing but a message. The one caller
   * today asks for a password before a plan downgrade, and this file knows nothing about
   * passwords, Supabase or plans; a `requirePassword` flag would have put auth inside a
   * `components/ui` primitive that 27 other confirmations share.
   *
   * The input it verifies goes in `body`, which has to own its own state and hand the
   * value out through a ref — `body` is a node captured when `confirm()` was called, so
   * it never re-renders with its caller and a controlled input bound to the caller's
   * state would sit frozen. `PlanPanel`'s field is the worked example.
   */
  verify?: () => Promise<string | null>
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
 *
 * The fallback can only carry text, so a `body` is dropped there. That is why a caller
 * passing one still owes a `description` that stands on its own: the prompt degrades to
 * fewer words, never to an unexplained yes/no.
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

/**
 * THE PANEL IS MOUNTED ONLY WHILE A CONFIRMATION IS OPEN, which is what keeps `verify`'s
 * busy and error state from leaking between two of them. `pending` returns to null
 * between every pair — `settle` sets it — so the panel unmounts and the next confirmation
 * starts from nothing, without a reset effect anybody has to remember to extend.
 */
function ConfirmDialog({
  pending,
  onSettle,
}: {
  pending: PendingConfirm | null
  onSettle: (answer: boolean) => void
}) {
  if (!pending || typeof document === 'undefined') return null
  return createPortal(<ConfirmPanel pending={pending} onSettle={onSettle} />, document.body)
}

function ConfirmPanel({
  pending,
  onSettle,
}: {
  pending: PendingConfirm
  onSettle: (answer: boolean) => void
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const confirmButtonRef = React.useRef<HTMLButtonElement>(null)
  const alive = React.useRef(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  // Set on the way IN as well as cleared on the way out: StrictMode mounts, unmounts and
  // remounts in development, and an `alive` that is only ever cleared would be false for
  // the whole life of the second mount — so every verified confirmation would check the
  // password, discard the answer and sit there.
  React.useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  // The affirmative, and the ONLY path to it — the button and the Enter key both come
  // through here, or a confirmation with a `verify` would be one keystroke away from
  // taking the action without it.
  const accept = React.useCallback(async () => {
    if (busy) return
    if (!pending.verify) {
      onSettle(true)
      return
    }
    setBusy(true)
    setError('')
    const message = await pending.verify()
    // The panel can be gone by now: Escape still cancels while a check is in flight, and
    // resolving a promise nobody is waiting on would settle whatever opened next.
    if (!alive.current) return
    setBusy(false)
    if (message) {
      setError(message)
      return
    }
    onSettle(true)
  }, [busy, pending, onSettle])

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onSettle(false)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        void accept()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onSettle, accept])

  // A dialog that ASKS for something puts the caret in the thing it is asking with; one
  // that only needs a yes focuses the yes. Focusing the button in both cases meant the
  // password field below it had to be found and clicked before it could be typed in.
  const asksForInput = Boolean(pending.verify)
  React.useEffect(() => {
    const field = asksForInput
      ? panelRef.current?.querySelector('input, textarea, select')
      : null
    if (field instanceof HTMLElement) field.focus()
    else confirmButtonRef.current?.focus()
  }, [asksForInput])

  const destructive = pending.destructive ?? false
  const Icon = destructive ? AlertTriangle : Pencil

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={() => onSettle(false)} />
      {/*
        THE PANEL IS A FLEX COLUMN WITH A CAPPED HEIGHT, for the reasons `Dialog` states
        at length beside the same two classes: `dvh` rather than `vh` so a phone still
        showing its address bar does not put the buttons underneath it, and the SCROLL on
        the body rather than the panel so Cancel and Confirm stay pinned however long the
        content runs. A confirm was a sentence and needed neither; one carrying a `body`
        can run past a short screen, and the one control that dismisses it must not be the
        thing that scrolls away.
      */}
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={pending.description ? 'confirm-description' : undefined}
        className={cn(
          // `text-left` for the reason `Dialog` states at length: this panel is `fixed`, so
          // it inherits typography from wherever it was rendered rather than from where it
          // appears. `useConfirm` is reached from the Restore button in the staff Families
          // table, which sits in a `text-right` cell — the same cell that right-aligned the
          // delete dialog beside it. Both panels assert it, because both are reachable from
          // there and a fix in one would have left the other looking like a separate bug.
          'relative z-10 flex w-full flex-col overflow-hidden rounded-xl bg-card text-card-foreground text-left shadow-lg',
          'max-h-[calc(100dvh_-_2rem)]',
          pending.wide ? 'max-w-2xl' : 'max-w-sm'
        )}
      >
        {/* `min-h-0` is what lets a flex child shrink below its content — without it the
            panel grows past its own cap instead of scrolling. Same note as `Dialog`. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-6">
          <div className="flex gap-4">
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
          {/* FULL WIDTH, not indented under the icon: a comparison read in columns cannot
              spare 3.5rem of the panel to line up with a sentence above it. */}
          {pending.body && <div className="mt-5">{pending.body}</div>}
        </div>
        {/* `FormError`, NOT a line of red text of this file's own. A refused `verify` is a
            refused OPERATION beside the button that caused it, which is exactly what that
            component is for — and hand-rolling `text-sm text-destructive` here is the
            38-site drift it was written to end. It renders nothing for an empty message,
            hence no `{error && …}` guard.

            IT SITS WITH THE BUTTONS, not up in the body: the body scrolls and the buttons
            do not, so a message rendered beside the field it is about can be off-screen at
            the moment somebody presses the button again. */}
        <FormError message={error} className="mx-6 mt-4 shrink-0" />
        <div className="flex shrink-0 justify-end gap-2 px-6 pb-6 pt-5">
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
            disabled={busy}
            onClick={() => { void accept() }}
            className={cn(
              'h-9 rounded-lg px-4 text-sm font-medium transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60',
              // The foreground moved into the branches: `--brand-on-primary` is
              // the tone guaranteed to meet AA on `--brand-primary` in BOTH
              // themes, which plain white is not once primary lifts in the dark.
              //
              // The destructive branch made exactly the mistake the line above
              // describes, two lines below writing it: `text-white` on
              // `--destructive`, which LIGHTENS in dark (#e7000b -> #ff6467) and
              // took white to 2.89 there. `--destructive-foreground` is the pair
              // that flips with it — white at 4.76 in light, ink at 4.88 in dark.
              destructive
                ? 'bg-destructive text-destructive-foreground focus-visible:ring-destructive'
                : 'bg-brand-primary text-brand-on-primary focus-visible:ring-brand-primary'
            )}
          >
            {busy ? 'Checking…' : pending.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
