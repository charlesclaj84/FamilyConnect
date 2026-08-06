/**
 * Stands in for `@/lib/supabase/server`.
 *
 * The real one builds a client from the request's cookies. This one builds the
 * same kind of client — anon key, user JWT — from the actor the harness has set.
 * That distinction is the whole reason the suite is meaningful: the token is a
 * real one issued by the local auth server, so `auth.uid()` inside every RLS
 * policy resolves to a genuine user, and PostgREST applies the policies exactly
 * as it would in production.
 *
 * A fresh client per call, matching the real module. Sharing one would let a
 * session set for family B leak into a request made as family A — the precise
 * confusion these tests exist to detect.
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { currentActor } from '../actor.mjs'

export async function createClient() {
  const actor = currentActor()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Supabase env not loaded — import tests/rls/env.mjs first')

  const client = createSupabaseClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    // Set explicitly so PostgREST carries the user's JWT even before the auth
    // client has settled. Anonymous when there is no actor.
    global: actor ? { headers: { Authorization: `Bearer ${actor.accessToken}` } } : {},
  })

  if (actor) {
    // Gives `supabase.auth.getUser()` — which most actions call first — a session
    // to read, so the action resolves the caller the same way it does in prod.
    await client.auth.setSession({
      access_token: actor.accessToken,
      refresh_token: actor.refreshToken,
    })
  }

  return client
}
