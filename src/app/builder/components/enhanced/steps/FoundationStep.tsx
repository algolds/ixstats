// Foundation Step - Country selection for Atomic Builder
// Extracted from AtomicBuilderPageEnhanced.tsx for modularity

"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { CountrySelectorEnhanced } from '../CountrySelectorEnhanced';
import type { RealCountryData } from '~/app/builder/lib/economy-data-service';

interface FoundationStepProps {
  countries: RealCountryData[];
  isLoadingCountries: boolean;
  countryLoadError: string | null;
  onCountrySelect: (country: RealCountryData) => void;
  onCreateFromScratch: () => void;
  onBackToIntro?: () => void;
}

export function FoundationStep({
  countries,
  isLoadingCountries,
  countryLoadError,
  onCountrySelect,
  onCreateFromScratch,
  onBackToIntro
}: FoundationStepProps) {
  if (isLoadingCountries) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto"
          >
            <Globe className="h-16 w-16 text-amber-500" />
          </motion.div>
          <div className="space-y-2">
            <p className="text-lg font-medium">Loading nations data...</p>
            <p className="text-sm text-muted-foreground">Preparing your foundation options</p>
          </div>
        </div>
      </div>
    );
  }

  if (countryLoadError) {
    return (
      <Alert className="border-red-200 bg-red-50/50">
        <AlertDescription>
          <strong>Error loading countries:</strong> {countryLoadError}
          <br />
          Please refresh the page to try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <CountrySelectorEnhanced
      countries={countries}
      onCountrySelect={onCountrySelect}
      onCardHoverChange={() => {}}
      onBackToIntro={onBackToIntro}
      onCreateFromScratch={onCreateFromScratch}
    />
  );
}
