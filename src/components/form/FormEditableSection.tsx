import { ReactNode } from 'react';
import { Pencil } from 'lucide-react';

interface FormEditableSectionProps {
  /** Unique section identifier */
  sectionId: string;

  /** Section title */
  title: string;

  /** Currently editing section */
  editingSection: string | null;

  /** Callback when edit button clicked */
  onEdit: (sectionId: string) => void;

  /** Callback when cancel button clicked */
  onCancel: (sectionId: string) => void;

  /** Callback when save button clicked */
  onSave: () => void;

  /** Content to display in view mode */
  viewContent: ReactNode;

  /** Content to display in edit mode (form fields) */
  editContent: ReactNode;

  /** Custom aria label for edit button */
  editAriaLabel?: string;
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
  const isEditing = editingSection === sectionId;

  return (
    <div className="rounded-xl border border-border/40 bg-white p-6 shadow-sm">
      {isEditing ? (
        // Edit Mode
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>

          {editContent}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onCancel(sectionId)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-primary text-white hover:bg-primary/90"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        // View Mode
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {viewContent}
          </div>

          <button
            type="button"
            onClick={() => onEdit(sectionId)}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            aria-label={editAriaLabel || `Edit ${title.toLowerCase()}`}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
