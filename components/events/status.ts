import type { AdminEvent, EventAssignment } from '@/app/actions/admin/events'

/**
 * An event's lifecycle badge. Consumed by the admin event list
 * (`components/admin/AdminEventsClient.tsx`) and the event detail screen
 * (`components/admin/AdminEventDetailClient.tsx`), which held two byte-identical copies.
 *
 * Draft is muted because a draft is not yet anything; published is the gold surface because
 * it is the state asking members to respond; approved is affirm; cancelled reads as the
 * destructive tint rather than a filled pill, so a cancelled row does not shout louder than
 * a live one.
 */
export const EVENT_STATUS_PILL: Record<AdminEvent['status'], string> = {
  draft:     'bg-muted text-muted-foreground',
  published: 'bg-brand-legacy text-brand-on-legacy',
  approved:  'bg-brand-affirm text-brand-on-affirm',
  cancelled: 'bg-destructive/10 text-destructive',
}

/**
 * One set of assignment-response states in two visual languages: a filled pill on the
 * member's planning screen (`components/events/EventPlanningClient.tsx`) and bare text in the
 * admin assignment table (`components/admin/AdminEventDetailClient.tsx`). They are exported
 * side by side so a state cannot be recoloured on one screen and not the other — the two
 * tables were written separately and are the pair most likely to drift.
 */
export const ASSIGNMENT_STATUS_PILL: Record<EventAssignment['response_status'], string> = {
  pending:   'bg-muted text-muted-foreground',
  submitted: 'bg-brand-legacy text-brand-on-legacy',
  approved:  'bg-brand-affirm text-brand-on-affirm',
  cancelled: 'bg-destructive/10 text-destructive',
}

export const ASSIGNMENT_STATUS_TEXT: Record<EventAssignment['response_status'], string> = {
  pending:   'text-muted-foreground',
  // Bare gold cannot carry text on a pale ground, so the text language uses accent where the
  // pill language uses the legacy surface.
  submitted: 'text-brand-accent',
  approved:  'text-brand-affirm',
  cancelled: 'text-destructive',
}
