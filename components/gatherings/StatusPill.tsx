import { cn } from '@/lib/utils'
import {
  GATHERING_STATUS_LABEL,
  GATHERING_TASK_STATUS_LABEL,
  type GatheringStatus,
  type GatheringTaskStatus,
} from '@/lib/gatherings'
import {
  GATHERING_PILL_SHAPE,
  GATHERING_STATUS_PILL,
  GATHERING_TASK_STATUS_PILL,
} from '@/components/gatherings/status'

/**
 * The two status pills, as components, so six screens render one shape.
 *
 * ── WHY A COMPONENT AND NOT JUST THE TWO RECORDS ────────────────────────────────────
 * `components/gatherings/status.ts` already holds the CLASSES and `lib/gatherings.ts`
 * already holds the WORDS, and a call site could compose them itself — three of them did
 * while this feature was being written, and that is precisely the problem. The composition
 * is the thing that drifts: one screen forgets `GATHERING_PILL_SHAPE` and renders coloured
 * text where its neighbour renders a pill, another reaches for the word "Denied" because
 * "Needs another look" reads oddly in a narrow column. Naming the composition once means a
 * status looks the same on `/gatherings`, `/gatherings/[id]`, `/gatherings/my-tasks`,
 * `/gatherings/calendar`, `/admin/gatherings` and `/admin/gatherings/[id]`, and there is nothing left
 * at a call site to get wrong.
 *
 * ── NO `'use client'`, DELIBERATELY ─────────────────────────────────────────────────
 * These are two spans and a lookup. A module with no directive is compiled for whichever
 * side imports it, so the server pages render pills without shipping anything and the
 * client components (`GatheringsClient`, the my-tasks form, the organizer console) import
 * the same function rather than a second copy. Adding `'use client'` here would put both
 * records and both label tables into every bundle that touches a pill for no gain.
 *
 * ── NO COLOUR, NO LABEL, NO HEX ─────────────────────────────────────────────────────
 * Everything visible here arrives from the two modules above. That is the whole point:
 * AGENTS.md's "Colours live in one place" is kept by there being nowhere in this file a
 * colour could be typed, and the "denied" label question is settled by there being no
 * string literal to change.
 */

/** A gathering's own lifecycle — Planning / Scheduled / Complete / Cancelled. */
export function GatheringStatusPill({ status }: { status: GatheringStatus }) {
  return (
    <span className={cn(GATHERING_PILL_SHAPE, GATHERING_STATUS_PILL[status])}>
      {GATHERING_STATUS_LABEL[status]}
    </span>
  )
}

/**
 * A task's state — Not started / Waiting for review / Approved / Needs another look.
 *
 * "Needs another look" is `denied`, and a component must not relabel it: the whole feedback
 * loop is that the member reads the organizer's notes and submits again, and a pill saying
 * "Denied" beside a note asking for the caterer's phone number tells them the wrong thing
 * about what to do next. `lib/gatherings.ts` records that decision beside the word.
 */
export function TaskStatusPill({ status }: { status: GatheringTaskStatus }) {
  return (
    <span className={cn(GATHERING_PILL_SHAPE, GATHERING_TASK_STATUS_PILL[status])}>
      {GATHERING_TASK_STATUS_LABEL[status]}
    </span>
  )
}
