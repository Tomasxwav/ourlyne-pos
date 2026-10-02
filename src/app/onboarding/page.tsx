import type { Metadata } from 'next'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { plans } from '@/db/schema'
import { Logo } from '@/components/brand/logo'
import { requireSession } from '@/server/session'
import { OnboardingForm } from './onboarding-form'

export const metadata: Metadata = { title: 'Crea tu negocio' }

export default async function OnboardingPage() {
  const session = await requireSession('/onboarding')
  const planRows = await db.query.plans.findMany({
    where: eq(plans.isActive, true),
    orderBy: [asc(plans.sortOrder)],
  })

  return (
    <div className='relative isolate flex min-h-dvh flex-1 flex-col overflow-hidden'>
      <div aria-hidden className='absolute -top-48 left-1/2 -z-10 size-[48rem] -translate-x-1/2 rounded-full bg-gold/15 blur-3xl' />
      <header className='mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6'>
        <Logo href='/' />
        <span className='text-xs text-muted-foreground'>{session.user.email}</span>
      </header>
      <main className='mx-auto w-full max-w-5xl flex-1 px-6 pb-16'>
        <OnboardingForm
          userName={session.user.name}
          plans={planRows.map((p) => ({
            slug: p.slug,
            name: p.name,
            description: p.description ?? '',
            priceMonthly: p.priceMonthly,
            features: p.features,
            highlighted: p.highlighted,
            trialDays: p.trialDays,
          }))}
        />
      </main>
    </div>
  )
}
