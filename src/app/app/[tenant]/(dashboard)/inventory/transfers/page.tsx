import type { Metadata } from 'next'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { and, desc, eq, sql } from 'drizzle-orm'
import { ArrowLeftRight, ArrowRight, Store } from 'lucide-react'
import { db } from '@/db'
import { branches, products, stockMovements, user } from '@/db/schema'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatQty } from '@/lib/money'
import { requireModule, requirePermission } from '@/server/tenant'
import { InventoryTabs } from '../inventory-tabs'
import { TransferForm } from './transfer-form'

export const metadata: Metadata = { title: 'Traspasos' }

export default async function TransfersPage(props: PageProps<'/app/[tenant]/inventory/transfers'>) {
  const { tenant: slug } = await props.params
  await requireModule(slug, 'inventory')
  const ctx = await requirePermission(slug, 'inventory.view')
  const multiBranch = ctx.branches.length > 1
  const canAdjust = ctx.can('inventory.adjust')

  if (!multiBranch) {
    return (
      <>
        <PageHeader title='Traspasos' description='Mueve existencias entre sucursales.' />
        <InventoryTabs slug={slug} transfers={false} />
        <EmptyState
          icon={<Store />}
          title='Necesitas al menos dos sucursales'
          description='Los traspasos permiten mover mercancía entre sucursales. Da de alta otra sucursal para usarlos.'
          action={
            ctx.can('settings.manage') && (
              <Link href={`/app/${slug}/settings/branches`} className={buttonVariants({ size: 'lg' })}>
                Administrar sucursales
              </Link>
            )
          }
        />
      </>
    )
  }

  const dest = sql<string | null>`(
    select b.name from ${stockMovements} m2
    join ${branches} b on b.id = m2.branch_id
    where m2.reference_id = ${stockMovements.referenceId} and m2.type = 'transfer_in' and m2.tenant_id = ${ctx.tenant.id}
    limit 1
  )`

  const recent = await db
    .select({
      id: stockMovements.referenceId,
      createdAt: sql<Date>`min(${stockMovements.createdAt})`.mapWith((v) => new Date(v)),
      from: branches.name,
      to: dest,
      note: sql<string | null>`max(${stockMovements.note})`,
      userName: sql<string | null>`max(${user.name})`,
      lines: sql<number>`count(*)::int`,
      units: sql<number>`(-sum(${stockMovements.quantity}))::float8`,
      items: sql<string>`string_agg(${products.name} || ' ×' || trim(trailing '.' from trim(trailing '0' from (-${stockMovements.quantity})::text)), ', ' order by ${products.name})`,
    })
    .from(stockMovements)
    .innerJoin(branches, eq(branches.id, stockMovements.branchId))
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .leftJoin(user, eq(user.id, stockMovements.userId))
    .where(
      and(
        eq(stockMovements.tenantId, ctx.tenant.id),
        eq(stockMovements.type, 'transfer_out'),
        eq(stockMovements.referenceType, 'transfer'),
      ),
    )
    .groupBy(stockMovements.referenceId, branches.name)
    .orderBy(desc(sql`min(${stockMovements.createdAt})`))
    .limit(15)

  return (
    <>
      <PageHeader
        eyebrow='Inventario'
        title='Traspasos'
        description='Mueve existencias entre sucursales y consulta los traspasos recientes.'
      />

      <InventoryTabs slug={slug} transfers />

      <div className='grid gap-4 xl:grid-cols-[1fr_26rem]'>
        {canAdjust ? (
          <TransferForm
            slug={slug}
            branches={ctx.branches.map((b) => ({ id: b.id, name: b.name }))}
            defaultFrom={ctx.branch?.id ?? ctx.branches[0].id}
            allowNegative={ctx.tenant.allowNegativeStock}
          />
        ) : (
          <EmptyState
            icon={<ArrowLeftRight />}
            title='Solo lectura'
            description='No tienes permiso para registrar traspasos. Consulta el historial a la derecha.'
          />
        )}

        <Card className='content-start'>
          <CardHeader>
            <CardTitle className='text-base'>Traspasos recientes</CardTitle>
          </CardHeader>
          <CardContent className='px-0'>
            {recent.length === 0 ? (
              <p className='px-4 pb-2 text-xs text-muted-foreground'>Aún no hay traspasos registrados.</p>
            ) : (
              <ul className='divide-y'>
                {recent.map((t) => {
                  const extra = t.note?.split(' · ').slice(1).join(' · ')
                  return (
                  <li key={t.id} className='px-4 py-3 text-xs'>
                    <div className='flex items-start justify-between gap-3'>
                      <p className='flex min-w-0 flex-wrap items-center gap-1.5 font-medium'>
                        {t.from}
                        <ArrowRight aria-hidden className='size-3.5 text-gold-deep dark:text-gold' />
                        {t.to ?? '—'}
                      </p>
                      <Link
                        href={`/app/${slug}/inventory/movements?type=transfer_out&branch=all`}
                        className='shrink-0 font-mono text-[0.65rem] text-muted-foreground'
                        title={t.id ?? ''}
                      >
                        {(t.id ?? '').slice(0, 8).toUpperCase()}
                      </Link>
                    </div>
                    <p className='mt-1 line-clamp-2 text-muted-foreground'>{t.items}</p>
                    {extra && <p className='mt-1 italic'>{extra}</p>}
                    <p className='mt-1 text-[0.65rem] text-muted-foreground'>
                      {format(t.createdAt, "d MMM yyyy, HH:mm", { locale: es })} · {t.userName ?? '—'} · {t.lines}{' '}
                      {t.lines === 1 ? 'producto' : 'productos'} · {formatQty(Math.round(t.units * 1000) / 1000)} u.
                    </p>
                  </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
