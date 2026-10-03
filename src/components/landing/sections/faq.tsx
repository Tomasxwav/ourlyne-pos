'use client'

import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { PulseBadge } from '@/components/brand/logo'
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap'

const FAQS = [
  {
    q: '¿Cómo funciona la prueba gratis?',
    a: 'Tienes 14 días con todas las funciones de tu plan, sin ingresar tarjeta. Al terminar eliges el plan que mejor se adapte a tu negocio.',
  },
  {
    q: '¿Puedo cancelar cuando quiera?',
    a: 'Sí. No hay plazos forzosos ni penalizaciones. Cancelas desde la sección de facturación y conservas el acceso hasta el final del periodo pagado.',
  },
  {
    q: '¿Emite facturas (CFDI)?',
    a: 'La integración de facturación electrónica está próximamente. Mientras tanto puedes exportar tus ventas para timbrarlas con tu proveedor actual.',
  },
  {
    q: '¿Funciona sin internet?',
    a: 'Ourlyne POS requiere conexión. Está optimizado para conexiones lentas: las pantallas son ligeras y el cobro necesita muy pocos datos.',
  },
  {
    q: '¿Puedo manejar varias sucursales?',
    a: 'Sí. Cada sucursal tiene su inventario, cajas y usuarios, y puedes hacer traspasos entre ellas. Ves todo consolidado o por sucursal desde el mismo panel.',
  },
  {
    q: '¿Qué necesito para imprimir tickets?',
    a: 'Cualquier impresora térmica de 58 u 80 mm instalada en tu equipo. El ticket se imprime directo desde el navegador, sin programas adicionales.',
  },
  {
    q: '¿Mis datos están seguros?',
    a: 'Tu información viaja cifrada y está aislada por negocio. Tú controlas qué puede ver y hacer cada usuario con roles y permisos.',
  },
  {
    q: '¿Puedo migrar mis datos desde otro sistema?',
    a: 'Sí. Escríbenos con tu catálogo y lista de clientes y nuestro equipo te orienta para cargarlos en Ourlyne POS sin perder información.',
  },
]

export default function Faq() {
  const sectionRef = useRef<HTMLElement>(null)
  const refreshTimer = useRef<number | undefined>(undefined)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-faq-item]', {
          autoAlpha: 0,
          y: 30,
          stagger: 0.06,
          duration: 0.9,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: sectionRef.current?.querySelector('[data-faq-list]'),
            start: 'top 80%',
          },
        })
      })
      return () => {
        window.clearTimeout(refreshTimer.current)
        mm.revert()
      }
    },
    { scope: sectionRef },
  )

  // Al abrir/cerrar cambia la altura de la página: recalcula los pins siguientes.
  const onToggle = () => {
    window.clearTimeout(refreshTimer.current)
    refreshTimer.current = window.setTimeout(() => ScrollTrigger.refresh(), 150)
  }

  return (
    <section
      id='preguntas'
      ref={sectionRef}
      aria-labelledby='preguntas-title'
      className='relative py-24 md:py-36'
    >
      <div className='mx-auto max-w-7xl px-4 md:grid md:grid-cols-[1fr_1.6fr] md:gap-16 md:px-10'>
        <div>
          <PulseBadge>Preguntas frecuentes</PulseBadge>
          <h2
            id='preguntas-title'
            className='text-gradient mt-4 max-w-sm text-3xl leading-tight font-bold md:text-5xl'
          >
            Lo que suelen preguntarnos.
          </h2>
          <p className='mt-4 max-w-sm font-abeezee text-sm text-foreground/65'>
            ¿No encuentras tu respuesta? Escríbenos a{' '}
            <a
              href='mailto:contacto@ourlyne.com'
              className='font-medium text-foreground underline decoration-gold underline-offset-4'
            >
              contacto@ourlyne.com
            </a>{' '}
            y te respondemos en español.
          </p>
        </div>

        <div data-faq-list className='mt-12 border-t border-border md:mt-0'>
          {FAQS.map(({ q, a }, i) => (
            <details
              key={q}
              data-faq-item
              onToggle={onToggle}
              className='group border-b border-border'
            >
              <summary className='flex cursor-pointer list-none items-center gap-5 py-5 text-left transition-colors hover:text-gold-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-gold md:py-6 [&::-webkit-details-marker]:hidden'>
                <span
                  aria-hidden='true'
                  className='font-mono text-xs text-foreground/35 tabular-nums transition-colors group-open:text-gold-deep dark:group-open:text-gold'
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className='flex-1 font-heading text-lg font-semibold md:text-xl'>
                  {q}
                </span>
                <span
                  aria-hidden='true'
                  className='flex size-8 shrink-0 items-center justify-center rounded-full border border-border transition-[transform,border-color,background-color] duration-500 ease-expo group-open:rotate-45 group-open:border-gold group-open:bg-gold group-open:text-[#111]'
                >
                  <Plus className='size-4' />
                </span>
              </summary>
              <p className='max-w-2xl pr-12 pb-6 pl-9 text-sm leading-relaxed text-foreground/70 md:text-base'>
                {a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
