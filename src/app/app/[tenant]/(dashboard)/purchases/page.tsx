import { tz } from '@date-fns/tz'
import type { Metadata } from 'next'
import Link from 'next/link'
import { format, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { and, asc, count, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import { ClipboardList, Plus } from 'lucide-react'
import { db } from '@/db'
import { branches, PURCHASE_STATUS, purchases, suppliers } from '@/db/schema'
import { EmptyState } from '@/components/app/empty-state'
import { DateRangeFilter, FilterSelect, Pagination, SearchInput } from '@/components/app/list-controls'
import { PageHeader } from '@/components/app/page-header'
import { StatTile } from '@/components/app/stat-tile'
import { StatusBadge } from '@/components/app/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { folio, formatMoney, formatNumber } from '@/lib/money'
import { PAGE_SIZE, parseDate, parsePage, str } from '@/lib/params'
import { requireModule, requirePermission } from '@/server/tenant'
import { PURCHASE_PAYMENT_UI, PURCHASE_STATUS_UI } from './labels'
import { PurchasesTabs } from './purchases-tabs'

export const metadata: Metadata = { title: 'Compras' }

const UUID = /^[0-9a-f-]{36}$/i

export default async function PurchasesPage(props: PageProps<'/app/[tenant]/purchases'>) {
  const { tenant: slug } = await props.params
  const sp = await props.searchParams
  await requireModule(slug, 'purchases')
  const ctx = await requirePermission(slug, 'purchases.view')
  const q = str(sp.q)
  const status = PURCHASE_STATUS.find((s) => s === str(sp.status))
  const payment = str(sp.payment)
  const supplierParam = str(sp.supplier)
  const supplierId = supplierParam && UUID.test(supplierParam) ? supplierParam : undefined
  const from = parseDate(sp.from)
  const to = parseDate(sp.to, true)
  const page = parsePage(sp.page)
  const qNumber = q && /^\D*0*(\d+)$/.exec(q)?.[1]
  const tenantId = ctx.tenant.id

  const where = and(
    eq(purchases.tenantId, tenantId),
    status ? eq(purchases.status, status) : undefined,
    payment === 'pending'
      ? and(or(eq(purchases.status, 'ordered'), eq(purchases.status, 'received')), sql`${purchases.paidTotal} < ${purchases.total}`)
      : undefined,
    supplierId ? eq(purchases.supplierId, supplierId) : undefined,
    from ? gte(purchases.createdAt, from) : undefined,
    to ? lte(purchases.createdAt, to) : undefined,
    q ? or(qNumber ? eq(purchases.number, Number(qNumber)) : undefined, ilike(suppliers.name, `%${q}%`)) : undefined,
  )

  const monthStart = startOfMonth(new Date())

  const [rows, [{ total }], supplierRows, [stats]] = await Promise.all([
    db
      .select({
        id: purchases.id,
        number: purchases.number,
        status: purchases.status,
        paymentStatus: purchases.paymentStatus,
        total: purchases.total,
        paidTotal: purchases.paidTotal,
        createdAt: purchases.createdAt,
        expectedAt: purchases.expectedAt,
        receivedAt: purchases.receivedAt,
        supplier: suppliers.name,
        branch: branches.name,
        items: sql<number>`(select count(*)::int from purchase_items pi where pi.purchase_id = ${purchases.id})`,
      })
      .from(purchases)
      .leftJoin(suppliers, eq(suppliers.id, purchases.supplierId))
      .leftJoin(branches, eq(branches.id, purchases.branchId))
      .where(where)
      .orderBy(desc(purchases.createdAt), desc(purchases.number))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(purchases)
      .leftJoin(suppliers, eq(suppliers.id, purchases.supplierId))
      .where(where),
    db.query.suppliers.findMany({
      where: eq(suppliers.tenantId, tenantId),
      orderBy: [asc(suppliers.name)],
      columns: { id: true, name: true },
    }),
    db
      .select({
        toReceive: sql<number>`count(*) filter (where ${purchases.status} = 'ordered')::int`,
        toReceiveTotal: sql<number>`coalesce(sum(${purchases.total}) filter (where ${purchases.status} = 'ordered'), 0)::bigint`,
        toPay: sql<number>`coalesce(sum(${purchases.total} - ${purchases.paidTotal}) filter (where ${purchases.status} in ('ordered', 'received')), 0)::bigint`,
        toPayCount: sql<number>`count(*) filter (where ${purchases.status} in ('ordered', 'received') and ${purchases.paidTotal} < ${purchases.total})::int`,
        month: sql<number>`coalesce(sum(${purchases.total}) filter (where ${purchases.status} in ('ordered', 'received') and ${gte(purchases.createdAt, monthStart)}), 0)::bigint`,
        monthCount: sql<number>`count(*) filter (where ${purchases.status} in ('ordered', 'received') and ${gte(purchases.createdAt, monthStart)})::int`,
        drafts: sql<number>`count(*) filter (where ${purchases.status} = 'draft')::int`,
      })
      .from(purchases)
      .where(eq(purchases.tenantId, tenantId)),
  ])

  const money = (v: number) => formatMoney(Number(v), ctx.tenant.currency)
  const canManage = ctx.can('purchases.manage')
  const multiBranch = ctx.branches.length > 1
  const filtered = Boolean(q || status || payment || supplierId || from || to)
  const base = `/app/${slug}/purchases`

  return (
    <>
      <PageHeader
        title='Compras'
        description='Órdenes de compra, recepción de mercancía y cuentas por pagar a proveedores.'
        actions={
          canManage && (
            <Link href={`${base}/new`} className={buttonVariants({ size: 'lg' })}>
              <Plus /> Nueva compra
            </Link>
          )
        }
      />

      <PurchasesTabs slug={slug} />

      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <Link href={`${base}?status=ordered`} className='rounded-xl focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none'>
          <StatTile
            label='Por recibir'
            value={formatNumber(stats.toReceive)}
            hint={stats.toReceive ? money(stats.toReceiveTotal) : 'Sin pendientes'}
          />
        </Link>
        <Link href={`${base}?payment=pending`} className='rounded-xl focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none'>
          <StatTile
            label='Por pagar'
            value={money(stats.toPay)}
            hint={`${formatNumber(stats.toPayCount)} ${stats.toPayCount === 1 ? 'orden' : 'órdenes'}`}
            className={Number(stats.toPay) > 0 ? 'border-warning/40' : undefined}
          />
        </Link>
        <StatTile
          label='Compras del mes'
          value={money(stats.month)}
          hint={`${formatNumber(stats.monthCount)} ${stats.monthCount === 1 ? 'orden' : 'órdenes'} en ${format(monthStart, 'MMMM', { locale: es, in: tz(ctx.tenant.timezone) })}`}
        />
        <Link href={`${base}?status=draft`} className='rounded-xl focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none'>
          <StatTile label='Borradores' value={formatNumber(stats.drafts)} hint='Sin emitir' />
        </Link>
      </div>

      <div className='flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center'>
        <SearchInput placeholder='Folio o proveedor' className='sm:w-56' />
        <FilterSelect
          param='status'
          allLabel='Todos los estados'
          options={Object.entries(PURCHASE_STATUS_UI).map(([value, s]) => ({ value, label: s.label }))}
        />
        <FilterSelect
          param='supplier'
          allLabel='Todos los proveedores'
          options={supplierRows.map((s) => ({ value: s.id, label: s.name }))}
        />
        <FilterSelect param='payment' allLabel='Cualquier pago' options={[{ value: 'pending', label: 'Con saldo pendiente' }]} />
        <DateRangeFilter />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title={filtered ? 'Sin resultados' : 'Aún no hay compras'}
          description={
            filtered ? 'No hay compras con estos filtros.' : 'Crea una orden de compra para abastecer tu inventario.'
          }
          action={
            !filtered &&
            canManage && (
              <Link href={`${base}/new`} className={buttonVariants({ size: 'lg' })}>
                <Plus /> Crear la primera
              </Link>
            )
          }
        />
      ) : (
        <div className='overflow-hidden rounded-xl border bg-card'>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead>Folio</TableHead>
                <TableHead>Proveedor</TableHead>
                {multiBranch && <TableHead className='hidden xl:table-cell'>Sucursal</TableHead>}
                <TableHead className='hidden md:table-cell'>Fechas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className='text-right'>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const st = PURCHASE_STATUS_UI[p.status]
                const pay = PURCHASE_PAYMENT_UI[p.paymentStatus]
                const pending = p.total - p.paidTotal
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`${base}/${p.id}`} className='font-mono font-medium hover:underline'>
                        {folio('OC', p.number)}
                      </Link>
                      <span className='block text-[0.65rem] text-muted-foreground'>
                        {p.items} {p.items === 1 ? 'artículo' : 'artículos'}
                      </span>
                    </TableCell>
                    <TableCell className='max-w-48'>
                      <span className='block truncate'>{p.supplier ?? <span className='text-muted-foreground'>Sin proveedor</span>}</span>
                      <span className='block text-[0.65rem] text-muted-foreground md:hidden'>
                        {format(p.createdAt, 'd MMM yyyy', { locale: es, in: tz(ctx.tenant.timezone) })}
                      </span>
                    </TableCell>
                    {multiBranch && <TableCell className='hidden text-muted-foreground xl:table-cell'>{p.branch}</TableCell>}
                    <TableCell className='hidden text-muted-foreground md:table-cell'>
                      <span className='block'>Creada {format(p.createdAt, 'd MMM yyyy', { locale: es, in: tz(ctx.tenant.timezone) })}</span>
                      <span className='block text-[0.65rem]'>
                        {p.receivedAt
                          ? `Recibida ${format(p.receivedAt, 'd MMM', { locale: es, in: tz(ctx.tenant.timezone) })}`
                          : p.expectedAt && p.status !== 'cancelled'
                            ? `Esperada ${format(p.expectedAt, 'd MMM', { locale: es, in: tz(ctx.tenant.timezone) })}`
                            : ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className='flex flex-wrap gap-1'>
                        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                        {p.status !== 'cancelled' && p.status !== 'draft' && (
                          <StatusBadge tone={pay.tone}>{pay.label}</StatusBadge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      <span className={p.status === 'cancelled' ? 'text-muted-foreground line-through' : 'font-medium'}>
                        {money(p.total)}
                      </span>
                      {pending > 0 && p.paidTotal > 0 && p.status !== 'cancelled' && (
                        <span className='block text-[0.65rem] text-destructive'>Saldo {money(pending)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
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
