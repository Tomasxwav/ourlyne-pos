import type { Metadata } from 'next'
import { requirePermission } from '@/server/tenant'
import { BusinessForm } from './settings-forms'

export const metadata: Metadata = { title: 'Configuración' }

export default async function SettingsPage(props: PageProps<'/app/[tenant]/settings'>) {
  const { tenant: slug } = await props.params
  const ctx = await requirePermission(slug, 'settings.manage')
  const t = ctx.tenant
  return (
    <BusinessForm
      slug={slug}
      business={{
        name: t.name,
        email: t.email,
        phone: t.phone,
        taxId: t.taxId,
        address: t.address,
        logoUrl: t.logoUrl,
        currency: t.currency,
        timezone: t.timezone,
        receiptHeader: t.receiptHeader,
        receiptFooter: t.receiptFooter,
        pricesIncludeTax: t.pricesIncludeTax,
        allowNegativeStock: t.allowNegativeStock,
      }}
    />
  )
}
