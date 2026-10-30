import { GoogleSignInButton } from '@/components/admin/GoogleSignInButton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type PageProps = {
  searchParams: Promise<{ error?: string }>
}

function signInError(code: string | undefined): string | null {
  if (!code) return null
  if (code === 'not_an_admin') {
    return 'This Google account is not allowed to use the admin portal. Sign in with the account your administrator added.'
  }
  return 'Google sign-in did not finish. Please try again.'
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const error = signInError((await searchParams).error)

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
