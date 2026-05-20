"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { ImportSection } from "./sections/ImportSection";
import type { BuilderSection } from "../lib/builder-theme";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (section: BuilderSection) => void;
  onImportComplete?: (data: any) => void;
}

export function ImportModal({ open, onClose, onNavigate, onImportComplete }: ImportModalProps) {
  const handleImportComplete = (data: any) => {
    if (onImportComplete) {
      onImportComplete(data);
    }
    onNavigate("identity");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            Import from Wiki
          </DialogTitle>
          <DialogDescription>
            Search and import existing country data from IxWiki, IIWiki, or AltHistory Wiki
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <ImportSection 
            onNavigate={(section) => {
              onNavigate(section);
              onClose();
            }}
            onImportComplete={handleImportComplete}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ImportModal;
