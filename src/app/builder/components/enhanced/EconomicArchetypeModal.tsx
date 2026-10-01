"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Sparks as Sparkles,
  InfoCircle as Info,
  WarningTriangle as AlertTriangle,
} from "iconoir-react";
import { EconomicArchetypeDisplay } from "./EconomicArchetypeDisplay";
import type { EconomyBuilderState } from "~/types/economy-builder";
import { useArchetypes } from "~/hooks/useArchetypes";
import { api } from "~/trpc/react";
import type { EconomicArchetype } from "~/lib/economy/archetypes/types";

interface EconomicArchetypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentState?: EconomyBuilderState;
  onArchetypeApplied?: (
    newState: EconomyBuilderState,
    archetypeId?: string,
    archetype?: EconomicArchetype
  ) => void;
}

export function EconomicArchetypeModal({
  open,
  onOpenChange,
  currentState,
  onArchetypeApplied,
}: EconomicArchetypeModalProps) {
  // Fetch archetypes from database with fallback
  const { isUsingFallback, isLoading } = useArchetypes("all");

  // Track archetype usage
  const incrementUsage = api.economicArchetypes.incrementArchetypeUsage.useMutation();

  const handleArchetypeApplied = (
    newState: EconomyBuilderState,
    archetypeId?: string,
    archetype?: EconomicArchetype
  ) => {
    // Track usage if archetype has database ID
    if (archetypeId) {
      incrementUsage.mutate({ archetypeId });
    }

    // Apply archetype and close modal
    onArchetypeApplied?.(newState, archetypeId, archetype);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="economic-archetype-modal-v2 border-separator bg-background text-label shadow-floating flex h-[90vh] max-h-[90vh] w-full max-w-7xl flex-col gap-0 border p-0">
        {/* Header */}
        <DialogHeader className="border-separator bg-surface shrink-0 border-b px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="bg-fill-3 border-separator rounded-row shrink-0 border p-3">
                <Sparkles className="text-green h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="text-label text-title-1">Economic Presets</DialogTitle>
                <DialogDescription className="text-label-secondary text-body leading-relaxed">
                  Quick-start templates based on successful real-world economies
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Fallback Warning */}
        {isUsingFallback && !isLoading && (
          <div className="px-6 pt-4">
            <Alert variant="default" className="border-caution/30 bg-caution/10">
              <AlertTriangle className="text-caution h-4 w-4" />
              <AlertDescription className="text-footnote text-caution">
                Couldn&apos;t load the archetype catalog, so these are the built-in archetypes.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Content Area - Scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-6">
            <EconomicArchetypeDisplay
              currentState={currentState}
              onArchetypeApplied={handleArchetypeApplied}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-separator bg-surface shrink-0 border-t px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-label-secondary text-body flex items-center gap-2 leading-relaxed">
              <Info className="text-green h-4 w-4 shrink-0" />
              <span>
                Select an archetype to auto-populate components, then customize to fit your nation
              </span>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="border-separator hover:bg-fill-3 hover:text-label shrink-0"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
