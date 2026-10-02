import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { categories, products, stockMovements, taxes } from '@/db/schema'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatQty } from '@/lib/money'
import { requirePermission } from '@/server/tenant'
import { ProductForm } from '../product-form'

export const metadata: Metadata = { title: 'Editar producto' }

const MOVEMENT_LABEL: Record<string, string> = {
  initial: 'Inicial',
  sale: 'Venta',
  refund: 'Devolución',
  purchase: 'Compra',
  adjustment: 'Ajuste',
  transfer_in: 'Traspaso entrada',
  transfer_out: 'Traspaso salida',
  waste: 'Merma',
}

export default async function EditProductPage(props: PageProps<'/app/[tenant]/products/[id]'>) {
  const { tenant: slug, id } = await props.params
  const ctx = await requirePermission(slug, 'products.view')
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const product = await db.query.products.findFirst({
    where: and(eq(products.id, id), eq(products.tenantId, ctx.tenant.id)),
    with: { stock: { with: { branch: true } } },
  })
  if (!product) notFound()

  const [categoryRows, taxRows, movements] = await Promise.all([
    db.query.categories.findMany({ where: eq(categories.tenantId, ctx.tenant.id), orderBy: [asc(categories.sortOrder)] }),
    db.query.taxes.findMany({ where: eq(taxes.tenantId, ctx.tenant.id) }),
    db.query.stockMovements.findMany({
      where: and(eq(stockMovements.productId, id), eq(stockMovements.tenantId, ctx.tenant.id)),
      orderBy: [desc(stockMovements.createdAt)],
      limit: 8,
      with: { branch: true },
    }),
  ])

  const { stock, ...values } = product

  return (
    <>
      <PageHeader eyebrow='Catálogo' title={product.name} description={product.sku ?? undefined} />
      {ctx.can('products.manage') ? (
        <ProductForm
          slug={slug}
          product={values}
          categories={categoryRows}
          taxes={taxRows}
          currency={ctx.tenant.currency}
        />
      ) : null}

      {product.trackStock && (
        <div className='grid gap-4 lg:grid-cols-[1fr_20rem]'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Últimos movimientos</CardTitle>
            </CardHeader>
            <CardContent className='px-0'>
              <ul className='divide-y text-xs'>
                {movements.map((m) => (
                  <li key={m.id} className='flex items-center gap-3 px-4 py-2'>
                    <span className='w-28 text-muted-foreground'>
                      {format(m.createdAt, "d MMM yy, HH:mm", { locale: es })}
                    </span>
                    <span className='flex-1'>
                      {MOVEMENT_LABEL[m.type]} · <span className='text-muted-foreground'>{m.branch.name}</span>
                    </span>
                    <span className={`tabular-nums ${m.quantity < 0 ? 'text-destructive' : 'text-success'}`}>
                      {m.quantity > 0 ? '+' : ''}
                      {formatQty(m.quantity)}
                    </span>
                    <span className='w-14 text-right text-muted-foreground tabular-nums'>{formatQty(m.balanceAfter)}</span>
                  </li>
                ))}
                {movements.length === 0 && (
                  <li className='px-4 py-6 text-center text-muted-foreground'>Sin movimientos.</li>
                )}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Existencias por sucursal</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2 text-xs'>
              {ctx.branches.map((b) => {
                const level = stock.find((s) => s.branchId === b.id)
                return (
                  <div key={b.id} className='flex items-center justify-between'>
                    <span>{b.name}</span>
                    <span className='font-medium tabular-nums'>{formatQty(Number(level?.quantity ?? 0), product.unit)}</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
