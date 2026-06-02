'use server'

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

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

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

  return { success: true, familyCode: input.mode === 'create' ? familyCode : undefined }
}
