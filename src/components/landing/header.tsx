'use client'

import Link from 'next/link'
import { useState, type MouseEvent } from 'react'
import { ArrowUpRight, Menu } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { buttonVariants } from '@/components/ui/button'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useSmoother } from '@/components/motion/smooth-scroll'
import RollText, { rollLink } from '@/components/motion/roll-text'
import { ScrollTrigger, useGSAP } from '@/lib/gsap'
import { btnFillPrimary } from '@/lib/motion-classes'
import { cn } from '@/lib/utils'
import { NAV_LINKS } from './nav'

const toggleClass =
  'flex size-9 items-center justify-center rounded-full border border-border transition-colors hover:border-gold/60 hover:text-gold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-4'

export default function Header() {
  const smoother = useSmoother()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useGSAP(
    () => {
      if (!smoother) return
      const st = ScrollTrigger.create({
        start: 48,
        end: 'max',
        onToggle: (self) => setScrolled(self.isActive),
      })
      return () => st.kill()
    },
    { dependencies: [smoother] },
  )

  const goTo = (event: MouseEvent<HTMLAnchorElement>, hash: string) => {
    event.preventDefault()
    setOpen(false)
    // Espera a que el panel libere el bloqueo de scroll antes de desplazarse.
    window.setTimeout(() => {
      const target = document.getElementById(hash.slice(1))
      if (!target) return
      if (smoother) smoother.scrollTo(target, true, 'top top')
      else target.scrollIntoView({ behavior: 'smooth' })
      history.replaceState(null, '', hash)
    }, 320)
  }

  return (
    <header
      data-scrolled={scrolled}
      className='fixed inset-x-0 top-0 z-50 border-b border-transparent bg-background/40 backdrop-blur-sm transition-[background-color,border-color] duration-500 data-[scrolled=true]:border-border data-[scrolled=true]:bg-background/80'
    >
      <div className='mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-10 md:py-4'>
        <Logo href='/' />

        <nav aria-label='Principal' className='hidden items-center gap-8 lg:flex'>
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                rollLink,
                'rounded-sm text-xs font-medium tracking-wide text-foreground/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              )}
            >
              <RollText>{link.label}</RollText>
            </a>
          ))}
        </nav>

        <div className='flex items-center gap-2 md:gap-3'>
          <Link
            href='/sign-in'
            className={cn(
              rollLink,
              'hidden rounded-sm px-2 text-xs font-medium tracking-wide text-foreground/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:inline-flex',
            )}
          >
            <RollText>Iniciar sesión</RollText>
          </Link>
          <Link
            href='/sign-up'
            data-magnetic='0.3'
            className={cn(
              buttonVariants({
                size: 'lg',
                className: `${btnFillPrimary} rounded-full px-5 text-xs`,
              }),
              'hidden sm:inline-flex',
            )}
          >
            Prueba gratis
          </Link>
          <AnimatedThemeToggler className={toggleClass} />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className={cn(toggleClass, 'lg:hidden')}
              aria-label='Abrir menú'
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side='right' className='w-[86%] gap-0 p-0'>
              <div className='flex items-center border-b border-border px-6 py-4'>
                <Logo href={null} />
              </div>
              <SheetTitle className='sr-only'>Menú</SheetTitle>
              <SheetDescription className='sr-only'>
                Navegación principal de Ourlyne POS
              </SheetDescription>
              <nav aria-label='Móvil' className='flex flex-col px-6 py-6'>
                {NAV_LINKS.map((link, i) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => goTo(e, link.href)}
                    className='group flex items-baseline gap-4 border-b border-border/60 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  >
                    <span className='font-mono text-xs text-gold-deep tabular-nums dark:text-gold'>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className='font-heading text-2xl font-semibold transition-transform duration-500 ease-expo group-hover:translate-x-1'>
                      {link.label}
                    </span>
                  </a>
                ))}
              </nav>
              <div className='mt-auto flex flex-col gap-3 border-t border-border p-6'>
                <Link
                  href='/sign-up'
                  className={buttonVariants({
                    size: 'lg',
                    className: `${btnFillPrimary} h-11 rounded-full text-sm`,
                  })}
                >
                  Prueba gratis 14 días
                  <ArrowUpRight data-icon='inline-end' />
                </Link>
                <Link
                  href='/sign-in'
                  className={buttonVariants({
                    variant: 'outline',
                    size: 'lg',
                    className: 'h-11 rounded-full text-sm',
                  })}
                >
                  Iniciar sesión
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
