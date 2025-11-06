/**
 * Monthly Limit Warning Component
 * Displays warning when patient exceeds 7-day monthly limit
 */

import { format } from 'date-fns'
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

  if (!wouldExceed && monthlyUsage.totalDays < 5) {
    // Don't show warning if well under limit
    return null
  }

  return (
    <Card className={`p-4 ${wouldExceed ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-2xl">
          {wouldExceed ? '🚨' : '⚠️'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold mb-2 ${wouldExceed ? 'text-red-900' : 'text-yellow-900'}`}>
            {wouldExceed ? 'Monthly Limit Exceeded' : 'Approaching Monthly Limit'}
          </h3>

          <div className={`text-sm space-y-2 ${wouldExceed ? 'text-red-800' : 'text-yellow-800'}`}>
            <p>
              This patient has already used <strong>{monthlyUsage.totalDays} of 7</strong> allowed days this month:
            </p>

            {monthlyUsage.submissions.length > 0 && (
              <ul className="list-disc list-inside space-y-1 ml-2">
                {monthlyUsage.submissions.map((sub) => (
                  <li key={sub.id}>
                    {format(sub.firstDayOff, 'MMM d')} - {format(sub.lastDayOff, 'MMM d')}
                    {' '}({sub.days} {sub.days === 1 ? 'day' : 'days'})
                    {sub.approvedAt && (
                      <span className="text-xs ml-1">
                        • Approved {format(sub.approvedAt, 'MMM d')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="pt-2 border-t border-current/20">
              <p className="font-medium">
                This request: {requestedDays} {requestedDays === 1 ? 'day' : 'days'}
              </p>
              <p className="font-bold">
                Total if approved: {newTotal} days
                {wouldExceed && (
                  <span className="ml-2 text-red-600">❌ EXCEEDS 7-DAY LIMIT</span>
                )}
              </p>
            </div>

            {wouldExceed && (
              <p className="pt-2 text-xs italic">
                Consider marking as "Maybe" or "Deny" this request. Approving would exceed the monthly limit.
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
