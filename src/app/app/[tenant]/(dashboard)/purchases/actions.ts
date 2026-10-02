'use server'

import { revalidatePath } from 'next/cache'
import { and, count, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { purchases, suppliers } from '@/db/schema'
import { ActionError, authorize, logActivity, runAction, type ActionResult } from '@/server/action'
import {
  cancelPurchase,
  markOrdered,
  receivePurchase,
  registerPurchasePayment,
  savePurchase,
  type PurchaseInput,
} from '@/server/purchases'
import { searchProducts, type PickerProduct } from '@/server/queries/inventory'

const MANAGE = { permission: 'purchases.manage', module: 'purchases' } as const
const uuid = z.string().uuid()

function revalidatePurchases(slug: string, id?: string) {
  revalidatePath(`/app/${slug}/purchases`)
  revalidatePath(`/app/${slug}/purchases/suppliers`)
  if (id) revalidatePath(`/app/${slug}/purchases/${id}`)
}

function revalidateStock(slug: string) {
  revalidatePath(`/app/${slug}/inventory`)
  revalidatePath(`/app/${slug}/inventory/movements`)
  revalidatePath(`/app/${slug}/products`)
}

/* ── Órdenes de compra ───────────────────────────────────────────────── */

export async function savePurchaseAction(
  slug: string,
  id: string | null,
  input: PurchaseInput,
): Promise<ActionResult<{ id: string; number: number }>> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, MANAGE)
    if (id && !uuid.safeParse(id).success) throw new ActionError('Compra no encontrada.')
    return savePurchase(ctx, id, input)
  }, id ? 'Compra actualizada' : input.status === 'ordered' ? 'Orden de compra emitida' : 'Borrador guardado')
  if (res.ok) revalidatePurchases(slug, res.data?.id)
  return res
}

export async function markOrderedAction(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, MANAGE)
    await markOrdered(ctx, id)
  }, 'Orden de compra emitida')
  revalidatePurchases(slug, id)
  return res
}

export async function receivePurchaseAction(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, MANAGE)
    const { received } = await receivePurchase(ctx, id)
    return received
  }, 'Mercancía recibida')
  revalidatePurchases(slug, id)
  if (res.ok) revalidateStock(slug)
  return res.ok
    ? {
        ok: true,
        message: res.data
          ? `Mercancía recibida: ${res.data} ${res.data === 1 ? 'producto ingresó' : 'productos ingresaron'} al inventario`
          : 'Mercancía recibida',
      }
    : res
}

export async function registerPaymentAction(
  slug: string,
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, MANAGE)
    await registerPurchasePayment(ctx, id, formData.get('amount'))
  }, 'Pago registrado')
  revalidatePurchases(slug, id)
  return res
}

export async function cancelPurchaseAction(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, MANAGE)
    await cancelPurchase(ctx, id)
  }, 'Compra cancelada')
  revalidatePurchases(slug, id)
  return res
}

export async function searchPurchaseProducts(slug: string, q: string, branchId?: string): Promise<PickerProduct[]> {
  const ctx = await authorize(slug, { ...MANAGE, allowInactive: true })
  const branch = branchId ? ctx.branches.find((b) => b.id === branchId) : ctx.branch
  return searchProducts(ctx.tenant.id, branch?.id, String(q ?? '').slice(0, 80))
}

/* ── Proveedores ─────────────────────────────────────────────────────── */

const optionalText = (max = 200) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim() : null), z.string().max(max).nullable())

const supplierSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  contactName: optionalText(),
  phone: optionalText(40),
  email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : null),
    z.string().email('Correo inválido').nullable(),
  ),
  taxId: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim().toUpperCase() : null),
    z
      .string()
      .regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/, 'RFC inválido (12 o 13 caracteres)')
      .nullable(),
  ),
  address: optionalText(300),
  notes: optionalText(1000),
})

export async function saveSupplier(
  slug: string,
  id: string | null,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, MANAGE)
    const input = supplierSchema.parse(Object.fromEntries(formData))
    if (id) {
      const [row] = await db
        .update(suppliers)
        .set(input)
        .where(and(eq(suppliers.id, id), eq(suppliers.tenantId, ctx.tenant.id)))
        .returning({ id: suppliers.id })
      if (!row) throw new ActionError('Proveedor no encontrado.')
      await logActivity(db, ctx, { action: 'update', entity: 'supplier', entityId: id, summary: input.name })
    } else {
      const [row] = await db
        .insert(suppliers)
        .values({ ...input, tenantId: ctx.tenant.id })
        .returning({ id: suppliers.id })
      await logActivity(db, ctx, { action: 'create', entity: 'supplier', entityId: row.id, summary: input.name })
    }
  }, id ? 'Proveedor actualizado' : 'Proveedor creado')
  if (res.ok) revalidatePurchases(slug)
  return res
}

export async function deleteSupplier(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, MANAGE)
    const supplier = await db.query.suppliers.findFirst({
      where: and(eq(suppliers.id, id), eq(suppliers.tenantId, ctx.tenant.id)),
    })
    if (!supplier) throw new ActionError('Proveedor no encontrado.')
    const [{ n }] = await db
      .select({ n: count() })
      .from(purchases)
      .where(and(eq(purchases.supplierId, id), eq(purchases.tenantId, ctx.tenant.id)))
    if (n > 0) {
      throw new ActionError(
        `No se puede eliminar: ${supplier.name} tiene ${n} ${n === 1 ? 'compra registrada' : 'compras registradas'}.`,
      )
    }
    await db.delete(suppliers).where(eq(suppliers.id, id))
    await logActivity(db, ctx, { action: 'delete', entity: 'supplier', entityId: id, summary: supplier.name })
  }, 'Proveedor eliminado')
  revalidatePurchases(slug)
  return res
}
