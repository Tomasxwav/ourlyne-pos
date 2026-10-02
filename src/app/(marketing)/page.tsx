import type { Metadata } from 'next'
import Hero from '@/components/landing/sections/hero'
import Marquee from '@/components/landing/sections/marquee'
import Showcase from '@/components/landing/sections/showcase'
import Numbers from '@/components/landing/sections/numbers'
import Features from '@/components/landing/sections/features'
import HowItWorks from '@/components/landing/sections/how-it-works'
import Pricing from '@/components/landing/sections/pricing'
import Testimonials from '@/components/landing/sections/testimonials'
import Faq from '@/components/landing/sections/faq'
import CTA from '@/components/landing/sections/cta'
import Footer from '@/components/landing/sections/footer'

/** Los planes se leen de la base y se revalidan cada hora. */
export const revalidate = 3600

const TITLE = 'Ourlyne POS — Punto de venta en la nube para tu negocio'
const DESCRIPTION =
  'Vende más y controla todo desde una sola caja: punto de venta, inventario multi-sucursal, clientes, compras, cortes de caja y reportes. Prueba gratis 14 días, sin tarjeta.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    locale: 'es_MX',
    siteName: 'Ourlyne POS',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function Home() {
  return (
    <div className='flex flex-1 flex-col overflow-clip bg-background text-foreground'>
      <main>
        <Hero />
        <Marquee />
        <Showcase />
        <Numbers />
        <Features />
        <HowItWorks />
        <Pricing />
        <Testimonials />
        <Faq />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
