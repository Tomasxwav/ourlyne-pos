import type { Metadata } from 'next'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { paymentMethods } from '@/db/schema'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requirePermission } from '@/server/tenant'
import { MethodDialog, MethodRow } from '../settings-forms'

export const metadata: Metadata = { title: 'Métodos de pago' }

export default async function PaymentsPage(props: PageProps<'/app/[tenant]/settings/payments'>) {
  const { tenant: slug } = await props.params
  const ctx = await requirePermission(slug, 'settings.manage')
  const rows = await db.query.paymentMethods.findMany({
    where: eq(paymentMethods.tenantId, ctx.tenant.id),
    orderBy: [asc(paymentMethods.sortOrder)],
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Métodos de pago</CardTitle>
        <CardDescription>Los métodos activos aparecen al cobrar en el punto de venta.</CardDescription>
        <CardAction>
          <MethodDialog slug={slug} />
        </CardAction>
      </CardHeader>
      <CardContent className='divide-y px-0'>
        {rows.map((m) => (
          <MethodRow key={m.id} slug={slug} method={m} />
        ))}
      </CardContent>
    </Card>
  )
}
