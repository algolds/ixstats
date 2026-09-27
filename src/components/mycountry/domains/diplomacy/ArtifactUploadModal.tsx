"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { ArtifactUploadForm, type ArtifactUploadData } from "./ArtifactUploadForm";

interface CulturalExchange {
  id: string;
  title: string;
}

interface ArtifactUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedExchange: CulturalExchange | null;
  onSubmit: (data: ArtifactUploadData) => void;
  isSubmitting: boolean;
}

export const ArtifactUploadModal = React.memo<ArtifactUploadModalProps>(
  ({ open, onOpenChange, selectedExchange, onSubmit, isSubmitting }) => {
    if (!selectedExchange) return null;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Upload Cultural Artifact</DialogTitle>
          </DialogHeader>
          <ArtifactUploadForm
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            exchangeTitle={selectedExchange.title}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    );
  }
);

ArtifactUploadModal.displayName = "ArtifactUploadModal";
