import { ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { useI18n } from '@/components/i18n/I18nProvider'
import { translateReactTree } from '@/lib/i18n'

interface FormEditableSectionProps {
  sectionId: string

  title: string

  editingSection: string | null

  onEdit: (sectionId: string) => void

  onCancel: (sectionId: string) => void

  onSave: () => void

  viewContent: ReactNode

  editContent: ReactNode

  editAriaLabel?: string
}

export function FormEditableSection({
  sectionId,
  title,
  editingSection,
  onEdit,
  onCancel,
  onSave,
  viewContent,
  editContent,
  editAriaLabel,
}: FormEditableSectionProps) {
  const isEditing = editingSection === sectionId
  const { t, locale } = useI18n()

  return (
    <div className="border-border/40 rounded-xl border bg-white p-4 shadow-sm md:p-6">
      {isEditing ? (
        <div className="space-y-3">
          <h3 className="text-foreground text-sm font-semibold">{t(title)}</h3>

          {translateReactTree(editContent, locale)}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => onCancel(sectionId)}
              className="text-foreground hover:bg-accent rounded-lg px-4 py-3 text-sm font-medium sm:py-2"
            >
              {t('Cancel')}
            </button>
            <button
              type="button"
              onClick={onSave}
              className="bg-primary hover:bg-primary/90 rounded-lg px-4 py-3 text-sm font-semibold text-white sm:py-2"
            >
              {t('Save')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1 break-words">
            <h3 className="text-foreground text-sm font-semibold">{t(title)}</h3>
            {translateReactTree(viewContent, locale)}
          </div>

          <button
            type="button"
            onClick={() => onEdit(sectionId)}
            className="text-primary -my-3 -mr-2 flex shrink-0 items-center gap-1 px-2 py-3 text-sm font-medium hover:underline"
            aria-label={editAriaLabel ? t(editAriaLabel) : `${t('Edit')} ${t(title).toLowerCase()}`}
          >
            <Pencil className="h-4 w-4" />
            {t('Edit')}
          </button>
        </div>
      )}
    </div>
  )
}
