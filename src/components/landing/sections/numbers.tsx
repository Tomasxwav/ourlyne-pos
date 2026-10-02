'use client'

import { useRef } from 'react'
import { PulseBadge } from '@/components/brand/logo'
import { useSmoother } from '@/components/motion/smooth-scroll'
import { gsap, SplitText, useGSAP } from '@/lib/gsap'
import { clearSplitGradient, paintSplitGradient } from '@/lib/split-gradient'

type Stat = {
  /** Valor final mostrado. */
  value: string
  /** Parte numérica para el conteo; si falta se usa ScrambleText. */
  count?: { to: number; decimals?: number }
  prefix?: string
  suffix?: string
  label: string
  note: string
}

const STATS: Stat[] = [
  {
    value: '3',
    count: { to: 3 },
    suffix: 's',
    label: 'para cobrar un ticket',
    note: 'Lector de código de barras, búsqueda instantánea y atajos.',
  },
  {
    value: '40',
    count: { to: 40 },
    prefix: '+',
    label: 'reportes listos',
    note: 'Ventas, utilidad, inventario, cajas, clientes y más.',
  },
  {
    value: '99.9',
    count: { to: 99.9, decimals: 1 },
    suffix: '%',
    label: 'de disponibilidad',
    note: 'Infraestructura en la nube con respaldos automáticos.',
  },
  {
    value: '∞',
    label: 'sucursales en plan Empresa',
    note: 'Crece sin cambiar de sistema ni pagar por migraciones.',
  },
]

export default function Numbers() {
  const sectionRef = useRef<HTMLElement>(null)
  const smoother = useSmoother()

  useGSAP(
    () => {
      const section = sectionRef.current
      if (!section || !smoother) return
      const heading = section.querySelector<HTMLElement>('[data-num-heading]')

      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        let split: SplitText | undefined
        if (heading) {
          split = SplitText.create(heading, { type: 'words' })
          paintSplitGradient(heading, split.words)
          gsap.fromTo(
            split.words,
            { opacity: 0.12, filter: 'blur(4px)' },
            {
              opacity: 1,
              filter: 'blur(0px)',
              stagger: 0.1,
              ease: 'none',
              scrollTrigger: {
                trigger: heading,
                start: 'top 85%',
                end: 'top 40%',
                scrub: true,
              },
            },
          )
        }

        gsap.utils.toArray<HTMLElement>('[data-stat]', section).forEach((el, i) => {
          const num = el.querySelector<HTMLElement>('[data-stat-value]')
          const line = el.querySelector<HTMLElement>('[data-stat-line]')
          const stat = STATS[i]
          if (!num || !stat) return

          const tl = gsap.timeline({
            scrollTrigger: { trigger: el, start: 'top 85%' },
          })
          tl.fromTo(
            line,
            { scaleX: 0 },
            { scaleX: 1, duration: 1.2, ease: 'expo.inOut' },
          )
          if (stat.count) {
            const { to, decimals = 0 } = stat.count
            const counter = { v: 0 }
            num.textContent = (0).toFixed(decimals)
            tl.to(
              counter,
              {
                v: to,
                duration: 1.6,
                ease: 'power3.out',
                onUpdate: () => {
                  num.textContent = counter.v.toFixed(decimals)
                },
              },
              '<+0.1',
            )
          } else {
            tl.fromTo(
              num,
              { autoAlpha: 0 },
              {
                autoAlpha: 1,
                duration: 1.2,
                scrambleText: { text: stat.value, chars: '0123456789%+', speed: 0.5 },
                ease: 'none',
              },
              '<+0.1',
            )
          }
          tl.from(
            el.querySelectorAll('[data-stat-copy]'),
            { y: 20, autoAlpha: 0, stagger: 0.08, duration: 0.8, ease: 'power3.out' },
            '<+0.2',
          )
        })

        return () => {
          section
            .querySelectorAll<HTMLElement>('[data-stat-value]')
            .forEach((el, i) => (el.textContent = STATS[i]?.value ?? ''))
          split?.revert()
          clearSplitGradient(heading)
        }
      })

      return () => mm.revert()
    },
    { dependencies: [smoother], scope: sectionRef },
  )

  return (
    <section
      ref={sectionRef}
      aria-labelledby='numeros-title'
      className='relative py-24 md:py-36'
    >
      <div className='mx-auto max-w-7xl px-4 md:px-10'>
        <PulseBadge>En números</PulseBadge>
        <h2
          id='numeros-title'
          data-num-heading
          className='text-gradient mt-4 max-w-4xl text-3xl leading-tight font-bold md:text-5xl 2xl:text-6xl'
        >
          Menos filas, menos faltantes, menos hojas de cálculo. Más tiempo para
          tu negocio.
        </h2>

        <dl className='mt-16 grid gap-x-10 sm:grid-cols-2 md:mt-24'>
          {STATS.map((stat) => (
            <div
              key={stat.label}
              data-stat
              className='group relative flex flex-col py-8 md:py-12'
            >
              <span
                data-stat-line
                aria-hidden='true'
                className='absolute top-0 left-0 h-px w-full origin-left bg-border'
              />
              <span
                aria-hidden='true'
                className='pointer-events-none absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gold transition-transform duration-700 ease-expo group-hover:scale-x-100'
              />
              <dt className='order-2 mt-2'>
                <span
                  data-stat-copy
                  className='block font-heading text-xl font-semibold md:text-2xl'
                >
                  {stat.label}
                </span>
                <span
                  data-stat-copy
                  className='mt-1 block max-w-xs text-sm text-foreground/60'
                >
                  {stat.note}
                </span>
              </dt>
              <dd className='order-1 flex items-baseline font-heading leading-none font-bold tracking-tighter'>
                <span className='sr-only'>
                  {`${stat.prefix ?? ''}${stat.value}${stat.suffix ?? ''}`}
                </span>
                <span aria-hidden='true' className='flex items-baseline'>
                  {stat.prefix && (
                    <span className='text-5xl text-gold-deep md:text-7xl dark:text-gold'>
                      {stat.prefix}
                    </span>
                  )}
                  <span
                    data-stat-value
                    className='text-gradient text-8xl tabular-nums md:text-[9rem] 2xl:text-[11rem]'
                  >
                    {stat.value}
                  </span>
                  {stat.suffix && (
                    <span className='ml-1 text-4xl text-gold-deep md:text-6xl dark:text-gold'>
                      {stat.suffix}
                    </span>
                  )}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
