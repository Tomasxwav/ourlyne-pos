import 'server-only'
import { cookies } from 'next/headers'
import { and, eq, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/db'
import {
  cashMovements,
  customerPayments,
  orderPayments,
  orders,
  refunds,
  registers,
  registerSessions,
} from '@/db/schema'
import type { TenantContext } from './tenant'

export const REGISTER_COOKIE = 'ol_register'

export async function getOpenSessionForRegister(tx: DbOrTx, registerId: string) {
  return tx.query.registerSessions.findFirst({
    where: and(eq(registerSessions.registerId, registerId), eq(registerSessions.status, 'open')),
    with: { openedBy: { columns: { name: true } } },
  })
}

/** Caja seleccionada por el usuario en la sucursal activa (cookie) y su sesión abierta. */
export async function getActiveRegister(ctx: TenantContext) {
  if (!ctx.branch) return { register: null, session: null }
  const store = await cookies()
  const registerId = store.get(`${REGISTER_COOKIE}_${ctx.tenant.id}`)?.value
  if (!registerId) return { register: null, session: null }
  const register = await db.query.registers.findFirst({
    where: and(
      eq(registers.id, registerId),
      eq(registers.tenantId, ctx.tenant.id),
      eq(registers.branchId, ctx.branch.id),
      eq(registers.isActive, true),
    ),
  })
  if (!register) return { register: null, session: null }
  const session = await getOpenSessionForRegister(db, register.id)
  return { register, session: session ?? null }
}

export type SessionSummary = Awaited<ReturnType<typeof getSessionSummary>>

/** Arqueo de una sesión de caja: ventas por método, efectivo esperado, etc. */
export async function getSessionSummary(tx: DbOrTx, sessionId: string) {
  const session = await tx.query.registerSessions.findFirst({
    where: eq(registerSessions.id, sessionId),
    with: {
      register: { with: { branch: true } },
      openedBy: { columns: { name: true } },
      closedBy: { columns: { name: true } },
      cashMovements: { with: { user: { columns: { name: true } } } },
    },
  })
  if (!session) return null

  const byMethod = await tx
    .select({
      methodName: orderPayments.methodName,
      methodType: orderPayments.methodType,
      amount: sql<number>`coalesce(sum(${orderPayments.amount}), 0)::int`,
      count: sql<number>`count(distinct ${orderPayments.orderId})::int`,
    })
    .from(orderPayments)
    .innerJoin(orders, eq(orders.id, orderPayments.orderId))
    .where(and(eq(orders.registerSessionId, sessionId), sql`${orders.status} <> 'voided'`))
    .groupBy(orderPayments.methodName, orderPayments.methodType)

  const [orderTotals] = await tx
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${orders.total}), 0)::int`,
      tax: sql<number>`coalesce(sum(${orders.taxTotal}), 0)::int`,
      discount: sql<number>`coalesce(sum(${orders.discountTotal}), 0)::int`,
    })
    .from(orders)
    .where(and(eq(orders.registerSessionId, sessionId), sql`${orders.status} <> 'voided'`))

  const [refundTotals] = await tx
    .select({
      total: sql<number>`coalesce(sum(${refunds.amount}), 0)::int`,
      cash: sql<number>`coalesce(sum(case when ${refunds.methodType} = 'cash' then ${refunds.amount} else 0 end), 0)::int`,
    })
    .from(refunds)
    .where(eq(refunds.registerSessionId, sessionId))

  const [abonos] = await tx
    .select({
      cash: sql<number>`coalesce(sum(case when ${customerPayments.methodType} = 'cash' then ${customerPayments.amount} else 0 end), 0)::int`,
      total: sql<number>`coalesce(sum(${customerPayments.amount}), 0)::int`,
    })
    .from(customerPayments)
    .where(eq(customerPayments.registerSessionId, sessionId))

  const [cash] = await tx
    .select({
      in: sql<number>`coalesce(sum(case when ${cashMovements.type} = 'in' then ${cashMovements.amount} else 0 end), 0)::int`,
      out: sql<number>`coalesce(sum(case when ${cashMovements.type} = 'out' then ${cashMovements.amount} else 0 end), 0)::int`,
    })
    .from(cashMovements)
    .where(eq(cashMovements.sessionId, sessionId))

  const cashSales = byMethod.filter((m) => m.methodType === 'cash').reduce((a, m) => a + m.amount, 0)
  const expected =
    session.openingAmount + cashSales - refundTotals.cash + abonos.cash + cash.in - cash.out

  return {
    session,
    byMethod,
    orders: orderTotals,
    refunds: refundTotals,
    customerPayments: abonos,
    cashIn: cash.in,
    cashOut: cash.out,
    cashSales,
    expected,
  }
}
