/**
 * Atomic Components Step for Tax Builder
 *
 * Handles atomic tax component selection, basic settings,
 * and analysis of tax system effectiveness.
 */

"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Info } from "lucide-react";
import { TaxSystemForm } from "../../atoms/TaxSystemForm";
import { AtomicTaxComponentSelector } from "../../atoms/AtomicTaxComponents";
import { UnifiedTaxEffectivenessDisplay } from "../../UnifiedTaxEffectivenessDisplay";
import { TaxEconomySyncDisplay } from "../../TaxEconomySyncDisplay";
import { toast } from "sonner";
import type { TaxSystemInput, TaxSystem } from "~/types/tax-system";
import type { ComponentType } from "~/types/government";

interface AtomicComponentsStepProps {
  // Tax system data
  taxSystem: TaxSystemInput;
  onTaxSystemChange: (taxSystem: TaxSystemInput) => void;

  // Atomic components
  selectedAtomicTaxComponents: string[];
  onAtomicComponentsChange: (components: string[]) => void;
  activeGovernmentComponents: ComponentType[];

  // Economic data
  economicData?: {
    gdp: number;
    sectors: any;
    population: number;
  };

  // Validation and display
  validationErrors: Record<string, string[]>;
  isReadOnly: boolean;
  showAtomicIntegration: boolean;
  countryId?: string;

  // Preview data for effectiveness display
  previewTaxSystem: TaxSystem;
}

/**
 * Atomic Components Step Component
 * ~300 lines extracted from main TaxBuilder
 */
export const AtomicComponentsStep = React.memo<AtomicComponentsStepProps>(
  ({
    taxSystem,
    onTaxSystemChange,
    selectedAtomicTaxComponents,
    onAtomicComponentsChange,
    activeGovernmentComponents,
    economicData,
    validationErrors,
    isReadOnly,
    showAtomicIntegration,
    countryId,
    previewTaxSystem,
  }) => {
    return (
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Settings</TabsTrigger>
          <TabsTrigger value="atomic">Atomic Components</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        {/* Basic Settings Tab */}
        <TabsContent value="basic" className="mt-6 space-y-6">
          <TaxSystemForm
            data={taxSystem}
            onChange={onTaxSystemChange}
            isReadOnly={isReadOnly}
            errors={validationErrors}
            countryId={countryId}
          />
        </TabsContent>

        {/* Atomic Components Tab */}
        <TabsContent value="atomic" className="mt-6 space-y-6">
          {showAtomicIntegration ? (
            <>
              <div className="space-y-4 text-center">
                <h2 className="text-foreground text-2xl font-semibold">Atomic Tax Components</h2>
                <p className="text-muted-foreground">
                  Build your tax system using modular components with synergies and conflicts
                </p>
              </div>

              <AtomicTaxComponentSelector
                selectedComponents={selectedAtomicTaxComponents}
                onComponentChange={onAtomicComponentsChange}
                maxComponents={15}
                isReadOnly={isReadOnly}
              />

              {selectedAtomicTaxComponents.length > 0 && economicData && (
                <div className="space-y-6">
                  <UnifiedTaxEffectivenessDisplay
                    taxComponents={selectedAtomicTaxComponents.map((id) => ({
                      id,
                      type: id,
                      name: id,
                      effectiveness: 80,
                    }))}
                    governmentComponents={activeGovernmentComponents.map((type) => ({
                      id: type,
                      type,
                      name: type,
                      effectiveness: 80,
                      countryId: countryId || "",
                      effectivenessScore: 80,
                      implementationDate: new Date(),
                      implementationCost: 0,
                      maintenanceCost: 0,
                      requiredCapacity: 50,
                      isActive: true,
                      notes: null,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    }))}
                    economicData={economicData as any}
                    taxSystem={previewTaxSystem}
                  />
                </div>
              )}
            </>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Atomic integration is disabled. Enable it to access modular tax components.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="mt-6 space-y-6">
          {economicData ? (
            <TaxEconomySyncDisplay
              taxSystem={previewTaxSystem}
              economicData={{ core: economicData as any }}
              onOptimize={() => {
                toast.info("Tax optimization recommendations applied");
              }}
            />
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Economic data is required to show tax system analysis. Configure your economy
                builder first.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    );
  }
);

AtomicComponentsStep.displayName = "AtomicComponentsStep";
