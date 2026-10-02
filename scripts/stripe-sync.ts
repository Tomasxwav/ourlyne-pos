/**
 * Crea en Stripe los productos y precios (mensual/anual) de cada plan que aún
 * no los tenga y guarda sus IDs en la base de datos.
 *
 *   STRIPE_SECRET_KEY=sk_test_... pnpm stripe:sync
 */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { createDb } from '../src/db/client'
import { plans } from '../src/db/schema'

async function main() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Define STRIPE_SECRET_KEY')
  const stripe = new Stripe(key)
  const db = createDb()
  const rows = await db.select().from(plans)

  for (const plan of rows) {
    let productId = plan.stripeProductId
    if (!productId) {
      const product = await stripe.products.create({
        name: `Ourlyne POS · ${plan.name}`,
        description: plan.description ?? undefined,
        metadata: { planSlug: plan.slug },
      })
      productId = product.id
    }
    const monthly =
      plan.stripePriceMonthlyId ??
      (
        await stripe.prices.create({
          product: productId,
          currency: plan.currency,
          unit_amount: plan.priceMonthly,
          recurring: { interval: 'month' },
          lookup_key: `${plan.slug}_monthly`,
          transfer_lookup_key: true,
        })
      ).id
    const yearly =
      plan.stripePriceYearlyId ??
      (
        await stripe.prices.create({
          product: productId,
          currency: plan.currency,
          unit_amount: plan.priceYearly,
          recurring: { interval: 'year' },
          lookup_key: `${plan.slug}_yearly`,
          transfer_lookup_key: true,
        })
      ).id
    await db
      .update(plans)
      .set({ stripeProductId: productId, stripePriceMonthlyId: monthly, stripePriceYearlyId: yearly })
      .where(eq(plans.id, plan.id))
    console.log(`✓ ${plan.name}: ${monthly} / ${yearly}`)
  }
  if (process.env.DATABASE_URL) await (db.$client as { end: () => Promise<void> }).end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
