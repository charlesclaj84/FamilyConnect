'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, Send, UserPlus, UserMinus, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MessageBubble } from './MessageBubble'
import { useConfirm } from '@/components/ui/confirm'
import { FieldError } from '@/components/ui/form-message'
import {
  getMessages, getSenderMap, sendMessage, getFamilyMembersWithAccounts,
  addGroupMember, removeGroupMember,
  type ChatMessage, type SenderMap, type RoomWithMeta, type ChatParticipant,
} from '@/app/actions/chat'
import { createClient } from '@/lib/supabase/client'

interface Props {
  room: RoomWithMeta
  currentUserId: string
  onBack: () => void
  /**
   * Reports a membership change up to the shell, which owns the room list. The
   * participant list rendered here comes from that list, so without this an added
   * member would not appear until the whole page was reloaded.
   */
  onParticipantsChange: (roomId: string, next: ChatParticipant[]) => void
}

export function MessageThread({ room, currentUserId, onBack, onParticipantsChange }: Props) {
  const confirm = useConfirm()
  const [messages, setMessages]         = useState<ChatMessage[]>([])
  const [senderMap, setSenderMap]       = useState<SenderMap>({})
  const [body, setBody]                 = useState('')
  const [sending, setSending]           = useState(false)
  const [sendError, setSendError]       = useState('')
  const [showMembers, setShowMembers]   = useState(false)
  const [addMembers, setAddMembers]     = useState<{ userId: string; firstName: string | null; lastName: string | null }[]>([])
  const [memberLoading, setMemberLoading] = useState(false)
  const [memberError, setMemberError]   = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const isCreator = room.kind === 'group' && room.created_by === currentUserId
  const activeParticipants: ChatParticipant[] = room.participants.filter(p => p.user_id !== currentUserId)

  const threadTitle =
    room.kind === 'family' ? 'Family Chat'
    : room.kind === 'group' ? (room.name ?? 'Group')
    : (() => {
        const other = room.participants.find(p => p.user_id !== currentUserId)
        return other
          ? ([other.first_name, other.last_name].filter(Boolean).join(' ') || 'Family Member')
          : 'Direct Message'
      })()

  // Load messages + Realtime subscription when room changes
  useEffect(() => {
    let mounted = true

    async function load() {
      const [msgs, smap] = await Promise.all([getMessages(room.id), getSenderMap(room.id)])
      if (!mounted) return
      setMessages(msgs)
      setSenderMap(smap)
    }
    load()

    const supabase = createClient()
    const channel = supabase
      .channel(`chat_room_${room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${room.id}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
        }
      )
      .subscribe()

    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [room.id])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed || sending) return
    setSending(true)
    setSendError('')
    const result = await sendMessage(room.id, trimmed)
    setSending(false)
    if (result.success) setBody('')
    else setSendError(result.error ?? 'Failed to send')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  async function handleShowMembers() {
    setShowMembers(s => !s)
    if (!showMembers && isCreator && addMembers.length === 0) {
      const all = await getFamilyMembersWithAccounts()
      const currentIds = new Set(room.participants.map(p => p.user_id))
      setAddMembers(all.filter(m => !currentIds.has(m.userId)))
    }
  }

  async function handleAdd(userId: string) {
    const member = addMembers.find(m => m.userId === userId)
    const name = member
      ? ([member.firstName, member.lastName].filter(Boolean).join(' ') || 'this family member')
      : 'this family member'
    const ok = await confirm({
      title: 'Add to group',
      description: `Add ${name} to "${threadTitle}"? They will be able to read the conversation.`,
      confirmLabel: 'Add',
    })
    if (!ok) return
    setMemberLoading(true)
    const result = await addGroupMember(room.id, userId)
    setMemberLoading(false)
    if (!result.success) { setMemberError(result.error ?? 'Could not add member'); return }
    setMemberError('')
    setAddMembers(prev => prev.filter(m => m.userId !== userId))
    onParticipantsChange(room.id, [...room.participants, {
      user_id: userId,
      first_name: member?.firstName ?? null,
      last_name: member?.lastName ?? null,
    }])
  }

  async function handleRemove(userId: string) {
    const participant = room.participants.find(p => p.user_id === userId)
    const name = participant
      ? ([participant.first_name, participant.last_name].filter(Boolean).join(' ') || 'this family member')
      : 'this family member'
    const ok = await confirm({
      title: 'Remove from group',
      description: `Remove ${name} from "${threadTitle}"? They lose access to the conversation.`,
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (!ok) return
    setMemberLoading(true)
    const result = await removeGroupMember(room.id, userId)
    setMemberLoading(false)
    if (!result.success) { setMemberError(result.error ?? 'Could not remove member'); return }
    setMemberError('')
    onParticipantsChange(room.id, room.participants.filter(p => p.user_id !== userId))
    // Offer them back in the "add members" list rather than making the creator
    // reopen the panel to see the change.
    if (participant) {
      setAddMembers(prev => prev.some(m => m.userId === userId) ? prev : [...prev, {
        userId,
        firstName: participant.first_name,
        lastName: participant.last_name,
      }])
    }
  }

  function resolveName(userId: string) {
    const s = senderMap[userId]
    if (!s) return 'Family Member'
    return [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Family Member'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0 bg-background">
        <button onClick={onBack} className="md:hidden p-1 rounded hover:bg-muted transition-colors" aria-label="Back">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-sm font-semibold truncate flex-1">{threadTitle}</h2>

        {room.kind === 'family' && (
          <span className="text-xs text-muted-foreground shrink-0">
            {room.participants.length} member{room.participants.length !== 1 ? 's' : ''}
          </span>
        )}

        {room.kind === 'group' && isCreator && (
          <button
            onClick={handleShowMembers}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground shrink-0"
            aria-label="Manage members"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Group member management panel (creator only) */}
      {room.kind === 'group' && showMembers && isCreator && (
        <div className="border-b bg-muted/30 px-4 py-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Members</p>

          <FieldError message={memberError} />

          <div className="space-y-1">
            {activeParticipants.map(p => {
              const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Family Member'
              return (
                <div key={p.user_id} className="flex items-center justify-between text-sm">
                  <span>{name}</span>
                  <button
                    onClick={() => handleRemove(p.user_id)}
                    disabled={memberLoading}
                    className="flex items-center gap-1 text-xs text-destructive hover:opacity-70 transition-opacity"
                  >
                    <UserMinus className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              )
            })}
          </div>

          {addMembers.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Add members:</p>
              {addMembers.map(m => {
                const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Family Member'
                return (
                  <div key={m.userId} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{name}</span>
                    <button
                      onClick={() => handleAdd(m.userId)}
                      disabled={memberLoading}
                      className="flex items-center gap-1 text-xs text-primary hover:opacity-70 transition-opacity"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Message scroll area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center mt-8">No messages yet. Say hello!</p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                senderName={resolveName(msg.sender_id)}
                isOwn={msg.sender_id === currentUserId}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area or ended banner */}
      {room.can_reply ? (
        <div className="border-t px-4 py-3 shrink-0 bg-background">
          <FieldError message={sendError} className="mb-1" />
          <div className="flex gap-2 items-end">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
              maxLength={4000}
              rows={1}
              className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 min-h-[38px] max-h-32 overflow-y-auto"
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 128)}px`
              }}
            />
            <Button size="icon" disabled={!body.trim() || sending} onClick={handleSend} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t px-4 py-3 shrink-0 bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            {room.kind === 'dm'
              ? 'This conversation has ended.'
              : 'You have been removed from this group.'}
          </p>
        </div>
      )}
    </div>
  )
}
