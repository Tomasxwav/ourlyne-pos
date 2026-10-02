import 'server-only'
import { subDays, startOfDay, format } from 'date-fns'
import { and, desc, eq, gte, lt, ne, sql, type SQL } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { db } from '@/db'
import {
  customers,
  orderItems,
  orderPayments,
  orders,
  products,
  stockLevels,
  user,
} from '@/db/schema'

export type DashboardRange = 7 | 30 | 90

type Scope = { tenantId: string; branchId?: string; timezone: string }

/** Fecha local del negocio para una columna timestamp almacenada en UTC. */
export function localTs(col: SQL | AnyPgColumn, tz: string) {
  // Literal (validado) para que GROUP BY reconozca expresiones idénticas.
  const safe = /^[A-Za-z0-9_/+-]+$/.test(tz) ? tz : 'UTC'
  return sql`((${col} AT TIME ZONE 'UTC') AT TIME ZONE '${sql.raw(safe)}')`
}

function orderFilter(scope: Scope, from: Date, to?: Date) {
  return and(
    eq(orders.tenantId, scope.tenantId),
    ne(orders.status, 'voided'),
    gte(orders.createdAt, from),
    to ? lt(orders.createdAt, to) : undefined,
    scope.branchId ? eq(orders.branchId, scope.branchId) : undefined,
  )
}

const netRevenue = sql<number>`coalesce(sum(${orders.total} - ${orders.refundedTotal}), 0)::bigint`

async function kpis(scope: Scope, from: Date, to?: Date) {
  const [row] = await db
    .select({
      revenue: netRevenue,
      orders: sql<number>`count(*)::int`,
      tax: sql<number>`coalesce(sum(${orders.taxTotal}), 0)::bigint`,
      cost: sql<number>`coalesce(sum(${orders.costTotal}), 0)::bigint`,
      customers: sql<number>`count(distinct ${orders.customerId})::int`,
    })
    .from(orders)
    .where(orderFilter(scope, from, to))
  const revenue = Number(row.revenue)
  const count = Number(row.orders)
  return {
    revenue,
    orders: count,
    avgTicket: count ? Math.round(revenue / count) : 0,
    profit: revenue - Number(row.tax) - Number(row.cost),
    customers: Number(row.customers),
  }
}

export async function getDashboard(scope: Scope, range: DashboardRange) {
  const now = new Date()
  const from = startOfDay(subDays(now, range - 1))
  const prevFrom = subDays(from, range)

  const [current, previous] = await Promise.all([
    kpis(scope, from),
    kpis(scope, prevFrom, from),
  ])

  const day = sql<string>`to_char(${localTs(orders.createdAt, scope.timezone)}, 'YYYY-MM-DD')`
  const dailyRows = await db
    .select({ day, revenue: netRevenue, orders: sql<number>`count(*)::int` })
    .from(orders)
    .where(orderFilter(scope, prevFrom))
    .groupBy(day)

  const byDay = new Map(dailyRows.map((r) => [r.day, r]))
  const daily = Array.from({ length: range }, (_, i) => {
    const d = subDays(now, range - 1 - i)
    const p = subDays(d, range)
    const cur = byDay.get(format(d, 'yyyy-MM-dd'))
    const prev = byDay.get(format(p, 'yyyy-MM-dd'))
    return {
      date: format(d, 'yyyy-MM-dd'),
      revenue: Number(cur?.revenue ?? 0),
      orders: Number(cur?.orders ?? 0),
      previous: Number(prev?.revenue ?? 0),
    }
  })

  const paymentRows = await db
    .select({
      name: orderPayments.methodName,
      type: orderPayments.methodType,
      amount: sql<number>`coalesce(sum(${orderPayments.amount}), 0)::bigint`,
      count: sql<number>`count(*)::int`,
    })
    .from(orderPayments)
    .innerJoin(orders, eq(orders.id, orderPayments.orderId))
    .where(orderFilter(scope, from))
    .groupBy(orderPayments.methodName, orderPayments.methodType)
    .orderBy(desc(sql`sum(${orderPayments.amount})`))

  const topProducts = await db
    .select({
      productId: orderItems.productId,
      name: orderItems.name,
      quantity: sql<number>`coalesce(sum(${orderItems.quantity} - ${orderItems.refundedQuantity}), 0)::float`,
      revenue: sql<number>`coalesce(sum(${orderItems.total}), 0)::bigint`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(orderFilter(scope, from))
    .groupBy(orderItems.productId, orderItems.name)
    .orderBy(desc(sql`sum(${orderItems.total})`))
    .limit(6)

  const dow = sql<number>`extract(isodow from ${localTs(orders.createdAt, scope.timezone)})::int`
  const hour = sql<number>`extract(hour from ${localTs(orders.createdAt, scope.timezone)})::int`
  const heatRows = await db
    .select({ dow, hour, orders: sql<number>`count(*)::int` })
    .from(orders)
    .where(orderFilter(scope, from))
    .groupBy(dow, hour)

  const recent = await db
    .select({
      id: orders.id,
      number: orders.number,
      total: orders.total,
      status: orders.status,
      createdAt: orders.createdAt,
      customer: customers.name,
      cashier: user.name,
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(user, eq(user.id, orders.cashierId))
    .where(
      and(
        eq(orders.tenantId, scope.tenantId),
        scope.branchId ? eq(orders.branchId, scope.branchId) : undefined,
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(7)

  return {
    current,
    previous,
    daily,
    payments: paymentRows.map((r) => ({ ...r, amount: Number(r.amount) })),
    topProducts: topProducts.map((r) => ({ ...r, revenue: Number(r.revenue), quantity: Number(r.quantity) })),
    heatmap: heatRows.map((r) => ({ dow: Number(r.dow), hour: Number(r.hour), orders: Number(r.orders) })),
    recent,
  }
}

export async function getLowStock(tenantId: string, branchId?: string, limit = 6) {
  return db
    .select({
      productId: products.id,
      name: products.name,
      unit: products.unit,
      quantity: stockLevels.quantity,
      threshold: products.lowStockThreshold,
      branchId: stockLevels.branchId,
    })
    .from(stockLevels)
    .innerJoin(products, eq(products.id, stockLevels.productId))
    .where(
      and(
        eq(stockLevels.tenantId, tenantId),
        eq(products.isActive, true),
        eq(products.trackStock, true),
        sql`${stockLevels.quantity} <= ${products.lowStockThreshold}`,
        branchId ? eq(stockLevels.branchId, branchId) : undefined,
      ),
    )
    .orderBy(stockLevels.quantity)
    .limit(limit)
}

