'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, count, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { categories, orderItems, products, PRODUCT_TYPES } from '@/db/schema'
import { toCents } from '@/lib/money'
import { withinLimit } from '@/lib/plans'
import { ActionError, authorize, logActivity, runAction, type ActionResult } from '@/server/action'
import { applyStockChange } from '@/server/inventory'

const money = z.preprocess((v) => toCents(v as string), z.number().int().min(0, 'No puede ser negativo'))
const optionalText = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() ? v.trim() : null),
  z.string().max(500).nullable(),
)
const optionalId = z.preprocess((v) => (v ? v : null), z.string().uuid().nullable())

const productSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  sku: optionalText,
  barcode: optionalText,
  description: optionalText,
  categoryId: optionalId,
  taxId: optionalId,
  type: z.enum(PRODUCT_TYPES),
  unit: z.string().trim().min(1).max(10),
  price: money,
  cost: money,
  trackStock: z.boolean(),
  lowStockThreshold: z.coerce.number().min(0).default(0),
  imageUrl: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim() : null),
    z.string().url('URL inválida').nullable(),
  ),
  isActive: z.boolean(),
  initialStock: z.coerce.number().min(0).default(0),
})

export async function saveProduct(
  slug: string,
  id: string | null,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'products.manage' })
    const input = productSchema.parse({
      ...Object.fromEntries(formData),
      trackStock: formData.get('trackStock') === 'on',
      isActive: formData.get('isActive') === 'on',
    })
    const tenantId = ctx.tenant.id

    if (input.categoryId) {
      const cat = await db.query.categories.findFirst({
        where: and(eq(categories.id, input.categoryId), eq(categories.tenantId, tenantId)),
      })
      if (!cat) throw new ActionError('Categoría inválida.')
    }
    if (input.sku) {
      const dup = await db.query.products.findFirst({
        where: and(
          eq(products.tenantId, tenantId),
          eq(products.sku, input.sku),
          id ? ne(products.id, id) : undefined,
        ),
        columns: { id: true },
      })
      if (dup) throw new ActionError(`Ya existe un producto con el SKU ${input.sku}.`)
    }

    const { initialStock, ...values } = input
    const trackStock = values.type === 'service' ? false : values.trackStock

    if (id) {
      const [row] = await db
        .update(products)
        .set({ ...values, trackStock })
        .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
        .returning({ id: products.id })
      if (!row) throw new ActionError('Producto no encontrado.')
      await logActivity(db, ctx, { action: 'update', entity: 'product', entityId: id, summary: values.name })
      return { id }
    }

    const limit = ctx.plan?.limits.products ?? -1
    const [{ n }] = await db.select({ n: count() }).from(products).where(eq(products.tenantId, tenantId))
    if (!withinLimit(limit, n)) {
      throw new ActionError(`Tu plan permite hasta ${limit} productos. Mejora tu plan para agregar más.`)
    }

    return db.transaction(async (tx) => {
      const [row] = await tx
        .insert(products)
        .values({ ...values, trackStock, tenantId })
        .returning({ id: products.id })
      if (trackStock && initialStock > 0 && ctx.branch) {
        await applyStockChange(tx, {
          tenantId,
          productId: row.id,
          branchId: ctx.branch.id,
          delta: initialStock,
          type: 'initial',
          unitCost: values.cost,
          userId: ctx.user.id,
          note: 'Existencia inicial',
        })
      }
      await logActivity(tx, ctx, { action: 'create', entity: 'product', entityId: row.id, summary: values.name })
      return { id: row.id }
    })
  }, id ? 'Producto actualizado' : 'Producto creado')

  if (result.ok) {
    revalidatePath(`/app/${slug}/products`)
    if (!id && formData.get('_intent') !== 'another') redirect(`/app/${slug}/products`)
  }
  return result
}

export async function deleteProduct(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'products.manage' })
    const product = await db.query.products.findFirst({
      where: and(eq(products.id, id), eq(products.tenantId, ctx.tenant.id)),
    })
    if (!product) throw new ActionError('Producto no encontrado.')
    const [{ n }] = await db.select({ n: count() }).from(orderItems).where(eq(orderItems.productId, id))
    if (n > 0) {
      await db.update(products).set({ isActive: false }).where(eq(products.id, id))
      await logActivity(db, ctx, { action: 'deactivate', entity: 'product', entityId: id, summary: product.name })
      return 'El producto tiene ventas: se desactivó en lugar de eliminarse.'
    }
    await db.delete(products).where(eq(products.id, id))
    await logActivity(db, ctx, { action: 'delete', entity: 'product', entityId: id, summary: product.name })
    return 'Producto eliminado'
  })
  revalidatePath(`/app/${slug}/products`)
  return res.ok ? { ok: true, message: res.data } : res
}

/* ── Categorías ──────────────────────────────────────────────────────── */

const categorySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(60),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Color inválido'),
  sortOrder: z.coerce.number().int().default(0),
})

export async function saveCategory(
  slug: string,
  id: string | null,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'products.manage' })
    const input = categorySchema.parse(Object.fromEntries(formData))
    if (id) {
      await db
        .update(categories)
        .set(input)
        .where(and(eq(categories.id, id), eq(categories.tenantId, ctx.tenant.id)))
    } else {
      await db.insert(categories).values({ ...input, tenantId: ctx.tenant.id })
    }
  }, id ? 'Categoría actualizada' : 'Categoría creada')
  revalidatePath(`/app/${slug}/categories`)
  return res
}

export async function deleteCategory(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'products.manage' })
    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.tenantId, ctx.tenant.id)))
  }, 'Categoría eliminada')
  revalidatePath(`/app/${slug}/categories`)
  return res
}
