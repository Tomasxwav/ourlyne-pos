'use client'

import { useActionState, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { PulseBadge } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { formatMoney } from '@/lib/money'
import { BUSINESS_TYPES, slugify } from '@/lib/slug'
import { cn } from '@/lib/utils'
import { createTenantAction } from './actions'

type PlanOption = {
  slug: string
  name: string
  description: string
  priceMonthly: number
  features: string[]
  highlighted: boolean
  trialDays: number
}

export function OnboardingForm({ userName, plans }: { userName: string; plans: PlanOption[] }) {
  const [state, action, pending] = useActionState(createTenantAction, null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [plan, setPlan] = useState(plans.find((p) => p.highlighted)?.slug ?? plans[0]?.slug)
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined

  return (
    <form action={action} className='grid gap-12 pt-6 lg:grid-cols-[1fr_1.25fr]'>
      <div>
        <PulseBadge>Paso final</PulseBadge>
        <h1 className='text-gradient mt-5 text-4xl leading-tight font-bold md:text-5xl'>
          Hola {userName.split(' ')[0]}, demos de alta tu negocio.
        </h1>
        <p className='mt-4 text-muted-foreground'>
          Creamos tu sucursal matriz, una caja, impuestos y métodos de pago listos para vender. Todo lo puedes
          ajustar después.
        </p>

        <FieldGroup className='mt-10'>
          <Field data-invalid={!!fieldErrors?.name}>
            <FieldLabel htmlFor='name'>Nombre del negocio</FieldLabel>
            <Input
              id='name'
              name='name'
              required
              placeholder='Ej. Café Aurora'
              className='h-9 text-sm'
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!slugTouched) setSlug(slugify(e.target.value))
              }}
            />
            <FieldError>{fieldErrors?.name?.[0]}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors?.slug}>
            <FieldLabel htmlFor='slug'>Dirección de tu panel</FieldLabel>
            <div className='flex h-9 items-center overflow-hidden rounded-md border border-input bg-input/20 text-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 dark:bg-input/30'>
              <span className='border-r bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground'>/app/</span>
              <input
                id='slug'
                name='slug'
                required
                className='h-full flex-1 bg-transparent px-2 outline-none'
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(slugify(e.target.value))
                }}
              />
            </div>
            <FieldDescription>Solo minúsculas, números y guiones.</FieldDescription>
            <FieldError>{fieldErrors?.slug?.[0]}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor='businessType'>Giro</FieldLabel>
            <NativeSelect id='businessType' name='businessType' defaultValue='retail' className='h-9 text-sm'>
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </FieldGroup>
      </div>

      <div className='flex flex-col'>
        <p className='text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase'>Elige tu plan</p>
        <p className='mt-1 text-sm text-muted-foreground'>
          Empiezas con {plans[0]?.trialDays ?? 14} días de prueba gratis en cualquier plan. Sin tarjeta.
        </p>
        <input type='hidden' name='plan' value={plan} />
        <div role='radiogroup' className='mt-5 grid gap-3'>
          {plans.map((p) => {
            const selected = p.slug === plan
            return (
              <button
                key={p.slug}
                type='button'
                role='radio'
                aria-checked={selected}
                onClick={() => setPlan(p.slug)}
                className={cn(
                  'group relative rounded-xl border bg-card p-5 text-left transition-all duration-300 hover:border-gold/60',
                  selected && 'border-gold bg-gold/5 shadow-lg shadow-gold/10',
                )}
              >
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <div className='flex items-center gap-2'>
                      <h3 className='text-lg font-semibold'>{p.name}</h3>
                      {p.highlighted && (
                        <span className='rounded-full bg-gold/20 px-2 py-0.5 text-[0.6rem] font-semibold tracking-wider text-gold-deep uppercase dark:text-gold'>
                          Recomendado
                        </span>
                      )}
                    </div>
                    <p className='mt-1 text-xs text-muted-foreground'>{p.description}</p>
                  </div>
                  <div className='text-right'>
                    <p className='font-heading text-xl font-semibold tabular-nums'>{formatMoney(p.priceMonthly)}</p>
                    <p className='text-[0.65rem] text-muted-foreground'>MXN / mes</p>
                  </div>
                </div>
                <ul className='mt-4 grid gap-1.5 text-xs text-foreground/75 sm:grid-cols-2'>
                  {p.features.slice(0, 4).map((f) => (
                    <li key={f} className='flex items-center gap-1.5'>
                      <Check className='size-3 text-gold-deep' /> {f}
                    </li>
                  ))}
                </ul>
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-5 -left-px h-8 w-0.5 rounded-full bg-gold transition-opacity',
                    selected ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </button>
            )
          })}
        </div>

        {state && !state.ok && !state.fieldErrors && (
          <p role='alert' className='mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive'>
            {state.error}
          </p>
        )}

        <Button type='submit' size='lg' className='mt-6 h-11 text-sm' disabled={pending}>
          {pending && <Loader2 className='animate-spin' />}
          Crear mi negocio
        </Button>
      </div>
    </form>
  )
}
