import type { Metadata } from 'next'
import Link from 'next/link'
import { asc, eq } from 'drizzle-orm'
import {
  Boxes,
  ChartColumn,
  Lock,
  Receipt,
  TicketPercent,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { db } from '@/db'
import { plans } from '@/db/schema'
import { StatusBadge } from '@/components/app/status-badge'
import { MODULE_KEYS, MODULES } from '@/lib/modules'
import { cn } from '@/lib/utils'
import { getTenantContext, requirePermission } from '@/server/tenant'
import { ModuleSwitch } from '../settings-forms'

export const metadata: Metadata = { title: 'Módulos' }

const ICONS: Record<string, LucideIcon> = { Boxes, Users, Wallet, Truck, Receipt, TicketPercent, ChartColumn }

export default async function ModulesPage(props: PageProps<'/app/[tenant]/settings/modules'>) {
  const { tenant: slug } = await props.params
  const sp = await props.searchParams
  const ctx = await getTenantContext(slug)
  const canManage = ctx.can('settings.manage')
  if (!canManage && !sp.missing) await requirePermission(slug, 'settings.manage')

  const planRows = await db.query.plans.findMany({ where: eq(plans.isActive, true), orderBy: [asc(plans.sortOrder)] })
  const planModules = new Set(ctx.plan?.modules ?? [])
  const missing = typeof sp.missing === 'string' ? sp.missing : null

  return (
    <div className='space-y-4'>
      {missing && missing in MODULES && (
        <div className='rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm'>
          El módulo <strong>{MODULES[missing as keyof typeof MODULES].name}</strong> no está activo.{' '}
          {canManage ? 'Actívalo aquí o mejora tu plan.' : 'Pide a un administrador que lo active.'}
        </div>
      )}
      <div className='grid gap-3 md:grid-cols-2'>
        {MODULE_KEYS.map((key) => {
          const mod = MODULES[key]
          const Icon = ICONS[mod.icon] ?? Boxes
          const inPlan = planModules.has(key)
          const enabled = ctx.modules.includes(key)
          const cheapest = planRows.find((p) => p.modules.includes(key))
          return (
            <div
              key={key}
              className={cn(
                'relative flex gap-4 rounded-xl border bg-card p-4 transition-colors',
                enabled && 'border-gold/40',
                missing === key && 'ring-2 ring-gold',
              )}
            >
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-lg',
                  enabled ? 'bg-velvet text-gold' : 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className='size-5' />
              </span>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  <p className='font-medium'>{mod.name}</p>
                  {!inPlan && (
                    <StatusBadge tone='gold'>
                      <Lock className='size-2.5' /> {cheapest ? `Plan ${cheapest.name}` : 'No disponible'}
                    </StatusBadge>
                  )}
                </div>
                <p className='mt-1 text-xs text-muted-foreground'>{mod.description}</p>
                {!inPlan && ctx.can('billing.manage') && (
                  <Link href={`/app/${slug}/billing`} className='mt-2 inline-block text-xs font-medium text-gold-deep underline underline-offset-4 dark:text-gold'>
                    Mejorar plan
                  </Link>
                )}
              </div>
              {canManage && <ModuleSwitch slug={slug} moduleKey={key} enabled={enabled} locked={!inPlan} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
