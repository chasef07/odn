import { notFound } from 'next/navigation'
import { getSubmissionById } from '@/app/admin/_actions/search'
import { SubmissionEditForm } from '@/components/admin/SubmissionEditForm'
import { requireAdminSession } from '@/lib/admin-session'

export default async function EditMaybeSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  await requireAdminSession()

  const result = await getSubmissionById(id)

  if (!result.success || !result.submission) {
    notFound()
  }

  return <SubmissionEditForm submission={result.submission} />
}
