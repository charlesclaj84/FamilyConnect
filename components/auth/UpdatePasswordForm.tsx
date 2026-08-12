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

const schema = z.object({
  // 8, matching RegisterForm. config.toml's minimum_password_length is 6, so the server
  // would accept less — a UI stricter than the server is safe, the reverse is a rejection
  // the user cannot see coming. If that floor moves, move it in both places.
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

export function UpdatePasswordForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
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
          ? 'That reset link has expired. Request a new one and try again.'
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
        <CardTitle as="h1" className="text-2xl">Choose a new password</CardTitle>
        <CardDescription>
          Pick something you have not used here before. You will be signed in as soon as
          it is saved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          {serverError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save new password'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  )
}
