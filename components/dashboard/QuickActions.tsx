import Link from 'next/link'
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
          return (
            <Link
              key={id}
              href={meta.href}
              className="flex flex-col items-center gap-2 rounded-2xl border bg-background px-2 py-4 text-center text-xs font-medium text-card-foreground transition-shadow hover:shadow-[var(--shadow-card)]"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-full ${ACCENT_CHIP[meta.accent]}`}>
                <Icon className="h-5 w-5" />
              </span>
              {meta.label}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
