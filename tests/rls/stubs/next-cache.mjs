/**
 * `next/cache` outside a request scope.
 *
 * The actions call `revalidatePath` after a successful write; there is no render
 * to invalidate here. Calls are recorded rather than discarded so a test can
 * assert an action reached its revalidate — i.e. that it believed it succeeded.
 */
export const calls = []

export function revalidatePath(path, type) {
  calls.push({ fn: 'revalidatePath', path, type })
}

export function revalidateTag(tag) {
  calls.push({ fn: 'revalidateTag', tag })
}

export function unstable_cache(fn) {
  return fn
}

export function reset() {
  calls.length = 0
}
