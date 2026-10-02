import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

/* ──────────────────────────────────────────────────────────────────────────
   Plataforma SaaS: planes, tenants (negocios), suscripciones, sucursales,
   roles/permisos, miembros, invitaciones y módulos habilitados.
   Todas las tablas de negocio cuelgan de `tenants.id` (multi-tenant por
   columna `tenant_id`, base de datos compartida).
   ────────────────────────────────────────────────────────────────────────── */

export type PlanLimits = {
  /** -1 = ilimitado */
  branches: number
  users: number
  products: number
  registers: number
}

export const plans = pgTable('plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  /** Precios en centavos. */
  priceMonthly: integer('price_monthly').notNull().default(0),
  priceYearly: integer('price_yearly').notNull().default(0),
  currency: text('currency').notNull().default('mxn'),
  stripeProductId: text('stripe_product_id'),
  stripePriceMonthlyId: text('stripe_price_monthly_id'),
  stripePriceYearlyId: text('stripe_price_yearly_id'),
  /** Claves de módulos incluidos (ver `src/lib/modules.ts`). */
  modules: text('modules').array().notNull().default([]),
  limits: jsonb('limits').$type<PlanLimits>().notNull(),
  /** Bullets de marketing para la tabla de precios. */
  features: text('features').array().notNull().default([]),
  trialDays: integer('trial_days').notNull().default(14),
  highlighted: boolean('highlighted').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  businessType: text('business_type').notNull().default('retail'),
  logoUrl: text('logo_url'),
  email: text('email'),
  phone: text('phone'),
  taxId: text('tax_id'),
  address: text('address'),
  currency: text('currency').notNull().default('MXN'),
  locale: text('locale').notNull().default('es-MX'),
  timezone: text('timezone').notNull().default('America/Mexico_City'),
  receiptHeader: text('receipt_header'),
  receiptFooter: text('receipt_footer').default('¡Gracias por su compra!'),
  /** Si los precios capturados ya incluyen impuestos (IVA incluido). */
  pricesIncludeTax: boolean('prices_include_tax').notNull().default(true),
  allowNegativeStock: boolean('allow_negative_stock').notNull().default(false),
  stripeCustomerId: text('stripe_customer_id').unique(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id),
  suspendedAt: timestamp('suspended_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const SUBSCRIPTION_STATUS = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'unpaid',
] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[number]

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id),
    status: text('status', { enum: SUBSCRIPTION_STATUS })
      .notNull()
      .default('trialing'),
    interval: text('interval', { enum: ['month', 'year'] })
      .notNull()
      .default('month'),
    stripeSubscriptionId: text('stripe_subscription_id').unique(),
    stripePriceId: text('stripe_price_id'),
    trialEndsAt: timestamp('trial_ends_at'),
    currentPeriodStart: timestamp('current_period_start'),
    currentPeriodEnd: timestamp('current_period_end'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end')
      .notNull()
      .default(false),
    canceledAt: timestamp('canceled_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('subscriptions_tenant_uq').on(t.tenantId)],
)

export const branches = pgTable(
  'branches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code'),
    address: text('address'),
    phone: text('phone'),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('branches_tenant_idx').on(t.tenantId)],
)

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Clave estable para roles del sistema: owner, admin, manager, cashier. */
    key: text('key'),
    name: text('name').notNull(),
    description: text('description'),
    /** Permisos (ver `src/lib/permissions.ts`). `*` = todos. */
    permissions: text('permissions').array().notNull().default([]),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('roles_tenant_idx').on(t.tenantId),
    uniqueIndex('roles_tenant_name_uq').on(t.tenantId, t.name),
  ],
)

export const members = pgTable(
  'members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    /** Sucursal por defecto del miembro (p. ej. el cajero). */
    branchId: uuid('branch_id').references(() => branches.id, {
      onDelete: 'set null',
    }),
    /** PIN corto opcional para cambio rápido de cajero en el POS. */
    pin: text('pin'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('members_tenant_user_uq').on(t.tenantId, t.userId),
    index('members_user_idx').on(t.userId),
  ],
)

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    status: text('status', {
      enum: ['pending', 'accepted', 'revoked', 'expired'],
    })
      .notNull()
      .default('pending'),
    invitedById: text('invited_by_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('invitations_tenant_idx').on(t.tenantId)],
)

/** Activación de módulos por tenant (dentro de lo que permite su plan). */
export const tenantModules = pgTable(
  'tenant_modules',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    moduleKey: text('module_key').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.moduleKey] })],
)

/** Folios consecutivos por tenant (ventas, compras, etc.). */
export const tenantCounters = pgTable(
  'tenant_counters',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: integer('value').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.key] })],
)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    summary: text('summary'),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('audit_tenant_created_idx').on(t.tenantId, t.createdAt)],
)
