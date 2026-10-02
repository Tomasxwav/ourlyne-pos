'use server'

import { revalidatePath } from 'next/cache'
import { and, count, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { branches, paymentMethods, PAYMENT_METHOD_TYPES, taxes, tenantModules, tenants } from '@/db/schema'
import { isModuleKey, MODULES } from '@/lib/modules'
import { withinLimit } from '@/lib/plans'
import { ActionError, authorize, logActivity, runAction, type ActionResult } from '@/server/action'

const text = (max = 200) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim() : null), z.string().max(max).nullable())

const businessSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre').max(80),
  email: z.preprocess((v) => (v ? v : null), z.string().email('Correo inválido').nullable()),
  phone: text(30),
  taxId: text(20),
  address: text(200),
  logoUrl: z.preprocess((v) => (v ? v : null), z.string().url('URL inválida').nullable()),
  currency: z.enum(['MXN', 'USD', 'COP', 'PEN', 'CLP', 'ARS', 'GTQ', 'EUR']),
  timezone: z.string().min(3).max(60),
  receiptHeader: text(120),
  receiptFooter: text(160),
  pricesIncludeTax: z.boolean(),
  allowNegativeStock: z.boolean(),
})

export async function updateBusiness(
  slug: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'settings.manage', allowInactive: true })
    const input = businessSchema.parse({
      ...Object.fromEntries(formData),
      pricesIncludeTax: formData.get('pricesIncludeTax') === 'on',
      allowNegativeStock: formData.get('allowNegativeStock') === 'on',
    })
    try {
      new Intl.DateTimeFormat('es-MX', { timeZone: input.timezone })
    } catch {
      throw new ActionError('Zona horaria inválida.')
    }
    await db.update(tenants).set(input).where(eq(tenants.id, ctx.tenant.id))
    await logActivity(db, ctx, { action: 'update', entity: 'settings', summary: 'Datos del negocio' })
  }, 'Configuración guardada')
  revalidatePath(`/app/${slug}`, 'layout')
  return res
}

/* ── Sucursales ─────────────────────────────────────────────────────── */

const branchSchema = z.object({
  name: z.string().trim().min(2, 'Escribe un nombre').max(60),
  code: text(10),
  address: text(200),
  phone: text(30),
})

export async function saveBranch(
  slug: string,
  id: string | null,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'settings.manage' })
    const input = branchSchema.parse(Object.fromEntries(formData))
    if (id) {
      await db
        .update(branches)
        .set(input)
        .where(and(eq(branches.id, id), eq(branches.tenantId, ctx.tenant.id)))
      return
    }
    const limit = ctx.plan?.limits.branches ?? -1
    const [{ n }] = await db
      .select({ n: count() })
      .from(branches)
      .where(and(eq(branches.tenantId, ctx.tenant.id), eq(branches.isActive, true)))
    if (!withinLimit(limit, n)) {
      throw new ActionError(`Tu plan permite ${limit} ${limit === 1 ? 'sucursal' : 'sucursales'}. Mejora tu plan para abrir más.`)
    }
    await db.insert(branches).values({ ...input, tenantId: ctx.tenant.id })
    await logActivity(db, ctx, { action: 'create', entity: 'branch', summary: input.name })
  }, id ? 'Sucursal actualizada' : 'Sucursal creada')
  revalidatePath(`/app/${slug}`, 'layout')
  return res
}

export async function toggleBranch(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'settings.manage' })
    const branch = await db.query.branches.findFirst({
      where: and(eq(branches.id, id), eq(branches.tenantId, ctx.tenant.id)),
    })
    if (!branch) throw new ActionError('Sucursal no encontrada.')
    if (branch.isDefault && branch.isActive) throw new ActionError('No puedes desactivar la sucursal principal.')
    if (!branch.isActive) {
      const limit = ctx.plan?.limits.branches ?? -1
      const [{ n }] = await db
        .select({ n: count() })
        .from(branches)
        .where(and(eq(branches.tenantId, ctx.tenant.id), eq(branches.isActive, true)))
      if (!withinLimit(limit, n)) throw new ActionError('Alcanzaste el límite de sucursales de tu plan.')
    }
    await db.update(branches).set({ isActive: !branch.isActive }).where(eq(branches.id, id))
  }, 'Sucursal actualizada')
  revalidatePath(`/app/${slug}`, 'layout')
  return res
}

export async function setDefaultBranch(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'settings.manage' })
    await db.transaction(async (tx) => {
      await tx.update(branches).set({ isDefault: false }).where(eq(branches.tenantId, ctx.tenant.id))
      await tx
        .update(branches)
        .set({ isDefault: true, isActive: true })
        .where(and(eq(branches.id, id), eq(branches.tenantId, ctx.tenant.id)))
    })
  }, 'Sucursal principal actualizada')
  revalidatePath(`/app/${slug}`, 'layout')
  return res
}

/* ── Impuestos ──────────────────────────────────────────────────────── */

const taxSchema = z.object({
  name: z.string().trim().min(2).max(40),
  rate: z.coerce.number().min(0, 'Tasa inválida').max(100, 'Tasa inválida'),
})

export async function saveTax(
  slug: string,
  id: string | null,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'settings.manage' })
    const { name, rate } = taxSchema.parse(Object.fromEntries(formData))
    const values = { name, rateBps: Math.round(rate * 100) }
    if (id) {
      await db.update(taxes).set(values).where(and(eq(taxes.id, id), eq(taxes.tenantId, ctx.tenant.id)))
    } else {
      await db.insert(taxes).values({ ...values, tenantId: ctx.tenant.id })
    }
  }, 'Impuesto guardado')
  revalidatePath(`/app/${slug}/settings/taxes`)
  return res
}

export async function setDefaultTax(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'settings.manage' })
    await db.transaction(async (tx) => {
      await tx.update(taxes).set({ isDefault: false }).where(eq(taxes.tenantId, ctx.tenant.id))
      await tx.update(taxes).set({ isDefault: true }).where(and(eq(taxes.id, id), eq(taxes.tenantId, ctx.tenant.id)))
    })
  }, 'Impuesto predeterminado actualizado')
  revalidatePath(`/app/${slug}/settings/taxes`)
  return res
}

export async function deleteTax(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'settings.manage' })
    await db.delete(taxes).where(and(eq(taxes.id, id), eq(taxes.tenantId, ctx.tenant.id)))
  }, 'Impuesto eliminado. Los productos que lo usaban quedaron exentos.')
  revalidatePath(`/app/${slug}/settings/taxes`)
  return res
}

/* ── Métodos de pago ────────────────────────────────────────────────── */

const methodSchema = z.object({
  name: z.string().trim().min(2).max(40),
  type: z.enum(PAYMENT_METHOD_TYPES),
})

export async function savePaymentMethod(
  slug: string,
  id: string | null,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'settings.manage' })
    const input = methodSchema.parse(Object.fromEntries(formData))
    if (id) {
      await db
        .update(paymentMethods)
        .set(input)
        .where(and(eq(paymentMethods.id, id), eq(paymentMethods.tenantId, ctx.tenant.id)))
    } else {
      const [{ n }] = await db
        .select({ n: count() })
        .from(paymentMethods)
        .where(eq(paymentMethods.tenantId, ctx.tenant.id))
      await db.insert(paymentMethods).values({ ...input, tenantId: ctx.tenant.id, sortOrder: n + 1 })
    }
  }, 'Método de pago guardado')
  revalidatePath(`/app/${slug}/settings/payments`)
  return res
}

export async function togglePaymentMethod(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'settings.manage' })
    const method = await db.query.paymentMethods.findFirst({
      where: and(eq(paymentMethods.id, id), eq(paymentMethods.tenantId, ctx.tenant.id)),
    })
    if (!method) throw new ActionError('Método no encontrado.')
    if (method.isActive) {
      const [{ n }] = await db
        .select({ n: count() })
        .from(paymentMethods)
        .where(
          and(eq(paymentMethods.tenantId, ctx.tenant.id), eq(paymentMethods.isActive, true), ne(paymentMethods.id, id)),
        )
      if (n === 0) throw new ActionError('Debe quedar al menos un método de pago activo.')
    }
    await db.update(paymentMethods).set({ isActive: !method.isActive }).where(eq(paymentMethods.id, id))
  }, 'Método de pago actualizado')
  revalidatePath(`/app/${slug}/settings/payments`)
  return res
}

/* ── Módulos ────────────────────────────────────────────────────────── */

export async function toggleModule(slug: string, key: string, enabled: boolean): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'settings.manage', allowInactive: true })
    if (!isModuleKey(key)) throw new ActionError('Módulo desconocido.')
    if (enabled && !ctx.plan?.modules.includes(key)) {
      throw new ActionError(`${MODULES[key].name} no está incluido en tu plan.`)
    }
    await db
      .insert(tenantModules)
      .values({ tenantId: ctx.tenant.id, moduleKey: key, enabled })
      .onConflictDoUpdate({
        target: [tenantModules.tenantId, tenantModules.moduleKey],
        set: { enabled, updatedAt: new Date() },
      })
    await logActivity(db, ctx, {
      action: enabled ? 'enable' : 'disable',
      entity: 'module',
      entityId: key,
      summary: `${enabled ? 'Activó' : 'Desactivó'} ${MODULES[key].name}`,
    })
  }, enabled ? 'Módulo activado' : 'Módulo desactivado')
  revalidatePath(`/app/${slug}`, 'layout')
  return res
}
