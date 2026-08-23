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
import { Sparks as Sparkles, InfoCircle as Info, WarningTriangle as AlertTriangle } from "iconoir-react";
import { EconomicArchetypeDisplay } from "./EconomicArchetypeDisplay";
import type { EconomyBuilderState } from "~/types/economy-builder";
import { useArchetypes } from "~/hooks/useArchetypes";
import { api } from "~/trpc/react";
import type { EconomicArchetype } from "~/app/builder/data/archetype-types";

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
  const { isUsingFallback } = useArchetypes("all");

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
      <DialogContent className="economic-archetype-modal-v2 border-border/60 bg-background/95 text-foreground flex h-[90vh] max-h-[90vh] w-full max-w-7xl flex-col gap-0 border p-0 shadow-2xl backdrop-blur-3xl dark:shadow-emerald-950/20">
        {/* Header */}
        <DialogHeader className="border-border/40 shrink-0 border-b bg-white/[0.02] px-6 py-5 dark:bg-black/[0.1]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="bg-muted/40 border-border/50 shrink-0 rounded-xl border p-3">
                <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="text-foreground text-2xl font-bold tracking-tight">
                  Economic Presets
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                  Quick-start templates based on successful real-world economies
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Fallback Warning */}
        {isUsingFallback && (
          <div className="px-6 pt-4">
            <Alert variant="default" className="border-yellow-500/30 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <AlertDescription className="text-xs text-yellow-600 dark:text-yellow-400">
                Using offline archetype data. Admin should seed database with economic archetypes.
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
        <div className="border-border/40 shrink-0 border-t bg-white/[0.02] px-6 py-4 backdrop-blur-md dark:bg-black/[0.1]">
          <div className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground flex items-center gap-2 text-sm leading-relaxed">
              <Info className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                Select an archetype to auto-populate components, then customize to fit your nation
              </span>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="border-border hover:bg-accent hover:text-accent-foreground shrink-0"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
