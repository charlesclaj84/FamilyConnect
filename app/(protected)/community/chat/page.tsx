import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { resolveZone } from '@/lib/auth/zone'
import {
  getOrCreateFamilyRoom,
  getRoomList,
  getFamilyMembersWithAccounts,
} from '@/app/actions/chat'
import { ChatShell } from '@/components/chat/ChatShell'
import { PAGE_MEASURE } from '@/components/layout/PageShell'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Chat' }

/**
 * THE PAGE OWNS THE HEIGHT, and the shell now fills what is left of it.
 *
 * Chat was the one signed-in screen with no visible title — it had the `metadata.title`
 * that names the browser tab and no `<h1>`, so a member landing here from the rail got a
 * room list with nothing naming the page, and a screen reader got a document whose only
 * headings were room names. It leads with an h1 like every other page now. (It carried a
 * one-line description under it too until 2026-08-25, when those were swept out of the app —
 * "Group threads and private messages with your family" is what a room list already looks
 * like, and a caption that restates its own heading is furniture.)
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
 * NOT `PageShell`, and that is the one thing about this page worth re-reading before
 * touching the heading. The room list and the thread are a two-pane workspace that runs to
 * the edges of the window, so the shell that centres and pads a page is wrong here — only
 * the HEADING is inset, and it takes `PAGE_MEASURE` from that file rather than restating
 * the classes, so it cannot drift from the page beside it or the TopBar above it.
 *
 * `pt-10 pb-6` IS THE OTHER HALF OF THAT, and it is what the measure alone did not buy.
 * This heading had no top padding at all, so it sat flush under the bar while every other
 * page's h1 began `PageShell`'s `py-10` below it: same x, 2.5rem higher, which read as chat
 * having a different header rather than the same one. The bottom is `pb-6` to match the
 * `space-y-6` the list pages put between their heading and their content. Both come out of
 * the thread's height, which is exactly what the arithmetic above is arranged to allow.
 */
export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'community/chat')

  const [{ room: familyRoom, error: chatError }, rooms, familyMembers, zone] = await Promise.all([
    getOrCreateFamilyRoom(),
    getRoomList(),
    getFamilyMembersWithAccounts(),
    resolveZone(user.id),
  ])

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className={cn(PAGE_MEASURE, 'shrink-0 pb-6 pt-10')}>
        <h1 className="text-3xl font-bold">Chat</h1>
      </div>

      {/* THE BODY IS INSET TO THE SAME MEASURE AS THE HEADING, and until 2026-08-13 it was
          not — the two panes ran to the edges of the window while the h1 above them and
          every other page in the app stopped at 6xl. That is what made this page read as a
          different app rather than a different screen. `pb-10` finishes it: `PageShell`
          gives every page `py-10`, so without it the panel jammed into the bottom of the
          viewport where every other page's content stops short of it.

          `flex-col` because ChatShell's pane row is a `flex-1` child and this is now its
          parent; `min-h-0` for the reason the row's own comment gives, which is that a flex
          child will not shrink below its content height without it and the panes would
          scroll the page instead of themselves. */}
      <div className={cn(PAGE_MEASURE, 'flex min-h-0 flex-1 flex-col pb-10')}>
        {familyRoom ? (
          <ChatShell
            initialRooms={rooms}
            familyRoomId={familyRoom.id}
            currentUserId={user.id}
            familyMembers={familyMembers}
            zone={zone}
          />
        ) : (
          <div className="mx-auto max-w-lg space-y-2 py-16 text-center">
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
    </div>
  )
}
