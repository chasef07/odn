'use client'

/**
 * Search Page Component
 * Main search interface for finding submissions by name, email, or ID
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { searchSubmissions, type SearchSubmission } from '@/app/admin/actions'

interface SearchPageProps {
  initialResults?: SearchSubmission[]
  initialTotal?: number
  initialQuery?: string
  initialSearchType?: 'name' | 'email' | 'id' | 'phone'
  initialPage?: number
}

const NOTE_PURPOSE_LABELS: Record<string, string> = {
  work: 'Work',
  school: 'School',
  both: 'Work & School',
  travel: 'Travel',
  other: 'Other',
}

export function SearchPage({
  initialResults = [],
  initialTotal = 0,
  initialQuery = '',
  initialSearchType = 'name',
  initialPage = 1,
}: SearchPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [query, setQuery] = useState(initialQuery)
  const [searchType, setSearchType] = useState<'name' | 'email' | 'id' | 'phone'>(initialSearchType)
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

        // Update URL with search params
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

  const formatDateRange = (firstDay: string, lastDay: string) => {
    const formatDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-')
      return `${month}/${day}/${year.slice(2)}`
    }

    if (firstDay === lastDay) {
      return formatDate(firstDay)
    }
    return `${formatDate(firstDay)} - ${formatDate(lastDay)}`
  }

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Search Submissions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search across all submissions by name, email, phone, or ID
        </p>
      </div>

      {/* Search Form */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder={
              searchType === 'name'
                ? 'Enter patient name...'
                : searchType === 'email'
                  ? 'Enter email address...'
                  : searchType === 'phone'
                    ? 'Enter phone number...'
                    : 'Enter submission ID...'
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
            onValueChange={(value: 'name' | 'email' | 'id' | 'phone') => setSearchType(value)}
            disabled={isPending}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="id">ID</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => handleSearch(1)} disabled={isPending || !query.trim()}>
            {isPending ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 ? (
        <div className="space-y-4">
          {/* Results Count */}
          <p className="text-sm text-gray-500">
            {total} result{total !== 1 ? 's' : ''} found
            {totalPages > 1 && ` (page ${page} of ${totalPages})`}
          </p>

          {/* Results Cards (Mobile) */}
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
                    <a href={`mailto:${submission.email}`} className="block truncate text-sm text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>{submission.email}</a>
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

          {/* Results Table (Desktop) */}
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Dates
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Type
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {results.map((submission) => (
                  <tr key={submission.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {submission.patientFirstName} {submission.patientLastName}
                      </p>
                      <p className="text-xs text-gray-400">{submission.id.slice(0, 12)}...</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <a href={`mailto:${submission.email}`} className="text-blue-600 hover:underline">{submission.email}</a>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={submission.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {formatDateRange(submission.firstDayOff, submission.lastDayOff)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {NOTE_PURPOSE_LABELS[submission.notePurpose] || submission.notePurpose}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
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

          {/* Pagination */}
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
            Search by patient name, email address, phone number, or submission ID
          </p>
        </div>
      ) : null}
    </div>
  )
}
