'use client'

import { useState, useTransition } from 'react'
import { UserCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import type { UnlinkedPerson } from '@/app/actions/link-person'
import { linkPersonToCurrentUser } from '@/app/actions/link-person'

interface Props {
  unlinkedPeople: UnlinkedPerson[]
}

export function LinkPersonBanner({ unlinkedPeople }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  if (dismissed) return null

  function handleLink() {
    if (!selectedId) {
      setError('Please select your name from the list.')
      return
    }
    setError('')
    startTransition(async () => {
      const result = await linkPersonToCurrentUser(selectedId)
      if (result.success) {
        // Page will revalidate and the banner data will be gone
        setDismissed(true)
      } else {
        setError(result.message)
      }
    })
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 flex gap-3">
      <div className="shrink-0 p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 self-start mt-0.5">
        <UserCheck className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Were you already added to the family?
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            A family member may have already added you. Select your name below to link your account to the existing record.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="flex-1 h-9 text-sm"
            disabled={isPending}
          >
            <option value="">— Select your name —</option>
            {unlinkedPeople.map(p => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
                {p.date_of_birth ? ` (b. ${new Date(p.date_of_birth).getFullYear()})` : ''}
                {p.is_minor ? ' (minor)' : ''}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            onClick={handleLink}
            disabled={isPending || !selectedId}
            className="shrink-0"
          >
            {isPending ? 'Linking…' : 'Link My Account'}
          </Button>
        </div>

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 self-start text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
