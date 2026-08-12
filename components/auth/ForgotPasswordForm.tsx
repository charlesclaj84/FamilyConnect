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
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle as="h1" className="text-2xl text-primary">Email sent</CardTitle>
          <CardDescription>
            If that address is in our system, you&apos;ll receive a password reset link shortly.
          </CardDescription>
        </CardHeader>
        {/* ── "If" is doing real work in that sentence, so it gets explained ──────
            The same screen appears whether or not the address has an account, and that
            is deliberate rather than vague: a form that answered honestly would let
            anyone holding a family code — which is public by design, it is meant to be
            shared — check which of their relatives is registered here, one address at a
            time. Saying so out loud costs nothing and stops the wording reading as a
            system that does not know what it did.

            The rest is the support email this page otherwise generates. Nothing here is
            invented: the link goes to /update-password (see onSubmit above), and a
            recovery token is single-use and expires. */}
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            You will see this message whichever address you enter. We do not say whether
            an account exists, because the family code needed to reach this site is meant
            to be shared — and a form that answered would let anyone holding one work out
            which of your relatives has registered.
          </p>
          <p>
            <span className="font-medium text-foreground">Nothing arrived?</span> Check the
            spam folder first, then try the address you registered with rather than the one
            your family usually reaches you on. The link works once and expires, so ask for
            a fresh one rather than reusing an old email.
          </p>
        </CardContent>
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
      <CardFooter className="flex-col items-start gap-3 text-sm">
        {/* Two states this page cannot detect and therefore has to name. A reset link
            can only ever reach an address that already has an account, so somebody who
            never finished registering, or who is signed up under a different address,
            will wait for an email that is never coming — and the screen after this one
            deliberately will not tell them which case they are in. */}
        <p className="text-muted-foreground">
          Use the address you registered with. If you never finished creating an account,
          there is nothing to reset —{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            sign up
          </Link>{' '}
          instead, and ask your family for their code if you are joining an existing family.
        </p>
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  )
}
