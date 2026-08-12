'use client'

import { useState } from 'react'
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
})

type FormData = z.infer<typeof schema>

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setServerError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/update-password`,
    })
    if (error) {
      setServerError(error.message)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle as="h1" className="text-2xl text-primary">Email sent</CardTitle>
          <CardDescription>
            If that address is in our system, you&apos;ll receive a password reset link shortly.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/login" className="text-primary font-medium hover:underline text-sm">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle as="h1" className="text-2xl">Forgot your password?</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a reset link.
        </CardDescription>
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

          {serverError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send Reset Link'}
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
