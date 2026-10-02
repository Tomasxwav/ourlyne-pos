import { tz } from '@date-fns/tz'
import type { Metadata } from 'next'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { and, count, desc, eq, gte, ilike, lte, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { History, X } from 'lucide-react'
import { db } from '@/db'
import { branches, orders, products, purchases, refunds, STOCK_MOVEMENT_TYPES, stockMovements, user } from '@/db/schema'
import { EmptyState } from '@/components/app/empty-state'
import { DateRangeFilter, FilterSelect, Pagination, SearchInput } from '@/components/app/list-controls'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { folio, formatMoney, formatQty } from '@/lib/money'
import { PAGE_SIZE, parseDate, parsePage, str } from '@/lib/params'
import { cn } from '@/lib/utils'
import { requireModule, requirePermission } from '@/server/tenant'
import { InventoryTabs } from '../inventory-tabs'
import { MOVEMENT_TYPE_UI } from '../labels'

export const metadata: Metadata = { title: 'Movimientos de inventario' }

const UUID = /^[0-9a-f-]{36}$/i

export default async function MovementsPage(props: PageProps<'/app/[tenant]/inventory/movements'>) {
  const { tenant: slug } = await props.params
  const sp = await props.searchParams
  await requireModule(slug, 'inventory')
  const ctx = await requirePermission(slug, 'inventory.view')
  const q = str(sp.q)
  const type = str(sp.type)
  const productParam = str(sp.product)
  const productId = productParam && UUID.test(productParam) ? productParam : undefined
  const branchParam = str(sp.branch)
  const from = parseDate(sp.from)
  const to = parseDate(sp.to, true)
  const page = parsePage(sp.page)

  const allBranches = branchParam === 'all'
  const branchId = allBranches
    ? undefined
    : (ctx.branches.find((b) => b.id === branchParam)?.id ?? ctx.branch?.id)
  const showBranch = ctx.branches.length > 1 && allBranches

  const validType = STOCK_MOVEMENT_TYPES.find((t) => t === type)
  const where = and(
    eq(stockMovements.tenantId, ctx.tenant.id),
    branchId ? eq(stockMovements.branchId, branchId) : undefined,
    validType ? eq(stockMovements.type, validType) : undefined,
    productId ? eq(stockMovements.productId, productId) : undefined,
    q ? or(ilike(products.name, `%${q}%`), ilike(products.sku, `%${q}%`)) : undefined,
    from ? gte(stockMovements.createdAt, from) : undefined,
    to ? lte(stockMovements.createdAt, to) : undefined,
  )

  const refundOrder = alias(orders, 'refund_order')

  const [rows, [{ total }], product] = await Promise.all([
    db
      .select({
        id: stockMovements.id,
        createdAt: stockMovements.createdAt,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        balanceAfter: stockMovements.balanceAfter,
        unitCost: stockMovements.unitCost,
        referenceType: stockMovements.referenceType,
        referenceId: stockMovements.referenceId,
        note: stockMovements.note,
        productId: products.id,
        productName: products.name,
        sku: products.sku,
        unit: products.unit,
        userName: user.name,
        branchName: branches.name,
        orderNumber: orders.number,
        purchaseNumber: purchases.number,
        refundOrderId: refunds.orderId,
        refundOrderNumber: refundOrder.number,
      })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .leftJoin(user, eq(user.id, stockMovements.userId))
      .leftJoin(branches, eq(branches.id, stockMovements.branchId))
      .leftJoin(
        orders,
        and(
          or(eq(stockMovements.referenceType, 'order'), eq(stockMovements.referenceType, 'void')),
          eq(orders.id, stockMovements.referenceId),
        ),
      )
      .leftJoin(
        purchases,
        and(eq(stockMovements.referenceType, 'purchase'), eq(purchases.id, stockMovements.referenceId)),
      )
      .leftJoin(refunds, and(eq(stockMovements.referenceType, 'refund'), eq(refunds.id, stockMovements.referenceId)))
      .leftJoin(refundOrder, eq(refundOrder.id, refunds.orderId))
      .where(where)
      .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .where(where),
    productId
      ? db.query.products.findFirst({
          where: and(eq(products.id, productId), eq(products.tenantId, ctx.tenant.id)),
          columns: { id: true, name: true },
        })
      : Promise.resolve(undefined),
  ])

  const money = (v: number) => formatMoney(v, ctx.tenant.currency)
  const canOrders = ctx.can('orders.view')
  const canPurchases = ctx.can('purchases.view')
  const branchName = allBranches ? 'Todas las sucursales' : (ctx.branches.find((b) => b.id === branchId)?.name ?? '')
  const filtered = Boolean(q || type || productId || from || to)

  const clearProductHref = (() => {
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) if (typeof v === 'string' && k !== 'product' && k !== 'page') next.set(k, v)
    const qs = next.toString()
    return `/app/${slug}/inventory/movements${qs ? `?${qs}` : ''}`
  })()

  return (
    <>
      <PageHeader
        eyebrow={branchName}
        title='Movimientos'
        description='Kardex: cada entrada y salida de inventario con su saldo resultante.'
      />

      <InventoryTabs slug={slug} transfers={ctx.branches.length > 1} />

      <div className='flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center'>
        <SearchInput placeholder='Producto o SKU' />
        <FilterSelect
          param='type'
          allLabel='Todos los tipos'
          options={STOCK_MOVEMENT_TYPES.map((t) => ({ value: t, label: MOVEMENT_TYPE_UI[t].label }))}
        />
        {ctx.branches.length > 1 && (
          <FilterSelect
            param='branch'
            allLabel={`${ctx.branch?.name ?? 'Sucursal'} (activa)`}
            options={[
              ...ctx.branches.filter((b) => b.id !== ctx.branch?.id).map((b) => ({ value: b.id, label: b.name })),
              { value: 'all', label: 'Todas las sucursales' },
            ]}
          />
        )}
        <DateRangeFilter />
      </div>

      {product && (
        <div className='flex items-center gap-2 text-xs'>
          <span className='text-muted-foreground'>Producto:</span>
          <span className='inline-flex items-center gap-1 rounded-full bg-gold/10 py-0.5 pr-1 pl-2.5 font-medium text-gold-deep ring-1 ring-gold/30 ring-inset dark:text-gold'>
            {product.name}
            <Link
              href={clearProductHref}
              aria-label='Quitar filtro de producto'
              className={buttonVariants({ variant: 'ghost', size: 'icon-xs', className: 'rounded-full' })}
            >
              <X />
            </Link>
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<History />}
          title='Sin movimientos'
          description={filtered ? 'No hay movimientos con estos filtros.' : 'Aquí verás ventas, compras, ajustes y traspasos.'}
        />
      ) : (
        <div className='overflow-hidden rounded-xl border bg-card'>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                {showBranch && <TableHead className='hidden lg:table-cell'>Sucursal</TableHead>}
                <TableHead className='hidden sm:table-cell'>Tipo</TableHead>
                <TableHead className='text-right'>Cantidad</TableHead>
                <TableHead className='hidden text-right sm:table-cell'>Saldo</TableHead>
                <TableHead className='hidden text-right xl:table-cell'>Costo unit.</TableHead>
                <TableHead className='hidden lg:table-cell'>Usuario</TableHead>
                <TableHead className='hidden md:table-cell'>Nota / referencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => {
                const ui = MOVEMENT_TYPE_UI[m.type]
                const ref = reference(m, slug, { canOrders, canPurchases })
                return (
                  <TableRow key={m.id}>
                    <TableCell className='whitespace-nowrap text-muted-foreground'>
                      {format(m.createdAt, 'd MMM yyyy', { locale: es, in: tz(ctx.tenant.timezone) })}
                      <span className='block text-[0.65rem]'>{format(m.createdAt, 'HH:mm')}</span>
                    </TableCell>
                    <TableCell className='max-w-48'>
                      <Link
                        href={`/app/${slug}/inventory/movements?product=${m.productId}`}
                        className='block truncate font-medium hover:underline'
                      >
                        {m.productName}
                      </Link>
                      <span className='block font-mono text-[0.65rem] text-muted-foreground'>{m.sku ?? 'Sin SKU'}</span>
                      <span className='mt-0.5 block sm:hidden'>
                        <StatusBadge tone={ui.tone}>{ui.label}</StatusBadge>
                      </span>
                    </TableCell>
                    {showBranch && <TableCell className='hidden text-muted-foreground lg:table-cell'>{m.branchName}</TableCell>}
                    <TableCell className='hidden sm:table-cell'>
                      <StatusBadge tone={ui.tone}>{ui.label}</StatusBadge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-semibold tabular-nums',
                        m.quantity > 0 ? 'text-success' : 'text-destructive',
                      )}
                    >
                      {m.quantity > 0 ? '+' : '−'}
                      {formatQty(Math.abs(m.quantity), m.unit)}
                    </TableCell>
                    <TableCell className='hidden text-right tabular-nums sm:table-cell'>{formatQty(m.balanceAfter)}</TableCell>
                    <TableCell className='hidden text-right text-muted-foreground tabular-nums xl:table-cell'>
                      {m.unitCost !== null ? money(m.unitCost) : '—'}
                    </TableCell>
                    <TableCell className='hidden text-muted-foreground lg:table-cell'>{m.userName ?? '—'}</TableCell>
                    <TableCell className='hidden max-w-64 min-w-44 whitespace-normal md:table-cell'>
                      {ref &&
                        (ref.href ? (
                          <Link href={ref.href} className='font-mono text-[0.7rem] font-medium text-gold-deep hover:underline dark:text-gold'>
                            {ref.label}
                          </Link>
                        ) : (
                          <span className='font-mono text-[0.7rem]'>{ref.label}</span>
                        ))}
                      {m.note && <p className='line-clamp-2 text-muted-foreground'>{m.note}</p>}
                      {!ref && !m.note && <span className='text-muted-foreground'>—</span>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <div className='border-t px-4 py-2.5'>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} searchParams={sp} />
          </div>
        </div>
      )}
    </>
  )
}

function reference(
  m: {
    referenceType: string | null
    referenceId: string | null
    orderNumber: number | null
    purchaseNumber: number | null
    refundOrderId: string | null
    refundOrderNumber: number | null
  },
  slug: string,
  can: { canOrders: boolean; canPurchases: boolean },
): { label: string; href?: string } | null {
  if (!m.referenceType || !m.referenceId) return null
  switch (m.referenceType) {
    case 'order':
    case 'void':
      return m.orderNumber !== null
        ? {
            label: `${m.referenceType === 'void' ? 'Cancelación ' : ''}${folio('V', m.orderNumber)}`,
            href: can.canOrders ? `/app/${slug}/orders/${m.referenceId}` : undefined,
          }
        : null
    case 'refund':
      return m.refundOrderId && m.refundOrderNumber !== null
        ? {
            label: `Devolución ${folio('V', m.refundOrderNumber)}`,
            href: can.canOrders ? `/app/${slug}/orders/${m.refundOrderId}` : undefined,
          }
        : null
    case 'purchase':
      return m.purchaseNumber !== null
        ? {
            label: folio('OC', m.purchaseNumber),
            href: can.canPurchases ? `/app/${slug}/purchases/${m.referenceId}` : undefined,
          }
        : null
    case 'transfer':
      return { label: `Traspaso ${m.referenceId.slice(0, 8).toUpperCase()}`, href: `/app/${slug}/inventory/transfers` }
    default:
      return null
  }
}
