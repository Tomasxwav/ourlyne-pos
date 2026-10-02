import type { Metadata } from 'next'
import { asc, count, eq } from 'drizzle-orm'
import { Tags } from 'lucide-react'
import { db } from '@/db'
import { categories, products } from '@/db/schema'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { requirePermission } from '@/server/tenant'
import { CategoryCard, CategoryDialog } from './category-dialog'

export const metadata: Metadata = { title: 'Categorías' }

export default async function CategoriesPage(props: PageProps<'/app/[tenant]/categories'>) {
  const { tenant: slug } = await props.params
  const ctx = await requirePermission(slug, 'products.manage')

  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
      sortOrder: categories.sortOrder,
      products: count(products.id),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .where(eq(categories.tenantId, ctx.tenant.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name))

  return (
    <>
      <PageHeader
        title='Categorías'
        description='Agrupa tus productos; el color identifica cada categoría en el punto de venta.'
        actions={<CategoryDialog slug={slug} />}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Tags />} title='Sin categorías' description='Crea categorías para organizar tu catálogo.' />
      ) : (
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'>
          {rows.map((c) => (
            <CategoryCard key={c.id} slug={slug} category={c} />
          ))}
        </div>
      )}
    </>
  )
}
