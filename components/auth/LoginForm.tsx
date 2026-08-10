'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { safeNext } from '@/lib/safe-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_NAME } from '@/lib/brand'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

export function LoginForm() {
  const router = useRouter()
  // /auth/confirm redirects here with ?error=… when a confirmation link is invalid,
  // expired or already used. Without this the user lands on a bare sign-in form with no
  // hint that the link they just clicked did anything at all.
  const searchParams = useSearchParams()
  const linkError = searchParams.get('error') ?? ''
  // Where to go after signing in. /invite/<token> sends people here with one, so an
  // invitee who already has an account lands back on the invitation and has it redeemed,
  // instead of arriving at the dashboard and being told to go find the email again.
  // Validated because it arrives in a URL and is therefore attacker-controlled —
  // lib/safe-next.ts, shared with /auth/confirm.
  const next = safeNext(searchParams.get('next'))
  // Someone who came from an invitation, then found they have no account, must not be
  // handed the ordinary register form — it asks for a family code they were never told,
  // which is the dead end this whole flow exists to close. Carry the token across.
  // `next` is already decoded by searchParams.get(), so the token is taken as-is —
  // decoding it a second time would both mangle a legitimate value and throw on a
  // malformed escape (`?next=/invite/%zz`), which is a crash an attacker picks.
  const inviteToken = next.startsWith('/invite/')
    ? next.slice('/invite/'.length).split(/[?#/]/)[0]
    : ''
  const registerHref = inviteToken
    ? `/register?invite=${encodeURIComponent(inviteToken)}`
    : '/register'
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setServerError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) {
      setServerError(error.message)
    } else {
      router.push(next)
      router.refresh()
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your {APP_NAME} account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
            <Link href="/forgot-password" className="text-sm text-primary hover:underline block text-right">
              Forgot password?
            </Link>
          </div>

          {/* A failed confirmation link, until they try to sign in and get a live
              answer — at which point the sign-in error is the more useful one. */}
          {linkError && !serverError && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {linkError}
            </div>
          )}

          {serverError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <span className="text-muted-foreground">Don&apos;t have an account?&nbsp;</span>
        <Link href={registerHref} className="text-primary font-medium hover:underline">
          Create one
        </Link>
      </CardFooter>
    </Card>
  )
}
