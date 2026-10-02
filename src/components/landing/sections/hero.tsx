'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { PulseBadge } from '@/components/brand/logo'
import { useSmoother } from '@/components/motion/smooth-scroll'
import WebThreads, { type WebThreadsControl } from '@/components/WebThreads'
import { btnFillOutline, btnFillPrimary } from '@/lib/motion-classes'
import { gsap, SplitText, useGSAP } from '@/lib/gsap'
import { onIntroDone } from '@/lib/intro'
import { clearSplitGradient, paintSplitGradient } from '@/lib/split-gradient'
import { HeroDashboardMock } from '../mocks'

const THREADS_DARK = { glow: 0.0058, spread: 0.15, brightness: 1.4 }
const THREADS_LIGHT = { glow: 0.0065, spread: 0.15, brightness: 1.2 }

export default function Hero() {
  const smoother = useSmoother()
  const sectionRef = useRef<HTMLElement>(null)
  const darkThreads = useRef<WebThreadsControl | null>(null)
  const lightThreads = useRef<WebThreadsControl | null>(null)

  useGSAP(
    () => {
      const section = sectionRef.current
      if (!section || !smoother) return

      const heading = section.querySelector<HTMLElement>('h1')
      const paragraph = section.querySelector<HTMLElement>('[data-hero-copy]')
      const fades = section.querySelectorAll('[data-hero-fade]')
      const mock = section.querySelector<HTMLElement>('[data-hero-mock]')

      const threads = { intensity: 0, scroll: 0 }
      const applyThreads = () => {
        const { intensity, scroll } = threads
        const shared = { speedBoost: 1 + scroll * 6 }
        darkThreads.current?.set({
          ...shared,
          spread: THREADS_DARK.spread + scroll * 0.25,
          glow: THREADS_DARK.glow * (1 + scroll * 2),
          brightness: THREADS_DARK.brightness * intensity,
        })
        lightThreads.current?.set({
          ...shared,
          spread: THREADS_LIGHT.spread + scroll * 0.25,
          glow: THREADS_LIGHT.glow * (1 + scroll * 1.5),
          brightness: THREADS_LIGHT.brightness * intensity,
        })
      }
      applyThreads()

      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: reduce)', () => {
        threads.intensity = 1
        applyThreads()
      })

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        let introDone = false
        let headingTween: gsap.core.Tween | undefined
        let paragraphTween: gsap.core.Tween | undefined

        const entrance = gsap.timeline({ paused: true })
        entrance
          .from('[data-hero-badge]', {
            autoAlpha: 0,
            scale: 0.6,
            y: 5,
            duration: 1,
            ease: 'expo.out',
          })
          .from(
            fades,
            {
              autoAlpha: 0,
              y: 30,
              stagger: 0.1,
              duration: 1,
              ease: 'expo.out',
            },
            0.8,
          )
          .from(
            mock,
            {
              autoAlpha: 0,
              y: 80,
              rotationX: 12,
              transformPerspective: 1200,
              duration: 1.6,
              ease: 'expo.out',
            },
            0.35,
          )

        const headingSplit = heading
          ? SplitText.create(heading, {
              type: 'lines,words,chars',
              mask: 'lines',
              autoSplit: true,
              onSplit(self) {
                paintSplitGradient(heading, self.chars)
                headingTween = gsap.from(self.chars, {
                  yPercent: 120,
                  rotation: 8,
                  transformOrigin: '0% 100%',
                  stagger: 0.018,
                  duration: 1.2,
                  ease: 'expo.out',
                  delay: 0.1,
                  paused: !introDone,
                })
                return headingTween
              },
            })
          : undefined

        const paragraphSplit = paragraph
          ? SplitText.create(paragraph, {
              type: 'lines',
              mask: 'lines',
              autoSplit: true,
              onSplit(self) {
                paragraphTween = gsap.from(self.lines, {
                  yPercent: 100,
                  stagger: 0.08,
                  duration: 1,
                  ease: 'expo.out',
                  delay: 0.5,
                  paused: !introDone,
                })
                return paragraphTween
              },
            })
          : undefined

        const stopIntro = onIntroDone(() => {
          introDone = true
          gsap.to(threads, {
            intensity: 1,
            duration: 2.4,
            ease: 'power2.out',
            onUpdate: applyThreads,
          })
          entrance.play()
          headingTween?.play()
          paragraphTween?.play()
        })

        // Parallax al hacer scroll: el texto sube más rápido que el mock y
        // cada tarjeta flotante se mueve según su profundidad.
        const scrollTl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
            onUpdate(self) {
              threads.scroll = self.progress
              applyThreads()
            },
          },
        })
        scrollTl.to('[data-hero-content]', { yPercent: -18, autoAlpha: 0.2, ease: 'none' }, 0)
        gsap.utils
          .toArray<HTMLElement>('[data-depth]')
          .forEach((el) =>
            scrollTl.to(
              el,
              { y: -90 * Number(el.dataset.depth ?? 1), ease: 'none' },
              0,
            ),
          )

        return () => {
          stopIntro()
          headingSplit?.revert()
          paragraphSplit?.revert()
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
      aria-labelledby='hero-title'
      className='relative isolate flex min-h-dvh flex-col overflow-clip'
    >
      <div aria-hidden='true' className='absolute inset-0 -z-10 hidden dark:block'>
        <WebThreads
          controlRef={darkThreads}
          color1='#c2904b'
          color2='#d2b68a'
          color3='#e9d3a8'
          speed={0.01}
          threadCount={8}
          frequency={1.25}
          spread={THREADS_DARK.spread}
          taper={1.6}
          position={0.7}
          pinchX={0.8}
          glow={THREADS_DARK.glow}
          falloff={0.84}
          thickness={2.2}
          brightness={0}
          opacity={0.75}
          mirror
          shimmer={false}
          grain
          grainIntensity={0.05}
          mouseInteraction
          mouseStrength={0.22}
        />
      </div>
      <div aria-hidden='true' className='absolute inset-0 -z-10 dark:hidden'>
        <WebThreads
          controlRef={lightThreads}
          lightMode
          backgroundColor='#ffffff'
          color1='#ffffff'
          color2='#c2904b'
          color3='#c2904b'
          speed={0.08}
          threadCount={8}
          frequency={1.25}
          spread={THREADS_LIGHT.spread}
          taper={1.6}
          position={0.7}
          pinchX={0.8}
          glow={THREADS_LIGHT.glow}
          falloff={0.7}
          thickness={2.2}
          brightness={0}
          opacity={1}
          mirror
          shimmer={false}
          grain
          grainIntensity={0.04}
          mouseInteraction
          mouseStrength={0.22}
        />
      </div>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 -z-10 bg-linear-to-t from-background via-background/60 via-30% to-transparent to-75%'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_90%_90%_at_0%_100%,var(--background)_15%,transparent_100%)] opacity-80'
      />

      <div className='mx-auto grid w-full max-w-7xl flex-1 items-end gap-14 px-4 pt-28 pb-16 md:px-10 md:pt-36 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-10 lg:pb-24'>
        <div data-hero-content className='flex flex-col'>
          <span data-hero-badge className='w-fit'>
            <PulseBadge>Punto de venta en la nube</PulseBadge>
          </span>
          <h1
            id='hero-title'
            className='text-gradient mt-5 text-[2.6rem] leading-[1.02] font-bold tracking-tight sm:text-6xl xl:text-7xl'
          >
            Vende más, controla todo, desde una sola caja.
          </h1>
          <p
            data-hero-copy
            className='mt-6 max-w-xl font-abeezee text-base text-foreground/70 md:text-lg'
          >
            Ourlyne POS reúne ventas, inventario multi-sucursal, clientes,
            compras, cortes de caja y reportes en un sistema rápido y elegante
            que funciona desde cualquier navegador.
          </p>
          <div
            data-hero-fade
            className='mt-8 flex flex-col gap-3 sm:flex-row sm:items-center'
          >
            <Link
              href='/sign-up'
              data-magnetic
              className={buttonVariants({
                size: 'lg',
                className: `${btnFillPrimary} h-12 rounded-full px-7 text-sm`,
              })}
            >
              Prueba gratis 14 días
              <ArrowUpRight data-icon='inline-end' />
            </Link>
            <a
              href='#precios'
              data-magnetic
              className={buttonVariants({
                variant: 'outline',
                size: 'lg',
                className: `${btnFillOutline} h-12 rounded-full bg-background/40 px-7 text-sm`,
              })}
            >
              Ver precios
            </a>
          </div>
          <p
            data-hero-fade
            className='mt-6 text-xs tracking-wide text-foreground/55'
          >
            Sin tarjeta · Cancela cuando quieras · Soporte en español
          </p>
        </div>

        <div
          data-hero-mock
          aria-hidden='true'
          className='relative px-2 pb-10 sm:px-8 lg:px-0 lg:pb-0'
        >
          <div
            aria-hidden='true'
            className='absolute top-1/2 left-1/2 -z-10 size-80 -translate-1/2 rounded-full bg-gold/25 blur-3xl md:size-112'
          />
          <HeroDashboardMock />
        </div>
      </div>
    </section>
  )
}
