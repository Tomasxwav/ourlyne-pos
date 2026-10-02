/**
 * Seed de desarrollo: planes, usuarios demo y un negocio de ejemplo con
 * catálogo, inventario, clientes, compras, cortes de caja y ~90 días de ventas.
 *
 *   pnpm db:seed
 *
 * Credenciales de prueba (solo desarrollo): ver SEED_PASSWORD abajo y .env.example
 */
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { addDays, setHours, setMinutes, startOfDay, subDays } from 'date-fns'
import { eq, sql } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'
import { createDb } from '../src/db/client'
import * as s from '../src/db/schema'
import { DEFAULT_PLANS } from '../src/lib/plans'
import { computeTotals } from '../src/lib/pricing'
import { provisionTenant } from '../src/server/provision'

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'Ourlyne#2026'
const db = createDb()

// RNG determinista para que el seed sea reproducible.
let seed = 20261001
const rand = () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]
const between = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min

async function upsertUser(email: string, name: string, platformRole: 'user' | 'superadmin' = 'user') {
  const existing = await db.query.user.findFirst({ where: eq(s.user.email, email) })
  if (existing) return existing
  const id = randomUUID()
  const [u] = await db
    .insert(s.user)
    .values({ id, email, name, emailVerified: true, platformRole })
    .returning()
  await db.insert(s.account).values({
    id: randomUUID(),
    accountId: id,
    providerId: 'credential',
    userId: id,
    password: await hashPassword(SEED_PASSWORD),
  })
  return u
}

async function seedPlans() {
  for (const p of DEFAULT_PLANS) {
    await db
      .insert(s.plans)
      .values({ ...p, highlighted: p.highlighted ?? false })
      .onConflictDoUpdate({
        target: s.plans.slug,
        set: {
          name: p.name,
          description: p.description,
          priceMonthly: p.priceMonthly,
          priceYearly: p.priceYearly,
          modules: p.modules,
          limits: p.limits,
          features: p.features,
          highlighted: p.highlighted ?? false,
          sortOrder: p.sortOrder,
        },
      })
  }
  console.log(`✓ ${DEFAULT_PLANS.length} planes`)
}

const CATALOG: Record<string, { color: string; items: [string, number, number, string?][] }> = {
  'Bebidas calientes': {
    color: '#c2904b',
    items: [
      ['Espresso', 38, 9],
      ['Americano', 45, 10],
      ['Capuchino', 58, 15],
      ['Latte', 62, 16],
      ['Mocha', 68, 19],
      ['Chai latte', 65, 18],
      ['Chocolate caliente', 55, 14],
      ['Té de la casa', 40, 6],
    ],
  },
  'Bebidas frías': {
    color: '#5b6b9a',
    items: [
      ['Cold brew', 62, 14],
      ['Frappé de caramelo', 78, 22],
      ['Matcha helado', 75, 24],
      ['Limonada mineral', 48, 10],
      ['Agua embotellada 600 ml', 20, 7],
      ['Jugo de naranja', 52, 16],
    ],
  },
  Panadería: {
    color: '#d2b68a',
    items: [
      ['Croissant de mantequilla', 42, 14],
      ['Concha de vainilla', 22, 7],
      ['Rol de canela', 48, 15],
      ['Pan de elote', 45, 13],
      ['Muffin de arándano', 46, 15],
      ['Galleta de avena', 28, 8],
    ],
  },
  Alimentos: {
    color: '#222d52',
    items: [
      ['Bagel de salmón', 125, 52],
      ['Sándwich de pavo', 98, 38],
      ['Chilaquiles verdes', 115, 35],
      ['Molletes', 85, 24],
      ['Ensalada César', 110, 36],
    ],
  },
  'Café en grano': {
    color: '#7d8fc9',
    items: [
      ['Café Chiapas 250 g', 189, 95, 'paq'],
      ['Café Veracruz 250 g', 179, 88, 'paq'],
      ['Café Oaxaca 1 kg', 590, 310, 'kg'],
    ],
  },
}

const FIRST = ['María', 'José', 'Fernanda', 'Luis', 'Ana', 'Carlos', 'Sofía', 'Diego', 'Valeria', 'Jorge', 'Camila', 'Ricardo', 'Daniela', 'Andrés', 'Paola', 'Miguel']
const LAST = ['García', 'Hernández', 'López', 'Martínez', 'Rodríguez', 'Pérez', 'Sánchez', 'Ramírez', 'Cruz', 'Flores', 'Gómez', 'Torres']

async function seedDemoTenant() {
  const owner = await upsertUser('demo@ourlyne.com', 'Andrea Demo')
  const cashier = await upsertUser('cajero@ourlyne.com', 'Raúl Cajero')

  const existing = await db.query.tenants.findFirst({ where: eq(s.tenants.slug, 'cafe-aurora') })
  if (existing) {
    console.log('• Tenant demo ya existe, se omite')
    return
  }

  await db.transaction(async (tx) => {
    const { tenant, branch } = await provisionTenant(tx, {
      name: 'Café Aurora',
      slug: 'cafe-aurora',
      ownerId: owner.id,
      businessType: 'cafe',
      planSlug: 'negocio',
    })
    await tx
      .update(s.tenants)
      .set({
        email: 'hola@cafeaurora.mx',
        phone: '55 1234 5678',
        taxId: 'CAU210304AB1',
        address: 'Av. Álvaro Obregón 120, Roma Nte., CDMX',
        receiptHeader: 'Café Aurora · Tostadores desde 2021',
      })
      .where(eq(s.tenants.id, tenant.id))
    await tx
      .update(s.subscriptions)
      .set({ status: 'active', currentPeriodStart: subDays(new Date(), 12), currentPeriodEnd: addDays(new Date(), 18) })
      .where(eq(s.subscriptions.tenantId, tenant.id))

    const [branch2] = await tx
      .insert(s.branches)
      .values({ tenantId: tenant.id, name: 'Sucursal Condesa', code: 'CDS', address: 'Av. Tamaulipas 45, Condesa' })
      .returning()
    const branchList = [branch, branch2]

    const [register2] = await tx
      .insert(s.registers)
      .values({ tenantId: tenant.id, branchId: branch2.id, name: 'Caja Condesa' })
      .returning()
    const register1 = await tx.query.registers.findFirst({ where: eq(s.registers.branchId, branch.id) })
    const registerByBranch = new Map([
      [branch.id, register1!],
      [branch2.id, register2],
    ])

    // Cajero
    const cashierRole = await tx.query.roles.findFirst({
      where: (r, { and, eq }) => and(eq(r.tenantId, tenant.id), eq(r.key, 'cashier')),
    })
    await tx.insert(s.members).values({ tenantId: tenant.id, userId: cashier.id, roleId: cashierRole!.id, branchId: branch2.id, pin: '1234' })

    const iva = await tx.query.taxes.findFirst({
      where: (t, { and, eq }) => and(eq(t.tenantId, tenant.id), eq(t.isDefault, true)),
    })
    const tasa0 = await tx.query.taxes.findFirst({
      where: (t, { and, eq }) => and(eq(t.tenantId, tenant.id), eq(t.rateBps, 0)),
    })

    // Catálogo + existencias
    const productRows: (typeof s.products.$inferSelect)[] = []
    let skuN = 1000
    let order = 0
    for (const [catName, cat] of Object.entries(CATALOG)) {
      const [c] = await tx
        .insert(s.categories)
        .values({ tenantId: tenant.id, name: catName, color: cat.color, sortOrder: order++ })
        .returning()
      const rows = await tx
        .insert(s.products)
        .values(
          cat.items.map(([name, price, cost, unit]) => ({
            tenantId: tenant.id,
            categoryId: c.id,
            taxId: catName === 'Café en grano' ? tasa0!.id : iva!.id,
            name,
            sku: `CA-${skuN++}`,
            barcode: `750${String(between(100000000, 999999999))}`,
            price: price * 100,
            cost: cost * 100,
            unit: unit ?? 'pz',
            lowStockThreshold: unit === 'kg' ? 2 : 8,
            trackStock: catName !== 'Bebidas calientes',
          })),
        )
        .returning()
      productRows.push(...rows)
    }

    const stockRows = productRows
      .filter((p) => p.trackStock)
      .flatMap((p) =>
        branchList.map((b) => ({
          tenantId: tenant.id,
          productId: p.id,
          branchId: b.id,
          quantity: between(0, 6) === 0 ? between(1, 6) : between(15, 120),
        })),
      )
    await tx.insert(s.stockLevels).values(stockRows)
    await tx.insert(s.stockMovements).values(
      stockRows.map((r) => ({
        ...r,
        type: 'initial' as const,
        balanceAfter: r.quantity,
        note: 'Inventario inicial',
        userId: owner.id,
        createdAt: subDays(new Date(), 95),
      })),
    )
    console.log(`✓ ${productRows.length} productos`)

    // Clientes
    const customerRows = await tx
      .insert(s.customers)
      .values(
        Array.from({ length: 24 }, (_, i) => {
          const name = `${pick(FIRST)} ${pick(LAST)}`
          return {
            tenantId: tenant.id,
            name,
            email: `${name.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').replace(' ', '.')}${i}@correo.mx`,
            phone: `55 ${between(1000, 9999)} ${between(1000, 9999)}`,
            creditLimit: i % 5 === 0 ? 200000 : 0,
            createdAt: subDays(new Date(), between(20, 120)),
          }
        }),
      )
      .returning()

    // Proveedores y compras
    const supplierRows = await tx
      .insert(s.suppliers)
      .values([
        { tenantId: tenant.id, name: 'Tostadores del Sur', contactName: 'Hugo Méndez', phone: '961 555 0101', email: 'ventas@tostadoresdelsur.mx' },
        { tenantId: tenant.id, name: 'Lácteos La Pradera', contactName: 'Laura Ruiz', phone: '55 5555 0202' },
        { tenantId: tenant.id, name: 'Panificadora Central', contactName: 'Óscar Vega', phone: '55 5555 0303' },
        { tenantId: tenant.id, name: 'Distribuidora Bebidas MX', contactName: 'Ana Ibarra', phone: '55 5555 0404' },
      ])
      .returning()

    let purchaseN = 0
    for (let i = 0; i < 8; i++) {
      const created = subDays(new Date(), 85 - i * 10)
      const items = Array.from({ length: between(2, 5) }, () => {
        const p = pick(productRows.filter((x) => x.trackStock))
        const quantity = between(10, 40)
        return { productId: p.id, name: p.name, quantity, unitCost: p.cost, total: p.cost * quantity }
      })
      const subtotal = items.reduce((a, b) => a + b.total, 0)
      const [pur] = await tx
        .insert(s.purchases)
        .values({
          tenantId: tenant.id,
          branchId: pick(branchList).id,
          supplierId: pick(supplierRows).id,
          number: ++purchaseN,
          status: i === 7 ? 'ordered' : 'received',
          paymentStatus: i === 7 ? 'unpaid' : 'paid',
          subtotal,
          total: subtotal,
          paidTotal: i === 7 ? 0 : subtotal,
          receivedAt: i === 7 ? null : addDays(created, 2),
          createdById: owner.id,
          createdAt: created,
        })
        .returning()
      await tx.insert(s.purchaseItems).values(items.map((it) => ({ ...it, tenantId: tenant.id, purchaseId: pur.id })))
    }

    // Cupones
    await tx.insert(s.coupons).values([
      { tenantId: tenant.id, code: 'BIENVENIDA10', description: '10% primera compra', type: 'percent', value: 1000 },
      { tenantId: tenant.id, code: 'AURORA50', description: '$50 en compras +$300', type: 'fixed', value: 5000, minTotal: 30000 },
    ])

    // Ventas: ~90 días, sesiones de caja diarias por sucursal
    const methods = await tx.query.paymentMethods.findMany({ where: eq(s.paymentMethods.tenantId, tenant.id) })
    const cash = methods.find((m) => m.type === 'cash')!
    const card = methods.find((m) => m.type === 'card')!
    const transfer = methods.find((m) => m.type === 'transfer')!

    const sellable = productRows
    const taxRate = new Map(productRows.map((p) => [p.id, p.taxId === tasa0!.id ? 0 : 1600]))
    const today = startOfDay(new Date())
    let orderN = 0
    const customerStats = new Map<string, { spent: number; count: number; last: Date }>()

    for (let d = 89; d >= 0; d--) {
      const day = subDays(today, d)
      const weekday = day.getDay()
      const growth = 1 + (89 - d) / 140

      for (const b of branchList) {
        const register = registerByBranch.get(b.id)!
        const opener = b.id === branch2.id ? cashier.id : owner.id
        const openedAt = setMinutes(setHours(day, 7), 30)
        const isToday = d === 0
        const [sessionRow] = await tx
          .insert(s.registerSessions)
          .values({
            tenantId: tenant.id,
            registerId: register.id,
            openedById: opener,
            openedAt,
            openingAmount: 100000,
            status: isToday ? 'open' : 'closed',
          })
          .returning()

        const base = b.id === branch.id ? 26 : 16
        const weekendBoost = weekday === 0 || weekday === 6 ? 1.35 : 1
        const ordersToday = Math.round((base + between(-5, 6)) * growth * weekendBoost * (isToday ? 0.55 : 1))

        const orderValues: (typeof s.orders.$inferInsert)[] = []
        const itemValues: (typeof s.orderItems.$inferInsert)[] = []
        const paymentValues: (typeof s.orderPayments.$inferInsert)[] = []
        let cashIn = 0

        for (let o = 0; o < ordersToday; o++) {
          const lines = Array.from({ length: between(1, 4) }, () => {
            const p = pick(sellable)
            return { p, quantity: p.unit === 'kg' ? 1 : between(1, 3) }
          })
          const totals = computeTotals(
            lines.map((l) => ({ unitPrice: l.p.price, quantity: l.quantity, taxRateBps: taxRate.get(l.p.id)! })),
            { pricesIncludeTax: true },
          )
          const id = randomUUID()
          const lastHour = isToday ? Math.max(8, Math.min(20, new Date().getHours() - 1)) : 20
          const createdAt = setMinutes(setHours(day, between(8, lastHour)), between(0, 59))
          const customer = rand() < 0.35 ? pick(customerRows) : null
          const r = rand()
          const method = r < 0.5 ? cash : r < 0.88 ? card : transfer
          const paid = method.type === 'cash' ? Math.ceil(totals.total / 5000) * 5000 : totals.total
          if (method.type === 'cash') cashIn += totals.total
          const cost = lines.reduce((a, l) => a + l.p.cost * l.quantity, 0)

          orderValues.push({
            id,
            tenantId: tenant.id,
            branchId: b.id,
            registerSessionId: sessionRow.id,
            customerId: customer?.id,
            cashierId: opener,
            number: ++orderN,
            type: rand() < 0.7 ? 'takeaway' : 'dine_in',
            subtotal: totals.subtotal,
            discountTotal: totals.discountTotal,
            taxTotal: totals.taxTotal,
            total: totals.total,
            costTotal: cost,
            paidTotal: paid,
            changeDue: paid - totals.total,
            createdAt,
            updatedAt: createdAt,
          })
          lines.forEach((l, i) =>
            itemValues.push({
              tenantId: tenant.id,
              orderId: id,
              productId: l.p.id,
              name: l.p.name,
              sku: l.p.sku,
              quantity: l.quantity,
              unitPrice: l.p.price,
              unitCost: l.p.cost,
              taxRateBps: taxRate.get(l.p.id)!,
              taxAmount: totals.lines[i].tax,
              total: totals.lines[i].total,
            }),
          )
          paymentValues.push({
            tenantId: tenant.id,
            orderId: id,
            paymentMethodId: method.id,
            methodName: method.name,
            methodType: method.type,
            amount: totals.total,
            createdAt,
          })
          if (customer) {
            const st = customerStats.get(customer.id) ?? { spent: 0, count: 0, last: createdAt }
            st.spent += totals.total
            st.count += 1
            if (createdAt > st.last) st.last = createdAt
            customerStats.set(customer.id, st)
          }
        }

        if (orderValues.length) {
          await tx.insert(s.orders).values(orderValues)
          await tx.insert(s.orderItems).values(itemValues)
          await tx.insert(s.orderPayments).values(paymentValues)
        }

        if (!isToday) {
          const expected = 100000 + cashIn
          const diff = rand() < 0.8 ? 0 : between(-3, 2) * 1000
          await tx
            .update(s.registerSessions)
            .set({
              closedById: opener,
              closedAt: setHours(day, 21),
              expectedAmount: expected,
              countedAmount: expected + diff,
              difference: diff,
            })
            .where(eq(s.registerSessions.id, sessionRow.id))
        }
      }
    }

    for (const [id, st] of customerStats) {
      await tx
        .update(s.customers)
        .set({ totalSpent: st.spent, ordersCount: st.count, lastPurchaseAt: st.last, loyaltyPoints: Math.floor(st.spent / 1000) })
        .where(eq(s.customers.id, id))
    }

    // Gastos mensuales
    const expCats = await tx.query.expenseCategories.findMany({ where: eq(s.expenseCategories.tenantId, tenant.id) })
    const byName = (n: string) => expCats.find((c) => c.name === n)!.id
    const expenseValues: (typeof s.expenses.$inferInsert)[] = []
    for (let m = 0; m < 3; m++) {
      const date = subDays(today, m * 30 + 2)
      for (const b of branchList) {
        expenseValues.push(
          { tenantId: tenant.id, branchId: b.id, categoryId: byName('Renta'), description: `Renta ${b.name}`, amount: b.id === branch.id ? 2800000 : 1900000, date, recurring: 'monthly', userId: owner.id },
          { tenantId: tenant.id, branchId: b.id, categoryId: byName('Servicios'), description: 'Luz, agua e internet', amount: between(280000, 420000), date: addDays(date, 3), userId: owner.id },
          { tenantId: tenant.id, branchId: b.id, categoryId: byName('Nómina'), description: 'Nómina quincenal', amount: between(1800000, 2400000), date: addDays(date, 5), recurring: 'monthly', userId: owner.id },
          { tenantId: tenant.id, branchId: b.id, categoryId: byName('Insumos'), description: 'Vasos, tapas y servilletas', amount: between(90000, 180000), date: addDays(date, 9), userId: owner.id },
        )
      }
    }
    await tx.insert(s.expenses).values(expenseValues)

    await tx.insert(s.tenantCounters).values([
      { tenantId: tenant.id, key: 'order', value: orderN },
      { tenantId: tenant.id, key: 'purchase', value: purchaseN },
    ])

    await tx.update(s.user).set({ lastTenantId: tenant.id }).where(eq(s.user.id, owner.id))
    console.log(`✓ Tenant demo "Café Aurora" con ${orderN} ventas`)
  })
}

async function main() {
  await seedPlans()
  await upsertUser('admin@ourlyne.com', 'Admin Ourlyne', 'superadmin')
  await seedDemoTenant()
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(s.orders)
  console.log(`✓ Seed completo (${count} ventas en total)`)
  console.log(`  Usuarios: demo@ourlyne.com · cajero@ourlyne.com · admin@ourlyne.com`)
  if (process.env.DATABASE_URL) await (db.$client as { end: () => Promise<void> }).end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
