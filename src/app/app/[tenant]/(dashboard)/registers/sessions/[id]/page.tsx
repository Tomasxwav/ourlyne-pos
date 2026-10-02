import { tz } from '@date-fns/tz'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { db } from '@/db'
import { formatMoney } from '@/lib/money'
import { getSessionSummary } from '@/server/registers'
import { requireModule, requirePermission } from '@/server/tenant'
import { DiffBadge } from '../../diff-badge'
import { PrintButton } from './print-button'

export const metadata: Metadata = { title: 'Corte de caja' }

export default async function SessionPage(props: PageProps<'/app/[tenant]/registers/sessions/[id]'>) {
  const { tenant: slug, id } = await props.params
  await requireModule(slug, 'registers')
  const ctx = await requirePermission(slug, 'registers.operate')
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const summary = await getSessionSummary(db, id)
  if (!summary || summary.session.tenantId !== ctx.tenant.id) notFound()
  if (!ctx.can('registers.manage') && summary.session.openedById !== ctx.user.id) notFound()

  const { session } = summary
  const money = (v: number) => formatMoney(v, ctx.tenant.currency)
  const fmt = (d: Date | null) => (d ? format(d, "d MMM yyyy, HH:mm", { locale: es, in: tz(ctx.tenant.timezone) }) : '—')

  return (
    <>
      <PageHeader
        eyebrow={session.register.branch.name}
        title={`Corte · ${session.register.name}`}
        description={`${fmt(session.openedAt)} → ${fmt(session.closedAt)}`}
        actions={<PrintButton />}
      />
      <div data-print className='grid gap-4 lg:grid-cols-3 print:block print:w-full'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Resumen</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-xs'>
            <Line label='Abrió' value={session.openedBy.name} />
            <Line label='Cerró' value={session.closedBy?.name ?? '—'} />
            <Line label='Tickets' value={String(summary.orders.count)} />
            <Line label='Ventas totales' value={money(summary.orders.total)} />
            <Line label='Descuentos' value={money(summary.orders.discount)} />
            <Line label='Impuestos' value={money(summary.orders.tax)} />
            <Line label='Devoluciones' value={money(summary.refunds.total)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Por método de pago</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-xs'>
            {summary.byMethod.map((m) => (
              <Line key={m.methodName} label={`${m.methodName} (${m.count})`} value={money(m.amount)} />
            ))}
            {summary.byMethod.length === 0 && <p className='text-muted-foreground'>Sin cobros.</p>}
            {summary.customerPayments.total > 0 && <Line label='Abonos de clientes' value={money(summary.customerPayments.total)} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Arqueo de efectivo</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-xs'>
            <Line label='Fondo inicial' value={money(session.openingAmount)} />
            <Line label='+ Ventas en efectivo' value={money(summary.cashSales)} />
            <Line label='+ Abonos en efectivo' value={money(summary.customerPayments.cash)} />
            <Line label='+ Entradas' value={money(summary.cashIn)} />
            <Line label='− Salidas' value={money(summary.cashOut)} />
            <Line label='− Devoluciones en efectivo' value={money(summary.refunds.cash)} />
            <div className='flex justify-between border-t pt-2 font-medium'>
              <span>Esperado</span>
              <span className='tabular-nums'>{money(session.expectedAmount ?? summary.expected)}</span>
            </div>
            {session.status === 'closed' && (
              <>
                <Line label='Contado' value={money(session.countedAmount ?? 0)} />
                <div className='flex items-center justify-between'>
                  <span>Diferencia</span>
                  <DiffBadge value={session.difference ?? 0} money={money} />
                </div>
              </>
            )}
            {session.notes && <p className='rounded-md bg-muted p-2'>{session.notes}</p>}
          </CardContent>
        </Card>
        {session.cashMovements.length > 0 && (
          <Card className='lg:col-span-3'>
            <CardHeader>
              <CardTitle className='text-base'>Movimientos de efectivo</CardTitle>
            </CardHeader>
            <CardContent className='space-y-1.5 text-xs'>
              {session.cashMovements.map((m) => (
                <div key={m.id} className='flex justify-between gap-3'>
                  <span>
                    {format(m.createdAt, 'HH:mm')} · {m.reason}
                    <span className='text-muted-foreground'> · {m.user?.name}</span>
                  </span>
                  <span className={`tabular-nums ${m.type === 'in' ? 'text-success' : 'text-destructive'}`}>
                    {m.type === 'in' ? '+' : '−'}
                    {money(m.amount)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex justify-between gap-3'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='tabular-nums'>{value}</span>
    </div>
  )
}
