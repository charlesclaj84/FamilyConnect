'use client'

import { useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/form-message'
import { getOrCreateDmRoom, type RoomWithMeta } from '@/app/actions/chat'

interface Props {
  open: boolean
  onClose: () => void
  familyMembers: { userId: string; firstName: string | null; lastName: string | null }[]
  onRoomCreated: (room: RoomWithMeta) => void
}

export function NewDmDialog({ open, onClose, familyMembers, onRoomCreated }: Props) {
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  async function handleStart() {
    if (!selectedId) return
    setLoading(true)
    setError('')
    const { room, error: err } = await getOrCreateDmRoom(selectedId)
    if (err || !room) {
      setError(err ?? 'Something went wrong')
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
      title="New Direct Message"
      description="Choose a family member to start a private conversation."
    >
      <div className="space-y-4 mt-2">
        {familyMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other family members with accounts yet.</p>
        ) : (
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); setError('') }}
          >
            <option value="">— Select a family member —</option>
            {familyMembers.map(m => {
              const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Family Member'
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
            {loading ? 'Starting…' : 'Start Conversation'}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  )
}
