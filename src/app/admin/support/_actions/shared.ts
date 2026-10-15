import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'

export async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  return session.user
}

export function revalidateSupportPaths(ticketId?: string | null, submissionId?: string | null) {
  revalidatePath('/admin')
  revalidatePath('/admin/support')
  if (ticketId) revalidatePath(`/admin/support/${ticketId}`)
  if (submissionId) {
    revalidatePath('/admin/search')
    revalidatePath(`/admin/search/${submissionId}`)
  }
}
