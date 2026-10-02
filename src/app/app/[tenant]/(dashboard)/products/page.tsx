import type { Metadata } from 'next'
import Link from 'next/link'
import { and, asc, count, eq, ilike, or, sql } from 'drizzle-orm'
import { Package, Plus } from 'lucide-react'
import { db } from '@/db'
import { categories, products, stockLevels } from '@/db/schema'
import { EmptyState } from '@/components/app/empty-state'
import { FilterSelect, Pagination, SearchInput } from '@/components/app/list-controls'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney, formatQty } from '@/lib/money'
import { PAGE_SIZE, parsePage, str } from '@/lib/params'
import { requirePermission } from '@/server/tenant'
import { ProductRowActions } from './row-actions'

export const metadata: Metadata = { title: 'Productos' }

export default async function ProductsPage(props: PageProps<'/app/[tenant]/products'>) {
  const { tenant: slug } = await props.params
  const sp = await props.searchParams
  const ctx = await requirePermission(slug, 'products.view')
  const q = str(sp.q)
  const categoryId = str(sp.category)
  const status = str(sp.status)
  const page = parsePage(sp.page)
  const branchId = ctx.branch?.id ?? ''

  const where = and(
    eq(products.tenantId, ctx.tenant.id),
    q
      ? or(ilike(products.name, `%${q}%`), ilike(products.sku, `%${q}%`), ilike(products.barcode, `%${q}%`))
      : undefined,
    categoryId ? eq(products.categoryId, categoryId) : undefined,
    status === 'inactive' ? eq(products.isActive, false) : status === 'active' ? eq(products.isActive, true) : undefined,
    status === 'low'
      ? and(eq(products.trackStock, true), sql`coalesce(${stockLevels.quantity}, 0) <= ${products.lowStockThreshold}`)
      : undefined,
  )

  const [rows, [{ total }], categoryRows] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        price: products.price,
        cost: products.cost,
        unit: products.unit,
        type: products.type,
        trackStock: products.trackStock,
        isActive: products.isActive,
        lowStockThreshold: products.lowStockThreshold,
        imageUrl: products.imageUrl,
        category: categories.name,
        color: categories.color,
        stock: stockLevels.quantity,
      })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(stockLevels, and(eq(stockLevels.productId, products.id), eq(stockLevels.branchId, branchId)))
      .where(where)
      .orderBy(asc(products.name))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(products)
      .leftJoin(stockLevels, and(eq(stockLevels.productId, products.id), eq(stockLevels.branchId, branchId)))
      .where(where),
    db.query.categories.findMany({ where: eq(categories.tenantId, ctx.tenant.id), orderBy: [asc(categories.sortOrder)] }),
  ])

  const canManage = ctx.can('products.manage')
  const money = (v: number) => formatMoney(v, ctx.tenant.currency)
  const filtered = Boolean(q || categoryId || status)

  return (
    <>
      <PageHeader
        title='Productos'
        description={`Catálogo y precios · existencias de ${ctx.branch?.name ?? 'la sucursal'}`}
        actions={
          canManage && (
            <Link href={`/app/${slug}/products/new`} className={buttonVariants({ size: 'lg' })}>
              <Plus /> Nuevo producto
            </Link>
          )
        }
      />

      <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
        <SearchInput placeholder='Nombre, SKU o código de barras' />
        <FilterSelect
          param='category'
          allLabel='Todas las categorías'
          options={categoryRows.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          param='status'
          allLabel='Todos los estados'
          options={[
            { value: 'active', label: 'Activos' },
            { value: 'inactive', label: 'Inactivos' },
            { value: 'low', label: 'Stock bajo' },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title={filtered ? 'Sin resultados' : 'Aún no tienes productos'}
          description={
            filtered ? 'Prueba con otros filtros.' : 'Da de alta tu catálogo para empezar a vender en el punto de venta.'
          }
          action={
            !filtered &&
            canManage && (
              <Link href={`/app/${slug}/products/new`} className={buttonVariants({ size: 'lg' })}>
                <Plus /> Crear el primero
              </Link>
            )
          }
        />
      ) : (
        <div className='overflow-hidden rounded-xl border bg-card'>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead>Producto</TableHead>
                <TableHead className='hidden md:table-cell'>Categoría</TableHead>
                <TableHead className='text-right'>Precio</TableHead>
                <TableHead className='hidden text-right lg:table-cell'>Costo</TableHead>
                <TableHead className='hidden text-right lg:table-cell'>Margen</TableHead>
                <TableHead className='text-right'>Existencia</TableHead>
                <TableHead className='hidden sm:table-cell'>Estado</TableHead>
                <TableHead className='w-10' />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const stock = Number(p.stock ?? 0)
                const low = p.trackStock && stock <= p.lowStockThreshold
                const margin = p.price ? Math.round(((p.price - p.cost) / p.price) * 100) : 0
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/app/${slug}/products/${p.id}`} className='flex items-center gap-3'>
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
                        <span className='min-w-0'>
                          <span className='block truncate font-medium hover:underline'>{p.name}</span>
                          <span className='block font-mono text-[0.65rem] text-muted-foreground'>
                            {p.sku ?? 'Sin SKU'}
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className='hidden text-muted-foreground md:table-cell'>{p.category ?? '—'}</TableCell>
                    <TableCell className='text-right font-medium tabular-nums'>{money(p.price)}</TableCell>
                    <TableCell className='hidden text-right text-muted-foreground tabular-nums lg:table-cell'>
                      {money(p.cost)}
                    </TableCell>
                    <TableCell className='hidden text-right tabular-nums lg:table-cell'>{margin}%</TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {!p.trackStock ? (
                        <span className='text-muted-foreground'>{p.type === 'service' ? 'Servicio' : 'No controla'}</span>
                      ) : (
                        <span className={low ? 'font-semibold text-destructive' : ''}>{formatQty(stock, p.unit)}</span>
                      )}
                    </TableCell>
                    <TableCell className='hidden sm:table-cell'>
                      {p.isActive ? (
                        low ? (
                          <StatusBadge tone='warning'>Stock bajo</StatusBadge>
                        ) : (
                          <StatusBadge tone='success'>Activo</StatusBadge>
                        )
                      ) : (
                        <StatusBadge>Inactivo</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell>
                      {canManage && <ProductRowActions slug={slug} id={p.id} name={p.name} />}
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
