"use client";

import { EditPencil, FloppyDisk, WarningTriangle } from "iconoir-react";

import React from "react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
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
            <DialogTitle className="flex items-center gap-2">
              <EditPencil className="text-label-secondary h-5 w-5" />
              Edit cultural exchange
            </DialogTitle>
            <DialogDescription>
              Update the title and description of your cultural exchange program
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <Alert>
              <WarningTriangle className="text-yellow" />
              <AlertTitle>Limited editing</AlertTitle>
              <AlertDescription>
                You can only modify the title and description. Other program details cannot be
                changed once the exchange is created.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-exchange-title">Exchange title</Label>
                <Input
                  id="edit-exchange-title"
                  type="text"
                  value={formData.title}
                  onChange={handleTitleChange}
                  placeholder="Enter exchange title"
                  maxLength={100}
                />
                <p className="text-label-secondary text-footnote tabular-nums">
                  {formData.title.length}/100 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-exchange-description">Description</Label>
                <Textarea
                  id="edit-exchange-description"
                  value={formData.description}
                  onChange={handleDescriptionChange}
                  className="min-h-[120px] resize-none"
                  placeholder="Enter exchange description"
                  maxLength={500}
                />
                <p className="text-label-secondary text-footnote tabular-nums">
                  {formData.description.length}/500 characters
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={isPending}>
                <FloppyDisk className="h-4 w-4" />
                {isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

EditExchangeModal.displayName = "EditExchangeModal";
