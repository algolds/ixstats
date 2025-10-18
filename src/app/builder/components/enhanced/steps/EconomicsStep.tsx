// Economics Step - Economic configuration for Atomic Builder
// Extracted from AtomicBuilderPageEnhanced.tsx for modularity

"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Calculator, HelpCircle } from 'lucide-react';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import { stepConfig } from '../builderConfig';
import { EconomyBuilderPage } from '../EconomyBuilderPage';
import type { EconomicInputs, RealCountryData } from '~/app/builder/lib/economy-data-service';
import type { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import type { TaxBuilderState } from '~/components/tax-system/TaxBuilder';

interface EconomicsStepProps {
  economicInputs: EconomicInputs | null;
  selectedCountry: RealCountryData | null;
  governmentComponents: ComponentType[];
  governmentStructure: any;
  taxSystemData: TaxBuilderState | null;
  onEconomicInputsChange: (inputs: EconomicInputs) => void;
}

// Help tooltip component
function HelpTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function EconomicsStep({
  economicInputs,
  selectedCountry,
  governmentComponents,
  governmentStructure,
  taxSystemData,
  onEconomicInputsChange
}: EconomicsStepProps) {
  if (!economicInputs) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading economic data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-lg mb-4">
          <TrendingUp className="h-8 w-8 text-white" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-3xl font-bold">Economy Builder</h2>
          <HelpTooltip text={stepConfig.economics.help} />
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Configure your economic system using atomic components, sectors, labor markets, and demographics
          {selectedCountry ? ` for ${selectedCountry.name}` : ''}
        </p>
      </motion.div>

      <Alert className="border-amber-200/50 bg-amber-50/30 backdrop-blur-sm">
        <Calculator className="h-4 w-4" />
        <AlertDescription>
          <strong>Economy Builder:</strong> Use atomic components to configure your economic system. All values are interconnected and will automatically adjust based on your selections.
          Government components from the previous step influence these parameters.
        </AlertDescription>
      </Alert>

      {/* Unified Economy Builder */}
      <EconomyBuilderPage
        economicInputs={economicInputs}
        onEconomicInputsChange={onEconomicInputsChange}
        governmentComponents={governmentComponents}
        governmentBuilderData={governmentStructure}
        taxSystemData={taxSystemData}
        countryId={selectedCountry?.countryCode}
      />
    </div>
  );
}
