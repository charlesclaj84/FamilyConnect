'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAny } from '@/lib/auth/permissions'
import { requireDelete, requireEdit, requireRead } from '@/lib/auth/guard'
import { getFamilyStatus, type FamilyStatus } from '@/lib/auth/family'
import { getMyFamilyTier } from '@/lib/auth/tier'
import { isFamilyTier, normalizeTier, TIER_LABEL, type FamilyTier } from '@/lib/tiers'
import { DEFAULT_ZONE, isValidZone } from '@/lib/tz'
import { tierMove } from '@/lib/platform-billing'
// PLAIN MODULES, imported here and never re-exported. Everything exported from a
// `'use server'` file gets a URL, so a `sendEmail` re-export would be an open relay
// carrying GENORRA's SPF and DKIM — see the header of lib/email/send.ts.
import { sendEmail, emailOrigin, deliveryNote } from '@/lib/email/send'
import { familyRemovalCodeEmail } from '@/lib/email/templates'
import { resolveLocale } from '@/lib/auth/locale'
import {
  CHALLENGE_CODE_MINUTES, hashChallengeCode, mintChallenge,
} from '@/lib/action-challenge'
import {
  FAMILY_RESOURCE, MAX_FAMILY_NAME, REMOVE_FAMILY_RESOURCE,
} from '@/components/admin/family-settings'
import { currentUser } from '@/lib/auth/current-user'

/**
 * Family Settings — the family's own identity, as opposed to the eighteen admin
 * surfaces that are about running it.
 *
 * RENAMING IS THE ONLY WRITE, and that is a decision rather than a stopping point.
 * `family_code` is the join key carried by 34 tables and is immutable after insert
 * (families_guard_family_code, 20260812000000); deleting a family is not built at all,
 * because nothing has a foreign key to `families` and so a DELETE would remove one row
 * and orphan everything else. TODO.md carries what that half would need.
 *
 * WHY THE RENAME IS SAFE: `family_name` is carried by no other table. Nothing joins on
 * it, nothing keys on it, no policy reads it. A rename cannot orphan a row — which is
 * why this half could ship without the other.
 */

export interface FamilySettings {
  familyCode: string
  familyName: string
  /**
   * WHERE THE FAMILY IS — the zone every family-wide date judgement is read in.
   *
   * Is this gathering over, is this task overdue, how many are upcoming, when does an election
   * window close. NOT the zone times are displayed in for a reader (that is the member's own,
   * `people.time_zone`) and NOT the zone a gathering's times were stated in (that is on the
   * gathering). `lib/auth/zone.ts` states which is which and why these are three columns
   * rather than one.
   *
   * NOT NULL in the database, so this is always a real zone (20260826000006).
   */
  timeZone: string
  /** Approved, admitted members — what "how big is this family" actually means. */
  memberCount: number
  createdAt: string | null
  /**
   * The plan this family is on.
   *
   * NO LONGER READ-ONLY, since 2026-08-13 — `setFamilyTier` below is the scaffolding for
   * choosing a plan from inside the product, and any of the three may be picked. Read
   * that function's header before touching it: what changed is who may move the value,
   * and NOT the rule underneath. `families_guard_tier` (20260813000003) still refuses the
   * `authenticated` role outright, so the write goes through the service role — which is
   * what keeps `renameFamily` from ever being able to carry a tier along with a name.
   */
  tier: FamilyTier
  /** Whether to render the form at all. The write re-checks; this only shapes the UI. */
  canEdit: boolean
  /**
   * Whether this caller holds `admin/family/remove:delete` — a SEPARATE grant from
   * `canEdit`, because ending a family is a different decision from naming it
   * (20260817000006 §4).
   *
   * Resolved here rather than in the component so the section is not FETCHED for somebody
   * who cannot use it (AGENTS.md §5). There is not much to withhold — the control renders
   * no family data — but the rule is about where the decision is made, and a page that
   * resolves one grant server-side and another in the browser has two answers to keep in
   * step.
   */
  canRemove: boolean
  /**
   * Whether the family is still available (20260817000006).
   *
   * Read so this page can say so: an administrator of a removed family arriving here
   * should be told what happened rather than offered a button that has already been
   * pressed. It is NOT what protects anything — `removeFamily` re-derives it.
   */
  status: FamilyStatus
}

export type RenameFamilyResult =
  | { success: true; familyName: string }
  | { success: false; message: string }

export type SetTierResult =
  | { success: true; tier: FamilyTier }
  | { success: false; message: string }

/**
 * Everything the page shows.
 *
 * Gated on view before anything is read (AGENTS.md §5) — a page that fetches and then
 * hides has still published, because props are serialized into the RSC payload whether
 * a component renders them or not.
 *
 * The families row comes through the USER client, so the SELECT policy scopes it; the
 * member count goes through the service role, which sees past RLS and therefore
 * re-applies the family scoping by hand (§3). Counting through the user client would
 * have been the tidier read and gives a DIFFERENT number: the `people` SELECT policy
 * hides applicants from anyone without admin/approvals, so the total would move with
 * the reader's grants rather than with the family.
 */
export async function getFamilySettings(): Promise<FamilySettings | null> {
  const g = await requireRead(FAMILY_RESOURCE)
  if (!g.ok || !g.familyCode) return null

  const supabase = await createClient()
  const [family, members, editable, removable, tier, status] = await Promise.all([
    supabase
      .from('families')
      .select('family_code, family_name, created_at, time_zone')
      .eq('family_code', g.familyCode)
      .maybeSingle(),
    createAdminClient()
      .from('people')
      .select('id', { count: 'exact', head: true })
      .eq('family_code', g.familyCode)
      .eq('membership_status', 'approved'),
    canAny(g.userId, FAMILY_RESOURCE, 'edit'),
    // `canAny`, matching what `requireDelete` in removeFamily resolves to — a family has
    // one row and nobody's personal copy of it, so scope 'own' must not be a way in. The
    // grid agrees: `admin/family/remove` is in NO_OWNER_KEYS, so no 'own' button is drawn.
    canAny(g.userId, REMOVE_FAMILY_RESOURCE, 'delete'),
    // Read separately rather than added to the select above, on purpose: `tier` reaches
    // this app only through `getMyFamilyTier`, which normalizes an unknown or absent
    // value to Free and logs a refused query. Selecting the column here as well would be
    // a second reader free to disagree with the one every guard in the app uses — and it
    // would fail differently, because PostgREST answers 42703 for a missing column and
    // kills the WHOLE query, so a database behind on migrations would take the family's
    // NAME down along with its plan.
    getMyFamilyTier(g.userId),
    // And `status` for the same reason again, one migration later. It is the newest column
    // on this table, so it is the one most likely to be missing from a database that is
    // behind — and 42703 kills the WHOLE query, which would take the family's name down
    // with it. Its own reader, its own error, its own fallback.
    getFamilyStatus(g.familyCode),
  ])

  // The error is read rather than discarded (AGENTS.md §8): `null` from maybeSingle()
  // is also what a refused query returns, and the two mean opposite things — "this
  // family has no display row", which the fallback below handles, versus "PostgREST
  // said no", which is a misconfiguration the page should not paper over silently.
  if (family.error) {
    console.error(`[admin/family] could not read families for ${g.familyCode}: ${family.error.message}`)
    return null
  }

  const row = family.data as {
    family_code: string; family_name: string; created_at: string; time_zone: string
  } | null

  return {
    familyCode: g.familyCode,
    // A family with a people row but no `families` row predates that table. Showing
    // the code is honest; showing an empty name would read as a rename having failed.
    familyName: row?.family_name ?? g.familyCode,
    // NOT NULL in the database, so the fallback is for a family with no `families` row at
    // all — the same pre-dating case the name falls back for one line above.
    timeZone: row?.time_zone ?? DEFAULT_ZONE,
    memberCount: members.count ?? 0,
    createdAt: row?.created_at ?? null,
    canEdit: editable,
    canRemove: removable,
    tier,
    status,
  }
}

/**
 * Rename the family the caller is currently acting in.
 *
 * NO FAMILY IDENTIFIER IS ACCEPTED, and that is the security design rather than a
 * convenience: this is a `'use server'` export, so it has a URL and any signed-in user
 * can post to it with arguments of their choosing. A `familyCode` parameter would be an
 * id arriving from the client that then decides which row is written — the shape
 * AGENTS.md §4 is about — so the target is derived from the caller instead, exactly as
 * auth_family_code() derives it inside the policy. The two cannot disagree.
 *
 * requireEdit(), which is requireScope(…, 'edit') and so goes through canAny(). Scope
 * 'own' would otherwise pass, and there is no personal copy of the family's name to
 * own — a narrowed grant would silently mean what the unrestricted one means. The
 * policy on `families` tests `auth_permission('admin/settings','edit') = 'any'` for the
 * same reason, and scopesFor() stops the grid offering the button at all.
 *
 * The USER client, so the policy 20260812000000 adds is what actually admits the write
 * and tests/rls exercises it for real. `.eq('family_code', …)` is still written out:
 * the policy admits exactly one row today, so the filter is redundant *today*, and it
 * is what keeps an unfiltered UPDATE from ever being one policy rewrite away from
 * renaming every family in the database.
 */
export async function renameFamily(familyName: string): Promise<RenameFamilyResult> {
  const g = await requireEdit(FAMILY_RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'You do not belong to a family yet.' }

  const name = (familyName ?? '').trim()
  if (!name) return { success: false, message: 'Enter a family name' }
  if (name.length > MAX_FAMILY_NAME) {
    return { success: false, message: `That family name is too long (${MAX_FAMILY_NAME} characters maximum).` }
  }

  // `.select()` on the mutation, so a write the policy matched ZERO rows with comes
  // back as a failure instead of `{ success: true }` over an unchanged row. That silent
  // no-op is a known failure mode of this codebase (TODO.md, "Members without a grant
  // are told their write succeeded when it did not"); this action does not add to it.
  //
  // It turns out to do a SECOND job, found by mutating the layers apart and re-running
  // tests/rls rather than by reading: PostgreSQL ANDs the SELECT policy into an UPDATE
  // that carries a RETURNING clause. So `.select()` also confines this write to rows the
  // caller may READ — which on `families` is their own family. With the `.eq` deleted
  // AND both conjuncts stripped from the UPDATE policy, BRAVO's administrator still
  // could not touch ALPHA's row; only opening the SELECT policy as well let it through.
  // Worth knowing before anyone "tidies up" a `.select()` that looks decorative.
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('families')
    .update({ family_name: name })
    .eq('family_code', g.familyCode)
    .select('family_name')

  if (error) {
    console.error(`[admin/family] rename refused for ${g.familyCode}: ${error.message}`)
    return { success: false, message: 'Could not rename the family. Please try again.' }
  }
  if (!data || data.length === 0) {
    return { success: false, message: 'Not authorized' }
  }

  // The name is read on every page that names the family — the switcher, My Families,
  // the dashboard — so the whole layout is revalidated rather than this route alone.
  revalidatePath('/', 'layout')
  return { success: true, familyName: name }
}

export type SetFamilyZoneResult =
  | { success: true; timeZone: string }
  | { success: false; message: string }

/**
 * Set the zone the family's dates are read in.
 *
 * ── IT WRITES ON THE USER CLIENT, UNLIKE `setFamilyTier` ────────────────────────────
 * `families` carries three guard triggers — `families_guard_family_code`,
 * `families_guard_tier` and `families_guard_removal` — each refusing the `authenticated` role,
 * because the UPDATE policy admits an administrator's write and a policy has no opinion about
 * WHICH column changed. So a tier and a removal have to go through the service role.
 *
 * **This column deliberately has no such guard**, and `20260826000006`'s verify block asserts
 * that no trigger on `families` ever names it. The distinction is what the guarded columns ARE:
 * an immutable identity, a billing fact, a disable switch — things an administrator must not be
 * able to set by posting to an endpoint. A timezone is ordinary configuration: a family that
 * moves, or that was defaulted wrongly, should be able to fix it the way they fix their own
 * name. So this takes `renameFamily`'s path exactly, and the composed UPDATE policy authorizes
 * it.
 *
 * If a guard is ever added to that column, THIS FUNCTION HAS TO MOVE TO THE SERVICE ROLE IN
 * THE SAME COMMIT — the migration's assertion exists to make that impossible to forget.
 *
 * ── VALIDATED HERE, BECAUSE THE COLUMN HAS NO CHECK ─────────────────────────────────
 * There is no CHECK constraint: the valid set is the runtime's tz database rather than a list
 * this product maintains, which is the same call `elections.time_zone` makes. So `isValidZone`
 * at this boundary is the only thing standing between a public HTTP endpoint and a column every
 * date judgement in the product reads. A bad value would not error — `lib/tz.ts` coerces an
 * unusable zone to Central — it would silently move the family's whole calendar.
 *
 * ── AND IT REVALIDATES THE WHOLE LAYOUT ─────────────────────────────────────────────
 * `renameFamily`'s reason, for a wider set of screens: this decides past from upcoming on
 * `/gatherings`, the Dashboard's premier band, every overdue count and the calendar's opening
 * month. Revalidating this route alone would leave all of them on the old answer.
 */
export async function setFamilyZone(timeZone: string): Promise<SetFamilyZoneResult> {
  const g = await requireEdit(FAMILY_RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'You do not belong to a family yet.' }

  const zone = (timeZone ?? '').trim()
  if (!zone) return { success: false, message: 'Choose a timezone' }
  if (!isValidZone(zone)) return { success: false, message: 'That is not a timezone we recognise' }

  // `.select()` for both reasons `renameFamily`'s comment gives at length: a write the policy
  // matched zero rows with comes back as a failure rather than a silent success (§8b), and
  // PostgreSQL ANDs the SELECT policy into an UPDATE carrying a RETURNING clause, which
  // confines this to the caller's own family even with the `.eq` deleted.
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('families')
    .update({ time_zone: zone })
    .eq('family_code', g.familyCode)
    .select('time_zone')

  if (error) {
    console.error(`[admin/family] zone change refused for ${g.familyCode}: ${error.message}`)
    return { success: false, message: 'Could not change the timezone. Please try again.' }
  }
  if (!data || data.length === 0) {
    return { success: false, message: 'Not authorized' }
  }

  revalidatePath('/', 'layout')
  return { success: true, timeZone: zone }
}

/**
 * Put the family on a plan.
 *
 * ── THIS IS SCAFFOLDING, AND THE SCAFFOLD IS THE POINT ──────────────────────────────
 * There is no billing. Any of the three tiers can be picked and nothing is charged, which
 * is why the panel that calls this says so in as many words rather than reading as a
 * checkout. What it buys today is the ability to SEE the tier gates work — put a family on
 * Free and `/reporting/pl-summary`, `/community/gallery`, `/library/documents` and `/community/elections` become the upgrade
 * screen; put them back on Plus and they return, with every row they ever entered intact,
 * because no policy consults `families.tier` and none may start to (20260813000003).
 *
 * It changes nothing about Home. `/pricing` still sells three tiers to a visitor, still
 * shows Plus and Premium as "Not yet available", and is not derived from this in either
 * direction — see `lib/plans.ts`.
 *
 * ── WHY THE SERVICE ROLE, WHICH LOOKS LIKE THE THING THE GUARD FORBIDS ──────────────
 * `families_guard_tier` refuses a change made by the `authenticated` role — the role the
 * BROWSER speaks as — and says nothing about the service role. That boundary is drawn
 * around the role rather than around the column on purpose, and it is exactly what makes
 * this action possible without weakening it: `renameFamily` writes through the USER
 * client, so a `{ tier }` smuggled into that update still hits the trigger and still
 * fails. The plan moves only through a function that has decided to move it.
 *
 * So the authorization is entirely this function's, and it is the same one renaming
 * requires — `requireEdit`, which is `canAny(…, 'edit')`. Scope 'own' would otherwise
 * pass and there is no personal copy of the family's plan to own.
 *
 * ── §3, IN FULL, BECAUSE THE SERVICE ROLE HAS NO RLS ────────────────────────────────
 * The family code is derived from the caller's own membership and never taken as an
 * argument — the same reasoning `renameFamily`'s header gives — and `.eq('family_code',
 * …)` is what confines the UPDATE to one row. With the service role there is no policy
 * behind that filter, so it is not belt and braces here: it IS the isolation.
 */
export async function setFamilyTier(tier: string): Promise<SetTierResult> {
  const g = await requireEdit(FAMILY_RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'You do not belong to a family yet.' }

  // Narrowed rather than cast. This is a `'use server'` export, so the argument arrives
  // from an HTTP request and the panel is not in its path; `families_tier_check` would
  // refuse an unknown value anyway, but a checked string is a message the caller can read
  // instead of a constraint violation logged as "could not save".
  if (!isFamilyTier(tier)) return { success: false, message: 'That is not a plan.' }

  const admin = createAdminClient()

  // ── BILLING WINS, ADDED 2026-08-23 ────────────────────────────────────────────────
  // This action is scaffolding: it moves the tier and charges nothing, and the panel says so.
  // Once a family has actually PAID, that scaffolding becomes a second door into a column
  // billing is now authoritative about — and the two would fight, invisibly and in the
  // family's favour:
  //
  //   move DOWN by hand   nothing revokes anything until the paid term ends, so every page
  //                       stays open — and `apply_due_platform_tier_changes()` puts the tier
  //                       back on its next run, because `paid_through` still says they bought
  //                       it. A change that appears to work and silently reverts.
  //   move UP by hand     the product given away. `families.tier` is what every gate reads,
  //                       so this is a Premium plan for the cost of pressing a button, and the
  //                       sweep only ever moves a tier DOWN to what was paid for when a term
  //                       LAPSES — an active prepaid term at Standard would never correct it.
  //
  // So while a paid term is live, the billing panel owns the decision and this refuses. A
  // family with NO billing row is untouched, which is every family today and every family in
  // `tests/rls` — see 20260823000004's header on why the sweep is joined the same way.
  const [{ data: billing }, { data: familyRow }] = await Promise.all([
    admin.from('platform_billing_accounts')
      .select('paid_tier, paid_through')
      .eq('family_code', g.familyCode)
      .maybeSingle(),
    // The tier the family is on TODAY, needed by the upgrade refusal below. Read rather than
    // taken from the client for the reason every other id here is: the panel sends the tier it
    // wants and this is a public endpoint, so the direction of the move has to be computed
    // from what the database says rather than from what the caller claims to be on.
    admin.from('families').select('tier').eq('family_code', g.familyCode).maybeSingle(),
  ])
  const currentTier = normalizeTier(familyRow?.tier)
  if (billing?.paid_tier && typeof billing.paid_through === 'string'
      && billing.paid_through >= new Date().toISOString().slice(0, 10)) {
    return {
      success: false,
      message: 'This family is on a paid plan. Change it from the Billing section of Settings, so the payment follows the plan.',
    }
  }

  // ── AND NO MOVE UP AT ALL, ADDED 2026-08-23 WHEN THE PLANS WENT ON SALE ───────────
  //
  // The block above is not sufficient and stopped being sufficient the moment Standard and
  // Plus became purchasable (`TIER_IS_SOLD` in lib/plans.ts). It refuses a family with a LIVE
  // PAID TERM — which is precisely the family that has already paid. A family that has never
  // paid has no billing row, falls straight through it, and could set `families.tier` to
  // 'plus' by pressing a row on their own settings screen. `families.tier` is what every gate
  // in the product reads, so that is the whole product, free, to anybody holding
  // `admin/settings:edit` in their own family.
  //
  // That was not a hole while nothing was for sale — there was no payment to bypass, and this
  // action's header calls the scaffolding the point. It is a hole now, and the header's own
  // warning about moving up by hand is the description of it.
  //
  // ── WHY "NO UPGRADES" RATHER THAN "NO UPGRADES INTO A SOLD TIER" ──────────────────
  // The narrower rule reads better and is worse: `TIER_IS_SOLD.premium` is false, so it would
  // leave the one tier nobody can BUY as the one tier anybody can be GIVEN. Refusing every
  // move up needs no special case, cannot be outflanked by a tier going off sale, and states
  // the actual rule — a paid tier is acquired by paying for it, and Stripe is what says so.
  //
  // DOWNGRADES SURVIVE, deliberately. Giving something up costs the family nothing and takes
  // nothing from us; a family with no paid term is entitled to drop itself to Free, and the
  // panel's password step already stands in front of that because it closes pages for
  // everybody at once.
  //
  // WHAT THIS COSTS is the development affordance in the header — "put a family on Free and
  // the gates appear, put them back on Plus and they return". The second half is gone from
  // the product, and that is the right trade: it was a convenience for one person on a laptop
  // and a free upgrade for every administrator in production. On a laptop the service role and
  // `psql` still move the column, which is where a thing with no authorization story belongs.
  if (tierMove(currentTier, tier) === 'upgrade') {
    return {
      success: false,
      message: `${TIER_LABEL[tier]} is a paid plan. Set it up in the Billing section of Settings — nothing here can move a family onto it.`,
    }
  }

  const { data, error } = await admin
    .from('families')
    .update({ tier })
    .eq('family_code', g.familyCode)
    .select('tier')

  if (error) {
    console.error(`[admin/family] tier change refused for ${g.familyCode}: ${error.message}`)
    return { success: false, message: 'Could not change the plan. Please try again.' }
  }
  // Zero rows is a family with a people row and no `families` row — the same pre-table
  // case `getFamilySettings` handles by falling back to the code. Reported rather than
  // returned as success over an unchanged value.
  if (!data || data.length === 0) {
    return { success: false, message: 'This family has no settings record to change.' }
  }

  // THE WHOLE LAYOUT, not this route. A tier decides which items the sidebar renders
  // (`viewableResources` narrows on it) and which pages `requireView` admits, so a
  // revalidation confined to /admin/family would leave the rail advertising the old plan
  // until the next full navigation.
  revalidatePath('/', 'layout')
  return { success: true, tier }
}

/* ────────────────────────────────────────────────────────────────────────────────────
 * REMOVING A FAMILY
 *
 * Two actions and one emailed code. Removal DISABLES a family — `families.status` moves
 * to 'removed' and nothing else happens anywhere. No row is deleted, by these functions
 * or by anything they enable, and 20260817000006's header sets out at length why deleting
 * is not on the table: nothing has a foreign key to `families`, 34 tables carry
 * `family_code`, and `gen_family_code()`'s uniqueness loop reads the row that would go.
 *
 * THERE IS NO RESTORE HERE, DELIBERATELY. The only route back is
 * `staff_set_family_status()` from the GENORRA staff console (`app/(staff)`), because a
 * family that can un-remove itself has not been removed. Do not add a member-facing one.
 *
 * WHY AN EMAILED CODE AT ALL. The grant is the authorization; the code is proof that the
 * person holding the session is the person who owns the mailbox. It is the one action in
 * the product that switches the whole family off in a single click, and the grant that
 * admits it is one an administrator may have been given months ago and forgotten.
 * ──────────────────────────────────────────────────────────────────────────────────── */

/** Digits in the emailed code. */
const REMOVAL_CODE_LENGTH = 6

/**
 * How long a code lasts. Stated once, because the email prints it and the challenge is
 * written with it — two copies is how the sentence somebody reads stops describing the
 * timer they are racing.
 *
 * IT MOVED TO `lib/action-challenge.ts` ON 2026-08-25, when a second act went behind a code:
 * one lifetime for both, so a family cannot be told fifteen minutes on one screen and
 * something else on another. This re-export keeps the name this file's readers know.
 */
const REMOVAL_CODE_MINUTES = CHALLENGE_CODE_MINUTES

export type RemovalCodeResult =
  | {
      success: true
      /**
       * Where it went, so the screen can say so. The caller's OWN address, resolved from
       * their session — this discloses nothing they are not already looking at.
       */
      sentTo: string
      /** False when the mail did not go. The UI owes the truth about that. */
      emailed: boolean
      /** `deliveryNote()`'s sentence, or null. */
      note: string | null
      minutes: number
    }
  | { success: false; message: string }

export type RemoveFamilyResult =
  | { success: true }
  | { success: false; message: string }

/** SHA-256 hex, matching `encode(digest(code,'sha256'),'hex')` in the database. */
const hashCode = hashChallengeCode

/**
 * Email the acting administrator a code that confirms removing their family.
 *
 * ── IT TAKES NO ARGUMENTS AT ALL, AND THAT IS THE SECURITY DESIGN ──────────────────
 * Two separate reasons, and both are rules this codebase has already paid for:
 *
 *   * NO ADDRESS. This is a `'use server'` export and therefore a public HTTP endpoint.
 *     An `email` parameter would make it a mail cannon aimed at any address the caller
 *     chose, delivered over GENORRA's authenticated domain with our SPF and DKIM on it —
 *     which is phishing with the product's reputation attached. `resendConfirmationEmail`
 *     takes no arguments for exactly this, and neither does this.
 *   * NO FAMILY. The target is derived from the caller's own membership, exactly as
 *     `auth_family_code()` derives it inside the policies, so the two cannot disagree.
 *     `renameFamily`'s header has the long version.
 *
 * ── THE CODE IS GENERATED HERE, NOT IN SQL ─────────────────────────────────────────
 * `node:crypto`'s `randomInt`, which is rejection-sampled over the platform CSPRNG and is
 * the generator `app/actions/register.ts` already uses for family codes. The alternative —
 * a SQL minting function over `extensions.gen_random_bytes` — would have to RETURN the
 * plaintext through PostgREST to get it to the process that composes the email, putting
 * the secret on a second wire and into a second set of logs for nothing. Only the SHA-256
 * is stored, so this is the only place the digits exist outside the recipient's inbox.
 *
 * The range is 100000–999999 rather than 0–999999: a code with a leading zero is one
 * somebody retypes as five digits, and 900,000 possibilities behind a five-attempt cap is
 * not meaningfully weaker than a million.
 *
 * ── SENDING FAILS SOFT, SO THIS REPORTS WHAT HAPPENED ──────────────────────────────
 * `sendEmail()` never throws. The challenge is already minted by the time it is called, so
 * a mail outage cannot roll it back — and rendering a code box over an email that did not
 * go is precisely the failure `inviteMember` was rewritten to avoid.
 *
 * IT DOES NOT HAND THE CODE BACK, and that is where this deliberately parts company with
 * `inviteMember`. That action returns the invitation token when the send fails, because
 * the credential is for somebody ELSE and the inviter needs a way to deliver it. Here the
 * recipient IS the caller, so returning the digits would hand them both factors and make
 * the whole gate a formality. They are told the mail did not go, and can ask again.
 */
export async function requestFamilyRemovalCode(): Promise<RemovalCodeResult> {
  const g = await requireDelete(REMOVE_FAMILY_RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'You do not belong to a family yet.' }
  // The challenge is resolved from (family_code, requested_by), so a caller with no
  // `people` row in this family has nothing to resolve against. Refused here rather than
  // written as a NULL nothing could ever match.
  if (!g.personId) return { success: false, message: 'You do not belong to a family yet.' }

  // The session's own address — read from GoTrue rather than from `people.primary_email`,
  // because a `people` row may legitimately hold a GENERATED placeholder address
  // (AGENTS.md §4b) and mailing one is mailing nobody. This is the mailbox the caller
  // signs in with, which is what "the acting administrator" means.
  const { user } = await currentUser()
  const to = user?.email?.trim() ?? ''
  if (!to) {
    return { success: false, message: 'This account has no email address to send a code to.' }
  }

  const admin = createAdminClient()

  // The family's display name, for the message. §3: the service role has no RLS, so the
  // `.eq('family_code', …)` from the caller's own membership IS the scoping.
  const { data: family, error: familyError } = await admin
    .from('families')
    .select('family_name')
    .eq('family_code', g.familyCode)
    .maybeSingle()
  if (familyError) {
    console.error(`[admin/family] could not read families for ${g.familyCode}: ${familyError.message}`)
    return { success: false, message: 'Could not send a code just now. Please try again.' }
  }
  const familyName = (family?.family_name as string) ?? g.familyCode

  // ── MINTED BY THE SHARED MODULE SINCE 2026-08-25 ─────────────────────────────────
  // The supersede-then-insert, the digits, the hash and the lifetime moved to
  // `lib/action-challenge.ts` when disconnecting Stripe became the second act behind an
  // emailed code. What stays here is what is actually about REMOVAL: the grant above, the
  // family name, and the message below. See that module for why the purpose conjunct is on
  // both statements.
  const minted = await mintChallenge(admin, {
    familyCode: g.familyCode,
    personId: g.personId,
    purpose: 'family_removal',
    logTag: '[admin/family]',
  })
  if (!minted.ok) {
    return { success: false, message: 'Could not send a code just now. Please try again.' }
  }

  const mail = familyRemovalCodeEmail({
    origin: emailOrigin(),
    familyName,
    code: minted.code,
    expiresInMinutes: minted.minutes,
    // THE ONE PLACE `resolveLocale` IS RIGHT FOR MAIL: this action takes no arguments and
    // resolves the address from the session, so the reader is by construction the caller —
    // and for the caller `Accept-Language` is their own browser rather than somebody else's.
    locale: await resolveLocale(g.userId),
  })
  const sent = await sendEmail({ to, subject: mail.subject, html: mail.html, tag: mail.tag })

  return {
    success: true,
    sentTo: to,
    emailed: sent.sent,
    note: deliveryNote(sent),
    minutes: REMOVAL_CODE_MINUTES,
  }
}

/**
 * Remove the family the caller is currently acting in.
 *
 * ── THE CODE IS VERIFIED AND CONSUMED IN ONE STATEMENT ─────────────────────────────
 * `consume_family_action_challenge()` (20260817000007, generalised by 20260825000000) does it
 * under `FOR UPDATE`. A
 * read-then-write here would race itself — two tabs, or one double click, and the same
 * challenge is spent twice or a wrong guess and a right one interleave so only one of two
 * failures is counted. That function also owns the attempt cap, the expiry and the single
 * use, so none of them can be forgotten by a rewrite of this action.
 *
 * NO CHALLENGE ID CROSSES FROM THE CLIENT. The only argument is the six digits somebody
 * typed; the row is resolved from (family_code, requested_by, purpose), all three derived from the
 * session — the same shape `appeal_membership_decision` uses, and the reason a guessed
 * code cannot spend another family's challenge.
 *
 * ── AND THEN THE SERVICE ROLE, BECAUSE THE GUARD REFUSES THE BROWSER ───────────────
 * `families_guard_removal` (20260817000006 §2) refuses any change to status/removed_at/
 * removed_by made by the `authenticated` role. That is what makes the emailed code mean
 * anything: without it, an administrator holding only the RENAME grant could PATCH
 * `{"status":"removed"}` straight at PostgREST from devtools, past this action entirely.
 * So the write goes through `createAdminClient()` — and with the service role there is no
 * policy behind `.eq('family_code', …)`, which makes that filter the isolation rather than
 * a belt beside braces (AGENTS.md §3).
 *
 * `.eq('status', 'active')` is the positive test 20260817000006 asks every gate for: never
 * `<> 'removed'`, so a third status added later is refused here rather than admitted.
 */
export async function removeFamily(code: string): Promise<RemoveFamilyResult> {
  const g = await requireDelete(REMOVE_FAMILY_RESOURCE)
  if (!g.ok) return { success: false, message: g.message }
  if (!g.familyCode) return { success: false, message: 'You do not belong to a family yet.' }
  if (!g.personId) return { success: false, message: 'You do not belong to a family yet.' }

  // Narrowed rather than trusted. This is a public endpoint, so the argument arrives from
  // an HTTP request and the form is not in its path; a shape check here is a message the
  // caller can read instead of a wasted attempt against the cap.
  const typed = (code ?? '').trim()
  if (!new RegExp(`^\\d{${REMOVAL_CODE_LENGTH}}$`).test(typed)) {
    return { success: false, message: 'That code is not right.' }
  }

  const admin = createAdminClient()

  const { data: challenge, error: challengeError } = await admin
    .rpc('consume_family_action_challenge', {
      p_family_code: g.familyCode,
      p_person_id: g.personId,
      p_purpose: 'family_removal',
      p_code_hash: hashCode(typed),
    })
    .maybeSingle<{ ok: boolean; message: string | null; attempts_left: number }>()

  // The error is READ (AGENTS.md §8): a refused RPC and a refused CODE are opposite facts
  // and `data` cannot tell them apart — `null` from maybeSingle() is what both look like.
  if (challengeError) {
    console.error(`[admin/family] removal challenge failed for ${g.familyCode}: ${challengeError.message}`)
    return { success: false, message: 'Could not confirm that code. Please try again.' }
  }
  if (!challenge?.ok) {
    return { success: false, message: challenge?.message ?? 'That code is not right.' }
  }

  const { data, error } = await admin
    .from('families')
    .update({
      status: 'removed',
      removed_at: new Date().toISOString(),
      removed_by: g.personId,
    })
    .eq('family_code', g.familyCode)
    .eq('status', 'active')
    .select('status')

  if (error) {
    console.error(`[admin/family] removal refused for ${g.familyCode}: ${error.message}`)
    return { success: false, message: 'Could not remove the family. Please try again.' }
  }
  // Zero rows is one of two things, and neither is a success: the family is already
  // removed, or it has a `people` row and no `families` row (the pre-table case
  // `getFamilySettings` falls back for). Reported rather than returned as success over an
  // unchanged row — and the code is spent either way, which is the contract.
  if (!data || data.length === 0) {
    return {
      success: false,
      message: 'This family is already removed, or has no settings record to remove.',
    }
  }

  // THE WHOLE LAYOUT. Removal changes what the rail may show, what the switcher says about
  // this family, and which screen the dashboard renders — a revalidation confined to
  // /admin/family would leave every one of those describing a family that is gone.
  revalidatePath('/', 'layout')
  return { success: true }
}

// NO `planLabel` HELPER HERE, and the reason is a build error rather than taste: every
// export of a `'use server'` file must be an async function, because Next.js gives each
// one a URL. `TIER_LABEL` is a plain object in `lib/tiers.ts` and every caller imports it
// from there.
