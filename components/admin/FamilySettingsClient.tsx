'use client'

import { useState, useTransition } from 'react'
import { Check, Copy } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/ui/form-message'
import { useServerState } from '@/lib/use-server-state'
import { formatDate } from '@/lib/date-utils'
import { renameFamily, type FamilySettings } from '@/app/actions/admin/family'
import { MAX_FAMILY_NAME } from '@/components/admin/family-settings'
import { PlanPanel } from '@/components/admin/PlanPanel'
import { HelpLink } from '@/components/help/HelpLink'

/**
 * One field, and three facts that are not editable.
 *
 * NO MainRail. The rail is the standard primary navigation for a page that SWITCHES
 * between panes, and this page has one; a rail with a single item is a rule under a
 * word. If Family Settings ever grows a second pane — the delete half, if it is ever
 * built — it gets one then, keyed to its own permission resource like every other rail
 * item.
 *
 * THE FAMILY CODE IS SHOWN, AND IS NOT A FIELD. It is the join key carried by 34
 * tables and is immutable after insert (families_guard_family_code, 20260812000000), so
 * rendering it as a disabled input would be an affordance for something that does not
 * exist. It is displayed the way the create dialog displays it — large, monospaced,
 * copyable — because this is now the one place in the app an administrator can reliably
 * come back to for it.
 */
export function FamilySettingsClient({ settings }: { settings: FamilySettings }) {
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

  return (
    <div className="space-y-6">
      {/* THE PLAN LEADS THE PAGE, since 2026-08-13. It used to be the last of three
          sections, under the name and the join code, on the reasoning that "what are we
          on?" is a fact of the same kind as the member count. It is not the same kind of
          fact: the name and the code are set once and then left alone, while the plan is
          the thing that decides which pages the family has at all — so it is what somebody
          opening Settings is most often here to see or to change.

          Shown to everyone who can view this page, not only to whoever can rename the
          family. Hiding it would leave a member reaching an upgrade screen with nowhere in
          the product to find out what they already have. The BUTTONS are gated separately,
          inside the panel, on the same `canEdit` the name field uses.

          THE HELP LINK SITS OUTSIDE THE PANEL, not in it, and that is a boundary rather
          than a placement whim: `PlanPanel` is about the three plans and what each includes,
          and where to read more about them belongs to the PAGE. It is the inline variant
          because there is room above the panel and because the sentence is the point — the
          question somebody arrives with is "what does changing this actually do to us?", and
          the answer (screens close, no record is deleted, moving back up restores them) is
          `family-settings#plan` rather than anything on this screen. It sits UNDER the panel
          so it reads as "more about this" rather than as a caption over the first thing on
          the page. */}
      <div className="space-y-2">
        <PlanPanel tier={settings.tier} canEdit={settings.canEdit} />
        <HelpLink
          variant="inline"
          slug="family-settings"
          section="plan"
          label="What changing the plan does"
        />
      </div>

      <section className="rounded-xl border bg-card p-5 sm:p-6">
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
      </section>

      <section className="rounded-xl border bg-card p-5 sm:p-6">
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
      </section>

      {/* THE PLAN SECTION MOVED TO THE TOP OF THIS COMPONENT — see the comment there. It
          is no longer read-only, and it no longer links to /pricing: an in-product screen
          answering "what do we get?" by sending a signed-in administrator to the marketing
          site was the thing that change removed. `lib/plans.ts` carries the copy. */}
    </div>
  )
}
