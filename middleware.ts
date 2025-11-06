/**
 * Middleware for Route Protection
 * Protects admin routes and redirects unauthenticated users to login
 */

import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        // Allow access to login page without token
        if (req.nextUrl.pathname.startsWith('/admin/login')) {
          return true
        }
        // Require token for all other admin pages
        return !!token
      },
    },
    pages: {
      signIn: '/admin/login',
    },
  }
)

export const config = {
  matcher: ['/admin/:path*'],
}
