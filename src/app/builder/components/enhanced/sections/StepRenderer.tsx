"use client";

import React, { memo, useCallback, Suspense } from "react";
import { motion } from "framer-motion";
import {
  Globe,
  Flag,
  BarChart3,
  Info,
  Building2,
  Settings,
  Crown,
  Coins,
  Eye,
  HelpCircle,
  Lock,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Tabs, TabsContent } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { useBuilderContext } from "../context/BuilderStateContext";
import { useBuilderActions } from "../../../hooks/useBuilderActions";

// Help modal component
function HelpModal({ text, title }: { text: string; title: string }) {
  // Core Foundation specific help content
  if (title === "Core Foundation Help") {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <HelpCircle className="text-muted-foreground hover:text-foreground h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-blue-500" />
              Core Foundation Help
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Overview */}
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  What is Core Foundation?
                </h3>
                <p className="text-muted-foreground text-sm">
                  The Core Foundation step establishes your nation's fundamental identity and
                  economic indicators. These values form the baseline for all other calculations and
                  systems.
                </p>
              </div>

              {/* Why Core Matters */}
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  Why Core Foundation Matters
                </h3>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>National Identity:</strong> Name, flag, culture, and values
                  </li>
                  <li>
                    • <strong>Economic Base:</strong> GDP, population, currency, and trade
                  </li>
                  <li>
                    • <strong>System Integration:</strong> Influences all other builder steps
                  </li>
                  <li>
                    • <strong>Realistic Foundation:</strong> Ensures coherent nation building
                  </li>
                </ul>
              </div>
            </div>

            {/* Two Main Tabs */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Settings className="h-4 w-4 text-purple-500" />
                Core Foundation Components
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <h4 className="mb-3 flex items-center gap-2 font-medium text-blue-800">
                    <Flag className="h-4 w-4" />
                    National Identity
                  </h4>
                  <ul className="space-y-2 text-sm text-blue-700">
                    <li>
                      • <strong>Country Name:</strong> Your nation's official name
                    </li>
                    <li>
                      • <strong>Flag & Symbols:</strong> Visual identity and national symbols
                    </li>
                    <li>
                      • <strong>Cultural Values:</strong> Core principles and beliefs
                    </li>
                    <li>
                      • <strong>Geographic Context:</strong> Location and regional characteristics
                    </li>
                  </ul>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <h4 className="mb-3 flex items-center gap-2 font-medium text-green-800">
                    <BarChart3 className="h-4 w-4" />
                    Core Indicators
                  </h4>
                  <ul className="space-y-2 text-sm text-green-700">
                    <li>
                      • <strong>GDP & Economy:</strong> Total economic output and structure
                    </li>
                    <li>
                      • <strong>Population:</strong> Total population and demographics
                    </li>
                    <li>
                      • <strong>Currency:</strong> Monetary system and exchange rates
                    </li>
                    <li>
                      • <strong>Trade Balance:</strong> Import/export relationships
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Step-by-Step Guide */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Eye className="h-4 w-4 text-amber-500" />
                How to Configure Core Foundation
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                      1
                    </div>
                    <div>
                      <h4 className="font-medium">Set National Identity</h4>
                      <p className="text-muted-foreground text-sm">
                        Define your country's name, flag, and cultural characteristics
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                      2
                    </div>
                    <div>
                      <h4 className="font-medium">Configure Core Indicators</h4>
                      <p className="text-muted-foreground text-sm">
                        Set GDP, population, currency, and economic fundamentals
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                      3
                    </div>
                    <div>
                      <h4 className="font-medium">Review Impact</h4>
                      <p className="text-muted-foreground text-sm">
                        See how your choices affect other systems and calculations
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                      4
                    </div>
                    <div>
                      <h4 className="font-medium">Adjust as Needed</h4>
                      <p className="text-muted-foreground text-sm">
                        Fine-tune values to achieve your desired outcomes
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips & Best Practices */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <HelpCircle className="h-4 w-4 text-purple-500" />
                Tips & Best Practices
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <h4 className="flex items-center gap-2 font-medium text-green-800">
                    <CheckCircle className="h-4 w-4" />
                    Identity Tips
                  </h4>
                  <ul className="mt-2 space-y-1 text-sm text-green-700">
                    <li>• Choose a name that reflects your vision</li>
                    <li>• Consider cultural and historical context</li>
                    <li>• Make it memorable and meaningful</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <h4 className="flex items-center gap-2 font-medium text-blue-800">
                    <BarChart3 className="h-4 w-4" />
                    Economic Tips
                  </h4>
                  <ul className="mt-2 space-y-1 text-sm text-blue-700">
                    <li>• Start with realistic baseline values</li>
                    <li>• Consider your development goals</li>
                    <li>• Balance different economic factors</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <h4 className="flex items-center gap-2 font-medium text-amber-800">
                    <Globe className="h-4 w-4" />
                    Integration Tips
                  </h4>
                  <ul className="mt-2 space-y-1 text-sm text-amber-700">
                    <li>• Values affect all other systems</li>
                    <li>• Changes cascade through the builder</li>
                    <li>• Preview impact before finalizing</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                  <h4 className="flex items-center gap-2 font-medium text-purple-800">
                    <Settings className="h-4 w-4" />
                    Advanced Tips
                  </h4>
                  <ul className="mt-2 space-y-1 text-sm text-purple-700">
                    <li>• Use foundation data as reference</li>
                    <li>• Experiment with different values</li>
                    <li>• Save configurations you like</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Default help modal for other steps
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <HelpCircle className="text-muted-foreground hover:text-foreground h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-500" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Overview */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Crown className="h-4 w-4 text-amber-500" />
                Overview
              </h3>
              <p className="text-muted-foreground text-sm">{text}</p>
            </div>

            {/* Key Features */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Settings className="h-4 w-4 text-blue-500" />
                Key Features
              </h3>
              <ul className="text-muted-foreground space-y-2 text-sm">
                <li>
                  • <strong>Real-time Impact:</strong> See effects on your nation instantly
                </li>
                <li>
                  • <strong>System Integration:</strong> All components work together
                </li>
                <li>
                  • <strong>Validation:</strong> Automatic error checking and suggestions
                </li>
                <li>
                  • <strong>Preview:</strong> Test configurations before finalizing
                </li>
              </ul>
            </div>
          </div>

          {/* Tips & Best Practices */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Eye className="h-4 w-4 text-purple-500" />
              Tips & Best Practices
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <h4 className="flex items-center gap-2 font-medium text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  General Tips
                </h4>
                <ul className="mt-2 space-y-1 text-sm text-green-700">
                  <li>• Start with realistic values</li>
                  <li>• Consider your end vision</li>
                  <li>• Use preview to test changes</li>
                </ul>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <h4 className="flex items-center gap-2 font-medium text-blue-800">
                  <Settings className="h-4 w-4" />
                  Configuration Tips
                </h4>
                <ul className="mt-2 space-y-1 text-sm text-blue-700">
                  <li>• Make incremental changes</li>
                  <li>• Monitor system feedback</li>
                  <li>• Save successful configurations</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { FoundationStep } from "../steps/FoundationStep";
import { NationalIdentitySection } from "../NationalIdentitySection";
import { CoreIndicatorsSection } from "../../../sections/CoreIndicatorsSection";
import { AtomicComponentSelector } from "~/components/government/atoms/AtomicGovernmentComponents";
import { GovernmentBuilder } from "~/components/government/GovernmentBuilder";
import { GovernmentSpendingSection } from "../../../sections/GovernmentSpendingSection";
import { GovernmentStructurePreview } from "../GovernmentStructurePreview";
import { EconomyBuilderPage } from "../index"; // Lazy-loaded from index
import { BuilderLoadingFallback } from "../../LoadingFallback";
import { EnhancedTabsList, EnhancedTabsTrigger } from "../BuilderTabs";
import { stepConfig } from "../builderConfig";
import { BuilderPreviewStep } from "./BuilderPreviewStep";
import type { RealCountryData, EconomicInputs } from "../../../lib/economy-data-service";
import type { ComponentType as PrismaComponentType } from "@prisma/client";

interface StepRendererProps {
  countries: RealCountryData[];
  isLoadingCountries: boolean;
  countryLoadError: string | null;
  onBackToIntro?: () => void;
  onGovernmentStructureChange: (structure: any) => void;
  onGovernmentStructureSave: (structure: any) => Promise<void>;
}

/**
 * StepRenderer - Renders step-specific content
 *
 * Handles all step-specific rendering logic including:
 * - Foundation (country selection)
 * - Core (identity + indicators)
 * - Government (components + structure + spending + preview)
 * - Economics (economy builder)
 * - Preview (summary)
 */
export const StepRenderer = memo(function StepRenderer({
  countries,
  isLoadingCountries,
  countryLoadError,
  onBackToIntro,
  onGovernmentStructureChange,
  onGovernmentStructureSave,
}: StepRendererProps) {
  const { builderState, setBuilderState, updateStep, countryId } = useBuilderContext();
  const { handleTabChange } = useBuilderActions({ builderState, setBuilderState });

  const handleFoundationComplete = useCallback(
    (country: RealCountryData) => {
      updateStep("foundation", country);
    },
    [updateStep]
  );

  const handleCreateFromScratch = useCallback(() => {
    const scratchCountry: RealCountryData = {
      name: "Custom Nation",
      countryCode: "custom",
      gdp: 250000000000,
      gdpPerCapita: 25000,
      unemploymentRate: 5,
      population: 10000000,
      foundationCountryName: undefined,
      growthRate: 3,
      continent: "Custom",
      region: "Custom",
      governmentSpending: 55000000000,
    };

    updateStep("foundation", scratchCountry);
  }, [updateStep]);

  // Foundation Step
  if (builderState.step === "foundation") {
    if (isLoadingCountries) {
      return (
        <div className="flex items-center justify-center py-24">
          <div className="space-y-4 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="mx-auto h-16 w-16"
            >
              <Globe className="h-16 w-16 text-amber-500" />
            </motion.div>
            <div className="space-y-2">
              <p className="text-lg font-medium">Loading nations data...</p>
              <p className="text-muted-foreground text-sm">Preparing your foundation options</p>
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
      <FoundationStep
        countries={countries}
        isLoadingCountries={isLoadingCountries}
        countryLoadError={countryLoadError}
        onCountrySelect={handleFoundationComplete}
        onCreateFromScratch={handleCreateFromScratch}
        onBackToIntro={onBackToIntro}
      />
    );
  }

  // Core Step
  if (builderState.step === "core") {
    if (!builderState.economicInputs) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
            <p className="text-muted-foreground">Initializing core foundation...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 text-center"
        >
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-lg">
            <Flag className="h-8 w-8 text-white" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-3xl font-bold">Core Foundation</h2>
            <HelpModal
              title="Core Foundation Help"
              text="Configure your nation's identity and core economic indicators. This step establishes the fundamental characteristics that will influence all other aspects of your country's development."
            />
          </div>
          <p className="text-muted-foreground mx-auto max-w-2xl">
            Configure national identity and economic fundamentals
            {builderState.selectedCountry
              ? ` for ${builderState.selectedCountry.name}`
              : " from scratch"}
          </p>
        </motion.div>

        <Alert className="border-amber-200/50 bg-amber-50/30 backdrop-blur-sm">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Foundation Setup:</strong> Define your nation's identity and core economic
            indicators. These values will automatically adjust other economic parameters throughout
            the builder.
          </AlertDescription>
        </Alert>

        <Tabs
          value={builderState.activeCoreTab}
          onValueChange={(tab) => handleTabChange("core", tab)}
          className="space-y-6"
        >
          <EnhancedTabsList className="grid-cols-2">
            <EnhancedTabsTrigger value="identity" icon={Flag}>
              National Identity
            </EnhancedTabsTrigger>
            <EnhancedTabsTrigger value="indicators" icon={BarChart3}>
              Core Indicators
            </EnhancedTabsTrigger>
          </EnhancedTabsList>

          <TabsContent value="identity" className="mt-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <NationalIdentitySection
                inputs={builderState.economicInputs}
                onInputsChange={(economicInputs: EconomicInputs) => {
                  setBuilderState((prev) => ({ ...prev, economicInputs }));
                }}
                referenceCountry={builderState.selectedCountry}
                countryId={countryId}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="indicators" className="mt-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <CoreIndicatorsSection
                inputs={builderState.economicInputs}
                onInputsChange={(economicInputs: EconomicInputs) => {
                  setBuilderState((prev) => ({ ...prev, economicInputs }));
                }}
                showAdvanced={builderState.showAdvancedMode}
                referenceCountry={builderState.selectedCountry}
              />
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Government Step
  if (builderState.step === "government" && builderState.economicInputs) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 text-center"
        >
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-lg">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-3xl font-bold">MyGovernment</h2>
            <HelpModal
              title="MyGovernment Builder Help"
              text="Design and configure your government structure, departments, and budgets. Use atomic components to build a modern government system with real-time impact analysis. This builder allows you to create a comprehensive government system with multiple departments, budget allocations, and policy configurations."
            />
          </div>
          <p className="text-muted-foreground mx-auto max-w-2xl">
            Design and configure your government structure, departments, and policies
          </p>
        </motion.div>

        <Tabs
          value={builderState.activeGovernmentTab}
          onValueChange={(tab) => handleTabChange("government", tab)}
          className="space-y-6"
        >
          <EnhancedTabsList className="grid-cols-4">
            <EnhancedTabsTrigger
              value="components"
              icon={Settings}
              badge={builderState.governmentComponents.length}
            >
              Atomic Components
            </EnhancedTabsTrigger>
            <EnhancedTabsTrigger value="structure" icon={Crown}>
              Government Builder
            </EnhancedTabsTrigger>
            <EnhancedTabsTrigger value="spending" icon={Coins}>
              Policies
            </EnhancedTabsTrigger>
            <EnhancedTabsTrigger value="preview" icon={Eye}>
              Preview
            </EnhancedTabsTrigger>
          </EnhancedTabsList>

          <TabsContent value="components" className="mt-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Info className="h-4 w-4" />
                    <span>
                      Each component adds unique characteristics to your country and influences some
                      of the calculations
                    </span>
                  </div>
                </div>
                <AtomicComponentSelector
                  initialComponents={builderState.governmentComponents}
                  onChange={(components) => {
                    setBuilderState((prev) => ({
                      ...prev,
                      governmentComponents: components,
                    }));
                  }}
                />
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="structure" className="mt-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <GovernmentBuilder
                initialData={builderState.governmentStructure}
                onChange={onGovernmentStructureChange}
                onSave={onGovernmentStructureSave}
                gdpData={{
                  nominalGDP: builderState.economicInputs?.coreIndicators?.nominalGDP || 0,
                  countryName: builderState.selectedCountry?.name,
                }}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="spending" className="mt-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <GovernmentSpendingSection
                inputs={builderState.economicInputs}
                onInputsChange={(economicInputs: EconomicInputs) => {
                  setBuilderState((prev) => ({ ...prev, economicInputs }));
                }}
                selectedAtomicComponents={builderState.governmentComponents}
                governmentBuilderData={builderState.governmentStructure}
                countryId={builderState.selectedCountry?.countryCode}
                showAdvanced={builderState.showAdvancedMode}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="preview" className="mt-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <GovernmentStructurePreview
                governmentStructure={builderState.governmentStructure}
                governmentComponents={builderState.governmentComponents}
              />
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Economics Step (lazy-loaded)
  if (builderState.step === "economics" && builderState.economicInputs) {
    return (
      <Suspense fallback={<BuilderLoadingFallback />}>
        <EconomyBuilderPage
          economicInputs={builderState.economicInputs}
          onEconomicInputsChange={(inputs: EconomicInputs) => {
            setBuilderState((prev) => ({ ...prev, economicInputs: inputs }));
          }}
          governmentComponents={builderState.governmentComponents}
          governmentBuilderData={builderState.governmentStructure}
          taxSystemData={builderState.taxSystemData}
          countryId={builderState.selectedCountry?.countryCode}
          showAdvanced={builderState.showAdvancedMode}
          persistedEconomyBuilder={builderState.economyBuilderState}
          onPersistEconomyBuilder={(economyBuilderState) => {
            setBuilderState((prev) => ({ ...prev, economyBuilderState }));
          }}
          onPersistTaxSystem={(taxSystemDraft) => {
            setBuilderState((prev) => ({ ...prev, taxSystemData: taxSystemDraft }));
          }}
        />
      </Suspense>
    );
  }

  // Preview Step - render preview content
  if (builderState.step === "preview") {
    return <BuilderPreviewStep />;
  }

  return null;
});
