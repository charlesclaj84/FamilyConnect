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

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

/**
 * Local testing convenience: prefill the form from `.env.development.local` so
 * Sign In works in one click. Both guards are compile-time — Next inlines
 * `NODE_ENV` and `NEXT_PUBLIC_*` at build time, so a production build drops this
 * branch entirely and never carries the values.
 */
const devLogin =
  process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_LOGIN_EMAIL
    ? {
        email: process.env.NEXT_PUBLIC_DEV_LOGIN_EMAIL,
        password: process.env.NEXT_PUBLIC_DEV_LOGIN_PASSWORD ?? '',
      }
    : null

export function LoginForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: devLogin ?? undefined,
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
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your Family Connect account</CardDescription>
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
              defaultValue={devLogin?.email}
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
              defaultValue={devLogin?.password}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
            <Link href="/forgot-password" className="text-sm text-primary hover:underline block text-right">
              Forgot password?
            </Link>
          </div>

          {serverError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          {devLogin && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Dev mode — prefilled with <span className="font-medium">{devLogin.email}</span> from
              {' '}<code>.env.development.local</code>. Clear the fields to sign in as someone else.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <span className="text-muted-foreground">Don&apos;t have an account?&nbsp;</span>
        <Link href="/register" className="text-primary font-medium hover:underline">
          Create one
        </Link>
      </CardFooter>
    </Card>
  )
}
