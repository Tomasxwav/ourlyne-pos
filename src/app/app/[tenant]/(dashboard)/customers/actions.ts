'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, count, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { customerPayments, customers, orderPayments, orders } from '@/db/schema'
import { formatMoney, toCents } from '@/lib/money'
import { ActionError, authorize, logActivity, runAction, type ActionResult } from '@/server/action'
import { getActiveRegister } from '@/server/registers'

const optionalText = (max = 500) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim() : null), z.string().max(max).nullable())

const customerSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del cliente').max(120),
  email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : null),
    z.email('Correo inválido').max(160).nullable(),
  ),
  phone: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim() : null),
    z
      .string()
      .max(30)
      .regex(/^[\d\s()+-]{7,}$/, 'Teléfono inválido')
      .nullable(),
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
  creditLimit: z.preprocess(
    (v) => toCents(v as string),
    z.number().int().min(0, 'No puede ser negativo').max(100_000_000_00, 'Importe demasiado alto'),
  ),
})

export async function saveCustomer(
  slug: string,
  id: string | null,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'customers.manage', module: 'customers' })
    const input = customerSchema.parse(Object.fromEntries(formData))
    const tenantId = ctx.tenant.id

    if (input.email) {
      const dup = await db.query.customers.findFirst({
        where: and(eq(customers.tenantId, tenantId), eq(customers.email, input.email), id ? ne(customers.id, id) : undefined),
        columns: { name: true },
      })
      if (dup) throw new ActionError(`El correo ya está registrado para ${dup.name}.`)
    }

    if (id) {
      const [row] = await db
        .update(customers)
        .set(input)
        .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)))
        .returning({ id: customers.id })
      if (!row) throw new ActionError('Cliente no encontrado.')
      await logActivity(db, ctx, { action: 'update', entity: 'customer', entityId: id, summary: input.name })
      return { id }
    }

    return db.transaction(async (tx) => {
      const [row] = await tx
        .insert(customers)
        .values({ ...input, tenantId })
        .returning({ id: customers.id })
      await logActivity(tx, ctx, { action: 'create', entity: 'customer', entityId: row.id, summary: input.name })
      return { id: row.id }
    })
  }, id ? 'Cliente actualizado' : 'Cliente creado')

  if (res.ok) {
    revalidatePath(`/app/${slug}/customers`)
    if (id) revalidatePath(`/app/${slug}/customers/${id}`)
  }
  return res
}

export async function deleteCustomer(slug: string, id: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'customers.manage', module: 'customers' })
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, id), eq(customers.tenantId, ctx.tenant.id)),
    })
    if (!customer) throw new ActionError('Cliente no encontrado.')
    const [{ n }] = await db
      .select({ n: count() })
      .from(orders)
      .where(and(eq(orders.tenantId, ctx.tenant.id), eq(orders.customerId, id)))
    if (n > 0)
      throw new ActionError(
        `No se puede eliminar: ${customer.name} tiene ${n} ${n === 1 ? 'venta registrada' : 'ventas registradas'}.`,
      )
    if (customer.balance > 0) throw new ActionError('No se puede eliminar un cliente con saldo pendiente.')
    await db.transaction(async (tx) => {
      await tx.delete(customers).where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenant.id)))
      await logActivity(tx, ctx, { action: 'delete', entity: 'customer', entityId: id, summary: customer.name })
    })
  }, 'Cliente eliminado')
  if (res.ok) {
    revalidatePath(`/app/${slug}/customers`)
    redirect(`/app/${slug}/customers`)
  }
  return res
}

const paymentSchema = z.object({
  amount: z.preprocess((v) => toCents(v as string), z.number().int().positive('Captura un importe mayor a cero')),
  methodType: z.enum(['cash', 'card', 'transfer'], 'Selecciona un método de pago'),
  note: optionalText(200),
})

const METHOD_LABEL = { cash: 'efectivo', card: 'tarjeta', transfer: 'transferencia' } as const

export async function registerCustomerPayment(
  slug: string,
  customerId: string,
  _prev: ActionResult<{ paidOrders: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ paidOrders: number }>> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'customers.manage', module: 'customers' })
    const input = paymentSchema.parse(Object.fromEntries(formData))
    const tenantId = ctx.tenant.id

    // El efectivo entra a la caja: requiere una sesión abierta si se usa el módulo de cajas.
    let registerSessionId: string | null = null
    if (input.methodType === 'cash' && ctx.hasModule('registers')) {
      const { session } = await getActiveRegister(ctx)
      if (!session) throw new ActionError('Abre tu caja para recibir abonos en efectivo.')
      registerSessionId = session.id
    }

    return db.transaction(async (tx) => {
      // Descuenta el saldo de forma atómica, sin permitir abonar de más.
      const [updated] = await tx
        .update(customers)
        .set({ balance: sql`${customers.balance} - ${input.amount}` })
        .where(
          and(
            eq(customers.id, customerId),
            eq(customers.tenantId, tenantId),
            gte(customers.balance, input.amount),
          ),
        )
        .returning({ name: customers.name, balance: customers.balance })
      if (!updated) {
        const current = await tx.query.customers.findFirst({
          where: and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)),
          columns: { balance: true },
        })
        if (!current) throw new ActionError('Cliente no encontrado.')
        throw new ActionError(
          current.balance <= 0
            ? 'El cliente no tiene saldo pendiente.'
            : `El abono no puede superar el saldo (${formatMoney(current.balance, ctx.tenant.currency)}).`,
        )
      }

      const [payment] = await tx
        .insert(customerPayments)
        .values({
          tenantId,
          customerId,
          registerSessionId,
          amount: input.amount,
          methodType: input.methodType,
          note: input.note,
          userId: ctx.user.id,
        })
        .returning({ id: customerPayments.id })

      // FIFO: el saldo restante se atribuye a las ventas a crédito más recientes;
      // las más antiguas que queden cubiertas por completo se marcan como pagadas.
      const creditOrders = await tx
        .select({
          id: orders.id,
          credit: sql<number>`coalesce(sum(${orderPayments.amount}), 0)::int`,
        })
        .from(orders)
        .innerJoin(orderPayments, and(eq(orderPayments.orderId, orders.id), eq(orderPayments.methodType, 'credit')))
        .where(
          and(
            eq(orders.tenantId, tenantId),
            eq(orders.customerId, customerId),
            ne(orders.status, 'voided'),
            inArray(orders.paymentStatus, ['unpaid', 'partial']),
          ),
        )
        .groupBy(orders.id, orders.createdAt, orders.number)
        .orderBy(desc(orders.createdAt), desc(orders.number))

      let outstanding = updated.balance
      const paidIds: string[] = []
      for (const o of creditOrders) {
        if (outstanding > 0) outstanding -= Number(o.credit)
        else paidIds.push(o.id)
      }
      if (paidIds.length) {
        await tx
          .update(orders)
          .set({ paymentStatus: 'paid' })
          .where(and(eq(orders.tenantId, tenantId), inArray(orders.id, paidIds)))
      }

      await logActivity(tx, ctx, {
        action: 'payment',
        entity: 'customer',
        entityId: customerId,
        summary: `Abono de ${formatMoney(input.amount, ctx.tenant.currency)} en ${METHOD_LABEL[input.methodType]} de ${updated.name}`,
        meta: { paymentId: payment.id, paidOrders: paidIds.length, registerSessionId },
      })
      return { paidOrders: paidIds.length }
    })
  }, 'Abono registrado')

  if (res.ok) {
    revalidatePath(`/app/${slug}/customers`)
    revalidatePath(`/app/${slug}/customers/${customerId}`)
    revalidatePath(`/app/${slug}/orders`)
    revalidatePath(`/app/${slug}/registers`)
  }
  return res
}
