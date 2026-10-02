'use client'

import { useRef } from 'react'
import {
  BarChart3,
  Boxes,
  HandCoins,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  TicketPercent,
  Truck,
  Users,
} from 'lucide-react'
import { PulseBadge } from '@/components/brand/logo'
import { useSmoother } from '@/components/motion/smooth-scroll'
import DotGrid from '@/components/DotGrid'
import { gsap, ScrollTrigger, SplitText, useGSAP } from '@/lib/gsap'
import { clearSplitGradient, paintSplitGradient } from '@/lib/split-gradient'
import FeatureCard from '../feature-card'

const MODULES = [
  {
    title: 'Punto de venta',
    description: 'Cobro ágil con lector, básculas, cupones y pagos mixtos.',
    icon: <ShoppingCart className='size-full' />,
  },
  {
    title: 'Inventario multi-sucursal',
    description: 'Existencias, kardex, ajustes y traspasos entre tiendas.',
    icon: <Boxes className='size-full' />,
  },
  {
    title: 'Clientes y crédito',
    description: 'Historial de compras, límites de crédito y abonos.',
    icon: <Users className='size-full' />,
  },
  {
    title: 'Compras y proveedores',
    description: 'Órdenes de compra, recepción de mercancía y costos.',
    icon: <Truck className='size-full' />,
  },
  {
    title: 'Cajas y cortes',
    description: 'Apertura, entradas, retiros y arqueo por turno.',
    icon: <HandCoins className='size-full' />,
  },
  {
    title: 'Gastos',
    description: 'Registra gastos por categoría y conoce tu utilidad real.',
    icon: <ReceiptText className='size-full' />,
  },
  {
    title: 'Cupones y promociones',
    description: 'Descuentos por monto, porcentaje, vigencia y uso.',
    icon: <TicketPercent className='size-full' />,
  },
  {
    title: 'Reportes y analítica',
    description: 'Tableros por sucursal, producto, cajero y periodo.',
    icon: <BarChart3 className='size-full' />,
  },
  {
    title: 'Usuarios, roles y permisos',
    description: 'Controla quién vende, ajusta, cancela o ve costos.',
    icon: <ShieldCheck className='size-full' />,
  },
]

const PINNED =
  '(min-width: 1024px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)'
const MOTION = '(prefers-reduced-motion: no-preference)'

export default function Features() {
  const sectionRef = useRef<HTMLElement>(null)
  const smoother = useSmoother()

  useGSAP(
    () => {
      const section = sectionRef.current
      if (!section || !smoother) return

      const heading = section.querySelector<HTMLElement>('[data-feat-heading]')
      const intro = section.querySelectorAll('[data-feat-badge], [data-feat-copy]')
      const dots = section.querySelector<HTMLElement>('[data-feat-dots]')

      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (!heading) return
        const split = SplitText.create(heading, { type: 'words' })
        paintSplitGradient(heading, split.words)
        gsap.from(split.words, {
          opacity: 0.08,
          yPercent: 35,
          filter: 'blur(6px)',
          stagger: 0.06,
          duration: 1,
          ease: 'power2.out',
          scrollTrigger: { trigger: section, start: 'top 60%' },
        })
        gsap.from(intro, {
          autoAlpha: 0,
          y: 24,
          stagger: 0.1,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 60%' },
        })
        return () => {
          split.revert()
          clearSplitGradient(heading)
        }
      })

      mm.add(PINNED, () => {
        const cards = gsap.utils.toArray<HTMLElement>('[data-feat-item]', section)
        const grid = section.querySelector<HTMLElement>('[data-feat-grid]')
        if (!grid || !cards.length) return

        const place = () => {
          const g = grid.getBoundingClientRect()
          const cx = g.left + g.width / 2
          const cy = g.top + g.height / 2
          cards.forEach((card, index) => {
            gsap.set(card, { clearProps: 'transform' })
            const r = card.getBoundingClientRect()
            gsap.set(card, {
              x: cx - (r.left + r.width / 2),
              y: cy - (r.top + r.height / 2),
              rotation: (index % 2 ? 1 : -1) * (6 + index * 2),
              scale: 0.55,
              opacity: 0,
            })
          })
        }
        place()

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: '+=260%',
            pin: true,
            scrub: true,
            invalidateOnRefresh: true,
          },
        })

        cards.forEach((card, index) => {
          tl.to(
            card,
            { opacity: 0.35, scale: 0.75, ease: 'power2.out' },
            index === 0 ? '+=0.2' : '<+=0.12',
          ).to(
            card,
            {
              x: 0,
              y: 0,
              rotation: 0,
              scale: 1,
              opacity: 1,
              ease: 'power3.inOut',
            },
            '<+=0.2',
          )
        })
        tl.to({}, { duration: 0.4 })

        if (dots) {
          tl.fromTo(
            dots,
            { yPercent: 0 },
            { yPercent: -35, ease: 'none', duration: tl.duration() },
            0,
          )
        }
      })

      mm.add({ pinned: PINNED, motion: MOTION }, (ctx) => {
        const { pinned, motion } = ctx.conditions as Record<string, boolean>
        if (pinned || !motion) return
        gsap.set('[data-feat-item]', { autoAlpha: 0, y: 40 })
        ScrollTrigger.batch(gsap.utils.toArray('[data-feat-item]', section), {
          start: 'top 90%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              autoAlpha: 1,
              y: 0,
              stagger: 0.08,
              duration: 0.9,
              ease: 'expo.out',
            }),
        })
      })

      return () => mm.revert()
    },
    { dependencies: [smoother], scope: sectionRef },
  )

  return (
    <section
      id='modulos'
      ref={sectionRef}
      data-anchor='start'
      aria-labelledby='modulos-title'
      className='relative isolate overflow-hidden px-4 py-24 md:px-10 lg:min-h-dvh lg:py-20'
    >
      <div className='mx-auto grid max-w-7xl items-center gap-12 lg:min-h-[calc(100dvh-10rem)] lg:grid-cols-12 lg:gap-10'>
        <div className='flex flex-col gap-5 lg:col-span-5'>
          <span data-feat-badge className='w-fit'>
            <PulseBadge>Módulos</PulseBadge>
          </span>
          <h2
            id='modulos-title'
            data-feat-heading
            className='text-gradient text-3xl leading-tight font-bold md:text-5xl'
          >
            Todo tu negocio, en un solo sistema.
          </h2>
          <div data-feat-copy className='max-w-md'>
            <p className='text-lg font-semibold md:text-xl'>
              Activa sólo lo que necesitas hoy y suma módulos cuando crezcas.
            </p>
            <p className='mt-3 font-abeezee text-sm text-foreground/65 md:text-base'>
              Nueve módulos conectados entre sí: lo que vendes descuenta
              inventario, alimenta tus reportes y cuadra tu corte de caja
              automáticamente.
            </p>
          </div>
        </div>

        <ul
          data-feat-grid
          className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-7 lg:grid-cols-3'
        >
          {MODULES.map((m, i) => (
            <li key={m.title} data-feat-item>
              <FeatureCard
                index={i}
                title={m.title}
                description={m.description}
                icon={m.icon}
                className='min-h-36 lg:min-h-[clamp(9rem,22dvh,12rem)]'
              />
            </li>
          ))}
        </ul>
      </div>

      <div
        data-feat-dots
        aria-hidden='true'
        className='absolute inset-x-0 top-0 -z-10 hidden h-[160%] lg:block'
      >
        <DotGrid
          className='opacity-20'
          dotSize={4}
          gap={56}
          baseColor='#D2B68A'
          activeColor='#EEE5D9'
          proximity={0}
          shockRadius={0}
          shockStrength={0}
          resistance={0}
          returnDuration={0}
        />
      </div>
    </section>
  )
}
