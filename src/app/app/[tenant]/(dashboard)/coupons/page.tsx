import type { Metadata } from 'next'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { and, desc, eq, ilike, isNotNull, ne, or, sql } from 'drizzle-orm'
import { BadgePercent, CalendarClock, ShoppingBag, TicketPercent } from 'lucide-react'
import { db } from '@/db'
import { coupons, orders } from '@/db/schema'
import { EmptyState } from '@/components/app/empty-state'
import { FilterSelect, SearchInput } from '@/components/app/list-controls'
import { PageHeader } from '@/components/app/page-header'
import { StatTile } from '@/components/app/stat-tile'
import { StatusBadge, type Tone } from '@/components/app/status-badge'
import { formatMoney, formatNumber, formatPercent } from '@/lib/money'
import { str } from '@/lib/params'
import { cn } from '@/lib/utils'
import { requireModule, requirePermission } from '@/server/tenant'
import { CouponDialog } from './coupon-dialog'
import { CopyCodeButton, CouponToggle, DeleteCouponButton } from './coupon-controls'
import { dayIn } from './dates'

export const metadata: Metadata = { title: 'Cupones' }

type CouponStatus = 'active' | 'expired' | 'exhausted' | 'inactive'

const STATUS_UI: Record<CouponStatus, { label: string; tone: Tone }> = {
  active: { label: 'Activo', tone: 'success' },
  expired: { label: 'Expirado', tone: 'warning' },
  exhausted: { label: 'Agotado', tone: 'danger' },
  inactive: { label: 'Inactivo', tone: 'neutral' },
}

const notExpired = sql`(${coupons.expiresAt} is null or ${coupons.expiresAt} > now())`
const notExhausted = sql`(${coupons.usageLimit} is null or ${coupons.usedCount} < ${coupons.usageLimit})`

const STATUS_WHERE: Record<CouponStatus, ReturnType<typeof and>> = {
  active: and(eq(coupons.isActive, true), notExpired, notExhausted),
  expired: and(eq(coupons.isActive, true), sql`${coupons.expiresAt} <= now()`),
  exhausted: and(eq(coupons.isActive, true), notExpired, sql`not ${notExhausted}`),
  inactive: eq(coupons.isActive, false),
}

function currencySymbol(currency: string) {
  try {
    return (
      new Intl.NumberFormat('es-MX', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value ?? '$'
    )
  } catch {
    return '$'
  }
}

export default async function CouponsPage(props: PageProps<'/app/[tenant]/coupons'>) {
  const { tenant: slug } = await props.params
  const sp = await props.searchParams
  await requireModule(slug, 'coupons')
  const ctx = await requirePermission(slug, 'coupons.manage')
  const q = str(sp.q)
  const status = str(sp.status) as CouponStatus | undefined
  const now = new Date()
  const tz = ctx.tenant.timezone

  const [rows, [stats], [discount]] = await Promise.all([
    db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.tenantId, ctx.tenant.id),
          q ? or(ilike(coupons.code, `%${q}%`), ilike(coupons.description, `%${q}%`)) : undefined,
          status && STATUS_WHERE[status] ? STATUS_WHERE[status] : undefined,
        ),
      )
      .orderBy(desc(coupons.isActive), desc(coupons.createdAt)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${STATUS_WHERE.active})::int`,
        uses: sql<number>`coalesce(sum(${coupons.usedCount}), 0)::int`,
      })
      .from(coupons)
      .where(eq(coupons.tenantId, ctx.tenant.id)),
    db
      .select({
        amount: sql<number>`coalesce(sum(${orders.discountTotal}), 0)::bigint`,
        orders: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(and(eq(orders.tenantId, ctx.tenant.id), isNotNull(orders.couponId), ne(orders.status, 'voided'))),
  ])

  const money = (v: number) => formatMoney(v, ctx.tenant.currency)
  const symbol = currencySymbol(ctx.tenant.currency)
  const today = dayIn(now, tz)
  const filtered = Boolean(q || status)
  const newButton = <CouponDialog slug={slug} currencySymbol={symbol} today={today} />

  return (
    <>
      <PageHeader
        title='Cupones'
        description='Códigos de descuento por porcentaje o monto fijo, con vigencia y límite de usos.'
        actions={newButton}
      />

      <div className='grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4'>
        <StatTile
          label='Cupones activos'
          icon={<TicketPercent />}
          value={formatNumber(stats.active)}
          hint={`de ${formatNumber(stats.total)} creados`}
        />
        <StatTile label='Usos totales' icon={<ShoppingBag />} value={formatNumber(stats.uses)} hint='canjes en ventas' />
        <StatTile
          label='Descuento otorgado'
          icon={<BadgePercent />}
          value={money(Number(discount.amount))}
          hint={`en ${formatNumber(discount.orders)} ${discount.orders === 1 ? 'venta' : 'ventas'}`}
          className='col-span-2 lg:col-span-1'
        />
      </div>

      <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
        <SearchInput placeholder='Código o descripción' />
        <FilterSelect
          param='status'
          allLabel='Todos los estados'
          options={(Object.keys(STATUS_UI) as CouponStatus[]).map((k) => ({ value: k, label: STATUS_UI[k].label }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<TicketPercent />}
          title={filtered ? 'Sin resultados' : 'Aún no tienes cupones'}
          description={
            filtered ? 'Prueba con otros filtros.' : 'Crea códigos de descuento para promociones, clientes frecuentes o temporadas.'
          }
          action={!filtered && newButton}
        />
      ) : (
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
          {rows.map((c) => {
            const expired = !!c.expiresAt && c.expiresAt <= now
            const exhausted = c.usageLimit !== null && c.usedCount >= c.usageLimit
            const st: CouponStatus = !c.isActive ? 'inactive' : expired ? 'expired' : exhausted ? 'exhausted' : 'active'
            const ui = STATUS_UI[st]
            const usage = c.usageLimit ? Math.min(100, (c.usedCount / c.usageLimit) * 100) : 0
            return (
              <article
                key={c.id}
                className={cn(
                  'group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-gold/50',
                  st !== 'active' && 'bg-card/60',
                )}
              >
                <div className='flex items-start justify-between gap-3 p-4 pb-3'>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-1'>
                      <span className='truncate font-mono text-sm font-semibold tracking-wider'>{c.code}</span>
                      <CopyCodeButton code={c.code} />
                    </div>
                    <p className='mt-0.5 line-clamp-2 text-xs text-muted-foreground'>{c.description ?? 'Sin descripción'}</p>
                  </div>
                  <p
                    className={cn(
                      'shrink-0 font-heading text-2xl leading-none font-semibold tabular-nums',
                      st === 'active' ? 'text-gold-deep dark:text-gold' : 'text-muted-foreground',
                    )}
                  >
                    {c.type === 'percent' ? formatPercent(c.value) : money(c.value)}
                  </p>
                </div>

                <div
                  aria-hidden
                  className='relative mx-4 border-t border-dashed before:absolute before:top-1/2 before:-left-6 before:size-4 before:-translate-y-1/2 before:rounded-full before:border before:bg-background after:absolute after:top-1/2 after:-right-6 after:size-4 after:-translate-y-1/2 after:rounded-full after:border after:bg-background'
                />

                <dl className='grid grid-cols-2 gap-x-4 gap-y-2 p-4 pt-3 text-xs'>
                  <div>
                    <dt className='text-muted-foreground'>Compra mínima</dt>
                    <dd className='tabular-nums'>{c.minTotal ? money(c.minTotal) : 'Sin mínimo'}</dd>
                  </div>
                  <div>
                    <dt className='flex items-center gap-1 text-muted-foreground'>
                      <CalendarClock className='size-3' /> Vigencia
                    </dt>
                    <dd className={cn(expired && 'text-[color-mix(in_oklch,var(--warning),black_35%)] dark:text-warning')}>
                      {c.expiresAt ? `${expired ? 'Venció' : 'Hasta'} ${format(parseISO(dayIn(c.expiresAt, tz)), 'd MMM yyyy', { locale: es })}` : 'Sin vencimiento'}
                    </dd>
                  </div>
                  <div className='col-span-2'>
                    <dt className='flex justify-between text-muted-foreground'>
                      <span>Usos</span>
                      <span className='text-foreground tabular-nums'>
                        {formatNumber(c.usedCount)} / {c.usageLimit ? formatNumber(c.usageLimit) : '∞'}
                      </span>
                    </dt>
                    <dd className='mt-1.5'>
                      <div
                        className='h-1.5 overflow-hidden rounded-full bg-muted'
                        role='meter'
                        aria-label={`Usos de ${c.code}`}
                        aria-valuemin={0}
                        aria-valuemax={c.usageLimit ?? undefined}
                        aria-valuenow={c.usedCount}
                      >
                        {c.usageLimit ? (
                          <div
                            className={cn('h-full rounded-full', exhausted ? 'bg-destructive' : 'bg-gold')}
                            style={{ width: `${usage}%` }}
                          />
                        ) : (
                          <div className='h-full w-full bg-[repeating-linear-gradient(90deg,var(--gold)_0_6px,transparent_6px_10px)] opacity-40' />
                        )}
                      </div>
                    </dd>
                  </div>
                </dl>

                <div className='mt-auto flex items-center gap-2 border-t px-4 py-2'>
                  <StatusBadge tone={ui.tone}>{ui.label}</StatusBadge>
                  <span className='flex-1' />
                  <CouponToggle slug={slug} id={c.id} code={c.code} isActive={c.isActive} />
                  <CouponDialog
                    slug={slug}
                    currencySymbol={symbol}
                    today={today}
                    coupon={{
                      id: c.id,
                      code: c.code,
                      description: c.description,
                      type: c.type,
                      value: c.value,
                      minTotal: c.minTotal,
                      usageLimit: c.usageLimit,
                      usedCount: c.usedCount,
                      expiresDay: c.expiresAt ? dayIn(c.expiresAt, tz) : null,
                      isActive: c.isActive,
                    }}
                  />
                  <DeleteCouponButton slug={slug} id={c.id} code={c.code} used={c.usedCount} />
                </div>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
