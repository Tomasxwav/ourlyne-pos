'use client'

import { useRef, type ComponentType } from 'react'
import { PulseBadge } from '@/components/brand/logo'
import { useSmoother } from '@/components/motion/smooth-scroll'
import { gsap, SplitText, useGSAP } from '@/lib/gsap'
import {
  BranchesMock,
  CashCutMock,
  InventoryMock,
  PosMock,
  ReportsMock,
} from '../mocks'

const FLOWS: {
  title: string
  tag: string
  description: string
  stats: string[]
  Mock: ComponentType
}[] = [
  {
    title: 'Cobra en segundos',
    tag: 'Punto de venta',
    description:
      'Escanea, busca o toca. Aplica cupones, divide pagos y entrega el ticket sin hacer esperar a nadie.',
    stats: ['3 s por ticket', 'Atajos de teclado'],
    Mock: PosMock,
  },
  {
    title: 'Inventario en tiempo real',
    tag: 'Existencias',
    description:
      'Cada venta descuenta al instante. Alertas de stock bajo y traspasos entre sucursales en un par de clics.',
    stats: ['Sin sobreventas', 'Kardex por producto'],
    Mock: InventoryMock,
  },
  {
    title: 'Corte de caja sin sorpresas',
    tag: 'Cajas y turnos',
    description:
      'Fondo, entradas, retiros y formas de pago cuadrados por turno. Las diferencias aparecen antes de cerrar.',
    stats: ['Arqueo guiado', 'Historial por cajero'],
    Mock: CashCutMock,
  },
  {
    title: 'Decide con datos',
    tag: 'Reportes',
    description:
      'Ventas, utilidad, productos estrella y horas pico. Información clara para comprar mejor y vender más.',
    stats: ['+40 reportes', 'Por sucursal y periodo'],
    Mock: ReportsMock,
  },
  {
    title: 'Multi-sucursal y multi-usuario',
    tag: 'Operación',
    description:
      'Todas tus tiendas en un solo panel. Cada persona ve sólo lo que necesita con roles y permisos a la medida.',
    stats: ['Roles por sucursal', 'Bitácora de acciones'],
    Mock: BranchesMock,
  },
]

const DESKTOP = '(min-width: 768px) and (prefers-reduced-motion: no-preference)'
const MOBILE = '(max-width: 767px) and (prefers-reduced-motion: no-preference)'
const END_GUTTER = 48

export default function Showcase() {
  const sectionRef = useRef<HTMLElement>(null)
  const smoother = useSmoother()

  useGSAP(
    () => {
      const section = sectionRef.current
      if (!section || !smoother) return

      const stage = section.querySelector<HTMLElement>('[data-stage]')
      const track = section.querySelector<HTMLElement>('[data-track]')
      const title = section.querySelector<HTMLElement>('[data-show-title]')
      if (!stage || !track || !title) return

      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const split = SplitText.create(title, { type: 'chars' })
        gsap.from(split.chars, {
          yPercent: 120,
          rotationX: -90,
          opacity: 0,
          transformPerspective: 600,
          transformOrigin: '50% 100%',
          stagger: 0.03,
          duration: 1.1,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 70%',
            toggleActions: 'play none none reverse',
          },
        })
        gsap.from('[data-show-badge], [data-show-lead]', {
          autoAlpha: 0,
          y: 20,
          stagger: 0.1,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 70%' },
        })
        return () => split.revert()
      })

      mm.add(DESKTOP, () => {
        const panels = gsap.utils.toArray<HTMLElement>('[data-panel]', section)
        const distance = () =>
          track.scrollWidth - window.innerWidth + END_GUTTER

        const trackTween = gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: stage,
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: true,
            invalidateOnRefresh: true,
          },
        })

        panels.forEach((panel) => {
          const inner = panel.querySelector('[data-panel-inner]')
          const line = panel.querySelector('[data-panel-line]')
          const details = panel.querySelectorAll('[data-panel-detail]')
          gsap.fromTo(
            inner,
            { y: () => Math.min(360, window.innerHeight * 0.4) },
            {
              y: 0,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: panel,
                containerAnimation: trackTween,
                start: 'left 110%',
                end: 'center 60%',
                scrub: true,
                invalidateOnRefresh: true,
              },
            },
          )
          gsap.fromTo(
            line,
            { scaleY: 0 },
            {
              scaleY: 1,
              duration: 1.2,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: panel,
                containerAnimation: trackTween,
                start: 'left 95%',
              },
            },
          )
          gsap.from(details, {
            autoAlpha: 0,
            y: 24,
            stagger: 0.08,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: panel,
              containerAnimation: trackTween,
              start: 'left 85%',
            },
          })
        })
      })

      mm.add(MOBILE, () => {
        gsap.utils.toArray<HTMLElement>('[data-panel]', section).forEach((panel) => {
          gsap.from(panel, {
            autoAlpha: 0,
            y: 60,
            duration: 1,
            ease: 'expo.out',
            scrollTrigger: { trigger: panel, start: 'top 85%' },
          })
        })
      })

      return () => mm.revert()
    },
    { dependencies: [smoother], scope: sectionRef },
  )

  return (
    <section
      id='funciones'
      ref={sectionRef}
      data-anchor='start'
      aria-labelledby='funciones-title'
      className='relative'
    >
      <div
        data-stage
        className='relative overflow-hidden py-20 md:motion-safe:h-dvh md:motion-safe:py-0'
      >
        <div className='relative z-20 px-4 md:px-10 md:motion-safe:absolute md:motion-safe:inset-x-0 md:motion-safe:top-24'>
          <div className='flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
            <div>
              <span data-show-badge className='inline-block'>
                <PulseBadge>Funciones clave</PulseBadge>
              </span>
              <h2
                id='funciones-title'
                data-show-title
                className='mt-3 text-4xl leading-none font-bold tracking-tighter text-transparent md:text-5xl'
                style={{ WebkitTextStroke: '1px var(--foreground)' }}
              >
                <span className='text-foreground'>Un día</span> en tu caja
              </h2>
            </div>
            <p
              data-show-lead
              className='max-w-sm font-abeezee text-sm text-foreground/65 md:text-right'
            >
              De la primera venta al corte del día: así se siente operar con
              Ourlyne POS.
            </p>
          </div>
        </div>

        <div
          data-track
          className='relative z-10 mt-12 flex flex-col gap-16 md:motion-safe:absolute md:motion-safe:inset-y-0 md:motion-safe:left-0 md:motion-safe:mt-0 md:motion-safe:flex-row md:motion-safe:flex-nowrap md:motion-safe:gap-0 md:motion-safe:pl-[40vw] md:motion-safe:will-change-transform'
        >
          {FLOWS.map(({ title, tag, description, stats, Mock }, index) => (
            <article
              key={title}
              data-panel
              aria-labelledby={`flow-${index}`}
              className='relative flex shrink-0 items-center px-4 md:px-10 md:motion-safe:h-full md:motion-safe:w-[52vw] md:motion-safe:px-0 md:motion-safe:pt-40 md:motion-safe:pb-10 xl:motion-safe:w-[46vw]'
            >
              <div
                data-panel-line
                aria-hidden='true'
                className='absolute top-0 left-0 hidden h-full w-px origin-top bg-border md:motion-safe:block'
              />
              <div
                data-panel-inner
                className='w-full md:motion-safe:px-12 md:motion-safe:will-change-transform xl:motion-safe:px-16'
              >
                <div className='group mx-auto flex w-full max-w-xl flex-col md:motion-safe:max-w-[min(100%,calc((100dvh-22rem)*670/460))]'>
                  <div
                    aria-hidden='true'
                    data-cursor='hover'
                    className='relative aspect-670/460 w-full overflow-hidden rounded-lg border border-border bg-linear-to-br from-silk/70 via-background to-gold/15 p-[5%] transition-[border-color,box-shadow] duration-700 group-hover:border-gold/50 group-hover:shadow-2xl group-hover:shadow-gold/10 dark:from-velvet/50 dark:via-card dark:to-gold/10'
                  >
                    <div className='absolute inset-0 bg-[url(/grain.svg)] opacity-10' />
                    <div className='relative h-full transition-transform duration-1000 ease-expo group-hover:scale-[1.03]'>
                      <Mock />
                    </div>
                  </div>
                  <div className='mt-6 flex flex-col gap-3'>
                    <div className='flex items-baseline justify-between gap-4'>
                      <h3
                        id={`flow-${index}`}
                        data-panel-detail
                        className='text-xl font-bold md:text-2xl'
                      >
                        <span className='mr-3 font-mono text-sm font-light text-gold-deep dark:text-gold'>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        {title}
                      </h3>
                      <p
                        data-panel-detail
                        className='shrink-0 text-[0.65rem] tracking-[0.2em] text-gold-deep uppercase dark:text-gold'
                      >
                        {tag}
                      </p>
                    </div>
                    <div className='flex flex-col justify-between gap-2 sm:flex-row sm:gap-8'>
                      <p
                        data-panel-detail
                        className='max-w-sm text-sm text-foreground/70'
                      >
                        {description}
                      </p>
                      <p
                        data-panel-detail
                        className='text-xs whitespace-nowrap text-foreground/50'
                      >
                        {stats.join(' · ')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
          <div
            aria-hidden='true'
            className='hidden w-px shrink-0 bg-border md:motion-safe:block'
          />
        </div>
      </div>
    </section>
  )
}
