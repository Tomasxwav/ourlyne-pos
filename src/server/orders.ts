import 'server-only'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import {
  coupons,
  customers,
  orderItems,
  orderPayments,
  orders,
  paymentMethods,
  products,
  refunds,
  ORDER_TYPES,
} from '@/db/schema'
import { computeTotals, type OrderDiscount } from '@/lib/pricing'
import { ActionError, logActivity } from './action'
import { nextNumber } from './counters'
import { applyStockChange } from './inventory'
import { getActiveRegister } from './registers'
import type { TenantContext } from './tenant'

/* ── Cupones ──────────────────────────────────────────────────────────── */

export async function resolveCoupon(tenantId: string, code: string, netAmount: number) {
  const coupon = await db.query.coupons.findFirst({
    where: and(eq(coupons.tenantId, tenantId), eq(coupons.code, code.trim().toUpperCase())),
  })
  if (!coupon || !coupon.isActive) throw new ActionError('Cupón no válido.')
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new ActionError('El cupón expiró.')
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    throw new ActionError('El cupón alcanzó su límite de usos.')
  if (netAmount < coupon.minTotal) throw new ActionError('La compra no alcanza el mínimo del cupón.')
  const discount: OrderDiscount = { type: coupon.type, value: coupon.value }
  return { coupon, discount }
}

/* ── Crear venta ──────────────────────────────────────────────────────── */

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive().max(100000),
        discount: z.number().int().min(0).default(0),
      }),
    )
    .min(1, 'Agrega al menos un producto.'),
  customerId: z.string().uuid().nullable().optional(),
  type: z.enum(ORDER_TYPES).default('takeaway'),
  couponCode: z.string().trim().max(40).nullable().optional(),
  discount: z
    .object({ type: z.enum(['percent', 'fixed']), value: z.number().int().min(0) })
    .nullable()
    .optional(),
  payments: z
    .array(
      z.object({
        methodId: z.string().uuid(),
        amount: z.number().int().positive(),
        reference: z.string().max(80).nullable().optional(),
      }),
    )
    .min(1, 'Registra al menos un pago.'),
  notes: z.string().max(500).nullable().optional(),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>

export async function createOrder(ctx: TenantContext, raw: CheckoutInput) {
  const input = checkoutSchema.parse(raw)
  const tenantId = ctx.tenant.id
  const branch = ctx.branch
  if (!branch) throw new ActionError('No hay una sucursal activa.')

  const hasDiscounts = input.items.some((i) => i.discount > 0) || (input.discount && input.discount.value > 0)
  if (hasDiscounts && !ctx.can('pos.discount')) throw new ActionError('No tienes permiso para aplicar descuentos.')
  if (input.couponCode && input.discount?.value) throw new ActionError('No se puede combinar cupón y descuento manual.')

  let sessionId: string | null = null
  if (ctx.hasModule('registers')) {
    const { session } = await getActiveRegister(ctx)
    if (!session) throw new ActionError('Abre una caja antes de vender.')
    sessionId = session.id
  }

  const ids = [...new Set(input.items.map((i) => i.productId))]
  const productRows = await db.query.products.findMany({
    where: and(eq(products.tenantId, tenantId), inArray(products.id, ids)),
    with: { tax: true },
  })
  const byId = new Map(productRows.map((p) => [p.id, p]))
  for (const item of input.items) {
    const p = byId.get(item.productId)
    if (!p || !p.isActive) throw new ActionError('Uno de los productos ya no está disponible.')
    if (p.unit === 'pz' && !Number.isInteger(item.quantity))
      throw new ActionError(`"${p.name}" se vende por pieza: usa cantidades enteras.`)
  }

  const lines = input.items.map((i) => {
    const p = byId.get(i.productId)!
    return { product: p, quantity: i.quantity, discount: i.discount, taxRateBps: p.tax?.rateBps ?? 0 }
  })
  const pricingLines = lines.map((l) => ({
    unitPrice: l.product.price,
    quantity: l.quantity,
    discount: l.discount,
    taxRateBps: l.taxRateBps,
  }))
  const preTotals = computeTotals(pricingLines, { pricesIncludeTax: ctx.tenant.pricesIncludeTax })

  let discount: OrderDiscount | null = input.discount?.value ? input.discount : null
  let couponId: string | null = null
  if (input.couponCode) {
    if (!ctx.hasModule('coupons')) throw new ActionError('El módulo de cupones no está activo.')
    const resolved = await resolveCoupon(tenantId, input.couponCode, preTotals.subtotal - preTotals.lineDiscounts)
    discount = resolved.discount
    couponId = resolved.coupon.id
  }
  const totals = computeTotals(pricingLines, { pricesIncludeTax: ctx.tenant.pricesIncludeTax, discount })

  // Pagos
  const methodRows = await db.query.paymentMethods.findMany({
    where: and(eq(paymentMethods.tenantId, tenantId), eq(paymentMethods.isActive, true)),
  })
  const methodById = new Map(methodRows.map((m) => [m.id, m]))
  const payments = input.payments.map((p) => {
    const method = methodById.get(p.methodId)
    if (!method) throw new ActionError('Método de pago inválido.')
    return { ...p, method }
  })
  const tendered = payments.reduce((a, p) => a + p.amount, 0)
  const nonCash = payments.filter((p) => p.method.type !== 'cash').reduce((a, p) => a + p.amount, 0)
  if (tendered < totals.total) throw new ActionError('El pago no cubre el total de la venta.')
  if (nonCash > totals.total) throw new ActionError('Los pagos que no son en efectivo exceden el total.')
  const change = tendered - totals.total

  const creditAmount = payments.filter((p) => p.method.type === 'credit').reduce((a, p) => a + p.amount, 0)
  let customer = null
  if (input.customerId) {
    if (!ctx.hasModule('customers')) throw new ActionError('El módulo de clientes no está activo.')
    customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, input.customerId), eq(customers.tenantId, tenantId)),
    })
    if (!customer) throw new ActionError('Cliente no encontrado.')
  }
  if (creditAmount > 0) {
    if (!customer) throw new ActionError('Selecciona un cliente para vender a crédito.')
    const available = customer.creditLimit - customer.balance
    if (creditAmount > available)
      throw new ActionError(`Crédito insuficiente. Disponible: $${(available / 100).toFixed(2)}.`)
  }

  // Asigna el cambio al efectivo: el importe aplicado de cada pago suma exactamente el total.
  let remainingChange = change
  const applied = payments.map((p) => {
    if (p.method.type === 'cash' && remainingChange > 0) {
      const reduce = Math.min(p.amount, remainingChange)
      remainingChange -= reduce
      return { ...p, applied: p.amount - reduce }
    }
    return { ...p, applied: p.amount }
  })

  const costTotal = lines.reduce((a, l) => a + Math.round(l.product.cost * l.quantity), 0)

  return db.transaction(async (tx) => {
    const number = await nextNumber(tx, tenantId, 'order')
    const [order] = await tx
      .insert(orders)
      .values({
        tenantId,
        branchId: branch.id,
        registerSessionId: sessionId,
        customerId: customer?.id ?? null,
        cashierId: ctx.user.id,
        couponId,
        number,
        type: input.type,
        status: 'completed',
        paymentStatus: creditAmount > 0 ? (creditAmount >= totals.total ? 'unpaid' : 'partial') : 'paid',
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        costTotal,
        paidTotal: tendered,
        changeDue: change,
        notes: input.notes ?? null,
      })
      .returning()

    await tx.insert(orderItems).values(
      lines.map((l, i) => ({
        tenantId,
        orderId: order.id,
        productId: l.product.id,
        name: l.product.name,
        sku: l.product.sku,
        quantity: l.quantity,
        unitPrice: l.product.price,
        unitCost: l.product.cost,
        discount: totals.lines[i].discount + totals.lines[i].orderDiscountShare,
        taxRateBps: l.taxRateBps,
        taxAmount: totals.lines[i].tax,
        total: totals.lines[i].total,
      })),
    )

    await tx.insert(orderPayments).values(
      applied
        .filter((p) => p.applied > 0)
        .map((p) => ({
          tenantId,
          orderId: order.id,
          paymentMethodId: p.method.id,
          methodName: p.method.name,
          methodType: p.method.type,
          amount: p.applied,
          reference: p.reference ?? null,
        })),
    )

    if (ctx.hasModule('inventory')) {
      for (const l of lines) {
        if (!l.product.trackStock) continue
        await applyStockChange(tx, {
          tenantId,
          productId: l.product.id,
          branchId: branch.id,
          delta: -l.quantity,
          type: 'sale',
          unitCost: l.product.cost,
          referenceType: 'order',
          referenceId: order.id,
          userId: ctx.user.id,
          allowNegative: ctx.tenant.allowNegativeStock,
          productName: l.product.name,
        })
      }
    }

    if (customer) {
      await tx
        .update(customers)
        .set({
          totalSpent: sql`${customers.totalSpent} + ${totals.total}`,
          ordersCount: sql`${customers.ordersCount} + 1`,
          lastPurchaseAt: new Date(),
          loyaltyPoints: sql`${customers.loyaltyPoints} + ${Math.floor(totals.total / 1000)}`,
          balance: sql`${customers.balance} + ${creditAmount}`,
        })
        .where(eq(customers.id, customer.id))
    }

    if (couponId) {
      await tx
        .update(coupons)
        .set({ usedCount: sql`${coupons.usedCount} + 1` })
        .where(eq(coupons.id, couponId))
    }

    return { id: order.id, number: order.number, total: order.total, change }
  })
}

/* ── Devoluciones y cancelaciones ─────────────────────────────────────── */

export const refundSchema = z.object({
  items: z.array(z.object({ itemId: z.string().uuid(), quantity: z.number().positive() })).min(1),
  reason: z.string().trim().max(300).optional(),
  restock: z.boolean().default(true),
  methodType: z.enum(['cash', 'card', 'transfer', 'credit', 'other']).default('cash'),
})

export async function refundOrder(ctx: TenantContext, orderId: string, raw: z.infer<typeof refundSchema>) {
  const input = refundSchema.parse(raw)
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.tenantId, ctx.tenant.id)),
    with: { items: { with: { product: true } } },
  })
  if (!order) throw new ActionError('Venta no encontrada.')
  if (order.status === 'voided' || order.status === 'refunded') throw new ActionError('La venta ya fue cancelada o devuelta.')

  let sessionId: string | null = null
  if (ctx.hasModule('registers')) {
    const { session } = await getActiveRegister(ctx)
    if (input.methodType === 'cash' && !session) throw new ActionError('Abre una caja para devolver efectivo.')
    sessionId = session?.id ?? null
  }

  const itemById = new Map(order.items.map((i) => [i.id, i]))
  let amount = 0
  const plan = input.items.map((r) => {
    const item = itemById.get(r.itemId)
    if (!item) throw new ActionError('Partida inválida.')
    const available = item.quantity - item.refundedQuantity
    if (r.quantity > available + 1e-9) throw new ActionError(`Solo puedes devolver ${available} de "${item.name}".`)
    const lineAmount = Math.round((item.total / item.quantity) * r.quantity)
    amount += lineAmount
    return { item, quantity: r.quantity }
  })
  amount = Math.min(amount, order.total - order.refundedTotal)

  return db.transaction(async (tx) => {
    const [refund] = await tx
      .insert(refunds)
      .values({
        tenantId: ctx.tenant.id,
        orderId,
        registerSessionId: sessionId,
        amount,
        methodType: input.methodType,
        reason: input.reason,
        restock: input.restock,
        userId: ctx.user.id,
      })
      .returning()

    for (const { item, quantity } of plan) {
      await tx
        .update(orderItems)
        .set({ refundedQuantity: sql`${orderItems.refundedQuantity} + ${quantity}` })
        .where(eq(orderItems.id, item.id))
      if (input.restock && item.product?.trackStock && ctx.hasModule('inventory')) {
        await applyStockChange(tx, {
          tenantId: ctx.tenant.id,
          productId: item.product.id,
          branchId: order.branchId,
          delta: quantity,
          type: 'refund',
          referenceType: 'refund',
          referenceId: refund.id,
          userId: ctx.user.id,
          note: `Devolución venta #${order.number}`,
        })
      }
    }

    const refundedTotal = order.refundedTotal + amount
    const fully = order.items.every((i) => {
      const extra = plan.find((p) => p.item.id === i.id)?.quantity ?? 0
      return i.refundedQuantity + extra >= i.quantity - 1e-9
    })
    await tx
      .update(orders)
      .set({ refundedTotal, status: fully ? 'refunded' : 'partially_refunded' })
      .where(eq(orders.id, orderId))

    if (order.customerId) {
      await tx
        .update(customers)
        .set({
          totalSpent: sql`greatest(${customers.totalSpent} - ${amount}, 0)`,
          balance:
            input.methodType === 'credit'
              ? sql`greatest(${customers.balance} - ${amount}, 0)`
              : customers.balance,
        })
        .where(eq(customers.id, order.customerId))
    }

    await logActivity(tx, ctx, {
      action: 'refund',
      entity: 'order',
      entityId: orderId,
      summary: `Devolución de $${(amount / 100).toFixed(2)} en venta #${order.number}`,
    })
    return { amount }
  })
}

/** Cancela una venta completa: devuelve inventario y revierte saldos. */
export async function voidOrder(ctx: TenantContext, orderId: string, reason?: string) {
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.tenantId, ctx.tenant.id)),
    with: { items: { with: { product: true } }, payments: true },
  })
  if (!order) throw new ActionError('Venta no encontrada.')
  if (order.status !== 'completed') throw new ActionError('Solo se pueden cancelar ventas sin devoluciones.')

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: 'voided', notes: reason ? `${order.notes ?? ''}\nCancelada: ${reason}`.trim() : order.notes })
      .where(eq(orders.id, orderId))
    if (ctx.hasModule('inventory')) {
      for (const item of order.items) {
        if (!item.product?.trackStock) continue
        await applyStockChange(tx, {
          tenantId: ctx.tenant.id,
          productId: item.product.id,
          branchId: order.branchId,
          delta: item.quantity,
          type: 'refund',
          referenceType: 'void',
          referenceId: order.id,
          userId: ctx.user.id,
          note: `Cancelación venta #${order.number}`,
        })
      }
    }
    if (order.customerId) {
      const credit = order.payments.filter((p) => p.methodType === 'credit').reduce((a, p) => a + p.amount, 0)
      await tx
        .update(customers)
        .set({
          totalSpent: sql`greatest(${customers.totalSpent} - ${order.total}, 0)`,
          ordersCount: sql`greatest(${customers.ordersCount} - 1, 0)`,
          balance: sql`greatest(${customers.balance} - ${credit}, 0)`,
        })
        .where(eq(customers.id, order.customerId))
    }
    if (order.couponId) {
      await tx
        .update(coupons)
        .set({ usedCount: sql`greatest(${coupons.usedCount} - 1, 0)` })
        .where(eq(coupons.id, order.couponId))
    }
    await logActivity(tx, ctx, {
      action: 'void',
      entity: 'order',
      entityId: orderId,
      summary: `Venta #${order.number} cancelada${reason ? `: ${reason}` : ''}`,
    })
  })
}
