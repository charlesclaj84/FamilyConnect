'use client'

import { useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/form-message'
import { getOrCreateDmRoom, type RoomWithMeta } from '@/app/actions/chat'
import { useT } from '@/components/layout/LocaleProvider'

interface Props {
  open: boolean
  onClose: () => void
  familyMembers: { userId: string; firstName: string | null; lastName: string | null }[]
  onRoomCreated: (room: RoomWithMeta) => void
}

export function NewDmDialog({ open, onClose, familyMembers, onRoomCreated }: Props) {
  const t = useT()
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  async function handleStart() {
    if (!selectedId) return
    setLoading(true)
    setError('')
    const { room, error: err } = await getOrCreateDmRoom(selectedId)
    if (err || !room) {
      setError(err ?? t('action.wentWrong'))
      setLoading(false)
      return
    }
    onRoomCreated(room)
    setSelectedId('')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('chat.newDmTitle')}
      description={t('chat.newDmHint')}
    >
      <div className="space-y-4 mt-2">
        {familyMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('chat.noOthers')}</p>
        ) : (
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); setError('') }}
          >
            <option value="">— Select a family member —</option>
            {familyMembers.map(m => {
              const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || t('chat.familyMember')
              return <option key={m.userId} value={m.userId}>{name}</option>
            })}
          </select>
        )}

        <FormError message={error} />

        <div className="flex gap-2 pt-1">
          <Button
            className="flex-1"
            disabled={!selectedId || loading}
            onClick={handleStart}
          >
            {loading ? t('chat.starting') : t('chat.startConversation')}
          </Button>
          <Button variant="outline" onClick={onClose}>{t('action.cancel')}</Button>
        </div>
      </div>
    </Dialog>
  )
}
