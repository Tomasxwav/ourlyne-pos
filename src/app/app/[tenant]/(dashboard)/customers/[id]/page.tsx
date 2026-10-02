import { tz } from '@date-fns/tz'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { and, count, desc, eq } from 'drizzle-orm'
import { ArrowLeft, Mail, MapPin, Phone, ReceiptText, StickyNote } from 'lucide-react'
import { db } from '@/db'
import { customerPayments, customers, orders } from '@/db/schema'
import { PageHeader } from '@/components/app/page-header'
import { Pagination } from '@/components/app/list-controls'
import { StatTile } from '@/components/app/stat-tile'
import { ORDER_STATUS_UI, PAYMENT_STATUS_UI, StatusBadge } from '@/components/app/status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { folio, formatMoney, formatNumber } from '@/lib/money'
import { parsePage } from '@/lib/params'
import { getCustomerMonthlySpend } from '@/server/queries/customers'
import { getActiveRegister } from '@/server/registers'
import { requireModule, requirePermission } from '@/server/tenant'
import { CustomerDialog } from '../customer-dialog'
import { initials, PAYMENT_METHOD_LABEL } from '../utils'
import { DeleteCustomerButton, PaymentDialog } from './customer-actions'
import { MonthlySpendChart } from './spend-chart'

export const metadata: Metadata = { title: 'Cliente' }

const ORDERS_PAGE = 10

export default async function CustomerDetailPage(props: PageProps<'/app/[tenant]/customers/[id]'>) {
  const { tenant: slug, id } = await props.params
  const sp = await props.searchParams
  await requireModule(slug, 'customers')
  const ctx = await requirePermission(slug, 'customers.view')
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const page = parsePage(sp.page)

  const customer = await db.query.customers.findFirst({
    where: and(eq(customers.id, id), eq(customers.tenantId, ctx.tenant.id)),
  })
  if (!customer) notFound()

  const orderWhere = and(eq(orders.tenantId, ctx.tenant.id), eq(orders.customerId, id))
  const canManage = ctx.can('customers.manage')
  const needsRegister = ctx.hasModule('registers')

  const [orderRows, [{ total: orderTotal }], payments, monthly, active] = await Promise.all([
    db.query.orders.findMany({
      where: orderWhere,
      with: { branch: { columns: { name: true } }, payments: { columns: { methodType: true, amount: true } } },
      orderBy: [desc(orders.createdAt)],
      limit: ORDERS_PAGE,
      offset: (page - 1) * ORDERS_PAGE,
    }),
    db.select({ total: count() }).from(orders).where(orderWhere),
    db.query.customerPayments.findMany({
      where: and(eq(customerPayments.tenantId, ctx.tenant.id), eq(customerPayments.customerId, id)),
      with: { user: { columns: { name: true } } },
      orderBy: [desc(customerPayments.createdAt)],
      limit: 20,
    }),
    getCustomerMonthlySpend(ctx.tenant.id, id, ctx.tenant.timezone),
    canManage && needsRegister ? getActiveRegister(ctx) : Promise.resolve(null),
  ])

  const money = (v: number) => formatMoney(v, ctx.tenant.currency)
  const avgTicket = customer.ordersCount ? Math.round(customer.totalSpent / customer.ordersCount) : 0
  const available = Math.max(0, customer.creditLimit - customer.balance)
  const usage = customer.creditLimit ? Math.min(100, (customer.balance / customer.creditLimit) * 100) : 0
  const sixMonths = monthly.reduce((a, m) => a + m.amount, 0)
  const ordersLink = ctx.can('orders.view')

  return (
    <>
      <Link
        href={`/app/${slug}/customers`}
        className='-mb-3 inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground'
      >
        <ArrowLeft className='size-3' /> Clientes
      </Link>
      <PageHeader
        eyebrow={`Cliente desde ${format(customer.createdAt, "MMMM 'de' yyyy", { locale: es, in: tz(ctx.tenant.timezone) })}`}
        title={
          <span className='flex items-center gap-3'>
            <span className='flex size-11 shrink-0 items-center justify-center rounded-full bg-gold/15 font-sans text-sm font-semibold text-gold-deep ring-1 ring-gold/30 dark:text-gold'>
              {initials(customer.name)}
            </span>
            <span className='min-w-0 break-words'>{customer.name}</span>
          </span>
        }
        description={
          <span className='mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs'>
            {customer.phone && (
              <span className='inline-flex items-center gap-1'>
                <Phone className='size-3' /> {customer.phone}
              </span>
            )}
            {customer.email && (
              <span className='inline-flex items-center gap-1'>
                <Mail className='size-3' /> {customer.email}
              </span>
            )}
            {customer.taxId && <span className='font-mono'>RFC {customer.taxId}</span>}
            {!customer.phone && !customer.email && !customer.taxId && 'Sin datos de contacto'}
          </span>
        }
        actions={
          canManage && (
            <>
              <PaymentDialog
                slug={slug}
                customerId={customer.id}
                balance={customer.balance}
                currency={ctx.tenant.currency}
                needsRegister={needsRegister}
                registerName={active?.session ? active.register.name : null}
              />
              <CustomerDialog slug={slug} customer={customer} />
              <DeleteCustomerButton slug={slug} id={customer.id} name={customer.name} />
            </>
          )
        }
      />

      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4'>
        <StatTile label='Total gastado' value={money(customer.totalSpent)} hint={`${money(sixMonths)} en 6 meses`} />
        <StatTile
          label='Compras'
          value={formatNumber(customer.ordersCount)}
          hint={`ticket promedio ${money(avgTicket)}`}
        />
        <StatTile label='Puntos' value={formatNumber(customer.loyaltyPoints)} hint='de lealtad acumulados' />
        <div className='relative overflow-hidden rounded-xl border bg-card p-4 transition-colors hover:border-gold/50 md:p-5'>
          <p className='text-[0.65rem] font-medium tracking-[0.18em] text-muted-foreground uppercase'>Saldo</p>
          <p
            className={`mt-3 font-heading text-lg leading-tight font-semibold tracking-tight tabular-nums sm:text-xl xl:text-2xl 2xl:text-3xl ${customer.balance > 0 ? 'text-destructive' : ''}`}
          >
            {money(customer.balance)}
          </p>
          {customer.creditLimit > 0 ? (
            <div className='mt-2 space-y-1.5'>
              <div
                className='h-1.5 overflow-hidden rounded-full bg-muted'
                role='meter'
                aria-label='Crédito utilizado'
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(usage)}
              >
                <div
                  className={`h-full rounded-full ${usage >= 90 ? 'bg-destructive' : 'bg-gold'}`}
                  style={{ width: `${usage}%` }}
                />
              </div>
              <p className='text-xs text-muted-foreground tabular-nums'>
                Disponible {money(available)} de {money(customer.creditLimit)}
              </p>
            </div>
          ) : (
            <p className='mt-2 text-xs text-muted-foreground'>Sin línea de crédito</p>
          )}
        </div>
      </div>

      <div className='grid gap-4 xl:grid-cols-[1fr_22rem]'>
        <div className='grid min-w-0 content-start gap-4'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Compras por mes</CardTitle>
              <CardDescription>Importe neto de los últimos 6 meses.</CardDescription>
            </CardHeader>
            <CardContent>
              {sixMonths > 0 ? (
                <MonthlySpendChart data={monthly} currency={ctx.tenant.currency} />
              ) : (
                <p className='py-12 text-center text-xs text-muted-foreground'>Sin compras en los últimos 6 meses.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Historial de compras</CardTitle>
              <CardDescription>
                {formatNumber(orderTotal)} {orderTotal === 1 ? 'venta' : 'ventas'} registradas
              </CardDescription>
            </CardHeader>
            <CardContent className='px-0'>
              {orderRows.length === 0 ? (
                <p className='px-4 py-10 text-center text-xs text-muted-foreground'>Este cliente aún no tiene compras.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className='hover:bg-transparent'>
                        <TableHead className='pl-4'>Folio</TableHead>
                        <TableHead className='hidden sm:table-cell'>Fecha</TableHead>
                        <TableHead className='hidden md:table-cell'>Sucursal</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className='pr-4 text-right'>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderRows.map((o) => {
                        const st = ORDER_STATUS_UI[o.status]
                        const pay = PAYMENT_STATUS_UI[o.paymentStatus]
                        const credit = o.payments.filter((p) => p.methodType === 'credit').reduce((a, p) => a + p.amount, 0)
                        return (
                          <TableRow key={o.id}>
                            <TableCell className='pl-4'>
                              {ordersLink ? (
                                <Link href={`/app/${slug}/orders/${o.id}`} className='font-mono font-medium hover:underline'>
                                  {folio('V', o.number)}
                                </Link>
                              ) : (
                                <span className='font-mono font-medium'>{folio('V', o.number)}</span>
                              )}
                              <span className='block text-[0.65rem] text-muted-foreground sm:hidden'>
                                {format(o.createdAt, 'd MMM yyyy', { locale: es, in: tz(ctx.tenant.timezone) })}
                              </span>
                            </TableCell>
                            <TableCell className='hidden text-muted-foreground sm:table-cell'>
                              {format(o.createdAt, "d MMM yyyy, HH:mm", { locale: es, in: tz(ctx.tenant.timezone) })}
                            </TableCell>
                            <TableCell className='hidden text-muted-foreground md:table-cell'>{o.branch.name}</TableCell>
                            <TableCell>
                              <span className='flex flex-wrap gap-1'>
                                <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                                {credit > 0 && o.status !== 'voided' && (
                                  <StatusBadge tone={pay.tone}>
                                    {o.paymentStatus === 'paid' ? 'Crédito pagado' : `Crédito ${money(credit)}`}
                                  </StatusBadge>
                                )}
                              </span>
                            </TableCell>
                            <TableCell className='pr-4 text-right font-medium tabular-nums'>
                              {money(o.total)}
                              {o.refundedTotal > 0 && (
                                <span className='block text-[0.65rem] font-normal text-destructive'>
                                  −{money(o.refundedTotal)}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  {orderTotal > ORDERS_PAGE && (
                    <div className='mt-2 border-t px-4 pt-2.5'>
                      <Pagination page={page} pageSize={ORDERS_PAGE} total={orderTotal} searchParams={sp} />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className='grid content-start gap-4'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Abonos</CardTitle>
              <CardDescription>Pagos al saldo de crédito.</CardDescription>
            </CardHeader>
            <CardContent className='px-0'>
              {payments.length === 0 ? (
                <p className='px-4 py-6 text-center text-xs text-muted-foreground'>Sin abonos registrados.</p>
              ) : (
                <ul className='divide-y'>
                  {payments.map((p) => (
                    <li key={p.id} className='flex items-start justify-between gap-3 px-4 py-2.5 text-xs'>
                      <span className='min-w-0'>
                        <span className='block font-medium'>{PAYMENT_METHOD_LABEL[p.methodType] ?? p.methodType}</span>
                        <span className='block text-[0.65rem] text-muted-foreground'>
                          {format(p.createdAt, "d MMM yyyy, HH:mm", { locale: es, in: tz(ctx.tenant.timezone) })}
                          {p.user?.name && ` · ${p.user.name}`}
                        </span>
                        {p.note && <span className='block truncate text-muted-foreground'>{p.note}</span>}
                      </span>
                      <span className='shrink-0 font-medium text-success tabular-nums'>{money(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Datos del cliente</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3 text-xs'>
              <Info icon={<MapPin />} label='Dirección'>
                {customer.address ?? '—'}
              </Info>
              <Info icon={<ReceiptText />} label='Última compra'>
                {customer.lastPurchaseAt ? format(customer.lastPurchaseAt, "d 'de' MMMM yyyy", { locale: es, in: tz(ctx.tenant.timezone) }) : '—'}
              </Info>
              <Info icon={<StickyNote />} label='Notas'>
                <span className='whitespace-pre-line'>{customer.notes ?? '—'}</span>
              </Info>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

function Info({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className='flex gap-2.5'>
      <span className='mt-0.5 text-muted-foreground [&_svg]:size-3.5'>{icon}</span>
      <div className='min-w-0'>
        <p className='text-muted-foreground'>{label}</p>
        <p className='mt-0.5 break-words'>{children}</p>
      </div>
    </div>
  )
}
