import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'
import { AuthAside, AsideTerm } from '@/components/auth/AuthAside'
import { StructuredData } from '@/components/marketing/StructuredData'
import { authPageGraph } from '@/lib/structured-data'
import { APP_LEAD, APP_NAME } from '@/lib/brand'

/**
 * A self-referencing canonical, for the reason set out on the landing page: this
 * build answers on both genorra.com and the `.vercel.app` alias, and without one
 * the two copies of this page compete.
 *
 * It also collapses the `?next=` variants. `/login?next=/invite/<token>` is a real
 * link the register page emits, and every distinct value of that parameter is a
 * separate URL to a crawler — one of which would carry an invitation token into
 * the index. The canonical names the bare path as the one page they all are.
 *
 * The description is this page's own rather than the site-wide one: a snippet
 * describing the whole product under a "Sign In" title reads as a mismatch, and
 * Google rewrites snippets it judges unrepresentative anyway.
 */
/**
 * LENGTHENED 2026-08-12, from the bare 'Sign In'.
 *
 * `title.template` appends ` — ${APP_NAME}`, so 'Sign In' rendered as a 17-character
 * title — half of what a search result will display, and carrying none of the words
 * anybody types. A title is the strongest on-page signal there is and the one line a
 * searcher reads before deciding, so the words that describe the thing belong in it.
 *
 * Still short enough not to be truncated: this renders at 39 characters against the
 * ~60 Google shows. Do not push it past 60 — a cut title is worse than a plain one.
 */
const PAGE_NAME = 'Sign In to Your Family Portal'
const PAGE_DESCRIPTION =
  `Sign in to your ${APP_NAME} family portal to plan reunions, manage dues, share photos and keep your family connected.`

export const metadata = {
  title: PAGE_NAME,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/login' },
}

/**
 * THE QUERY STRING IS READ HERE, NOT IN THE FORM, and that is the whole reason this page
 * is a server component now.
 *
 * `LoginForm` used to call `useSearchParams()`, which opts a client component out of the
 * static prerender — so it had to sit inside `<Suspense fallback={null}>`, and `null` is
 * what the server sent. The response for /login contained no heading and almost no text;
 * both arrived only after hydration. Passing the parameters down instead puts the entire
 * page in the initial HTML, which is what a crawler, a screen reader on a slow link and a
 * scripts-disabled browser all read. See the note on `LoginForm`.
 *
 * The `Suspense` boundary is gone with it: nothing here suspends any more.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const { error, next } = await searchParams

  return (
    <>
      <StructuredData
        graph={authPageGraph({
          path: '/login',
          // Matches the visible h1 in LoginForm, not the <title>. schema.org `name` is a
          // claim about what the page IS, and the audit's "one H1 that states what the
          // page is about" is the same claim in HTML — they must not disagree.
          name: 'Welcome back',
          description: PAGE_DESCRIPTION,
        })}
      />
      {/* The auth layout's <main> is `flex items-center justify-center`, which is a ROW.
          Two siblings there would sit side by side, so the column is made here. `max-w-md`
          matches the card's own, so the panel below lines up with it rather than
          overhanging. */}
      <div className="w-full max-w-md space-y-6">
        <LoginForm linkError={error ?? ''} nextParam={next} />

        {/* ── Orientation, and the four reasons a sign-in fails ──────────────────
            TWO AUDIENCES. Someone who followed a link from a relative and has never
            heard of the product needs to know what they are signing in TO before
            typing a password; and a search result for a bare form has nothing to
            describe, which is what an audit meant by "~2 words of visible text" and
            then, after a first pass, by "~72 words".

            THE TROUBLESHOOTING LIST IS NOT PADDING. Every entry is a state this app
            genuinely puts people in and then explains nowhere: email confirmation is
            on (`enable_confirmations` in supabase/config.toml), joining by family code
            lands pending until an administrator admits you (the stamp trigger in
            20260806000011, and the holding screen in app/(protected)/dashboard), and
            an invitation has to be opened from its own link because the token is what
            binds the account to the family. Each of those produces a person staring at
            a sign-in form that will not let them in, and until now the page said
            nothing at all about any of them.

            No claim here that is not made somewhere it can be checked — the same rule
            lib/structured-data.ts is written to. */}
        <AuthAside heading="New here, or cannot get in?">
          <p>
            {APP_NAME} is a private site for one extended family — {APP_LEAD.toLowerCase()}{' '}
            Members plan reunions and events together, keep track of dues and
            contributions, share photographs, and build out the family tree in a place
            only the family can see. There is no public profile, and one family cannot
            see another&apos;s pages at all.
          </p>

          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <AsideTerm>Forgotten your password?</AsideTerm>{' '}
              <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                Ask for a reset link
              </Link>{' '}
              and set a new one.
            </li>
            <li>
              {/* "Look in your spam folder before trying again" until 2026-08-17, which
                  described a loop with no exit — trying again is refused for the same
                  reason every time. `LoginForm` now offers to resend on exactly this
                  refusal, so the bullet says where the offer appears. The spam advice
                  stays first: a link delivered and overlooked is the common case, and one
                  more email does not help with it. */}
              <AsideTerm>Never confirmed your email?</AsideTerm> Registering sends a
              confirmation link, and an account stays inactive until it is opened. Look in
              your spam folder first — then sign in above, and the form will offer to send
              the link again.
            </li>
            <li>
              <AsideTerm>Joined with a family code?</AsideTerm> An administrator of that
              family admits new members. You can sign in while you wait — you will see a
              holding page until they do.
            </li>
            <li>
              <AsideTerm>Invited by email?</AsideTerm> Open the link in the invitation
              rather than signing in here. It knows which family you are joining, and it
              will bring you back to the invitation once you have signed in.
            </li>
            <li>
              <AsideTerm>In the wrong family?</AsideTerm> One account can belong to more
              than one — marriage puts most people in two. Sign in with it as usual and
              switch families from the header.
            </li>
          </ul>

          <p>
            No account yet?{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Create a free one
            </Link>
            , or{' '}
            <Link href="/" className="font-medium text-primary hover:underline">
              read what {APP_NAME} does
            </Link>{' '}
            if you were sent here and are not sure what this is.
          </p>
        </AuthAside>
      </div>
    </>
  )
}
