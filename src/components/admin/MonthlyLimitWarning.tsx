/**
 * 30-Day Limit Warning Component
 * Displays warning when patient approaches or exceeds 7-day rolling limit
 */

import { format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { MonthlyUsage } from '@/lib/monthly-limit'
import { Card } from '@/components/ui/card'

interface MonthlyLimitWarningProps {
  monthlyUsage: MonthlyUsage
  requestedDays: number
  newTotal: number
}

export function MonthlyLimitWarning({
  monthlyUsage,
  requestedDays,
  newTotal,
}: MonthlyLimitWarningProps) {
  const wouldExceed = newTotal > 7
  const limit = 7

  if (!wouldExceed && monthlyUsage.totalDays < 5) {
    // Don't show warning if well under limit
    return null
  }

  // Calculate progress percentage (cap at 100% for visual)
  const progressPercent = Math.min((newTotal / limit) * 100, 100)
  const currentPercent = Math.min((monthlyUsage.totalDays / limit) * 100, 100)

  return (
    <Card className={`p-4 ${wouldExceed ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'}`}>
      {/* Header with icon and title */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{wouldExceed ? '🚨' : '⚠️'}</span>
        <h3 className={`font-bold text-base ${wouldExceed ? 'text-red-900' : 'text-yellow-900'}`}>
          {wouldExceed ? '30-Day Limit Exceeded' : 'Approaching 30-Day Limit'}
        </h3>
      </div>

      {/* Progress bar section */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className={wouldExceed ? 'text-red-700' : 'text-yellow-700'}>
            {monthlyUsage.totalDays} used + {requestedDays} requested = <strong>{newTotal} days</strong>
          </span>
          <span className={wouldExceed ? 'text-red-700' : 'text-yellow-700'}>
            Limit: {limit}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          {/* Current usage (darker) */}
          <div
            className={`h-full transition-all duration-300 ${wouldExceed ? 'bg-red-400' : 'bg-yellow-400'}`}
            style={{ width: `${currentPercent}%` }}
          >
            {/* Requested days overlay (lighter, stacked on top) */}
            <div
              className={`h-full ${wouldExceed ? 'bg-red-600' : 'bg-yellow-600'}`}
              style={{
                width: `${(requestedDays / monthlyUsage.totalDays) * 100}%`,
                marginLeft: `${currentPercent}%`,
                position: 'relative',
                left: `-${currentPercent}%`
              }}
            />
          </div>
          {/* Requested days portion */}
          <div
            className={`h-full -mt-3 ${wouldExceed ? 'bg-red-600' : 'bg-yellow-600'}`}
            style={{
              width: `${Math.min((requestedDays / limit) * 100, 100 - currentPercent)}%`,
              marginLeft: `${currentPercent}%`
            }}
          />
        </div>

        {wouldExceed && (
          <p className="text-xs text-red-600 font-semibold mt-1">
            +{newTotal - limit} day{newTotal - limit > 1 ? 's' : ''} over limit
          </p>
        )}
      </div>

      {/* Previous submissions (collapsible detail) */}
      {monthlyUsage.submissions.length > 0 && (
        <details className={`text-xs ${wouldExceed ? 'text-red-700' : 'text-yellow-700'}`}>
          <summary className="cursor-pointer hover:underline mb-1">
            View {monthlyUsage.submissions.length} previous submission{monthlyUsage.submissions.length > 1 ? 's' : ''} in past 30 days
          </summary>
          <ul className="list-disc list-inside space-y-0.5 ml-2 mt-1">
            {monthlyUsage.submissions.map((sub) => (
              <li key={sub.id}>
                {formatInTimeZone(sub.firstDayOff, 'UTC', 'MMM d')} - {formatInTimeZone(sub.lastDayOff, 'UTC', 'MMM d')}
                {' '}({sub.days} day{sub.days > 1 ? 's' : ''})
                {sub.approvedAt && (
                  <span className="opacity-70 ml-1">
                    • {format(sub.approvedAt, 'MMM d')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Action suggestion */}
      {wouldExceed && (
        <p className={`text-xs mt-2 pt-2 border-t ${wouldExceed ? 'border-red-200 text-red-700' : 'border-yellow-200 text-yellow-700'}`}>
          Consider &quot;Maybe&quot; or &quot;Deny&quot; — approving exceeds the 7-day rolling limit.
        </p>
      )}
    </Card>
  )
}
