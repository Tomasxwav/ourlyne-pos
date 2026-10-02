import 'server-only'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { branches, products, purchaseItems, purchases, suppliers } from '@/db/schema'
import { folio, formatMoney, toCents } from '@/lib/money'
import { ActionError, logActivity } from './action'
import { nextNumber } from './counters'
import { applyStockChange } from './inventory'
import type { TenantContext } from './tenant'

/* ── Validación ──────────────────────────────────────────────────────── */

const uuid = z.string().uuid('Identificador inválido')

export const purchaseSchema = z.object({
  supplierId: z.preprocess((v) => (v ? v : null), uuid.nullable()),
  branchId: uuid,
  expectedAt: z.preprocess(
    (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : null),
    z.date().nullable(),
  ),
  notes: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim() : null),
    z.string().max(1000).nullable(),
  ),
  status: z.enum(['draft', 'ordered']),
  items: z
    .array(
      z.object({
        productId: uuid,
        quantity: z.coerce.number().positive('La cantidad debe ser mayor a cero').max(1_000_000),
        /** Costo unitario en pesos (texto o número); se convierte a centavos. */
        unitCost: z.preprocess(
          (v) => toCents(v as string),
          z.number().int().min(0, 'El costo no puede ser negativo').max(1_000_000_000),
        ),
      }),
    )
    .min(1, 'Agrega al menos un producto')
    .max(200, 'Demasiados renglones'),
})

export type PurchaseInput = z.input<typeof purchaseSchema>

function paymentStatusFor(total: number, paid: number) {
  if (paid <= 0) return 'unpaid' as const
  return paid >= total ? ('paid' as const) : ('partial' as const)
}

/* ── Guardar (crear / editar) ────────────────────────────────────────── */

export async function savePurchase(ctx: TenantContext, id: string | null, raw: PurchaseInput) {
  const input = purchaseSchema.parse(raw)
  const tenantId = ctx.tenant.id

  const branch = await db.query.branches.findFirst({
    where: and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId)),
  })
  if (!branch) throw new ActionError('Sucursal inválida.')

  if (input.supplierId) {
    const supplier = await db.query.suppliers.findFirst({
      where: and(eq(suppliers.id, input.supplierId), eq(suppliers.tenantId, tenantId)),
      columns: { id: true },
    })
    if (!supplier) throw new ActionError('Proveedor inválido.')
  }

  const ids = [...new Set(input.items.map((i) => i.productId))]
  const productRows = await db.query.products.findMany({
    where: and(eq(products.tenantId, tenantId), inArray(products.id, ids)),
    columns: { id: true, name: true, type: true },
  })
  if (productRows.length !== ids.length) throw new ActionError('Hay productos inválidos en la compra.')
  const byId = new Map(productRows.map((p) => [p.id, p]))

  // Totales siempre calculados en el servidor.
  const items = input.items.map((i) => {
    const quantity = Math.round(i.quantity * 1000) / 1000
    return {
      tenantId,
      productId: i.productId,
      name: byId.get(i.productId)!.name,
      quantity,
      unitCost: i.unitCost,
      total: Math.round(quantity * i.unitCost),
    }
  })
  const subtotal = items.reduce((a, i) => a + i.total, 0)
  const values = {
    branchId: branch.id,
    supplierId: input.supplierId,
    expectedAt: input.expectedAt,
    notes: input.notes,
    subtotal,
    taxTotal: 0,
    total: subtotal,
  }

  return db.transaction(async (tx) => {
    if (id) {
      const [current] = await tx
        .select()
        .from(purchases)
        .where(and(eq(purchases.id, id), eq(purchases.tenantId, tenantId)))
        .for('update')
      if (!current) throw new ActionError('Compra no encontrada.')
      if (current.status === 'received' || current.status === 'cancelled') {
        throw new ActionError('Solo se pueden editar compras en borrador u ordenadas.')
      }
      if (current.paidTotal > subtotal) {
        throw new ActionError(
          `El total no puede ser menor a lo ya pagado (${formatMoney(current.paidTotal, ctx.tenant.currency)}).`,
        )
      }
      // Una orden ya emitida no regresa a borrador.
      const status = current.status === 'ordered' ? 'ordered' : input.status
      await tx
        .update(purchases)
        .set({ ...values, status, paymentStatus: paymentStatusFor(subtotal, current.paidTotal) })
        .where(eq(purchases.id, id))
      await tx.delete(purchaseItems).where(and(eq(purchaseItems.purchaseId, id), eq(purchaseItems.tenantId, tenantId)))
      await tx.insert(purchaseItems).values(items.map((i) => ({ ...i, purchaseId: id })))
      await logActivity(tx, ctx, {
        action: 'update',
        entity: 'purchase',
        entityId: id,
        summary: `${folio('OC', current.number)} · ${formatMoney(subtotal, ctx.tenant.currency)}`,
      })
      return { id, number: current.number }
    }

    const number = await nextNumber(tx, tenantId, 'purchase')
    const [row] = await tx
      .insert(purchases)
      .values({ ...values, tenantId, number, status: input.status, createdById: ctx.user.id })
      .returning({ id: purchases.id })
    await tx.insert(purchaseItems).values(items.map((i) => ({ ...i, purchaseId: row.id })))
    await logActivity(tx, ctx, {
      action: 'create',
      entity: 'purchase',
      entityId: row.id,
      summary: `${folio('OC', number)} · ${formatMoney(subtotal, ctx.tenant.currency)}`,
    })
    return { id: row.id, number }
  })
}

/* ── Cambios de estado ───────────────────────────────────────────────── */

export async function markOrdered(ctx: TenantContext, id: string) {
  const [row] = await db
    .update(purchases)
    .set({ status: 'ordered' })
    .where(and(eq(purchases.id, id), eq(purchases.tenantId, ctx.tenant.id), eq(purchases.status, 'draft')))
    .returning({ number: purchases.number })
  if (!row) throw new ActionError('La compra no está en borrador.')
  await logActivity(db, ctx, { action: 'order', entity: 'purchase', entityId: id, summary: folio('OC', row.number) })
}

/** Recibe la mercancía: suma existencias en la sucursal de la compra y actualiza el costo de cada producto. */
export async function receivePurchase(ctx: TenantContext, id: string) {
  const tenantId = ctx.tenant.id
  return db.transaction(async (tx) => {
    const [purchase] = await tx
      .update(purchases)
      .set({ status: 'received', receivedAt: new Date() })
      .where(
        and(
          eq(purchases.id, id),
          eq(purchases.tenantId, tenantId),
          inArray(purchases.status, ['draft', 'ordered']),
        ),
      )
      .returning()
    if (!purchase) throw new ActionError('La compra ya fue recibida o está cancelada.')

    const items = await tx.query.purchaseItems.findMany({
      where: and(eq(purchaseItems.purchaseId, id), eq(purchaseItems.tenantId, tenantId)),
      with: { product: true },
    })
    let received = 0
    for (const item of items) {
      const product = item.product
      if (!product || product.tenantId !== tenantId) continue
      if (product.trackStock && ctx.hasModule('inventory')) {
        await applyStockChange(tx, {
          tenantId,
          productId: product.id,
          branchId: purchase.branchId,
          delta: item.quantity,
          type: 'purchase',
          unitCost: item.unitCost,
          referenceType: 'purchase',
          referenceId: purchase.id,
          userId: ctx.user.id,
          note: `Recepción ${folio('OC', purchase.number)}`,
        })
        received++
      }
      await tx.update(products).set({ cost: item.unitCost }).where(eq(products.id, product.id))
    }
    await logActivity(tx, ctx, {
      action: 'receive',
      entity: 'purchase',
      entityId: id,
      summary: `${folio('OC', purchase.number)} recibida (${received} productos a inventario)`,
    })
    return { received }
  })
}

export async function registerPurchasePayment(ctx: TenantContext, id: string, amountInput: unknown) {
  const amount = z
    .preprocess((v) => toCents(v as string), z.number().int().positive('El importe debe ser mayor a cero'))
    .parse(amountInput)
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(purchases)
      .where(and(eq(purchases.id, id), eq(purchases.tenantId, ctx.tenant.id)))
      .for('update')
    if (!current) throw new ActionError('Compra no encontrada.')
    if (current.status === 'cancelled' || current.status === 'draft') {
      throw new ActionError('Solo se registran pagos en compras ordenadas o recibidas.')
    }
    const pending = current.total - current.paidTotal
    if (pending <= 0) throw new ActionError('La compra ya está pagada.')
    if (amount > pending) {
      throw new ActionError(`El importe excede el saldo pendiente (${formatMoney(pending, ctx.tenant.currency)}).`)
    }
    const paidTotal = current.paidTotal + amount
    await tx
      .update(purchases)
      .set({ paidTotal: sql`${purchases.paidTotal} + ${amount}`, paymentStatus: paymentStatusFor(current.total, paidTotal) })
      .where(eq(purchases.id, id))
    await logActivity(tx, ctx, {
      action: 'payment',
      entity: 'purchase',
      entityId: id,
      summary: `Pago ${formatMoney(amount, ctx.tenant.currency)} a ${folio('OC', current.number)}`,
      meta: { amount, paidTotal },
    })
    return { paidTotal, pending: current.total - paidTotal }
  })
}

export async function cancelPurchase(ctx: TenantContext, id: string) {
  const [row] = await db
    .update(purchases)
    .set({ status: 'cancelled' })
    .where(
      and(eq(purchases.id, id), eq(purchases.tenantId, ctx.tenant.id), inArray(purchases.status, ['draft', 'ordered'])),
    )
    .returning({ number: purchases.number })
  if (!row) throw new ActionError('Solo se pueden cancelar compras que no se han recibido.')
  await logActivity(db, ctx, { action: 'cancel', entity: 'purchase', entityId: id, summary: folio('OC', row.number) })
}
