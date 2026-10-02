import type { Metadata } from 'next'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { suppliers } from '@/db/schema'
import { PageHeader } from '@/components/app/page-header'
import { requireModule, requirePermission } from '@/server/tenant'
import { PurchaseForm } from '../purchase-form'

export const metadata: Metadata = { title: 'Nueva compra' }

export default async function NewPurchasePage(props: PageProps<'/app/[tenant]/purchases/new'>) {
  const { tenant: slug } = await props.params
  const sp = await props.searchParams
  await requireModule(slug, 'purchases')
  const ctx = await requirePermission(slug, 'purchases.manage')
  const supplierRows = await db.query.suppliers.findMany({
    where: eq(suppliers.tenantId, ctx.tenant.id),
    orderBy: [asc(suppliers.name)],
    columns: { id: true, name: true },
  })
  const preset = typeof sp.supplier === 'string' && supplierRows.some((s) => s.id === sp.supplier) ? sp.supplier : null

  return (
    <>
      <PageHeader eyebrow='Compras' title='Nueva orden de compra' description='Registra lo que vas a pedir; al recibirla se sumará al inventario.' />
      <PurchaseForm
        slug={slug}
        suppliers={supplierRows}
        branches={ctx.branches.map((b) => ({ id: b.id, name: b.name }))}
        defaultBranch={ctx.branch?.id ?? ctx.branches[0]?.id ?? ''}
        currency={ctx.tenant.currency}
        defaultSupplier={preset}
        canCreateSupplier
      />
    </>
  )
}
