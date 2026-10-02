import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, ArrowRight, Banknote, Coins, Receipt, Users } from 'lucide-react'
import { PageHeader } from '@/components/app/page-header'
import { StatTile } from '@/components/app/stat-tile'
import { ORDER_STATUS_UI, StatusBadge } from '@/components/app/status-badge'
import { HourHeatmap, PaymentsChart, SalesChart } from '@/components/dashboard/charts'
import { RangeFilter } from '@/components/dashboard/range-filter'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { folio, formatMoney, formatNumber, formatQty } from '@/lib/money'
import { getDashboard, getLowStock, type DashboardRange } from '@/server/queries/dashboard'
import { requirePermission } from '@/server/tenant'

export default async function DashboardPage(props: PageProps<'/app/[tenant]'>) {
  const { tenant: slug } = await props.params
  const sp = await props.searchParams
  const ctx = await requirePermission(slug, 'dashboard.view')

  const range = ([7, 30, 90].includes(Number(sp.range)) ? Number(sp.range) : 30) as DashboardRange
  const multiBranch = ctx.branches.length > 1
  const scope = sp.scope === 'branch' || !multiBranch ? 'branch' : 'all'
  const branchId = scope === 'branch' ? ctx.branch?.id : undefined
  const currency = ctx.tenant.currency

  const [data, lowStock] = await Promise.all([
    getDashboard({ tenantId: ctx.tenant.id, branchId, timezone: ctx.tenant.timezone }, range),
    ctx.hasModule('inventory') ? getLowStock(ctx.tenant.id, ctx.branch?.id) : Promise.resolve([]),
  ])
  const money = (v: number) => formatMoney(v, currency)
  const maxTop = Math.max(1, ...data.topProducts.map((p) => p.revenue))
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <>
      {sp.welcome && (
        <div className='rounded-xl border border-gold/40 bg-linear-to-r from-gold/15 to-transparent p-4 text-sm'>
          <p className='font-medium'>¡Tu negocio está listo! 🎉</p>
          <p className='mt-1 text-muted-foreground'>
            Empieza dando de alta tus productos y abre el punto de venta para tu primera venta.
          </p>
          <div className='mt-3 flex gap-3 text-xs font-medium'>
            <Link href={`/app/${slug}/products/new`} className='text-gold-deep underline underline-offset-4'>
              Crear producto
            </Link>
            <Link href={`/app/${slug}/settings`} className='underline underline-offset-4'>
              Configurar negocio
            </Link>
          </div>
        </div>
      )}

      <PageHeader
        eyebrow={scope === 'all' ? 'Todas las sucursales' : ctx.branch?.name}
        title={`${greeting}, ${ctx.user.name.split(' ')[0]}`}
        description={`Resumen de los últimos ${range} días comparado con el periodo anterior.`}
        actions={<RangeFilter range={range} scope={scope} showScope={multiBranch} />}
      />

      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4'>
        <StatTile
          label='Ventas netas'
          icon={<Banknote />}
          value={money(data.current.revenue)}
          current={data.current.revenue}
          previous={data.previous.revenue}
          hint='vs. periodo anterior'
        />
        <StatTile
          label='Tickets'
          icon={<Receipt />}
          value={formatNumber(data.current.orders)}
          current={data.current.orders}
          previous={data.previous.orders}
          hint='ventas cobradas'
        />
        <StatTile
          label='Ticket promedio'
          icon={<Coins />}
          value={money(data.current.avgTicket)}
          current={data.current.avgTicket}
          previous={data.previous.avgTicket}
        />
        <StatTile
          label='Utilidad bruta'
          icon={<Users />}
          value={money(data.current.profit)}
          current={data.current.profit}
          previous={data.previous.profit}
          hint={
            data.current.revenue
              ? `margen ${Math.round((data.current.profit / data.current.revenue) * 100)}%`
              : undefined
          }
        />
      </div>

      <div className='grid gap-4 xl:grid-cols-3'>
        <Card className='xl:col-span-2'>
          <CardHeader>
            <CardTitle className='text-base'>Ventas por día</CardTitle>
            <CardDescription>Ventas netas (después de devoluciones), con IVA.</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesChart data={data.daily} currency={currency} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Métodos de pago</CardTitle>
            <CardDescription>Importe cobrado por método.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.payments.length ? (
              <PaymentsChart data={data.payments} currency={currency} />
            ) : (
              <p className='py-16 text-center text-xs text-muted-foreground'>Sin cobros en el periodo.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-4 xl:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Productos más vendidos</CardTitle>
            <CardDescription>Por importe en el periodo.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {data.topProducts.length === 0 && (
              <p className='py-8 text-center text-xs text-muted-foreground'>Aún no hay ventas.</p>
            )}
            {data.topProducts.map((p, i) => (
              <div key={p.productId ?? p.name} className='space-y-1.5'>
                <div className='flex items-baseline justify-between gap-3 text-xs'>
                  <span className='flex min-w-0 items-baseline gap-2'>
                    <span className='font-mono text-muted-foreground tabular-nums'>{String(i + 1).padStart(2, '0')}</span>
                    <span className='truncate font-medium'>{p.name}</span>
                  </span>
                  <span className='shrink-0 tabular-nums'>
                    {money(p.revenue)} <span className='text-muted-foreground'>· {formatQty(p.quantity)} u</span>
                  </span>
                </div>
                <div className='h-1.5 overflow-hidden rounded-full bg-muted'>
                  <div className='h-full rounded-full bg-chart-1' style={{ width: `${(p.revenue / maxTop) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className='xl:col-span-2'>
          <CardHeader>
            <CardTitle className='text-base'>Horas pico</CardTitle>
            <CardDescription>Número de ventas por día de la semana y hora.</CardDescription>
          </CardHeader>
          <CardContent>
            <HourHeatmap data={data.heatmap} />
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-4 xl:grid-cols-3'>
        <Card className='xl:col-span-2'>
          <CardHeader>
            <CardTitle className='text-base'>Ventas recientes</CardTitle>
            {ctx.can('orders.view') && (
              <CardAction>
                <Link
                  href={`/app/${slug}/orders`}
                  className='inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground'
                >
                  Ver todas <ArrowRight className='size-3' />
                </Link>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className='px-0'>
            <ul className='divide-y'>
              {data.recent.map((o) => {
                const st = ORDER_STATUS_UI[o.status]
                return (
                  <li key={o.id}>
                    <Link
                      href={`/app/${slug}/orders/${o.id}`}
                      className='flex items-center gap-4 px-4 py-2.5 text-xs transition-colors hover:bg-muted/50'
                    >
                      <span className='w-24 font-mono font-medium'>{folio('V', o.number)}</span>
                      <span className='min-w-0 flex-1 truncate text-muted-foreground'>
                        {o.customer ?? 'Público en general'} · {o.cashier ?? '—'}
                      </span>
                      <span className='hidden text-muted-foreground sm:inline'>
                        {formatDistanceToNow(o.createdAt, { locale: es, addSuffix: true })}
                      </span>
                      <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                      <span className='w-24 text-right font-medium tabular-nums'>{money(o.total)}</span>
                    </Link>
                  </li>
                )
              })}
              {data.recent.length === 0 && (
                <li className='px-4 py-10 text-center text-xs text-muted-foreground'>Aún no hay ventas.</li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <AlertTriangle className='size-4 text-warning' /> Stock bajo
            </CardTitle>
            <CardDescription>{ctx.branch?.name}</CardDescription>
            {ctx.hasModule('inventory') && (
              <CardAction>
                <Link
                  href={`/app/${slug}/inventory?filter=low`}
                  className='inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground'
                >
                  Inventario <ArrowRight className='size-3' />
                </Link>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {!ctx.hasModule('inventory') ? (
              <p className='py-8 text-center text-xs text-muted-foreground'>
                Activa el módulo de inventario para ver alertas.
              </p>
            ) : lowStock.length === 0 ? (
              <p className='py-8 text-center text-xs text-muted-foreground'>Todo en orden. Sin alertas. ✨</p>
            ) : (
              <ul className='space-y-2.5'>
                {lowStock.map((p) => (
                  <li key={`${p.productId}-${p.branchId}`} className='flex items-center justify-between gap-3 text-xs'>
                    <span className='truncate'>{p.name}</span>
                    <StatusBadge tone={p.quantity <= 0 ? 'danger' : 'warning'}>
                      {formatQty(p.quantity, p.unit)} / mín. {formatQty(p.threshold)}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
