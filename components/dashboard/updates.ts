import type { Notification } from '@/app/actions/notifications'
import type { FeedAnnouncement } from '@/app/actions/announcements'

/**
 * The Recent Updates feed: one list, two sources.
 *
 * WHY THE MERGE HAPPENS HERE and not in the component. Two reasons, and the second is
 * the one that matters: the page has to know how many rows it is going to render before
 * it renders them, and this is a rule about ordering rather than about markup — the sort
 * is the feature ("pinned stays at the top; unpinned falls into natural order"), so it
 * belongs somewhere it can be read and reasoned about without a browser. Same argument
 * as `lib/idle-timeout.ts` being plain TypeScript with no JSX.
 *
 * ANNOUNCEMENTS ARRIVE HERE INSTEAD OF IN A BANNER. They used to render as a card above
 * the dashboard grid with a localStorage dismissal, which meant the answer to "have I
 * read this" was different in every browser and could never be undone. They are rows
 * now, and the dismissal is a row of its own (20260813000001).
 */

export type UpdateItem =
  | {
      kind: 'notification'
      id: string
      title: string
      body: string | null
      link: string | null
      /** ISO timestamp used for ordering and for the relative label. */
      at: string
      unread: boolean
    }
  | {
      kind: 'announcement'
      id: string
      title: string
      body: string | null
      link: string | null
      at: string
      author: string | null
      /** The family has it pinned and it has not expired. */
      familyPinned: boolean
      /** ...and this reader has not dismissed it. Only these ride at the top. */
      pinnedForMe: boolean
    }

/**
 * How many NON-pinned rows the card shows. Pinned announcements are additional and are
 * never truncated: a pin is a deliberate act by an administrator that says "everybody
 * should see this", and dropping one off the bottom of a capped list would quietly
 * defeat it. The reader's own dismissal is what takes a pinned row out of the block —
 * which is the point of making that per-reader rather than per-browser.
 */
export const RECENT_UPDATES_LIMIT = 6

const time = (iso: string): number => new Date(iso).getTime()

/** Newest first. */
const byNewest = (a: UpdateItem, b: UpdateItem): number => time(b.at) - time(a.at)

export function toUpdateItem(n: Notification): UpdateItem {
  return {
    kind: 'notification',
    id: n.id,
    title: n.title,
    body: n.body,
    link: n.link,
    at: n.created_at,
    unread: !n.read_at,
  }
}

export function announcementToUpdateItem(a: FeedAnnouncement): UpdateItem {
  return {
    kind: 'announcement',
    id: a.id,
    title: a.title,
    body: a.body,
    // Every announcement has somewhere to go — the board carries the full text, which a
    // truncated row cannot. Notifications are the ones with a nullable link.
    link: '/community/announcements',
    at: a.published_at,
    author: a.author_name,
    familyPinned: a.pin_active,
    pinnedForMe: a.pinnedForMe,
  }
}

/*
 * `isFamilyPinned` LIVED HERE AND IS GONE, 2026-08-21.
 *
 * It was a byte-for-byte copy of `isPinActive` in app/actions/announcements.ts, written
 * because `pinnedForMe` is a conjunction and cannot be inverted to recover the family's half.
 * That was the right observation and the wrong remedy: the answer is now `pin_active` on the
 * row, resolved once by the action that reads it, so the expiry rule has one expression again.
 *
 * What it decided is unchanged — whether a dismissed row is offered "Pin again", since a row
 * the administrator has unpinned family-wide has nothing to put back.
 */

/**
 * Merge the two sources into the order the card renders.
 *
 *   1. Announcements this reader still has pinned, newest first.
 *   2. Everything else — notifications and dismissed or never-pinned announcements —
 *      interleaved strictly by date, capped at `limit`.
 *
 * The cap applies only to (2), for the reason on RECENT_UPDATES_LIMIT.
 */
export function mergeUpdates(
  notifications: Notification[],
  announcements: FeedAnnouncement[],
  limit: number = RECENT_UPDATES_LIMIT,
): UpdateItem[] {
  const items: UpdateItem[] = [
    ...notifications.map(toUpdateItem),
    ...announcements.map(announcementToUpdateItem),
  ]

  const pinned = items
    .filter(i => i.kind === 'announcement' && i.pinnedForMe)
    .sort(byNewest)
  const rest = items
    .filter(i => !(i.kind === 'announcement' && i.pinnedForMe))
    .sort(byNewest)
    .slice(0, limit)

  return [...pinned, ...rest]
}
