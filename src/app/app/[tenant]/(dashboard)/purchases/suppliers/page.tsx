import type { Metadata } from 'next'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { and, asc, count, eq, ilike, or, sql } from 'drizzle-orm'
import { Mail, Phone, Truck } from 'lucide-react'
import { db } from '@/db'
import { purchases, suppliers } from '@/db/schema'
import { EmptyState } from '@/components/app/empty-state'
import { Pagination, SearchInput } from '@/components/app/list-controls'
import { PageHeader } from '@/components/app/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { PAGE_SIZE, parsePage, str } from '@/lib/params'
import { requireModule, requirePermission } from '@/server/tenant'
import { PurchasesTabs } from '../purchases-tabs'
import { DeleteSupplierButton, SupplierDialog } from './supplier-dialog'

export const metadata: Metadata = { title: 'Proveedores' }

export default async function SuppliersPage(props: PageProps<'/app/[tenant]/purchases/suppliers'>) {
  const { tenant: slug } = await props.params
  const sp = await props.searchParams
  await requireModule(slug, 'purchases')
  const ctx = await requirePermission(slug, 'purchases.view')
  const q = str(sp.q)
  const page = parsePage(sp.page)
  const canManage = ctx.can('purchases.manage')

  const where = and(
    eq(suppliers.tenantId, ctx.tenant.id),
    q
      ? or(
          ilike(suppliers.name, `%${q}%`),
          ilike(suppliers.contactName, `%${q}%`),
          ilike(suppliers.email, `%${q}%`),
          ilike(suppliers.phone, `%${q}%`),
          ilike(suppliers.taxId, `%${q}%`),
        )
      : undefined,
  )

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        contactName: suppliers.contactName,
        phone: suppliers.phone,
        email: suppliers.email,
        taxId: suppliers.taxId,
        address: suppliers.address,
        notes: suppliers.notes,
        purchases: sql<number>`count(${purchases.id})::int`,
        purchased: sql<number>`coalesce(sum(${purchases.total}) filter (where ${purchases.status} <> 'cancelled'), 0)::bigint`,
        pending: sql<number>`coalesce(sum(${purchases.total} - ${purchases.paidTotal}) filter (where ${purchases.status} in ('ordered', 'received')), 0)::bigint`,
        lastPurchase: sql<Date | null>`max(${purchases.createdAt})`.mapWith((v) => (v ? new Date(v) : null)),
      })
      .from(suppliers)
      .leftJoin(purchases, and(eq(purchases.supplierId, suppliers.id), eq(purchases.tenantId, ctx.tenant.id)))
      .where(where)
      .groupBy(suppliers.id)
      .orderBy(asc(suppliers.name))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(suppliers).where(where),
  ])

  const money = (v: number) => formatMoney(Number(v), ctx.tenant.currency)

  return (
    <>
      <PageHeader
        eyebrow='Compras'
        title='Proveedores'
        description='Directorio de proveedores con su historial de compras.'
        actions={canManage && <SupplierDialog slug={slug} />}
      />

      <PurchasesTabs slug={slug} />

      <SearchInput placeholder='Nombre, contacto, correo o RFC' />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Truck />}
          title={q ? 'Sin resultados' : 'Aún no tienes proveedores'}
          description={q ? 'Prueba con otra búsqueda.' : 'Registra a tus proveedores para crear órdenes de compra.'}
          action={!q && canManage && <SupplierDialog slug={slug} />}
        />
      ) : (
        <div className='overflow-hidden rounded-xl border bg-card'>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead>Proveedor</TableHead>
                <TableHead className='hidden md:table-cell'>Contacto</TableHead>
                <TableHead className='hidden lg:table-cell'>RFC</TableHead>
                <TableHead className='text-right'>Compras</TableHead>
                <TableHead className='hidden text-right sm:table-cell'>Total comprado</TableHead>
                <TableHead className='hidden text-right xl:table-cell'>Por pagar</TableHead>
                {canManage && <TableHead className='w-16' />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className='max-w-60'>
                    <Link
                      href={`/app/${slug}/purchases?supplier=${s.id}`}
                      className='block truncate font-medium hover:underline'
                    >
                      {s.name}
                    </Link>
                    <span className='block truncate text-[0.65rem] text-muted-foreground'>
                      {s.lastPurchase
                        ? `Última compra ${format(s.lastPurchase, 'd MMM yyyy', { locale: es })}`
                        : 'Sin compras'}
                    </span>
                  </TableCell>
                  <TableCell className='hidden md:table-cell'>
                    <p>{s.contactName ?? '—'}</p>
                    <div className='flex flex-wrap gap-x-3 text-[0.65rem] text-muted-foreground'>
                      {s.phone && (
                        <a href={`tel:${s.phone}`} className='inline-flex items-center gap-1 hover:text-foreground'>
                          <Phone className='size-3' /> {s.phone}
                        </a>
                      )}
                      {s.email && (
                        <a href={`mailto:${s.email}`} className='inline-flex items-center gap-1 hover:text-foreground'>
                          <Mail className='size-3' /> {s.email}
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className='hidden font-mono text-muted-foreground lg:table-cell'>{s.taxId ?? '—'}</TableCell>
                  <TableCell className='text-right tabular-nums'>{s.purchases}</TableCell>
                  <TableCell className='hidden text-right font-medium tabular-nums sm:table-cell'>{money(s.purchased)}</TableCell>
                  <TableCell className='hidden text-right tabular-nums xl:table-cell'>
                    {Number(s.pending) > 0 ? (
                      <span className='text-destructive'>{money(s.pending)}</span>
                    ) : (
                      <span className='text-muted-foreground'>—</span>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className='flex justify-end gap-0.5'>
                        <SupplierDialog slug={slug} supplier={s} />
                        <DeleteSupplierButton slug={slug} id={s.id} name={s.name} purchases={s.purchases} />
                      </div>
                    </TableCell>
                  )}
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
