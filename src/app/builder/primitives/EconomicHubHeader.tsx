"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Flag } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useCountryFlagRouteAware } from "~/hooks/useCountryFlagRouteAware";
import type { RealCountryData, EconomicInputs } from "../lib/economy-data-service";

// Get the original foundation country name for flag display
function getFoundationCountryName(referenceCountry: RealCountryData): string {
  if (referenceCountry.foundationCountryName) {
    return referenceCountry.foundationCountryName;
  }

  const name = referenceCountry.name;
  if (name.startsWith("New ")) {
    return name.substring(4);
  }

  return name;
}

interface EconomicHubHeaderProps {
  inputs: EconomicInputs;
  referenceCountry: RealCountryData;
  onBack: () => void;
}

export function EconomicHubHeader({ inputs, referenceCountry, onBack }: EconomicHubHeaderProps) {
  const foundationCountryName = getFoundationCountryName(referenceCountry);
  const { flag } = useCountryFlagRouteAware(foundationCountryName);
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-50 mb-8 flex items-center justify-between overflow-hidden rounded-lg border border-slate-200/30 bg-white/95 p-4 shadow-lg backdrop-blur-sm dark:border-slate-700/30 dark:bg-slate-900/95"
    >
      {/* Flag Background - Full and Prominent */}
      {flag?.flagUrl && (
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${flag.flagUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            opacity: 0.6,
          }}
        />
      )}

      {/* Overlay for readability */}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-white/90 via-white/70 to-white/90 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-slate-900/90" />

      <div className="relative z-20 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={onBack}
              variant="outline"
              size="default"
              className="border-slate-300/50 bg-white/30 text-slate-800 shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-white/50 hover:shadow-xl dark:border-slate-600/50 dark:bg-slate-800/70 dark:text-white dark:hover:bg-slate-700/80"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 drop-shadow-sm dark:text-white">
                Building: {inputs.countryName}
                {flag?.flagUrl && <Flag className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
              </h3>
              <p className="text-sm text-slate-700 drop-shadow-sm dark:text-slate-200">
                Foundation Country: {getFoundationCountryName(referenceCountry)}{" "}
                {referenceCountry.countryCode ? `(${referenceCountry.countryCode})` : ""}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-2 text-slate-700 drop-shadow-sm dark:text-slate-300">
          Customize your economic parameters below
        </p>
      </div>
    </motion.div>
  );
}
