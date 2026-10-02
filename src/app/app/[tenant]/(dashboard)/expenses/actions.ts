'use server'

import { revalidatePath } from 'next/cache'
import { and, count, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { branches, expenseCategories, expenses } from '@/db/schema'
import { formatMoney, toCents } from '@/lib/money'
import { ActionError, authorize, logActivity, runAction, type ActionResult } from '@/server/action'
import { EXPENSE_PAYMENT_METHODS } from './constants'

const AUTH = { permission: 'expenses.manage', module: 'expenses' } as const

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim() : null), z.string().max(max).nullable())
const optionalId = z.preprocess((v) => (v ? v : null), z.uuid().nullable())

const expenseSchema = z.object({
  description: z.string().trim().min(2, 'Describe el gasto').max(200),
  categoryId: optionalId,
  branchId: optionalId,
  amount: z.preprocess(
    (v) => toCents(v as string),
    z.number().int().positive('Captura un importe mayor a cero').max(100_000_000_00, 'Importe demasiado alto'),
  ),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
    .refine((s) => !Number.isNaN(Date.parse(`${s}T12:00:00Z`)), 'Fecha inválida'),
  paymentMethod: z.preprocess(
    (v) => (v ? v : null),
    z.enum(EXPENSE_PAYMENT_METHODS, 'Método de pago inválido').nullable(),
  ),
  reference: optionalText(100),
  recurring: z.enum(['none', 'weekly', 'monthly', 'yearly'], 'Recurrencia inválida').default('none'),
})

/** El día capturado se guarda a mediodía UTC para que no cambie de fecha en ninguna zona horaria de América. */
const dayToTimestamp = (day: string) => new Date(`${day}T12:00:00Z`)

export async function saveExpense(
  slug: string,
  id: string | null,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, AUTH)
    const input = expenseSchema.parse(Object.fromEntries(formData))
    const tenantId = ctx.tenant.id

    if (input.categoryId) {
      const cat = await db.query.expenseCategories.findFirst({
        where: and(eq(expenseCategories.id, input.categoryId), eq(expenseCategories.tenantId, tenantId)),
        columns: { id: true },
      })
      if (!cat) throw new ActionError('Categoría inválida.')
    }
    if (input.branchId) {
      const branch = await db.query.branches.findFirst({
        where: and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId)),
        columns: { id: true },
      })
      if (!branch) throw new ActionError('Sucursal inválida.')
    }

    const values = { ...input, date: dayToTimestamp(input.date) }
    const summary = `${input.description} · ${formatMoney(input.amount, ctx.tenant.currency)}`

    await db.transaction(async (tx) => {
      if (id) {
        const [row] = await tx
          .update(expenses)
          .set(values)
          .where(and(eq(expenses.id, id), eq(expenses.tenantId, tenantId)))
          .returning({ id: expenses.id })
        if (!row) throw new ActionError('Gasto no encontrado.')
        await logActivity(tx, ctx, { action: 'update', entity: 'expense', entityId: id, summary })
      } else {
        const [row] = await tx
          .insert(expenses)
          .values({ ...values, tenantId, userId: ctx.user.id })
          .returning({ id: expenses.id })
        await logActivity(tx, ctx, { action: 'create', entity: 'expense', entityId: row.id, summary })
      }
    })
  }, id ? 'Gasto actualizado' : 'Gasto registrado')
  revalidatePath(`/app/${slug}/expenses`)
  return res
}

export async function deleteExpense(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, AUTH)
    await db.transaction(async (tx) => {
      const [row] = await tx
        .delete(expenses)
        .where(and(eq(expenses.id, id), eq(expenses.tenantId, ctx.tenant.id)))
        .returning({ description: expenses.description, amount: expenses.amount })
      if (!row) throw new ActionError('Gasto no encontrado.')
      await logActivity(tx, ctx, {
        action: 'delete',
        entity: 'expense',
        entityId: id,
        summary: `${row.description} · ${formatMoney(row.amount, ctx.tenant.currency)}`,
      })
    })
  }, 'Gasto eliminado')
  revalidatePath(`/app/${slug}/expenses`)
  return res
}

/* ── Categorías de gasto ─────────────────────────────────────────────── */

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Escribe un nombre').max(60),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Color inválido'),
})

export async function saveExpenseCategory(
  slug: string,
  id: string | null,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, AUTH)
    const input = categorySchema.parse(Object.fromEntries(formData))
    const tenantId = ctx.tenant.id
    const dup = await db.query.expenseCategories.findFirst({
      where: and(
        eq(expenseCategories.tenantId, tenantId),
        eq(expenseCategories.name, input.name),
        id ? ne(expenseCategories.id, id) : undefined,
      ),
      columns: { id: true },
    })
    if (dup) throw new ActionError(`Ya existe la categoría "${input.name}".`)

    await db.transaction(async (tx) => {
      if (id) {
        const [row] = await tx
          .update(expenseCategories)
          .set(input)
          .where(and(eq(expenseCategories.id, id), eq(expenseCategories.tenantId, tenantId)))
          .returning({ id: expenseCategories.id })
        if (!row) throw new ActionError('Categoría no encontrada.')
        await logActivity(tx, ctx, { action: 'update', entity: 'expense_category', entityId: id, summary: input.name })
      } else {
        const [row] = await tx
          .insert(expenseCategories)
          .values({ ...input, tenantId })
          .returning({ id: expenseCategories.id })
        await logActivity(tx, ctx, { action: 'create', entity: 'expense_category', entityId: row.id, summary: input.name })
      }
    })
  }, id ? 'Categoría actualizada' : 'Categoría creada')
  revalidatePath(`/app/${slug}/expenses`)
  return res
}

export async function deleteExpenseCategory(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, AUTH)
    const cat = await db.query.expenseCategories.findFirst({
      where: and(eq(expenseCategories.id, id), eq(expenseCategories.tenantId, ctx.tenant.id)),
    })
    if (!cat) throw new ActionError('Categoría no encontrada.')
    const [{ n }] = await db
      .select({ n: count() })
      .from(expenses)
      .where(and(eq(expenses.tenantId, ctx.tenant.id), eq(expenses.categoryId, id)))
    await db.transaction(async (tx) => {
      await tx.delete(expenseCategories).where(eq(expenseCategories.id, id))
      await logActivity(tx, ctx, {
        action: 'delete',
        entity: 'expense_category',
        entityId: id,
        summary: cat.name,
        meta: { expenses: n },
      })
    })
    return n
  }, 'Categoría eliminada')
  revalidatePath(`/app/${slug}/expenses`)
  return res.ok
    ? {
        ok: true,
        message: res.data
          ? `Categoría eliminada; ${res.data} ${res.data === 1 ? 'gasto quedó' : 'gastos quedaron'} sin categoría.`
          : 'Categoría eliminada',
      }
    : res
}
