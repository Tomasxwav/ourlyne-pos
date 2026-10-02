import { Logo, PulseBadge } from '@/components/brand/logo'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'

const HIGHLIGHTS = [
  ['Cobra en segundos', 'POS táctil con lector de código de barras y atajos.'],
  ['Inventario en vivo', 'Existencias por sucursal, sin sobreventas.'],
  ['Corte de caja claro', 'Arqueo, diferencias y movimientos de efectivo.'],
]

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className='grid min-h-dvh flex-1 lg:grid-cols-[1.05fr_1fr]'>
      <aside className='relative isolate hidden overflow-hidden bg-[#0b0d14] p-10 text-silk lg:flex lg:flex-col'>
        <div
          aria-hidden
          className='absolute -top-40 -left-40 -z-10 size-[42rem] rounded-full bg-velvet/70 blur-3xl'
        />
        <div
          aria-hidden
          className='absolute -right-32 -bottom-48 -z-10 size-[36rem] rounded-full bg-gold/25 blur-3xl'
        />
        <div
          aria-hidden
          className='pointer-events-none absolute inset-0 -z-10 bg-[url(/grain.svg)] opacity-10'
        />
        <div
          aria-hidden
          className='pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-size-[64px_64px] mask-[radial-gradient(ellipse_at_center,black_30%,transparent_75%)]'
        />

        <Logo className='text-silk' />

        <div className='mt-auto max-w-lg'>
          <PulseBadge className='border-white/10 bg-white/5 text-silk'>
            Punto de venta en la nube
          </PulseBadge>
          <h1 className='mt-6 bg-linear-to-r from-gold to-silk bg-clip-text text-5xl leading-[1.05] font-bold text-transparent xl:text-6xl'>
            Vende, controla y crece desde un solo lugar.
          </h1>
          <ul className='mt-10 space-y-5'>
            {HIGHLIGHTS.map(([title, copy], i) => (
              <li key={title} className='flex gap-5'>
                <span className='font-mono text-2xl font-light text-gold/50 tabular-nums'>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className='font-medium'>{title}</p>
                  <p className='text-sm text-silk/60'>{copy}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className='mt-12 text-xs text-silk/40'>
          © {new Date().getFullYear()} Ourlyne · Hecho con criterio real, no
          artificial.
        </p>
      </aside>

      <main className='relative flex flex-col px-6 py-8 md:px-12'>
        <div className='flex items-center justify-between'>
          <Logo className='lg:invisible' />
          <AnimatedThemeToggler className='flex size-9 items-center justify-center rounded-md border transition-colors hover:bg-accent [&_svg]:size-4' />
        </div>
        <div className='mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10'>
          {children}
        </div>
      </main>
    </div>
  )
}
