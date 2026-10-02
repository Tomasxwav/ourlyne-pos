'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Boxes,
  ChartColumn,
  Check,
  ChevronsUpDown,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Package,
  Plus,
  Receipt,
  ReceiptText,
  Settings,
  ShoppingCart,
  Sparkles,
  Tags,
  TicketPercent,
  Truck,
  UserRound,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { authClient } from '@/lib/auth-client'
import type { NavIcon, NavItem } from '@/lib/navigation'
import { cn } from '@/lib/utils'

const ICONS: Record<NavIcon, LucideIcon> = {
  LayoutDashboard,
  ShoppingCart,
  ReceiptText,
  Package,
  Tags,
  Boxes,
  Users,
  Truck,
  Wallet,
  Receipt,
  TicketPercent,
  ChartColumn,
  UsersRound,
  Settings,
  CreditCard,
}

export type ShellTenant = { id: string; slug: string; name: string; logoUrl: string | null; role: string }

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function AppSidebar({
  slug,
  groups,
  tenant,
  tenants,
  user,
  planName,
  trialDaysLeft,
}: {
  slug: string
  groups: { label: string; items: NavItem[] }[]
  tenant: ShellTenant
  tenants: ShellTenant[]
  user: { name: string; email: string; image?: string | null }
  planName: string | null
  trialDaysLeft: number | null
}) {
  const pathname = usePathname()
  const base = `/app/${slug}`

  return (
    <Sidebar collapsible='icon' variant='inset'>
      <SidebarHeader>
        <TenantSwitcher current={tenant} tenants={tenants} />
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className='tracking-[0.18em] uppercase text-[0.6rem]'>
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const href = `${base}${item.href}`
                const active = item.href === '' ? pathname === base : pathname.startsWith(href)
                const Icon = ICONS[item.icon]
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      render={<Link href={href} />}
                      className='relative data-active:before:absolute data-active:before:inset-y-1.5 data-active:before:-left-2 data-active:before:w-0.5 data-active:before:rounded-full data-active:before:bg-gold'
                    >
                      <Icon className={cn(active && 'text-gold-deep dark:text-gold')} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        {planName && (
          <Link
            href={`${base}/billing`}
            className='group/plan mx-1 mb-1 rounded-lg border border-gold/30 bg-linear-to-br from-gold/15 to-transparent p-3 text-xs transition-colors hover:border-gold/60 group-data-[collapsible=icon]:hidden'
          >
            <div className='flex items-center gap-1.5 font-medium'>
              <Sparkles className='size-3.5 text-gold-deep dark:text-gold' />
              Plan {planName}
            </div>
            <p className='mt-1 text-muted-foreground'>
              {trialDaysLeft !== null
                ? `Prueba: ${trialDaysLeft} ${trialDaysLeft === 1 ? 'día restante' : 'días restantes'}`
                : 'Administra tu suscripción'}
            </p>
          </Link>
        )}
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function TenantLogo({ tenant, className }: { tenant: ShellTenant; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-velvet text-[0.65rem] font-semibold text-gold',
        className,
      )}
    >
      {tenant.logoUrl ? (
        <Image src={tenant.logoUrl} alt='' width={32} height={32} className='size-full object-cover' />
      ) : (
        initials(tenant.name)
      )}
    </span>
  )
}

function TenantSwitcher({ current, tenants }: { current: ShellTenant; tenants: ShellTenant[] }) {
  const { isMobile } = useSidebar()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size='lg'
                className='data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground'
              />
            }
          >
            <TenantLogo tenant={current} />
            <div className='grid flex-1 text-left leading-tight'>
              <span className='truncate text-sm font-semibold'>{current.name}</span>
              <span className='truncate text-[0.65rem] text-muted-foreground'>{current.role}</span>
            </div>
            <ChevronsUpDown className='ml-auto' />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='min-w-60'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>Tus negocios</DropdownMenuLabel>
              {tenants.map((t) => (
                <DropdownMenuItem key={t.id} render={<Link href={`/app/${t.slug}`} />} className='gap-2 p-2'>
                  <TenantLogo tenant={t} className='size-6 rounded-md text-[0.55rem]' />
                  <span className='flex-1 truncate'>{t.name}</span>
                  {t.id === current.id && <Check className='text-gold-deep' />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href='/onboarding' />} className='gap-2 p-2'>
              <span className='flex size-6 items-center justify-center rounded-md border bg-background'>
                <Plus className='size-3.5' />
              </span>
              Crear otro negocio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function UserMenu({ user }: { user: { name: string; email: string; image?: string | null } }) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size='lg' className='data-popup-open:bg-sidebar-accent' />}
          >
            <Avatar className='size-8 rounded-lg'>
              {user.image && <AvatarImage src={user.image} alt={user.name} />}
              <AvatarFallback className='rounded-lg bg-gold/20 text-[0.65rem] font-semibold text-gold-deep dark:text-gold'>
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className='grid flex-1 text-left leading-tight'>
              <span className='truncate text-xs font-medium'>{user.name}</span>
              <span className='truncate text-[0.65rem] text-muted-foreground'>{user.email}</span>
            </div>
            <ChevronsUpDown className='ml-auto' />
          </DropdownMenuTrigger>
          <DropdownMenuContent className='min-w-56' side={isMobile ? 'bottom' : 'right'} align='end' sideOffset={4}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className='flex items-center gap-2'>
                <UserRound className='size-3.5' /> {user.email}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant='destructive'
              onClick={async () => {
                await authClient.signOut()
                router.push('/sign-in')
                router.refresh()
              }}
            >
              <LogOut /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
