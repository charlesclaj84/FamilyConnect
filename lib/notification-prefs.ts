/**
 * Which notifications a member may be sent, down which channel, and what they have said
 * about it.
 *
 * ── A PURE MODULE, FOR `lib/sms/consent.ts`'s REASON ───────────────────────────────
 * `app/actions/notification-prefs.ts` is `'use server'`, so nothing here could live there and
 * be shared — and this rule is consulted from two directions: the screen that renders the grid,
 * and every future fan-out that is about to send something. A decision about whether to contact
 * a hundred and forty relatives is a pure function over stored facts, decidable from arguments
 * and tested by value under `npm test`, rather than a condition assembled at whichever call
 * site is about to send.
 *
 * NOTHING HERE READS THE WORLD. No clock, no database, no provider.
 *
 * ── THE CATALOGUE IS DATA, AND THE DEFAULT IS PART OF IT ───────────────────────────
 * A notification is a ROW in `NOTIFICATIONS` and a channel is a COLUMN in `CHANNELS`, so the
 * screen is a grid over the two and a new notification is one entry rather than a migration.
 * The per-cell `default` is what makes an absent preference row answerable: no row means the
 * catalogue's answer, which is the only way a member who has never opened the screen can be
 * contacted correctly.
 *
 * ── `'opt-out'` AND `'opt-in'` ARE THE TWO DEFAULTS, AND THE WORDS ARE THE MEANING ─
 * `'opt-out'` is on unless the member turns it off. `'opt-in'` is off unless they turn it on.
 * Which one a cell gets is a decision with consequences and is stated per cell rather than
 * inferred from the channel: email for a safety check-in is `'opt-out'` because the whole point
 * of a check-in is that it reaches people, and SMS is `'opt-in'` because a text costs money and
 * carries the TCPA exposure `lib/sms/consent.ts` is written around.
 *
 * ── AND `'unavailable'` IS A THIRD ANSWER, NOT A DISABLED SECOND ───────────────────
 * A channel that does not exist yet renders as absent rather than as a switch nobody can move.
 * Push is that today. Keeping it in the catalogue rather than out of it is deliberate: the
 * column exists on the screen, says what it is waiting for, and cannot be quietly forgotten
 * when it does arrive.
 */

/** How a member can be reached. One per column of the grid. */
export const CHANNELS = ['email', 'sms', 'push'] as const
export type NotificationChannel = (typeof CHANNELS)[number]

export const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  push: 'Push Notification',
}

/**
 * What a cell is, before the member has said anything.
 *
 *   `opt-out`      on by default; the control turns it off.
 *   `opt-in`       off by default; the control turns it on.
 *   `unavailable`  the channel is not built for this notification. No control at all.
 */
export type ChannelDefault = 'opt-out' | 'opt-in' | 'unavailable'

export interface NotificationType {
  /** Stored in `person_notification_prefs.notification_key`. Never renamed lightly. */
  key: string
  /** The grid's first column. */
  label: string
  /** One sentence under the label, saying what would actually arrive. */
  description: string
  defaults: Record<NotificationChannel, ChannelDefault>
}

/**
 * Everything a family can be told about, in the order the grid lists them.
 *
 * ── ONE ENTRY TODAY, AND THAT IS THE POINT OF THE SHAPE ────────────────────────────
 * Safety Check is the only thing in this product that reaches out to a member rather than
 * waiting to be read — `notifications` (the bell) is pull, and email distributions are a
 * separate deliberate act by a sender. So the grid starts at one row, and a second row is an
 * entry here plus a call to `mayNotify` at the send site.
 *
 * **DO NOT ADD A ROW FOR SOMETHING THAT DOES NOT SEND.** A switch nothing consults reads as a
 * control being honoured — the rule AGENTS.md states about `permission_resources.actions`,
 * which is the same failure one layer down. Before adding one, name the code that will read it.
 */
export const NOTIFICATIONS: readonly NotificationType[] = [
  {
    key: 'safety_check',
    label: 'Safety Check',
    description:
      'Your family raises a check-in during a storm, an evacuation or an emergency, and asks '
      + 'whether you are safe.',
    defaults: {
      // ON BY DEFAULT, and it is the one cell in this table where that is a safety decision
      // rather than a convenience. A check-in that reaches nobody is the failure mode; a member
      // who does not want them can say so in one press, and the address is already on file.
      email: 'opt-out',
      // OFF BY DEFAULT, ALWAYS, for a text. `lib/sms/consent.ts`'s header carries the figure:
      // US TCPA statutory damages are $500–$1,500 per message. Consent to be texted is an act
      // somebody performs, never a default they failed to notice.
      sms: 'opt-in',
      // Nothing sends a push notification in this product. See the module header on why the
      // column is here at all.
      push: 'unavailable',
    },
  },
]

/** One stored answer. Absent means the catalogue's default. */
export interface NotificationPref {
  notificationKey: string
  channel: NotificationChannel
  optedIn: boolean
}

export function notificationByKey(key: string): NotificationType | null {
  return NOTIFICATIONS.find(n => n.key === key) ?? null
}

export function channelDefault(key: string, channel: NotificationChannel): ChannelDefault {
  return notificationByKey(key)?.defaults[channel] ?? 'unavailable'
}

/**
 * Whether this member would be sent this notification down this channel.
 *
 * ── THE STORED ROW WINS, AND ITS ABSENCE IS NOT `false` ────────────────────────────
 * An absent row means "has not said", which resolves to the catalogue's default — so an
 * `'opt-out'` cell is TRUE for a member who has never opened the screen. Reading absence as
 * `false` is the bug this function exists to prevent: it would silently make every default-on
 * notification default-off, and nothing would report it, because a notification nobody
 * receives looks exactly like a notification nobody triggered.
 *
 * ── AN `'unavailable'` CELL IS ALWAYS FALSE, WHATEVER IS STORED ────────────────────
 * A row could exist from before a channel was retired, or from a hand-written insert. The
 * catalogue is the authority on whether a channel is real, so it decides first.
 */
export function prefEnabled(
  prefs: readonly NotificationPref[],
  key: string,
  channel: NotificationChannel,
): boolean {
  const fallback = channelDefault(key, channel)
  if (fallback === 'unavailable') return false
  const stored = prefs.find(p => p.notificationKey === key && p.channel === channel)
  if (stored) return stored.optedIn
  return fallback === 'opt-out'
}

/**
 * Whether a send should go ahead — the one function a fan-out calls.
 *
 * TWO CONDITIONS, AND BOTH ARE NECESSARY. The member's preference says whether they want it;
 * `reachable` says whether we could deliver it at all — an address on file, a number we may
 * text. Neither implies the other, and collapsing them is how a screen comes to say "on" over
 * a channel that has nowhere to send.
 *
 * `reachable` is resolved by the CALLER, from the world, and passed in — which is what keeps
 * this module pure and testable. For SMS that answer is `mayTextPerson` in
 * `lib/sms/consent.ts`, which is a stricter question than a preference and stays where it is.
 */
export function mayNotify(input: {
  prefs: readonly NotificationPref[]
  key: string
  channel: NotificationChannel
  reachable: boolean
}): boolean {
  if (!input.reachable) return false
  return prefEnabled(input.prefs, input.key, input.channel)
}
