'use client'

import { useRef } from 'react'
import { Coffee, Pill, Shirt, Wrench } from 'lucide-react'
import { PulseBadge } from '@/components/brand/logo'
import { gsap, useGSAP } from '@/lib/gsap'

/* Testimonios ilustrativos: personas genéricas por giro, sin marcas ni nombres reales. */
const QUOTES = [
  {
    quote:
      'Antes cerrábamos la caja con calculadora y una libreta. Ahora el corte sale cuadrado en dos minutos y sé exactamente cuánto vendí en cada turno.',
    role: 'Propietaria de cafetería',
    place: 'Guadalajara, Jal.',
    icon: Coffee,
  },
  {
    quote:
      'Con tres sucursales el inventario era un caos. Hoy veo existencias en vivo y hago traspasos sin llamar a nadie.',
    role: 'Gerente de ferretería',
    place: 'Monterrey, N.L.',
    icon: Wrench,
  },
  {
    quote:
      'Las alertas de stock bajo nos salvaron más de una vez. Compramos mejor y ya no perdemos ventas por faltantes.',
    role: 'Encargado de farmacia',
    place: 'Puebla, Pue.',
    icon: Pill,
  },
  {
    quote:
      'Mis vendedoras aprendieron a cobrar en una tarde. Los cupones y el crédito a clientas frecuentes nos subieron el ticket promedio.',
    role: 'Dueña de boutique',
    place: 'Mérida, Yuc.',
    icon: Shirt,
  },
]

export default function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-quote]', {
          autoAlpha: 0,
          y: 60,
          stagger: 0.12,
          duration: 1.1,
          ease: 'expo.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 70%' },
        })
      })
      return () => mm.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section
      ref={sectionRef}
      aria-labelledby='testimonios-title'
      className='relative border-y border-border bg-secondary/40 py-24 md:py-32'
    >
      <div className='mx-auto max-w-7xl px-4 md:px-10'>
        <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
          <div>
            <PulseBadge>Testimonios</PulseBadge>
            <h2
              id='testimonios-title'
              className='text-gradient mt-4 max-w-xl text-3xl leading-tight font-bold md:text-5xl'
            >
              Negocios que ya venden con calma.
            </h2>
          </div>
          <p className='max-w-xs text-xs text-foreground/50 md:text-right'>
            Historias ilustrativas basadas en giros reales de nuestros
            clientes.
          </p>
        </div>

        <ul className='mt-14 grid gap-4 md:grid-cols-2'>
          {QUOTES.map(({ quote, role, place, icon: Icon }, i) => (
            <li key={role} data-quote>
              <figure className='group relative flex h-full flex-col justify-between overflow-hidden rounded-xl border border-border bg-card/80 p-6 transition-[border-color,box-shadow] duration-500 hover:border-gold/50 hover:shadow-xl hover:shadow-gold/10 md:p-8'>
                <span
                  aria-hidden='true'
                  className='pointer-events-none absolute -top-6 right-4 font-heading text-[9rem] leading-none text-gold/20 transition-colors duration-500 group-hover:text-gold/40'
                >
                  &ldquo;
                </span>
                <blockquote className='relative font-heading text-lg leading-snug md:text-xl'>
                  <p>{quote}</p>
                </blockquote>
                <figcaption className='relative mt-8 flex items-center gap-3 border-t border-border pt-5'>
                  <span className='flex size-10 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold-deep dark:text-gold'>
                    <Icon className='size-4' aria-hidden='true' />
                  </span>
                  <span className='flex flex-col'>
                    <span className='text-sm font-semibold'>{role}</span>
                    <span className='text-xs text-foreground/55'>{place}</span>
                  </span>
                  <span
                    aria-hidden='true'
                    className='ml-auto font-mono text-xs text-foreground/35 tabular-nums'
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
