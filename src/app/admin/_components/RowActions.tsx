import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { EditPencil as Pencil, Trash as Trash2, Copy } from "iconoir-react";

interface RowActionsProps {
  /** Panel-specific actions rendered before the standard ones. */
  before?: ReactNode;
  onClone?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** Clone / edit / delete icon buttons shared by the admin CMS tables. */
export function RowActions({ before, onClone, onEdit, onDelete }: RowActionsProps) {
  return (
    <div className="inline-flex items-center gap-1">
      {before}
      {onClone && (
        <Button variant="ghost" size="icon-sm" aria-label="Clone" onClick={onClone} title="Clone">
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={onEdit} title="Edit">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete"
        onClick={onDelete}
        className="text-destructive"
        title="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
