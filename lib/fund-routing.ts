// Pure fund-routing engine. Splits a single dues payment across the family's
// funds using a family-wide percentage allocation, governed by per-fund
// priority + minimum balance with a WATERFALL REDIRECT:
//
//   Until a higher-priority fund reaches its minimum balance, its share is
//   filled FIRST and lower-priority funds get $0. Once minimums are met, the
//   remainder is split by allocation percentage.
//
// Example: Reunion (priority 1, min $2,000, 70%) + College (priority 2, 30%),
// both at $0. A $500 payment goes 100% to Reunion until it reaches $2,000,
// after which payments split 70/30.

export interface RoutingFund {
  id: string
  priority: number          // lower = filled first
  minimum_cents: number
  basis_points: number      // allocation share, 0–10000
  balance_cents: number     // current balance BEFORE this payment
}

export interface RoutedAllocation {
  fund_id: string
  amount_cents: number
}

/**
 * Effective allocation in basis points per fund. When nothing has been
 * configured (every stored allocation is 0), the highest-priority fund
 * defaults to 100% and the rest to 0% — matching the routing engine's
 * "park the remainder in the top fund" behavior.
 *
 * @param fundsByPriority funds already ordered by priority (top first)
 */
export function effectiveAllocations<T extends { id: string }>(
  fundsByPriority: T[],
  storedBpsByFund: Map<string, number>,
): Map<string, number> {
  const result = new Map<string, number>()
  for (const f of fundsByPriority) result.set(f.id, storedBpsByFund.get(f.id) ?? 0)
  const total = [...result.values()].reduce((s, b) => s + b, 0)
  if (total === 0 && fundsByPriority.length > 0) {
    result.set(fundsByPriority[0].id, 10000)
  }
  return result
}

/**
 * Split `amountCents` across `funds`. The returned amounts always sum EXACTLY
 * to `amountCents` (no cents created or dropped). Funds receiving $0 are omitted.
 * Caller is responsible for passing only ACTIVE funds.
 */
export function routeContribution(amountCents: number, funds: RoutingFund[]): RoutedAllocation[] {
  const total = Math.max(0, Math.floor(amountCents))
  if (total === 0 || funds.length === 0) return []

  // Deterministic order: priority asc (caller pre-sorts ties by created_at,id).
  const ordered = [...funds].sort((a, b) => a.priority - b.priority)
  const alloc = new Map<string, number>(ordered.map(f => [f.id, 0]))
  let remaining = total

  // ── Phase 1: waterfall — fill each fund's minimum strictly by priority ──
  for (const f of ordered) {
    if (remaining <= 0) break
    const gap = Math.max(0, f.minimum_cents - f.balance_cents)
    if (gap > 0) {
      const take = Math.min(gap, remaining)
      alloc.set(f.id, (alloc.get(f.id) ?? 0) + take)
      remaining -= take
    }
  }

  // ── Phase 2: percentage split of the remainder among funds meeting minimum ──
  if (remaining > 0) {
    const eligible = ordered.filter(f => f.balance_cents + (alloc.get(f.id) ?? 0) >= f.minimum_cents)
    const totalBps = eligible.reduce((s, f) => s + Math.max(0, f.basis_points), 0)

    if (eligible.length === 0 || totalBps <= 0) {
      // No usable allocation config — park the remainder in the top-priority fund.
      const target = eligible[0] ?? ordered[0]
      alloc.set(target.id, (alloc.get(target.id) ?? 0) + remaining)
    } else {
      // Largest-remainder apportionment so cents sum exactly.
      let assigned = 0
      const fracs: { id: string; frac: number; priority: number }[] = []
      for (const f of eligible) {
        const bps = Math.max(0, f.basis_points)
        const exact = (remaining * bps) / totalBps
        const floorVal = Math.floor(exact)
        alloc.set(f.id, (alloc.get(f.id) ?? 0) + floorVal)
        assigned += floorVal
        fracs.push({ id: f.id, frac: exact - floorVal, priority: f.priority })
      }
      let leftover = remaining - assigned
      fracs.sort((a, b) => b.frac - a.frac || a.priority - b.priority)
      for (let i = 0; leftover > 0 && i < fracs.length; i++, leftover--) {
        alloc.set(fracs[i].id, (alloc.get(fracs[i].id) ?? 0) + 1)
      }
    }
  }

  return ordered
    .map(f => ({ fund_id: f.id, amount_cents: alloc.get(f.id) ?? 0 }))
    .filter(a => a.amount_cents > 0)
}
