import { Progress } from '@/components/ui/progress';
import { PROGRESS_VALUES } from '@/lib/form-constants';

interface FormProgressProps {
  currentStep: number;
}

export function FormProgress({ currentStep }: FormProgressProps) {
  const progressValue =
    PROGRESS_VALUES[currentStep as keyof typeof PROGRESS_VALUES] || 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm font-semibold tracking-wide text-primary">
          Step {currentStep} of 9
        </p>
      </div>
      <Progress value={progressValue} className="h-2 bg-primary/10" />
      <p className="text-xs font-medium tracking-wide text-muted-foreground">
        {Math.round(progressValue)}% complete
      </p>
    </div>
  );
}
