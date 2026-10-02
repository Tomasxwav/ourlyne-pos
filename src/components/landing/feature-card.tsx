'use client'

import { useRef, type ReactNode } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'
import { cn } from '@/lib/utils'

/** Tarjeta de módulo con inclinación 3D y brillo dorado que sigue al puntero. */
export default function FeatureCard({
  index,
  title,
  description,
  icon,
  className,
}: {
  index: number
  title: string
  description: string
  icon: ReactNode
  className?: string
}) {
  const cardRef = useRef<HTMLDivElement>(null)

  useGSAP(
    (_, contextSafe) => {
      const card = cardRef.current
      if (!card || !contextSafe) return

      const mm = gsap.matchMedia()
      mm.add(
        '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
        () => {
          gsap.set(card, { transformPerspective: 900 })
          const rotateX = gsap.quickTo(card, 'rotationX', {
            duration: 0.6,
            ease: 'power3',
          })
          const rotateY = gsap.quickTo(card, 'rotationY', {
            duration: 0.6,
            ease: 'power3',
          })

          const onMove = contextSafe((e: PointerEvent) => {
            const rect = card.getBoundingClientRect()
            const px = (e.clientX - rect.left) / rect.width
            const py = (e.clientY - rect.top) / rect.height
            card.style.setProperty('--mx', `${px * 100}%`)
            card.style.setProperty('--my', `${py * 100}%`)
            rotateX((0.5 - py) * 12)
            rotateY((px - 0.5) * 12)
          })
          const onLeave = contextSafe(() => {
            rotateX(0)
            rotateY(0)
          })

          card.addEventListener('pointermove', onMove)
          card.addEventListener('pointerleave', onLeave)
          return () => {
            card.removeEventListener('pointermove', onMove)
            card.removeEventListener('pointerleave', onLeave)
          }
        },
      )

      return () => mm.revert()
    },
    { scope: cardRef },
  )

  return (
    <div
      ref={cardRef}
      data-feature-card
      data-cursor='hover'
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-md border border-border bg-card/70 bg-linear-180 from-primary/15 to-card/60 p-4 backdrop-blur-sm transition-[border-color,box-shadow] duration-500 will-change-transform hover:border-gold/60 hover:shadow-2xl hover:shadow-gold/15 dark:from-foreground/8 md:p-5',
        className,
      )}
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100'
        style={{
          background:
            'radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), rgba(210, 182, 138, 0.22), transparent 65%)',
        }}
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-linear-to-r from-transparent via-gold to-transparent transition-transform duration-700 ease-expo group-hover:scale-x-100'
      />
      <div className='relative z-10 flex items-start justify-between'>
        <div
          aria-hidden='true'
          className='size-7 text-foreground transition-[color,transform] duration-700 ease-expo group-hover:-rotate-6 group-hover:scale-110 group-hover:text-gold-deep dark:group-hover:text-gold md:size-8'
        >
          {icon}
        </div>
        <span
          aria-hidden='true'
          className='font-mono text-[0.65rem] text-foreground/35 tabular-nums transition-colors duration-500 group-hover:text-gold-deep dark:group-hover:text-gold'
        >
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <h3 className='relative z-10 mt-4 text-base font-semibold tracking-tight transition-transform duration-500 ease-expo group-hover:translate-x-1 md:text-lg'>
        {title}
      </h3>
      <p className='relative z-10 mt-1.5 text-xs leading-relaxed text-foreground/65 md:text-[0.8rem]'>
        {description}
      </p>
    </div>
  )
}
