import 'server-only'
import { asc, eq } from 'drizzle-orm'
import { DEFAULT_PLANS } from '@/lib/plans'
import PricingTable, { type PricingPlan } from '../pricing-table'

const DB_TIMEOUT_MS = 4000

function fallbackPlans(): PricingPlan[] {
  return DEFAULT_PLANS.map((p) => ({
    slug: p.slug,
    name: p.name,
    description: p.description,
    priceMonthly: p.priceMonthly,
    priceYearly: p.priceYearly,
    features: p.features,
    highlighted: Boolean(p.highlighted),
    trialDays: 14,
  }))
}

/** Lee los planes activos de la base; si no hay base disponible usa los de fábrica. */
async function loadPlans(): Promise<PricingPlan[]> {
  try {
    const [{ db }, { plans }] = await Promise.all([
      import('@/db'),
      import('@/db/schema'),
    ])
    const query = db.query.plans.findMany({
      where: eq(plans.isActive, true),
      orderBy: [asc(plans.sortOrder)],
    })
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS),
    )
    const rows = await Promise.race([query, timeout])
    if (!rows.length) return fallbackPlans()
    return rows.map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description ?? '',
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      features: p.features,
      highlighted: p.highlighted,
      trialDays: p.trialDays,
    }))
  } catch {
    return fallbackPlans()
  }
}

export default async function Pricing() {
  const plans = await loadPlans()
  return <PricingTable plans={plans} />
}
