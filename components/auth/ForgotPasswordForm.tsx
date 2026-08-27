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
import { FieldError, FormError } from '@/components/ui/form-message'
import { useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

// A FACTORY, not a constant: the messages are copy and a schema built at module load
// cannot reach the reader's catalogue. `FormData` is inferred from the RETURN type, so
// the shape is still checked exactly as before.
const schema = (t: T) => z.object({
  email: z.string().email(t('auth.badEmail')),
})

type FormData = z.infer<ReturnType<typeof schema>>

export function ForgotPasswordForm() {
  const t = useT()
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema(t)),
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
          <CardTitle as="h1" className="text-2xl text-primary">{t('auth.emailSent')}</CardTitle>
          <CardDescription>
            {t('auth.resetSent')}
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
            <span className="font-medium text-foreground">{t('auth.nothingArrived')}</span> Check the
            spam folder first, then try the address you registered with rather than the one
            your family usually reaches you on. The link works once and expires, so ask for
            a fresh one rather than reusing an old email.
          </p>
        </CardContent>
        <CardFooter className="justify-center">
          <Link href="/login" className="text-primary font-medium hover:underline text-sm">
            {t('auth.backToSignIn')}
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle as="h1" className="text-2xl">{t('auth.forgotTitle')}</CardTitle>
        <CardDescription>
          {t('auth.forgotLede')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('field.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('field.ph.email')}
              autoComplete="email"
              {...register('email')}
            />
            <FieldError message={errors.email?.message} />
          </div>

          <FormError message={serverError} />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t('security.sending') : t('auth.sendReset')}
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
          {t('auth.backToSignIn')}
        </Link>
      </CardFooter>
    </Card>
  )
}
