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
import { deleteStaffAccount } from '@/app/actions/staff/destroy'

/**
 * Delete one account, freeing its email address.
 *
 * ── WHAT SURVIVES IS THE WHOLE POINT, AND THE COPY LEADS WITH IT ───────────────────
 * `people.user_id` is ON DELETE SET NULL, so every family this person belonged to keeps them
 * on the tree, in the directory and in its ledgers — as a record with no account, which is a
 * shape this product has in quantity (AGENTS.md §4b: a recorded grandmother). An owner
 * pressing this needs to know that before they press it, because the alternative reading —
 * "this removes them from their families" — would stop them doing something harmless, or
 * worse, make them think they had done something they had not.
 *
 * ── NO EMAILED CODE, UNLIKE THE FAMILY DELETE, AND THAT IS PROPORTION ──────────────
 * A family deletion destroys a hundred and forty people's records and cannot be undone by any
 * means. This destroys one login, and the person can register again with the same address —
 * which is usually the REASON somebody asks for it. A second factor here would be ceremony,
 * and ceremony is what teaches an owner to click through ceremony.
 *
 * ── AND THE REFUSALS COME FROM THE DATABASE, VERBATIM ──────────────────────────────
 * `staff_delete_account` distinguishes "no account with that address" from "you cannot delete
 * your own account" from "that is the last owner of the console", and this dialog prints
 * whichever it gets. There is no enumeration oracle to protect: the caller has already been
 * proven a staff owner, and an owner who cannot tell which of the three happened will try
 * again rather than stop.
 */
export function StaffDeleteAccountDialog({ email, familyCount, onDeleted }: {
  email: string
  /** How many families keep them as a record afterwards. Shown, because it reassures. */
  familyCount: number
  onDeleted: () => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  // Cleared on the way IN, not out: a dialog dismissed by the scrim runs no close handler,
  // and a typed address left over from the last account is the one thing that could make
  // this confirmation a formality. `StaffDeleteFamilyDialog` argues the same point.
  function show() {
    setTyped(''); setNote(''); setError('')
    setOpen(true)
  }

  function destroy() {
    setError('')
    startTransition(async () => {
      const result = await deleteStaffAccount({ email, confirmEmail: typed, note })
      if (!result.success) { setError(result.message); return }
      setOpen(false)
      onDeleted()
    })
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={show}
        className="border-destructive/40 text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        {t('staff.deleteAccount')}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('staff.deleteAccountTitle')}
        description={t('staff.deleteAccountLede', { email })}
        className="max-w-lg"
      >
        <div className="mt-2 space-y-4">
          {/* Withheld rather than destructive: this paragraph is reassurance about what is
              KEPT, and the red treatment on it would read as a warning. */}
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {familyCount > 0
              ? t('staff.deleteAccountKeeps', { families: String(familyCount) })
              : t('staff.deleteAccountKeepsNone')}
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="staff-del-acct-note" required>{t('staff.deleteWhyLabel')}</Label>
            <Textarea
              id="staff-del-acct-note"
              autoGrow
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t('staff.deleteAccountWhyPlaceholder')}
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-del-acct-email" required>{t('staff.deleteTypeAddressLabel')}</Label>
            <Input
              id="staff-del-acct-email"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={pending}
            />
          </div>

          <FormError message={error} />

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {t('action.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={destroy}
              disabled={pending || typed.trim().toLowerCase() !== email.toLowerCase() || !note.trim()}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {pending ? t('staff.deleting') : t('staff.deleteAccountConfirm')}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
