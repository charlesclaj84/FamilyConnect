'use server'

import { randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export type RegisterResult =
  | { success: true; familyCode?: string }
  | { success: false; field?: string; message: string }

export interface RegisterInput {
  firstName: string
  lastName: string
  email: string
  password: string
  mode: 'join' | 'create'
  familyCode?: string
  familyName?: string
}

/**
 * The family code is deliberately public — it is meant to be shared so relatives
 * can join — but it is still read aloud, written down and typed, and it is the
 * string a join request is keyed on. So it has to be unguessable enough not to be
 * walked, and unambiguous enough to be dictated over a phone.
 *
 * Both of which the previous generator failed:
 *   Math.random().toString(36).substring(2, 8).toUpperCase()
 * was not cryptographically random; not length-guaranteed (Math.random() can
 * produce a short base-36 expansion — 0.5 renders as "0.i" — so substring(2, 8)
 * silently yielded fewer than six characters); and base-36 uppercased contains
 * both 0/O and 1/I.
 *
 * This alphabet drops 0, 1, I, L, O and U — the digit/letter confusions, plus U so
 * the set cannot spell anything unfortunate. 30^6 ≈ 729 million codes.
 */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 6

function generateCode(): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  }
  return out
}

/**
 * The read-then-insert check below is a courtesy that produces a clean error
 * instead of a constraint violation; it is not the uniqueness guarantee and does
 * not close the race between the SELECT and the INSERT. That guarantee is
 * `family_code TEXT UNIQUE NOT NULL` (20260602000000_families.sql:3).
 */
async function generateUniqueFamilyCode(): Promise<string | null> {
  const admin = createAdminClient()
  for (let i = 0; i < 5; i++) {
    const code = generateCode()
    const { data } = await admin.from('families').select('id').eq('family_code', code).maybeSingle()
    if (!data) return code
  }
  return null
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const admin = createAdminClient()

  if (input.mode === 'join') {
    const code = input.familyCode?.trim().toUpperCase() ?? ''
    if (!code) {
      return { success: false, field: 'familyCode', message: 'Family code is required' }
    }
    const { data } = await admin
      .from('families')
      .select('id')
      .eq('family_code', code)
      .maybeSingle()
    if (!data) {
      return {
        success: false,
        field: 'familyCode',
        message: 'Family code not found. Check with your family and try again.',
      }
    }
  }

  let familyCode: string
  if (input.mode === 'create') {
    const generated = await generateUniqueFamilyCode()
    if (!generated) {
      return { success: false, message: 'Could not generate a unique family code. Please try again.' }
    }
    familyCode = generated
  } else {
    familyCode = input.familyCode!.trim().toUpperCase()
  }

  // Use the anon key so signUp respects the project's email-confirmation settings.
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: authData, error: authError } = await anon.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        first_name: input.firstName,
        last_name: input.lastName,
        family_code: familyCode,
        family_name: input.mode === 'create' ? input.familyName!.trim() : null,
        family_role: input.mode === 'create' ? 'owner' : 'member',
      },
    },
  })

  if (authError) {
    return { success: false, message: authError.message }
  }

  // Stamp family_code into app_metadata. Unlike user_metadata (set via signUp's
  // `data` above), app_metadata is NOT editable by end users, so it is the only
  // JWT claim safe to trust for family membership — used by the people-insert
  // RLS bootstrap and by getOrCreate profile paths before a people row exists.
  if (authData.user) {
    await admin.auth.admin.updateUserById(authData.user.id, {
      app_metadata: { family_code: familyCode },
    })
  }

  if (input.mode === 'create' && authData.user) {
    const { error: familyError } = await admin.from('families').insert({
      family_code: familyCode,
      family_name: input.familyName!.trim(),
      created_by: authData.user.id,
    })
    if (familyError) {
      // Roll back to avoid an orphaned auth account.
      await admin.auth.admin.deleteUser(authData.user.id)
      return { success: false, message: 'Failed to create family record. Please try again.' }
    }
  }

  // Seed the people table so the profile page is pre-populated.
  // When joining an existing family, first try to link to a pre-existing record
  // (e.g. a family member added this person as a child/relative before they registered).
  if (authData.user) {
    const normalizedEmail = input.email.trim().toLowerCase()
    let linked = false

    if (input.mode === 'join') {
      const { data: existing } = await admin
        .from('people')
        .select('id')
        .eq('family_code', familyCode)
        .eq('primary_email', normalizedEmail)
        .is('user_id', null)
        .maybeSingle()

      if (existing) {
        await admin
          .from('people')
          .update({ user_id: authData.user.id, primary_email: normalizedEmail })
          .eq('id', existing.id)
        linked = true
      }
    }

    if (!linked) {
      await admin.from('people').insert({
        user_id: authData.user.id,
        family_code: familyCode,
        is_minor: false,
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        primary_email: normalizedEmail,
        created_by: authData.user.id,
      })
    }
    // Non-fatal: if this fails the user can fill in their profile manually.
  }

  return { success: true, familyCode: input.mode === 'create' ? familyCode : undefined }
}
