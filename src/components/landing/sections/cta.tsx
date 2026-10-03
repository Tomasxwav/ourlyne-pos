'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { PulseBadge } from '@/components/brand/logo'
import { buttonVariants } from '@/components/ui/button'
import { useSmoother } from '@/components/motion/smooth-scroll'
import { gsap, SplitText, useGSAP } from '@/lib/gsap'
import { btnFillOutline, btnFillPrimary } from '@/lib/motion-classes'
import { clearSplitGradient, paintSplitGradient } from '@/lib/split-gradient'

export default function CTA() {
  const sectionRef = useRef<HTMLElement>(null)
  const smoother = useSmoother()

  useGSAP(
    () => {
      const section = sectionRef.current
      const heading = section?.querySelector<HTMLElement>('[data-cta-heading]')
      if (!section || !smoother || !heading) return

      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const split = SplitText.create(heading, {
          type: 'lines,words,chars',
          mask: 'lines',
          autoSplit: true,
          onSplit(self) {
            paintSplitGradient(heading, self.chars)
            return gsap.from(self.chars, {
              yPercent: 120,
              rotation: 10,
              transformOrigin: '0% 100%',
              stagger: { each: 0.02, from: 'center' },
              duration: 1.2,
              ease: 'expo.out',
              scrollTrigger: { trigger: section, start: 'top 75%' },
            })
          },
        })
        gsap.from('[data-cta-fade]', {
          y: 24,
          opacity: 0,
          stagger: 0.12,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 75%' },
        })
        return () => {
          split.revert()
          clearSplitGradient(heading)
        }
      })

      mm.add(
        '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
        () => {
          gsap
            .timeline({
              scrollTrigger: {
                trigger: section,
                start: 'top top',
                end: '+=100%',
                pin: true,
                scrub: true,
                invalidateOnRefresh: true,
              },
            })
            .to('[data-cta-glow]', {
              x: 80,
              y: -40,
              scale: 1.7,
              ease: 'sine.inOut',
            })
            .to('[data-cta-ring]', { rotation: 90, scale: 1.15, ease: 'none' }, 0)
        },
      )

      return () => mm.revert()
    },
    { dependencies: [smoother], scope: sectionRef },
  )

  return (
    <section
      ref={sectionRef}
      aria-labelledby='cta-title'
      className='relative isolate z-10 flex min-h-dvh flex-col justify-center overflow-hidden bg-background py-28'
    >
      <div
        data-cta-glow
        aria-hidden='true'
        className='pointer-events-none absolute top-1/2 left-1/2 -z-10 size-96 -translate-1/2 rounded-full bg-primary/40 blur-3xl md:size-144'
      />
      <div
        data-cta-ring
        aria-hidden='true'
        className='pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[min(90vw,44rem)] -translate-1/2 rounded-full border border-dashed border-gold/30'
      />

      <div className='mx-auto flex max-w-3xl flex-col items-center px-4 text-center md:px-10'>
        <span data-cta-fade>
          <PulseBadge>Empieza hoy</PulseBadge>
        </span>
        <h2
          id='cta-title'
          data-cta-heading
          className='text-gradient mt-6 text-4xl leading-tight font-bold md:text-6xl 2xl:text-7xl'
        >
          Abre tu caja hoy mismo.
        </h2>
        <p
          data-cta-fade
          className='mt-5 max-w-xl font-abeezee text-base leading-relaxed text-foreground/70 md:text-lg'
        >
          Configura tu negocio en minutos y haz tu primera venta esta tarde. Te
          acompañamos en cada paso.
        </p>
        <div data-cta-fade className='mt-9 flex flex-col gap-3 sm:flex-row'>
          <Link
            href='/sign-up'
            data-magnetic='0.45'
            className={buttonVariants({
              size: 'lg',
              className: `${btnFillPrimary} h-12 rounded-full px-8 text-sm`,
            })}
          >
            Prueba gratis 14 días
            <ArrowUpRight data-icon='inline-end' />
          </Link>
          <a
            href='mailto:contacto@ourlyne.com'
            data-magnetic='0.45'
            className={buttonVariants({
              variant: 'outline',
              size: 'lg',
              className: `${btnFillOutline} h-12 rounded-full bg-background/40 px-8 text-sm`,
            })}
          >
            Hablar con ventas
          </a>
        </div>
        <p
          data-cta-fade
          className='mt-6 text-xs tracking-wide text-foreground/55'
        >
          Sin tarjeta · Cancela cuando quieras · Soporte en español
        </p>
      </div>
    </section>
  )
}
