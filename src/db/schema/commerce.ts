import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { branches, tenants } from './platform'

/* ──────────────────────────────────────────────────────────────────────────
   Dominio del punto de venta. Convenciones:
   - Importes en centavos (`integer`) para evitar errores de redondeo.
   - Cantidades `numeric(14,3)` para admitir productos a granel (kg, lt).
   - Tasas de impuesto en puntos base (1600 = 16.00 %).
   - Toda tabla lleva `tenant_id` y se consulta siempre filtrando por él.
   ────────────────────────────────────────────────────────────────────────── */

const tenantId = () =>
  uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' })

const qty = (name: string) =>
  numeric(name, { precision: 14, scale: 3, mode: 'number' })

const createdAt = () => timestamp('created_at').notNull().defaultNow()
const updatedAt = () =>
  timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())

/* ── Catálogo ─────────────────────────────────────────────────────────── */

export const taxes = pgTable(
  'taxes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    rateBps: integer('rate_bps').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('taxes_tenant_idx').on(t.tenantId)],
)

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#d2b68a'),
    icon: text('icon'),
    parentId: uuid('parent_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('categories_tenant_idx').on(t.tenantId),
    uniqueIndex('categories_tenant_name_uq').on(t.tenantId, t.name),
  ],
)

export const PRODUCT_TYPES = ['product', 'service'] as const
export const PRODUCT_UNITS = ['pz', 'kg', 'g', 'lt', 'ml', 'm', 'caja', 'paq'] as const

export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    taxId: uuid('tax_id').references(() => taxes.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    sku: text('sku'),
    barcode: text('barcode'),
    description: text('description'),
    type: text('type', { enum: PRODUCT_TYPES }).notNull().default('product'),
    unit: text('unit').notNull().default('pz'),
    price: integer('price').notNull().default(0),
    cost: integer('cost').notNull().default(0),
    trackStock: boolean('track_stock').notNull().default(true),
    lowStockThreshold: qty('low_stock_threshold').notNull().default(5),
    imageUrl: text('image_url'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('products_tenant_idx').on(t.tenantId),
    index('products_tenant_category_idx').on(t.tenantId, t.categoryId),
    uniqueIndex('products_tenant_sku_uq').on(t.tenantId, t.sku),
    index('products_tenant_barcode_idx').on(t.tenantId, t.barcode),
  ],
)

/* ── Inventario ───────────────────────────────────────────────────────── */

export const stockLevels = pgTable(
  'stock_levels',
  {
    tenantId: tenantId(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    quantity: qty('quantity').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.branchId] }),
    index('stock_levels_tenant_idx').on(t.tenantId),
  ],
)

export const STOCK_MOVEMENT_TYPES = [
  'initial',
  'sale',
  'refund',
  'purchase',
  'adjustment',
  'transfer_in',
  'transfer_out',
  'waste',
] as const
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number]

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    type: text('type', { enum: STOCK_MOVEMENT_TYPES }).notNull(),
    /** Positivo = entrada, negativo = salida. */
    quantity: qty('quantity').notNull(),
    balanceAfter: qty('balance_after').notNull(),
    unitCost: integer('unit_cost'),
    referenceType: text('reference_type'),
    referenceId: uuid('reference_id'),
    note: text('note'),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('stock_mov_tenant_created_idx').on(t.tenantId, t.createdAt),
    index('stock_mov_product_idx').on(t.productId),
  ],
)

/* ── Clientes y proveedores ───────────────────────────────────────────── */

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    taxId: text('tax_id'),
    address: text('address'),
    notes: text('notes'),
    /** Límite de crédito en centavos (0 = sin crédito). */
    creditLimit: integer('credit_limit').notNull().default(0),
    /** Saldo adeudado por el cliente (ventas a crédito). */
    balance: integer('balance').notNull().default(0),
    loyaltyPoints: integer('loyalty_points').notNull().default(0),
    totalSpent: integer('total_spent').notNull().default(0),
    ordersCount: integer('orders_count').notNull().default(0),
    lastPurchaseAt: timestamp('last_purchase_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('customers_tenant_idx').on(t.tenantId)],
)

export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    contactName: text('contact_name'),
    email: text('email'),
    phone: text('phone'),
    taxId: text('tax_id'),
    address: text('address'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('suppliers_tenant_idx').on(t.tenantId)],
)

/* ── Compras (abastecimiento) ─────────────────────────────────────────── */

export const PURCHASE_STATUS = ['draft', 'ordered', 'received', 'cancelled'] as const
export const PAYMENT_STATUS = ['unpaid', 'partial', 'paid'] as const

export const purchases = pgTable(
  'purchases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    supplierId: uuid('supplier_id').references(() => suppliers.id, {
      onDelete: 'set null',
    }),
    number: integer('number').notNull(),
    status: text('status', { enum: PURCHASE_STATUS }).notNull().default('draft'),
    paymentStatus: text('payment_status', { enum: PAYMENT_STATUS })
      .notNull()
      .default('unpaid'),
    subtotal: integer('subtotal').notNull().default(0),
    taxTotal: integer('tax_total').notNull().default(0),
    total: integer('total').notNull().default(0),
    paidTotal: integer('paid_total').notNull().default(0),
    notes: text('notes'),
    expectedAt: timestamp('expected_at'),
    receivedAt: timestamp('received_at'),
    createdById: text('created_by_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('purchases_tenant_created_idx').on(t.tenantId, t.createdAt),
    uniqueIndex('purchases_tenant_number_uq').on(t.tenantId, t.number),
  ],
)

export const purchaseItems = pgTable(
  'purchase_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    purchaseId: uuid('purchase_id')
      .notNull()
      .references(() => purchases.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    quantity: qty('quantity').notNull(),
    unitCost: integer('unit_cost').notNull(),
    total: integer('total').notNull(),
  },
  (t) => [index('purchase_items_purchase_idx').on(t.purchaseId)],
)

/* ── Cajas registradoras ──────────────────────────────────────────────── */

export const PAYMENT_METHOD_TYPES = [
  'cash',
  'card',
  'transfer',
  'credit',
  'other',
] as const
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number]

export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    type: text('type', { enum: PAYMENT_METHOD_TYPES }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('payment_methods_tenant_idx').on(t.tenantId)],
)

export const registers = pgTable(
  'registers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('registers_tenant_idx').on(t.tenantId)],
)

export const registerSessions = pgTable(
  'register_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    registerId: uuid('register_id')
      .notNull()
      .references(() => registers.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['open', 'closed'] })
      .notNull()
      .default('open'),
    openedById: text('opened_by_id')
      .notNull()
      .references(() => user.id),
    openedAt: timestamp('opened_at').notNull().defaultNow(),
    openingAmount: integer('opening_amount').notNull().default(0),
    closedById: text('closed_by_id').references(() => user.id),
    closedAt: timestamp('closed_at'),
    /** Efectivo esperado según sistema al cierre. */
    expectedAmount: integer('expected_amount'),
    /** Efectivo contado físicamente al cierre. */
    countedAmount: integer('counted_amount'),
    difference: integer('difference'),
    notes: text('notes'),
  },
  (t) => [
    index('register_sessions_register_idx').on(t.registerId),
    index('register_sessions_tenant_idx').on(t.tenantId, t.openedAt),
  ],
)

export const cashMovements = pgTable(
  'cash_movements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => registerSessions.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['in', 'out'] }).notNull(),
    amount: integer('amount').notNull(),
    reason: text('reason').notNull(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('cash_movements_session_idx').on(t.sessionId)],
)

/* ── Cupones ──────────────────────────────────────────────────────────── */

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    code: text('code').notNull(),
    description: text('description'),
    type: text('type', { enum: ['percent', 'fixed'] }).notNull(),
    /** Porcentaje en puntos base o importe fijo en centavos. */
    value: integer('value').notNull(),
    minTotal: integer('min_total').notNull().default(0),
    usageLimit: integer('usage_limit'),
    usedCount: integer('used_count').notNull().default(0),
    expiresAt: timestamp('expires_at'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('coupons_tenant_code_uq').on(t.tenantId, t.code)],
)

/* ── Ventas ───────────────────────────────────────────────────────────── */

export const ORDER_STATUS = [
  'completed',
  'partially_refunded',
  'refunded',
  'voided',
] as const
export type OrderStatus = (typeof ORDER_STATUS)[number]
export const ORDER_TYPES = ['takeaway', 'dine_in', 'delivery'] as const

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    registerSessionId: uuid('register_session_id').references(
      () => registerSessions.id,
      { onDelete: 'set null' },
    ),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    cashierId: text('cashier_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    couponId: uuid('coupon_id').references(() => coupons.id, {
      onDelete: 'set null',
    }),
    number: integer('number').notNull(),
    type: text('type', { enum: ORDER_TYPES }).notNull().default('takeaway'),
    status: text('status', { enum: ORDER_STATUS }).notNull().default('completed'),
    paymentStatus: text('payment_status', { enum: PAYMENT_STATUS })
      .notNull()
      .default('paid'),
    subtotal: integer('subtotal').notNull().default(0),
    discountTotal: integer('discount_total').notNull().default(0),
    taxTotal: integer('tax_total').notNull().default(0),
    total: integer('total').notNull().default(0),
    costTotal: integer('cost_total').notNull().default(0),
    paidTotal: integer('paid_total').notNull().default(0),
    changeDue: integer('change_due').notNull().default(0),
    refundedTotal: integer('refunded_total').notNull().default(0),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('orders_tenant_created_idx').on(t.tenantId, t.createdAt),
    index('orders_customer_idx').on(t.customerId),
    uniqueIndex('orders_tenant_number_uq').on(t.tenantId, t.number),
  ],
)

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    sku: text('sku'),
    quantity: qty('quantity').notNull(),
    refundedQuantity: qty('refunded_quantity').notNull().default(0),
    unitPrice: integer('unit_price').notNull(),
    unitCost: integer('unit_cost').notNull().default(0),
    discount: integer('discount').notNull().default(0),
    taxRateBps: integer('tax_rate_bps').notNull().default(0),
    taxAmount: integer('tax_amount').notNull().default(0),
    total: integer('total').notNull(),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId),
    index('order_items_product_idx').on(t.productId),
  ],
)

export const orderPayments = pgTable(
  'order_payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    paymentMethodId: uuid('payment_method_id').references(
      () => paymentMethods.id,
      { onDelete: 'set null' },
    ),
    methodName: text('method_name').notNull(),
    methodType: text('method_type', { enum: PAYMENT_METHOD_TYPES }).notNull(),
    amount: integer('amount').notNull(),
    reference: text('reference'),
    createdAt: createdAt(),
  },
  (t) => [index('order_payments_order_idx').on(t.orderId)],
)

export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    registerSessionId: uuid('register_session_id').references(
      () => registerSessions.id,
      { onDelete: 'set null' },
    ),
    amount: integer('amount').notNull(),
    reason: text('reason'),
    restock: boolean('restock').notNull().default(true),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('refunds_tenant_idx').on(t.tenantId, t.createdAt)],
)

/* ── Gastos ───────────────────────────────────────────────────────────── */

export const expenseCategories = pgTable(
  'expense_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#222d52'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('expense_categories_tenant_name_uq').on(t.tenantId, t.name)],
)

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: tenantId(),
    branchId: uuid('branch_id').references(() => branches.id, {
      onDelete: 'set null',
    }),
    categoryId: uuid('category_id').references(() => expenseCategories.id, {
      onDelete: 'set null',
    }),
    description: text('description').notNull(),
    amount: integer('amount').notNull(),
    date: timestamp('date').notNull().defaultNow(),
    paymentMethod: text('payment_method'),
    reference: text('reference'),
    recurring: text('recurring', {
      enum: ['none', 'weekly', 'monthly', 'yearly'],
    })
      .notNull()
      .default('none'),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('expenses_tenant_date_idx').on(t.tenantId, t.date)],
)
