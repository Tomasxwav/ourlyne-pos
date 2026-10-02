'use server'

import { revalidatePath } from 'next/cache'
import { and, count, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { branches, cashMovements, registers, registerSessions } from '@/db/schema'
import { toCents } from '@/lib/money'
import { withinLimit } from '@/lib/plans'
import { ActionError, authorize, logActivity, runAction, type ActionResult } from '@/server/action'
import { getSessionSummary } from '@/server/registers'

async function loadSession(tenantId: string, sessionId: string) {
  const session = await db.query.registerSessions.findFirst({
    where: and(eq(registerSessions.id, sessionId), eq(registerSessions.tenantId, tenantId)),
    with: { register: true },
  })
  if (!session) throw new ActionError('Sesión de caja no encontrada.')
  return session
}

const movementSchema = z.object({
  type: z.enum(['in', 'out']),
  amount: z.preprocess((v) => toCents(v as string), z.number().int().positive('Captura un importe mayor a cero')),
  reason: z.string().trim().min(2, 'Indica el motivo').max(200),
})

export async function addCashMovement(
  slug: string,
  sessionId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'registers.operate', module: 'registers' })
    const session = await loadSession(ctx.tenant.id, sessionId)
    if (session.status !== 'open') throw new ActionError('La caja está cerrada.')
    if (session.openedById !== ctx.user.id && !ctx.can('registers.manage'))
      throw new ActionError('Solo quien abrió la caja o un administrador puede mover efectivo.')
    const input = movementSchema.parse(Object.fromEntries(formData))
    await db.insert(cashMovements).values({ ...input, tenantId: ctx.tenant.id, sessionId, userId: ctx.user.id })
    await logActivity(db, ctx, {
      action: input.type === 'in' ? 'cash_in' : 'cash_out',
      entity: 'register',
      entityId: sessionId,
      summary: `${input.type === 'in' ? 'Entrada' : 'Salida'} de $${(input.amount / 100).toFixed(2)}: ${input.reason}`,
    })
  }, 'Movimiento registrado')
  revalidatePath(`/app/${slug}/registers`)
  return res
}

export async function closeSession(
  slug: string,
  sessionId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'registers.operate', module: 'registers', allowInactive: true })
    const session = await loadSession(ctx.tenant.id, sessionId)
    if (session.status !== 'open') throw new ActionError('La caja ya está cerrada.')
    if (session.openedById !== ctx.user.id && !ctx.can('registers.manage'))
      throw new ActionError('Solo quien abrió la caja o un administrador puede cerrarla.')
    const counted = toCents(String(formData.get('counted') ?? ''))
    if (counted < 0) throw new ActionError('El efectivo contado no puede ser negativo.')
    const summary = await getSessionSummary(db, sessionId)
    const expected = summary?.expected ?? 0
    await db
      .update(registerSessions)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedById: ctx.user.id,
        expectedAmount: expected,
        countedAmount: counted,
        difference: counted - expected,
        notes: String(formData.get('notes') ?? '') || null,
      })
      .where(eq(registerSessions.id, sessionId))
    await logActivity(db, ctx, {
      action: 'close',
      entity: 'register',
      entityId: sessionId,
      summary: `Corte de ${session.register.name}: diferencia $${((counted - expected) / 100).toFixed(2)}`,
    })
  }, 'Caja cerrada')
  revalidatePath(`/app/${slug}/registers`)
  return res
}

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Escribe un nombre').max(60),
  branchId: z.string().uuid(),
})

export async function createRegister(
  slug: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'registers.manage', module: 'registers' })
    const input = registerSchema.parse(Object.fromEntries(formData))
    const branch = await db.query.branches.findFirst({
      where: and(eq(branches.id, input.branchId), eq(branches.tenantId, ctx.tenant.id)),
    })
    if (!branch) throw new ActionError('Sucursal inválida.')
    const limit = ctx.plan?.limits.registers ?? -1
    const [{ n }] = await db
      .select({ n: count() })
      .from(registers)
      .where(and(eq(registers.tenantId, ctx.tenant.id), eq(registers.isActive, true)))
    if (!withinLimit(limit, n)) throw new ActionError(`Tu plan permite hasta ${limit} cajas.`)
    await db.insert(registers).values({ ...input, tenantId: ctx.tenant.id })
  }, 'Caja creada')
  revalidatePath(`/app/${slug}/registers`)
  return res
}

export async function toggleRegister(slug: string, registerId: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'registers.manage', module: 'registers' })
    const reg = await db.query.registers.findFirst({
      where: and(eq(registers.id, registerId), eq(registers.tenantId, ctx.tenant.id)),
    })
    if (!reg) throw new ActionError('Caja no encontrada.')
    const open = await db.query.registerSessions.findFirst({
      where: and(eq(registerSessions.registerId, registerId), eq(registerSessions.status, 'open')),
    })
    if (open && reg.isActive) throw new ActionError('Cierra la caja antes de desactivarla.')
    await db.update(registers).set({ isActive: !reg.isActive }).where(eq(registers.id, registerId))
  }, 'Caja actualizada')
  revalidatePath(`/app/${slug}/registers`)
  return res
}
