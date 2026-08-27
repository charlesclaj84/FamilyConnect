'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Copy, Check } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/ui/form-message'
import { createFamily } from '@/app/actions/my-families'
import { trackPixelEvent } from '@/lib/meta/pixel'
import { useT } from '@/components/layout/LocaleProvider'

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
  const t = useT()
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
        // The browser half of the activation signal. Same id the server already sent to
        // the Conversions API, so Meta deduplicates the pair into one conversion; null
        // whenever the server did not send it, which is the only consent check needed
        // here. Nothing about the family travels — see lib/meta/conversions.ts.
        if (result.metaCreateFamilyEventId) {
          trackPixelEvent('CreateFamily', {
            eventId: result.metaCreateFamilyEventId,
            customData: { content_name: 'Family Workspace', content_category: 'Activation' },
          })
        }
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
        <Plus className="h-4 w-4" /> {t('fam.create')}
      </button>

      <Dialog
        open={open}
        onClose={close}
        title={step.kind === 'done' ? t('fam.created') : t('fam.create')}
        description={
          step.kind === 'form'
            ? t('fam.firstAdmin')
            : undefined
        }
      >
        {step.kind === 'form' && (
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); submit() }}>
            <div className="space-y-1.5">
              <Label htmlFor="new-family-name">{t('fam.nameLabel')}</Label>
              <Input
                id="new-family-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('fam.namePh')}
                autoComplete="off"
                maxLength={100}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              We will generate a family code you can share. Your name and contact details
              are copied from the profile you already have, and stay in step across every
              family you belong to.
            </p>

            <FormError message={error} />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                {t('action.cancel')}
              </button>
              <button
                type="submit"
                disabled={isPending || !name.trim()}
                className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? t('action.creating') : t('fam.createAction')}
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

            <div className="rounded-xl border-2 border-brand-primary/30 bg-brand-soft/40 px-6 py-4 text-center">
              <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">
                {t('fam.codeHeading')}
              </p>
              <p className="font-mono text-3xl font-bold tracking-widest text-brand-ink">
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
                {copied ? t('action.copied') : t('fam.copyCode')}
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90"
              >
                {t('action.done')}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}
