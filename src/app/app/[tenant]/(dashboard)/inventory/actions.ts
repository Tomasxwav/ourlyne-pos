'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { branches, products, stockLevels } from '@/db/schema'
import { formatQty } from '@/lib/money'
import { ActionError, authorize, logActivity, runAction, type ActionResult } from '@/server/action'
import { applyStockChange } from '@/server/inventory'
import { searchProducts, stockByProduct, type PickerProduct } from '@/server/queries/inventory'
import { ADJUST_MODE_UI, ADJUST_MODES } from './labels'

const uuid = z.string().uuid('Identificador inválido')

function revalidateInventory(slug: string) {
  revalidatePath(`/app/${slug}/inventory`)
  revalidatePath(`/app/${slug}/inventory/movements`)
  revalidatePath(`/app/${slug}/inventory/transfers`)
  revalidatePath(`/app/${slug}/products`)
}

/* ── Ajustes ─────────────────────────────────────────────────────────── */

const adjustSchema = z
  .object({
    productId: uuid,
    mode: z.enum(ADJUST_MODES, 'Selecciona el tipo de ajuste'),
    quantity: z.coerce
      .number('Captura una cantidad')
      .min(0, 'No puede ser negativa')
      .max(1_000_000, 'Cantidad demasiado grande'),
    note: z.string().trim().min(3, 'Indica el motivo del ajuste').max(300),
  })
  .refine((v) => v.mode === 'count' || v.quantity > 0, {
    path: ['quantity'],
    message: 'La cantidad debe ser mayor a cero',
  })

export async function adjustStock(
  slug: string,
  _prev: ActionResult<{ balance: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ balance: number }>> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'inventory.adjust', module: 'inventory' })
    if (!ctx.branch) throw new ActionError('No hay una sucursal activa.')
    const branchId = ctx.branch.id
    const input = adjustSchema.parse(Object.fromEntries(formData))
    const quantity = Math.round(input.quantity * 1000) / 1000

    return db.transaction(async (tx) => {
      const product = await tx.query.products.findFirst({
        where: and(eq(products.id, input.productId), eq(products.tenantId, ctx.tenant.id)),
      })
      if (!product) throw new ActionError('Producto no encontrado.')
      if (!product.trackStock) throw new ActionError('Este producto no controla existencias.')

      // Bloquea la fila de existencia para que el conteo sea consistente.
      const [level] = await tx
        .select({ quantity: stockLevels.quantity })
        .from(stockLevels)
        .where(and(eq(stockLevels.productId, product.id), eq(stockLevels.branchId, branchId)))
        .for('update')
      const current = Number(level?.quantity ?? 0)

      const delta =
        input.mode === 'in'
          ? quantity
          : input.mode === 'count'
            ? Math.round((quantity - current) * 1000) / 1000
            : -quantity
      if (!delta) throw new ActionError('Sin diferencias: la existencia ya coincide con el conteo.')

      const label = ADJUST_MODE_UI[input.mode].label
      const note =
        input.mode === 'count'
          ? `${label}: ${formatQty(quantity)} (sistema ${formatQty(current)}) · ${input.note}`
          : `${label} · ${input.note}`

      const balance = await applyStockChange(tx, {
        tenantId: ctx.tenant.id,
        productId: product.id,
        branchId,
        delta,
        type: input.mode === 'waste' ? 'waste' : 'adjustment',
        unitCost: product.cost,
        userId: ctx.user.id,
        note,
        allowNegative: delta > 0 ? true : ctx.tenant.allowNegativeStock,
        productName: product.name,
      })
      await logActivity(tx, ctx, {
        action: input.mode === 'waste' ? 'waste' : 'adjust',
        entity: 'stock',
        entityId: product.id,
        summary: `${label} ${delta > 0 ? '+' : ''}${formatQty(delta)} ${product.name} (${ctx.branch!.name})`,
        meta: { branchId, delta, mode: input.mode, note: input.note },
      })
      return { balance: balance ?? current }
    })
  }, 'Existencia actualizada')
  if (res.ok) revalidateInventory(slug)
  return res
}

/* ── Traspasos ───────────────────────────────────────────────────────── */

const transferSchema = z
  .object({
    fromBranchId: uuid,
    toBranchId: uuid,
    note: z
      .string()
      .trim()
      .max(300)
      .optional()
      .transform((v) => v || undefined),
    lines: z
      .array(
        z.object({
          productId: uuid,
          quantity: z.coerce.number().positive('La cantidad debe ser mayor a cero').max(1_000_000),
        }),
      )
      .min(1, 'Agrega al menos un producto')
      .max(200),
  })
  .refine((v) => v.fromBranchId !== v.toBranchId, {
    path: ['toBranchId'],
    message: 'El origen y el destino deben ser distintos',
  })

export type TransferInput = z.input<typeof transferSchema>

export async function transferStock(
  slug: string,
  raw: TransferInput,
): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'inventory.adjust', module: 'inventory' })
    const input = transferSchema.parse(raw)
    const tenantId = ctx.tenant.id

    // Suma líneas repetidas del mismo producto.
    const lines = new Map<string, number>()
    for (const l of input.lines) lines.set(l.productId, Math.round(((lines.get(l.productId) ?? 0) + l.quantity) * 1000) / 1000)

    const branchRows = await db.query.branches.findMany({
      where: and(
        eq(branches.tenantId, tenantId),
        eq(branches.isActive, true),
        inArray(branches.id, [input.fromBranchId, input.toBranchId]),
      ),
    })
    const from = branchRows.find((b) => b.id === input.fromBranchId)
    const to = branchRows.find((b) => b.id === input.toBranchId)
    if (!from || !to) throw new ActionError('Sucursal inválida.')

    const productRows = await db.query.products.findMany({
      where: and(eq(products.tenantId, tenantId), inArray(products.id, [...lines.keys()])),
    })
    if (productRows.length !== lines.size) throw new ActionError('Hay productos inválidos en el traspaso.')
    const untracked = productRows.find((p) => !p.trackStock)
    if (untracked) throw new ActionError(`"${untracked.name}" no controla existencias.`)

    const transferId = crypto.randomUUID()
    const note = input.note ? `${from.name} → ${to.name} · ${input.note}` : `${from.name} → ${to.name}`

    await db.transaction(async (tx) => {
      for (const p of productRows) {
        const qty = lines.get(p.id)!
        const common = {
          tenantId,
          productId: p.id,
          unitCost: p.cost,
          userId: ctx.user.id,
          referenceType: 'transfer',
          referenceId: transferId,
          note,
          productName: p.name,
        }
        await applyStockChange(tx, {
          ...common,
          branchId: from.id,
          delta: -qty,
          type: 'transfer_out',
          allowNegative: ctx.tenant.allowNegativeStock,
        })
        await applyStockChange(tx, { ...common, branchId: to.id, delta: qty, type: 'transfer_in' })
      }
      await logActivity(tx, ctx, {
        action: 'transfer',
        entity: 'stock',
        entityId: transferId,
        summary: `Traspaso ${from.name} → ${to.name} (${productRows.length} productos)`,
        meta: { from: from.id, to: to.id, lines: Object.fromEntries(lines), note: input.note },
      })
    })
    return { id: transferId }
  }, 'Traspaso registrado')
  if (res.ok) revalidateInventory(slug)
  return res
}

/* ── Selector de productos ───────────────────────────────────────────── */

export async function searchInventoryProducts(
  slug: string,
  q: string,
  branchId?: string,
): Promise<PickerProduct[]> {
  const ctx = await authorize(slug, { permission: 'inventory.adjust', module: 'inventory', allowInactive: true })
  const branch = branchId ? ctx.branches.find((b) => b.id === branchId) : ctx.branch
  return searchProducts(ctx.tenant.id, branch?.id, String(q ?? '').slice(0, 80), { onlyTracked: true })
}

export async function getBranchStock(
  slug: string,
  branchId: string,
  productIds: string[],
): Promise<Record<string, number>> {
  const ctx = await authorize(slug, { permission: 'inventory.adjust', module: 'inventory', allowInactive: true })
  const branch = ctx.branches.find((b) => b.id === branchId)
  if (!branch) return {}
  const ids = z.array(uuid).max(200).safeParse(productIds)
  return ids.success ? stockByProduct(ctx.tenant.id, branch.id, ids.data) : {}
}
