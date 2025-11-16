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
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Pending Reviews Card */}
      <Card className="p-0">
        <CardContent className="flex flex-col items-center justify-center p-4 text-center sm:p-6">
          <div className="text-2xl font-bold text-blue-600 mb-1 sm:text-4xl sm:mb-2">
            {pendingCount}
          </div>
          <div className="text-xs text-muted-foreground sm:text-sm">Pending Reviews</div>
        </CardContent>
      </Card>

      {/* Approved Today Card with View Button */}
      <Card className="p-0">
        <CardContent className="flex flex-col items-center justify-center p-4 text-center sm:p-6">
          <div className="text-2xl font-bold text-green-600 mb-1 sm:text-4xl sm:mb-2">
            {approvedToday}
          </div>
          <div className="text-xs text-muted-foreground sm:text-sm mb-2">Approved Today</div>
          {approvedToday > 0 && (
            <Link href="/admin/approved">
              <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-green-500 text-green-600 hover:bg-green-50">
                View
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Denied Today Card with View Button */}
      <Card className="p-0">
        <CardContent className="flex flex-col items-center justify-center p-4 text-center sm:p-6">
          <div className="text-2xl font-bold text-red-600 mb-1 sm:text-4xl sm:mb-2">
            {deniedToday}
          </div>
          <div className="text-xs text-muted-foreground sm:text-sm mb-2">Denied Today</div>
          {deniedToday > 0 && (
            <Link href="/admin/denied">
              <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-red-500 text-red-600 hover:bg-red-50">
                View
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>

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
