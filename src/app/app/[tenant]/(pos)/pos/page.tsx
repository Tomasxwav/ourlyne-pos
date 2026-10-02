import type { Metadata } from 'next'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { categories, paymentMethods, products, registers, stockLevels, taxes } from '@/db/schema'
import { getActiveRegister, getOpenSessionForRegister } from '@/server/registers'
import { requirePermission } from '@/server/tenant'
import { PosTerminal } from './pos-terminal'
import { RegisterGate } from './register-gate'

export const metadata: Metadata = { title: 'Punto de venta' }

export default async function PosPage(props: PageProps<'/app/[tenant]/pos'>) {
  const { tenant: slug } = await props.params
  const ctx = await requirePermission(slug, 'pos.sell')
  const branchId = ctx.branch?.id ?? ''

  const business = {
    name: ctx.tenant.name,
    address: ctx.tenant.address,
    phone: ctx.tenant.phone,
    taxId: ctx.tenant.taxId,
    header: ctx.tenant.receiptHeader,
    footer: ctx.tenant.receiptFooter,
    currency: ctx.tenant.currency,
  }

  let sessionInfo: { registerName: string; openedBy: string; openedAt: string } | null = null
  if (ctx.hasModule('registers')) {
    const { register, session } = await getActiveRegister(ctx)
    if (!register || !session) {
      const branchRegisters = await db.query.registers.findMany({
        where: and(eq(registers.tenantId, ctx.tenant.id), eq(registers.branchId, branchId), eq(registers.isActive, true)),
        orderBy: [asc(registers.name)],
      })
      const withSessions = await Promise.all(
        branchRegisters.map(async (r) => {
          const s = await getOpenSessionForRegister(db, r.id)
          return {
            id: r.id,
            name: r.name,
            session: s ? { openedBy: s.openedBy.name, openedAt: s.openedAt.toISOString(), opening: s.openingAmount } : null,
          }
        }),
      )
      return (
        <RegisterGate
          slug={slug}
          branchName={ctx.branch?.name ?? ''}
          registers={withSessions}
          currency={ctx.tenant.currency}
          canOperate={ctx.can('registers.operate')}
        />
      )
    }
    sessionInfo = {
      registerName: register.name,
      openedBy: session.openedBy.name,
      openedAt: session.openedAt.toISOString(),
    }
  }

  const [productRows, categoryRows, methodRows] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        barcode: products.barcode,
        price: products.price,
        unit: products.unit,
        trackStock: products.trackStock,
        imageUrl: products.imageUrl,
        categoryId: products.categoryId,
        color: categories.color,
        taxRateBps: taxes.rateBps,
        stock: stockLevels.quantity,
      })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(taxes, eq(taxes.id, products.taxId))
      .leftJoin(stockLevels, and(eq(stockLevels.productId, products.id), eq(stockLevels.branchId, branchId)))
      .where(and(eq(products.tenantId, ctx.tenant.id), eq(products.isActive, true)))
      .orderBy(asc(products.name)),
    db.query.categories.findMany({
      where: eq(categories.tenantId, ctx.tenant.id),
      orderBy: [asc(categories.sortOrder), asc(categories.name)],
    }),
    db.query.paymentMethods.findMany({
      where: and(eq(paymentMethods.tenantId, ctx.tenant.id), eq(paymentMethods.isActive, true)),
      orderBy: [asc(paymentMethods.sortOrder)],
    }),
  ])

  const hasCustomers = ctx.hasModule('customers')

  return (
    <PosTerminal
      slug={slug}
      business={business}
      branchName={ctx.branch?.name ?? ''}
      cashier={ctx.user.name}
      session={sessionInfo}
      pricesIncludeTax={ctx.tenant.pricesIncludeTax}
      trackInventory={ctx.hasModule('inventory')}
      allowNegativeStock={ctx.tenant.allowNegativeStock}
      products={productRows.map((p) => ({
        ...p,
        taxRateBps: p.taxRateBps ?? 0,
        stock: p.stock === null ? 0 : Number(p.stock),
      }))}
      categories={categoryRows.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
      paymentMethods={methodRows
        .filter((m) => m.type !== 'credit' || hasCustomers)
        .map((m) => ({ id: m.id, name: m.name, type: m.type }))}
      permissions={{
        discount: ctx.can('pos.discount'),
        customers: hasCustomers && ctx.can('customers.view'),
        createCustomer: hasCustomers && ctx.can('customers.manage'),
        coupons: ctx.hasModule('coupons'),
        orders: ctx.can('orders.view'),
        registers: ctx.can('registers.operate'),
        dashboard: ctx.can('dashboard.view'),
      }}
      billingActive={ctx.billing.active}
    />
  )
}
