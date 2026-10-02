import { tz } from '@date-fns/tz'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { orders, refunds } from '@/db/schema'
import { PageHeader } from '@/components/app/page-header'
import { ORDER_STATUS_UI, PAYMENT_STATUS_UI, StatusBadge } from '@/components/app/status-badge'
import { Receipt } from '@/components/pos/receipt'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { folio, formatMoney, formatQty } from '@/lib/money'
import { requirePermission } from '@/server/tenant'
import { OrderActions } from './order-actions'

export const metadata: Metadata = { title: 'Detalle de venta' }

const TYPE_LABEL: Record<string, string> = { takeaway: 'Para llevar', dine_in: 'Comer aquí', delivery: 'A domicilio' }
const METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  credit: 'Crédito',
  other: 'Otro',
}

export default async function OrderDetailPage(props: PageProps<'/app/[tenant]/orders/[id]'>) {
  const { tenant: slug, id } = await props.params
  const ctx = await requirePermission(slug, 'orders.view')
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, id), eq(orders.tenantId, ctx.tenant.id)),
    with: {
      items: true,
      payments: true,
      customer: true,
      cashier: { columns: { name: true } },
      branch: true,
      coupon: true,
      registerSession: { with: { register: true } },
      refunds: { orderBy: [desc(refunds.createdAt)], with: { user: { columns: { name: true } } } },
    },
  })
  if (!order) notFound()

  const money = (v: number) => formatMoney(v, ctx.tenant.currency)
  const st = ORDER_STATUS_UI[order.status]
  const pay = PAYMENT_STATUS_UI[order.paymentStatus]
  const canRefund = ctx.can('orders.refund') && (order.status === 'completed' || order.status === 'partially_refunded')

  return (
    <>
      <PageHeader
        eyebrow={format(order.createdAt, "EEEE d 'de' MMMM yyyy, HH:mm", { locale: es, in: tz(ctx.tenant.timezone) })}
        title={
          <span className='flex items-center gap-3'>
            Venta {folio('V', order.number)}
          </span>
        }
        description={
          <span className='mt-1 flex flex-wrap gap-1.5'>
            <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
            <StatusBadge tone={pay.tone}>{pay.label}</StatusBadge>
          </span>
        }
        actions={
          <OrderActions
            slug={slug}
            orderId={order.id}
            canRefund={canRefund}
            canVoid={ctx.can('orders.refund') && order.status === 'completed'}
            hasCustomer={!!order.customerId}
            currency={ctx.tenant.currency}
            items={order.items.map((i) => ({
              id: i.id,
              name: i.name,
              available: i.quantity - i.refundedQuantity,
              unitTotal: Math.round(i.total / i.quantity),
            }))}
          />
        }
      />

      <div className='grid gap-4 xl:grid-cols-[1fr_22rem]'>
        <div className='grid content-start gap-4'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Artículos</CardTitle>
            </CardHeader>
            <CardContent className='px-0'>
              <Table>
                <TableHeader>
                  <TableRow className='hover:bg-transparent'>
                    <TableHead className='pl-4'>Producto</TableHead>
                    <TableHead className='text-right'>Cant.</TableHead>
                    <TableHead className='hidden text-right sm:table-cell'>Precio</TableHead>
                    <TableHead className='hidden text-right sm:table-cell'>Desc.</TableHead>
                    <TableHead className='hidden text-right md:table-cell'>IVA</TableHead>
                    <TableHead className='pr-4 text-right'>Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className='pl-4'>
                        <p className='font-medium'>{i.name}</p>
                        <p className='font-mono text-[0.65rem] text-muted-foreground'>{i.sku}</p>
                        {i.refundedQuantity > 0 && (
                          <p className='text-[0.65rem] text-destructive'>Devuelto: {formatQty(i.refundedQuantity)}</p>
                        )}
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>{formatQty(i.quantity)}</TableCell>
                      <TableCell className='hidden text-right tabular-nums sm:table-cell'>{money(i.unitPrice)}</TableCell>
                      <TableCell className='hidden text-right text-success tabular-nums sm:table-cell'>
                        {i.discount ? `−${money(i.discount)}` : '—'}
                      </TableCell>
                      <TableCell className='hidden text-right text-muted-foreground tabular-nums md:table-cell'>
                        {money(i.taxAmount)}
                      </TableCell>
                      <TableCell className='pr-4 text-right font-medium tabular-nums'>{money(i.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <dl className='mt-2 ml-auto grid max-w-xs gap-1 px-4 text-xs'>
                <Row label='Subtotal' value={money(order.subtotal)} />
                {order.discountTotal > 0 && (
                  <Row label={order.coupon ? `Descuento (${order.coupon.code})` : 'Descuento'} value={`−${money(order.discountTotal)}`} />
                )}
                <Row label={ctx.tenant.pricesIncludeTax ? 'IVA incluido' : 'Impuestos'} value={money(order.taxTotal)} />
                <div className='flex items-baseline justify-between border-t pt-2'>
                  <dt className='font-medium'>Total</dt>
                  <dd className='font-heading text-2xl font-semibold tabular-nums'>{money(order.total)}</dd>
                </div>
                {order.refundedTotal > 0 && <Row label='Devuelto' value={`−${money(order.refundedTotal)}`} danger />}
              </dl>
            </CardContent>
          </Card>

          <div className='grid gap-4 md:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Pagos</CardTitle>
              </CardHeader>
              <CardContent className='space-y-2 text-xs'>
                {order.payments.map((p) => (
                  <div key={p.id} className='flex justify-between'>
                    <span>
                      {p.methodName}
                      {p.reference && <span className='text-muted-foreground'> · {p.reference}</span>}
                    </span>
                    <span className='tabular-nums'>{money(p.amount)}</span>
                  </div>
                ))}
                {order.changeDue > 0 && (
                  <div className='flex justify-between text-muted-foreground'>
                    <span>Recibido {money(order.paidTotal)} · Cambio</span>
                    <span className='tabular-nums'>{money(order.changeDue)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Devoluciones</CardTitle>
              </CardHeader>
              <CardContent className='space-y-2 text-xs'>
                {order.refunds.length === 0 && <p className='text-muted-foreground'>Sin devoluciones.</p>}
                {order.refunds.map((r) => (
                  <div key={r.id} className='flex justify-between gap-2'>
                    <span>
                      {format(r.createdAt, 'd MMM, HH:mm', { locale: es, in: tz(ctx.tenant.timezone) })} · {METHOD_LABEL[r.methodType]}
                      {r.reason && <span className='block text-muted-foreground'>{r.reason}</span>}
                      <span className='block text-[0.65rem] text-muted-foreground'>
                        {r.user?.name} · {r.restock ? 'con reingreso' : 'sin reingreso'}
                      </span>
                    </span>
                    <span className='text-destructive tabular-nums'>−{money(r.amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className='grid content-start gap-4'>
          <Card>
            <CardContent className='space-y-2.5 text-xs'>
              <Info label='Cliente'>
                {order.customer ? (
                  ctx.hasModule('customers') ? (
                    <Link href={`/app/${slug}/customers/${order.customer.id}`} className='font-medium hover:underline'>
                      {order.customer.name}
                    </Link>
                  ) : (
                    order.customer.name
                  )
                ) : (
                  'Público en general'
                )}
              </Info>
              <Info label='Atendió'>{order.cashier?.name ?? '—'}</Info>
              <Info label='Sucursal'>{order.branch.name}</Info>
              {order.registerSession && <Info label='Caja'>{order.registerSession.register.name}</Info>}
              <Info label='Tipo'>{TYPE_LABEL[order.type]}</Info>
              {order.notes && <Info label='Notas'>{order.notes}</Info>}
            </CardContent>
          </Card>
          <div className='overflow-hidden rounded-xl border bg-white'>
            <Receipt
              data={{
                business: {
                  name: ctx.tenant.name,
                  address: ctx.tenant.address,
                  phone: ctx.tenant.phone,
                  taxId: ctx.tenant.taxId,
                  header: ctx.tenant.receiptHeader,
                  footer: ctx.tenant.receiptFooter,
                  currency: ctx.tenant.currency,
                  timezone: ctx.tenant.timezone,
                },
                branch: order.branch.name,
                cashier: order.cashier?.name,
                customer: order.customer?.name,
                number: order.number,
                date: order.createdAt,
                type: order.type,
                status: order.status,
                items: order.items.map((i) => ({
                  name: i.name,
                  quantity: i.quantity,
                  unitPrice: i.unitPrice,
                  total: i.total,
                  discount: i.discount,
                })),
                subtotal: order.subtotal,
                discount: order.discountTotal,
                tax: order.taxTotal,
                total: order.total,
                payments: order.payments.map((p) => ({ name: p.methodName, amount: p.amount })),
                change: order.changeDue,
                refunded: order.refundedTotal,
              }}
            />
          </div>
        </div>
      </div>
    </>
  )
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`flex justify-between ${danger ? 'text-destructive' : 'text-muted-foreground'}`}>
      <dt>{label}</dt>
      <dd className='tabular-nums'>{value}</dd>
    </div>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex justify-between gap-4'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='text-right'>{children}</span>
    </div>
  )
}
