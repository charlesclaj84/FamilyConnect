'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

/**
 * THE QUERY STRING ARRIVES AS PROPS, read on the server by the page.
 *
 * It used to be read here with `useSearchParams()`, and that had a cost nobody could see
 * in the browser: the hook opts a client component out of the static prerender, so the
 * page had to wrap this in `<Suspense fallback={null}>` — and `null` is what the SERVER
 * therefore sent. The initial HTML of /login was an empty shell. Everything below,
 * including the heading, reached the page only after React hydrated.
 *
 * That is invisible to a user on a normal connection and total to anything that reads
 * HTML without running scripts. An SEO audit on 2026-08-12 scored the page for having no
 * `h1` and "~2 words of visible text" — both were there in the component and neither was
 * in the response. Reading the parameters on the server and passing them down puts the
 * whole page in the first byte.
 *
 * The trade, stated because it is real: /login is now server-rendered per request rather
 * than static, since reading `searchParams` is a dynamic operation. For a sign-in form
 * that is the right side of the trade — the page is cheap, and an empty shell ranks and
 * reads as nothing.
 */
export function LoginForm({
  /**
   * /auth/confirm redirects here with ?error=… when a confirmation link is invalid,
   * expired or already used. Without it the user lands on a bare sign-in form with no
   * hint that the link they just clicked did anything at all.
   */
  linkError = '',
  /**
   * Raw `?next=`. Still validated here rather than at the call site: it arrives in a URL
   * and is therefore attacker-controlled, and keeping `safeNext` next to its use is what
   * stops a future caller passing it through unchecked — lib/safe-next.ts, shared with
   * /auth/confirm.
   */
  nextParam,
}: {
  linkError?: string
  nextParam?: string
}) {
  const router = useRouter()
  // Where to go after signing in. /invite/<token> sends people here with one, so an
  // invitee who already has an account lands back on the invitation and has it redeemed,
  // instead of arriving at the dashboard and being told to go find the email again.
  const next = safeNext(nextParam)
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
        {/* THE PAGE'S h1. This card is the whole page, so its title is the only thing
            that could be — and until 2026-08-12 there was no h1 here at all, which
            leaves a screen-reader user nothing to jump to. See CardTitle's `as`. */}
        <CardTitle as="h1" className="text-2xl">Welcome back</CardTitle>
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
      {/* ── The orientation prose MOVED OUT on 2026-08-12 ───────────────────────
          It is now `AuthAside` in app/(auth)/login/page.tsx, along with the four
          reasons a sign-in fails. Two things were wrong with it here. It is static
          text inside a `'use client'` component, so it shipped in the JavaScript
          bundle as well as the HTML for no reason; and it was growing, which inside
          the card means pushing the Sign In button down a phone screen to court a
          crawler — a real user's task traded for an imagined one.

          The card keeps ONLY what belongs to the task: the fields, and the way out
          for somebody who has no account. `registerHref` is the reason that link
          stays here rather than joining the rest — it carries the invitation token
          across, which the page-level copy knows nothing about. */}
      <CardFooter className="text-sm">
        <p>
          <span className="text-muted-foreground">Don&apos;t have an account?&nbsp;</span>
          <Link href={registerHref} className="text-primary font-medium hover:underline">
            Create one
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
