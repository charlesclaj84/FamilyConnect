'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormError } from '@/components/ui/form-message'
import { useT } from '@/components/layout/LocaleProvider'
import {
  deleteFamilyPermanently, requestFamilyDeleteCode,
} from '@/app/actions/staff/destroy'

/**
 * Permanently delete one family. The most destructive control in the product.
 *
 * ── IT IS A DIALOG AND NOT A ROW MENU ITEM, AND THAT IS THE DESIGN ─────────────────
 * `restoreFamily` next to it is one `confirm()` because it is reversible in both directions —
 * a restore that should not have happened is a removal away. This is not reversible by any
 * means, so it wants a screen rather than a sentence: the counts of what is about to go, the
 * family code typed back, a reason, and a code from the acting owner's inbox.
 *
 * ── FOUR THINGS STAND IN FRONT OF IT, AND EACH ANSWERS A DIFFERENT MISTAKE ─────────
 *   owner-only            a `support` staffer working a ticket cannot reach this at all —
 *                         the trigger is not rendered, and both actions refuse independently
 *   the code, typed       the wrong row on a list of a hundred families
 *   a reason              the audit row's whole content besides the counts
 *   the emailed code      somebody at an unlocked screen, and a session that is not the
 *                         owner's
 *
 * The last one is the only one that is a real second factor. The other three stop an accident;
 * `challenge-fields.tsx` says exactly that much about the password on the removal panel and
 * this component says no more.
 *
 * ── THE COPY DOES NOT SAY "THIS CANNOT BE UNDONE" AND STOP THERE ───────────────────
 * It says what goes. A support engineer pressing this has usually been asked to, and the
 * question they need answered is not "is this permanent" — they know — but "is this the right
 * family, and what am I about to destroy". So the family's own name and code lead, and the
 * list is what the sweep will actually take.
 */
export function StaffDeleteFamilyDialog({ familyCode, familyName, memberCount, onDeleted }: {
  familyCode: string
  familyName: string
  /** Shown so the owner can recognise the family. The real counts come back after. */
  memberCount: number
  /**
   * Called after a successful deletion, so the list can re-read — and it is handed the
   * outcome, because this dialog closes on success and has nowhere left to print it.
   *
   * That sentence used to be the whole of a real gap: `StaffDestroyResult.detail` names the
   * storage objects that could NOT be removed and are now orphaned, which is the one part of a
   * deletion a person has to act on afterwards, and nothing rendered it anywhere. Since
   * 2026-09-01 it also carries the receipt for the Stripe subscriptions that were stopped, so
   * dropping it would discard the only statement this product makes that the charges ended.
   */
  onDeleted: (outcome: string) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [note, setNote] = useState('')
  const [emailed, setEmailed] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  /**
   * Reset on every open.
   *
   * A typed family code left in state from the last time this dialog was open is the one thing
   * that could turn the confirmation into a formality: open it on a DIFFERENT family, and the
   * field already holds a code that will not match — or, worse, the same one. Cleared on the
   * way in rather than on the way out, because a dialog closed by the scrim never runs a
   * close handler.
   */
  function show() {
    setTyped(''); setNote(''); setEmailed(''); setNotice(''); setError('')
    setOpen(true)
  }

  function askForCode() {
    setError(''); setNotice('')
    startTransition(async () => {
      const result = await requestFamilyDeleteCode(familyCode)
      if (!result.success) { setError(result.message); return }
      setNotice(result.message)
    })
  }

  function destroy() {
    setError(''); setNotice('')
    startTransition(async () => {
      const result = await deleteFamilyPermanently({
        familyCode, confirmCode: typed, emailedCode: emailed, note,
      })
      if (!result.success) { setError(result.message); return }
      setOpen(false)
      // Both halves, joined: what was destroyed, then what was stopped at Stripe and what was
      // left behind in storage. `detail` is absent when there was nothing to say.
      onDeleted([result.message, result.detail].filter(Boolean).join(' '))
    })
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={show}
        // `--destructive` is right here and is right almost nowhere else in this codebase:
        // this IS a deletion, which is what that token is for. The colour section's warning
        // is about reaching for it to mean "withheld" or "important".
        className="border-destructive/40 text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        {t('staff.deleteForever')}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('staff.deleteFamilyTitle', { name: familyName })}
        description={t('staff.deleteFamilyLede', { code: familyCode, members: String(memberCount) })}
        className="max-w-lg"
      >
        <div className="mt-2 space-y-4">
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {t('staff.deleteFamilyWhatGoes')}
          </p>

          {/* ── WHAT HAPPENS AT STRIPE, WHICH THE PARAGRAPH ABOVE CANNOT SAY ──────────
              Added 2026-09-01 with the cancellation itself. The line above lists what is
              DESTROYED, and a Stripe subscription is not a row this database can destroy — so
              an owner reading only that paragraph would have no way to know whether erasing a
              family also stops charging its relatives' cards. It does, and it refuses the
              deletion if it cannot.

              `--brand-withheld` rather than `--destructive`: nothing here is a failure or a
              deletion, and stacking a second red box would flatten the one distinction the box
              above is making. */}
          <p className="rounded-lg border border-brand-withheld/40 px-3 py-2 text-sm text-brand-withheld">
            {t('stf.deleteStopsBilling')}
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="staff-delete-note" required>{t('staff.deleteWhyLabel')}</Label>
            <Textarea
              id="staff-delete-note"
              autoGrow
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t('staff.deleteWhyPlaceholder')}
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">{t('staff.deleteWhyHint')}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-delete-code" required>
              {t('staff.deleteTypeCodeLabel', { code: familyCode })}
            </Label>
            <Input
              id="staff-delete-code"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-delete-emailed" required>{t('staff.deleteEmailedLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="staff-delete-emailed"
                value={emailed}
                onChange={e => setEmailed(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                disabled={pending}
                className="max-w-[8rem]"
              />
              <Button type="button" variant="outline" onClick={askForCode} disabled={pending}>
                {t('staff.deleteSendCode')}
              </Button>
            </div>
            {/* The one place this dialog says something that is not a failure. Not `FormError`:
                nothing went wrong, and the alert treatment on "we sent you a code" would read
                as a problem. */}
            {notice && <p className="text-xs text-brand-affirm">{notice}</p>}
          </div>

          <FormError message={error} />

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {t('action.cancel')}
            </Button>
            {/* DISABLED UNTIL ALL THREE ARE PRESENT, and the typed code has to MATCH. The
                server checks every one of these again (§2) — this is what stops the button
                being the thing that reports a mistake. */}
            <Button
              type="button"
              variant="destructive"
              onClick={destroy}
              disabled={pending || typed.trim().toUpperCase() !== familyCode || !note.trim() || emailed.trim().length !== 6}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {pending ? t('staff.deleting') : t('staff.deleteForeverConfirm')}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
