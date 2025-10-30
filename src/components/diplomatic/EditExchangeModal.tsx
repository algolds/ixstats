"use client";

import React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { RiEditLine, RiAlertLine, RiSave3Line } from "react-icons/ri";

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
    if (!exchange) return null;

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onFormDataChange({ ...formData, title: e.target.value });
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onFormDataChange({ ...formData, description: e.target.value });
    };

    const handleSave = () => {
      if (!formData.title.trim() || !formData.description.trim()) {
        toast.error("Title and description cannot be empty");
        return;
      }
      onSave();
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <RiEditLine className="h-6 w-6 text-[--intel-gold]" />
              Edit Cultural Exchange
            </DialogTitle>
            <DialogDescription>
              Update the title and description of your cultural exchange program
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Warning Message */}
            <div className="flex items-start gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 p-4">
              <RiAlertLine className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-400" />
              <div className="text-sm text-[--intel-silver]">
                <p className="mb-1 font-medium text-orange-400">Limited Editing</p>
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
                  className="text-foreground w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 placeholder-[--intel-silver] focus:ring-2 focus:ring-[--intel-gold]/50 focus:outline-none"
                  placeholder="Enter exchange title"
                  maxLength={100}
                />
                <p className="mt-1 text-xs text-[--intel-silver]">
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
                  className="text-foreground min-h-[120px] w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 placeholder-[--intel-silver] focus:ring-2 focus:ring-[--intel-gold]/50 focus:outline-none"
                  placeholder="Enter exchange description"
                  maxLength={500}
                />
                <p className="mt-1 text-xs text-[--intel-silver]">
                  {formData.description.length}/500 characters
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => onOpenChange(false)}
                className="flex-1 rounded-lg bg-white/5 px-4 py-3 font-medium text-[--intel-silver] transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[--intel-gold]/20 px-4 py-3 font-medium text-[--intel-gold] transition-colors hover:bg-[--intel-gold]/30 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[--intel-gold]/20 border-t-[--intel-gold]" />
                    Saving...
                  </>
                ) : (
                  <>
                    <RiSave3Line className="h-4 w-4" />
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
