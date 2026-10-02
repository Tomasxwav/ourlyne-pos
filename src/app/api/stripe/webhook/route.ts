import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { db } from '@/db'
import { subscriptions } from '@/db/schema'
import { syncStripeSubscription } from '@/server/billing'
import { getStripe } from '@/server/stripe'

/** Webhook de Stripe: mantiene sincronizadas las suscripciones de cada tenant. */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!process.env.STRIPE_SECRET_KEY || !secret) {
    return new Response('Stripe no configurado', { status: 501 })
  }
  const stripe = getStripe()
  const signature = request.headers.get('stripe-signature')
  if (!signature) return new Response('Falta firma', { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret)
  } catch (err) {
    console.error('[stripe] Firma inválida', err)
    return new Response('Firma inválida', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode === 'subscription' && session.subscription) {
          const id = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
          await syncStripeSubscription(await stripe.subscriptions.retrieve(id))
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.trial_will_end':
        await syncStripeSubscription(event.data.object)
        break
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const customer = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (customer) {
          const tenant = await db.query.tenants.findFirst({
            where: (t, { eq }) => eq(t.stripeCustomerId, customer),
          })
          if (tenant) {
            await db.update(subscriptions).set({ status: 'past_due' }).where(eq(subscriptions.tenantId, tenant.id))
          }
        }
        break
      }
    }
  } catch (err) {
    console.error('[stripe] Error procesando', event.type, err)
    return new Response('Error interno', { status: 500 })
  }

  return Response.json({ received: true })
}
