import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { APP_NAME } from '@/lib/brand'

/**
 * `noindex`, which is what app/sitemap.ts's intent already amounts to: it leaves
 * this page out "for a duller reason — nobody searches for it". Excluded from the
 * sitemap but still indexable is a half-signal, and what it earns is a thin page
 * in the index competing with /login for the same brand queries. A sitemap is an
 * invitation, not an instruction; this is the instruction.
 *
 * ── Three audit findings on this page are DECLINED, and here is why ──────────
 * An SEO crawler scores every page against the same checklist and cannot see that
 * `noindex` was chosen. Left unrecorded, each of these comes back every time
 * somebody runs one.
 *
 *  * **"Add a canonical."** Google documents `rel=canonical` and `noindex` as
 *    contradictory signals and advises against combining them: a canonical says
 *    "this URL is the one to index", which is the opposite of what the robots tag
 *    says. There is nothing here to consolidate anyway — the page takes no query
 *    string, so it has exactly one address.
 *  * **"Add JSON-LD."** Structured data exists to shape a search RESULT. This page
 *    is not permitted to produce one. `lib/structured-data.ts` also has no node
 *    that would be honest here: `authPageGraph` describes a page worth ranking,
 *    and /login and /register are the two that are.
 *  * **"Remove the noindex."** That is the decision itself, taken above.
 *
 * ── What was NOT declined ────────────────────────────────────────────────────
 * The title and the description were both real, and both are fixed here.
 *
 * The TITLE was 'Reset Password', which `title.template` renders as a 24-character
 * "Reset Password — GENORRA". Length is beside the point on a noindex page; the
 * browser tab, the history entry and the bookmark are not, and "Reset Password"
 * beside eleven other tabs does not say whose. This renders at 43.
 *
 * The DESCRIPTION was inherited. With none of its own, this page fell through to
 * the root layout's `APP_SEO_DESCRIPTION` — the same sentence the landing page
 * carries, which is what an audit flagged as two pages sharing one description.
 * Inheriting was never right regardless of the audit: a snippet advertising the
 * whole product under "Reset Password" describes a different page, and this string
 * is also what a link preview shows if anyone ever pastes the URL into a chat.
 */
export const metadata = {
  title: 'Reset Your Family Portal Password',
  description:
    `Forgotten your ${APP_NAME} password? Enter the email address on your family account and we will send you a link to set a new one.`,
  robots: { index: false, follow: true },
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
