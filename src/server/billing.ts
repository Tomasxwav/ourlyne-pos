import 'server-only'
import type Stripe from 'stripe'
import { eq, or } from 'drizzle-orm'
import { db, type DbOrTx } from '@/db'
import { plans, subscriptions, tenantModules, tenants, type SubscriptionStatus } from '@/db/schema'
import { getStripe } from './stripe'

/** Activa los módulos incluidos en el plan (al contratar o cambiar de plan). */
export async function enablePlanModules(tx: DbOrTx, tenantId: string, modules: string[]) {
  for (const key of modules) {
    await tx
      .insert(tenantModules)
      .values({ tenantId, moduleKey: key, enabled: true })
      .onConflictDoUpdate({
        target: [tenantModules.tenantId, tenantModules.moduleKey],
        set: { enabled: true, updatedAt: new Date() },
      })
  }
}

const STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  canceled: 'canceled',
  unpaid: 'unpaid',
  incomplete: 'incomplete',
  incomplete_expired: 'canceled',
  paused: 'past_due',
}

const toDate = (s?: number | null) => (s ? new Date(s * 1000) : null)

/** Refleja en la base de datos el estado de una suscripción de Stripe. */
export async function syncStripeSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const tenantId = sub.metadata?.tenantId
  const tenant = await db.query.tenants.findFirst({
    where: tenantId ? eq(tenants.id, tenantId) : eq(tenants.stripeCustomerId, customerId),
  })
  if (!tenant) {
    console.warn('[stripe] Suscripción sin tenant', sub.id)
    return
  }

  const item = sub.items.data[0]
  const priceId = item?.price.id
  const plan = priceId
    ? await db.query.plans.findFirst({
        where: or(eq(plans.stripePriceMonthlyId, priceId), eq(plans.stripePriceYearlyId, priceId)),
      })
    : null
  const current = await db.query.subscriptions.findFirst({ where: eq(subscriptions.tenantId, tenant.id) })
  const planId = plan?.id ?? current?.planId
  if (!planId) return

  const values = {
    planId,
    status: STATUS_MAP[sub.status] ?? 'incomplete',
    interval: item?.price.recurring?.interval === 'year' ? ('year' as const) : ('month' as const),
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId ?? null,
    trialEndsAt: toDate(sub.trial_end),
    currentPeriodStart: toDate(item?.current_period_start),
    currentPeriodEnd: toDate(item?.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: toDate(sub.canceled_at),
  }

  await db.transaction(async (tx) => {
    if (!tenant.stripeCustomerId) {
      await tx.update(tenants).set({ stripeCustomerId: customerId }).where(eq(tenants.id, tenant.id))
    }
    if (current) {
      await tx.update(subscriptions).set(values).where(eq(subscriptions.id, current.id))
    } else {
      await tx.insert(subscriptions).values({ ...values, tenantId: tenant.id })
    }
    if (plan && plan.id !== current?.planId) await enablePlanModules(tx, tenant.id, plan.modules)
  })
}

/** Cliente de Stripe del tenant (lo crea si no existe). */
export async function ensureStripeCustomer(tenant: { id: string; name: string; email: string | null; stripeCustomerId: string | null }, email: string) {
  if (tenant.stripeCustomerId) return tenant.stripeCustomerId
  const customer = await getStripe().customers.create({
    name: tenant.name,
    email: tenant.email ?? email,
    metadata: { tenantId: tenant.id },
  })
  await db.update(tenants).set({ stripeCustomerId: customer.id }).where(eq(tenants.id, tenant.id))
  return customer.id
}
