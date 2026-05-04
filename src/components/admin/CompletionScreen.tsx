/**
 * CompletionScreen Component
 * Shows when all submissions have been reviewed
 */

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface CompletionScreenProps {
  approvedCount: number
  deniedCount: number
  maybeCount?: number
  warning?: string | null
  onReturnToDashboard: () => void
}

export function CompletionScreen({
  approvedCount,
  deniedCount,
  maybeCount = 0,
  warning,
  onReturnToDashboard,
}: CompletionScreenProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 py-8 text-center">
          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">All caught up!</h1>
            <p className="text-muted-foreground">You reviewed all pending submissions</p>
          </div>

          {warning && (
            <div
              role="alert"
              className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-left text-sm text-yellow-900"
            >
              <strong>Warning:</strong> {warning}
            </div>
          )}

          {/* Stats Summary */}
          <div className="space-y-3 border-y py-6">
            <div className="flex items-center justify-center gap-2 text-lg">
              <span className="font-semibold">Approved:</span>
              <span className="text-2xl font-bold text-green-600">{approvedCount}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-lg">
              <span className="font-semibold">Denied:</span>
              <span className="text-2xl font-bold text-red-600">{deniedCount}</span>
            </div>
            {maybeCount > 0 && (
              <div className="flex items-center justify-center gap-2 text-lg">
                <span className="font-semibold">Maybe:</span>
                <span className="text-2xl font-bold text-yellow-600">{maybeCount}</span>
              </div>
            )}
          </div>

          {/* Return Button */}
          <Button onClick={onReturnToDashboard} size="lg" className="w-full">
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
