import { formatDateOnlyRange, formatInstantET, instantOf } from '@/lib/dates'
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
    return null
  }

  const currentPercent = Math.min((monthlyUsage.totalDays / limit) * 100, 100)

  return (
    <Card
      className={`p-4 ${wouldExceed ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">{wouldExceed ? '🚨' : '⚠️'}</span>
        <h3 className={`text-base font-bold ${wouldExceed ? 'text-red-900' : 'text-yellow-900'}`}>
          {wouldExceed ? '30-Day Limit Exceeded' : 'Approaching 30-Day Limit'}
        </h3>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex justify-between gap-2 text-xs">
          <span className={wouldExceed ? 'text-red-700' : 'text-yellow-700'}>
            {monthlyUsage.totalDays} used + {requestedDays} requested ={' '}
            <strong>{newTotal} days</strong>
          </span>
          <span className={wouldExceed ? 'text-red-700' : 'text-yellow-700'}>Limit: {limit}</span>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full transition-all duration-300 ${wouldExceed ? 'bg-red-400' : 'bg-yellow-400'}`}
            style={{ width: `${currentPercent}%` }}
          >
            <div
              className={`h-full ${wouldExceed ? 'bg-red-600' : 'bg-yellow-600'}`}
              style={{
                width: `${(requestedDays / monthlyUsage.totalDays) * 100}%`,
                marginLeft: `${currentPercent}%`,
                position: 'relative',
                left: `-${currentPercent}%`,
              }}
            />
          </div>
          <div
            className={`-mt-3 h-full ${wouldExceed ? 'bg-red-600' : 'bg-yellow-600'}`}
            style={{
              width: `${Math.min((requestedDays / limit) * 100, 100 - currentPercent)}%`,
              marginLeft: `${currentPercent}%`,
            }}
          />
        </div>

        {wouldExceed && (
          <p className="mt-1 text-xs font-semibold text-red-600">
            +{newTotal - limit} day{newTotal - limit > 1 ? 's' : ''} over limit
          </p>
        )}
      </div>

      {monthlyUsage.submissions.length > 0 && (
        <details className={`text-xs ${wouldExceed ? 'text-red-700' : 'text-yellow-700'}`}>
          <summary className="mb-1 cursor-pointer hover:underline">
            View {monthlyUsage.submissions.length} previous submission
            {monthlyUsage.submissions.length > 1 ? 's' : ''} in past 30 days
          </summary>
          <ul className="mt-1 ml-2 list-inside list-disc space-y-0.5">
            {monthlyUsage.submissions.map((sub) => (
              <li key={sub.id}>
                {formatDateOnlyRange(sub.firstDayOff, sub.lastDayOff)} ({sub.days} day
                {sub.days > 1 ? 's' : ''})
                {sub.approvedAt && (
                  <span className="ml-1 opacity-70">
                    • {formatInstantET(instantOf(sub.approvedAt), { includeYear: false })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {wouldExceed && (
        <p
          className={`mt-2 border-t pt-2 text-xs ${wouldExceed ? 'border-red-200 text-red-700' : 'border-yellow-200 text-yellow-700'}`}
        >
          Consider &quot;Maybe&quot; or &quot;Deny&quot; — approving exceeds the 7-day rolling
          limit.
        </p>
      )}
    </Card>
  )
}
