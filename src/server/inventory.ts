import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import type { DbOrTx } from '@/db'
import { stockLevels, stockMovements, type StockMovementType } from '@/db/schema'
import { ActionError } from './action'

export type StockChange = {
  tenantId: string
  productId: string
  branchId: string
  /** Positivo = entrada, negativo = salida. */
  delta: number
  type: StockMovementType
  userId?: string
  unitCost?: number
  referenceType?: string
  referenceId?: string
  note?: string
  /** Si es false y el resultado queda negativo, lanza error. */
  allowNegative?: boolean
  productName?: string
}

/**
 * Aplica un cambio de existencias de forma atómica (UPSERT) y registra el
 * movimiento en el kardex. Devuelve el saldo resultante.
 */
export async function applyStockChange(tx: DbOrTx, change: StockChange) {
  if (!change.delta) return null
  const [level] = await tx
    .insert(stockLevels)
    .values({
      tenantId: change.tenantId,
      productId: change.productId,
      branchId: change.branchId,
      quantity: change.delta,
    })
    .onConflictDoUpdate({
      target: [stockLevels.productId, stockLevels.branchId],
      set: {
        quantity: sql`${stockLevels.quantity} + ${change.delta}`,
        updatedAt: new Date(),
      },
    })
    .returning({ quantity: stockLevels.quantity })

  const balance = Number(level.quantity)
  if (balance < 0 && change.allowNegative === false) {
    throw new ActionError(
      `Existencia insuficiente${change.productName ? ` de "${change.productName}"` : ''} (quedaría en ${balance}).`,
    )
  }

  await tx.insert(stockMovements).values({
    tenantId: change.tenantId,
    productId: change.productId,
    branchId: change.branchId,
    type: change.type,
    quantity: change.delta,
    balanceAfter: balance,
    unitCost: change.unitCost,
    referenceType: change.referenceType,
    referenceId: change.referenceId,
    note: change.note,
    userId: change.userId,
  })
  return balance
}

export async function getStock(tx: DbOrTx, productId: string, branchId: string) {
  const row = await tx.query.stockLevels.findFirst({
    where: and(eq(stockLevels.productId, productId), eq(stockLevels.branchId, branchId)),
  })
  return Number(row?.quantity ?? 0)
}
