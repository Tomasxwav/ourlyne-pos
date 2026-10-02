import { tz } from '@date-fns/tz'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { auditLogs, purchases } from '@/db/schema'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { folio, formatMoney, formatQty } from '@/lib/money'
import { requireModule, requirePermission } from '@/server/tenant'
import { PURCHASE_PAYMENT_UI, PURCHASE_STATUS_UI } from '../labels'
import { PurchaseActions } from './purchase-actions'

export const metadata: Metadata = { title: 'Detalle de compra' }

const ACTION_LABEL: Record<string, string> = {
  create: 'Creada',
  update: 'Editada',
  order: 'Marcada como ordenada',
  receive: 'Mercancía recibida',
  payment: 'Pago registrado',
  cancel: 'Cancelada',
}

export default async function PurchaseDetailPage(props: PageProps<'/app/[tenant]/purchases/[id]'>) {
  const { tenant: slug, id } = await props.params
  await requireModule(slug, 'purchases')
  const ctx = await requirePermission(slug, 'purchases.view')
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const purchase = await db.query.purchases.findFirst({
    where: and(eq(purchases.id, id), eq(purchases.tenantId, ctx.tenant.id)),
    with: {
      items: { with: { product: { columns: { id: true, sku: true, unit: true, trackStock: true, cost: true } } } },
      supplier: true,
      branch: true,
      createdBy: { columns: { name: true } },
    },
  })
  if (!purchase) notFound()

  const history = await db.query.auditLogs.findMany({
    where: and(eq(auditLogs.tenantId, ctx.tenant.id), eq(auditLogs.entity, 'purchase'), eq(auditLogs.entityId, id)),
    with: { user: { columns: { name: true } } },
    orderBy: [desc(auditLogs.createdAt)],
    limit: 20,
  })

  const money = (v: number) => formatMoney(v, ctx.tenant.currency)
  const st = PURCHASE_STATUS_UI[purchase.status]
  const pay = PURCHASE_PAYMENT_UI[purchase.paymentStatus]
  const pending = purchase.total - purchase.paidTotal
  const paidPct = purchase.total ? Math.min(100, Math.round((purchase.paidTotal / purchase.total) * 100)) : 0
  const canManage = ctx.can('purchases.manage')
  const stockLines = purchase.items.filter((i) => i.product?.trackStock).length
  const units = purchase.items.reduce((a, i) => a + i.quantity, 0)

  return (
    <>
      <PageHeader
        eyebrow={format(purchase.createdAt, "EEEE d 'de' MMMM yyyy", { locale: es, in: tz(ctx.tenant.timezone) })}
        title={
          <>
            Compra <span className='whitespace-nowrap'>{folio('OC', purchase.number)}</span>
          </>
        }
        description={
          <span className='mt-1 flex flex-wrap gap-1.5'>
            <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
            {purchase.status !== 'cancelled' && purchase.status !== 'draft' && (
              <StatusBadge tone={pay.tone}>Pago: {pay.label}</StatusBadge>
            )}
          </span>
        }
        actions={
          canManage && (
            <PurchaseActions
              slug={slug}
              id={purchase.id}
              status={purchase.status}
              pending={pending}
              branchName={purchase.branch.name}
              stockLines={stockLines}
              currency={ctx.tenant.currency}
            />
          )
        }
      />

      <div className='grid gap-4 xl:grid-cols-[1fr_22rem]'>
        <Card className='content-start'>
          <CardHeader>
            <CardTitle className='text-base'>Artículos</CardTitle>
          </CardHeader>
          <CardContent className='px-0'>
            <Table>
              <TableHeader>
                <TableRow className='hover:bg-transparent'>
                  <TableHead className='pl-4'>Producto</TableHead>
                  <TableHead className='text-right'>Cant.</TableHead>
                  <TableHead className='hidden text-right sm:table-cell'>Costo unit.</TableHead>
                  <TableHead className='pr-4 text-right'>Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchase.items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className='max-w-64 pl-4'>
                      <p className='truncate font-medium'>{i.name}</p>
                      <p className='font-mono text-[0.65rem] text-muted-foreground'>
                        {i.product?.sku ?? (i.product ? 'Sin SKU' : 'Producto eliminado')}
                        {i.product && !i.product.trackStock && ' · no controla existencias'}
                      </p>
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>{formatQty(i.quantity, i.product?.unit)}</TableCell>
                    <TableCell className='hidden text-right tabular-nums sm:table-cell'>
                      {money(i.unitCost)}
                      {purchase.status !== 'received' && i.product && i.product.cost !== i.unitCost && (
                        <span className='block text-[0.65rem] text-muted-foreground'>actual {money(i.product.cost)}</span>
                      )}
                    </TableCell>
                    <TableCell className='pr-4 text-right font-medium tabular-nums'>{money(i.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <dl className='mt-2 ml-auto grid max-w-xs gap-1 px-4 text-xs'>
              <Row label={`${purchase.items.length} ${purchase.items.length === 1 ? 'renglón' : 'renglones'} · ${formatQty(Math.round(units * 1000) / 1000)} unidades`} value='' />
              <Row label='Subtotal' value={money(purchase.subtotal)} />
              {purchase.taxTotal > 0 && <Row label='Impuestos' value={money(purchase.taxTotal)} />}
              <div className='flex items-baseline justify-between border-t pt-2'>
                <dt className='font-medium'>Total</dt>
                <dd className='font-heading text-2xl font-semibold tabular-nums'>{money(purchase.total)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className='grid content-start gap-4'>
          {purchase.status !== 'draft' && purchase.status !== 'cancelled' && (
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Pago</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3 text-xs'>
                <div
                  role='progressbar'
                  aria-label='Porcentaje pagado'
                  aria-valuenow={paidPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className='h-1.5 overflow-hidden rounded-full bg-muted'
                >
                  <div className='h-full rounded-full bg-gold transition-all' style={{ width: `${paidPct}%` }} />
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <p className='text-muted-foreground'>Pagado</p>
                    <p className='font-heading text-lg font-semibold tabular-nums'>{money(purchase.paidTotal)}</p>
                  </div>
                  <div>
                    <p className='text-muted-foreground'>Pendiente</p>
                    <p className={`font-heading text-lg font-semibold tabular-nums ${pending > 0 ? 'text-destructive' : ''}`}>
                      {money(pending)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className='space-y-2.5 text-xs'>
              <Info label='Proveedor'>
                {purchase.supplier ? (
                  <Link href={`/app/${slug}/purchases?supplier=${purchase.supplier.id}`} className='font-medium hover:underline'>
                    {purchase.supplier.name}
                  </Link>
                ) : (
                  'Sin proveedor'
                )}
              </Info>
              {purchase.supplier?.contactName && <Info label='Contacto'>{purchase.supplier.contactName}</Info>}
              {purchase.supplier?.phone && <Info label='Teléfono'>{purchase.supplier.phone}</Info>}
              {purchase.supplier?.taxId && <Info label='RFC'>{purchase.supplier.taxId}</Info>}
              <Info label='Sucursal'>{purchase.branch.name}</Info>
              <Info label='Creada por'>{purchase.createdBy?.name ?? '—'}</Info>
              {purchase.expectedAt && (
                <Info label='Fecha esperada'>{format(purchase.expectedAt, 'd MMM yyyy', { locale: es, in: tz(ctx.tenant.timezone) })}</Info>
              )}
              {purchase.receivedAt && (
                <Info label='Recibida'>{format(purchase.receivedAt, "d MMM yyyy, HH:mm", { locale: es, in: tz(ctx.tenant.timezone) })}</Info>
              )}
              {purchase.notes && <Info label='Notas'>{purchase.notes}</Info>}
            </CardContent>
          </Card>
          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Historial</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className='space-y-3 border-l pl-4 text-xs'>
                  {history.map((h) => (
                    <li key={h.id} className='relative'>
                      <span aria-hidden className='absolute top-1 -left-[1.3rem] size-2 rounded-full bg-gold' />
                      <p className='font-medium'>{ACTION_LABEL[h.action] ?? h.action}</p>
                      {h.action === 'payment' && h.summary && <p className='text-muted-foreground'>{h.summary}</p>}
                      <p className='text-[0.65rem] text-muted-foreground'>
                        {format(h.createdAt, "d MMM yyyy, HH:mm", { locale: es, in: tz(ctx.tenant.timezone) })} · {h.user?.name ?? '—'}
                      </p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex justify-between text-muted-foreground'>
      <dt>{label}</dt>
      <dd className='tabular-nums'>{value}</dd>
    </div>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex justify-between gap-4'>
      <span className='shrink-0 text-muted-foreground'>{label}</span>
      <span className='text-right'>{children}</span>
    </div>
  )
}
