"use client";

import { useState, Fragment } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

interface GovernmentSynergyDialogProps {
  isOpen: boolean;
  components: any[];
  onClose: () => void;
  onCreateSynergy: (data: any) => void;
}

export function GovernmentSynergyDialog({
  isOpen,
  components,
  onClose,
  onCreateSynergy,
}: GovernmentSynergyDialogProps) {
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const [selectedSecondary, setSelectedSecondary] = useState<string | null>(null);

  const getSynergyType = (primary: any, secondary: any) => {
    if (primary.synergies?.includes(secondary.type)) return "strong";
    if (secondary.synergies?.includes(primary.type)) return "moderate";
    if (primary.conflicts?.includes(secondary.type) || secondary.conflicts?.includes(primary.type))
      return "conflict";
    return "none";
  };

  const getSynergyColor = (type: string) => {
    switch (type) {
      case "strong":
        return "bg-green-500/30 hover:bg-green-500/50";
      case "moderate":
        return "bg-yellow-500/30 hover:bg-yellow-500/50";
      case "conflict":
        return "bg-red-500/30 hover:bg-red-500/50";
      default:
        return "bg-white/5 hover:bg-white/10";
    }
  };

  const getSynergyIcon = (type: string) => {
    switch (type) {
      case "strong":
        return "++";
      case "moderate":
        return "+";
      case "conflict":
        return "×";
      default:
        return "";
    }
  };

  const getSynergyLabel = (type: string) => {
    switch (type) {
      case "strong":
        return "Strong synergy";
      case "moderate":
        return "Moderate synergy";
      case "conflict":
        return "Conflict";
      default:
        return "No relationship";
    }
  };

  // Limit display to first 20 components for performance
  const displayComponents = components.slice(0, 20);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!flex !h-[95vh] !w-[95vw] !max-w-[95vw] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Synergy Matrix</DialogTitle>
          <DialogDescription>
            Visualize and manage synergy relationships between government components
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `auto repeat(${displayComponents.length}, minmax(2.5rem, 1fr))`,
            }}
          >
            {/* Header Row */}
            <div className="bg-background sticky top-0 left-0 z-20 min-h-[5rem]" />
            {displayComponents.map((comp) => (
              <div
                key={comp.id}
                title={comp.name}
                className="bg-background sticky top-0 z-10 flex min-h-[5rem] items-end border border-white/10 p-1 text-center text-xs font-medium"
              >
                <div className="w-full origin-bottom-left -rotate-45 transform truncate pb-1 text-left whitespace-nowrap">
                  {comp.name.substring(0, 15)}
                </div>
              </div>
            ))}

            {/* Matrix Rows */}
            {displayComponents.map((primary) => (
              <Fragment key={primary.id}>
                <div
                  title={primary.name}
                  className="bg-background sticky left-0 z-10 border border-white/10 p-2 text-xs font-medium"
                >
                  {primary.name}
                </div>
                {displayComponents.map((secondary) => {
                  const synergyType = getSynergyType(primary, secondary);
                  const isSelected =
                    selectedPrimary === primary.id && selectedSecondary === secondary.id;

                  return (
                    <button
                      key={`${primary.id}-${secondary.id}`}
                      onClick={() => {
                        if (primary.id !== secondary.id) {
                          setSelectedPrimary(primary.id);
                          setSelectedSecondary(secondary.id);
                        }
                      }}
                      disabled={primary.id === secondary.id}
                      className={`flex aspect-square min-h-[2rem] items-center justify-center border border-white/10 text-xs font-bold transition-all ${
                        primary.id === secondary.id
                          ? "cursor-not-allowed bg-white/5 text-white/20"
                          : `${getSynergyColor(synergyType)} cursor-pointer ${
                              isSelected ? "ring-2 ring-[--intel-gold]" : ""
                            }`
                      }`}
                      title={
                        primary.id === secondary.id
                          ? "Same component"
                          : `${primary.name} ↔ ${secondary.name}: ${getSynergyLabel(synergyType)}`
                      }
                    >
                      {primary.id !== secondary.id && getSynergyIcon(synergyType)}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
            <span className="text-sm font-medium">Legend:</span>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-green-500/50" />
              <span className="text-xs">Strong Synergy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-yellow-500/50" />
              <span className="text-xs">Moderate Synergy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-red-500/50" />
              <span className="text-xs">Conflict</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-white/10" />
              <span className="text-xs">No Relationship</span>
            </div>
          </div>

          {selectedPrimary && selectedSecondary && (
            <div className="mt-4 rounded-lg border border-[--intel-gold]/20 bg-[--intel-gold]/10 p-4">
              <p className="mb-2 text-sm font-medium">Selected Relationship:</p>
              <p className="text-xs text-[--intel-silver]">
                {components.find((c) => c.id === selectedPrimary)?.name} ↔{" "}
                {components.find((c) => c.id === selectedSecondary)?.name}
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => {
                  const primary = components.find((c) => c.id === selectedPrimary);
                  const secondary = components.find((c) => c.id === selectedSecondary);
                  onCreateSynergy({
                    component1: primary?.type,
                    component2: secondary?.type,
                    synergyType: "STRONG",
                    bonusPercent: 15,
                  });
                }}
              >
                Edit Relationship
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
