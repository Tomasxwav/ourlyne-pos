# Ourlyne POS

Punto de venta **SaaS multi-tenant y multi-módulo** construido con Next.js 16, inspirado en la funcionalidad de NexoPOS y con la identidad visual de [Ourlyne](https://ourlyne.com).

- **Multi-tenant**: cada negocio (tenant) tiene sus sucursales, cajas, catálogo, clientes y equipo, aislados por `tenant_id`. Un usuario puede pertenecer a varios negocios.
- **Multi-módulo**: inventario, clientes, cajas, compras, gastos, cupones y reportes se activan según el plan y desde *Configuración → Módulos*.
- **Usuarios, roles y permisos**: roles del sistema (Propietario, Administrador, Gerente, Cajero) y roles personalizados con una matriz de 21 permisos.
- **Planes y suscripciones con Stripe**: Checkout, cambio de plan con prorrateo, portal del cliente, webhooks y límites por plan (sucursales, usuarios, productos, cajas). Sin claves de Stripe funciona en *modo demo*.
- **Panel de plataforma** (`/admin`) para el superadministrador: MRR, negocios, pruebas y editor de planes.

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Actions, `proxy.ts`), React 19.2 |
| UI | Tailwind CSS v4, shadcn/ui (estilo `base-mira` sobre Base UI), lucide-react, sonner |
| Gráficas | Recharts (paleta derivada del dorado Ourlyne, validada para daltonismo) |
| Animación (landing) | GSAP (ScrollTrigger, ScrollSmoother, SplitText) |
| Datos | PostgreSQL + Drizzle ORM (`postgres` driver); PGlite como respaldo sin servidor |
| Auth | Better Auth (email/contraseña, Google opcional) |
| Pagos | Stripe |
| Validación | Zod 4 |

## Puesta en marcha

Requisitos: Node 20.9+ y pnpm.

```bash
pnpm install
cp .env.example .env        # y define BETTER_AUTH_SECRET
pnpm db:setup               # levanta Postgres local, migra y siembra datos demo
pnpm dev
```

`pnpm dev` levanta automáticamente un **Postgres embebido** (binarios oficiales vía `embedded-postgres`, sin Docker) en el puerto `5433` con los datos en `./.pgdata`. Para usar otro Postgres solo cambia `DATABASE_URL`.

### Usuarios de prueba (seed)

| Correo | Rol |
| --- | --- |
| `demo@ourlyne.com` | Propietario de *Café Aurora* (2 sucursales, ~90 días de ventas) |
| `cajero@ourlyne.com` | Cajero en *Sucursal Condesa* |
| `admin@ourlyne.com` | Superadministrador de la plataforma (`/admin`) |

La contraseña es el valor de `SEED_PASSWORD` en `.env.example`.

### Scripts

| Script | Descripción |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo (y Postgres local si hace falta) |
| `pnpm db:start` | Inicia solo el Postgres local en primer plano |
| `pnpm db:generate` | Genera una migración a partir del esquema Drizzle |
| `pnpm db:migrate` | Aplica migraciones |
| `pnpm db:seed` | Siembra planes, usuarios y el negocio demo |
| `pnpm db:reset` | Borra todo, migra y vuelve a sembrar |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm stripe:sync` | Crea productos y precios de cada plan en Stripe |
| `pnpm typecheck` / `pnpm lint` | Verificaciones |

### Stripe

1. Define `STRIPE_SECRET_KEY` y ejecuta `pnpm stripe:sync` para crear productos/precios.
2. Reenvía webhooks en local: `stripe listen --forward-to localhost:3001/api/stripe/webhook` y copia el secreto a `STRIPE_WEBHOOK_SECRET`.
3. Eventos manejados: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`.

## Arquitectura

```
src/
  app/
    (marketing)/          Landing pública
    (auth)/               Inicio de sesión y registro
    onboarding/           Alta de negocio y elección de plan
    invite/[token]/       Aceptación de invitaciones
    admin/                Panel del superadministrador
    app/[tenant]/
      (dashboard)/        Panel con sidebar: tablero, ventas, catálogo, inventario,
                          clientes, compras, cajas, gastos, cupones, reportes,
                          equipo, configuración y facturación
      (pos)/pos/          Terminal de punto de venta a pantalla completa
    api/auth, api/stripe  Better Auth y webhook de Stripe
  db/schema/              Esquema Drizzle (auth, plataforma, comercio, relaciones)
  server/                 Lógica de servidor: contexto de tenant, autorización,
                          ventas, inventario, cajas, facturación, consultas
  lib/                    Módulos, permisos, planes, dinero, totales, navegación
  components/             UI (shadcn), shell de la app, POS, gráficas, marca
```

### Convenciones

- **Importes en centavos** (`integer`), cantidades `numeric(14,3)` (productos a granel), tasas en puntos base.
- **Toda consulta filtra por `tenantId`**. `getTenantContext(slug)` resuelve sesión → membresía → rol → módulos del plan → sucursal activa, y cada Server Action vuelve a verificar con `authorize(slug, { permission, module })`.
- El cálculo de totales (`lib/pricing.ts`) es el mismo en el POS (vista previa) y en el servidor (fuente de verdad).
- Todo movimiento de existencias pasa por `applyStockChange`, que actualiza el saldo de forma atómica y escribe el kardex.
- Las fechas se guardan en UTC y se agrupan en la zona horaria del negocio.
