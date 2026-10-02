'use client'

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ScrollSmoother, ScrollTrigger, useGSAP } from '@/lib/gsap'

const SmootherContext = createContext<ScrollSmoother | null>(null)

export function useSmoother() {
  return useContext(SmootherContext)
}

export default function SmoothScroll({
  children,
  fixed,
}: {
  children: ReactNode
  fixed?: ReactNode
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [smoother, setSmoother] = useState<ScrollSmoother | null>(null)

  useGSAP(
    () => {
      const wrapper = wrapperRef.current
      if (!wrapper) return

      const instance = ScrollSmoother.create({
        wrapper: '#smooth-wrapper',
        content: '#smooth-content',
        smooth: 1.2,
        smoothTouch: 0.1,
        normalizeScroll: true,
        ignoreMobileResize: true,
      })

      const resetWrapperScroll = () => {
        wrapper.scrollTop = 0
        wrapper.scrollLeft = 0
      }
      wrapper.addEventListener('scroll', resetWrapperScroll)

      const getPinnedEnd = (target: HTMLElement) => {
        if (target.dataset.anchor === 'start') return null
        const ends = ScrollTrigger.getAll()
          .filter((st) => {
            const trigger = st.trigger
            return st.pin && trigger && (trigger === target || target.contains(trigger))
          })
          .map((st) => st.end)
        return ends.length ? Math.max(...ends) : null
      }

      const handleAnchorClick = (event: MouseEvent) => {
        if (event.defaultPrevented || event.button !== 0) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

        const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>(
          'a[href^="#"]',
        )
        if (!anchor) return

        const hash = anchor.getAttribute('href') ?? '#'
        const target = hash === '#' ? 0 : document.getElementById(hash.slice(1))
        if (target === null) return

        event.preventDefault()
        instance.scrollTo(
          target === 0 ? 0 : (getPinnedEnd(target) ?? target),
          true,
          'top top',
        )
        history.replaceState(null, '', hash === '#' ? location.pathname : hash)
      }
      document.addEventListener('click', handleAnchorClick)

      setSmoother(instance)

      return () => {
        document.removeEventListener('click', handleAnchorClick)
        wrapper.removeEventListener('scroll', resetWrapperScroll)
        setSmoother(null)
      }
    },
    { scope: wrapperRef },
  )

  return (
    <SmootherContext.Provider value={smoother}>
      {fixed}
      <div id='smooth-wrapper' ref={wrapperRef}>
        <div id='smooth-content'>{children}</div>
      </div>
    </SmootherContext.Provider>
  )
}
