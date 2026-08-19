import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { todayLocal } from '@/lib/date-utils'
import { PageShell } from '@/components/layout/PageShell'
import { getMyGatheringTasks } from '@/app/actions/gatherings'
import { MyTasksClient } from '@/components/gatherings/MyTasksClient'

export const metadata = { title: 'My Gathering Tasks' }

/**
 * `/gatherings/my-tasks` — every gathering task assigned to the caller, across every
 * gathering, with the form to answer each one.
 *
 * ── TWO GATES, AND THEY ARE ASKING DIFFERENT QUESTIONS ──────────────────────────────
 * `requireView(user.id, 'gatherings/my-tasks')` is §1's preamble and it is doing three jobs
 * at once: the permission gate, the tier gate (folded into `requireView`, so a page cannot
 * forget it) and the removed-family gate. It resolves with `can()`, which is true for scope
 * `'own'` — and unlike a family-wide screen there is nothing to correct with a `canAny`
 * follow-up, because `'own'` is *exactly* what this page shows. Every row on it is a task
 * assigned to the caller.
 *
 * `getMyGatheringTasks` then gates itself with `requireMember()` rather than with this key,
 * which its own header argues out: answering a task somebody handed you is self-service by
 * definition, the same class as an RSVP or a chat message, and gating the ROWS on a view
 * grant would let a family switch off a member's own to-do list. So the key hides the SCREEN
 * (and the rail item, through `viewableResources()`), and membership decides the rows.
 *
 * ── NOTHING IS FETCHED AND THEN HIDDEN ──────────────────────────────────────────────
 * There is one query and one grant, so §5 costs nothing here: the action returns only the
 * caller's own tasks, and it reads them on the USER client — `gathering_tasks`'s SELECT policy
 * carries `assignee_id = auth_person_id()` as its `self_expr`, which is what admits a member's
 * own task even in a family that has restricted `gatherings` view to nobody.
 *
 * ── `today` IS RESOLVED HERE, ONCE ──────────────────────────────────────────────────
 * The client marks an overdue task, which is a comparison against the current date, and a
 * component that reads the clock during render is what `react-hooks/purity` flags. It is also
 * the wrong place for it: two cards resolving `new Date()` separately can straddle midnight.
 * `todayLocal()` is a `YYYY-MM-DD` string and every comparison downstream is lexicographic,
 * which is the one date comparison in this codebase that cannot be wrong by a day.
 */
export default async function MyGatheringTasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'gatherings/my-tasks')

  const tasks = await getMyGatheringTasks()

  return (
    <PageShell className="space-y-8">
      <div>
        <h1 className="mb-1 text-3xl font-bold">My Gathering Tasks</h1>
        <p className="text-muted-foreground">
          Everything the family has asked you to do for a gathering, soonest deadline first.
          Send an answer back and an organizer reviews it — if they need something changed,
          their notes appear here with the task.
        </p>
      </div>

      <MyTasksClient initialTasks={tasks} today={todayLocal()} />
    </PageShell>
  )
}
