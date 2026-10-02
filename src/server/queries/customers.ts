import 'server-only'
import { format, startOfMonth, subMonths } from 'date-fns'
import { and, eq, gte, ne, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customers, orders } from '@/db/schema'
import { localTs } from './dashboard'

/** Indicadores generales del directorio de clientes. */
export async function getCustomerStats(tenantId: string, timezone: string) {
  const monthStart = sql`date_trunc('month', ${localTs(sql`now()`, timezone)})`
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      withBalance: sql<number>`count(*) filter (where ${customers.balance} > 0)::int`,
      balance: sql<number>`coalesce(sum(${customers.balance}) filter (where ${customers.balance} > 0), 0)::bigint`,
      spent: sql<number>`coalesce(sum(${customers.totalSpent}), 0)::bigint`,
      orders: sql<number>`coalesce(sum(${customers.ordersCount}), 0)::bigint`,
      newThisMonth: sql<number>`count(*) filter (where ${localTs(sql`${customers.createdAt}`, timezone)} >= ${monthStart})::int`,
    })
    .from(customers)
    .where(eq(customers.tenantId, tenantId))
  const spent = Number(row.spent)
  const count = Number(row.orders)
  return {
    total: Number(row.total),
    withBalance: Number(row.withBalance),
    balance: Number(row.balance),
    avgTicket: count ? Math.round(spent / count) : 0,
    newThisMonth: Number(row.newThisMonth),
  }
}

/** Gasto neto mensual de un cliente en los últimos `months` meses (incluido el actual). */
export async function getCustomerMonthlySpend(
  tenantId: string,
  customerId: string,
  timezone: string,
  months = 6,
) {
  const now = new Date()
  const from = startOfMonth(subMonths(now, months - 1))
  const month = sql<string>`to_char(${localTs(orders.createdAt, timezone)}, 'YYYY-MM')`
  const rows = await db
    .select({
      month,
      amount: sql<number>`coalesce(sum(${orders.total} - ${orders.refundedTotal}), 0)::bigint`,
      orders: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        eq(orders.customerId, customerId),
        ne(orders.status, 'voided'),
        // Margen de un día para cubrir la diferencia de zona horaria; el agrupado es local.
        gte(orders.createdAt, new Date(from.getTime() - 86_400_000)),
      ),
    )
    .groupBy(month)
  const byMonth = new Map(rows.map((r) => [r.month, r]))
  return Array.from({ length: months }, (_, i) => {
    const key = format(subMonths(now, months - 1 - i), 'yyyy-MM')
    const r = byMonth.get(key)
    return { month: key, amount: Number(r?.amount ?? 0), orders: Number(r?.orders ?? 0) }
  })
}
