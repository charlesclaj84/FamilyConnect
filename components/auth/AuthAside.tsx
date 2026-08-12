import type { ReactNode } from 'react'

/**
 * The block of prose under an auth card — /login and /register.
 *
 * ── Why it is not inside the card ────────────────────────────────────────────
 * Both of these paragraphs started life in a `CardFooter`, and the card is the
 * task: sign in, register. Prose sitting in it competes with the fields for the
 * same visual weight, and every line added pushes the button further down a
 * phone. Below the card, in a quieter panel, someone who came to type a password
 * scrolls past it without reading, and someone who followed a relative's link
 * with no idea what this is finds the answer without hunting.
 *
 * ── Why it is a server component ─────────────────────────────────────────────
 * It is static text, and it used to live inside `LoginForm` and `RegisterForm`,
 * both `'use client'` — so every word shipped in the JavaScript bundle as well as
 * in the HTML. Nothing here is interactive. Moving it out puts it in the first
 * byte of the response, which is what a crawler, a screen reader on a slow link
 * and a scripts-disabled browser all read; see the note at the top of `LoginForm`
 * about what the page used to send.
 *
 * ── What belongs in it ───────────────────────────────────────────────────────
 * The same rule `lib/structured-data.ts` is written to, applied to prose: say
 * nothing here the product does not say somewhere it can be checked. Every claim
 * in the two call sites is traceable to the landing page's value cards, the
 * pricing table, or the registration flow itself.
 */
export function AuthAside({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section
      // One of these per page, so a constant id is safe. `aria-labelledby` rather
      // than `aria-label`: the heading is on screen either way, and duplicating it
      // into an attribute is how the two come to disagree.
      aria-labelledby="auth-aside-heading"
      className="rounded-xl border bg-card px-5 py-4 text-sm text-muted-foreground"
    >
      {/* h2, under the card's h1 — see the `as` prop on CardTitle. `text-xl` and not
          smaller: the base layer sets h1/h2 in Cormorant, which goes thin and hard to
          read below about 20px (the comment beside the rule in globals.css). */}
      <h2 id="auth-aside-heading" className="text-xl">{heading}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

/**
 * A lead-in on a list item — "Forgotten your password?" — in the body colour so it
 * separates from the muted prose around it.
 *
 * `<strong>` rather than a styled `<span>`: these genuinely are the important part
 * of the line, which is the element's own definition, and a screen reader may say so.
 */
export function AsideTerm({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-foreground">{children}</strong>
}
