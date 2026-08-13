import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import {
  getOrCreateFamilyRoom,
  getRoomList,
  getFamilyMembersWithAccounts,
} from '@/app/actions/chat'
import { ChatShell } from '@/components/chat/ChatShell'

export const metadata = { title: 'Chat' }

/**
 * THE PAGE OWNS THE HEIGHT, and the shell now fills what is left of it.
 *
 * Chat was the one signed-in screen with no visible title — it had the `metadata.title`
 * that names the browser tab and no `<h1>`, so a member landing here from the rail got a
 * room list with nothing naming the page, and a screen reader got a document whose only
 * headings were room names. Every other page under (protected) leads with an h1 and a
 * one-line description; this one now does too.
 *
 * The heading could not simply be prepended, because `ChatShell` used to size ITSELF at
 * `h-[calc(100vh-4rem)]` — the viewport less the TopBar — so anything above it pushed the
 * composer off the bottom of the screen by exactly the height of the heading. The
 * measurement moved up here instead: this element is that height, the header is
 * `shrink-0`, and the shell is `flex-1 min-h-0`. One box owns the arithmetic and the
 * header can grow (a wrapped title on a phone) without costing the thread anything but
 * its own height.
 *
 * `4rem` is the TopBar's `h-16`, and it is the same number `components/layout/
 * header-panel.ts` measures its `top-[4.25rem]` against — see the note in TopBar.
 *
 * NOT `PageShell`. The room list and the thread are a two-pane workspace that runs to the
 * edges of the window; only the heading is inset, and it uses the same `max-w-6xl px-4
 * sm:px-6` measure the TopBar does so it lines up with the controls above it.
 */
export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'chat')

  const [{ room: familyRoom, error: chatError }, rooms, familyMembers] = await Promise.all([
    getOrCreateFamilyRoom(),
    getRoomList(),
    getFamilyMembersWithAccounts(),
  ])

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mx-auto w-full max-w-6xl shrink-0 px-4 pb-4 sm:px-6">
        <h1 className="mb-1 text-3xl font-bold">Chat</h1>
        <p className="text-muted-foreground">
          Group threads and private messages with your family.
        </p>
      </div>

      {familyRoom ? (
        <ChatShell
          initialRooms={rooms}
          familyRoomId={familyRoom.id}
          currentUserId={user.id}
          familyMembers={familyMembers}
        />
      ) : (
        <div className="mx-auto max-w-lg space-y-2 px-4 py-16 text-center">
          <p className="text-sm font-medium text-destructive">Unable to load chat</p>
          {chatError && (
            <p className="rounded bg-muted px-3 py-2 text-left font-mono text-xs text-muted-foreground">
              {chatError}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Make sure the chat migration has been applied in your Supabase project.
          </p>
        </div>
      )}
    </div>
  )
}
