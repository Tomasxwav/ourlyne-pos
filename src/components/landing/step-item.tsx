'use client'

import { useRef } from 'react'
import { gsap, SplitText, useGSAP } from '@/lib/gsap'

export default function StepItem({
  index,
  title,
  description,
}: {
  index: number
  title: string
  description: string
}) {
  const itemRef = useRef<HTMLLIElement>(null)

  useGSAP(
    () => {
      const el = itemRef.current
      if (!el) return
      const number = el.querySelector<HTMLElement>('[data-step-number]')
      const heading = el.querySelector<HTMLElement>('[data-step-title]')
      const copy = el.querySelector<HTMLElement>('[data-step-copy]')
      const line = el.querySelector<HTMLElement>('[data-step-line]')
      if (!number || !heading || !copy) return

      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const numberText = number.textContent ?? ''
        const titleSplit = SplitText.create(heading, {
          type: 'words',
          mask: 'words',
        })
        const copySplit = SplitText.create(copy, {
          type: 'lines',
          mask: 'lines',
        })

        const tl = gsap.timeline({
          scrollTrigger: { trigger: el, start: 'top 85%' },
        })
        if (line) {
          tl.fromTo(
            line,
            { scaleX: 0 },
            { scaleX: 1, duration: 1.2, ease: 'expo.inOut' },
          )
        }
        tl.fromTo(
          number,
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            duration: 1,
            scrambleText: { text: numberText, chars: '0123456789', speed: 0.6 },
            ease: 'none',
          },
          line ? '<+0.2' : 0,
        )
          .from(
            titleSplit.words,
            { yPercent: 110, stagger: 0.06, duration: 0.9, ease: 'expo.out' },
            '<',
          )
          .from(
            copySplit.lines,
            { yPercent: 100, stagger: 0.08, duration: 0.9, ease: 'expo.out' },
            '<+0.15',
          )

        return () => {
          titleSplit.revert()
          copySplit.revert()
          number.textContent = numberText
        }
      })
      return () => mm.revert()
    },
    { scope: itemRef },
  )

  return (
    <li
      ref={itemRef}
      className='group relative flex gap-6 py-10 first:pt-0 md:gap-10'
    >
      {index > 0 && (
        <span
          data-step-line
          aria-hidden='true'
          className='absolute top-0 left-0 h-px w-full origin-left bg-border/70'
        />
      )}
      <span
        aria-hidden='true'
        className='pointer-events-none absolute inset-y-0 -left-4 right-0 origin-left scale-x-0 bg-linear-to-r from-gold/10 to-transparent transition-transform duration-700 ease-expo group-hover:scale-x-100 md:-left-6'
      />
      <span
        data-step-number
        aria-hidden='true'
        className='relative font-mono text-3xl font-light text-gold-deep/60 tabular-nums transition-colors duration-500 group-hover:text-gold-deep md:text-4xl dark:text-gold/40 dark:group-hover:text-gold'
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className='relative transition-transform duration-700 ease-expo group-hover:translate-x-3'>
        <h3
          data-step-title
          className='text-xl font-semibold tracking-tight md:text-2xl'
        >
          <span className='sr-only'>Paso {index + 1}: </span>
          {title}
        </h3>
        <p
          data-step-copy
          className='mt-2 max-w-md text-sm leading-relaxed text-foreground/65 md:text-base'
        >
          {description}
        </p>
      </div>
    </li>
  )
}
