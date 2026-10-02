'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'
import { useSmoother } from '@/components/motion/smooth-scroll'
import { markIntroDone } from '@/lib/intro'
import { INTRO_STORAGE_KEY } from './intro-guard'

const COLUMNS = 5
const WORDMARK = 'OURLYNE'

function alreadyPlayed() {
  try {
    return sessionStorage.getItem(INTRO_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function rememberPlayed() {
  try {
    sessionStorage.setItem(INTRO_STORAGE_KEY, '1')
  } catch {
    /* almacenamiento no disponible: se reproducirá de nuevo, sin problema */
  }
}

/** Versión corta (≈1.6 s) de la intro de Ourlyne, una sola vez por sesión. */
export default function LandingIntro() {
  const rootRef = useRef<HTMLDivElement>(null)
  const counterRef = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(true)
  const smoother = useSmoother()

  useEffect(() => {
    if (!alreadyPlayed()) return
    markIntroDone()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con sessionStorage tras hidratar
    setVisible(false)
  }, [])

  useGSAP(
    () => {
      if (!smoother || alreadyPlayed()) return

      smoother.paused(true)
      const finish = () => {
        rememberPlayed()
        smoother.paused(false)
        setVisible(false)
      }

      const reduced = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
      const counter = { value: 0 }

      const tl = gsap.timeline({
        defaults: { ease: 'power4.inOut' },
        onComplete: finish,
      })

      if (reduced) {
        tl.call(markIntroDone, [], 0).to(rootRef.current, {
          autoAlpha: 0,
          duration: 0.3,
        })
        return
      }

      tl.from('[data-intro-logo]', {
        scale: 0,
        rotation: -120,
        duration: 0.6,
        ease: 'expo.out',
      })
        .from(
          '[data-intro-char]',
          {
            yPercent: 110,
            rotation: 12,
            stagger: 0.03,
            duration: 0.55,
            ease: 'expo.out',
          },
          '<+0.05',
        )
        .to(
          counter,
          {
            value: 100,
            duration: 0.9,
            ease: 'power3.inOut',
            onUpdate: () => {
              if (counterRef.current) {
                counterRef.current.textContent = String(
                  Math.round(counter.value),
                ).padStart(3, '0')
              }
            },
          },
          0,
        )
        .fromTo(
          '[data-intro-bar]',
          { scaleX: 0 },
          { scaleX: 1, duration: 0.9, ease: 'power3.inOut' },
          0,
        )
        .to(
          '[data-intro-char]',
          { yPercent: -110, stagger: 0.02, duration: 0.35, ease: 'power3.in' },
          0.85,
        )
        .to(
          '[data-intro-logo], [data-intro-meta]',
          { autoAlpha: 0, y: -24, duration: 0.3, ease: 'power3.in' },
          '<',
        )
        .to(
          '[data-intro-col="dark"]',
          {
            yPercent: -100,
            stagger: { each: 0.04, from: 'center' },
            duration: 0.6,
          },
          '>-0.1',
        )
        .to(
          '[data-intro-col="gold"]',
          {
            yPercent: -100,
            stagger: { each: 0.04, from: 'center' },
            duration: 0.6,
          },
          '<+0.08',
        )
        .call(markIntroDone, [], '<+0.1')

      return () => {
        tl.kill()
        smoother.paused(false)
      }
    },
    { dependencies: [smoother], scope: rootRef },
  )

  if (!visible) return null

  return (
    <div
      ref={rootRef}
      aria-hidden='true'
      className='fixed inset-0 z-100 overflow-hidden in-data-intro-played:hidden'
    >
      <div className='absolute inset-0 flex'>
        {Array.from({ length: COLUMNS }).map((_, i) => (
          <div
            key={`gold-${i}`}
            data-intro-col='gold'
            className='h-full flex-1 bg-gold'
          />
        ))}
      </div>
      <div className='absolute inset-0 flex'>
        {Array.from({ length: COLUMNS }).map((_, i) => (
          <div
            key={`dark-${i}`}
            data-intro-col='dark'
            className='-mr-px h-full flex-1 bg-[#0a0a0a]'
          />
        ))}
      </div>

      <div className='absolute inset-0 flex flex-col items-center justify-center gap-5 text-silk'>
        <Image
          data-intro-logo
          src='/logo.png'
          alt=''
          width={64}
          height={64}
          className='size-14 object-contain md:size-18'
          priority
        />
        <div className='flex overflow-hidden font-heading text-3xl font-bold tracking-[0.35em] md:text-5xl'>
          {WORDMARK.split('').map((char, i) => (
            <span key={i} data-intro-char className='inline-block'>
              {char}
            </span>
          ))}
        </div>
        <span className='text-[0.65rem] tracking-[0.5em] text-gold uppercase'>
          Punto de venta
        </span>
      </div>

      <div
        data-intro-meta
        className='absolute inset-x-6 bottom-6 flex items-end justify-between gap-6 text-silk md:inset-x-10 md:bottom-10'
      >
        <div className='mb-3 h-px flex-1 bg-white/10'>
          <div data-intro-bar className='h-full origin-left bg-gold' />
        </div>
        <span
          ref={counterRef}
          className='font-heading text-5xl leading-none font-light tabular-nums md:text-8xl'
        >
          000
        </span>
      </div>
    </div>
  )
}
