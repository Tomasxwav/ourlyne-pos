import { startOfDay, subDays } from 'date-fns'
import { parseDate, str } from '@/lib/params'
import {
  cashierReport,
  paymentReport,
  productReport,
  profitAndLoss,
  salesByDay,
} from '@/server/queries/reports'
import { getTenantContext } from '@/server/tenant'

const cents = (v: number) => (v / 100).toFixed(2)

function toCsv(header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
}

export async function GET(request: Request, ctxArg: RouteContext<'/app/[tenant]/reports/export'>) {
  const { tenant: slug } = await ctxArg.params
  const ctx = await getTenantContext(slug)
  if (!ctx.hasModule('reports') || !ctx.can('reports.view')) {
    return new Response('No autorizado', { status: 403 })
  }
  const sp = Object.fromEntries(new URL(request.url).searchParams)
  const scope = {
    tenantId: ctx.tenant.id,
    branchId: str(sp.branch),
    from: parseDate(sp.from) ?? startOfDay(subDays(new Date(), 29)),
    to: parseDate(sp.to, true) ?? new Date(),
    timezone: ctx.tenant.timezone,
  }
  const tab = sp.tab ?? 'sales'
  let csv: string

  switch (tab) {
    case 'products': {
      const rows = await productReport(scope, 1000)
      csv = toCsv(
        ['Producto', 'SKU', 'Categoría', 'Unidades', 'Ventas', 'Costo', 'Utilidad', 'Margen %'],
        rows.map((r) => [r.name, r.sku ?? '', r.category ?? '', r.quantity, cents(r.revenue), cents(r.cost), cents(r.profit), Math.round(r.margin * 100)]),
      )
      break
    }
    case 'cashiers': {
      const rows = await cashierReport(scope)
      csv = toCsv(
        ['Cajero', 'Tickets', 'Ventas netas', 'Ticket promedio', 'Descuentos', 'Devoluciones'],
        rows.map((r) => [r.name, r.orders, cents(r.net), cents(r.avg), cents(r.discounts), cents(r.refunded)]),
      )
      break
    }
    case 'payments': {
      const rows = await paymentReport(scope)
      csv = toCsv(['Método', 'Pagos', 'Importe'], rows.map((r) => [r.name, r.count, cents(r.amount)]))
      break
    }
    case 'pnl': {
      const rows = await profitAndLoss(scope)
      csv = toCsv(
        ['Mes', 'Ventas sin IVA', 'Costo', 'Utilidad bruta', 'Gastos', 'Utilidad neta'],
        rows.map((r) => [r.month, cents(r.net), cents(r.cost), cents(r.gross), cents(r.expenses), cents(r.profit)]),
      )
      break
    }
    default: {
      const rows = await salesByDay(scope)
      csv = toCsv(['Fecha', 'Tickets', 'Ventas netas', 'Utilidad bruta'], rows.map((r) => [r.day, r.orders, cents(r.net), cents(r.profit)]))
    }
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reporte-${tab}-${slug}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
