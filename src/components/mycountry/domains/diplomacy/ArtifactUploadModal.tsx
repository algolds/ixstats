"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { ArtifactUploadForm } from "./ArtifactUploadForm";

interface CulturalExchange {
  id: string;
  title: string;
}

interface ArtifactUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedExchange: CulturalExchange | null;
  onSubmit: (data: {
    title: string;
    type: "photo" | "video" | "document" | "artwork" | "recipe" | "music";
    description: string;
    file: File;
    thumbnailUrl?: string;
  }) => void;
}

export const ArtifactUploadModal = React.memo<ArtifactUploadModalProps>(
  ({ open, onOpenChange, selectedExchange, onSubmit }) => {
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
          />
        </DialogContent>
      </Dialog>
    );
  }
);

ArtifactUploadModal.displayName = "ArtifactUploadModal";
