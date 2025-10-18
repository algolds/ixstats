"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Sparkles, Info } from 'lucide-react';
import { EconomicArchetypeDisplay } from './EconomicArchetypeDisplay';
import type { EconomyBuilderState } from '~/types/economy-builder';

interface EconomicArchetypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentState?: EconomyBuilderState;
  onArchetypeApplied?: (newState: EconomyBuilderState) => void;
}

export function EconomicArchetypeModal({
  open,
  onOpenChange,
  currentState,
  onArchetypeApplied,
}: EconomicArchetypeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] flex flex-col p-0 gap-0 economic-archetype-modal-v2">
        {/* Header */}
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b bg-gradient-to-br from-blue-50/60 via-purple-50/40 to-indigo-50/60 dark:from-blue-950/40 dark:via-purple-950/30 dark:to-indigo-950/40">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="shrink-0 p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="space-y-1 min-w-0">
                <DialogTitle className="text-2xl font-bold tracking-tight">
                  Economic Presets
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                  Quick-start templates based on successful real-world economies
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-4">
            <EconomicArchetypeDisplay
              currentState={currentState}
              onArchetypeApplied={(newState) => {
                onArchetypeApplied?.(newState);
                onOpenChange(false);
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t bg-muted/30 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground leading-relaxed flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0" />
              <span>Select an archetype to auto-populate components, then customize to fit your nation</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="shrink-0"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
