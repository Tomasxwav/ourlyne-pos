import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import { spectral, abeezee, outfit } from '@/lib/fonts'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Ourlyne POS — Punto de venta en la nube',
    template: '%s · Ourlyne POS',
  },
  description:
    'Punto de venta multi-sucursal en la nube: ventas, inventario, clientes, compras, cajas y reportes en un solo lugar.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang='es'
      className={cn(
        'h-full antialiased',
        geistMono.variable,
        spectral.variable,
        abeezee.variable,
        outfit.variable,
      )}
      suppressHydrationWarning
    >
      <body className='min-h-full flex flex-col selection:bg-gold selection:text-[#111]'>
        <ThemeProvider
          attribute='class'
          defaultTheme='system'
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position='top-right' />
        </ThemeProvider>
      </body>
    </html>
  )
}
