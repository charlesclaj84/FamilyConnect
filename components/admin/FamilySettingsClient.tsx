'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, CreditCard, Crown, Home, PowerOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/ui/form-message'
import { useConfirm } from '@/components/ui/confirm'
import { useServerState } from '@/lib/use-server-state'
import { formatDate } from '@/lib/date-utils'
import {
  renameFamily, removeFamily, requestFamilyRemovalCode, type FamilySettings,
} from '@/app/actions/admin/family'
import {
  MAX_FAMILY_NAME, SETTINGS_PANES, SETTINGS_PANE_LABEL,
  DEFAULT_SETTINGS_PANE, type SettingsPane,
} from '@/components/admin/family-settings'
import { PlanPanel } from '@/components/admin/PlanPanel'
import { BillingPanel } from '@/components/admin/BillingPanel'
import type { PlatformBilling } from '@/app/actions/billing'
import { HelpLink } from '@/components/help/HelpLink'
import { MainRail, type MainRailItem } from '@/components/layout/MainRail'

/**
 * Settings: three panes on a `MainRail` — what the family has paid, the plan it is on, and
 * the family itself. Billing split out of the Plan pane on 2026-08-25, when the buy buttons
 * moved onto the plan rows they buy; `components/admin/family-settings.ts` argues both halves.
 *
 * THE RAIL IS THE STANDARD PRIMARY NAVIGATION for a page that switches between panes, and
 * this is one: Members, Accounting, Announcements, Transactions and Dues & Donations all look
 * like this, and a screen that is two long bands on one scroll does not read as two sections
 * however it is labelled — which is the complaint the two previous shapes of this page each
 * left behind. The full history is in the comment above the `return`.
 *
 * ONE PERMISSION KEY GOVERNS ALL THREE PANES, which is the part that reads as unusual and is not:
 * `/accounting/dues-and-donations` is the same arrangement, and `lib/money-panes.ts` argues
 * it. So there is no per-pane gating here and no `rights` prop to thread — a caller on this
 * screen holds `admin/settings` and may see both halves by definition. The one grant that IS
 * separate, `admin/settings/remove`, gates a CONTROL at the bottom of the Family pane rather
 * than a pane of its own; it is resolved on the server and arrives as `settings.canRemove`.
 *
 * THE PANE VOCABULARY IS NOT IN THIS FILE. `components/admin/family-settings.ts` holds the
 * ids, the labels and the ledes, because the page validates `?pane=` and a Server Component
 * importing a runtime value from a `'use client'` module gets a client reference rather than
 * the value. Only the ICONS live here — a lucide import is a client concern.
 *
 * THE FAMILY CODE IS SHOWN, AND IS NOT A FIELD. It is the join key carried by 34
 * tables and is immutable after insert (families_guard_family_code, 20260812000000), so
 * rendering it as a disabled input would be an affordance for something that does not
 * exist. It is displayed the way the create dialog displays it — large, monospaced,
 * copyable — because this is now the one place in the app an administrator can reliably
 * come back to for it.
 */
/**
 * The rail glyphs, per pane.
 *
 * Here rather than in `components/admin/family-settings.ts` for the reason that module's
 * header gives: a lucide import is a client concern, and the pure module is imported by the
 * PAGE, which is a Server Component. A `Record` rather than a ternary because there are three
 * of them now and a nested ternary over pane ids is how one of them silently gets the wrong
 * icon.
 */
const PANE_ICON: Record<SettingsPane, typeof Crown> = {
  billing: CreditCard,
  plan: Crown,
  family: Home,
}

export function FamilySettingsClient({ settings, initialPane, billing }: {
  settings: FamilySettings
  /**
   * Resolved from `?pane=` on the SERVER, so the first paint is already the right pane and a
   * bookmarked `?pane=family` does not flash the plan on its way there.
   */
  initialPane: SettingsPane
  /**
   * What this family pays GENORRA, or null when the read failed.
   *
   * PASSED THROUGH RATHER THAN FETCHED IN THE PANEL, for the reason every other prop on this
   * component is: the page resolves the grant and the data together, so a caller who may not
   * see it never receives it (§5). Null is a FAILED read and not "never paid" — the panel
   * says so, because rendering an empty billing band over a live subscription invites somebody
   * to start a second one.
   */
  billing: PlatformBilling | null
}) {
  // WHICH PANE IS SHOWING. Genuinely UI-local — it is not a family-scoped value and needs no
  // keying (AGENTS.md, "Switching family remounts the page"): `<main key={familyCode}>`
  // remounts this component on a switch anyway, and the pane somebody was looking at is not a
  // fact about either family.
  const [pane, setPane] = useState<SettingsPane>(initialPane)

  // TWO PIECES OF STATE, and the split is what keeps the Saved badge honest.
  //
  //   savedName  what the server currently holds. useServerState so it ADOPTS the
  //              value revalidatePath sends back — a plain initializer reads its
  //              argument once and would stay deaf to every later render.
  //   name       what is in the box. Deliberately NOT adopted: a server render
  //              arriving mid-edit must not overwrite what someone is typing. That is
  //              safe only because switching family REMOUNTS this page — see the key on
  //              <main> in app/(protected)/layout.tsx, which this form is the worked
  //              example for. Without it the box kept the previous family's name while
  //              `savedName` adopted the new one, so the form read as dirty and Save
  //              renamed the family you switched TO with the name of the one you left.
  //
  // Both are set on a successful save, so the button greys out and the badge appears
  // immediately rather than waiting for the revalidation to come back.
  const [savedName, setSavedName] = useServerState(settings.familyName)
  const [name, setName] = useState(settings.familyName)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const trimmed = name.trim()
  const dirty = trimmed !== savedName && trimmed.length > 0

  function submit() {
    setError('')
    setSaved(false)
    startTransition(async () => {
      const result = await renameFamily(trimmed)
      if (result.success) {
        setSavedName(result.familyName)
        setName(result.familyName)
        setSaved(true)
      } else {
        setError(result.message)
      }
    })
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(settings.familyCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused (permissions, insecure origin). The code is on
      // screen in a selectable element either way, so this is a nicety failing rather
      // than the feature failing — say nothing rather than raise an error about it.
    }
  }

  const created = formatDate(settings.createdAt)

  // Every item carries an `href`, because every pane has a real address this page resolves —
  // so cmd-click, middle-click and copy-link-address all work. `MainRail` still intercepts
  // the plain left click, which is the point rather than an optimisation here: a real
  // navigation refetches the RSC payload and remounts every pane, and the Family pane holds a
  // half-typed family name and, further down, a removal challenge waiting on a code from an
  // inbox. Neither may be thrown away by looking at the plan.
  const items: MainRailItem<SettingsPane>[] = SETTINGS_PANES.map(id => ({
    id,
    label: SETTINGS_PANE_LABEL[id],
    // `Crown` is the product's plan glyph already — the tier badge inside `PlanPanel`, the
    // upgrade screen, the marketing ladder — and `Home` is what `FamilySwitcher` and
    // `/my-families` use for a family. `CreditCard` is what every payment control in the
    // product carries. None is a glyph doing a second job on this screen, which is the trap
    // the Members rail avoided by not reusing `ShieldCheck`.
    icon: PANE_ICON[id],
    href: `/admin/settings?pane=${id}`,
  }))

  function selectPane(id: SettingsPane) {
    setPane(id)
    // `replaceState` rather than a router push, for the reason above: a real navigation
    // remounts both panes and takes the name box and the removal challenge with them. The
    // address stays correct and shareable either way, and the default pane keeps the bare URL
    // so `/admin/settings` and `/admin/settings?pane=plan` are not two addresses for one view.
    const url = `/admin/settings${id === DEFAULT_SETTINGS_PANE ? '' : `?pane=${id}`}`
    window.history.replaceState(null, '', url)
  }

  return (
    // ── THREE PANES ON A MAIN RAIL ────────────────────────────────────────────────────
    // This screen has been through three shapes and each one answered the complaint the last
    // one left. It was four unlabelled cards in a stack — plan, name, code, removal — which
    // read as one list with no boundary in it. Then two `<h2>`s over that same stack, which
    // fixed the document outline and not the screen: a heading a few pixels above a card
    // whose own heading is the same weight is not a boundary, and four bordered cards in one
    // column read as one list however they are labelled. Then two bordered PANELS, one per
    // band, which is a real boundary and still puts both bands on one scroll.
    //
    // It is a rail now, which is what was actually asked for and what every other multi-pane
    // screen in the product does — Members, Accounting, Announcements, Transactions, Dues &
    // Donations. One thing on screen at a time, and the rail is the boundary.
    //
    // THE EARLIER VERSION OF THIS COMMENT ARGUED AGAINST A RAIL, on the ground that a rail is
    // for panes that each carry their own permission key and these two share `admin/settings`.
    // That was the wrong test: `/accounting/dues-and-donations` is two panes on a rail under
    // one key, and AGENTS.md's rule about a pane spanning two keys is about not MERGING keys
    // that a family might sensibly hold separately — it says nothing about a rail needing
    // more than one. What makes a rail right here is that the two panes are two different
    // jobs on two different scrolls; what would make it wrong is inventing a per-pane grant
    // nothing reads.
    //
    // THE PANE IS NAMED BY THE RAIL ITEM, so there is no panel header and no pane-level
    // heading — the convention every pane on Members & Access already follows. That moved the
    // sections inside each pane up a rank: `Family name`, `Family code`, `Remove this family`
    // and `PlanPanel`'s `What each plan includes` are `h2`s now, directly under the page's
    // `h1`, so the outline a screen reader reads is the one a sighted reader sees.
    //
    // EVERY PANE STAYS MOUNTED — `hidden` rather than a conditional render, exactly as
    // `DuesAndDonationsShell` and `AdminAccountShell` do it. The Family pane holds a name
    // being typed and a removal challenge that has already sent a code to somebody's inbox,
    // and switching to the plan and back must discard neither. `hidden` also takes the
    // subtree out of the accessibility tree and the tab order, which a `sr-only`-style hide
    // would not.
    //
    // IT MATTERS MORE SINCE BILLING SPLIT OFF: the Plan pane can have a purchase dialog open
    // with a prepay figure typed into it, and a conditional render would throw that away for
    // anybody who tabbed over to check what they had already paid — which is exactly the
    // thing somebody does mid-purchase.
    <div className="space-y-6">
      <MainRail
        label="Settings sections"
        items={items}
        active={pane}
        onSelect={selectPane}
      />

      {/* ── BILLING ──
          The RECORD: what has been paid, until when, what renews it, and every receipt. It
          starts no purchase — the buy buttons live on the plan rows they buy, one pane over —
          so nothing in here can charge anybody. `BillingPanel`'s header argues the split, and
          `family-settings.ts` argues why it is a pane rather than a band. */}
      <div hidden={pane !== 'billing'} className="overflow-hidden rounded-xl border bg-card">
        <div className="p-5 sm:p-6">
          <BillingPanel billing={billing} />
        </div>
        <div className="border-t px-5 py-4 sm:px-6">
          <HelpLink
            variant="inline"
            slug="family-settings"
            section="billing"
            label="How paying for a plan works"
          />
        </div>
      </div>

      {/* ── PLAN ──
          Shown to everyone who can view this page, not only to whoever can rename the
          family. Hiding it would leave a member reaching an upgrade screen with nowhere in
          the product to find out what they already have. The BUTTONS are gated separately,
          inside the panel, on the same `canEdit` the name field uses.

          IT TAKES `billing` NOW. That is what moved with the buy buttons: the panel has to
          know whether this deployment can sell a tier, whether the family already has a
          subscription or a live prepaid term, and when a downgrade would land. It is passed
          down rather than fetched there for the reason every other prop on this component is
          (§5) — the page resolves the grant and the data together.

          THE HELP LINK IS THE PANE'S LAST ROW, not part of `PlanPanel`, and that is a
          boundary rather than a placement whim: `PlanPanel` is about the plans and what each
          includes, and where to read more about them belongs to the SCREEN. The question
          somebody arrives with is "what does changing this actually do to us?", and the
          answer (screens close, no record is deleted, moving back up restores them) is
          `family-settings#plan` rather than anything on this pane. */}
      <div hidden={pane !== 'plan'} className="overflow-hidden rounded-xl border bg-card">
        <div className="p-5 sm:p-6">
          <PlanPanel tier={settings.tier} canEdit={settings.canEdit} billing={billing} />
        </div>
        <div className="border-t px-5 py-4 sm:px-6">
          <HelpLink
            variant="inline"
            slug="family-settings"
            section="plan"
            label="What changing the plan does"
          />
        </div>
      </div>

      {/* ── FAMILY ──
          Three rows in one box, separated by `divide-y` rather than being three cards: the
          pane is the box, which is the lesson the four-cards version taught. */}
      <div
        hidden={pane !== 'family'}
        className="divide-y overflow-hidden rounded-xl border bg-card"
      >
        <div className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Family name</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What this family is called everywhere in the app — the switcher, the dashboard,
            and the emails inviting people to join. Changing it moves nothing else: the
            family code below is what every record is filed under.
          </p>

          <form
            className="mt-4 space-y-4"
            onSubmit={e => { e.preventDefault(); if (dirty) submit() }}
          >
            {/* THE FIELD IS CAPPED, NOT THE PAGE. This page used to be `PageShell`'s
                `reading` measure so that this box would not run the width of the screen —
                which narrowed the whole page, and everything else on it, to solve a problem
                belonging to one input. A family name is a few words; `max-w-md` is the size
                of the thing being typed. */}
            <div className="max-w-md space-y-1.5">
              <Label htmlFor="family-name">Name</Label>
              <Input
                id="family-name"
                value={name}
                onChange={e => { setName(e.target.value); setSaved(false) }}
                placeholder="The Okonkwo Family"
                autoComplete="off"
                maxLength={MAX_FAMILY_NAME}
                disabled={!settings.canEdit || isPending}
              />
            </div>

            <FormError message={error} />

            {settings.canEdit ? (
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!dirty || isPending}
                  className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {isPending ? 'Saving…' : 'Save name'}
                </button>
                {saved && !dirty && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Check className="h-3.5 w-3.5" /> Saved
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You can see this page but not change the name. Ask an administrator for the
                Settings permission.
              </p>
            )}
          </form>
        </div>

        <div className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Family code</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Share this with relatives so they can join. Everyone who joins waits in Pending
            Approval until somebody admits them.
          </p>

          <div className="mt-4 rounded-xl border-2 border-brand-primary/30 bg-brand-soft/40 px-6 py-4 text-center">
            <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">
              Family Code
            </p>
            <p className="font-mono text-3xl font-bold tracking-widest text-brand-ink">
              {settings.familyCode}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {settings.memberCount === 1
                ? '1 member'
                : `${settings.memberCount} members`}
              {created && <> · started {created}</>}
            </p>
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy code'}
            </button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            The code cannot be changed, and a family cannot be deleted. Every record in the
            family — dues, funds, events, chat, members — is filed under this code, and
            nothing in the database points back the other way, so changing it would leave
            the family holding none of its own history.
          </p>
        </div>

        {/* REMOVAL IS THE LAST ROW OF THIS PANE, which is the one thing about its position
            that is decided rather than left over. It is the heaviest control in the product
            and the least often wanted, so it sits below everything somebody actually came
            here to do — and on the Family pane rather than its own rail item, because
            `admin/settings/remove` grants a CONTROL and has no `view` action to hang a pane
            on (see the key's own note in components/admin/family-settings.ts). */}
        <RemoveFamilySection settings={settings} />
      </div>
    </div>
  )
}

/**
 * Switching the family off — and saying, in as many words, what that does and does not do.
 *
 * ── TWO STEPS, AND THE FIRST ONE IS NOT A FORMALITY ────────────────────────────────
 * Ask for a code, then type it. The grant is the authorization; the code is proof that
 * whoever is holding this session also holds the mailbox — which matters because
 * `admin/family/remove` may have been granted months ago to somebody who has since walked
 * away from an unlocked screen.
 *
 * ── `--brand-withheld`, NOT `--destructive` ────────────────────────────────────────
 * Removal deletes nothing. Every payment, photograph, event and person survives it
 * untouched, and GENORRA support can put the family back — so the alarm colour would be
 * describing something that is not happening. This is the same token the plan panel uses
 * for a downgrade and the dues ladder uses for an unpaid installment: a capability being
 * withheld. It has no `on-` partner deliberately, so it is used as a foreground and as a
 * tint under one, never as a fill with text on it.
 *
 * ── IT IS THE LAST ROW OF THE FAMILY PANE, NOT A CARD ────────────────────────────
 * The `rounded-xl border border-brand-withheld/40` went when Settings became panelled, and it
 * stays gone now that the panel is a rail pane: the pane supplies the box and `divide-y`
 * supplies the rule above this row, so the border was a second edge four pixels inside the
 * first. **The TINT stayed**, and that is the half that was carrying the signal — with the
 * icon and the withheld heading colour, a reader can still see at a glance that the last row
 * of this pane is not like the two above it. What a removed border cost is nothing; what
 * removing the tint would cost is the only visual warning on the control.
 *
 * The heading is an `h2`, like the two rows above it: the rail item names the pane, so nothing
 * sits between these and the page's `h1`.
 *
 * The confirmation is likewise NOT `destructive: true`. That flag renders shadcn's alarm
 * red and an AlertTriangle, which `--destructive` owns for errors and deletions; the
 * weight here is carried by a code the person had to go and fetch from their inbox, which
 * is a far stronger signal than a red button.
 *
 * ── STATE, AND WHY NONE OF IT NEEDS KEYING ─────────────────────────────────────────
 * `challenge` — that a code has been sent, and where — is per FAMILY, and would be a real
 * bug if it survived a switch: it would offer a code box for the family somebody just
 * left. It does not, and the mechanism is the one AGENTS.md names rather than anything
 * here: `<main key={familyCode}>` in app/(protected)/layout.tsx remounts everything below
 * it when the active family changes, so this component is torn down and `challenge` starts
 * at null again. Checked by reading that layout, and the reason there is no `useServerState`
 * in this section — there is no server value for it to adopt.
 *
 * The typed code lives in a REF owned by the field inside the confirmation, for the reason
 * `DowngradeReauth` states: `ConfirmOptions.body` is a node captured when `confirm()` was
 * called and never re-rendered by this component, so a controlled input bound to state up
 * here would take one keystroke and then sit frozen.
 */
function RemoveFamilySection({ settings }: { settings: FamilySettings }) {
  const router = useRouter()
  const confirm = useConfirm()
  const codeRef = useRef('')
  const [challenge, setChallenge] = useState<{
    sentTo: string; emailed: boolean; note: string | null; minutes: number
  } | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // ALREADY REMOVED — said to everybody who can open this page, not only to whoever holds
  // the grant. It is a fact about their own family and the one screen in the product where
  // an administrator would come looking for it.
  if (settings.status !== 'active') {
    return (
      <section className="bg-brand-withheld/5 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <PowerOff className="h-4 w-4 text-brand-withheld" aria-hidden="true" />
          This family has been removed
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nobody can open it, join it or accept an invitation to it.{' '}
          <strong className="font-semibold">Nothing has been deleted</strong> — every
          payment, photograph, event and person is exactly where it was. Only GENORRA
          support can bring it back; write to them and ask.
        </p>
      </section>
    )
  }

  // GATED ON A GRANT RESOLVED ON THE SERVER (§5). `canRemove` comes from
  // getFamilySettings, so a caller without it never receives the props this section would
  // render — rather than receiving them and having the browser decline to draw.
  if (!settings.canRemove) return null

  function sendCode() {
    setError('')
    startTransition(async () => {
      const result = await requestFamilyRemovalCode()
      if (result.success) {
        setChallenge({
          sentTo: result.sentTo,
          emailed: result.emailed,
          note: result.note,
          minutes: result.minutes,
        })
      } else {
        setChallenge(null)
        setError(result.message)
      }
    })
  }

  async function confirmRemoval() {
    if (!challenge) return
    // Never carried between two confirmations: a removal cancelled and reopened must be
    // typed again, and a code left in a ref is one a later action could spend.
    codeRef.current = ''
    const ok = await confirm({
      title: `Remove ${settings.familyName}?`,
      description:
        'Nobody will be able to open this family, join it or accept an invitation to it. '
        + 'Nothing is deleted: every record stays exactly where it is, and only GENORRA '
        + 'support can bring the family back.',
      body: <RemovalCodeField valueRef={codeRef} sentTo={challenge.sentTo} />,
      confirmLabel: 'Remove this family',
      // ── THE BROWSER-SIDE CHECK IS A SHAPE CHECK, AND NOTHING MORE ────────────────
      // `verify` runs here, in the browser, so it cannot possibly know whether the code is
      // right — only the database can, and `consume_family_removal_challenge` is what
      // decides. What this buys is that an empty or half-typed box refuses inside the
      // dialog instead of spending one of five attempts and closing it. Treating it as the
      // gate would be the mistake AGENTS.md records against the Password panel.
      verify: async () =>
        /^\d{6}$/.test(codeRef.current.trim())
          ? null
          : 'Enter the six digits from the email.',
    })
    if (!ok) return

    const typed = codeRef.current.trim()
    codeRef.current = ''
    setError('')
    startTransition(async () => {
      const result = await removeFamily(typed)
      if (result.success) {
        // The whole shell changes — the rail, the switcher, the screen the dashboard
        // renders — and the action revalidates the layout. This is what asks for it.
        setChallenge(null)
        router.refresh()
      } else {
        // A refused code closes the dialog and says why HERE, beside the button that
        // caused it. The code is spent either way, so the next attempt starts with a new
        // one — which is why the send button stays on screen.
        setChallenge(null)
        setError(result.message)
      }
    })
  }

  return (
    <section className="bg-brand-withheld/5 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <PowerOff className="h-4 w-4 text-brand-withheld" aria-hidden="true" />
        Remove this family
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Switches the family off for everybody in it. Nobody can open it, the family code
        stops working, and outstanding invitations stop being accepted.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        <strong className="font-semibold">Nothing is deleted.</strong> Every payment,
        fund, photograph, event, message and person stays exactly where it is. Removing is
        not a way to erase anything — and it is not something you can undo from here:{' '}
        <strong className="font-semibold">only GENORRA support can bring a family back.</strong>
      </p>

      <FormError message={error} />

      {challenge ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm">
            {challenge.emailed ? (
              <>
                We sent a six-digit code to{' '}
                <span className="font-medium">{challenge.sentTo}</span>. It lasts{' '}
                {challenge.minutes} minutes and can be used once.
              </>
            ) : (
              // THE TRUTH ABOUT A SEND THAT DID NOT HAPPEN. `sendEmail` fails soft and the
              // challenge is already minted, so the alternative is a code box over an
              // email nobody received — which is the failure `inviteMember` was rewritten
              // to avoid. The code itself is deliberately NOT handed back here: the
              // recipient is the caller, so that would hand them both factors at once.
              <>
                {challenge.note ?? 'We could not send the email just now.'} No code has
                reached <span className="font-medium">{challenge.sentTo}</span>, so there
                is nothing to type yet. Try again in a moment.
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {challenge.emailed && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => { void confirmRemoval() }}
                className="rounded-lg border border-brand-withheld px-3 py-1.5 text-sm font-medium text-brand-withheld transition-colors hover:bg-brand-withheld/10 disabled:opacity-60"
              >
                {isPending ? 'Working…' : 'Enter the code and remove'}
              </button>
            )}
            <button
              type="button"
              disabled={isPending}
              onClick={sendCode}
              className="text-sm font-medium text-brand-accent underline-offset-4 hover:underline disabled:opacity-60"
            >
              Send another code
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <button
            type="button"
            disabled={isPending}
            onClick={sendCode}
            className="rounded-lg border border-brand-withheld px-3 py-1.5 text-sm font-medium text-brand-withheld transition-colors hover:bg-brand-withheld/10 disabled:opacity-60"
          >
            {isPending ? 'Sending…' : 'Email me a removal code'}
          </button>
        </div>
      )}

      <div className="mt-4">
        <HelpLink
          variant="inline"
          slug="family-settings"
          section="removal"
          label="What removing a family does"
        />
      </div>
    </section>
  )
}

/**
 * The code box, inside the confirmation.
 *
 * It owns its own value for `DowngradeReauth`'s reason — `ConfirmOptions.body` is captured
 * once and never re-rendered by its caller, so the state has to live here and leave through
 * the ref, which `verify` reads at the moment it runs.
 *
 * `inputMode="numeric"` rather than `type="number"`: a number input strips leading
 * characters, offers a spinner nobody wants on a one-time code, and on some browsers
 * silently drops a paste that is not a valid number. `autoComplete="one-time-code"` is what
 * lets a phone offer the digits straight from the message.
 */
function RemovalCodeField({ valueRef, sentTo }: {
  valueRef: { current: string }
  sentTo: string
}) {
  const [value, setValue] = useState('')

  return (
    <div className="rounded-xl border border-brand-withheld/40 bg-brand-withheld/5 p-4">
      <Label htmlFor="family-removal-code">Confirmation code</Label>
      <Input
        id="family-removal-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        value={value}
        onChange={e => {
          // Digits only, so a pasted "123 456" or "123-456" still works rather than
          // failing a shape check the person cannot see the reason for.
          const next = e.target.value.replace(/\D/g, '').slice(0, 6)
          setValue(next)
          valueRef.current = next
        }}
        className="mt-1.5 max-w-[12rem] font-mono text-lg tracking-[0.4em]"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        The six digits we emailed to {sentTo}. It can be used once, and five wrong tries
        cancel it.
      </p>
    </div>
  )
}
