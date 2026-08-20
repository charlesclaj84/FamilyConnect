'use client'

import { useEffect, useState } from 'react'
import { Loader2, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { FormError } from '@/components/ui/form-message'
import { useConfirm } from '@/components/ui/confirm'
import { TSHIRT_CATEGORIES, TSHIRT_SIZES, PREFIXES, SUFFIXES, type TshirtCategory } from '@/lib/tshirt-sizes'
import { GENDERS, GENDER_LABELS } from '@/lib/gender'
import { COUNTRIES, REGIONS, type Country } from '@/lib/regions'
import { TIMEZONES, TIMEZONE_LABELS } from '@/lib/date-utils'
import {
  getMemberProfileForEdit, sendMemberPasswordReset, updateUserProfile,
  type MemberProfileForEdit,
} from '@/app/actions/admin/users'
import type { PersonalInfoData } from '@/app/actions/personal-info'

/**
 * Edit another member's profile, from Members & Access.
 *
 * ── WHAT IT IS FOR ──────────────────────────────────────────────────────────────────
 * `updateUserProfile` has existed since Phase 3 and had no caller — a `'use server'` export
 * with a URL, a service-role write to `people`, and no screen. TODO.md carried the choice
 * between deleting it and giving it a screen, and this is the screen: the member detail
 * dialog's **Edit profile** button closes that panel and opens this one.
 *
 * The reason a family wants it is the ordinary one. An administrator sitting with a relative
 * on the phone should be able to fix a misspelt surname or a moved address without walking
 * them through signing in — which is exactly what the Pending Approval queue already assumes
 * about administrators, and exactly what `editPersonRecord` already allows for a relative who
 * has no account at all. This closes the gap in between: a member WITH an account whose
 * record needs correcting by somebody else.
 *
 * ── THE THREE SECTIONS ARE THE PROFILE'S OWN, MINUS SECURITY ────────────────────────
 * General, Address and Additional — field for field what a member sees at `/personal-info`,
 * in the same order, with the same controls and the same dependent dropdowns (state depends
 * on country, t-shirt size on category). Sign-in & Security is deliberately ABSENT and that
 * is not a simplification:
 *
 *   * A PASSWORD IS NEVER SET BY SOMEBODY ELSE. The offer at the foot of this dialog sends
 *     the member the ordinary reset mail, so the new password is chosen by the person it
 *     belongs to and this screen never learns it. An administrator who could type a password
 *     could then sign in as that member, and every audit trail in the product would attribute
 *     what followed to them rather than to whoever did it.
 *   * EMAIL IS READ-ONLY, and it is `updateUserProfile` that enforces that rather than this
 *     form — it deletes `primary_email` from any patch it is handed. Two reasons, both in
 *     AGENTS.md §4b: a person with an account is the authority on their own sign-in address,
 *     and a person WITHOUT one holds a generated placeholder paired with
 *     `email_is_placeholder`, so writing a real address in would leave both flags describing
 *     an address that is no longer generated — after which anything checking before mailing
 *     refuses a working mailbox. The field is rendered anyway, disabled, with the sentence
 *     that says why; a form that silently omitted it would be a form somebody looks for the
 *     field in.
 *   * `chapter_id` IS NOT HERE EITHER, and for a third reason: it came off
 *     `WRITABLE_PROFILE_COLUMNS` (see lib/profile-columns.ts), because it is the one profile
 *     column that is per-family rather than shared, and moving it also carries a member's
 *     account-less children along. It has its own action. The Organization pane is where a
 *     family's geography is edited.
 *
 * ── THE FETCH IS ON OPEN, NOT ON THE ROSTER (AGENTS.md §5) ──────────────────────────
 * `searchMembers` publishes eight fields per row; this form needs nineteen more, including
 * date of birth, gender and a street address. Loading those for every row of a hundred-and-
 * forty-person family — to fill a dialog that is open for one of them — would put the whole
 * family's PII in the RSC payload of a screen that mostly just lists people, and would do it
 * under `admin/members:view` rather than `:edit`. So `getMemberProfileForEdit` fetches one
 * person when this opens and resolves the EDIT grant before returning a column.
 *
 * That is why there is a loading state at all, and why it is a state rather than a spinner
 * over a form: the fields cannot be rendered before their values arrive without flashing a
 * form full of blanks that looks like a record with nothing in it.
 */

/** The form's own state — every writable profile column, as strings. */
type FormState = Required<Omit<PersonalInfoData,
  'primary_email' | 'chapter_id'
>>

const EMPTY: FormState = {
  prefix: '', first_name: '', middle_name: '', last_name: '', nick_name: '', suffix: '',
  primary_phone: '',
  street_address: '', apartment: '', city: '', state: '', zip_code: '', country: '',
  date_of_birth: '', sunset_date: '',
  gender: '',
  tshirt_category: '', tshirt_size: '',
  time_zone: '',
}

/** One labelled control in the three-column grid the profile page uses. */
function Cell({ label, htmlFor, required, hint, children }: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} required={required}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** A section heading inside the panel. Not a `SectionCard`: this is one form, not four. */
function Band({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      {/* h3, so the panel's own h2 title stays the heading above these. Inter rather than
          the serif, per AGENTS.md's typography rule — h3–h6 deliberately do not take
          Cormorant, because it goes thin below about 20px which is what a functional
          subhead runs at. */}
      <h3 className="text-sm font-semibold text-brand-ink">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  )
}

export function MemberProfileEditDialog({ peopleId, onClose, onSaved }: {
  /**
   * The member being edited. Never null: the caller MOUNTS this component only while the
   * panel is open, and keys it on this id — see the note on the effect below.
   */
  peopleId: string
  onClose: () => void
  /** Called after a successful save, so the roster behind this can reload. */
  onSaved: () => void
}) {
  const confirm = useConfirm()
  const [profile, setProfile] = useState<MemberProfileForEdit | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  // `true` from the first render rather than set in the effect below. Same screen, and it
  // avoids one render of an empty panel before the fetch has been asked for.
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [resetNotice, setResetNotice] = useState('')
  const [resetting, setResetting] = useState(false)

  // ── ONE FETCH, ON MOUNT. NOTHING IS RESET HERE, BECAUSE NOTHING PERSISTS ───────────
  // The first version of this cleared `profile`, `form`, `error` and `resetNotice` at the
  // top of this effect so that opening a second member could not inherit the first one's
  // values. That is the "reset state when a prop changes" anti-pattern, and React Compiler
  // refuses it outright — `react-hooks/set-state-in-effect`, "calling setState
  // synchronously within an effect can trigger cascading renders".
  //
  // The right mechanism is the one AGENTS.md already uses for exactly this class of
  // staleness: a KEY. `AdminAccessClient` mounts this component only while the panel is
  // open and keys it on `peopleId`, so a different member is a different component and
  // React discards every piece of the previous one's state for us. That is the same
  // argument `<main key={familyCode}>` is built on, one scope down — and it is strictly
  // stronger than the resets it replaces, which had to enumerate the state to clear and
  // would have missed the next field somebody added.
  //
  // So all this does is fetch. `[peopleId]` is still the dependency rather than `[]`: it
  // cannot change without a remount today, and if somebody ever drops the key this
  // refetches instead of silently showing the wrong person.
  useEffect(() => {
    let live = true
    getMemberProfileForEdit(peopleId).then(result => {
      // `live` guards the state writes, not the request. Without it a panel closed before
      // its fetch answered writes into an unmounted component.
      if (!live) return
      setLoading(false)
      if (!result.success || !result.profile) {
        setError(result.error ?? 'That member could not be loaded.')
        return
      }
      setProfile(result.profile)
      setForm({ ...EMPTY, ...result.profile.fields } as FormState)
    })
    return () => { live = false }
  }, [peopleId])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const country = form.country as Country | ''
  const availableRegions = country && country in REGIONS ? REGIONS[country as Country] : []
  const stateLabel = country === 'Canada' ? 'Province' : 'State'
  const category = form.tshirt_category as TshirtCategory | ''
  const availableSizes = category && category in TSHIRT_SIZES ? TSHIRT_SIZES[category as TshirtCategory] : []

  async function handleSave() {
    if (!profile) return
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First name and last name are both required.')
      return
    }

    // CONFIRMED, because this edits SOMEBODY ELSE'S record. The profile page confirms a
    // member's own saves too, but the argument is stronger here: the person whose name is
    // about to change is not in the room, and the confirmation is the one place their name
    // is stated back before it does.
    const ok = await confirm({
      title: 'Save this member’s profile',
      description: `Save your changes to ${profile.name}’s profile? They are not notified.`,
      confirmLabel: 'Save changes',
    })
    if (!ok) return

    setError('')
    setSaving(true)
    // Sent WHOLE rather than as a diff. `pickProfileColumns` is an allow-list on the way
    // in, so every key here is one the server would accept anyway, and a diff would need
    // this component to decide what "unchanged" means for a field the member had never
    // filled in — where '' and null are the same fact and would flip back and forth.
    const result = await updateUserProfile(profile.peopleId, form)
    setSaving(false)
    if (!result.success) {
      setError(result.error ?? 'Those changes could not be saved.')
      return
    }
    onSaved()
    onClose()
  }

  async function handleReset() {
    if (!profile) return
    const ok = await confirm({
      title: 'Send a password reset',
      description: `Email ${profile.name} a link to choose a new password? `
        + 'Their current password keeps working until they use it.',
      confirmLabel: 'Send the link',
    })
    if (!ok) return

    setError('')
    setResetNotice('')
    setResetting(true)
    const result = await sendMemberPasswordReset(profile.peopleId)
    setResetting(false)
    if (!result.success) setError(result.error ?? 'That link could not be sent.')
    // ONE SENTENCE FOR EVERY OUTCOME THAT IS NOT A REFUSAL WE MADE OURSELVES. GoTrue
    // answers 200 for an address with an account, one without, and one it has never seen,
    // so "Sent" would be a claim nothing here can support — see the action's own header.
    else setResetNotice(result.message ?? 'A reset link has been requested.')
  }

  return (
    <Dialog
      // Always open: this component exists only while the panel does. See the effect.
      open
      onClose={onClose}
      title={profile ? `Edit ${profile.name}` : 'Edit profile'}
      description={profile
        ? 'Their sign-in email and password are not editable here.'
        : undefined}
      // Wider than the detail dialog it replaces: this is a three-column grid of nineteen
      // fields rather than a list of labelled values.
      className="max-w-3xl"
    >
      {loading && (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading this member’s profile…
        </div>
      )}

      {/* The error can stand on its own — a failed LOAD leaves no form to attach it to. */}
      {!loading && !profile && <FormError message={error} className="my-6" />}

      {profile && (
        <div className="mt-2 space-y-6">
          <Band title="General">
            <Cell label="Prefix" htmlFor="mp-prefix">
              <Select id="mp-prefix" value={form.prefix} onChange={e => set('prefix', e.target.value)}>
                <option value="">— None —</option>
                {PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </Cell>
            <Cell label="First Name" htmlFor="mp-first" required>
              <Input id="mp-first" value={form.first_name} onChange={e => set('first_name', e.target.value)} />
            </Cell>
            <Cell label="Middle Name" htmlFor="mp-middle">
              <Input id="mp-middle" value={form.middle_name} onChange={e => set('middle_name', e.target.value)} />
            </Cell>
            <Cell label="Last Name" htmlFor="mp-last" required>
              <Input id="mp-last" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
            </Cell>
            <Cell label="Nickname" htmlFor="mp-nick">
              <Input id="mp-nick" placeholder="e.g. Big Mike" value={form.nick_name} onChange={e => set('nick_name', e.target.value)} />
            </Cell>
            <Cell label="Suffix" htmlFor="mp-suffix">
              <Select id="mp-suffix" value={form.suffix} onChange={e => set('suffix', e.target.value)}>
                <option value="">— None —</option>
                {SUFFIXES.map(x => <option key={x} value={x}>{x}</option>)}
              </Select>
            </Cell>
            {/* RENDERED, DISABLED, AND EXPLAINED. Omitting it would be a field somebody
                hunts for; showing it editable would be a control the server ignores,
                which is worse than either. The hint changes with the record because the
                two reasons are genuinely different — see this file's header. */}
            <Cell
              label="Email"
              htmlFor="mp-email"
              hint={profile.emailIsPlaceholder
                ? 'A generated placeholder. It changes once they accept an invitation.'
                : 'Only the member can change their own sign-in address.'}
            >
              <Input id="mp-email" value={profile.email ?? ''} disabled readOnly />
            </Cell>
            <Cell label="Phone" htmlFor="mp-phone">
              <Input id="mp-phone" type="tel" placeholder="(555) 000-0000" value={form.primary_phone} onChange={e => set('primary_phone', e.target.value)} />
            </Cell>
            <Cell label="Gender" htmlFor="mp-gender">
              {/* Blank is a real, keepable answer, so the option is worded as one rather
                  than as an empty prompt — the same wording the member's own form uses. */}
              <Select id="mp-gender" value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">— Prefer not to say —</option>
                {GENDERS.map(g => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
              </Select>
            </Cell>
          </Band>

          <Band title="Address">
            <Cell label="Country" htmlFor="mp-country">
              {/* Changing the country CLEARS the state, because the old value is a region
                  of a country that is no longer selected — the same handler the profile
                  form has, and leaving it behind is how a Texan ends up in Ontario. */}
              <Select
                id="mp-country"
                value={form.country}
                onChange={e => setForm(prev => ({ ...prev, country: e.target.value, state: '' }))}
              >
                <option value="">— Select —</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Cell>
            <Cell label="Street Address" htmlFor="mp-street">
              <Input id="mp-street" value={form.street_address} onChange={e => set('street_address', e.target.value)} />
            </Cell>
            <Cell label="Apartment / Suite" htmlFor="mp-apt">
              <Input id="mp-apt" value={form.apartment} onChange={e => set('apartment', e.target.value)} />
            </Cell>
            <Cell label="City" htmlFor="mp-city">
              <Input id="mp-city" value={form.city} onChange={e => set('city', e.target.value)} />
            </Cell>
            <Cell
              label={stateLabel}
              htmlFor="mp-state"
              hint={!form.country ? 'Choose a country first.' : undefined}
            >
              {availableRegions.length > 0 ? (
                <Select id="mp-state" value={form.state} onChange={e => set('state', e.target.value)}>
                  <option value="">— Select —</option>
                  {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
                </Select>
              ) : (
                <Input id="mp-state" placeholder={stateLabel} disabled={!form.country}
                  value={form.state} onChange={e => set('state', e.target.value)} />
              )}
            </Cell>
            <Cell label="ZIP / Postal" htmlFor="mp-zip">
              <Input id="mp-zip" placeholder="62701" value={form.zip_code} onChange={e => set('zip_code', e.target.value)} />
            </Cell>
          </Band>

          <Band title="Additional information">
            <Cell label="Date of Birth" htmlFor="mp-dob">
              <Input id="mp-dob" type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
            </Cell>
            <Cell label="Sunset Date" htmlFor="mp-sunset" hint="Leave blank if living.">
              <Input id="mp-sunset" type="date" value={form.sunset_date} onChange={e => set('sunset_date', e.target.value)} />
            </Cell>
            <Cell label="T-Shirt Category" htmlFor="mp-tcat">
              <Select
                id="mp-tcat"
                value={form.tshirt_category}
                onChange={e => setForm(prev => ({ ...prev, tshirt_category: e.target.value, tshirt_size: '' }))}
              >
                <option value="">— Select —</option>
                {TSHIRT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Cell>
            <Cell
              label="T-Shirt Size"
              htmlFor="mp-tsize"
              hint={availableSizes.length === 0 ? 'Select a category first.' : undefined}
            >
              <Select id="mp-tsize" disabled={availableSizes.length === 0}
                value={form.tshirt_size} onChange={e => set('tshirt_size', e.target.value)}>
                <option value="">— Select —</option>
                {availableSizes.map(x => <option key={x} value={x}>{x}</option>)}
              </Select>
            </Cell>
            <Cell label="Time Zone" htmlFor="mp-tz">
              <Select id="mp-tz" value={form.time_zone ?? ''} onChange={e => set('time_zone', e.target.value)}>
                <option value="">— Select —</option>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{TIMEZONE_LABELS[tz] ?? tz}</option>)}
              </Select>
            </Cell>
          </Band>

          {/* ── SIGN-IN, WHICH IS ONE OFFER AND NOT A SECTION ────────────────────────
              Absent entirely for a record with no account: there is no password to reset
              and the button would only ever refuse. That is the same test §4b uses
              everywhere else — `user_id IS NOT NULL` is the line between a member and a
              person the family has recorded. */}
          {profile.hasAccount && (
            <section className="space-y-2 rounded-lg border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold text-brand-ink">Sign-in</h3>
              <p className="text-sm text-muted-foreground">
                You cannot see or set this member’s password. Send them a link and they
                choose a new one themselves; the current one keeps working until they do.
              </p>
              <Button variant="outline" onClick={handleReset} disabled={resetting || saving}>
                {resetting
                  ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                  : <KeyRound className="mr-1.5 h-4 w-4" aria-hidden="true" />}
                Send a password reset
              </Button>
              {/* NOT `FormError` — nothing failed. It is also not `role="alert"`: the
                  press that produced it is the acknowledgement, and interrupting a screen
                  reader mid-form to repeat what the button just did is worse than
                  silence. `--brand-affirm` is the token for an affirmative action having
                  happened. */}
              {resetNotice && (
                <p className="text-sm font-medium text-brand-affirm">{resetNotice}</p>
              )}
            </section>
          )}

          {/* The message sits with the BUTTONS rather than beside the field it is about:
              the panel body scrolls and this footer does not, so a message rendered next
              to an input can be off-screen at the moment somebody presses Save again. */}
          <FormError message={error} />

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
              Save changes
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
