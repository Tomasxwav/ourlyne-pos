import type { Metadata } from 'next'
import Link from 'next/link'
import { and, asc, count, eq, ilike, or, sql } from 'drizzle-orm'
import { ArrowLeftRight, Boxes, History } from 'lucide-react'
import { db } from '@/db'
import { categories, products, stockLevels } from '@/db/schema'
import { EmptyState } from '@/components/app/empty-state'
import { FilterSelect, Pagination, SearchInput } from '@/components/app/list-controls'
import { PageHeader } from '@/components/app/page-header'
import { StatTile } from '@/components/app/stat-tile'
import { StatusBadge } from '@/components/app/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney, formatNumber, formatQty } from '@/lib/money'
import { PAGE_SIZE, parsePage, str } from '@/lib/params'
import { getInventorySummary } from '@/server/queries/inventory'
import { requireModule, requirePermission } from '@/server/tenant'
import { AdjustDialog } from './adjust-dialog'
import { InventoryTabs } from './inventory-tabs'
import { STOCK_STATUS_UI, stockStatus } from './labels'

export const metadata: Metadata = { title: 'Inventario' }

export default async function InventoryPage(props: PageProps<'/app/[tenant]/inventory'>) {
  const { tenant: slug } = await props.params
  const sp = await props.searchParams
  await requireModule(slug, 'inventory')
  const ctx = await requirePermission(slug, 'inventory.view')
  const q = str(sp.q)
  const categoryId = str(sp.category)
  const filter = str(sp.filter)
  const page = parsePage(sp.page)
  const branch = ctx.branch

  if (!branch) {
    return (
      <>
        <PageHeader title='Inventario' />
        <EmptyState icon={<Boxes />} title='Sin sucursal activa' description='Da de alta una sucursal para controlar existencias.' />
      </>
    )
  }

  const qty = sql`coalesce(${stockLevels.quantity}, 0)`
  const where = and(
    eq(products.tenantId, ctx.tenant.id),
    eq(products.trackStock, true),
    eq(products.isActive, true),
    q ? or(ilike(products.name, `%${q}%`), ilike(products.sku, `%${q}%`), eq(products.barcode, q)) : undefined,
    categoryId ? eq(products.categoryId, categoryId) : undefined,
    filter === 'low' ? sql`${qty} <= ${products.lowStockThreshold}` : undefined,
    filter === 'out' ? sql`${qty} <= 0` : undefined,
    filter === 'ok' ? sql`${qty} > ${products.lowStockThreshold}` : undefined,
  )
  const stockJoin = and(eq(stockLevels.productId, products.id), eq(stockLevels.branchId, branch.id))

  const [rows, [{ total }], categoryRows, summary] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        unit: products.unit,
        cost: products.cost,
        lowStockThreshold: products.lowStockThreshold,
        imageUrl: products.imageUrl,
        category: categories.name,
        color: categories.color,
        stock: stockLevels.quantity,
      })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(stockLevels, stockJoin)
      .where(where)
      .orderBy(
        filter === 'low' || filter === 'out'
          ? sql`${qty} - ${products.lowStockThreshold}`
          : asc(products.name),
        asc(products.name),
      )
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(products).leftJoin(stockLevels, stockJoin).where(where),
    db.query.categories.findMany({ where: eq(categories.tenantId, ctx.tenant.id), orderBy: [asc(categories.sortOrder)] }),
    getInventorySummary(ctx.tenant.id, branch.id),
  ])

  const canAdjust = ctx.can('inventory.adjust')
  const canSeeProducts = ctx.can('products.view')
  const multiBranch = ctx.branches.length > 1
  const money = (v: number) => formatMoney(v, ctx.tenant.currency)
  const filtered = Boolean(q || categoryId || filter)
  const base = `/app/${slug}/inventory`

  return (
    <>
      <PageHeader
        eyebrow={branch.name}
        title='Inventario'
        description='Existencias, valor del inventario y alertas de reabastecimiento.'
        actions={
          <>
            <Link href={`${base}/movements`} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              <History /> Movimientos
            </Link>
            {multiBranch && canAdjust && (
              <Link href={`${base}/transfers`} className={buttonVariants({ size: 'lg' })}>
                <ArrowLeftRight /> Traspaso
              </Link>
            )}
          </>
        }
      />

      <InventoryTabs slug={slug} transfers={multiBranch} />

      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <StatTile label='Valor del inventario' value={money(summary.value)} hint='a costo' />
        <StatTile
          label='Unidades'
          value={formatNumber(summary.units, 'es-MX', 2)}
          hint={`${formatNumber(summary.products)} productos`}
        />
        <Link href={`${base}?filter=low`} className='rounded-xl focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none'>
          <StatTile
            label='Stock bajo'
            value={formatNumber(summary.low)}
            hint={summary.low ? 'Incluye agotados · ver lista' : 'Todo en orden'}
            className={summary.low ? 'border-warning/40' : undefined}
          />
        </Link>
        <Link href={`${base}?filter=out`} className='rounded-xl focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none'>
          <StatTile
            label='Agotados'
            value={formatNumber(summary.out)}
            hint={summary.out ? 'Ver lista' : 'Sin faltantes'}
            className={summary.out ? 'border-destructive/40' : undefined}
          />
        </Link>
      </div>

      <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
        <SearchInput placeholder='Nombre, SKU o código de barras' />
        <FilterSelect
          param='category'
          allLabel='Todas las categorías'
          options={categoryRows.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          param='filter'
          allLabel='Todas las existencias'
          options={[
            { value: 'low', label: 'Stock bajo' },
            { value: 'out', label: 'Agotados' },
            { value: 'ok', label: 'Existencia OK' },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Boxes />}
          title={filtered ? 'Sin resultados' : 'Sin productos con inventario'}
          description={
            filtered
              ? filter === 'low' || filter === 'out'
                ? 'Ningún producto cumple esta alerta. ¡Buen trabajo!'
                : 'Prueba con otros filtros.'
              : 'Activa «Controlar existencias» en tus productos para verlos aquí.'
          }
        />
      ) : (
        <div className='overflow-hidden rounded-xl border bg-card'>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead>Producto</TableHead>
                <TableHead className='hidden md:table-cell'>Categoría</TableHead>
                <TableHead className='text-right'>Existencia</TableHead>
                <TableHead className='hidden text-right lg:table-cell'>Mínimo</TableHead>
                <TableHead className='hidden text-right lg:table-cell'>Costo</TableHead>
                <TableHead className='hidden text-right sm:table-cell'>Valor</TableHead>
                <TableHead className='hidden sm:table-cell'>Estado</TableHead>
                <TableHead className='w-10' />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const stock = Number(p.stock ?? 0)
                const status = stockStatus(stock, p.lowStockThreshold)
                const ui = STOCK_STATUS_UI[status]
                const name = (
                  <span className='min-w-0'>
                    <span className='block truncate font-medium'>{p.name}</span>
                    <span className='block font-mono text-[0.65rem] text-muted-foreground'>{p.sku ?? 'Sin SKU'}</span>
                  </span>
                )
                return (
                  <TableRow key={p.id}>
                    <TableCell className='max-w-56'>
                      <div className='flex items-center gap-3'>
                        <span
                          className='flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-[0.65rem] font-semibold text-white'
                          style={{ background: p.color ?? 'var(--velvet)' }}
                        >
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imageUrl} alt='' className='size-full object-cover' />
                          ) : (
                            p.name.slice(0, 2).toUpperCase()
                          )}
                        </span>
                        {canSeeProducts ? (
                          <Link href={`/app/${slug}/products/${p.id}`} className='min-w-0 hover:underline'>
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='hidden text-muted-foreground md:table-cell'>{p.category ?? '—'}</TableCell>
                    <TableCell className='text-right tabular-nums'>
                      <Link
                        href={`${base}/movements?product=${p.id}`}
                        className={`hover:underline ${status === 'ok' ? 'font-medium' : 'font-semibold text-destructive'}`}
                        title='Ver movimientos'
                      >
                        {formatQty(stock, p.unit)}
                      </Link>
                      <span className='block sm:hidden'>
                        <StatusBadge tone={ui.tone}>{ui.label}</StatusBadge>
                      </span>
                    </TableCell>
                    <TableCell className='hidden text-right text-muted-foreground tabular-nums lg:table-cell'>
                      {formatQty(p.lowStockThreshold)}
                    </TableCell>
                    <TableCell className='hidden text-right text-muted-foreground tabular-nums lg:table-cell'>
                      {money(p.cost)}
                    </TableCell>
                    <TableCell className='hidden text-right font-medium tabular-nums sm:table-cell'>
                      {money(Math.round(Math.max(0, stock) * p.cost))}
                    </TableCell>
                    <TableCell className='hidden sm:table-cell'>
                      <StatusBadge tone={ui.tone}>{ui.label}</StatusBadge>
                    </TableCell>
                    <TableCell className='text-right'>
                      {canAdjust && (
                        <AdjustDialog
                          slug={slug}
                          product={{ id: p.id, name: p.name, unit: p.unit, stock }}
                          branchName={branch.name}
                          allowNegative={ctx.tenant.allowNegativeStock}
                        />
                      )}
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
