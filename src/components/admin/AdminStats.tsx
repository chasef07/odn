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
  manualCount?: number
}

export function AdminStats({
  pendingCount,
  approvedToday,
  deniedToday,
  maybeCount = 0,
  manualCount = 0,
}: AdminStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Pending Reviews Card */}
      <Card className="p-0">
        <CardContent className="flex flex-col items-center justify-center p-4 text-center sm:p-6">
          <div className="mb-1 text-2xl font-bold text-blue-600 sm:mb-2 sm:text-4xl">
            {pendingCount}
          </div>
          <div className="text-muted-foreground text-xs sm:text-sm">Pending Reviews</div>
        </CardContent>
      </Card>

      {/* Approved Today Card with View Button */}
      <Card className="p-0">
        <CardContent className="flex flex-col items-center justify-center p-4 text-center sm:p-6">
          <div className="mb-1 text-2xl font-bold text-green-600 sm:mb-2 sm:text-4xl">
            {approvedToday}
          </div>
          <div className="text-muted-foreground mb-2 text-xs sm:text-sm">Approved Today</div>
          {approvedToday > 0 && (
            <Link href="/admin/approved">
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-green-500 px-2 text-xs text-green-600 hover:bg-green-50"
              >
                View
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Denied Today Card with View Button */}
      <Card className="p-0">
        <CardContent className="flex flex-col items-center justify-center p-4 text-center sm:p-6">
          <div className="mb-1 text-2xl font-bold text-red-600 sm:mb-2 sm:text-4xl">
            {deniedToday}
          </div>
          <div className="text-muted-foreground mb-2 text-xs sm:text-sm">Denied Today</div>
          {deniedToday > 0 && (
            <Link href="/admin/denied">
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-red-500 px-2 text-xs text-red-600 hover:bg-red-50"
              >
                View
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Maybe/Manual Card with View Button */}
      <Card className="p-0">
        <CardContent className="flex flex-col items-center justify-center p-4 text-center sm:p-6">
          <div className="mb-1 flex items-center gap-1 sm:mb-2">
            <div className="text-xl font-bold text-yellow-600 sm:text-3xl">{maybeCount}</div>
            <div className="text-muted-foreground text-xs sm:text-sm">/</div>
            <div className="text-xl font-bold text-purple-600 sm:text-3xl">{manualCount}</div>
          </div>
          <div className="text-muted-foreground mb-2 text-xs sm:text-sm">Maybe / Manual</div>
          {(maybeCount > 0 || manualCount > 0) && (
            <Link href="/admin/maybe">
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-yellow-500 px-2 text-xs text-yellow-600 hover:bg-yellow-50"
              >
                View
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
