/**
 * AdminStats Component
 * Displays dashboard statistics in card format
 */

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface AdminStatsProps {
  pendingCount: number
  approvedToday: number
  deniedToday: number
  maybeCount?: number
}

export function AdminStats({ pendingCount, approvedToday, deniedToday, maybeCount = 0 }: AdminStatsProps) {
  const stats = [
    {
      label: 'Pending Reviews',
      value: pendingCount,
      color: 'text-blue-600',
    },
    {
      label: 'Approved Today',
      value: approvedToday,
      color: 'text-green-600',
    },
    {
      label: 'Denied Today',
      value: deniedToday,
      color: 'text-red-600',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-0">
          <CardContent className="flex flex-col items-center justify-center p-4 text-center sm:p-6">
            <div className={`text-2xl font-bold ${stat.color} mb-1 sm:text-4xl sm:mb-2`}>
              {stat.value}
            </div>
            <div className="text-xs text-muted-foreground sm:text-sm">{stat.label}</div>
          </CardContent>
        </Card>
      ))}

      {/* Maybe Card with View Button */}
      <Card className="p-0">
        <CardContent className="flex flex-col items-center justify-center p-4 text-center sm:p-6">
          <div className="text-2xl font-bold text-yellow-600 mb-1 sm:text-4xl sm:mb-2">
            {maybeCount}
          </div>
          <div className="text-xs text-muted-foreground sm:text-sm mb-2">Maybe</div>
          {maybeCount > 0 && (
            <Link href="/admin/maybe">
              <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-yellow-500 text-yellow-600 hover:bg-yellow-50">
                View
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
