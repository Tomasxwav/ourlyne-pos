import { addDays } from 'date-fns'
import { eq } from 'drizzle-orm'
import type { DbOrTx } from '@/db'
import {
  branches,
  expenseCategories,
  members,
  paymentMethods,
  plans,
  registers,
  roles,
  subscriptions,
  taxes,
  tenantModules,
  tenants,
} from '@/db/schema'
import { MODULE_KEYS } from '@/lib/modules'
import { SYSTEM_ROLES } from '@/lib/permissions'
import { DEFAULT_PLAN_SLUG } from '@/lib/plans'

export type ProvisionInput = {
  name: string
  slug: string
  ownerId: string
  businessType?: string
  currency?: string
  planSlug?: string
}

/**
 * Crea un tenant con todo lo necesario para empezar a vender:
 * roles del sistema, sucursal y caja por defecto, métodos de pago, impuestos,
 * categorías de gasto, módulos del plan y suscripción en periodo de prueba.
 * Debe ejecutarse dentro de una transacción.
 */
export async function provisionTenant(tx: DbOrTx, input: ProvisionInput) {
  const plan =
    (await tx.query.plans.findFirst({
      where: eq(plans.slug, input.planSlug ?? DEFAULT_PLAN_SLUG),
    })) ?? (await tx.query.plans.findFirst())
  if (!plan) throw new Error('No hay planes configurados. Ejecuta el seed.')

  const [tenant] = await tx
    .insert(tenants)
    .values({
      name: input.name,
      slug: input.slug,
      ownerId: input.ownerId,
      businessType: input.businessType ?? 'retail',
      currency: input.currency ?? 'MXN',
    })
    .returning()

  const createdRoles = await tx
    .insert(roles)
    .values(
      SYSTEM_ROLES.map((r) => ({
        tenantId: tenant.id,
        key: r.key,
        name: r.name,
        description: r.description,
        permissions: r.permissions,
        isSystem: true,
      })),
    )
    .returning()
  const ownerRole = createdRoles.find((r) => r.key === 'owner')!

  const [branch] = await tx
    .insert(branches)
    .values({ tenantId: tenant.id, name: 'Matriz', code: 'MTZ', isDefault: true })
    .returning()

  await tx.insert(members).values({
    tenantId: tenant.id,
    userId: input.ownerId,
    roleId: ownerRole.id,
    branchId: branch.id,
  })

  await tx.insert(registers).values({ tenantId: tenant.id, branchId: branch.id, name: 'Caja 1' })

  await tx.insert(paymentMethods).values([
    { tenantId: tenant.id, name: 'Efectivo', type: 'cash', sortOrder: 1 },
    { tenantId: tenant.id, name: 'Tarjeta', type: 'card', sortOrder: 2 },
    { tenantId: tenant.id, name: 'Transferencia', type: 'transfer', sortOrder: 3 },
    { tenantId: tenant.id, name: 'Crédito de cliente', type: 'credit', sortOrder: 4 },
  ])

  await tx.insert(taxes).values([
    { tenantId: tenant.id, name: 'IVA 16%', rateBps: 1600, isDefault: true },
    { tenantId: tenant.id, name: 'IVA 8% (frontera)', rateBps: 800 },
    { tenantId: tenant.id, name: 'Tasa 0%', rateBps: 0 },
  ])

  await tx.insert(expenseCategories).values(
    [
      ['Renta', '#222d52'],
      ['Servicios', '#5b6b9a'],
      ['Nómina', '#c2904b'],
      ['Insumos', '#d2b68a'],
      ['Mantenimiento', '#a3a7b4'],
      ['Otros', '#7d8fc9'],
    ].map(([name, color]) => ({ tenantId: tenant.id, name, color })),
  )

  await tx.insert(tenantModules).values(
    MODULE_KEYS.map((key) => ({
      tenantId: tenant.id,
      moduleKey: key,
      enabled: plan.modules.includes(key),
    })),
  )

  await tx.insert(subscriptions).values({
    tenantId: tenant.id,
    planId: plan.id,
    status: 'trialing',
    trialEndsAt: addDays(new Date(), plan.trialDays),
  })

  return { tenant, branch, ownerRole, plan }
}
