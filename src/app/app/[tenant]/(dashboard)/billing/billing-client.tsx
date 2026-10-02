'use client'

import { useState, useTransition } from 'react'
import { Check, CreditCard, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmAction } from '@/components/app/confirm-action'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { cancelSubscription, changePlan, openBillingPortal, resumeSubscription } from './actions'

type PlanCard = {
  slug: string
  name: string
  description: string
  priceMonthly: number
  priceYearly: number
  currency: string
  features: string[]
  highlighted: boolean
}

export function PlanPicker({
  slug,
  plans,
  currentPlan,
  currentInterval,
  active,
}: {
  slug: string
  plans: PlanCard[]
  currentPlan: string | null
  currentInterval: 'month' | 'year'
  active: boolean
}) {
  const [interval, setInterval] = useState<'month' | 'year'>(currentInterval)
  const [pending, start] = useTransition()
  const [target, setTarget] = useState<string | null>(null)

  const choose = (planSlug: string) => {
    setTarget(planSlug)
    start(async () => {
      const res = await changePlan(slug, planSlug, interval)
      if (!res.ok) return void toast.error(res.error)
      if (res.data?.url) {
        window.location.href = res.data.url
        return
      }
      toast.success(res.message ?? 'Plan actualizado')
    })
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h2 className='text-gradient text-xl font-bold'>Planes</h2>
          <p className='text-xs text-muted-foreground'>Cambia de plan cuando quieras; se prorratea automáticamente.</p>
        </div>
        <div className='grid grid-cols-2 rounded-full border bg-card p-0.5 text-xs'>
          {(['month', 'year'] as const).map((i) => (
            <button
              key={i}
              type='button'
              onClick={() => setInterval(i)}
              className={cn(
                'rounded-full px-3 py-1.5 font-medium transition-colors',
                interval === i ? 'bg-foreground text-background' : 'text-muted-foreground',
              )}
            >
              {i === 'month' ? 'Mensual' : 'Anual · 2 meses gratis'}
            </button>
          ))}
        </div>
      </div>
      <div className='grid gap-4 md:grid-cols-3'>
        {plans.map((p) => {
          const current = p.slug === currentPlan && interval === currentInterval && active
          const price = interval === 'year' ? p.priceYearly : p.priceMonthly
          return (
            <div
              key={p.slug}
              className={cn(
                'relative flex flex-col rounded-2xl border bg-card p-5 transition-all',
                p.highlighted && 'border-gold shadow-xl shadow-gold/10',
              )}
            >
              {p.highlighted && (
                <span className='absolute -top-2.5 left-5 rounded-full bg-gold px-2.5 py-0.5 text-[0.6rem] font-bold tracking-wider text-velvet uppercase'>
                  Más popular
                </span>
              )}
              <h3 className='text-lg font-semibold'>{p.name}</h3>
              <p className='mt-1 min-h-8 text-xs text-muted-foreground'>{p.description}</p>
              <p className='mt-4'>
                <span className='font-heading text-3xl font-bold tabular-nums'>{formatMoney(price, p.currency)}</span>
                <span className='text-xs text-muted-foreground'> / {interval === 'year' ? 'año' : 'mes'}</span>
              </p>
              <ul className='mt-4 flex-1 space-y-2 text-xs'>
                {p.features.map((f) => (
                  <li key={f} className='flex gap-2'>
                    <Check className='mt-px size-3.5 shrink-0 text-gold-deep dark:text-gold' /> {f}
                  </li>
                ))}
              </ul>
              <Button
                size='lg'
                variant={current ? 'outline' : p.highlighted ? 'default' : 'outline'}
                className='mt-5 h-9'
                disabled={current || pending}
                onClick={() => choose(p.slug)}
              >
                {pending && target === p.slug && <Loader2 className='animate-spin' />}
                {current ? 'Plan actual' : `Elegir ${p.name}`}
              </Button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function BillingControls({
  slug,
  stripe,
  hasStripeCustomer,
  canCancel,
  canResume,
}: {
  slug: string
  stripe: boolean
  hasStripeCustomer: boolean
  canCancel: boolean
  canResume: boolean
}) {
  const [pending, start] = useTransition()
  return (
    <div className='flex flex-wrap gap-2'>
      {stripe && hasStripeCustomer && (
        <Button
          variant='outline'
          size='lg'
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await openBillingPortal(slug)
              if (res.ok && res.data) window.location.href = res.data.url
              else if (!res.ok) toast.error(res.error)
            })
          }
        >
          {pending ? <Loader2 className='animate-spin' /> : <CreditCard />} Método de pago y facturas
        </Button>
      )}
      {canResume && (
        <Button
          size='lg'
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await resumeSubscription(slug)
              if (res.ok) toast.success(res.message ?? 'Listo')
              else toast.error(res.error)
            })
          }
        >
          Reanudar suscripción
        </Button>
      )}
      {canCancel && (
        <ConfirmAction
          title='¿Cancelar tu suscripción?'
          description='Conservarás el acceso hasta el final del periodo pagado. Puedes reanudarla antes de esa fecha.'
          confirmLabel='Cancelar suscripción'
          action={cancelSubscription.bind(null, slug)}
          trigger={
            <Button variant='ghost' size='lg' className='text-muted-foreground'>
              Cancelar suscripción
            </Button>
          }
        />
      )}
    </div>
  )
}
