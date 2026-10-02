'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { coupons } from '@/db/schema'
import { toCents } from '@/lib/money'
import { ActionError, authorize, logActivity, runAction, type ActionResult } from '@/server/action'
import { endOfDayIn } from './dates'

const AUTH = { permission: 'coupons.manage', module: 'coupons' } as const

const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, 'Mínimo 3 caracteres')
      .max(40, 'Máximo 40 caracteres')
      .regex(/^[A-Z0-9_-]+$/, 'Solo letras, números, guion y guion bajo (sin espacios)'),
    description: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() ? v.trim() : null),
      z.string().max(200).nullable(),
    ),
    type: z.enum(['percent', 'fixed'], 'Selecciona el tipo de descuento'),
    value: z.string().trim().min(1, 'Captura el valor del descuento'),
    minTotal: z.preprocess((v) => toCents(v as string), z.number().int().min(0, 'No puede ser negativo')),
    usageLimit: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
      z.number().int('Debe ser un número entero').min(1, 'Mínimo 1 uso').nullable(),
    ),
    expiresAt: z.preprocess(
      (v) => (v ? v : null),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').nullable(),
    ),
    isActive: z.boolean(),
  })
  .transform((input, ctx) => {
    const n = Number(input.value.replace(/[^\d.-]/g, ''))
    if (!Number.isFinite(n) || n <= 0) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Debe ser mayor a cero' })
      return z.NEVER
    }
    if (input.type === 'percent' && n > 100) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'El porcentaje no puede superar 100 %' })
      return z.NEVER
    }
    // Porcentaje → puntos base (10 % = 1000); fijo → centavos.
    const value = input.type === 'percent' ? Math.round(n * 100) : toCents(n)
    if (input.type === 'fixed' && input.minTotal > 0 && value > input.minTotal) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'El descuento no puede ser mayor que la compra mínima',
      })
      return z.NEVER
    }
    return { ...input, value }
  })

export async function saveCoupon(
  slug: string,
  id: string | null,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, AUTH)
    const input = couponSchema.parse({
      ...Object.fromEntries(formData),
      isActive: formData.get('isActive') === 'on',
    })
    const tenantId = ctx.tenant.id

    const dup = await db.query.coupons.findFirst({
      where: and(eq(coupons.tenantId, tenantId), eq(coupons.code, input.code), id ? ne(coupons.id, id) : undefined),
      columns: { id: true },
    })
    if (dup) throw new ActionError(`Ya existe un cupón con el código ${input.code}.`)

    const values = {
      ...input,
      expiresAt: input.expiresAt ? endOfDayIn(input.expiresAt, ctx.tenant.timezone) : null,
    }

    await db.transaction(async (tx) => {
      if (id) {
        const [row] = await tx
          .update(coupons)
          .set(values)
          .where(and(eq(coupons.id, id), eq(coupons.tenantId, tenantId)))
          .returning({ id: coupons.id })
        if (!row) throw new ActionError('Cupón no encontrado.')
        await logActivity(tx, ctx, { action: 'update', entity: 'coupon', entityId: id, summary: input.code })
      } else {
        const [row] = await tx
          .insert(coupons)
          .values({ ...values, tenantId })
          .returning({ id: coupons.id })
        await logActivity(tx, ctx, { action: 'create', entity: 'coupon', entityId: row.id, summary: input.code })
      }
    })
  }, id ? 'Cupón actualizado' : 'Cupón creado')
  revalidatePath(`/app/${slug}/coupons`)
  return res
}

export async function toggleCoupon(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, AUTH)
    const coupon = await db.query.coupons.findFirst({
      where: and(eq(coupons.id, id), eq(coupons.tenantId, ctx.tenant.id)),
    })
    if (!coupon) throw new ActionError('Cupón no encontrado.')
    await db.transaction(async (tx) => {
      await tx.update(coupons).set({ isActive: !coupon.isActive }).where(eq(coupons.id, id))
      await logActivity(tx, ctx, {
        action: coupon.isActive ? 'deactivate' : 'activate',
        entity: 'coupon',
        entityId: id,
        summary: coupon.code,
      })
    })
    return coupon.isActive ? `${coupon.code} desactivado` : `${coupon.code} activado`
  })
  revalidatePath(`/app/${slug}/coupons`)
  return res.ok ? { ok: true, message: res.data } : res
}

export async function deleteCoupon(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, AUTH)
    const coupon = await db.query.coupons.findFirst({
      where: and(eq(coupons.id, id), eq(coupons.tenantId, ctx.tenant.id)),
    })
    if (!coupon) throw new ActionError('Cupón no encontrado.')
    return db.transaction(async (tx) => {
      if (coupon.usedCount > 0) {
        await tx.update(coupons).set({ isActive: false }).where(eq(coupons.id, id))
        await logActivity(tx, ctx, { action: 'deactivate', entity: 'coupon', entityId: id, summary: coupon.code })
        return 'El cupón ya se usó en ventas: se desactivó para conservar el historial.'
      }
      await tx.delete(coupons).where(eq(coupons.id, id))
      await logActivity(tx, ctx, { action: 'delete', entity: 'coupon', entityId: id, summary: coupon.code })
      return 'Cupón eliminado'
    })
  })
  revalidatePath(`/app/${slug}/coupons`)
  return res.ok ? { ok: true, message: res.data } : res
}
