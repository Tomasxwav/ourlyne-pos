'use client'

import { useRef } from 'react'
import { PulseBadge } from '@/components/brand/logo'
import { gsap, ScrollTrigger, SplitText, useGSAP } from '@/lib/gsap'
import { clearSplitGradient, paintSplitGradient } from '@/lib/split-gradient'
import StepItem from '../step-item'

const STEPS = [
  {
    title: 'Crea tu cuenta',
    description:
      'Regístrate en un minuto, nombra tu negocio y elige tu plan. Tienes 14 días de prueba sin tarjeta.',
  },
  {
    title: 'Da de alta tu catálogo',
    description:
      'Captura productos, precios e impuestos. Configura sucursales, cajas y usuarios con sus permisos.',
  },
  {
    title: 'Abre tu caja y vende',
    description:
      'Cobra desde la computadora o tableta con lector e impresora térmica. El inventario se actualiza solo.',
  },
  {
    title: 'Analiza y crece',
    description:
      'Revisa ventas, utilidad y existencias en tiempo real. Detecta tendencias y abre tu siguiente sucursal.',
  },
]

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const section = sectionRef.current
      if (!section) return
      const line = section.querySelector<HTMLElement>('[data-how-line]')
      const heading = section.querySelector<HTMLElement>('[data-how-heading]')

      const aside = section.querySelector<HTMLElement>('[data-how-aside]')
      const list = section.querySelector<HTMLElement>('[data-how-list]')

      const mm = gsap.matchMedia()
      // position: sticky no funciona dentro de ScrollSmoother: se fija con pin.
      mm.add('(min-width: 768px)', () => {
        if (!aside || !list) return
        ScrollTrigger.create({
          trigger: aside,
          start: 'top 128px',
          end: () => `+=${Math.max(0, list.offsetHeight - aside.offsetHeight)}`,
          pin: true,
          pinSpacing: false,
          invalidateOnRefresh: true,
        })
      })
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (line) {
          gsap.fromTo(
            line,
            { scaleY: 0 },
            {
              scaleY: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: section,
                start: 'top 70%',
                end: 'bottom 60%',
                scrub: true,
              },
            },
          )
        }
        if (!heading) return
        const split = SplitText.create(heading, { type: 'words' })
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
        return () => {
          split.revert()
          clearSplitGradient(heading)
        }
      })
      return () => mm.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section
      ref={sectionRef}
      aria-labelledby='como-title'
      className='relative py-24 md:py-36'
    >
      <div className='mx-auto max-w-7xl px-4 md:grid md:grid-cols-[1fr_1.3fr] md:gap-16 md:px-10'>
        <div data-how-aside className='md:h-fit'>
          <PulseBadge>Cómo funciona</PulseBadge>
          <h2
            id='como-title'
            data-how-heading
            className='text-gradient mt-4 max-w-sm text-3xl leading-snug font-bold md:text-4xl'
          >
            De cero a tu primera venta en una tarde.
          </h2>
          <p className='mt-4 max-w-sm font-abeezee text-sm text-foreground/65'>
            Sin instalaciones ni servidores. Si tienes navegador e internet,
            tienes punto de venta.
          </p>
        </div>

        <div data-how-list className='relative mt-16 md:mt-0'>
          <div
            data-how-line
            aria-hidden='true'
            className='absolute top-0 -left-6 hidden h-full w-px origin-top bg-linear-to-b from-gold via-gold-deep/60 to-transparent shadow-[0_0_12px_rgba(210,182,138,0.6)] md:block'
          />
          <ol>
            {STEPS.map((step, i) => (
              <StepItem
                key={step.title}
                index={i}
                title={step.title}
                description={step.description}
              />
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
