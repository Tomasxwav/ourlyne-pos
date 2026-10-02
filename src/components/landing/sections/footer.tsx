'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { Logo } from '@/components/brand/logo'
import { useSmoother } from '@/components/motion/smooth-scroll'
import RollText, { rollLink } from '@/components/motion/roll-text'
import { gsap, useGSAP } from '@/lib/gsap'
import { cn } from '@/lib/utils'
import { NAV_LINKS } from '../nav'

const COLUMNS = [
  {
    title: 'Producto',
    links: [...NAV_LINKS].map((l) => ({ ...l, internal: false })),
  },
  {
    title: 'Cuenta',
    links: [
      { label: 'Crear cuenta', href: '/sign-up', internal: true },
      { label: 'Iniciar sesión', href: '/sign-in', internal: true },
    ],
  },
  {
    title: 'Compañía',
    links: [
      { label: 'hola@ourlyne.com', href: 'mailto:hola@ourlyne.com', internal: false },
      { label: 'Hablar con ventas', href: 'mailto:hola@ourlyne.com', internal: false },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Aviso de privacidad', href: '#', internal: false },
      { label: 'Términos de servicio', href: '#', internal: false },
    ],
  },
]

const linkClass = cn(
  rollLink,
  'rounded-sm text-sm text-foreground/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
)

export default function Footer() {
  const footerRef = useRef<HTMLElement>(null)
  const smoother = useSmoother()

  useGSAP(
    () => {
      const footer = footerRef.current
      if (!smoother || !footer) return

      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.set(footer, { yPercent: -60 })
        gsap
          .timeline({
            scrollTrigger: {
              trigger: footer,
              start: 'top bottom',
              end: 'bottom bottom',
              scrub: true,
              invalidateOnRefresh: true,
            },
          })
          .to(footer, { yPercent: 0, ease: 'none', duration: 1 }, 0)
          .from(
            '[data-footer-char]',
            {
              yPercent: 110,
              rotation: 6,
              stagger: 0.04,
              ease: 'power3.out',
              duration: 0.4,
            },
            0.35,
          )
          .from(
            '[data-footer-col]',
            {
              y: 40,
              autoAlpha: 0,
              stagger: 0.06,
              ease: 'power3.out',
              duration: 0.3,
            },
            0.1,
          )
      })
      return () => mm.revert()
    },
    { dependencies: [smoother], scope: footerRef },
  )

  return (
    <footer
      ref={footerRef}
      className='relative z-0 w-full overflow-hidden border-t border-border bg-background pt-14 md:pt-20'
    >
      <div className='mx-auto w-full max-w-7xl px-4 md:px-10'>
        <div className='flex flex-col gap-10 md:flex-row md:justify-between'>
          <div data-footer-col className='max-w-sm'>
            <Logo href='/' />
            <p className='mt-4 text-sm leading-relaxed text-foreground/60'>
              Punto de venta en la nube para negocios que quieren vender más y
              preocuparse menos. Hecho en México por Ourlyne.
            </p>
          </div>

          <nav
            aria-label='Pie de página'
            className='grid grid-cols-2 gap-8 sm:grid-cols-4 md:gap-12'
          >
            {COLUMNS.map((column) => (
              <div key={column.title} data-footer-col>
                <p className='text-xs font-medium tracking-[0.2em] text-foreground/45 uppercase'>
                  {column.title}
                </p>
                <ul className='mt-4 space-y-3'>
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.internal ? (
                        <Link href={link.href} className={linkClass}>
                          <RollText>{link.label}</RollText>
                        </Link>
                      ) : (
                        <a href={link.href} className={linkClass}>
                          <RollText>{link.label}</RollText>
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className='mt-16 flex flex-col items-center justify-between gap-3 border-t border-border py-6 text-xs text-foreground/50 md:flex-row'>
          <p>© {new Date().getFullYear()} Ourlyne. Todos los derechos reservados.</p>
          <p>Hecho con criterio real, no artificial.</p>
        </div>
      </div>

      <div className='overflow-hidden pb-4 select-none'>
        <span
          aria-hidden='true'
          className='flex justify-center font-heading text-[20vw] leading-none font-bold tracking-tighter text-transparent md:text-[15vw]'
          style={{ WebkitTextStroke: '2px var(--border)' }}
        >
          {'OURLYNE'.split('').map((char, i) => (
            <span
              key={i}
              data-footer-char
              className='inline-block transition-[color,-webkit-text-stroke-color] duration-500 hover:text-gold hover:[-webkit-text-stroke-color:var(--color-gold)]'
            >
              {char}
            </span>
          ))}
        </span>
      </div>
    </footer>
  )
}
