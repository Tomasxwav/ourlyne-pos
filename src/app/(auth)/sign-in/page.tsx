import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isGoogleEnabled } from '@/lib/auth'
import { getSession } from '@/server/session'
import { AuthForm } from '../auth-form'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default async function SignInPage(props: PageProps<'/sign-in'>) {
  const { next, email } = await props.searchParams
  const session = await getSession()
  const nextPath = typeof next === 'string' ? next : undefined
  if (session) redirect(nextPath ?? '/app')

  return (
    <AuthForm
      mode='sign-in'
      next={nextPath}
      defaultEmail={typeof email === 'string' ? email : undefined}
      googleEnabled={isGoogleEnabled}
    />
  )
}
