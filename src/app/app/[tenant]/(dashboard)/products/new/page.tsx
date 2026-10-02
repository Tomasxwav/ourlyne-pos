import type { Metadata } from 'next'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { categories, taxes } from '@/db/schema'
import { PageHeader } from '@/components/app/page-header'
import { requirePermission } from '@/server/tenant'
import { ProductForm } from '../product-form'

export const metadata: Metadata = { title: 'Nuevo producto' }

export default async function NewProductPage(props: PageProps<'/app/[tenant]/products/new'>) {
  const { tenant: slug } = await props.params
  const ctx = await requirePermission(slug, 'products.manage')
  const [categoryRows, taxRows] = await Promise.all([
    db.query.categories.findMany({ where: eq(categories.tenantId, ctx.tenant.id), orderBy: [asc(categories.sortOrder)] }),
    db.query.taxes.findMany({ where: eq(taxes.tenantId, ctx.tenant.id) }),
  ])

  return (
    <>
      <PageHeader eyebrow='Catálogo' title='Nuevo producto' />
      <ProductForm
        slug={slug}
        categories={categoryRows}
        taxes={taxRows}
        currency={ctx.tenant.currency}
        branchName={ctx.branch?.name}
      />
    </>
  )
}
