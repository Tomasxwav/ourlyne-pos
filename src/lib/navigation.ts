import type { ModuleKey } from './modules'
import type { Permission } from './permissions'

export type NavIcon =
  | 'LayoutDashboard'
  | 'ShoppingCart'
  | 'ReceiptText'
  | 'Package'
  | 'Tags'
  | 'Boxes'
  | 'Users'
  | 'Truck'
  | 'Wallet'
  | 'Receipt'
  | 'TicketPercent'
  | 'ChartColumn'
  | 'UsersRound'
  | 'Settings'
  | 'CreditCard'

export type NavItem = {
  title: string
  /** Relativo a /app/[tenant] */
  href: string
  icon: NavIcon
  permission?: Permission
  module?: ModuleKey
}

export const NAVIGATION: { label: string; items: NavItem[] }[] = [
  {
    label: 'General',
    items: [
      { title: 'Tablero', href: '', icon: 'LayoutDashboard', permission: 'dashboard.view' },
      { title: 'Punto de venta', href: '/pos', icon: 'ShoppingCart', permission: 'pos.sell' },
      { title: 'Ventas', href: '/orders', icon: 'ReceiptText', permission: 'orders.view' },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { title: 'Productos', href: '/products', icon: 'Package', permission: 'products.view' },
      { title: 'Categorías', href: '/categories', icon: 'Tags', permission: 'products.manage' },
      { title: 'Inventario', href: '/inventory', icon: 'Boxes', permission: 'inventory.view', module: 'inventory' },
    ],
  },
  {
    label: 'Operación',
    items: [
      { title: 'Clientes', href: '/customers', icon: 'Users', permission: 'customers.view', module: 'customers' },
      { title: 'Compras', href: '/purchases', icon: 'Truck', permission: 'purchases.view', module: 'purchases' },
      { title: 'Cajas', href: '/registers', icon: 'Wallet', permission: 'registers.operate', module: 'registers' },
      { title: 'Gastos', href: '/expenses', icon: 'Receipt', permission: 'expenses.manage', module: 'expenses' },
      { title: 'Cupones', href: '/coupons', icon: 'TicketPercent', permission: 'coupons.manage', module: 'coupons' },
      { title: 'Reportes', href: '/reports', icon: 'ChartColumn', permission: 'reports.view', module: 'reports' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { title: 'Equipo', href: '/team', icon: 'UsersRound', permission: 'team.manage' },
      { title: 'Configuración', href: '/settings', icon: 'Settings', permission: 'settings.manage' },
      { title: 'Facturación', href: '/billing', icon: 'CreditCard', permission: 'billing.manage' },
    ],
  },
]

/** Etiquetas de segmentos para el breadcrumb. */
export const SEGMENT_LABELS: Record<string, string> = {
  pos: 'Punto de venta',
  orders: 'Ventas',
  products: 'Productos',
  categories: 'Categorías',
  inventory: 'Inventario',
  movements: 'Movimientos',
  transfers: 'Traspasos',
  customers: 'Clientes',
  suppliers: 'Proveedores',
  purchases: 'Compras',
  registers: 'Cajas',
  sessions: 'Cortes',
  expenses: 'Gastos',
  coupons: 'Cupones',
  reports: 'Reportes',
  team: 'Equipo',
  roles: 'Roles',
  settings: 'Configuración',
  branches: 'Sucursales',
  modules: 'Módulos',
  payments: 'Métodos de pago',
  taxes: 'Impuestos',
  billing: 'Facturación',
  new: 'Nuevo',
  edit: 'Editar',
}
