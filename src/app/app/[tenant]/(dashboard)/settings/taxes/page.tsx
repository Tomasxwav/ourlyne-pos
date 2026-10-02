import type { Metadata } from 'next'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { taxes } from '@/db/schema'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requirePermission } from '@/server/tenant'
import { TaxDialog, TaxRow } from '../settings-forms'

export const metadata: Metadata = { title: 'Impuestos' }

export default async function TaxesPage(props: PageProps<'/app/[tenant]/settings/taxes'>) {
  const { tenant: slug } = await props.params
  const ctx = await requirePermission(slug, 'settings.manage')
  const rows = await db.query.taxes.findMany({
    where: eq(taxes.tenantId, ctx.tenant.id),
    orderBy: [asc(taxes.rateBps)],
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Impuestos</CardTitle>
        <CardDescription>
          El predeterminado se asigna a productos nuevos.{' '}
          {ctx.tenant.pricesIncludeTax ? 'Tus precios incluyen impuestos.' : 'Los impuestos se suman al precio.'}
        </CardDescription>
        <CardAction>
          <TaxDialog slug={slug} />
        </CardAction>
      </CardHeader>
      <CardContent className='divide-y px-0'>
        {rows.map((t) => (
          <TaxRow key={t.id} slug={slug} tax={t} />
        ))}
        {rows.length === 0 && <p className='px-4 py-6 text-center text-xs text-muted-foreground'>Sin impuestos.</p>}
      </CardContent>
    </Card>
  )
}
