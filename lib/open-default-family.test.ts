import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

/**
 * The one thing this wrapper promises: a sign-in cannot be stopped by it.
 *
 * ── WHY IT IS WORTH A TEST AT ALL, GIVEN IT IS FIVE LINES ──────────────────────────
 * Because the five lines it replaced were four lines and they broke login. `await
 * openDefaultFamily()` sat on the critical path of every sign-in with nothing around it, on
 * the strength of a doc comment saying the action "never throws" — which was true of its BODY
 * and false of the CALL. A server action is a `fetch`, and Next rejects one whose action id
 * the running build does not recognise, which is what a page loaded across a deploy posts.
 *
 * So the assertion is not about arithmetic; it is about a promise. `lib/**` is where
 * `npm test` can reach, the action is mocked because loading a `'use server'` module needs
 * the Next compiler, and what is left is exactly the claim: it resolves, whatever happens.
 *
 * MUTATION-CHECKED. Remove the `try/catch` from `openDefaultFamilySafely` and the first two
 * cases go red with an unhandled rejection — which is the shape the browser saw.
 */

const openDefaultFamily = vi.hoisted(() => vi.fn())
vi.mock('@/app/actions/family', () => ({ openDefaultFamily }))

const { openDefaultFamilySafely } = await import('@/lib/open-default-family')

describe('openDefaultFamilySafely', () => {
  let errors: unknown[][]
  beforeEach(() => {
    errors = []
    openDefaultFamily.mockReset()
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { errors.push(args) })
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('resolves when the action call REJECTS — the deploy-skew case that broke sign-in', async () => {
    // The real message Next gives for an action id the running build has never seen. It
    // arrives as a rejection rather than as a return value, which is the whole point: nothing
    // inside the action can catch it.
    openDefaultFamily.mockRejectedValue(new Error('Failed to find Server Action "7f2c…"'))
    await expect(openDefaultFamilySafely()).resolves.toBeUndefined()
    expect(errors).toHaveLength(1)
  })

  it('resolves when the action throws synchronously', async () => {
    openDefaultFamily.mockImplementation(() => { throw new TypeError('fetch failed') })
    await expect(openDefaultFamilySafely()).resolves.toBeUndefined()
    expect(errors).toHaveLength(1)
  })

  it('resolves and says nothing when the action succeeds', async () => {
    openDefaultFamily.mockResolvedValue(undefined)
    await expect(openDefaultFamilySafely()).resolves.toBeUndefined()
    expect(errors).toHaveLength(0)
  })

  it('AWAITS the action rather than firing it off', async () => {
    // Not a detail. The page being navigated to resolves its family SERVER-SIDE, so a call
    // still in flight when `router.push` runs renders the family the member was last in —
    // the exact bug `20260902000002` fixed, reappearing as a race. A `void` call would pass
    // every assertion above and lose this.
    let settled = false
    openDefaultFamily.mockImplementation(
      () => new Promise<void>(resolve => setTimeout(() => { settled = true; resolve() }, 5)),
    )
    await openDefaultFamilySafely()
    expect(settled).toBe(true)
  })
})
