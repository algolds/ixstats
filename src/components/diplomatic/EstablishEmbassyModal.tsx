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
import { RiBuilding2Line, RiMapPinLine, RiUserLine, RiCloseLine, RiLoader4Line } from "react-icons/ri";
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
  onSuccess
}: EstablishEmbassyModalProps) {
  const [step, setStep] = useState(1);
  const [hostCountryId, setHostCountryId] = useState<string>("");
  const [hostCountryName, setHostCountryName] = useState<string>("");
  const [embassyName, setEmbassyName] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [ambassadorName, setAmbassadorName] = useState<string>("");
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);

  // Calculate establishment cost
  const { data: costData, isLoading: costLoading } = api.diplomatic.calculateEstablishmentCost.useQuery(
    {
      hostCountryId,
      guestCountryId
    },
    {
      enabled: !!hostCountryId && step === 2
    }
  );

  // Establish embassy mutation
  const establishMutation = api.diplomatic.establishEmbassy.useMutation({
    onSuccess: (data) => {
      toast.success('Embassy established successfully!', {
        description: `${embassyName} is now operational in ${data.hostCountryName}`
      });
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Failed to establish embassy: ${error.message}`);
    }
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
      toast.error('Please select a host country');
      return;
    }
    if (step === 2 && !embassyName.trim()) {
      toast.error('Please enter an embassy name');
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = () => {
    if (!embassyName.trim()) {
      toast.error('Embassy name is required');
      return;
    }

    establishMutation.mutate({
      hostCountryId,
      guestCountryId,
      name: embassyName,
      location: location || undefined,
      ambassadorName: ambassadorName || undefined
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[--intel-gold]">
            <RiBuilding2Line className="h-5 w-5" />
            Establish New Embassy
          </DialogTitle>
          <DialogDescription>
            Step {step} of 3: {step === 1 ? 'Select Host Country' : step === 2 ? 'Embassy Details' : 'Review & Confirm'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-[--intel-gold]' : 'bg-white/10'
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
                <label className="block text-sm font-medium text-foreground mb-2">
                  Select Host Country
                </label>
                <p className="text-sm text-[--intel-silver] mb-4">
                  Choose the country where you want to establish your embassy.
                </p>
                <CountrySelector
                  onSelect={handleCountrySelect}
                  excludeCountryId={guestCountryId}
                  placeholder="Search for a country..."
                />
                {hostCountryId && (
                  <div className="mt-4 p-3 bg-[--intel-gold]/10 border border-[--intel-gold]/30 rounded-lg">
                    <p className="text-sm text-foreground">
                      Selected: <span className="font-semibold text-[--intel-gold]">{hostCountryName}</span>
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
                <label className="block text-sm font-medium text-foreground mb-2">
                  Embassy Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <RiBuilding2Line className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--intel-silver]" />
                  <input
                    type="text"
                    value={embassyName}
                    onChange={(e) => setEmbassyName(e.target.value)}
                    placeholder="e.g., Embassy of [Your Country] in [Host Country]"
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-foreground placeholder:text-[--intel-silver] focus:outline-none focus:border-[--intel-gold]/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Location (Optional)
                </label>
                <div className="relative">
                  <RiMapPinLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--intel-silver]" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Capital City, Downtown District"
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-foreground placeholder:text-[--intel-silver] focus:outline-none focus:border-[--intel-gold]/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Ambassador Name (Optional)
                </label>
                <div className="relative">
                  <RiUserLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--intel-silver]" />
                  <input
                    type="text"
                    value={ambassadorName}
                    onChange={(e) => setAmbassadorName(e.target.value)}
                    placeholder="e.g., Ambassador John Smith"
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-foreground placeholder:text-[--intel-silver] focus:outline-none focus:border-[--intel-gold]/50"
                  />
                </div>
              </div>

              {/* Cost Preview */}
              {costLoading ? (
                <div className="flex items-center justify-center py-4">
                  <RiLoader4Line className="h-6 w-6 text-[--intel-gold] animate-spin" />
                </div>
              ) : costData ? (
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Establishment Cost</span>
                    <button
                      onClick={() => setShowCostBreakdown(!showCostBreakdown)}
                      className="text-xs text-[--intel-gold] hover:underline"
                    >
                      {showCostBreakdown ? 'Hide' : 'Show'} breakdown
                    </button>
                  </div>
                  <div className="text-2xl font-bold text-[--intel-gold]">
                    ${costData.totalCost.toLocaleString()}
                  </div>
                  {showCostBreakdown && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-1 text-sm text-[--intel-silver]">
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
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-foreground">Embassy Details</h4>
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
                <div className="bg-[--intel-gold]/10 border border-[--intel-gold]/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Total Cost</span>
                    <span className="text-xl font-bold text-[--intel-gold]">
                      ${costData.totalCost.toLocaleString()}
                    </span>
                  </div>
                  {costData.requirements && (
                    <div className="mt-3 pt-3 border-t border-[--intel-gold]/20 space-y-1 text-xs text-[--intel-silver]">
                      <p className="font-medium text-foreground mb-1">Requirements:</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>Minimum relationship: {costData.requirements.minimumRelationship}</li>
                        {costData.requirements.requiredDocuments.map((doc: string, idx: number) => (
                          <li key={idx}>{doc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-400">
                  ℹ️ Both countries will be notified of the embassy establishment. The host country can view your embassy details.
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
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
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>

          <Button
            onClick={step === 3 ? handleSubmit : handleNext}
            disabled={
              establishMutation.isPending ||
              (step === 1 && !hostCountryId) ||
              (step === 2 && !embassyName.trim())
            }
            className="bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold]"
          >
            {establishMutation.isPending ? (
              <>
                <RiLoader4Line className="h-4 w-4 animate-spin mr-2" />
                Establishing...
              </>
            ) : step === 3 ? (
              'Establish Embassy'
            ) : (
              'Next'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
