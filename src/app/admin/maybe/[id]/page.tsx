/**
 * Edit Maybe Submission Page
 * Allows doctor to edit submission fields and approve/deny
 */

import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getSubmissionById } from '../../actions'
import { SubmissionEditForm } from '@/components/admin/SubmissionEditForm'

export default async function EditMaybeSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // SECURITY: Check authentication
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect('/admin/login')
  }

  // Fetch submission
  const result = await getSubmissionById(id)

  if (!result.success || !result.submission) {
    notFound()
  }

  return <SubmissionEditForm submission={result.submission} />
}
