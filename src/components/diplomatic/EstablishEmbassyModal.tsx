"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import {
  RiBuilding2Line,
  RiMapPinLine,
  RiUserLine,
  RiCloseLine,
  RiLoader4Line,
} from "react-icons/ri";
import { CountrySelector } from "./CountrySelector";

interface EstablishEmbassyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestCountryId: string;
  guestCountryName: string;
  onSuccess?: () => void;
}

export function EstablishEmbassyModal({
  open,
  onOpenChange,
  guestCountryId,
  guestCountryName,
  onSuccess,
}: EstablishEmbassyModalProps) {
  const [step, setStep] = useState(1);
  const [hostCountryId, setHostCountryId] = useState<string>("");
  const [hostCountryName, setHostCountryName] = useState<string>("");
  const [embassyName, setEmbassyName] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [ambassadorName, setAmbassadorName] = useState<string>("");
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);

  // Calculate establishment cost
  const { data: costData, isLoading: costLoading } =
    api.diplomatic.calculateEstablishmentCost.useQuery(
      {
        hostCountryId,
        guestCountryId,
      },
      {
        enabled: !!hostCountryId && step === 2,
      }
    );

  // Establish embassy mutation
  const establishMutation = api.diplomatic.establishEmbassy.useMutation({
    onSuccess: (data) => {
      toast.success("Embassy established successfully!", {
        description: `${embassyName} is now operational in ${data.hostCountryName}`,
      });
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Failed to establish embassy: ${error.message}`);
    },
  });

  const resetForm = () => {
    setStep(1);
    setHostCountryId("");
    setHostCountryName("");
    setEmbassyName("");
    setLocation("");
    setAmbassadorName("");
    setShowCostBreakdown(false);
  };

  const handleCountrySelect = (countryId: string, countryName: string) => {
    setHostCountryId(countryId);
    setHostCountryName(countryName);
    setEmbassyName(`${guestCountryName} Embassy to ${countryName}`);
  };

  const handleNext = () => {
    if (step === 1 && !hostCountryId) {
      toast.error("Please select a host country");
      return;
    }
    if (step === 2 && !embassyName.trim()) {
      toast.error("Please enter an embassy name");
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = () => {
    if (!embassyName.trim()) {
      toast.error("Embassy name is required");
      return;
    }

    establishMutation.mutate({
      hostCountryId,
      guestCountryId,
      name: embassyName,
      location: location || undefined,
      ambassadorName: ambassadorName || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[--intel-gold]">
            <RiBuilding2Line className="h-5 w-5" />
            Establish New Embassy
          </DialogTitle>
          <DialogDescription>
            Step {step} of 3:{" "}
            {step === 1
              ? "Select Host Country"
              : step === 2
                ? "Embassy Details"
                : "Review & Confirm"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-[--intel-gold]" : "bg-white/10"
              }`}
            />
          ))}
        </div>

        <div className="space-y-6">
          {/* Step 1: Select Host Country */}
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Select Host Country
                </label>
                <p className="mb-4 text-sm text-[--intel-silver]">
                  Choose the country where you want to establish your embassy.
                </p>
                <CountrySelector
                  onSelect={handleCountrySelect}
                  excludeCountryId={guestCountryId}
                  placeholder="Search for a country..."
                />
                {hostCountryId && (
                  <div className="mt-4 rounded-lg border border-[--intel-gold]/30 bg-[--intel-gold]/10 p-3">
                    <p className="text-foreground text-sm">
                      Selected:{" "}
                      <span className="font-semibold text-[--intel-gold]">{hostCountryName}</span>
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 2: Embassy Details */}
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Embassy Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <RiBuilding2Line className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[--intel-silver]" />
                  <input
                    type="text"
                    value={embassyName}
                    onChange={(e) => setEmbassyName(e.target.value)}
                    placeholder="e.g., Embassy of [Your Country] in [Host Country]"
                    className="text-foreground w-full rounded-lg border border-white/20 bg-white/10 py-3 pr-4 pl-10 placeholder:text-[--intel-silver] focus:border-[--intel-gold]/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Location (Optional)
                </label>
                <div className="relative">
                  <RiMapPinLine className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[--intel-silver]" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Capital City, Downtown District"
                    className="text-foreground w-full rounded-lg border border-white/20 bg-white/10 py-3 pr-4 pl-10 placeholder:text-[--intel-silver] focus:border-[--intel-gold]/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Ambassador Name (Optional)
                </label>
                <div className="relative">
                  <RiUserLine className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[--intel-silver]" />
                  <input
                    type="text"
                    value={ambassadorName}
                    onChange={(e) => setAmbassadorName(e.target.value)}
                    placeholder="e.g., Ambassador John Smith"
                    className="text-foreground w-full rounded-lg border border-white/20 bg-white/10 py-3 pr-4 pl-10 placeholder:text-[--intel-silver] focus:border-[--intel-gold]/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* Cost Preview */}
              {costLoading ? (
                <div className="flex items-center justify-center py-4">
                  <RiLoader4Line className="h-6 w-6 animate-spin text-[--intel-gold]" />
                </div>
              ) : costData ? (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-foreground text-sm font-medium">Establishment Cost</span>
                    <button
                      onClick={() => setShowCostBreakdown(!showCostBreakdown)}
                      className="text-xs text-[--intel-gold] hover:underline"
                    >
                      {showCostBreakdown ? "Hide" : "Show"} breakdown
                    </button>
                  </div>
                  <div className="text-2xl font-bold text-[--intel-gold]">
                    ${costData.totalCost.toLocaleString()}
                  </div>
                  {showCostBreakdown && (
                    <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-sm text-[--intel-silver]">
                      <div className="flex justify-between">
                        <span>Base cost:</span>
                        <span>${costData.baseCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Distance modifier:</span>
                        <span>×{costData.distanceMultiplier.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Relationship modifier:</span>
                        <span>×{costData.relationshipMultiplier.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </motion.div>
          )}

          {/* Step 3: Review & Confirm */}
          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
                <h4 className="text-foreground font-semibold">Embassy Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[--intel-silver]">Host Country:</span>
                    <span className="text-foreground font-medium">{hostCountryName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[--intel-silver]">Embassy Name:</span>
                    <span className="text-foreground font-medium">{embassyName}</span>
                  </div>
                  {location && (
                    <div className="flex justify-between">
                      <span className="text-[--intel-silver]">Location:</span>
                      <span className="text-foreground font-medium">{location}</span>
                    </div>
                  )}
                  {ambassadorName && (
                    <div className="flex justify-between">
                      <span className="text-[--intel-silver]">Ambassador:</span>
                      <span className="text-foreground font-medium">{ambassadorName}</span>
                    </div>
                  )}
                </div>
              </div>

              {costData && (
                <div className="rounded-lg border border-[--intel-gold]/30 bg-[--intel-gold]/10 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-sm font-medium">Total Cost</span>
                    <span className="text-xl font-bold text-[--intel-gold]">
                      ${costData.totalCost.toLocaleString()}
                    </span>
                  </div>
                  {costData.requirements && (
                    <div className="mt-3 space-y-1 border-t border-[--intel-gold]/20 pt-3 text-xs text-[--intel-silver]">
                      <p className="text-foreground mb-1 font-medium">Requirements:</p>
                      <ul className="list-inside list-disc space-y-1">
                        <li>Minimum relationship: {costData.requirements.minimumRelationship}</li>
                        {costData.requirements.requiredDocuments.map((doc: string, idx: number) => (
                          <li key={idx}>{doc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                <p className="text-xs text-blue-400">
                  ℹ️ Both countries will be notified of the embassy establishment. The host country
                  can view your embassy details.
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <Button
            variant="ghost"
            onClick={() => {
              if (step === 1) {
                onOpenChange(false);
                resetForm();
              } else {
                handleBack();
              }
            }}
            disabled={establishMutation.isPending}
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>

          <Button
            onClick={step === 3 ? handleSubmit : handleNext}
            disabled={
              establishMutation.isPending ||
              (step === 1 && !hostCountryId) ||
              (step === 2 && !embassyName.trim())
            }
            className="bg-[--intel-gold]/20 text-[--intel-gold] hover:bg-[--intel-gold]/30"
          >
            {establishMutation.isPending ? (
              <>
                <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
                Establishing...
              </>
            ) : step === 3 ? (
              "Establish Embassy"
            ) : (
              "Next"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
