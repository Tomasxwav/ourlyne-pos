import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})

export async function requireSession(returnTo?: string) {
  const session = await getSession()
  if (!session) {
    redirect(returnTo ? `/sign-in?next=${encodeURIComponent(returnTo)}` : '/sign-in')
  }
  return session
}

export async function requireSuperAdmin() {
  const session = await requireSession('/admin')
  if (session.user.platformRole !== 'superadmin') redirect('/app')
  return session
}
