import Link from 'next/link'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { count, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/db'
import { orders, plans, subscriptions, tenants, user } from '@/db/schema'
import { PageHeader } from '@/components/app/page-header'
import { StatTile } from '@/components/app/stat-tile'
import { StatusBadge } from '@/components/app/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney, formatNumber } from '@/lib/money'

export default async function AdminHome() {
  const since = subDays(new Date(), 30)
  const [subs, [{ tenantsTotal }], [{ newTenants }], [{ users }], [{ gmv }], recent] = await Promise.all([
    db
      .select({ status: subscriptions.status, interval: subscriptions.interval, priceMonthly: plans.priceMonthly, priceYearly: plans.priceYearly, plan: plans.name })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.id, subscriptions.planId)),
    db.select({ tenantsTotal: count() }).from(tenants),
    db.select({ newTenants: count() }).from(tenants).where(gte(tenants.createdAt, since)),
    db.select({ users: count() }).from(user),
    db.select({ gmv: sql<number>`coalesce(sum(${orders.total}), 0)::bigint` }).from(orders).where(gte(orders.createdAt, since)),
    db.query.tenants.findMany({
      orderBy: [desc(tenants.createdAt)],
      limit: 8,
      with: { owner: { columns: { email: true } }, subscription: { with: { plan: true } } },
    }),
  ])

  const active = subs.filter((s) => s.status === 'active' || s.status === 'past_due')
  const mrr = active.reduce((a, s) => a + (s.interval === 'year' ? Math.round(s.priceYearly / 12) : s.priceMonthly), 0)
  const trialing = subs.filter((s) => s.status === 'trialing').length
  const byPlan = Object.entries(
    active.reduce<Record<string, number>>((acc, s) => ((acc[s.plan] = (acc[s.plan] ?? 0) + 1), acc), {}),
  )

  return (
    <>
      <PageHeader eyebrow='Plataforma' title='Resumen SaaS' description='Métricas de negocios, suscripciones e ingresos recurrentes.' />
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <StatTile label='MRR' value={formatMoney(mrr, 'MXN')} hint={`ARR ${formatMoney(mrr * 12, 'MXN', 'es-MX', { compact: true })}`} />
        <StatTile label='Suscripciones activas' value={formatNumber(active.length)} hint={`${trialing} en prueba`} />
        <StatTile label='Negocios' value={formatNumber(tenantsTotal)} hint={`+${newTenants} en 30 días`} />
        <StatTile label='GMV 30 días' value={formatMoney(Number(gmv), 'MXN', 'es-MX', { compact: true })} hint={`${formatNumber(users)} usuarios`} />
      </div>
      <div className='grid gap-4 lg:grid-cols-[1fr_20rem]'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Negocios recientes</CardTitle>
          </CardHeader>
          <CardContent className='divide-y px-0'>
            {recent.map((t) => (
              <Link key={t.id} href={`/admin/tenants?q=${t.slug}`} className='flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-muted/50'>
                <span className='min-w-0 flex-1'>
                  <span className='block truncate font-medium'>{t.name}</span>
                  <span className='block truncate text-muted-foreground'>{t.owner.email}</span>
                </span>
                <StatusBadge tone='gold'>{t.subscription?.plan.name ?? '—'}</StatusBadge>
                <span className='w-20 text-right text-muted-foreground'>{format(t.createdAt, 'd MMM', { locale: es })}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Suscripciones por plan</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-xs'>
            {byPlan.length === 0 && <p className='text-muted-foreground'>Sin suscripciones activas.</p>}
            {byPlan.map(([name, n]) => (
              <div key={name}>
                <div className='flex justify-between'>
                  <span>{name}</span>
                  <span className='tabular-nums'>{n}</span>
                </div>
                <div className='mt-1 h-1.5 overflow-hidden rounded-full bg-muted'>
                  <div className='h-full bg-chart-1' style={{ width: `${(n / Math.max(1, active.length)) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
