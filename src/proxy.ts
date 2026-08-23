import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  const isSpanish = request.nextUrl.pathname === '/es' || request.nextUrl.pathname.startsWith('/es/')
  requestHeaders.set('x-site-locale', isSpanish ? 'es' : 'en')

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images).*)'],
}
