'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Fragment, useEffect, useState, useTransition } from 'react'
import { Building2, Check, ChevronDown, Search, ShoppingCart } from 'lucide-react'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { SEGMENT_LABELS, type NavItem } from '@/lib/navigation'
import { setActiveBranch } from '@/server/tenant-actions'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i

export function Topbar({
  slug,
  branches,
  branchId,
  groups,
  canSell,
}: {
  slug: string
  branches: { id: string; name: string }[]
  branchId: string
  groups: { label: string; items: NavItem[] }[]
  canSell: boolean
}) {
  const pathname = usePathname()
  const base = `/app/${slug}`
  const segments = pathname.replace(base, '').split('/').filter(Boolean)

  return (
    <header className='sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md md:rounded-t-xl'>
      <SidebarTrigger className='-ml-1' />
      <Separator orientation='vertical' className='mr-1 h-4 data-[orientation=vertical]:self-center' />
      <Breadcrumb className='hidden sm:block'>
        <BreadcrumbList>
          <BreadcrumbItem>
            {segments.length ? (
              <BreadcrumbLink render={<Link href={base} />}>Tablero</BreadcrumbLink>
            ) : (
              <BreadcrumbPage>Tablero</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {segments.map((seg, i) => {
            const href = `${base}/${segments.slice(0, i + 1).join('/')}`
            const label = SEGMENT_LABELS[seg] ?? (UUID.test(seg) ? 'Detalle' : decodeURIComponent(seg))
            const last = i === segments.length - 1
            return (
              <Fragment key={href}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {last ? (
                    <BreadcrumbPage>{label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link href={href} />}>{label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className='ml-auto flex items-center gap-2'>
        <CommandMenu base={base} groups={groups} />
        <BranchSwitcher slug={slug} branches={branches} branchId={branchId} />
        {canSell && (
          <Link
            href={`${base}/pos`}
            className={buttonVariants({ size: 'lg', className: 'hidden gap-1.5 md:inline-flex' })}
          >
            <ShoppingCart /> Abrir POS
          </Link>
        )}
        <AnimatedThemeToggler className='flex size-8 items-center justify-center rounded-md border transition-colors hover:bg-accent [&_svg]:size-3.5' />
      </div>
    </header>
  )
}

function BranchSwitcher({
  slug,
  branches,
  branchId,
}: {
  slug: string
  branches: { id: string; name: string }[]
  branchId: string
}) {
  const [pending, start] = useTransition()
  const current = branches.find((b) => b.id === branchId)
  if (branches.length <= 1) {
    return (
      <span className='hidden items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground lg:flex'>
        <Building2 className='size-3.5' /> {current?.name}
      </span>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant='outline' size='lg' className='gap-1.5' disabled={pending} />}
      >
        <Building2 />
        <span className='hidden max-w-32 truncate lg:inline'>{current?.name}</span>
        <ChevronDown className='opacity-60' />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='min-w-48'>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sucursal activa</DropdownMenuLabel>
          {branches.map((b) => (
            <DropdownMenuItem key={b.id} onClick={() => start(() => setActiveBranch(slug, b.id))}>
              <span className='flex-1'>{b.name}</span>
              {b.id === branchId && <Check className='text-gold-deep' />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CommandMenu({ base, groups }: { base: string; groups: { label: string; items: NavItem[] }[] }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <Button
        variant='outline'
        size='lg'
        className='w-9 justify-start gap-2 px-2 text-muted-foreground sm:w-56'
        onClick={() => setOpen(true)}
      >
        <Search />
        <span className='hidden flex-1 text-left sm:inline'>Buscar…</span>
        <Kbd className='hidden sm:inline-flex'>Ctrl K</Kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title='Ir a…' description='Navega por los módulos'>
        <CommandInput placeholder='¿A dónde quieres ir?' />
        <CommandList>
          <CommandEmpty>Sin resultados.</CommandEmpty>
          {groups.map((g) => (
            <CommandGroup key={g.label} heading={g.label}>
              {g.items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${g.label} ${item.title}`}
                  onSelect={() => {
                    setOpen(false)
                    router.push(`${base}${item.href}`)
                  }}
                >
                  {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  )
}
