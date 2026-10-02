'use client'

import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

const INTERACTIVE = 'a, button, [role="button"], [data-cursor="hover"]'
const HIDE_NATIVE_CURSOR = ['cursor-none!', '**:cursor-none!']

export default function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    const mm = gsap.matchMedia()

    mm.add(
      '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
      () => {
        document.documentElement.classList.add(...HIDE_NATIVE_CURSOR)
        gsap.set([dot, ring], { xPercent: -50, yPercent: -50, autoAlpha: 0 })

        const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' })
        const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' })
        const ringX = gsap.quickTo(ring, 'x', {
          duration: 0.55,
          ease: 'power3',
        })
        const ringY = gsap.quickTo(ring, 'y', {
          duration: 0.55,
          ease: 'power3',
        })

        let magnet: HTMLElement | null = null
        let hovering = false
        let visible = false

        const releaseMagnet = () => {
          if (!magnet) return
          gsap.to(magnet, {
            x: 0,
            y: 0,
            duration: 0.9,
            ease: 'elastic.out(1, 0.35)',
          })
          magnet = null
        }

        const onMove = (e: PointerEvent) => {
          if (!visible) {
            visible = true
            gsap.set([dot, ring], { x: e.clientX, y: e.clientY })
            gsap.to([dot, ring], { autoAlpha: 1, duration: 0.3 })
          }

          dotX(e.clientX)
          dotY(e.clientY)

          const target = e.target as Element | null
          const nextMagnet =
            target?.closest<HTMLElement>('[data-magnetic]') ?? null

          if (nextMagnet !== magnet) {
            releaseMagnet()
            magnet = nextMagnet
          }

          if (magnet) {
            const rect = magnet.getBoundingClientRect()
            const strength = Number(magnet.dataset.magnetic) || 0.35
            const offsetX = e.clientX - (rect.left + rect.width / 2)
            const offsetY = e.clientY - (rect.top + rect.height / 2)
            gsap.to(magnet, {
              x: offsetX * strength,
              y: offsetY * strength,
              duration: 0.5,
              ease: 'power3',
            })
            ringX(rect.left + rect.width / 2 + offsetX * strength)
            ringY(rect.top + rect.height / 2 + offsetY * strength)
          } else {
            ringX(e.clientX)
            ringY(e.clientY)
          }

          const isInteractive = !!target?.closest(INTERACTIVE)
          if (isInteractive !== hovering) {
            hovering = isInteractive
            gsap.to(ring, {
              scale: hovering ? 1.9 : 1,
              backgroundColor: hovering
                ? 'rgba(210, 182, 138, 0.18)'
                : 'rgba(210, 182, 138, 0)',
              borderColor: hovering
                ? 'rgba(210, 182, 138, 0)'
                : 'rgba(210, 182, 138, 0.8)',
              duration: 0.45,
              ease: 'power3.out',
            })
            gsap.to(dot, {
              scale: hovering ? 0 : 1,
              duration: 0.3,
              ease: 'power3.out',
            })
          }
        }

        const onDown = () =>
          gsap.to(ring, { scale: hovering ? 1.5 : 0.7, duration: 0.2 })
        const onUp = () =>
          gsap.to(ring, { scale: hovering ? 1.9 : 1, duration: 0.4 })
        const onLeave = () => {
          visible = false
          releaseMagnet()
          gsap.to([dot, ring], { autoAlpha: 0, duration: 0.3 })
        }

        window.addEventListener('pointermove', onMove, { passive: true })
        window.addEventListener('pointerdown', onDown)
        window.addEventListener('pointerup', onUp)
        document.documentElement.addEventListener('pointerleave', onLeave)

        return () => {
          document.documentElement.classList.remove(...HIDE_NATIVE_CURSOR)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerdown', onDown)
          window.removeEventListener('pointerup', onUp)
          document.documentElement.removeEventListener('pointerleave', onLeave)
        }
      },
    )

    return () => mm.revert()
  })

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden='true'
        className='pointer-events-none fixed top-0 left-0 z-160 hidden size-9 rounded-full border border-gold/80 opacity-0 [@media(hover:hover)_and_(pointer:fine)]:block'
      />
      <div
        ref={dotRef}
        aria-hidden='true'
        className='pointer-events-none fixed top-0 left-0 z-160 hidden size-1.5 rounded-full bg-gold opacity-0 [@media(hover:hover)_and_(pointer:fine)]:block'
      />
    </>
  )
}
