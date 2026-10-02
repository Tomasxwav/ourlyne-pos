'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { PulseBadge } from '@/components/brand/logo'
import { buttonVariants } from '@/components/ui/button'
import { gsap, SplitText, useGSAP } from '@/lib/gsap'
import { formatMoney } from '@/lib/money'
import { btnFillOutline, btnFillPrimary } from '@/lib/motion-classes'
import { clearSplitGradient, paintSplitGradient } from '@/lib/split-gradient'
import { cn } from '@/lib/utils'

export type PricingPlan = {
  slug: string
  name: string
  description: string
  /** Centavos MXN. */
  priceMonthly: number
  /** Centavos MXN. */
  priceYearly: number
  features: string[]
  highlighted: boolean
  trialDays: number
}

type Cycle = 'monthly' | 'yearly'

const price = (cents: number) => formatMoney(cents).replace(/\.00$/, '')

export default function PricingTable({ plans }: { plans: PricingPlan[] }) {
  const [cycle, setCycle] = useState<Cycle>('monthly')
  const sectionRef = useRef<HTMLElement>(null)
  const yearly = cycle === 'yearly'

  useGSAP(
    () => {
      const section = sectionRef.current
      if (!section) return
      const heading = section.querySelector<HTMLElement>('[data-price-heading]')
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        let split: SplitText | undefined
        if (heading) {
          split = SplitText.create(heading, {
            type: 'lines,words',
            mask: 'lines',
          })
          paintSplitGradient(heading, split.words)
          gsap.from(split.words, {
            yPercent: 110,
            stagger: 0.04,
            duration: 1,
            ease: 'expo.out',
            scrollTrigger: { trigger: section, start: 'top 70%' },
          })
        }
        gsap.from('[data-price-intro]', {
          autoAlpha: 0,
          y: 20,
          stagger: 0.1,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 70%' },
        })
        gsap.from('[data-price-card]', {
          autoAlpha: 0,
          y: 80,
          rotationX: 8,
          transformPerspective: 1000,
          stagger: 0.12,
          duration: 1.2,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: section.querySelector('[data-price-grid]'),
            start: 'top 80%',
          },
        })
        return () => {
          split?.revert()
          clearSplitGradient(heading)
        }
      })
      return () => mm.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section
      id='precios'
      ref={sectionRef}
      aria-labelledby='precios-title'
      className='relative isolate overflow-hidden py-24 md:py-36'
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute top-1/3 left-1/2 -z-10 h-96 w-[56rem] max-w-[140vw] -translate-x-1/2 rounded-full bg-gold/15 blur-3xl'
      />
      <div className='mx-auto max-w-7xl px-4 md:px-10'>
        <div className='flex flex-col items-center text-center'>
          <span data-price-intro>
            <PulseBadge>Precios</PulseBadge>
          </span>
          <h2
            id='precios-title'
            data-price-heading
            className='text-gradient mt-4 max-w-3xl text-3xl leading-tight font-bold md:text-5xl'
          >
            Un plan para cada etapa de tu negocio.
          </h2>
          <p
            data-price-intro
            className='mt-4 max-w-xl font-abeezee text-sm text-foreground/65 md:text-base'
          >
            Precios en pesos mexicanos. Empieza gratis y cambia de
            plan cuando lo necesites.
          </p>

          <div
            data-price-intro
            role='radiogroup'
            aria-label='Periodo de facturación'
            className='mt-8 inline-flex items-center gap-1 rounded-full border border-border bg-card/70 p-1 backdrop-blur-sm'
          >
            {(
              [
                ['monthly', 'Mensual'],
                ['yearly', 'Anual'],
              ] as const
            ).map(([value, label]) => {
              const active = cycle === value
              return (
                <button
                  key={value}
                  type='button'
                  role='radio'
                  aria-checked={active}
                  onClick={() => setCycle(value)}
                  className={cn(
                    'relative flex items-center gap-2 rounded-full px-5 py-2 text-xs font-medium transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    active
                      ? 'bg-foreground text-background'
                      : 'text-foreground/65 hover:text-foreground',
                  )}
                >
                  {label}
                  {value === 'yearly' && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[0.6rem] font-semibold',
                        active
                          ? 'bg-gold text-[#111]'
                          : 'bg-gold/20 text-gold-deep dark:text-gold',
                      )}
                    >
                      2 meses gratis
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <ul
          data-price-grid
          className='mx-auto mt-14 grid max-w-md gap-5 md:max-w-none md:grid-cols-3 md:gap-4 lg:gap-6'
        >
          {plans.map((plan) => {
            const amount = yearly ? plan.priceYearly : plan.priceMonthly
            const perMonth = Math.round(plan.priceYearly / 12)
            return (
              <li key={plan.slug} data-price-card className='h-full'>
                <article
                  aria-labelledby={`plan-${plan.slug}`}
                  className={cn(
                    'group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card/80 p-6 backdrop-blur-sm transition-[border-color,box-shadow,translate] duration-500 hover:-translate-y-1 md:p-7',
                    plan.highlighted
                      ? 'border-gold/70 shadow-2xl shadow-gold/20 dark:shadow-gold/10'
                      : 'border-border hover:border-gold/40',
                  )}
                >
                  {plan.highlighted && (
                    <>
                      <div
                        aria-hidden='true'
                        className='pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-gold to-transparent'
                      />
                      <div
                        aria-hidden='true'
                        className='pointer-events-none absolute -top-24 left-1/2 -z-10 size-64 -translate-x-1/2 rounded-full bg-gold/25 blur-3xl'
                      />
                    </>
                  )}
                  <div className='flex items-center justify-between gap-3'>
                    <h3
                      id={`plan-${plan.slug}`}
                      className='text-2xl font-bold tracking-tight'
                    >
                      {plan.name}
                    </h3>
                    {plan.highlighted && (
                      <span className='inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-[0.6rem] font-semibold tracking-wide text-[#111] uppercase'>
                        <Sparkles className='size-3' aria-hidden='true' />
                        Más popular
                      </span>
                    )}
                  </div>
                  <p className='mt-2 min-h-10 text-sm text-foreground/65'>
                    {plan.description}
                  </p>

                  <div className='mt-6' aria-live='polite'>
                    <p
                      key={cycle}
                      className='flex items-baseline gap-1.5 duration-500 animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none'
                    >
                      <span className='font-heading text-5xl font-bold tracking-tight tabular-nums'>
                        {price(amount)}
                      </span>
                      <span className='text-sm text-foreground/55'>
                        MXN / {yearly ? 'año' : 'mes'}
                      </span>
                    </p>
                    <p className='mt-1 h-4 text-xs text-foreground/55'>
                      {yearly
                        ? `Equivale a ${price(perMonth)} al mes`
                        : `o ${price(plan.priceYearly)} al año con 2 meses gratis`}
                    </p>
                  </div>

                  <Link
                    href={`/sign-up?plan=${encodeURIComponent(plan.slug)}`}
                    data-magnetic='0.2'
                    className={buttonVariants({
                      variant: plan.highlighted ? 'default' : 'outline',
                      size: 'lg',
                      className: `${plan.highlighted ? btnFillPrimary : btnFillOutline} mt-6 h-11 w-full rounded-full text-sm`,
                    })}
                  >
                    Empezar prueba
                    <span className='sr-only'> del plan {plan.name}</span>
                  </Link>
                  <p className='mt-2 text-center text-[0.7rem] text-foreground/50'>
                    {plan.trialDays} días gratis · sin tarjeta
                  </p>

                  <ul className='mt-6 space-y-2.5 border-t border-border pt-6 text-sm'>
                    {plan.features.map((feature) => (
                      <li key={feature} className='flex gap-2.5'>
                        <Check
                          aria-hidden='true'
                          className='mt-0.5 size-4 shrink-0 text-gold-deep dark:text-gold'
                        />
                        <span className='text-foreground/80'>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </li>
            )
          })}
        </ul>

        <p className='mt-10 text-center text-xs text-foreground/50'>
          ¿Necesitas una integración especial o ayuda para migrar?{' '}
          <a
            href='mailto:hola@ourlyne.com'
            className='font-medium text-foreground underline decoration-gold underline-offset-4 hover:text-gold-deep dark:hover:text-gold'
          >
            Escríbenos
          </a>
          .
        </p>
      </div>
    </section>
  )
}
