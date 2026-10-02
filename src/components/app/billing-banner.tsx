import Link from 'next/link'
import { AlertTriangle, Sparkles } from 'lucide-react'
import type { BillingState } from '@/server/billing-state'

export function BillingBanner({
  slug,
  billing,
  canManage,
}: {
  slug: string
  billing: BillingState
  canManage: boolean
}) {
  if (billing.warning) {
    return (
      <div className='flex flex-wrap items-center gap-2 border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive md:px-6'>
        <AlertTriangle className='size-3.5' />
        <span className='flex-1'>{billing.warning}</span>
        {canManage && (
          <Link
            href={`/app/${slug}/billing`}
            className='font-semibold underline underline-offset-4'
          >
            Ir a facturación
          </Link>
        )}
      </div>
    )
  }
  if (
    billing.status === 'trialing' &&
    billing.trialDaysLeft !== null &&
    billing.trialDaysLeft <= 7
  ) {
    return (
      <div className='flex flex-wrap items-center gap-2 border-b border-gold/30 bg-gold/10 px-4 py-2 text-xs md:px-6'>
        <Sparkles className='size-3.5 text-gold-deep' />
        <span className='flex-1'>
          Te quedan {billing.trialDaysLeft} días de prueba. Elige un plan para
          no perder el acceso.
        </span>
        {canManage && (
          <Link
            href={`/app/${slug}/billing`}
            className='font-semibold text-gold-deep underline underline-offset-4'
          >
            Ver planes
          </Link>
        )}
      </div>
    )
  }
  return null
}
