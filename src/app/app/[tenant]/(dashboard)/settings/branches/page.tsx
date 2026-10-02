import type { Metadata } from 'next'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { branches } from '@/db/schema'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { limitLabel } from '@/lib/plans'
import { requirePermission } from '@/server/tenant'
import { BranchDialog, BranchRow } from '../settings-forms'

export const metadata: Metadata = { title: 'Sucursales' }

export default async function BranchesPage(props: PageProps<'/app/[tenant]/settings/branches'>) {
  const { tenant: slug } = await props.params
  const ctx = await requirePermission(slug, 'settings.manage')
  const rows = await db.query.branches.findMany({
    where: eq(branches.tenantId, ctx.tenant.id),
    orderBy: [asc(branches.createdAt)],
  })
  const active = rows.filter((r) => r.isActive).length
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Sucursales</CardTitle>
        <CardDescription>
          {active} de {limitLabel(ctx.plan?.limits.branches ?? -1)} sucursales activas en tu plan.
        </CardDescription>
        <CardAction>
          <BranchDialog slug={slug} />
        </CardAction>
      </CardHeader>
      <CardContent className='divide-y px-0'>
        {rows.map((b) => (
          <BranchRow key={b.id} slug={slug} branch={b} />
        ))}
      </CardContent>
    </Card>
  )
}
