import { ReactNode } from 'react'
import { Pencil } from 'lucide-react'

interface FormEditableSectionProps {
  /** Unique section identifier */
  sectionId: string

  /** Section title */
  title: string

  /** Currently editing section */
  editingSection: string | null

  /** Callback when edit button clicked */
  onEdit: (sectionId: string) => void

  /** Callback when cancel button clicked */
  onCancel: (sectionId: string) => void

  /** Callback when save button clicked */
  onSave: () => void

  /** Content to display in view mode */
  viewContent: ReactNode

  /** Content to display in edit mode (form fields) */
  editContent: ReactNode

  /** Custom aria label for edit button */
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

  return (
    <div className="border-border/40 rounded-xl border bg-white p-6 shadow-sm">
      {isEditing ? (
        // Edit Mode
        <div className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold">{title}</h3>

          {editContent}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onCancel(sectionId)}
              className="text-foreground hover:bg-accent rounded-lg px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className="bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        // View Mode
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-foreground text-sm font-semibold">{title}</h3>
            {viewContent}
          </div>

          <button
            type="button"
            onClick={() => onEdit(sectionId)}
            className="text-primary flex items-center gap-1 text-sm font-medium hover:underline"
            aria-label={editAriaLabel || `Edit ${title.toLowerCase()}`}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        </div>
      )}
    </div>
  )
}
