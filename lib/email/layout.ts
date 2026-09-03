/**
 * The shared chrome for email the APP sends, as opposed to the five GoTrue templates in
 * `supabase/templates/`.
 *
 * WHY THIS EXISTS TWICE, AND HOW TO KEEP IT HONEST
 *   GoTrue renders static files that are pasted into the Supabase dashboard, so those
 *   cannot import anything. Application email is composed here, from data GoTrue has
 *   never heard of — which family, who invited you, what they were approved for.
 *
 *   The two therefore carry the same scaffold expressed twice, and they WILL drift if
 *   nobody looks. `supabase/templates/README.md` owns the reasoning for every decision
 *   below — the tables, the enhancement-only <style>, the doubled VML button, the
 *   Heritage band that does not change between themes, and why hex literals are
 *   sanctioned in email at all. Read it before changing anything here, and change both
 *   sides together.
 *
 *   ── THERE IS NO SECOND SIDE ANY MORE — 2026-09-03 ──
 *   This said `npm run email:check` compared the two and failed on divergence, which
 *   overstated it even then: that command compared HOSTED against the repo's HTML, never
 *   this file against anything. The five templates are now deleted and the auth mail is
 *   composed by `lib/email/auth-mail.ts` — which wraps THIS layout — so the scaffold
 *   exists once and there is nothing left to drift against or to change in step.
 *
 *   The README survives as the RECORD, and it is still the argument for every decision
 *   below, hex literals included. Read it before changing anything here.
 *
 * NOT A SERVER ACTION, and must never become one. This is a plain module: it has no URL
 * and composes strings. The sending is in ./send.ts, which is also a plain module for
 * the reason lib/notifications.ts records — an export of a `'use server'` file is a
 * public HTTP endpoint, and "internal helper" is a comment rather than a boundary.
 */

import { APP_NAME, APP_TAGLINE } from '@/lib/brand'
import type { T } from '@/lib/i18n/t'

/**
 * HTML-escape an interpolated value.
 *
 * Every caller-supplied string below goes through this. The threat is smaller than it
 * would be in a page — a mail client is not going to run a <script> — but a family
 * called "Ridley & Sons" would otherwise emit invalid markup, and an inviter who set
 * their display name to `"><a href=…` would emit a working link in somebody else's
 * email. Escaping is cheaper than deciding which fields are trustworthy.
 */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Zero-width padding so the inbox preview shows the preheader, not the first paragraph. */
const PREHEADER_PAD = '&#847;&zwnj;&nbsp;'.repeat(20)

/**
 * Stands in for the deployment origin until `renderEmailFrom` substitutes it.
 *
 * The GoTrue templates get this for free from `{{ .SiteURL }}`. Application email has no
 * such variable, and guessing is how an email ends up pointing at a preview deployment.
 */
const ASSET_ORIGIN_PLACEHOLDER = '__GENORRA_ORIGIN__'

const SANS = "Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',Times,serif"
const MONO = "'SF Mono',Consolas,Menlo,monospace"

export interface EmailButton {
  /** Absolute URL. Composed by the caller from an origin it has established. */
  href: string
  label: string
  /** Outlook's VML needs an explicit pixel width; nothing else does. ~11px per character. */
  widthPx?: number
}

export interface EmailOptions {
  /**
   * The RECIPIENT's language, bound — for the CHROME this file renders, not for the copy the
   * caller passes in.
   *
   * ── THREE STRINGS WERE ENGLISH FOR EVERY READER UNTIL 2026-08-27 ─────────────────
   * Every caller in `templates.ts` already composed its own paragraphs from the email
   * catalogue, so the six member-facing emails read correctly — and then rendered "If the
   * button does not work, paste this into your browser:" underneath in English, plus the
   * brand lead line and the three values in the footer. It was invisible to
   * `npm run i18n:literals` because that gate deliberately does not sweep `lib/`, where the
   * catalogues live and their English IS the source.
   *
   * ── `APP_TAGLINE` IS NOT ON THAT LIST, AND MUST NOT JOIN IT ─────────────────────
   * "Generations Embracing Nurturing Our Roots, Relationships & Ancestry" is what the letters
   * of the name STAND FOR. Translating it breaks the acronym — the initials would no longer
   * spell GENORRA — so it is a proper noun in the same sense the product name is, and
   * `lib/brand.ts` stays its one home. `APP_LEAD` and `APP_VALUES` ARE copy and are keyed,
   * which is the line `/about` already drew: *a brand constant is a finished English sentence,
   * and a translator needs the finished sentence rather than a constant to interpolate.*
   */
  t: T
  /** The line the inbox shows beside the subject. Extends the subject, never repeats it. */
  preheader: string
  heading: string
  /** Each becomes a <p>. Pass HTML — callers escape their own interpolations with esc(). */
  paragraphs: string[]
  button?: EmailButton
  /** Small centred line under the button — expiry, single-use, and so on. */
  fine?: string
  /** Shown in a monospace box under the button, for when the button does not work. */
  fallbackUrl?: string
  /** The line below the rule. Security reassurance, usually. */
  footnote: string
}

/**
 * Compose one email. Returns a complete HTML document with the origin still a
 * placeholder — deliberately NOT exported, so nothing can send one. Use
 * `renderEmailFrom`.
 *
 * Mirrors `supabase/templates/confirmation.html` block for block. If you add a row here,
 * add it there.
 */
function renderEmail(o: EmailOptions): string {
  const values = o.t('email.chrome.values').split('|')
    .map(v => `<span style="color:#6d5a53;">${esc(v.trim())}</span>`)
    .join('<span style="color:#d6a24a;">&nbsp;&bull;&nbsp;</span>')

  const button = o.button ? `
        <tr>
          <td class="gn-pad" align="center" style="padding:28px 44px 6px 44px;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${o.button.href}" style="height:50px; v-text-anchor:middle; width:${o.button.widthPx ?? 260}px;" arcsize="16%" stroke="f" fillcolor="#6b2d3a">
              <w:anchorlock/>
              <center style="color:#e5d9c6; font-family:'Segoe UI',Arial,sans-serif; font-size:16px; font-weight:600;">${esc(o.button.label)}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-- -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="gn-btn" align="center" bgcolor="#6b2d3a" style="background-color:#6b2d3a; border-radius:8px;">
                  <a href="${o.button.href}"
                     style="display:inline-block; padding:15px 38px; font-family:${SANS}; font-size:16px; font-weight:600; line-height:20px; color:#e5d9c6 !important; text-decoration:none; border-radius:8px;">
                    <span style="color:#e5d9c6 !important;">${esc(o.button.label)}</span>
                  </a>
                </td>
              </tr>
            </table>
            <!--<![endif]-->
          </td>
        </tr>` : ''

  const fine = o.fine ? `
        <tr>
          <td class="gn-pad gn-muted" align="center" style="padding:12px 44px 0 44px; font-family:${SANS}; font-size:13px; line-height:20px; color:#6d5a53;">
            ${o.fine}
          </td>
        </tr>` : ''

  const fallback = o.fallbackUrl ? `
        <tr>
          <td class="gn-pad" style="padding:26px 44px 0 44px;">
            <div class="gn-muted" style="font-family:${SANS}; font-size:13px; line-height:20px; color:#6d5a53; padding-bottom:8px;">
              ${esc(o.t('email.chrome.fallback'))}
            </div>
            <div class="gn-code gn-muted" style="font-family:${MONO}; font-size:12px; line-height:19px; color:#6d5a53; background-color:#f2ece3; border:1px solid #e7dccf; border-radius:8px; padding:12px 14px; word-break:break-all;">
              ${o.fallbackUrl}
            </div>
          </td>
        </tr>` : ''

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(o.heading)}</title>
<style>
  /* Enhancement only — see supabase/templates/README.md. Inline styles carry the design. */
  /*
     THE CSS PROPERTY, NOT JUST THE META TAGS. Both meta tags were here and the property was
     not, and the property is the half that matters: iOS Mail and Outlook read it to decide
     whether to apply their OWN dark-mode inversion on top of the design. Without it they
     darken the sand button label until it vanishes into the burgundy behind it. No @media
     rule can fix that, because the client inverts AFTER ours have applied.
  */
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body  { color-scheme: light dark; supported-color-schemes: light dark; }

  @media (prefers-color-scheme: dark) {
    .gn-page  { background-color: #1e1216 !important; }
    .gn-card  { background-color: #26191e !important; border-color: #402931 !important; }
    .gn-h1    { color: #e5d9c6 !important; }
    .gn-text  { color: #e5d9c6 !important; }
    .gn-muted { color: #b9afa4 !important; }
    .gn-rule  { border-color: #402931 !important; }
    .gn-btn   { background-color: #7d474f !important; }
    /* NOT the label. Sand is pinned INLINE with an important flag on both the anchor and the
       span inside it, so no client rewrite can reach it — and an inline important beats a
       stylesheet one, so a rule here would be dead. It does not need one: sand is 7.37:1 on
       the light band and 5.27:1 on this one, so one colour is correct in both themes and
       there is nothing to swap. */
    .gn-code  { background-color: #1e1216 !important; border-color: #402931 !important; color: #b9afa4 !important; }
  }

  /*
     OUTLOOK.COM REWRITES COLOURS AND IGNORES prefers-color-scheme. It stamps data-ogsc
     (original get style color) and data-ogsb (background) on whatever it has rewritten, and
     those attributes are the only hook for putting a colour back. In any client that never
     sets them these select nothing.
  */
  [data-ogsc] .gn-page  { background-color: #1e1216 !important; }
  [data-ogsc] .gn-card  { background-color: #26191e !important; border-color: #402931 !important; }
  [data-ogsc] .gn-h1    { color: #e5d9c6 !important; }
  [data-ogsc] .gn-text  { color: #e5d9c6 !important; }
  [data-ogsc] .gn-muted { color: #b9afa4 !important; }
  [data-ogsc] .gn-rule  { border-color: #402931 !important; }
  [data-ogsc] .gn-btn   { background-color: #7d474f !important; }
  [data-ogsc] .gn-code  { background-color: #1e1216 !important; border-color: #402931 !important; color: #b9afa4 !important; }
  [data-ogsb] .gn-band  { background-color: #6b2d3a !important; }

  @media only screen and (max-width: 620px) {
    .gn-pad  { padding-left: 24px !important; padding-right: 24px !important; }
    .gn-btn  { width: 100% !important; }
    .gn-btn a { display: block !important; }
  }
</style>
</head>
<body class="gn-page" style="margin:0; padding:0; width:100%; background-color:#f2ece3;">

<div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">
  ${o.preheader}
  ${PREHEADER_PAD}
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="gn-page" style="background-color:#f2ece3;">
  <tr>
    <td align="center" style="padding:32px 12px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="gn-card" style="width:600px; max-width:600px; background-color:#faf7f2; border:1px solid #e7dccf; border-radius:14px; overflow:hidden;">

        <tr>
          <td align="center" bgcolor="#6b2d3a" class="gn-band" style="background-color:#6b2d3a; padding:28px 24px 22px 24px;">
            <img src="${ASSET_ORIGIN_PLACEHOLDER}/identity/genorra-app-256.png" width="64" height="64" alt="" border="0" style="display:block; width:64px; height:64px; border:0; outline:none; text-decoration:none; border-radius:14px;">
            <div style="height:12px; line-height:12px; font-size:12px;">&nbsp;</div>
            <div style="font-family:${SERIF}; font-size:26px; line-height:30px; letter-spacing:0.22em; color:#e5d9c6; text-transform:uppercase; mso-line-height-rule:exactly;">
              ${esc(APP_NAME)}
            </div>
            <div style="font-family:${SANS}; font-size:12px; line-height:18px; color:#e5d9c6; padding-top:6px;">
              ${esc(o.t('email.chrome.lead'))}
            </div>
          </td>
        </tr>

        <tr>
          <td style="font-size:0; line-height:0;" bgcolor="#d6a24a" height="3">&nbsp;</td>
        </tr>

        <tr>
          <td class="gn-pad" style="padding:36px 44px 8px 44px;">
            <h1 class="gn-h1" style="margin:0; font-family:${SERIF}; font-weight:600; font-size:30px; line-height:36px; color:#6b2d3a; mso-line-height-rule:exactly;">
              ${esc(o.heading)}
            </h1>
          </td>
        </tr>

        <tr>
          <td class="gn-pad gn-text" style="padding:14px 44px 0 44px; font-family:${SANS}; font-size:16px; line-height:26px; color:#3c2528;">
            ${o.paragraphs.map((p, i) =>
              `<p style="margin:0${i < o.paragraphs.length - 1 ? ' 0 14px 0' : ''};">${p}</p>`,
            ).join('\n            ')}
          </td>
        </tr>
${button}${fine}${fallback}
        <tr>
          <td class="gn-pad" style="padding:28px 44px 0 44px;">
            <div class="gn-rule" style="border-top:1px solid #e7dccf; font-size:0; line-height:0;">&nbsp;</div>
          </td>
        </tr>

        <tr>
          <td class="gn-pad gn-muted" style="padding:18px 44px 32px 44px; font-family:${SANS}; font-size:13px; line-height:21px; color:#6d5a53;">
            ${o.footnote}
          </td>
        </tr>

      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px; max-width:600px;">
        <tr>
          <td class="gn-pad gn-muted" align="center" style="padding:22px 24px 8px 24px; font-family:${SANS}; font-size:12px; line-height:20px; color:#6d5a53;">
            ${values}
          </td>
        </tr>
        <tr>
          <td class="gn-pad gn-muted" align="center" style="padding:0 24px 28px 24px; font-family:${SANS}; font-size:11px; line-height:18px; color:#6d5a53;">
            ${esc(APP_NAME)} &mdash; ${esc(APP_TAGLINE)}
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>

</body>
</html>
`
}

/**
 * Render with a known origin, for both the artwork and any link inside.
 *
 * `origin` must be an absolute origin the CALLER has established — `emailOrigin()` in
 * ./send.ts derives it from configuration rather than from a request header, because
 * Host is attacker-controlled and this string ends up in a link somebody is told to
 * trust.
 */
export function renderEmailFrom(origin: string, o: EmailOptions): string {
  return renderEmail(o).split(ASSET_ORIGIN_PLACEHOLDER).join(origin.replace(/\/+$/, ''))
}
