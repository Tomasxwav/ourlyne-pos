import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { buttonVariants } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className='relative isolate flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-10 text-center'>
      <div
        aria-hidden
        className='absolute top-1/2 left-1/2 -z-10 size-[30rem] -translate-1/2 rounded-full bg-gold/20 blur-3xl'
      />
      <Logo />
      <p
        className='font-heading text-[9rem] leading-none font-bold text-transparent'
        style={{ WebkitTextStroke: '1.5px var(--border)' }}
      >
        404
      </p>
      <h1 className='text-gradient -mt-4 text-2xl font-bold'>
        No encontramos esta página
      </h1>
      <Link href='/' className={buttonVariants({ size: 'lg' })}>
        Ir al inicio
      </Link>
    </main>
  )
}
