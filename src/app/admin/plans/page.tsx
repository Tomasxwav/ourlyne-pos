import type { Metadata } from 'next'
import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { plans } from '@/db/schema'
import { PageHeader } from '@/components/app/page-header'
import { PlanEditor } from './plan-editor'

export const metadata: Metadata = { title: 'Planes' }

export default async function AdminPlans() {
  const rows = await db.query.plans.findMany({ orderBy: [asc(plans.sortOrder)] })
  return (
    <>
      <PageHeader
        eyebrow='Plataforma'
        title='Planes'
        description='Precios, módulos incluidos y límites. Los cambios se reflejan en la landing y en facturación.'
      />
      <div className='grid gap-4 xl:grid-cols-3'>
        {rows.map((p) => (
          <PlanEditor key={p.id} plan={p} />
        ))}
      </div>
    </>
  )
}
