import { relations } from 'drizzle-orm'
import { account, session, user } from './auth'
import {
  auditLogs,
  branches,
  invitations,
  members,
  plans,
  roles,
  subscriptions,
  tenantModules,
  tenants,
} from './platform'
import {
  cashMovements,
  categories,
  coupons,
  customers,
  expenseCategories,
  expenses,
  orderItems,
  orderPayments,
  orders,
  paymentMethods,
  products,
  purchaseItems,
  purchases,
  refunds,
  registers,
  registerSessions,
  stockLevels,
  stockMovements,
  suppliers,
  taxes,
} from './commerce'

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  memberships: many(members),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const planRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}))

export const tenantRelations = relations(tenants, ({ one, many }) => ({
  owner: one(user, { fields: [tenants.ownerId], references: [user.id] }),
  subscription: one(subscriptions),
  branches: many(branches),
  members: many(members),
  roles: many(roles),
  modules: many(tenantModules),
}))

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [subscriptions.tenantId],
    references: [tenants.id],
  }),
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
}))

export const branchRelations = relations(branches, ({ one, many }) => ({
  tenant: one(tenants, { fields: [branches.tenantId], references: [tenants.id] }),
  registers: many(registers),
}))

export const roleRelations = relations(roles, ({ one, many }) => ({
  tenant: one(tenants, { fields: [roles.tenantId], references: [tenants.id] }),
  members: many(members),
}))

export const memberRelations = relations(members, ({ one }) => ({
  tenant: one(tenants, { fields: [members.tenantId], references: [tenants.id] }),
  user: one(user, { fields: [members.userId], references: [user.id] }),
  role: one(roles, { fields: [members.roleId], references: [roles.id] }),
  branch: one(branches, {
    fields: [members.branchId],
    references: [branches.id],
  }),
}))

export const invitationRelations = relations(invitations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [invitations.tenantId],
    references: [tenants.id],
  }),
  role: one(roles, { fields: [invitations.roleId], references: [roles.id] }),
  invitedBy: one(user, {
    fields: [invitations.invitedById],
    references: [user.id],
  }),
}))

export const tenantModuleRelations = relations(tenantModules, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantModules.tenantId],
    references: [tenants.id],
  }),
}))

export const auditLogRelations = relations(auditLogs, ({ one }) => ({
  user: one(user, { fields: [auditLogs.userId], references: [user.id] }),
}))

export const taxRelations = relations(taxes, ({ many }) => ({
  products: many(products),
}))

export const categoryRelations = relations(categories, ({ many }) => ({
  products: many(products),
}))

export const productRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  tax: one(taxes, { fields: [products.taxId], references: [taxes.id] }),
  stock: many(stockLevels),
  movements: many(stockMovements),
}))

export const stockLevelRelations = relations(stockLevels, ({ one }) => ({
  product: one(products, {
    fields: [stockLevels.productId],
    references: [products.id],
  }),
  branch: one(branches, {
    fields: [stockLevels.branchId],
    references: [branches.id],
  }),
}))

export const stockMovementRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  branch: one(branches, {
    fields: [stockMovements.branchId],
    references: [branches.id],
  }),
  user: one(user, { fields: [stockMovements.userId], references: [user.id] }),
}))

export const customerRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}))

export const supplierRelations = relations(suppliers, ({ many }) => ({
  purchases: many(purchases),
}))

export const purchaseRelations = relations(purchases, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchases.supplierId],
    references: [suppliers.id],
  }),
  branch: one(branches, {
    fields: [purchases.branchId],
    references: [branches.id],
  }),
  createdBy: one(user, {
    fields: [purchases.createdById],
    references: [user.id],
  }),
  items: many(purchaseItems),
}))

export const purchaseItemRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseItems.purchaseId],
    references: [purchases.id],
  }),
  product: one(products, {
    fields: [purchaseItems.productId],
    references: [products.id],
  }),
}))

export const registerRelations = relations(registers, ({ one, many }) => ({
  branch: one(branches, {
    fields: [registers.branchId],
    references: [branches.id],
  }),
  sessions: many(registerSessions),
}))

export const registerSessionRelations = relations(
  registerSessions,
  ({ one, many }) => ({
    register: one(registers, {
      fields: [registerSessions.registerId],
      references: [registers.id],
    }),
    openedBy: one(user, {
      fields: [registerSessions.openedById],
      references: [user.id],
      relationName: 'sessionOpenedBy',
    }),
    closedBy: one(user, {
      fields: [registerSessions.closedById],
      references: [user.id],
      relationName: 'sessionClosedBy',
    }),
    cashMovements: many(cashMovements),
    orders: many(orders),
  }),
)

export const cashMovementRelations = relations(cashMovements, ({ one }) => ({
  session: one(registerSessions, {
    fields: [cashMovements.sessionId],
    references: [registerSessions.id],
  }),
  user: one(user, { fields: [cashMovements.userId], references: [user.id] }),
}))

export const couponRelations = relations(coupons, ({ many }) => ({
  orders: many(orders),
}))

export const orderRelations = relations(orders, ({ one, many }) => ({
  branch: one(branches, { fields: [orders.branchId], references: [branches.id] }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  cashier: one(user, { fields: [orders.cashierId], references: [user.id] }),
  coupon: one(coupons, { fields: [orders.couponId], references: [coupons.id] }),
  registerSession: one(registerSessions, {
    fields: [orders.registerSessionId],
    references: [registerSessions.id],
  }),
  items: many(orderItems),
  payments: many(orderPayments),
  refunds: many(refunds),
}))

export const orderItemRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}))

export const orderPaymentRelations = relations(orderPayments, ({ one }) => ({
  order: one(orders, {
    fields: [orderPayments.orderId],
    references: [orders.id],
  }),
  method: one(paymentMethods, {
    fields: [orderPayments.paymentMethodId],
    references: [paymentMethods.id],
  }),
}))

export const refundRelations = relations(refunds, ({ one }) => ({
  order: one(orders, { fields: [refunds.orderId], references: [orders.id] }),
  user: one(user, { fields: [refunds.userId], references: [user.id] }),
}))

export const expenseCategoryRelations = relations(
  expenseCategories,
  ({ many }) => ({ expenses: many(expenses) }),
)

export const expenseRelations = relations(expenses, ({ one }) => ({
  category: one(expenseCategories, {
    fields: [expenses.categoryId],
    references: [expenseCategories.id],
  }),
  branch: one(branches, {
    fields: [expenses.branchId],
    references: [branches.id],
  }),
  user: one(user, { fields: [expenses.userId], references: [user.id] }),
}))
