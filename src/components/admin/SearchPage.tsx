'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { NOTE_PURPOSE_LABELS } from '@/lib/admin-utils'
import { formatDateOnly, type DateOnly } from '@/lib/dates'
import {
  searchSubmissions,
  type AdminSearchType,
  type SearchSubmission,
} from '@/app/admin/_actions/search'

interface SearchPageProps {
  initialResults?: SearchSubmission[]
  initialTotal?: number
  initialQuery?: string
  initialSearchType?: AdminSearchType
  initialPage?: number
}

const SEARCH_TYPE_LABELS: Record<AdminSearchType, string> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  id: 'Submission ID',
  medicalRecord: 'Medical Record #',
}

function isAdminSearchType(value: string): value is AdminSearchType {
  return Object.hasOwn(SEARCH_TYPE_LABELS, value)
}

export function SearchPage({
  initialResults = [],
  initialTotal = 0,
  initialQuery = '',
  initialSearchType = 'name',
  initialPage = 1,
}: SearchPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [query, setQuery] = useState(initialQuery)
  const [searchType, setSearchType] = useState<AdminSearchType>(initialSearchType)
  const [results, setResults] = useState<SearchSubmission[]>(initialResults)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(initialPage)
  const [error, setError] = useState<string | null>(null)

  const limit = 10
  const totalPages = Math.ceil(total / limit)

  const handleSearch = async (newPage: number = 1) => {
    if (!query.trim()) {
      setResults([])
      setTotal(0)
      return
    }

    setError(null)

    startTransition(async () => {
      const result = await searchSubmissions({
        query: query.trim(),
        searchType,
        page: newPage,
        limit,
      })

      if (result.success) {
        setResults(result.submissions || [])
        setTotal(result.total || 0)
        setPage(newPage)

        const params = new URLSearchParams()
        params.set('q', query.trim())
        params.set('type', searchType)
        params.set('page', newPage.toString())
        router.push(`/admin/search?${params.toString()}`, { scroll: false })
      } else {
        setError(result.error || 'Search failed')
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(1)
    }
  }

  const formatDateRange = (firstDay: DateOnly, lastDay: DateOnly) =>
    firstDay === lastDay
      ? formatDateOnly(firstDay, 'short')
      : `${formatDateOnly(firstDay, 'short')} - ${formatDateOnly(lastDay, 'short')}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Search Submissions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search across all submissions by name, email, phone, Submission ID, or Medical Record #
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder={
              searchType === 'name'
                ? 'Enter patient name...'
                : searchType === 'email'
                  ? 'Enter email address...'
                  : searchType === 'phone'
                    ? 'Enter phone number...'
                    : searchType === 'medicalRecord'
                      ? 'Enter Medical Record #...'
                      : 'Enter Submission ID...'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
            disabled={isPending}
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={searchType}
            onValueChange={(value) => {
              if (isAdminSearchType(value)) setSearchType(value)
            }}
            disabled={isPending}
          >
            <SelectTrigger className="w-44">
              <SelectValue>{SEARCH_TYPE_LABELS[searchType]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SEARCH_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => handleSearch(1)} disabled={isPending || !query.trim()}>
            {isPending ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {results.length > 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {total} result{total !== 1 ? 's' : ''} found
            {totalPages > 1 && ` (page ${page} of ${totalPages})`}
          </p>

          <div className="space-y-3 sm:hidden">
            {results.map((submission) => (
              <Link
                key={submission.id}
                href={`/admin/search/${submission.id}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">
                      {submission.patientFirstName} {submission.patientLastName}
                    </p>
                    <a
                      href={`mailto:${submission.email}`}
                      className="block truncate text-sm text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {submission.email}
                    </a>
                  </div>
                  <StatusBadge status={submission.status} />
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
                  <span>
                    {formatDateRange(submission.firstDayOff, submission.lastDayOff)} |{' '}
                    {NOTE_PURPOSE_LABELS[submission.notePurpose] || submission.notePurpose}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </div>
                <p className="mt-1 text-xs text-gray-400">ID: {submission.id.slice(0, 12)}...</p>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Dates
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {results.map((submission) => (
                  <tr key={submission.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium text-gray-900">
                        {submission.patientFirstName} {submission.patientLastName}
                      </p>
                      <p className="text-xs text-gray-400">{submission.id.slice(0, 12)}...</p>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <a
                        href={`mailto:${submission.email}`}
                        className="text-blue-600 hover:underline"
                      >
                        {submission.email}
                      </a>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={submission.status} />
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-500">
                      {formatDateRange(submission.firstDayOff, submission.lastDayOff)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-500">
                      {NOTE_PURPOSE_LABELS[submission.notePurpose] || submission.notePurpose}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/admin/search/${submission.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSearch(page - 1)}
                disabled={page === 1 || isPending}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSearch(page + 1)}
                disabled={page === totalPages || isPending}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ) : query && !isPending ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-500">No submissions found matching your search.</p>
          <p className="mt-1 text-sm text-gray-400">Try a different search term or type.</p>
        </div>
      ) : !query ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <Search className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">Enter a search term to find submissions</p>
          <p className="mt-1 text-sm text-gray-400">
            Search by patient name, email address, phone number, Submission ID, or Medical Record #
          </p>
        </div>
      ) : null}
    </div>
  )
}
