import { NextResponse, type NextRequest } from 'next/server'
import {
  getVerificationBaseUrl,
  isOnlineDoctorHostname,
  isVerificationHostname,
  isVerificationPath,
} from '@/lib/verification-url'

function getRequestHostname(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
  )
}

function verificationRedirect(request: NextRequest): NextResponse {
  const destination = new URL(getVerificationBaseUrl())
  destination.pathname = request.nextUrl.pathname
  destination.search = request.nextUrl.search
  return NextResponse.redirect(destination, 308)
}

function verificationResponse(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers)
  const isSpanish = request.nextUrl.pathname.startsWith('/es/')
  requestHeaders.set('x-site-locale', isSpanish ? 'es' : 'en')

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

export function proxy(request: NextRequest) {
  const hostname = getRequestHostname(request)
  const { pathname } = request.nextUrl

  if (isOnlineDoctorHostname(hostname) && isVerificationPath(pathname)) {
    return verificationRedirect(request)
  }

  if (isVerificationHostname(hostname)) {
    if (pathname === '/' || pathname === '/es') {
      const destination = request.nextUrl.clone()
      destination.pathname = pathname === '/es' ? '/es/verify' : '/verify'
      return NextResponse.redirect(destination, 308)
    }

    if (pathname === '/robots.txt') {
      return new NextResponse('User-agent: *\nDisallow: /\n', {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      })
    }

    if (!isVerificationPath(pathname)) {
      return new NextResponse('Not Found', {
        status: 404,
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      })
    }

    return verificationResponse(request)
  }

  const requestHeaders = new Headers(request.headers)
  const isSpanish = pathname === '/es' || pathname.startsWith('/es/')
  requestHeaders.set('x-site-locale', isSpanish ? 'es' : 'en')

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|images).*)'],
}
