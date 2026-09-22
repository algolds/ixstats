"use client";

import { EditPencil, FloppyDisk, WarningTriangle } from "iconoir-react";

import React from "react";
import { useNotify } from "~/hooks/useNotify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";

interface CulturalExchange {
  id: string;
  title: string;
  description: string;
}

interface EditFormData {
  title: string;
  description: string;
}

interface EditExchangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exchange: CulturalExchange | null;
  formData: EditFormData;
  onFormDataChange: (data: EditFormData) => void;
  onSave: () => void;
  isPending: boolean;
}

export const EditExchangeModal = React.memo<EditExchangeModalProps>(
  ({ open, onOpenChange, exchange, formData, onFormDataChange, onSave, isPending }) => {
    const notify = useNotify();
    if (!exchange) return null;

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onFormDataChange({ ...formData, title: e.target.value });
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onFormDataChange({ ...formData, description: e.target.value });
    };

    const handleSave = () => {
      if (!formData.title.trim() || !formData.description.trim()) {
        notify.error("Title and description cannot be empty");
        return;
      }
      onSave();
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <EditPencil className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
              Edit Cultural Exchange
            </DialogTitle>
            <DialogDescription>
              Update the title and description of your cultural exchange program
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Warning Message */}
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <WarningTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400" />
              <div className="text-sm text-muted-foreground">
                <p className="mb-1 font-medium text-amber-600 dark:text-amber-400">Limited Editing</p>
                <p>
                  You can only modify the title and description. Other program details cannot be
                  changed once the exchange is created.
                </p>
              </div>
            </div>

            {/* Edit Form */}
            <div className="space-y-4">
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Exchange Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={handleTitleChange}
                  className="text-foreground w-full rounded-lg border border-border bg-card/40 px-4 py-3 placeholder:text-muted-foreground focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                  placeholder="Enter exchange title"
                  maxLength={100}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {formData.title.length}/100 characters
                </p>
              </div>

              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={handleDescriptionChange}
                  className="text-foreground min-h-[120px] w-full resize-none rounded-lg border border-border bg-card/40 px-4 py-3 placeholder:text-muted-foreground focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                  placeholder="Enter exchange description"
                  maxLength={500}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {formData.description.length}/500 characters
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => onOpenChange(false)}
                className="flex-1 rounded-lg bg-muted/50 px-4 py-3 font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-500/20 px-4 py-3 font-medium text-cyan-600 dark:text-cyan-400 transition-colors hover:bg-cyan-500/30 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-500" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FloppyDisk className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

EditExchangeModal.displayName = "EditExchangeModal";
