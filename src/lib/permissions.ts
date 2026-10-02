import type { ModuleKey } from './modules'

type PermissionDef = {
  label: string
  /** Módulo requerido; si el módulo está apagado el permiso no aplica. */
  module?: ModuleKey
}

export const PERMISSION_GROUPS = {
  Ventas: {
    'pos.sell': { label: 'Vender en el punto de venta' },
    'pos.discount': { label: 'Aplicar descuentos manuales' },
    'orders.view': { label: 'Ver historial de ventas' },
    'orders.refund': { label: 'Devoluciones y cancelaciones' },
  },
  Catálogo: {
    'products.view': { label: 'Ver productos' },
    'products.manage': { label: 'Crear y editar productos y categorías' },
  },
  Inventario: {
    'inventory.view': { label: 'Ver existencias y movimientos', module: 'inventory' },
    'inventory.adjust': { label: 'Ajustes, mermas y traspasos', module: 'inventory' },
  },
  Clientes: {
    'customers.view': { label: 'Ver clientes', module: 'customers' },
    'customers.manage': { label: 'Crear, editar y abonar a clientes', module: 'customers' },
  },
  Cajas: {
    'registers.operate': { label: 'Abrir y cerrar su caja', module: 'registers' },
    'registers.manage': { label: 'Administrar cajas y ver todos los cortes', module: 'registers' },
  },
  Compras: {
    'purchases.view': { label: 'Ver compras y proveedores', module: 'purchases' },
    'purchases.manage': { label: 'Registrar compras y recibir mercancía', module: 'purchases' },
  },
  Gastos: {
    'expenses.manage': { label: 'Registrar y editar gastos', module: 'expenses' },
  },
  Promociones: {
    'coupons.manage': { label: 'Administrar cupones', module: 'coupons' },
  },
  Análisis: {
    'dashboard.view': { label: 'Ver tablero e indicadores' },
    'reports.view': { label: 'Ver reportes', module: 'reports' },
  },
  Administración: {
    'settings.manage': { label: 'Configuración del negocio y sucursales' },
    'team.manage': { label: 'Usuarios, roles e invitaciones' },
    'billing.manage': { label: 'Plan, facturación y suscripción' },
  },
} as const satisfies Record<string, Record<string, PermissionDef>>

type Groups = typeof PERMISSION_GROUPS
export type Permission = {
  [G in keyof Groups]: keyof Groups[G]
}[keyof Groups] &
  string

export const PERMISSIONS: Record<Permission, PermissionDef> = Object.assign(
  {},
  ...Object.values(PERMISSION_GROUPS),
)

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[]

export function isPermission(value: string): value is Permission {
  return value in PERMISSIONS
}

/** Roles del sistema creados con cada tenant. */
export const SYSTEM_ROLES: {
  key: string
  name: string
  description: string
  permissions: (Permission | '*')[]
}[] = [
  {
    key: 'owner',
    name: 'Propietario',
    description: 'Acceso total, incluida la suscripción. No se puede eliminar.',
    permissions: ['*'],
  },
  {
    key: 'admin',
    name: 'Administrador',
    description: 'Administra todo el negocio excepto la facturación.',
    permissions: ALL_PERMISSIONS.filter((p) => p !== 'billing.manage'),
  },
  {
    key: 'manager',
    name: 'Gerente',
    description: 'Opera la sucursal: ventas, inventario, compras y reportes.',
    permissions: ALL_PERMISSIONS.filter(
      (p) => !['settings.manage', 'team.manage', 'billing.manage'].includes(p),
    ),
  },
  {
    key: 'cashier',
    name: 'Cajero',
    description: 'Cobra en el punto de venta y opera su caja.',
    permissions: [
      'pos.sell',
      'orders.view',
      'products.view',
      'customers.view',
      'customers.manage',
      'registers.operate',
    ],
  },
]

export function hasPermission(granted: readonly string[], permission: Permission) {
  return granted.includes('*') || granted.includes(permission)
}
