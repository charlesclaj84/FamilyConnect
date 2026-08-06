/**
 * Who the next `createClient()` call answers as.
 *
 * A server action reads its caller from a cookie. There is no cookie here, so
 * the harness sets the actor and the `@/lib/supabase/server` stub builds a
 * client carrying that user's real JWT — issued by the real auth server, so RLS
 * sees a genuine `auth.uid()`.
 */
let actor = null

/** @param {{label: string, userId: string, accessToken: string, refreshToken: string} | null} next */
export function setActor(next) {
  actor = next
}

export function currentActor() {
  return actor
}

/** Run `fn` as `who`, restoring the previous actor afterwards. */
export async function as(who, fn) {
  const previous = actor
  actor = who
  try {
    return await fn()
  } finally {
    actor = previous
  }
}
