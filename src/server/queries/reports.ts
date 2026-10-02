import 'server-only'
import { and, desc, eq, gte, lte, ne, sql } from 'drizzle-orm'
import { db } from '@/db'
import { categories, expenses, orderItems, orderPayments, orders, products, refunds, user } from '@/db/schema'
import { localTs } from './dashboard'

export type ReportScope = { tenantId: string; branchId?: string; from: Date; to: Date; timezone: string }

const orderWhere = (s: ReportScope) =>
  and(
    eq(orders.tenantId, s.tenantId),
    ne(orders.status, 'voided'),
    gte(orders.createdAt, s.from),
    lte(orders.createdAt, s.to),
    s.branchId ? eq(orders.branchId, s.branchId) : undefined,
  )

const n = (v: unknown) => Number(v ?? 0)

export async function salesSummary(s: ReportScope) {
  const [row] = await db
    .select({
      orders: sql<number>`count(*)::int`,
      gross: sql<number>`coalesce(sum(${orders.subtotal}), 0)::bigint`,
      discounts: sql<number>`coalesce(sum(${orders.discountTotal}), 0)::bigint`,
      tax: sql<number>`coalesce(sum(${orders.taxTotal}), 0)::bigint`,
      total: sql<number>`coalesce(sum(${orders.total}), 0)::bigint`,
      refunded: sql<number>`coalesce(sum(${orders.refundedTotal}), 0)::bigint`,
      cost: sql<number>`coalesce(sum(${orders.costTotal}), 0)::bigint`,
    })
    .from(orders)
    .where(orderWhere(s))
  const net = n(row.total) - n(row.refunded)
  return {
    orders: n(row.orders),
    gross: n(row.gross),
    discounts: n(row.discounts),
    tax: n(row.tax),
    total: n(row.total),
    refunded: n(row.refunded),
    net,
    cost: n(row.cost),
    profit: net - n(row.tax) - n(row.cost),
    avgTicket: n(row.orders) ? Math.round(net / n(row.orders)) : 0,
  }
}

export async function salesByDay(s: ReportScope) {
  const day = sql<string>`to_char(${localTs(orders.createdAt, s.timezone)}, 'YYYY-MM-DD')`
  const rows = await db
    .select({
      day,
      orders: sql<number>`count(*)::int`,
      net: sql<number>`coalesce(sum(${orders.total} - ${orders.refundedTotal}), 0)::bigint`,
      profit: sql<number>`coalesce(sum(${orders.total} - ${orders.refundedTotal} - ${orders.taxTotal} - ${orders.costTotal}), 0)::bigint`,
    })
    .from(orders)
    .where(orderWhere(s))
    .groupBy(day)
    .orderBy(day)
  return rows.map((r) => ({ day: r.day, orders: n(r.orders), net: n(r.net), profit: n(r.profit) }))
}

export async function productReport(s: ReportScope, limit = 50) {
  const rows = await db
    .select({
      productId: orderItems.productId,
      name: orderItems.name,
      sku: orderItems.sku,
      category: categories.name,
      quantity: sql<number>`coalesce(sum(${orderItems.quantity} - ${orderItems.refundedQuantity}), 0)::float`,
      revenue: sql<number>`coalesce(sum(${orderItems.total}), 0)::bigint`,
      tax: sql<number>`coalesce(sum(${orderItems.taxAmount}), 0)::bigint`,
      cost: sql<number>`coalesce(sum(${orderItems.unitCost} * ${orderItems.quantity}), 0)::bigint`,
      tickets: sql<number>`count(distinct ${orderItems.orderId})::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(orderWhere(s))
    .groupBy(orderItems.productId, orderItems.name, orderItems.sku, categories.name)
    .orderBy(desc(sql`sum(${orderItems.total})`))
    .limit(limit)
  return rows.map((r) => {
    const revenue = n(r.revenue)
    const profit = revenue - n(r.tax) - n(r.cost)
    return { ...r, quantity: n(r.quantity), revenue, cost: n(r.cost), profit, margin: revenue ? profit / (revenue - n(r.tax)) : 0 }
  })
}

export async function categoryReport(s: ReportScope) {
  const rows = await db
    .select({
      name: sql<string>`coalesce(${categories.name}, 'Sin categoría')`,
      color: categories.color,
      revenue: sql<number>`coalesce(sum(${orderItems.total}), 0)::bigint`,
      quantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::float`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(orderWhere(s))
    .groupBy(categories.name, categories.color)
    .orderBy(desc(sql`sum(${orderItems.total})`))
  return rows.map((r) => ({ ...r, revenue: n(r.revenue), quantity: n(r.quantity) }))
}

export async function cashierReport(s: ReportScope) {
  const rows = await db
    .select({
      cashierId: orders.cashierId,
      name: sql<string>`coalesce(${user.name}, 'Sin asignar')`,
      orders: sql<number>`count(*)::int`,
      net: sql<number>`coalesce(sum(${orders.total} - ${orders.refundedTotal}), 0)::bigint`,
      discounts: sql<number>`coalesce(sum(${orders.discountTotal}), 0)::bigint`,
      refunded: sql<number>`coalesce(sum(${orders.refundedTotal}), 0)::bigint`,
    })
    .from(orders)
    .leftJoin(user, eq(user.id, orders.cashierId))
    .where(orderWhere(s))
    .groupBy(orders.cashierId, user.name)
    .orderBy(desc(sql`sum(${orders.total})`))
  return rows.map((r) => ({
    ...r,
    orders: n(r.orders),
    net: n(r.net),
    discounts: n(r.discounts),
    refunded: n(r.refunded),
    avg: n(r.orders) ? Math.round(n(r.net) / n(r.orders)) : 0,
  }))
}

export async function paymentReport(s: ReportScope) {
  const rows = await db
    .select({
      name: orderPayments.methodName,
      type: orderPayments.methodType,
      amount: sql<number>`coalesce(sum(${orderPayments.amount}), 0)::bigint`,
      count: sql<number>`count(*)::int`,
    })
    .from(orderPayments)
    .innerJoin(orders, eq(orders.id, orderPayments.orderId))
    .where(orderWhere(s))
    .groupBy(orderPayments.methodName, orderPayments.methodType)
    .orderBy(desc(sql`sum(${orderPayments.amount})`))
  return rows.map((r) => ({ ...r, amount: n(r.amount), count: n(r.count) }))
}

/** Estado de resultados por mes: ventas netas, costo, utilidad bruta, gastos y utilidad neta. */
export async function profitAndLoss(s: ReportScope) {
  const month = sql<string>`to_char(${localTs(orders.createdAt, s.timezone)}, 'YYYY-MM')`
  const sales = await db
    .select({
      month,
      net: sql<number>`coalesce(sum(${orders.total} - ${orders.refundedTotal} - ${orders.taxTotal}), 0)::bigint`,
      cost: sql<number>`coalesce(sum(${orders.costTotal}), 0)::bigint`,
    })
    .from(orders)
    .where(orderWhere(s))
    .groupBy(month)
    .orderBy(month)

  const expMonth = sql<string>`to_char(${localTs(expenses.date, s.timezone)}, 'YYYY-MM')`
  const exp = await db
    .select({ month: expMonth, amount: sql<number>`coalesce(sum(${expenses.amount}), 0)::bigint` })
    .from(expenses)
    .where(
      and(
        eq(expenses.tenantId, s.tenantId),
        gte(expenses.date, s.from),
        lte(expenses.date, s.to),
        s.branchId ? eq(expenses.branchId, s.branchId) : undefined,
      ),
    )
    .groupBy(expMonth)

  const months = new Set([...sales.map((r) => r.month), ...exp.map((r) => r.month)])
  return [...months].sort().map((m) => {
    const sRow = sales.find((r) => r.month === m)
    const eRow = exp.find((r) => r.month === m)
    const net = n(sRow?.net)
    const cost = n(sRow?.cost)
    const expensesAmount = n(eRow?.amount)
    return { month: m, net, cost, gross: net - cost, expenses: expensesAmount, profit: net - cost - expensesAmount }
  })
}

export async function refundReport(s: ReportScope) {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      amount: sql<number>`coalesce(sum(${refunds.amount}), 0)::bigint`,
    })
    .from(refunds)
    .innerJoin(orders, eq(orders.id, refunds.orderId))
    .where(
      and(
        eq(refunds.tenantId, s.tenantId),
        gte(refunds.createdAt, s.from),
        lte(refunds.createdAt, s.to),
        s.branchId ? eq(orders.branchId, s.branchId) : undefined,
      ),
    )
  return { count: n(row.count), amount: n(row.amount) }
}
