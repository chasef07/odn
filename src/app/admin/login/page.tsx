import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { GoogleSignInButton } from '@/components/admin/GoogleSignInButton'
import { signInErrorMessage } from '@/components/admin/sign-in-error'
import { findAdminSession } from '@/lib/admin-session'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type PageProps = {
  searchParams: Promise<{ error?: string }>
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  if (await findAdminSession(await headers())) redirect('/admin')
  const { error: code } = await searchParams
  const error = code ? signInErrorMessage(code) : null

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl font-bold">Admin Portal</CardTitle>
          <CardDescription className="text-center">
            Sign in with Google to access the doctor review portal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}
          <GoogleSignInButton />
        </CardContent>
      </Card>
    </div>
  )
}
