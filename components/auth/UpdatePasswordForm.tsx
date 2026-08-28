'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, FormError } from '@/components/ui/form-message'
import { useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

/**
 * Set a new password, at the end of a recovery link.
 *
 * THE SCREEN THAT DID NOT EXIST. `resetPasswordForEmail` has pointed at
 * `/update-password` since it was written and nothing was ever served there, while
 * `/auth/confirm` sent recovery to `/forgot-password?stage=reset` — a page that ignores
 * the query and asks for an email address again. The two halves disagreed about the
 * destination, which is the tell that the flow had never been walked end to end. Both now
 * point here.
 *
 * IT RUNS ON A SESSION, NOT ON A TOKEN. By the time this renders, `/auth/confirm` has
 * already exchanged the `token_hash` via verifyOtp() and written session cookies, so
 * there is no token in this component and none in the URL — which is the point of doing
 * the exchange server-side. `updateUser({ password })` acts on that session.
 *
 * The page above it refuses to render this without a session, so the "your link expired"
 * case is answered before any form appears rather than by a failed submit.
 */

// A FACTORY, not a constant: the messages are copy and a schema built at module load
// cannot reach the reader's catalogue. `FormData` is inferred from the RETURN type, so
// the shape is still checked exactly as before.
const schema = (t: T) => z.object({
  // 8, matching RegisterForm. config.toml's minimum_password_length is 6, so the server
  // would accept less — a UI stricter than the server is safe, the reverse is a rejection
  // the user cannot see coming. If that floor moves, move it in both places.
  password: z.string().min(8, t('auth.tooShort')),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: t('auth.noMatch'),
  path: ['confirmPassword'],
})

type FormData = z.infer<ReturnType<typeof schema>>

export function UpdatePasswordForm() {
  const t = useT()
  const router = useRouter()
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema(t)),
  })

  async function onSubmit(data: FormData) {
    setServerError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: data.password })

    if (error) {
      // The likeliest cause is a session that has aged out between landing here and
      // submitting — say what to do rather than repeating GoTrue's wording.
      setServerError(
        error.message.toLowerCase().includes('session')
          ? t('auth.expiredLink')
          : error.message,
      )
      return
    }

    // The session is already signed in, so there is nowhere to send them but in.
    // refresh() first: the layout above renders from server state that now differs.
    router.refresh()
    router.push('/dashboard')
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle as="h1" className="text-2xl">{t('auth.chooseNew')}</CardTitle>
        <CardDescription>{t('ui.pickSomethingNotUsed')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">{t('security.newPassword')}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t('security.ph.minChars')}
              autoComplete="new-password"
              {...register('password')}
            />
            <FieldError message={errors.password?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{t('security.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            <FieldError message={errors.confirmPassword?.message} />
          </div>

          <FormError message={serverError} />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t('action.saving') : t('security.savePassword')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <Link href="/login" className="text-primary font-medium hover:underline">
          {t('auth.backToSignIn')}
        </Link>
      </CardFooter>
    </Card>
  )
}
