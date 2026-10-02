import type { Metadata } from 'next'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { and, count, desc, eq, gt, ilike, or, sql } from 'drizzle-orm'
import { CircleDollarSign, Coins, UserPlus, Users } from 'lucide-react'
import { db } from '@/db'
import { customers } from '@/db/schema'
import { EmptyState } from '@/components/app/empty-state'
import { FilterSelect, Pagination, SearchInput } from '@/components/app/list-controls'
import { PageHeader } from '@/components/app/page-header'
import { StatTile } from '@/components/app/stat-tile'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney, formatNumber } from '@/lib/money'
import { PAGE_SIZE, parsePage, str } from '@/lib/params'
import { getCustomerStats } from '@/server/queries/customers'
import { requireModule, requirePermission } from '@/server/tenant'
import { CustomerDialog } from './customer-dialog'
import { initials } from './utils'

export const metadata: Metadata = { title: 'Clientes' }

const SORTS = {
  recent: [sql`${customers.lastPurchaseAt} desc nulls last`, desc(customers.createdAt)],
  spent: [desc(customers.totalSpent)],
  balance: [desc(customers.balance)],
  name: [sql`lower(${customers.name})`],
} as const

export default async function CustomersPage(props: PageProps<'/app/[tenant]/customers'>) {
  const { tenant: slug } = await props.params
  const sp = await props.searchParams
  await requireModule(slug, 'customers')
  const ctx = await requirePermission(slug, 'customers.view')
  const q = str(sp.q)
  const filter = str(sp.filter)
  const sortKey = (str(sp.sort) ?? 'recent') as keyof typeof SORTS
  const sort = SORTS[sortKey] ?? SORTS.recent
  const page = parsePage(sp.page)

  const where = and(
    eq(customers.tenantId, ctx.tenant.id),
    q
      ? or(ilike(customers.name, `%${q}%`), ilike(customers.phone, `%${q}%`), ilike(customers.email, `%${q}%`))
      : undefined,
    filter === 'balance' ? gt(customers.balance, 0) : undefined,
    filter === 'credit' ? gt(customers.creditLimit, 0) : undefined,
  )

  const [rows, [{ total }], stats] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(where)
      .orderBy(...sort, desc(customers.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(customers).where(where),
    getCustomerStats(ctx.tenant.id, ctx.tenant.timezone),
  ])

  const canManage = ctx.can('customers.manage')
  const money = (v: number) => formatMoney(v, ctx.tenant.currency)
  const filtered = Boolean(q || filter)

  return (
    <>
      <PageHeader
        title='Clientes'
        description='Directorio, historial de compras, crédito y puntos de lealtad.'
        actions={canManage && <CustomerDialog slug={slug} />}
      />

      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4'>
        <StatTile label='Clientes' icon={<Users />} value={formatNumber(stats.total)} hint='registrados' />
        <StatTile
          label='Saldo pendiente'
          icon={<CircleDollarSign />}
          value={money(stats.balance)}
          hint={`${formatNumber(stats.withBalance)} ${stats.withBalance === 1 ? 'cliente' : 'clientes'} con adeudo`}
        />
        <StatTile label='Ticket promedio' icon={<Coins />} value={money(stats.avgTicket)} hint='de clientes registrados' />
        <StatTile label='Nuevos este mes' icon={<UserPlus />} value={formatNumber(stats.newThisMonth)} hint='altas del mes' />
      </div>

      <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
        <SearchInput placeholder='Nombre, teléfono o correo' />
        <FilterSelect
          param='filter'
          allLabel='Todos los clientes'
          options={[
            { value: 'balance', label: 'Con saldo' },
            { value: 'credit', label: 'Con crédito' },
          ]}
        />
        <FilterSelect
          param='sort'
          allLabel='Compra más reciente'
          options={[
            { value: 'spent', label: 'Mayor gasto' },
            { value: 'balance', label: 'Mayor saldo' },
            { value: 'name', label: 'Nombre (A–Z)' },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={filtered ? 'Sin resultados' : 'Aún no tienes clientes'}
          description={
            filtered
              ? 'Prueba con otros filtros.'
              : 'Registra a tus clientes para darles crédito, acumular puntos y conocer sus compras.'
          }
          action={!filtered && canManage && <CustomerDialog slug={slug} />}
        />
      ) : (
        <div className='overflow-hidden rounded-xl border bg-card'>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead>Cliente</TableHead>
                <TableHead className='hidden text-right sm:table-cell'>Compras</TableHead>
                <TableHead className='hidden text-right md:table-cell'>Total gastado</TableHead>
                <TableHead className='hidden xl:table-cell'>Última compra</TableHead>
                <TableHead className='hidden text-right lg:table-cell'>Puntos</TableHead>
                <TableHead className='text-right'>Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className='max-w-0 w-full sm:max-w-none sm:w-auto'>
                    <Link href={`/app/${slug}/customers/${c.id}`} className='group flex items-center gap-3'>
                      <span className='flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-[0.65rem] font-semibold text-gold-deep ring-1 ring-gold/30 dark:text-gold'>
                        {initials(c.name)}
                      </span>
                      <span className='min-w-0'>
                        <span className='block truncate font-medium group-hover:underline'>{c.name}</span>
                        <span className='block truncate text-[0.65rem] text-muted-foreground'>
                          {[c.phone, c.email].filter(Boolean).join(' · ') || 'Sin contacto'}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className='hidden text-right tabular-nums sm:table-cell'>{formatNumber(c.ordersCount)}</TableCell>
                  <TableCell className='hidden text-right font-medium tabular-nums md:table-cell'>{money(c.totalSpent)}</TableCell>
                  <TableCell className='hidden text-muted-foreground xl:table-cell'>
                    {c.lastPurchaseAt ? formatDistanceToNow(c.lastPurchaseAt, { locale: es, addSuffix: true }) : '—'}
                  </TableCell>
                  <TableCell className='hidden text-right tabular-nums lg:table-cell'>{formatNumber(c.loyaltyPoints)}</TableCell>
                  <TableCell className='text-right tabular-nums'>
                    {c.balance > 0 ? (
                      <span className='font-semibold text-destructive'>{money(c.balance)}</span>
                    ) : (
                      <span className='text-muted-foreground'>{money(0)}</span>
                    )}
                    {c.creditLimit > 0 && (
                      <span className='block text-[0.65rem] text-muted-foreground'>de {money(c.creditLimit)}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className='border-t px-4 py-2.5'>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} searchParams={sp} />
          </div>
        </div>
      )}
    </>
  )
}

