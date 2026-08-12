import { LoginForm } from '@/components/auth/LoginForm'
import { StructuredData } from '@/components/marketing/StructuredData'
import { authPageGraph } from '@/lib/structured-data'
import { APP_NAME } from '@/lib/brand'

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
      <LoginForm linkError={error ?? ''} nextParam={next} />
    </>
  )
}
