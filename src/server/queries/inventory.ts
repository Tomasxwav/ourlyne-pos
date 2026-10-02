import 'server-only'
import { and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { products, stockLevels } from '@/db/schema'

export type PickerProduct = {
  id: string
  name: string
  sku: string | null
  unit: string
  cost: number
  trackStock: boolean
  stock: number
}

/** Búsqueda de productos (nombre, SKU o código de barras) con su existencia en una sucursal. */
export async function searchProducts(
  tenantId: string,
  branchId: string | undefined,
  q: string,
  opts: { onlyTracked?: boolean; limit?: number } = {},
): Promise<PickerProduct[]> {
  const term = q.trim()
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      unit: products.unit,
      cost: products.cost,
      trackStock: products.trackStock,
      stock: stockLevels.quantity,
    })
    .from(products)
    .leftJoin(
      stockLevels,
      and(eq(stockLevels.productId, products.id), eq(stockLevels.branchId, branchId ?? sql`null`)),
    )
    .where(
      and(
        eq(products.tenantId, tenantId),
        eq(products.isActive, true),
        eq(products.type, 'product'),
        opts.onlyTracked ? eq(products.trackStock, true) : undefined,
        term
          ? or(
              ilike(products.name, `%${term}%`),
              ilike(products.sku, `%${term}%`),
              eq(products.barcode, term),
            )
          : undefined,
      ),
    )
    .orderBy(asc(products.name))
    .limit(opts.limit ?? 12)
  return rows.map((r) => ({ ...r, stock: Number(r.stock ?? 0) }))
}

/** Existencias de varios productos en una sucursal → { productId: cantidad }. */
export async function stockByProduct(tenantId: string, branchId: string, productIds: string[]) {
  if (!productIds.length) return {}
  const rows = await db
    .select({ productId: stockLevels.productId, quantity: stockLevels.quantity })
    .from(stockLevels)
    .where(
      and(
        eq(stockLevels.tenantId, tenantId),
        eq(stockLevels.branchId, branchId),
        inArray(stockLevels.productId, productIds),
      ),
    )
  return Object.fromEntries(rows.map((r) => [r.productId, Number(r.quantity)])) as Record<string, number>
}

/** Totales del inventario de una sucursal (productos activos que controlan existencia). */
export async function getInventorySummary(tenantId: string, branchId: string) {
  const qty = sql`coalesce(${stockLevels.quantity}, 0)`
  const [row] = await db
    .select({
      products: sql<number>`count(*)::int`,
      value: sql<number>`coalesce(sum(greatest(${qty}, 0) * ${products.cost}), 0)::bigint`,
      units: sql<number>`coalesce(sum(greatest(${qty}, 0)), 0)::float8`,
      low: sql<number>`count(*) filter (where ${qty} <= ${products.lowStockThreshold})::int`,
      out: sql<number>`count(*) filter (where ${qty} <= 0)::int`,
    })
    .from(products)
    .leftJoin(stockLevels, and(eq(stockLevels.productId, products.id), eq(stockLevels.branchId, branchId)))
    .where(and(eq(products.tenantId, tenantId), eq(products.trackStock, true), eq(products.isActive, true)))
  return {
    products: Number(row.products),
    value: Number(row.value),
    units: Number(row.units),
    low: Number(row.low),
    out: Number(row.out),
  }
}
