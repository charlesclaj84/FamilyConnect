'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { registerUser } from '@/app/actions/register'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

type Mode = 'join' | 'create'

const schema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    familyCode: z.string().optional(),
    familyName: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

export function RegisterForm() {
  const [mode, setMode] = useState<Mode>('join')
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState(false)
  const [newFamilyCode, setNewFamilyCode] = useState('')

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  function switchMode(next: Mode) {
    if (next === mode) return
    setMode(next)
    setServerError('')
  }

  async function onSubmit(data: FormData) {
    setServerError('')

    if (mode === 'join' && !data.familyCode?.trim()) {
      setError('familyCode', { message: 'Family code is required' })
      return
    }
    if (mode === 'create' && !data.familyName?.trim()) {
      setError('familyName', { message: 'Family name is required' })
      return
    }

    const result = await registerUser({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password,
      mode,
      familyCode: data.familyCode,
      familyName: data.familyName,
    })

    if (!result.success) {
      if (result.field === 'familyCode' || result.field === 'familyName') {
        setError(result.field as keyof FormData, { message: result.message })
      } else {
        setServerError(result.message)
      }
      return
    }

    if (result.familyCode) setNewFamilyCode(result.familyCode)
    setSuccess(true)
  }

  if (success && newFamilyCode) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">Family created!</CardTitle>
          <CardDescription>
            Share this code with family members so they can join.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <div className="w-full rounded-lg border-2 border-primary/30 bg-primary/5 px-8 py-5 text-center">
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Your Family Code</p>
            <p className="text-4xl font-bold tracking-widest text-primary">{newFamilyCode}</p>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Write this down — you'll need it to invite family members.
          </p>
          <p className="text-center text-sm text-muted-foreground">
            We also sent a confirmation link to your inbox. Click it to activate your account.
          </p>
        </CardContent>
        <CardFooter className="justify-center">
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    )
  }

  if (success) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to your inbox. Click it to activate your account, then sign in.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>
          {mode === 'join' ? 'Join your family on Family Connect' : 'Start a new family on Family Connect'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-5 flex rounded-lg border p-1">
          <button
            type="button"
            onClick={() => switchMode('join')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === 'join'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Join a Family
          </button>
          <button
            type="button"
            onClick={() => switchMode('create')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === 'create'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Start a New Family
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" placeholder="Jane" autoComplete="given-name" {...register('firstName')} />
              {errors.firstName && (
                <p className="text-sm text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" placeholder="Doe" autoComplete="family-name" {...register('lastName')} />
              {errors.lastName && (
                <p className="text-sm text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" {...register('email')} />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="Min. 8 characters" autoComplete="new-password" {...register('password')} />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input id="confirmPassword" type="password" placeholder="••••••••" autoComplete="new-password" {...register('confirmPassword')} />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          {mode === 'join' && (
            <div className="space-y-1.5">
              <Label htmlFor="familyCode">Family Code</Label>
              <Input
                id="familyCode"
                placeholder="e.g. ABC123"
                autoComplete="off"
                className="uppercase"
                {...register('familyCode')}
              />
              <p className="text-xs text-muted-foreground">Enter the code shared with you by your family.</p>
              {errors.familyCode && (
                <p className="text-sm text-destructive">{errors.familyCode.message}</p>
              )}
            </div>
          )}

          {mode === 'create' && (
            <div className="space-y-1.5">
              <Label htmlFor="familyName">Family name</Label>
              <Input
                id="familyName"
                placeholder="e.g. The Smiths"
                autoComplete="off"
                {...register('familyName')}
              />
              <p className="text-xs text-muted-foreground">A unique family code will be generated for you to share.</p>
              {errors.familyName && (
                <p className="text-sm text-destructive">{errors.familyName.message}</p>
              )}
            </div>
          )}

          {serverError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting
              ? mode === 'join' ? 'Joining…' : 'Creating family…'
              : mode === 'join' ? 'Join Family' : 'Create Family'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <span className="text-muted-foreground">Already have an account?&nbsp;</span>
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  )
}
