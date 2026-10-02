import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { buttonVariants } from '@/components/ui/button'
import { requireSuperAdmin } from '@/server/session'
import { AdminNav } from './admin-nav'

export const metadata: Metadata = { title: { default: 'Plataforma', template: '%s · Admin Ourlyne' } }

export default async function AdminLayout(props: LayoutProps<'/admin'>) {
  const session = await requireSuperAdmin()
  return (
    <div className='flex min-h-dvh flex-1 flex-col'>
      <header className='sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md'>
        <div className='mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:px-8'>
          <Logo href='/admin' />
          <span className='rounded-full bg-velvet px-2 py-0.5 text-[0.6rem] font-semibold tracking-[0.2em] text-gold uppercase'>
            Admin
          </span>
          <AdminNav />
          <div className='ml-auto flex items-center gap-2'>
            <span className='hidden text-xs text-muted-foreground sm:inline'>{session.user.email}</span>
            <Link href='/app' className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
              <ArrowLeft /> App
            </Link>
            <AnimatedThemeToggler className='flex size-8 items-center justify-center rounded-md border hover:bg-accent [&_svg]:size-3.5' />
          </div>
        </div>
      </header>
      <main className='mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-8'>{props.children}</main>
    </div>
  )
}
