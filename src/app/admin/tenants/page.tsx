import type { Metadata } from 'next'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { asc, desc, ilike, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { plans, tenants } from '@/db/schema'
import { SearchInput } from '@/components/app/list-controls'
import { PageHeader } from '@/components/app/page-header'
import { StatusBadge } from '@/components/app/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { str } from '@/lib/params'
import { getBillingState } from '@/server/billing-state'
import { TenantAdminActions } from './tenant-actions'

export const metadata: Metadata = { title: 'Negocios' }

export default async function AdminTenants(props: PageProps<'/admin/tenants'>) {
  const sp = await props.searchParams
  const q = str(sp.q)
  const [rows, planRows] = await Promise.all([
    db.query.tenants.findMany({
      where: q ? or(ilike(tenants.name, `%${q}%`), ilike(tenants.slug, `%${q}%`)) : undefined,
      orderBy: [desc(tenants.createdAt)],
      limit: 100,
      with: {
        owner: { columns: { email: true, name: true } },
        subscription: { with: { plan: true } },
        members: { columns: { id: true } },
      },
      extras: {
        orders30: sql<number>`(select count(*)::int from orders o where o.tenant_id = ${tenants.id} and o.created_at > now() - interval '30 days')`.as('orders30'),
      },
    }),
    db.query.plans.findMany({ orderBy: [asc(plans.sortOrder)] }),
  ])

  return (
    <>
      <PageHeader eyebrow='Plataforma' title='Negocios' description={`${rows.length} negocios`} />
      <SearchInput placeholder='Nombre o slug' />
      <div className='overflow-hidden rounded-xl border bg-card'>
        <Table>
          <TableHeader>
            <TableRow className='hover:bg-transparent'>
              <TableHead>Negocio</TableHead>
              <TableHead className='hidden md:table-cell'>Propietario</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className='hidden text-right lg:table-cell'>Usuarios</TableHead>
              <TableHead className='hidden text-right lg:table-cell'>Ventas 30d</TableHead>
              <TableHead className='hidden md:table-cell'>Alta</TableHead>
              <TableHead className='w-0' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => {
              const billing = getBillingState(t.subscription, t.subscription?.plan)
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <p className='font-medium'>{t.name}</p>
                    <p className='font-mono text-[0.65rem] text-muted-foreground'>/{t.slug}</p>
                  </TableCell>
                  <TableCell className='hidden md:table-cell'>
                    <p>{t.owner.name}</p>
                    <p className='text-[0.65rem] text-muted-foreground'>{t.owner.email}</p>
                  </TableCell>
                  <TableCell>
                    <div className='flex flex-wrap gap-1'>
                      <StatusBadge tone='gold'>{t.subscription?.plan.name ?? '—'}</StatusBadge>
                      {t.suspendedAt ? (
                        <StatusBadge tone='danger'>Suspendido</StatusBadge>
                      ) : (
                        <StatusBadge tone={billing.active ? (billing.status === 'trialing' ? 'info' : 'success') : 'danger'}>
                          {billing.status === 'trialing' ? `Prueba · ${billing.trialDaysLeft ?? 0}d` : billing.status}
                        </StatusBadge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className='hidden text-right tabular-nums lg:table-cell'>{t.members.length}</TableCell>
                  <TableCell className='hidden text-right tabular-nums lg:table-cell'>{t.orders30}</TableCell>
                  <TableCell className='hidden text-muted-foreground md:table-cell'>{format(t.createdAt, 'd MMM yyyy', { locale: es })}</TableCell>
                  <TableCell>
                    <TenantAdminActions
                      tenantId={t.id}
                      suspended={Boolean(t.suspendedAt)}
                      planId={t.subscription?.planId ?? ''}
                      plans={planRows.map((p) => ({ id: p.id, name: p.name }))}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
