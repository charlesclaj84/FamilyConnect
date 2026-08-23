'use client'

import { useState, useTransition } from 'react'
import { ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FormError } from '@/components/ui/form-message'
import { answerCheckIn } from '@/app/actions/safety-check-ins'
import type { CheckInResponse } from '@/lib/safety-check-in'

/**
 * The two buttons a relative presses, and the one component that draws them.
 *
 * ── WHY THIS IS SHARED RATHER THAN WRITTEN TWICE ───────────────────────────────────
 * Two surfaces offer it — the Dashboard banner and the check-in screen — and AGENTS.md's
 * argument against a second copy is the one it makes about `PersonMultiSelect` and about
 * `lib/chapter-propagation.ts`: two implementations of one rule is how two answers to one
 * question start, and here the rule includes which answers exist, what each one says back, and
 * whether a note is offered. A drifted copy would mean the banner and the screen recording
 * subtly different things about the same relative.
 *
 * ── ONE TAP IS THE WHOLE DESIGN, SO THE NOTE IS OPTIONAL AND SECOND ────────────────
 * The value of this feature is that somebody in a bad situation can answer without composing
 * anything. So the two buttons act IMMEDIATELY — no note required, no confirm step — and the
 * note box appears only after an answer has been recorded, as a way to add to it.
 *
 * A CONFIRM DIALOG WAS CONSIDERED AND REJECTED for "I need help", which is the opposite of this
 * codebase's usual instinct (`confirm.tsx` guards every destructive control). Nothing here is
 * destructive, the answer can be changed freely, and a confirmation step between a frightened
 * person and asking for help is the wrong place to be careful.
 *
 * ── WHAT IT REPORTS, AND WHAT IT MUST NEVER CLAIM ──────────────────────────────────
 * The action's own message is echoed verbatim, and it says what is TRUE — *"your family can see
 * that you are safe"* — rather than what a reader might infer, which is that somebody has been
 * notified. Nobody has: the roster updates and whoever is watching it sees the change. The
 * distinction matters on the one screen in this product where a person might rely on it.
 */
export function AnswerCheckIn({
  checkInId,
  myState,
  myNote,
  /** `banner` sits on a coloured band; `panel` sits on a card. */
  tone = 'panel',
}: {
  checkInId: string
  myState: CheckInResponse
  myNote: string | null
  tone?: 'banner' | 'panel'
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  // OPTIMISTIC, and deliberately not `useOptimistic`: this state has to survive the
  // `router.refresh()` the server action's `revalidatePath` triggers, and it is corrected by the
  // next server render because the prop it was seeded from changes. `lib/use-server-state.ts` is
  // the general answer to that and is overkill for one enum.
  const [state, setState] = useState<CheckInResponse>(myState)
  const [note, setNote] = useState(myNote ?? '')
  const [noteSaved, setNoteSaved] = useState(false)

  const answer = (next: Exclude<CheckInResponse, 'awaiting'>, withNote?: string) => {
    setError('')
    startTransition(async () => {
      const result = await answerCheckIn({
        checkInId,
        state: next,
        note: withNote ?? (note.trim() || undefined),
      })
      if (!result.success) {
        setError(result.message ?? 'Could not record your answer')
        return
      }
      setState(next)
      if (withNote !== undefined) setNoteSaved(true)
    })
  }

  const answered = state !== 'awaiting'
  const onBanner = tone === 'banner'

  return (
    <div className="space-y-3">
      {!answered && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="affirm"
            disabled={pending}
            onClick={() => answer('safe')}
            className="flex-1 sm:flex-none"
          >
            <ShieldCheck aria-hidden="true" />
            I am safe
          </Button>
          {/*
            NOT `variant="destructive"`. That variant is dark red on a red tint and owns errors
            and deletions — AGENTS.md is explicit that reporting a failure is `FormError`'s job
            and that `--destructive` must not be borrowed for anything else. Asking for help is
            not an error; it is the most important thing this screen can record. `--brand-urgent`
            is the role added for exactly this, and `bg-brand-urgent text-brand-on-urgent` is its
            checked pairing in both themes.
          */}
          <Button
            disabled={pending}
            onClick={() => answer('needs_help')}
            className="flex-1 bg-brand-urgent text-brand-on-urgent hover:opacity-90 sm:flex-none"
          >
            <TriangleAlert aria-hidden="true" />
            I need help
          </Button>
        </div>
      )}

      {answered && (
        <div className="space-y-3">
          <p
            className={
              onBanner
                ? 'text-sm font-medium'
                : state === 'safe'
                  ? 'text-sm font-medium text-brand-affirm'
                  : 'text-sm font-medium text-brand-urgent'
            }
          >
            {state === 'safe'
              ? 'You have told your family you are safe.'
              : 'You have told your family you need help.'}
          </p>

          {/*
            CHANGING AN ANSWER IS OFFERED, NOT HIDDEN. The migration argues why an answer is not
            a vote: "I said I needed help, and now I am safe" is the whole point, and a screen
            that made it hard to say would be recording a stale fact about somebody's safety.
          */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => answer(state === 'safe' ? 'needs_help' : 'safe')}
            >
              {state === 'safe' ? 'Actually, I need help' : 'I am safe now'}
            </Button>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`note-${checkInId}`}
              className="block text-xs font-medium text-muted-foreground"
            >
              Anything your family should know? (optional)
            </label>
            <Textarea
              id={`note-${checkInId}`}
              rows={2}
              value={note}
              maxLength={500}
              onChange={e => { setNote(e.target.value); setNoteSaved(false) }}
              placeholder="Where you are, what you need, or nothing at all."
            />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => answer(state as Exclude<CheckInResponse, 'awaiting'>, note.trim())}
              >
                Save note
              </Button>
              {noteSaved && (
                <span className="text-xs text-brand-affirm">Saved</span>
              )}
            </div>
          </div>
        </div>
      )}

      <FormError message={error} />
    </div>
  )
}
