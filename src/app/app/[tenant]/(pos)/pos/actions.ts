'use server'

import { cookies } from 'next/headers'
import { refresh, revalidatePath } from 'next/cache'
import { and, desc, eq, ilike, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { customers, registers, registerSessions } from '@/db/schema'
import { toCents } from '@/lib/money'
import { ActionError, authorize, logActivity, runAction, type ActionResult } from '@/server/action'
import { createOrder, resolveCoupon, type CheckoutInput } from '@/server/orders'
import { getOpenSessionForRegister, REGISTER_COOKIE } from '@/server/registers'

export async function checkout(
  slug: string,
  input: CheckoutInput,
): Promise<ActionResult<{ id: string; number: number; total: number; change: number }>> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'pos.sell' })
    return createOrder(ctx, input)
  }, 'Venta registrada')
  if (res.ok) {
    revalidatePath(`/app/${slug}/orders`)
    revalidatePath(`/app/${slug}`)
  }
  return res
}

export async function validateCoupon(
  slug: string,
  code: string,
  netAmount: number,
): Promise<ActionResult<{ code: string; type: 'percent' | 'fixed'; value: number; description: string | null }>> {
  return runAction(async () => {
    const ctx = await authorize(slug, { permission: 'pos.sell', module: 'coupons' })
    const { coupon } = await resolveCoupon(ctx.tenant.id, code, netAmount)
    return { code: coupon.code, type: coupon.type, value: coupon.value, description: coupon.description }
  })
}

export type CustomerOption = {
  id: string
  name: string
  phone: string | null
  email: string | null
  creditLimit: number
  balance: number
  loyaltyPoints: number
}

export async function searchCustomers(slug: string, q: string): Promise<CustomerOption[]> {
  const ctx = await authorize(slug, { permission: 'customers.view', module: 'customers', allowInactive: true })
  const term = q.trim()
  return db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      creditLimit: customers.creditLimit,
      balance: customers.balance,
      loyaltyPoints: customers.loyaltyPoints,
    })
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, ctx.tenant.id),
        term
          ? or(
              ilike(customers.name, `%${term}%`),
              ilike(customers.phone, `%${term}%`),
              ilike(customers.email, `%${term}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(customers.lastPurchaseAt))
    .limit(8)
}

const quickCustomer = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre'),
  phone: z.string().trim().max(30).optional(),
  email: z.union([z.string().trim().email('Correo inválido'), z.literal('')]).optional(),
})

export async function quickCreateCustomer(
  slug: string,
  input: z.infer<typeof quickCustomer>,
): Promise<ActionResult<CustomerOption>> {
  return runAction(async () => {
    const ctx = await authorize(slug, { permission: 'customers.manage', module: 'customers' })
    const data = quickCustomer.parse(input)
    const [row] = await db
      .insert(customers)
      .values({ tenantId: ctx.tenant.id, name: data.name, phone: data.phone || null, email: data.email || null })
      .returning()
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      creditLimit: row.creditLimit,
      balance: row.balance,
      loyaltyPoints: row.loyaltyPoints,
    }
  }, 'Cliente creado')
}

async function setRegisterCookie(tenantId: string, registerId: string) {
  const store = await cookies()
  store.set(`${REGISTER_COOKIE}_${tenantId}`, registerId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  })
}

/** Usa una caja ya abierta (p. ej. compartida por varios cajeros). */
export async function selectRegister(slug: string, registerId: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'registers.operate', module: 'registers' })
    const register = await db.query.registers.findFirst({
      where: and(eq(registers.id, registerId), eq(registers.tenantId, ctx.tenant.id)),
    })
    if (!register || register.branchId !== ctx.branch?.id) throw new ActionError('Caja no válida.')
    await setRegisterCookie(ctx.tenant.id, register.id)
  })
  if (res.ok) refresh()
  return res
}

export async function openRegister(
  slug: string,
  registerId: string,
  openingAmount: string,
): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'registers.operate', module: 'registers' })
    const register = await db.query.registers.findFirst({
      where: and(eq(registers.id, registerId), eq(registers.tenantId, ctx.tenant.id)),
    })
    if (!register || register.branchId !== ctx.branch?.id) throw new ActionError('Caja no válida.')
    const existing = await getOpenSessionForRegister(db, register.id)
    if (!existing) {
      const amount = toCents(openingAmount)
      if (amount < 0) throw new ActionError('El fondo no puede ser negativo.')
      const [s] = await db
        .insert(registerSessions)
        .values({ tenantId: ctx.tenant.id, registerId: register.id, openedById: ctx.user.id, openingAmount: amount })
        .returning()
      await logActivity(db, ctx, {
        action: 'open',
        entity: 'register',
        entityId: s.id,
        summary: `Apertura de ${register.name} con $${(amount / 100).toFixed(2)}`,
      })
    }
    await setRegisterCookie(ctx.tenant.id, register.id)
  }, 'Caja abierta')
  if (res.ok) {
    revalidatePath(`/app/${slug}/registers`)
    refresh()
  }
  return res
}
