'use server'

import { revalidatePath } from 'next/cache'
import { addDays } from 'date-fns'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { plans, subscriptions, tenants } from '@/db/schema'
import { isModuleKey } from '@/lib/modules'
import { toCents } from '@/lib/money'
import { ActionError, runAction, type ActionResult } from '@/server/action'
import { enablePlanModules } from '@/server/billing'
import { requireSuperAdmin } from '@/server/session'

export async function extendTrial(tenantId: string, days: number): Promise<ActionResult> {
  const res = await runAction(async () => {
    await requireSuperAdmin()
    const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.tenantId, tenantId) })
    if (!sub) throw new ActionError('El negocio no tiene suscripción.')
    const base = sub.trialEndsAt && sub.trialEndsAt > new Date() ? sub.trialEndsAt : new Date()
    await db
      .update(subscriptions)
      .set({ status: 'trialing', trialEndsAt: addDays(base, days) })
      .where(eq(subscriptions.id, sub.id))
  }, `Prueba extendida ${days} días`)
  revalidatePath('/admin/tenants')
  return res
}

export async function toggleSuspend(tenantId: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    await requireSuperAdmin()
    const t = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) })
    if (!t) throw new ActionError('Negocio no encontrado.')
    await db
      .update(tenants)
      .set({ suspendedAt: t.suspendedAt ? null : new Date() })
      .where(eq(tenants.id, tenantId))
    return t.suspendedAt ? 'Negocio reactivado' : 'Negocio suspendido'
  })
  revalidatePath('/admin/tenants')
  return res.ok ? { ok: true, message: res.data } : res
}

export async function assignPlan(tenantId: string, planId: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    await requireSuperAdmin()
    const plan = await db.query.plans.findFirst({ where: eq(plans.id, planId) })
    if (!plan) throw new ActionError('Plan no encontrado.')
    await db.transaction(async (tx) => {
      const sub = await tx.query.subscriptions.findFirst({ where: eq(subscriptions.tenantId, tenantId) })
      if (sub) await tx.update(subscriptions).set({ planId }).where(eq(subscriptions.id, sub.id))
      else await tx.insert(subscriptions).values({ tenantId, planId, status: 'trialing', trialEndsAt: addDays(new Date(), plan.trialDays) })
      await enablePlanModules(tx, tenantId, plan.modules)
    })
  }, 'Plan asignado')
  revalidatePath('/admin/tenants')
  return res
}

const planSchema = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(200).optional(),
  priceMonthly: z.preprocess((v) => toCents(v as string), z.number().int().min(0)),
  priceYearly: z.preprocess((v) => toCents(v as string), z.number().int().min(0)),
  trialDays: z.coerce.number().int().min(0).max(90),
  sortOrder: z.coerce.number().int(),
  branches: z.coerce.number().int().min(-1),
  users: z.coerce.number().int().min(-1),
  products: z.coerce.number().int().min(-1),
  registers: z.coerce.number().int().min(-1),
  stripePriceMonthlyId: z.preprocess((v) => (v ? v : null), z.string().startsWith('price_').nullable()),
  stripePriceYearlyId: z.preprocess((v) => (v ? v : null), z.string().startsWith('price_').nullable()),
})

export async function savePlan(planId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const res = await runAction(async () => {
    await requireSuperAdmin()
    const input = planSchema.parse(Object.fromEntries(formData))
    const modules = formData.getAll('modules').map(String).filter(isModuleKey)
    const features = String(formData.get('features') ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const { branches, users, products, registers, ...rest } = input
    await db
      .update(plans)
      .set({
        ...rest,
        modules,
        features,
        limits: { branches, users, products, registers },
        highlighted: formData.get('highlighted') === 'on',
        isActive: formData.get('isActive') === 'on',
      })
      .where(eq(plans.id, planId))
  }, 'Plan guardado')
  revalidatePath('/admin/plans')
  revalidatePath('/')
  return res
}
