'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field'
import { authClient } from '@/lib/auth-client'

type Mode = 'sign-in' | 'sign-up'

const COPY: Record<Mode, { title: string; subtitle: string; cta: string }> = {
  'sign-in': {
    title: 'Bienvenido de vuelta',
    subtitle: 'Ingresa a tu punto de venta.',
    cta: 'Iniciar sesión',
  },
  'sign-up': {
    title: 'Crea tu cuenta',
    subtitle: '14 días de prueba gratis. Sin tarjeta.',
    cta: 'Crear cuenta',
  },
}

export function AuthForm({
  mode,
  next,
  googleEnabled,
  defaultEmail,
}: {
  mode: Mode
  next?: string
  googleEnabled: boolean
  defaultEmail?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const copy = COPY[mode]
  const destination = next && next.startsWith('/') ? next : mode === 'sign-up' ? '/onboarding' : '/app'

  function onSubmit(formData: FormData) {
    setError(null)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')
    const name = String(formData.get('name') ?? '').trim()

    startTransition(async () => {
      const res =
        mode === 'sign-in'
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name })

      if (res.error) {
        const msg =
          res.error.code === 'INVALID_EMAIL_OR_PASSWORD'
            ? 'Correo o contraseña incorrectos.'
            : res.error.code === 'USER_ALREADY_EXISTS' ||
                res.error.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
              ? 'Ya existe una cuenta con ese correo.'
              : res.error.code === 'PASSWORD_TOO_SHORT'
                ? 'La contraseña debe tener al menos 8 caracteres.'
                : (res.error.message ?? 'No pudimos completar la solicitud.')
        setError(msg)
        return
      }
      toast.success(mode === 'sign-in' ? 'Sesión iniciada' : 'Cuenta creada')
      router.push(destination)
      router.refresh()
    })
  }

  return (
    <div className='flex flex-col gap-8'>
      <div>
        <h1 className='text-gradient text-3xl font-bold'>{copy.title}</h1>
        <p className='mt-2 text-sm text-muted-foreground'>{copy.subtitle}</p>
      </div>

      <form action={onSubmit}>
        <FieldGroup>
          {mode === 'sign-up' && (
            <Field>
              <FieldLabel htmlFor='name'>Tu nombre</FieldLabel>
              <Input
                id='name'
                name='name'
                autoComplete='name'
                required
                className='h-9 text-sm'
              />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor='email'>Correo electrónico</FieldLabel>
            <Input
              id='email'
              name='email'
              type='email'
              autoComplete='email'
              defaultValue={defaultEmail}
              required
              className='h-9 text-sm'
            />
          </Field>
          <Field>
            <div className='flex items-center justify-between'>
              <FieldLabel htmlFor='password'>Contraseña</FieldLabel>
            </div>
            <Input
              id='password'
              name='password'
              type='password'
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              minLength={8}
              required
              className='h-9 text-sm'
            />
            {mode === 'sign-up' && (
              <FieldDescription>Mínimo 8 caracteres.</FieldDescription>
            )}
          </Field>

          {error && (
            <p
              role='alert'
              className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive'
            >
              {error}
            </p>
          )}

          <Button type='submit' size='lg' className='h-10 text-sm' disabled={pending}>
            {pending && <Loader2 className='animate-spin' />}
            {copy.cta}
          </Button>

          {googleEnabled && (
            <>
              <FieldSeparator>o continúa con</FieldSeparator>
              <Button
                type='button'
                variant='outline'
                size='lg'
                className='h-10 text-sm'
                disabled={pending}
                onClick={() =>
                  authClient.signIn.social({
                    provider: 'google',
                    callbackURL: destination,
                  })
                }
              >
                Google
              </Button>
            </>
          )}
        </FieldGroup>
      </form>

      <p className='text-center text-sm text-muted-foreground'>
        {mode === 'sign-in' ? (
          <>
            ¿Aún no tienes cuenta?{' '}
            <Link
              href={next ? `/sign-up?next=${encodeURIComponent(next)}` : '/sign-up'}
              className='font-medium text-foreground underline-offset-4 hover:text-gold-deep hover:underline'
            >
              Prueba gratis
            </Link>
          </>
        ) : (
          <>
            ¿Ya tienes cuenta?{' '}
            <Link
              href={next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in'}
              className='font-medium text-foreground underline-offset-4 hover:text-gold-deep hover:underline'
            >
              Inicia sesión
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
