import { Progress } from '@/components/ui/progress'
import { getFormData } from '@/lib/form-storage'
import { stepNumber, totalSteps, type IntakeRoute } from '@/lib/intake'
import { useI18n } from '@/components/i18n/I18nProvider'
import { useFunnelStep } from '@/components/useFunnelStep'

interface FormProgressProps {
  route: IntakeRoute
}

export function FormProgress({ route }: FormProgressProps) {
  const { t } = useI18n()
  useFunnelStep(route)
  const draft = getFormData()
  const current = stepNumber(route, draft)
  const total = totalSteps(draft)
  const progressValue = Math.round((current / (total + 1)) * 100)
  const label = `${t('Step')} ${current} ${t('of')} ${total}`

  return (
    <Progress value={progressValue} aria-label={label} className="bg-primary/10 h-1 rounded-none" />
  )
}
