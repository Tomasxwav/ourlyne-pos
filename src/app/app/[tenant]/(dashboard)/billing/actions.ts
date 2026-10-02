'use server'

import { revalidatePath } from 'next/cache'
import { addMonths, addYears } from 'date-fns'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { plans, subscriptions } from '@/db/schema'
import { ActionError, authorize, logActivity, runAction, type ActionResult } from '@/server/action'
import { enablePlanModules, ensureStripeCustomer, syncStripeSubscription } from '@/server/billing'
import { appUrl, getStripe, isStripeEnabled } from '@/server/stripe'

type Interval = 'month' | 'year'

export async function changePlan(
  slug: string,
  planSlug: string,
  interval: Interval,
): Promise<ActionResult<{ url?: string }>> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'billing.manage', allowInactive: true })
    const plan = await db.query.plans.findFirst({ where: and(eq(plans.slug, planSlug), eq(plans.isActive, true)) })
    if (!plan) throw new ActionError('Plan no disponible.')
    const sub = ctx.subscription

    // Modo demo: sin Stripe, el cambio se aplica directo (útil en desarrollo).
    if (!isStripeEnabled()) {
      const now = new Date()
      const values = {
        planId: plan.id,
        status: 'active' as const,
        interval,
        currentPeriodStart: now,
        currentPeriodEnd: interval === 'year' ? addYears(now, 1) : addMonths(now, 1),
        cancelAtPeriodEnd: false,
        canceledAt: null,
      }
      await db.transaction(async (tx) => {
        if (sub) await tx.update(subscriptions).set(values).where(eq(subscriptions.id, sub.id))
        else await tx.insert(subscriptions).values({ ...values, tenantId: ctx.tenant.id })
        await enablePlanModules(tx, ctx.tenant.id, plan.modules)
        await logActivity(tx, ctx, { action: 'plan_change', entity: 'billing', summary: `Plan ${plan.name} (demo)` })
      })
      return {}
    }

    const priceId = interval === 'year' ? plan.stripePriceYearlyId : plan.stripePriceMonthlyId
    if (!priceId) throw new ActionError('Este plan aún no tiene precio en Stripe. Ejecuta `pnpm stripe:sync`.')
    const stripe = getStripe()

    // Ya tiene suscripción vigente en Stripe: cambio con prorrateo.
    if (sub?.stripeSubscriptionId && ['active', 'trialing', 'past_due'].includes(sub.status)) {
      const current = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId)
      const item = current.items.data[0]
      const updated = await stripe.subscriptions.update(current.id, {
        items: [{ id: item.id, price: priceId }],
        proration_behavior: 'create_prorations',
        cancel_at_period_end: false,
        metadata: { tenantId: ctx.tenant.id },
      })
      await syncStripeSubscription(updated)
      await logActivity(db, ctx, { action: 'plan_change', entity: 'billing', summary: `Plan ${plan.name}` })
      return {}
    }

    const customer = await ensureStripeCustomer(ctx.tenant, ctx.user.email)
    const trialEnd =
      sub?.status === 'trialing' && sub.trialEndsAt && sub.trialEndsAt.getTime() > Date.now() + 48 * 3600 * 1000
        ? Math.floor(sub.trialEndsAt.getTime() / 1000)
        : undefined
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      locale: 'es',
      client_reference_id: ctx.tenant.id,
      subscription_data: { metadata: { tenantId: ctx.tenant.id, planSlug: plan.slug }, trial_end: trialEnd },
      metadata: { tenantId: ctx.tenant.id },
      success_url: `${appUrl()}/app/${slug}/billing?checkout=success`,
      cancel_url: `${appUrl()}/app/${slug}/billing?checkout=cancel`,
    })
    if (!session.url) throw new ActionError('No se pudo iniciar el pago.')
    return { url: session.url }
  }, 'Plan actualizado')
  revalidatePath(`/app/${slug}`, 'layout')
  return res
}

export async function openBillingPortal(slug: string): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const ctx = await authorize(slug, { permission: 'billing.manage', allowInactive: true })
    if (!isStripeEnabled()) throw new ActionError('Stripe no está configurado (modo demo).')
    const customer = await ensureStripeCustomer(ctx.tenant, ctx.user.email)
    const portal = await getStripe().billingPortal.sessions.create({
      customer,
      return_url: `${appUrl()}/app/${slug}/billing`,
      locale: 'es',
    })
    return { url: portal.url }
  })
}

export async function cancelSubscription(slug: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'billing.manage', allowInactive: true })
    const sub = ctx.subscription
    if (!sub) throw new ActionError('No hay suscripción.')
    if (sub.stripeSubscriptionId && isStripeEnabled()) {
      const updated = await getStripe().subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true })
      await syncStripeSubscription(updated)
    } else {
      await db.update(subscriptions).set({ cancelAtPeriodEnd: true }).where(eq(subscriptions.id, sub.id))
    }
    await logActivity(db, ctx, { action: 'cancel', entity: 'billing', summary: 'Cancelación al final del periodo' })
  }, 'Tu suscripción se cancelará al final del periodo')
  revalidatePath(`/app/${slug}`, 'layout')
  return res
}

export async function resumeSubscription(slug: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ctx = await authorize(slug, { permission: 'billing.manage', allowInactive: true })
    const sub = ctx.subscription
    if (!sub) throw new ActionError('No hay suscripción.')
    if (sub.stripeSubscriptionId && isStripeEnabled()) {
      const updated = await getStripe().subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false })
      await syncStripeSubscription(updated)
    } else {
      await db.update(subscriptions).set({ cancelAtPeriodEnd: false }).where(eq(subscriptions.id, sub.id))
    }
  }, 'Suscripción reanudada')
  revalidatePath(`/app/${slug}`, 'layout')
  return res
}
