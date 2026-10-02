import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { format } from 'date-fns'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { purchases, suppliers } from '@/db/schema'
import { PageHeader } from '@/components/app/page-header'
import { folio } from '@/lib/money'
import { requireModule, requirePermission } from '@/server/tenant'
import { PurchaseForm } from '../../purchase-form'

export const metadata: Metadata = { title: 'Editar compra' }

export default async function EditPurchasePage(props: PageProps<'/app/[tenant]/purchases/[id]/edit'>) {
  const { tenant: slug, id } = await props.params
  await requireModule(slug, 'purchases')
  const ctx = await requirePermission(slug, 'purchases.manage')
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const [purchase, supplierRows] = await Promise.all([
    db.query.purchases.findFirst({
      where: and(eq(purchases.id, id), eq(purchases.tenantId, ctx.tenant.id)),
      with: { items: { with: { product: { columns: { sku: true, unit: true } } } } },
    }),
    db.query.suppliers.findMany({
      where: eq(suppliers.tenantId, ctx.tenant.id),
      orderBy: [asc(suppliers.name)],
      columns: { id: true, name: true },
    }),
  ])
  if (!purchase) notFound()
  if (purchase.status !== 'draft' && purchase.status !== 'ordered') redirect(`/app/${slug}/purchases/${id}`)

  const branchOptions = ctx.branches.map((b) => ({ id: b.id, name: b.name }))

  return (
    <>
      <PageHeader eyebrow='Compras' title={`Editar ${folio('OC', purchase.number)}`} />
      <PurchaseForm
        slug={slug}
        suppliers={supplierRows}
        branches={branchOptions}
        defaultBranch={purchase.branchId}
        currency={ctx.tenant.currency}
        canCreateSupplier
        purchase={{
          id: purchase.id,
          status: purchase.status,
          supplierId: purchase.supplierId,
          branchId: purchase.branchId,
          expectedAt: purchase.expectedAt ? format(purchase.expectedAt, 'yyyy-MM-dd') : '',
          notes: purchase.notes,
          paidTotal: purchase.paidTotal,
          items: purchase.items
            .filter((i) => i.productId)
            .map((i) => ({
              productId: i.productId!,
              name: i.name,
              sku: i.product?.sku ?? null,
              unit: i.product?.unit ?? 'pz',
              quantity: i.quantity,
              unitCost: i.unitCost,
            })),
        }}
      />
    </>
  )
}
