'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'
import { useSmoother } from '@/components/motion/smooth-scroll'
import { markIntroDone } from '@/lib/intro'

const COLUMNS = 5
const WORDMARK = 'OURLYNE'

export default function IntroOverlay() {
  const rootRef = useRef<HTMLDivElement>(null)
  const counterRef = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(true)
  const smoother = useSmoother()

  useGSAP(
    () => {
      if (!smoother) return

      smoother.paused(true)

      const reduced = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
      const counter = { value: 0 }

      const tl = gsap.timeline({
        defaults: { ease: 'power4.inOut' },
        onComplete: () => {
          smoother.paused(false)
          setVisible(false)
        },
      })

      if (reduced) {
        tl.to(rootRef.current, { autoAlpha: 0, duration: 0.4 })
        tl.call(markIntroDone, [], 0)
        return
      }

      tl.from('[data-intro-logo]', {
        scale: 0,
        rotation: -120,
        duration: 1,
        ease: 'expo.out',
      })
        .from(
          '[data-intro-char]',
          {
            yPercent: 110,
            rotation: 12,
            stagger: 0.05,
            duration: 0.9,
            ease: 'expo.out',
          },
          '<+0.1',
        )
        .to(
          counter,
          {
            value: 100,
            duration: 1.8,
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
          { scaleX: 1, duration: 1.8, ease: 'power3.inOut' },
          0,
        )
        .to(
          '[data-intro-char]',
          {
            yPercent: -110,
            stagger: 0.03,
            duration: 0.6,
            ease: 'power3.in',
          },
          '>-0.1',
        )
        .to(
          '[data-intro-logo], [data-intro-meta]',
          { autoAlpha: 0, y: -30, duration: 0.5, ease: 'power3.in' },
          '<',
        )
        .to(
          '[data-intro-col="dark"]',
          {
            yPercent: -100,
            stagger: { each: 0.07, from: 'center' },
            duration: 1.1,
          },
          '>-0.1',
        )
        .to(
          '[data-intro-col="gold"]',
          {
            yPercent: -100,
            stagger: { each: 0.07, from: 'center' },
            duration: 1.1,
          },
          '<+0.14',
        )
        .call(markIntroDone, [], '<+0.25')
    },
    { dependencies: [smoother], scope: rootRef },
  )

  if (!visible) return null

  return (
    <div
      ref={rootRef}
      aria-hidden='true'
      className='fixed inset-0 z-100 overflow-hidden'
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

      <div className='absolute inset-0 flex flex-col items-center justify-center gap-6 text-[#eee5d9]'>
        <Image
          data-intro-logo
          src='/logo.png'
          alt=''
          width={64}
          height={64}
          className='size-16 object-contain md:size-20'
          priority
        />
        <div className='flex overflow-hidden font-heading text-4xl font-bold tracking-[0.35em] md:text-6xl'>
          {WORDMARK.split('').map((char, i) => (
            <span key={i} data-intro-char className='inline-block'>
              {char}
            </span>
          ))}
        </div>
      </div>

      <div
        data-intro-meta
        className='absolute inset-x-6 bottom-6 flex items-end justify-between gap-6 text-[#eee5d9] md:inset-x-10 md:bottom-10'
      >
        <div className='mb-3 h-px flex-1 bg-white/10'>
          <div data-intro-bar className='h-full origin-left bg-gold' />
        </div>
        <span
          ref={counterRef}
          className='font-heading text-6xl leading-none font-light tabular-nums md:text-9xl'
        >
          000
        </span>
      </div>
    </div>
  )
}
