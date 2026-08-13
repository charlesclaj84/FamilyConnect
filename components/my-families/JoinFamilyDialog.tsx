'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, ArrowRight, Clock } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/ui/form-message'
import { validateFamilyCode, joinFamilyByCode } from '@/app/actions/my-families'

/**
 * Join another family by its code.
 *
 * TWO STEPS, WITH AN EXPLICIT CONFIRMATION BETWEEN THEM. Step one turns the code into
 * a family NAME; step two commits. The code is six characters, dictated over the phone
 * and typed from memory, and there is no undo — leaving a family is deliberately not a
 * feature, because a departure can be used to walk away from a debt. So the user is
 * shown who they are about to join and asked to agree before a membership exists.
 *
 * The dialog never decides anything. `validateFamilyCode` refuses a code the user
 * already belongs to, and `joinFamilyByCode` re-checks everything server-side through
 * a SECURITY DEFINER RPC: this is a form, not a gate.
 */
type Step =
  | { kind: 'code' }
  | { kind: 'confirm'; familyCode: string; familyName: string }
  | { kind: 'done'; familyName: string }

export function JoinFamilyDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>({ kind: 'code' })
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function reset() {
    setStep({ kind: 'code' })
    setCode('')
    setError('')
  }

  function close() {
    setOpen(false)
    // If a membership was actually created, pick up the new row on the way out.
    if (step.kind === 'done') router.refresh()
    reset()
  }

  function lookUp() {
    setError('')
    startTransition(async () => {
      const result = await validateFamilyCode(code)
      if (result.success) {
        setStep({ kind: 'confirm', familyCode: result.familyCode, familyName: result.familyName })
      } else {
        setError(result.message)
      }
    })
  }

  function commit() {
    if (step.kind !== 'confirm') return
    const { familyCode } = step
    setError('')
    startTransition(async () => {
      const result = await joinFamilyByCode(familyCode)
      if (result.success) setStep({ kind: 'done', familyName: result.familyName })
      else setError(result.message)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { reset(); setOpen(true) }}
        className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
      >
        <UserPlus className="h-4 w-4" /> Join another family
      </button>

      <Dialog
        open={open}
        onClose={close}
        title={
          step.kind === 'done' ? 'Request sent'
            : step.kind === 'confirm' ? 'Is this the right family?'
            : 'Join another family'
        }
        description={
          step.kind === 'code'
            ? 'Ask someone in the family for their family code.'
            : undefined
        }
      >
        {step.kind === 'code' && (
          <form
            className="space-y-4"
            onSubmit={e => { e.preventDefault(); lookUp() }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="join-family-code">Family code</Label>
              <Input
                id="join-family-code"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="ABC234"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={12}
                className="font-mono tracking-widest"
              />
            </div>

            <FormError message={error} />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !code.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? 'Checking…' : <>Continue <ArrowRight className="h-3.5 w-3.5" /></>}
              </button>
            </div>
          </form>
        )}

        {step.kind === 'confirm' && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/40 px-4 py-3">
              <p className="text-sm font-medium">{step.familyName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Family Code: <span className="font-mono">{step.familyCode}</span>
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              An administrator of {step.familyName} has to approve you before you can see
              anything in it. Your profile details are shared across every family you
              belong to.
            </p>

            <FormError message={error} />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => { setError(''); setStep({ kind: 'code' }) }}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={commit}
                className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? 'Joining…' : `Yes, join ${step.familyName}`}
              </button>
            </div>
          </div>
        )}

        {step.kind === 'done' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border bg-muted/40 px-4 py-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm">
                Your request to join <span className="font-medium">{step.familyName}</span> is
                waiting for an administrator to approve it. We have let them know.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={close}
                className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}
