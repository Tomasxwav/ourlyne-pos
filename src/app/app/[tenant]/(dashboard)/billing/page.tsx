import { tz } from '@date-fns/tz'
import type { Metadata } from 'next'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { and, asc, count, eq } from 'drizzle-orm'
import { db } from '@/db'
import { branches, members, plans, products, registers } from '@/db/schema'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge, type Tone } from '@/components/app/status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney } from '@/lib/money'
import { MODULES } from '@/lib/modules'
import { limitLabel } from '@/lib/plans'
import { cn } from '@/lib/utils'
import { getStripe, isStripeEnabled } from '@/server/stripe'
import { requirePermission } from '@/server/tenant'
import { BillingControls, PlanPicker } from './billing-client'

export const metadata: Metadata = { title: 'Facturación' }

const STATUS: Record<string, { label: string; tone: Tone }> = {
  trialing: { label: 'Periodo de prueba', tone: 'gold' },
  active: { label: 'Activa', tone: 'success' },
  past_due: { label: 'Pago pendiente', tone: 'warning' },
  canceled: { label: 'Cancelada', tone: 'danger' },
  incomplete: { label: 'Incompleta', tone: 'warning' },
  unpaid: { label: 'Sin pago', tone: 'danger' },
  none: { label: 'Sin suscripción', tone: 'neutral' },
}

export default async function BillingPage(props: PageProps<'/app/[tenant]/billing'>) {
  const { tenant: slug } = await props.params
  const sp = await props.searchParams
  const ctx = await requirePermission(slug, 'billing.manage')
  const tenantId = ctx.tenant.id
  const stripeOn = isStripeEnabled()

  const [planRows, [b], [m], [p], [r]] = await Promise.all([
    db.query.plans.findMany({ where: eq(plans.isActive, true), orderBy: [asc(plans.sortOrder)] }),
    db.select({ n: count() }).from(branches).where(and(eq(branches.tenantId, tenantId), eq(branches.isActive, true))),
    db.select({ n: count() }).from(members).where(and(eq(members.tenantId, tenantId), eq(members.isActive, true))),
    db.select({ n: count() }).from(products).where(eq(products.tenantId, tenantId)),
    db.select({ n: count() }).from(registers).where(and(eq(registers.tenantId, tenantId), eq(registers.isActive, true))),
  ])

  let invoices: { id: string; number: string | null; date: Date; amount: number; currency: string; status: string | null; url: string | null }[] = []
  if (stripeOn && ctx.tenant.stripeCustomerId) {
    try {
      const list = await getStripe().invoices.list({ customer: ctx.tenant.stripeCustomerId, limit: 12 })
      invoices = list.data.map((i) => ({
        id: i.id ?? '',
        number: i.number,
        date: new Date(i.created * 1000),
        amount: i.amount_paid || i.amount_due,
        currency: i.currency.toUpperCase(),
        status: i.status ?? null,
        url: i.hosted_invoice_url ?? null,
      }))
    } catch (err) {
      console.error('[stripe] invoices', err)
    }
  }

  const sub = ctx.subscription
  const plan = ctx.plan
  const status = STATUS[ctx.billing.status] ?? STATUS.none
  const limits = plan?.limits
  const usage = [
    { label: 'Sucursales', used: b.n, limit: limits?.branches ?? 0 },
    { label: 'Usuarios', used: m.n, limit: limits?.users ?? 0 },
    { label: 'Productos', used: p.n, limit: limits?.products ?? 0 },
    { label: 'Cajas', used: r.n, limit: limits?.registers ?? 0 },
  ]

  return (
    <>
      <PageHeader title='Facturación' description='Tu plan, consumo y método de pago.' />

      {sp.checkout === 'success' && (
        <div className='rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success'>
          ¡Gracias! Tu pago se está procesando; el plan se actualizará en unos segundos.
        </div>
      )}
      {!stripeOn && (
        <div className='rounded-xl border border-gold/40 bg-gold/10 p-4 text-xs'>
          <strong>Modo demo:</strong> Stripe no está configurado (<code>STRIPE_SECRET_KEY</code>). Los cambios de plan se
          aplican al instante sin cobro.
        </div>
      )}

      <div className='grid gap-4 lg:grid-cols-[1.2fr_1fr]'>
        <Card className='relative overflow-hidden'>
          <div aria-hidden className='absolute -top-20 -right-20 size-64 rounded-full bg-gold/15 blur-3xl' />
          <CardHeader>
            <CardDescription className='text-[0.65rem] tracking-[0.2em] uppercase'>Plan actual</CardDescription>
            <CardTitle className='flex flex-wrap items-center gap-3 font-heading text-3xl'>
              {plan?.name ?? 'Sin plan'}
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {plan && (
              <p className='text-sm text-muted-foreground'>
                <span className='font-heading text-2xl font-semibold text-foreground tabular-nums'>
                  {formatMoney(sub?.interval === 'year' ? plan.priceYearly : plan.priceMonthly, plan.currency.toUpperCase())}
                </span>{' '}
                / {sub?.interval === 'year' ? 'año' : 'mes'}
              </p>
            )}
            <div className='grid gap-1 text-xs text-muted-foreground'>
              {ctx.billing.status === 'trialing' && sub?.trialEndsAt && (
                <p>
                  Prueba hasta el <strong className='text-foreground'>{format(sub.trialEndsAt, "d 'de' MMMM yyyy", { locale: es, in: tz(ctx.tenant.timezone) })}</strong>
                  {ctx.billing.trialDaysLeft !== null && ` (${ctx.billing.trialDaysLeft} días)`}
                </p>
              )}
              {sub?.currentPeriodEnd && ctx.billing.status !== 'trialing' && (
                <p>
                  {sub.cancelAtPeriodEnd ? 'Termina el' : 'Próxima renovación:'}{' '}
                  <strong className='text-foreground'>{format(sub.currentPeriodEnd, "d 'de' MMMM yyyy", { locale: es, in: tz(ctx.tenant.timezone) })}</strong>
                </p>
              )}
              {ctx.billing.warning && <p className='text-destructive'>{ctx.billing.warning}</p>}
            </div>
            {plan && (
              <div className='flex flex-wrap gap-1.5'>
                {plan.modules.map((k) => (
                  <span key={k} className='rounded-full border px-2 py-0.5 text-[0.65rem]'>
                    {MODULES[k as keyof typeof MODULES]?.name ?? k}
                  </span>
                ))}
              </div>
            )}
            <BillingControls
              slug={slug}
              stripe={stripeOn}
              hasStripeCustomer={Boolean(ctx.tenant.stripeCustomerId)}
              canCancel={Boolean(sub) && !sub?.cancelAtPeriodEnd && ctx.billing.status !== 'canceled'}
              canResume={Boolean(sub?.cancelAtPeriodEnd)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Consumo del plan</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {usage.map((u) => {
              const unlimited = u.limit < 0
              const pct = unlimited ? 8 : Math.min(100, (u.used / Math.max(1, u.limit)) * 100)
              return (
                <div key={u.label}>
                  <div className='flex justify-between text-xs'>
                    <span>{u.label}</span>
                    <span className='text-muted-foreground tabular-nums'>
                      {u.used} / {limitLabel(u.limit)}
                    </span>
                  </div>
                  <div className='mt-1.5 h-2 overflow-hidden rounded-full bg-muted'>
                    <div
                      className={cn('h-full rounded-full', pct >= 90 && !unlimited ? 'bg-destructive' : 'bg-chart-1')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <PlanPicker
        slug={slug}
        currentPlan={plan?.slug ?? null}
        currentInterval={sub?.interval ?? 'month'}
        active={ctx.billing.status === 'active'}
        plans={planRows.map((pl) => ({
          slug: pl.slug,
          name: pl.name,
          description: pl.description ?? '',
          priceMonthly: pl.priceMonthly,
          priceYearly: pl.priceYearly,
          currency: pl.currency.toUpperCase(),
          features: pl.features,
          highlighted: pl.highlighted,
        }))}
      />

      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Facturas</CardTitle>
          </CardHeader>
          <CardContent className='divide-y px-0 text-xs'>
            {invoices.map((i) => (
              <div key={i.id} className='flex items-center gap-3 px-4 py-2.5'>
                <span className='w-28 text-muted-foreground'>{format(i.date, 'd MMM yyyy', { locale: es, in: tz(ctx.tenant.timezone) })}</span>
                <span className='flex-1 font-mono'>{i.number ?? i.id}</span>
                <StatusBadge tone={i.status === 'paid' ? 'success' : 'warning'}>{i.status === 'paid' ? 'Pagada' : (i.status ?? '—')}</StatusBadge>
                <span className='w-24 text-right tabular-nums'>{formatMoney(i.amount, i.currency)}</span>
                {i.url && (
                  <a href={i.url} target='_blank' rel='noreferrer' className='font-medium underline underline-offset-4'>
                    Ver
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  )
}
