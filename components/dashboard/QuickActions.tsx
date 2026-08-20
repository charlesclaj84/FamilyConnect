'use client'

import Link from 'next/link'
import { InviteMemberDialog } from '@/components/invitations/InviteMemberDialog'
import { ACCENT_CHIP, QUICK_ACTION_META, type QuickActionId } from '@/components/dashboard/tiles'

/**
 * The Golden Master's Quick Actions strip — round accent chips over a caption.
 *
 * WHY IT CAN BE EMPTY, AND WHAT THAT MEANS. The kit draws six buttons; three of them
 * point at features that have not shipped and are absent from `QUICK_ACTION_META`
 * entirely. Of the three that remain, two need a grant most members do not hold. So a
 * rank-and-file member typically sees ONE button, and the card sizes itself to that
 * rather than padding the row out to six.
 *
 * When nothing survives the card does not render. There is no "you have no quick
 * actions" state, because that sentence tells a member something about the permission
 * model rather than about their family, and the rest of the page still works.
 *
 * THE GATE IS NOT HERE. `actions` arrives already filtered by the page — grant AND
 * feature status, both resolved server-side. These are links, so there is nothing to
 * leak in the payload beyond the fact that a route exists; the reason the filtering
 * still happens on the server is that a button somebody cannot use is a worse offer than
 * no button, and the destination would 404 on them.
 *
 * ── WHY THIS IS A CLIENT COMPONENT, since 2026-08-13 ────────────────────────────────
 * One action stopped being a link. "Add Member" used to navigate to `/admin/members` and
 * leave the member to find the invite button when they got there — a caption with a verb
 * on it that did nothing but change the address bar. It now opens `InviteMemberDialog`
 * in place, which is the control it was always naming.
 *
 * It opens the MY FAMILIES version of that dialog, not the administration one:
 * `preApproved` is false, so the invitee joins the approval queue like anybody else. The
 * two versions differ in exactly that prop, and it is a REQUEST rather than an
 * instruction — `create_family_invitation` grants pre-approval only to a caller holding
 * admin/approvals:edit at scope 'any' — so this is a choice about what the dialog
 * PROMISES, not about what it can do. Promising the weaker thing is right for a button
 * on a landing screen: the strong version lives on Members, next to the queue it skips.
 *
 * No `familyCode`, so the invitation is into the family being viewed. That is the one
 * thing this differs from the My Families row in, and it differs because there is only
 * one family in view here.
 */
export function QuickActions({ actions }: { actions: QuickActionId[] }) {
  if (actions.length === 0) return null

  return (
    <section className="rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-4 text-lg">Quick Actions</h2>
      {/* `auto-fill` with a floor, not a fixed column count: the number of surviving
          buttons is between one and three today and will grow to six as features ship,
          and this reflows for any of those without a breakpoint per case. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3">
        {actions.map(id => {
          const meta = QUICK_ACTION_META[id]
          const Icon = meta.icon
          // ONE SET OF TILE MARKUP for both shapes. The anchor and the button differ in
          // the element and in nothing else, so the face of the tile is built once —
          // otherwise the day somebody restyles the chip, half the row changes.
          const face = (
            <>
              <span className={`flex h-11 w-11 items-center justify-center rounded-full ${ACCENT_CHIP[meta.accent]}`}>
                <Icon className="h-5 w-5" />
              </span>
              {meta.label}
            </>
          )
          const tile =
            'flex flex-col items-center gap-2 rounded-2xl border bg-background px-2 py-4 text-center text-xs font-medium text-card-foreground transition-shadow hover:shadow-[var(--shadow-card)]'

          if (id === 'add-member') {
            return (
              <InviteMemberDialog
                key={id}
                preApproved={false}
                renderTrigger={open => (
                  <button type="button" onClick={open} className={`${tile} w-full`}>
                    {face}
                  </button>
                )}
              />
            )
          }

          return (
            <Link key={id} href={meta.href} className={tile}>
              {face}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
