import { tz } from '@date-fns/tz'
import type { Metadata } from 'next'
import Link from 'next/link'
import { format, startOfDay, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Download } from 'lucide-react'
import { DateRangeFilter, FilterSelect } from '@/components/app/list-controls'
import { PageHeader } from '@/components/app/page-header'
import { StatTile } from '@/components/app/stat-tile'
import { CategoryBars, DailySalesBars, ProfitLossChart } from '@/components/dashboard/report-charts'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney, formatNumber, formatQty } from '@/lib/money'
import { parseDate, str } from '@/lib/params'
import { cn } from '@/lib/utils'
import {
  cashierReport,
  categoryReport,
  paymentReport,
  productReport,
  profitAndLoss,
  refundReport,
  salesByDay,
  salesSummary,
} from '@/server/queries/reports'
import { requireModule, requirePermission } from '@/server/tenant'

export const metadata: Metadata = { title: 'Reportes' }

const TABS = [
  { key: 'sales', label: 'Ventas' },
  { key: 'products', label: 'Productos' },
  { key: 'cashiers', label: 'Cajeros' },
  { key: 'payments', label: 'Métodos de pago' },
  { key: 'pnl', label: 'Estado de resultados' },
] as const

export default async function ReportsPage(props: PageProps<'/app/[tenant]/reports'>) {
  const { tenant: slug } = await props.params
  const sp = await props.searchParams
  await requireModule(slug, 'reports')
  const ctx = await requirePermission(slug, 'reports.view')

  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as (typeof TABS)[number]['key']) : 'sales'
  const from = parseDate(sp.from) ?? startOfDay(subDays(new Date(), 29))
  const to = parseDate(sp.to, true) ?? new Date()
  const branchId = str(sp.branch)
  const scope = { tenantId: ctx.tenant.id, branchId, from, to, timezone: ctx.tenant.timezone }
  const currency = ctx.tenant.currency
  const money = (v: number) => formatMoney(v, currency)

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) if (typeof v === 'string') p.set(k, v)
    for (const [k, v] of Object.entries(patch)) p.set(k, v)
    return `?${p}`
  }
  const exportHref = `/app/${slug}/reports/export${qs({ tab, from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') })}`

  const summary = await salesSummary(scope)

  return (
    <>
      <PageHeader
        title='Reportes'
        description={`Del ${format(from, "d 'de' MMMM", { locale: es, in: tz(ctx.tenant.timezone) })} al ${format(to, "d 'de' MMMM yyyy", { locale: es, in: tz(ctx.tenant.timezone) })}`}
        actions={
          <a href={exportHref} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            <Download /> Exportar CSV
          </a>
        }
      />

      <div className='flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between'>
        <nav className='-mx-1 flex gap-1 overflow-x-auto px-1'>
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={qs({ tab: t.key })}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                tab === t.key ? 'border-transparent bg-foreground text-background' : 'bg-card hover:border-gold/50',
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div className='flex flex-wrap items-center gap-2'>
          {ctx.branches.length > 1 && (
            <FilterSelect
              param='branch'
              allLabel='Todas las sucursales'
              options={ctx.branches.map((b) => ({ value: b.id, label: b.name }))}
            />
          )}
          <DateRangeFilter />
        </div>
      </div>

      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <StatTile label='Ventas netas' value={money(summary.net)} hint={`${formatNumber(summary.orders)} tickets`} />
        <StatTile label='Utilidad bruta' value={money(summary.profit)} hint={summary.net ? `margen ${Math.round((summary.profit / Math.max(1, summary.net - summary.tax)) * 100)}%` : undefined} />
        <StatTile label='Ticket promedio' value={money(summary.avgTicket)} />
        <StatTile label='Descuentos / devoluciones' value={`${money(summary.discounts)} / ${money(summary.refunded)}`} />
      </div>

      {tab === 'sales' && <SalesTab scope={scope} currency={currency} summary={summary} />}
      {tab === 'products' && <ProductsTab scope={scope} currency={currency} />}
      {tab === 'cashiers' && <CashiersTab scope={scope} currency={currency} />}
      {tab === 'payments' && <PaymentsTab scope={scope} currency={currency} />}
      {tab === 'pnl' && <PnlTab scope={scope} currency={currency} hasExpenses={ctx.hasModule('expenses')} />}
    </>
  )
}

type Scope = Parameters<typeof salesSummary>[0]

async function SalesTab({ scope, currency, summary }: { scope: Scope; currency: string; summary: Awaited<ReturnType<typeof salesSummary>> }) {
  const [daily, refunds] = await Promise.all([salesByDay(scope), refundReport(scope)])
  const money = (v: number) => formatMoney(v, currency)
  return (
    <div className='grid gap-4 xl:grid-cols-[1fr_20rem]'>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Ventas netas por día</CardTitle>
        </CardHeader>
        <CardContent>
          <DailySalesBars data={daily} currency={currency} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Desglose</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2 text-xs'>
          <Row label='Ventas brutas' value={money(summary.gross)} />
          <Row label='− Descuentos' value={money(summary.discounts)} />
          <Row label='= Total cobrado' value={money(summary.total)} strong />
          <Row label='− Devoluciones' value={`${money(summary.refunded)} (${refunds.count})`} />
          <Row label='= Ventas netas' value={money(summary.net)} strong />
          <Row label='Impuestos incluidos' value={money(summary.tax)} />
          <Row label='Costo de lo vendido' value={money(summary.cost)} />
          <Row label='Utilidad bruta' value={money(summary.profit)} strong />
        </CardContent>
      </Card>
    </div>
  )
}

async function ProductsTab({ scope, currency }: { scope: Scope; currency: string }) {
  const [rows, cats] = await Promise.all([productReport(scope), categoryReport(scope)])
  const money = (v: number) => formatMoney(v, currency)
  return (
    <div className='grid gap-4 xl:grid-cols-[1fr_22rem]'>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Productos</CardTitle>
          <CardDescription>Ordenados por ventas.</CardDescription>
        </CardHeader>
        <CardContent className='px-0'>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='pl-4'>Producto</TableHead>
                <TableHead className='text-right'>Unidades</TableHead>
                <TableHead className='text-right'>Ventas</TableHead>
                <TableHead className='hidden text-right md:table-cell'>Costo</TableHead>
                <TableHead className='text-right'>Utilidad</TableHead>
                <TableHead className='hidden pr-4 text-right sm:table-cell'>Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.productId}-${r.name}`}>
                  <TableCell className='pl-4'>
                    <p className='font-medium'>{r.name}</p>
                    <p className='text-[0.65rem] text-muted-foreground'>{r.category ?? 'Sin categoría'}</p>
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>{formatQty(r.quantity)}</TableCell>
                  <TableCell className='text-right tabular-nums'>{money(r.revenue)}</TableCell>
                  <TableCell className='hidden text-right text-muted-foreground tabular-nums md:table-cell'>{money(r.cost)}</TableCell>
                  <TableCell className='text-right font-medium tabular-nums'>{money(r.profit)}</TableCell>
                  <TableCell className='hidden pr-4 text-right tabular-nums sm:table-cell'>{Math.round(r.margin * 100)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Por categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryBars data={cats} currency={currency} />
        </CardContent>
      </Card>
    </div>
  )
}

async function CashiersTab({ scope, currency }: { scope: Scope; currency: string }) {
  const rows = await cashierReport(scope)
  const money = (v: number) => formatMoney(v, currency)
  const max = Math.max(1, ...rows.map((r) => r.net))
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Desempeño por cajero</CardTitle>
      </CardHeader>
      <CardContent className='px-0'>
        <Table>
          <TableHeader>
            <TableRow className='hover:bg-transparent'>
              <TableHead className='pl-4'>Cajero</TableHead>
              <TableHead className='text-right'>Tickets</TableHead>
              <TableHead className='text-right'>Ventas netas</TableHead>
              <TableHead className='hidden text-right md:table-cell'>Ticket prom.</TableHead>
              <TableHead className='hidden text-right md:table-cell'>Descuentos</TableHead>
              <TableHead className='pr-4 text-right'>Devoluciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.cashierId ?? 'none'}>
                <TableCell className='pl-4'>
                  <p className='font-medium'>{r.name}</p>
                  <div className='mt-1 h-1 w-32 overflow-hidden rounded-full bg-muted'>
                    <div className='h-full bg-chart-1' style={{ width: `${(r.net / max) * 100}%` }} />
                  </div>
                </TableCell>
                <TableCell className='text-right tabular-nums'>{formatNumber(r.orders)}</TableCell>
                <TableCell className='text-right font-medium tabular-nums'>{money(r.net)}</TableCell>
                <TableCell className='hidden text-right tabular-nums md:table-cell'>{money(r.avg)}</TableCell>
                <TableCell className='hidden text-right tabular-nums md:table-cell'>{money(r.discounts)}</TableCell>
                <TableCell className='pr-4 text-right tabular-nums'>{money(r.refunded)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

async function PaymentsTab({ scope, currency }: { scope: Scope; currency: string }) {
  const rows = await paymentReport(scope)
  const total = rows.reduce((a, r) => a + r.amount, 0) || 1
  const money = (v: number) => formatMoney(v, currency)
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Cobros por método</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {rows.map((r) => (
          <div key={r.name}>
            <div className='flex justify-between text-xs'>
              <span className='font-medium'>{r.name}</span>
              <span className='tabular-nums'>
                {money(r.amount)} <span className='text-muted-foreground'>· {Math.round((r.amount / total) * 100)}% · {r.count} pagos</span>
              </span>
            </div>
            <div className='mt-1.5 h-2 overflow-hidden rounded-full bg-muted'>
              <div className='h-full rounded-full bg-chart-2' style={{ width: `${(r.amount / total) * 100}%` }} />
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className='py-6 text-center text-xs text-muted-foreground'>Sin cobros en el periodo.</p>}
      </CardContent>
    </Card>
  )
}

async function PnlTab({ scope, currency, hasExpenses }: { scope: Scope; currency: string; hasExpenses: boolean }) {
  const rows = await profitAndLoss(scope)
  const money = (v: number) => formatMoney(v, currency)
  const totals = rows.reduce(
    (a, r) => ({ net: a.net + r.net, cost: a.cost + r.cost, gross: a.gross + r.gross, expenses: a.expenses + r.expenses, profit: a.profit + r.profit }),
    { net: 0, cost: 0, gross: 0, expenses: 0, profit: 0 },
  )
  return (
    <div className='grid gap-4'>
      {!hasExpenses && (
        <p className='rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs'>
          Activa el módulo de gastos para incluirlos en la utilidad neta.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Estado de resultados mensual</CardTitle>
          <CardDescription>Ventas sin impuestos − costo de lo vendido − gastos.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfitLossChart data={rows} currency={currency} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className='px-0'>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='pl-4'>Mes</TableHead>
                <TableHead className='text-right'>Ventas (sin IVA)</TableHead>
                <TableHead className='text-right'>Costo</TableHead>
                <TableHead className='text-right'>Utilidad bruta</TableHead>
                <TableHead className='text-right'>Gastos</TableHead>
                <TableHead className='pr-4 text-right'>Utilidad neta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...rows, { month: 'Total', ...totals }].map((r) => (
                <TableRow key={r.month} className={r.month === 'Total' ? 'font-semibold' : ''}>
                  <TableCell className='pl-4 capitalize'>
                    {r.month === 'Total' ? 'Total' : format(new Date(`${r.month}-01T12:00:00`), 'MMMM yyyy', { locale: es })}
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>{money(r.net)}</TableCell>
                  <TableCell className='text-right tabular-nums'>{money(r.cost)}</TableCell>
                  <TableCell className='text-right tabular-nums'>{money(r.gross)}</TableCell>
                  <TableCell className='text-right tabular-nums'>{money(r.expenses)}</TableCell>
                  <TableCell className={cn('pr-4 text-right tabular-nums', r.profit < 0 && 'text-destructive')}>{money(r.profit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-3', strong ? 'border-t pt-2 font-semibold' : 'text-muted-foreground')}>
      <span>{label}</span>
      <span className='text-foreground tabular-nums'>{value}</span>
    </div>
  )
}
