'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Copy, Check } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createFamily } from '@/app/actions/my-families'

/**
 * Start a new family from an account that already has one.
 *
 * ONE STEP, unlike joining — and the asymmetry is the point. Joining commits you to
 * somebody else's family and cannot be undone (leaving is deliberately not a feature),
 * so it confirms first. Creating one affects nobody but the creator, who is about to be
 * its only member and its administrator.
 *
 * The success state shows the new family CODE rather than closing, for the same reason
 * registration does: it is the only way to invite anyone, it is not shown anywhere
 * prominent afterwards, and a dialog that vanishes takes it with it.
 */
type Step =
  | { kind: 'form' }
  | { kind: 'done'; familyCode: string; familyName: string }

export function CreateFamilyDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>({ kind: 'form' })
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setStep({ kind: 'form' })
    setName('')
    setError('')
    setCopied(false)
  }

  function close() {
    setOpen(false)
    // The action already switched the active family and revalidated; this picks the
    // new state up for the page underneath before the dialog is gone.
    if (step.kind === 'done') router.refresh()
    reset()
  }

  function submit() {
    setError('')
    startTransition(async () => {
      const result = await createFamily(name)
      if (result.success) {
        setStep({ kind: 'done', familyCode: result.familyCode, familyName: result.familyName })
      } else {
        setError(result.message)
      }
    })
  }

  async function copyCode() {
    if (step.kind !== 'done') return
    try {
      await navigator.clipboard.writeText(step.familyCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused (permissions, insecure origin). The code is
      // on screen in a selectable element either way, so this is a nicety failing,
      // not the feature failing — say nothing rather than raise an error about it.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { reset(); setOpen(true) }}
        className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
      >
        <Plus className="h-4 w-4" /> Create a new family
      </button>

      <Dialog
        open={open}
        onClose={close}
        title={step.kind === 'done' ? 'Family created' : 'Create a new family'}
        description={
          step.kind === 'form'
            ? 'You will be its first administrator. Your profile carries over.'
            : undefined
        }
      >
        {step.kind === 'form' && (
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); submit() }}>
            <div className="space-y-1.5">
              <Label htmlFor="new-family-name">Family name</Label>
              <Input
                id="new-family-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="The Okonkwo Family"
                autoComplete="off"
                maxLength={100}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              We will generate a family code you can share. Your name and contact details
              are copied from the profile you already have, and stay in step across every
              family you belong to.
            </p>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}

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
                disabled={isPending || !name.trim()}
                className="rounded-lg bg-[#0f2540] px-3 py-1.5 text-sm font-medium text-[#e6ecfa] transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? 'Creating…' : 'Create family'}
              </button>
            </div>
          </form>
        )}

        {step.kind === 'done' && (
          <div className="space-y-4">
            <p className="text-sm">
              <span className="font-medium">{step.familyName}</span> is ready, and you are
              now viewing it as its administrator.
            </p>

            <div className="rounded-xl border-2 border-[#0f2540]/30 bg-[#e6ecfa]/40 px-6 py-4 text-center">
              <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">
                Family Code
              </p>
              <p className="font-mono text-3xl font-bold tracking-widest text-[#0f2540]">
                {step.familyCode}
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              Share this with your relatives so they can join. Everyone who joins waits in
              Member Approvals until you admit them.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={copyCode}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy code'}
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-lg bg-[#0f2540] px-3 py-1.5 text-sm font-medium text-[#e6ecfa] transition-opacity hover:opacity-90"
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
