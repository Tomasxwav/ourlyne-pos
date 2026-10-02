/**
 * Registro de módulos del sistema. Los módulos `core` siempre están activos;
 * el resto se incluyen según el plan y el tenant puede activarlos/desactivarlos
 * desde Configuración → Módulos.
 */
export const MODULES = {
  inventory: {
    name: 'Inventario',
    description:
      'Existencias por sucursal, ajustes, mermas, traspasos y kardex de movimientos.',
    icon: 'Boxes',
  },
  customers: {
    name: 'Clientes',
    description:
      'Directorio de clientes, ventas a crédito, saldos y puntos de lealtad.',
    icon: 'Users',
  },
  registers: {
    name: 'Cajas',
    description:
      'Apertura y corte de caja, entradas/salidas de efectivo y arqueos.',
    icon: 'Wallet',
  },
  purchases: {
    name: 'Compras',
    description:
      'Proveedores, órdenes de compra y recepción de mercancía con costo.',
    icon: 'Truck',
  },
  expenses: {
    name: 'Gastos',
    description: 'Registro de gastos por categoría, recurrentes y por sucursal.',
    icon: 'Receipt',
  },
  coupons: {
    name: 'Cupones',
    description: 'Códigos de descuento por porcentaje o monto, con vigencia y límite.',
    icon: 'TicketPercent',
  },
  reports: {
    name: 'Reportes',
    description:
      'Ventas, utilidad, productos más vendidos, desempeño por cajero y más.',
    icon: 'ChartColumn',
  },
} as const

export type ModuleKey = keyof typeof MODULES
export const MODULE_KEYS = Object.keys(MODULES) as ModuleKey[]

export function isModuleKey(value: string): value is ModuleKey {
  return value in MODULES
}
