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
import {
  RiEditLine,
  RiAlertLine,
  RiSave3Line,
} from "react-icons/ri";

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

export const EditExchangeModal = React.memo<EditExchangeModalProps>(({
  open,
  onOpenChange,
  exchange,
  formData,
  onFormDataChange,
  onSave,
  isPending,
}) => {
  if (!exchange) return null;

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFormDataChange({ ...formData, title: e.target.value });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onFormDataChange({ ...formData, description: e.target.value });
  };

  const handleSave = () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Title and description cannot be empty');
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
          <div className="flex items-start gap-3 bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
            <RiAlertLine className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-[--intel-silver]">
              <p className="font-medium text-orange-400 mb-1">Limited Editing</p>
              <p>You can only modify the title and description. Other program details cannot be changed once the exchange is created.</p>
            </div>
          </div>

          {/* Edit Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Exchange Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={handleTitleChange}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-foreground placeholder-[--intel-silver] focus:outline-none focus:ring-2 focus:ring-[--intel-gold]/50"
                placeholder="Enter exchange title"
                maxLength={100}
              />
              <p className="text-xs text-[--intel-silver] mt-1">{formData.title.length}/100 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={handleDescriptionChange}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-foreground placeholder-[--intel-silver] focus:outline-none focus:ring-2 focus:ring-[--intel-gold]/50 min-h-[120px] resize-none"
                placeholder="Enter exchange description"
                maxLength={500}
              />
              <p className="text-xs text-[--intel-silver] mt-1">{formData.description.length}/500 characters</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => onOpenChange(false)}
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-[--intel-silver] rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-[--intel-gold]/20 border-t-[--intel-gold] rounded-full animate-spin" />
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
});

EditExchangeModal.displayName = 'EditExchangeModal';
