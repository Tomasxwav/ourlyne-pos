import type { Metadata } from 'next'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { and, count, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import { ReceiptText, ShoppingCart } from 'lucide-react'
import { db } from '@/db'
import { branches, customers, orders, user } from '@/db/schema'
import { EmptyState } from '@/components/app/empty-state'
import { DateRangeFilter, FilterSelect, Pagination, SearchInput } from '@/components/app/list-controls'
import { PageHeader } from '@/components/app/page-header'
import { StatTile } from '@/components/app/stat-tile'
import { ORDER_STATUS_UI, PAYMENT_STATUS_UI, StatusBadge } from '@/components/app/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { folio, formatMoney, formatNumber } from '@/lib/money'
import { PAGE_SIZE, parseDate, parsePage, str } from '@/lib/params'
import { requirePermission } from '@/server/tenant'

export const metadata: Metadata = { title: 'Ventas' }

export default async function OrdersPage(props: PageProps<'/app/[tenant]/orders'>) {
  const { tenant: slug } = await props.params
  const sp = await props.searchParams
  const ctx = await requirePermission(slug, 'orders.view')
  const q = str(sp.q)
  const status = str(sp.status)
  const branch = str(sp.branch)
  const from = parseDate(sp.from)
  const to = parseDate(sp.to, true)
  const page = parsePage(sp.page)
  const qNumber = q && /^\D*0*(\d+)$/.exec(q)?.[1]

  const where = and(
    eq(orders.tenantId, ctx.tenant.id),
    status ? eq(orders.status, status as (typeof orders.status.enumValues)[number]) : undefined,
    branch ? eq(orders.branchId, branch) : undefined,
    from ? gte(orders.createdAt, from) : undefined,
    to ? lte(orders.createdAt, to) : undefined,
    q
      ? or(
          qNumber ? eq(orders.number, Number(qNumber)) : undefined,
          ilike(customers.name, `%${q}%`),
        )
      : undefined,
  )

  const [rows, [summary]] = await Promise.all([
    db
      .select({
        id: orders.id,
        number: orders.number,
        createdAt: orders.createdAt,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        total: orders.total,
        refundedTotal: orders.refundedTotal,
        customer: customers.name,
        cashier: user.name,
        branch: branches.name,
        items: sql<number>`(select count(*)::int from order_items oi where oi.order_id = ${orders.id})`,
      })
      .from(orders)
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .leftJoin(user, eq(user.id, orders.cashierId))
      .leftJoin(branches, eq(branches.id, orders.branchId))
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({
        total: count(),
        revenue: sql<number>`coalesce(sum(case when ${orders.status} <> 'voided' then ${orders.total} - ${orders.refundedTotal} else 0 end), 0)::bigint`,
        refunded: sql<number>`coalesce(sum(${orders.refundedTotal}), 0)::bigint`,
      })
      .from(orders)
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .where(where),
  ])

  const money = (v: number) => formatMoney(Number(v), ctx.tenant.currency)
  const revenue = Number(summary.revenue)

  return (
    <>
      <PageHeader
        title='Ventas'
        description='Historial de tickets, devoluciones y cancelaciones.'
        actions={
          ctx.can('pos.sell') && (
            <Link href={`/app/${slug}/pos`} className={buttonVariants({ size: 'lg' })}>
              <ShoppingCart /> Nueva venta
            </Link>
          )
        }
      />

      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <StatTile label='Tickets' value={formatNumber(summary.total)} />
        <StatTile label='Ventas netas' value={money(revenue)} />
        <StatTile label='Ticket promedio' value={money(summary.total ? Math.round(revenue / summary.total) : 0)} />
        <StatTile label='Devoluciones' value={money(Number(summary.refunded))} />
      </div>

      <div className='flex flex-col gap-2 lg:flex-row lg:items-center'>
        <SearchInput placeholder='Folio o cliente' />
        <FilterSelect
          param='status'
          allLabel='Todos los estados'
          options={Object.entries(ORDER_STATUS_UI).map(([value, s]) => ({ value, label: s.label }))}
        />
        {ctx.branches.length > 1 && (
          <FilterSelect
            param='branch'
            allLabel='Todas las sucursales'
            options={ctx.branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        )}
        <DateRangeFilter />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<ReceiptText />} title='Sin ventas' description='No hay ventas con estos filtros.' />
      ) : (
        <div className='overflow-hidden rounded-xl border bg-card'>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead>Folio</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className='hidden md:table-cell'>Cliente</TableHead>
                <TableHead className='hidden lg:table-cell'>Cajero</TableHead>
                {ctx.branches.length > 1 && <TableHead className='hidden xl:table-cell'>Sucursal</TableHead>}
                <TableHead className='hidden text-right sm:table-cell'>Artículos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className='text-right'>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => {
                const st = ORDER_STATUS_UI[o.status]
                const pay = PAYMENT_STATUS_UI[o.paymentStatus]
                return (
                  <TableRow key={o.id} className='cursor-pointer'>
                    <TableCell>
                      <Link href={`/app/${slug}/orders/${o.id}`} className='font-mono font-medium hover:underline'>
                        {folio('V', o.number)}
                      </Link>
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      {format(o.createdAt, "d MMM yyyy, HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell className='hidden md:table-cell'>{o.customer ?? <span className='text-muted-foreground'>Público en general</span>}</TableCell>
                    <TableCell className='hidden text-muted-foreground lg:table-cell'>{o.cashier ?? '—'}</TableCell>
                    {ctx.branches.length > 1 && (
                      <TableCell className='hidden text-muted-foreground xl:table-cell'>{o.branch}</TableCell>
                    )}
                    <TableCell className='hidden text-right tabular-nums sm:table-cell'>{o.items}</TableCell>
                    <TableCell>
                      <div className='flex flex-wrap gap-1'>
                        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                        {o.paymentStatus !== 'paid' && o.status !== 'voided' && (
                          <StatusBadge tone={pay.tone}>{pay.label}</StatusBadge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='text-right font-medium tabular-nums'>
                      <span className={o.status === 'voided' ? 'text-muted-foreground line-through' : ''}>
                        {money(o.total)}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <div className='border-t px-4 py-2.5'>
            <Pagination page={page} pageSize={PAGE_SIZE} total={summary.total} searchParams={sp} />
          </div>
        </div>
      )}
    </>
  )
}
