'use client'

import { useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/ui/form-message'
import { createGroupRoom, type RoomWithMeta } from '@/app/actions/chat'

interface Props {
  open: boolean
  onClose: () => void
  familyMembers: { userId: string; firstName: string | null; lastName: string | null }[]
  onRoomCreated: (room: RoomWithMeta) => void
}

export function CreateGroupDialog({ open, onClose, familyMembers, onRoomCreated }: Props) {
  const [name, setName]           = useState('')
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  function toggleMember(userId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  async function handleCreate() {
    if (!name.trim()) { setError('Group name is required'); return }
    setLoading(true)
    setError('')
    const { room, error: err } = await createGroupRoom(name.trim(), Array.from(selected))
    if (err || !room) {
      setError(err ?? 'Something went wrong')
      setLoading(false)
      return
    }
    setName('')
    setSelected(new Set())
    onRoomCreated(room)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Group"
      description="Give the group a name and choose who to include."
    >
      <div className="space-y-4 mt-2">
        <div className="space-y-1.5">
          <Label htmlFor="group-name">Group Name</Label>
          <Input
            id="group-name"
            placeholder="e.g. Summer Reunion Planning"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            autoFocus
          />
        </div>

        {familyMembers.length > 0 && (
          <div className="space-y-1.5">
            <Label>Members</Label>
            <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
              {familyMembers.map(m => {
                const displayName = [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Family Member'
                const checked = selected.has(m.userId)
                return (
                  <label
                    key={m.userId}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMember(m.userId)}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    <span className="text-sm">{displayName}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {selected.size} member{selected.size !== 1 ? 's' : ''} selected
            </p>
          </div>
        )}

        <FormError message={error} />

        <div className="flex gap-2 pt-1">
          <Button className="flex-1" disabled={loading} onClick={handleCreate}>
            {loading ? 'Creating…' : 'Create Group'}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  )
}
