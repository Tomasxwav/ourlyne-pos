import SmoothScroll from '@/components/motion/smooth-scroll'
import Cursor from '@/components/motion/cursor'
import Header from '@/components/landing/header'
import LandingIntro from '@/components/landing/intro-overlay'
import { INTRO_GUARD_SCRIPT } from '@/components/landing/intro-guard'

export default function MarketingLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      {/* Debe ejecutarse antes de pintar el overlay de la intro. */}
      <script dangerouslySetInnerHTML={{ __html: INTRO_GUARD_SCRIPT }} />
      <SmoothScroll
        fixed={
          <>
            <LandingIntro />
            <Header />
            <Cursor />
            <div
              aria-hidden='true'
              className='pointer-events-none fixed -inset-1/2 z-150 animate-grain bg-[url(/grain.svg)] opacity-6 motion-reduce:animate-none dark:opacity-9'
            />
          </>
        }
      >
        {children}
      </SmoothScroll>
    </>
  )
}
