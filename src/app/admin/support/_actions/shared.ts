import { revalidatePath } from 'next/cache'

export function revalidateSupportPaths(ticketId?: string | null, submissionId?: string | null) {
  revalidatePath('/admin')
  revalidatePath('/admin/support')
  if (ticketId) revalidatePath(`/admin/support/${ticketId}`)
  if (submissionId) {
    revalidatePath('/admin/search')
    revalidatePath(`/admin/search/${submissionId}`)
  }
}
