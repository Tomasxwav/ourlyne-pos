import 'server-only'
import Stripe from 'stripe'

let client: Stripe | null = null

export const isStripeEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY)

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY no está configurada.')
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY, { appInfo: { name: 'Ourlyne POS' } })
  return client
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}
