import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

/**
 * Chequeo optimista: si no hay cookie de sesión en rutas privadas, redirige a
 * /sign-in. La verificación real (sesión, membresía, permisos) ocurre en el
 * servidor con `getTenantContext`.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL('/sign-in', request.url)
    url.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/app/:path*', '/onboarding/:path*', '/admin/:path*'],
}
