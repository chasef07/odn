import { Progress } from '@/components/ui/progress'
import { getFormData } from '@/lib/form-storage'
import { stepNumber, totalSteps, type IntakeRoute } from '@/lib/intake'
import { useI18n } from '@/components/i18n/I18nProvider'

interface FormProgressProps {
  route: IntakeRoute
}

export function FormProgress({ route }: FormProgressProps) {
  const { t } = useI18n()
  const draft = getFormData()
  const current = stepNumber(route, draft)
  const total = totalSteps(draft)
  const stepsThroughPayment = total + 1
  const progressValue = Math.round((current / stepsThroughPayment) * 100)

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-primary text-sm font-semibold tracking-wide">
          {t('Step')} {current} {t('of')} {total}
        </p>
      </div>
      <Progress value={progressValue} className="bg-primary/10 h-2" />
      <p className="text-muted-foreground text-xs font-medium tracking-wide">
        {progressValue}% {t('complete')}
      </p>
    </div>
  )
}
