import { Progress } from '@/components/ui/progress'
import { PROGRESS_VALUES } from '@/lib/form-constants'
import { getFormData } from '@/lib/form-storage'
import { useI18n } from '@/components/i18n/I18nProvider'

interface FormProgressProps {
  currentStep: number
}

export function FormProgress({ currentStep }: FormProgressProps) {
  const { t } = useI18n()
  const progressValue = PROGRESS_VALUES[currentStep as keyof typeof PROGRESS_VALUES] || 0

  // Dynamic total steps based on recipient
  const savedData = getFormData()
  const recipient = savedData.recipient || 'myself'
  const totalSteps = recipient === 'someone_else' ? 11 : 10

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-primary text-sm font-semibold tracking-wide">
          {t('Step')} {currentStep} {t('of')} {totalSteps}
        </p>
      </div>
      <Progress value={progressValue} className="bg-primary/10 h-2" />
      <p className="text-muted-foreground text-xs font-medium tracking-wide">
        {Math.round(progressValue)}% {t('complete')}
      </p>
    </div>
  )
}
