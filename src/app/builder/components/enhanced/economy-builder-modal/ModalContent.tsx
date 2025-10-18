"use client";

import React from 'react';
import { TabsContent } from '~/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Zap } from 'lucide-react';

import { AtomicEconomicComponentSelector } from '~/components/economy/atoms/AtomicEconomicComponents';
import { EconomicEffectiveness, EconomicImpactPreview } from '~/components/economy/atoms/AtomicEconomicUI';
import { EconomySectorsTab } from '../tabs/EconomySectorsTab';
import { LaborEmploymentTab } from '../tabs/LaborEmploymentTab';
import { DemographicsPopulationTab } from '../tabs/DemographicsPopulationTab';
import { EconomyPreviewTab } from '../tabs/EconomyPreviewTab';

import type { EconomyBuilderState, EconomicHealthMetrics } from '~/types/economy-builder';
import type { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';
import type { EconomicInputs } from '~/app/builder/lib/economy-data-service';

interface ModalContentProps {
  economyBuilder: EconomyBuilderState;
  selectedComponents: EconomicComponentType[];
  economicHealthMetrics: EconomicHealthMetrics;
  economicInputs: EconomicInputs;
  onComponentChange: (components: EconomicComponentType[]) => void;
  onEconomyBuilderChange: (builder: EconomyBuilderState) => void;
}

export function ModalContent({
  economyBuilder,
  selectedComponents,
  economicHealthMetrics,
  economicInputs,
  onComponentChange,
  onEconomyBuilderChange
}: ModalContentProps) {
  return (
    <div className="flex-1 overflow-auto">
      <TabsContent value="atomicComponents" className="h-full m-0 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Economic Atomic Components</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-full overflow-auto">
                <AtomicEconomicComponentSelector
                  selectedComponents={selectedComponents}
                  onComponentChange={onComponentChange}
                  maxComponents={12}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <EconomicEffectiveness
              selectedComponents={selectedComponents}
              maxComponents={12}
            />
            <EconomicImpactPreview
              selectedComponents={selectedComponents}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="sectors" className="h-full m-0 p-6">
        <EconomySectorsTab
          economyBuilder={economyBuilder}
          onEconomyBuilderChange={onEconomyBuilderChange}
          selectedComponents={selectedComponents}
        />
      </TabsContent>

      <TabsContent value="labor" className="h-full m-0 p-6">
        <LaborEmploymentTab
          economyBuilder={economyBuilder}
          onEconomyBuilderChange={onEconomyBuilderChange}
          selectedComponents={selectedComponents}
        />
      </TabsContent>

      <TabsContent value="demographics" className="h-full m-0 p-6">
        <DemographicsPopulationTab
          economyBuilder={economyBuilder}
          onEconomyBuilderChange={onEconomyBuilderChange}
          selectedComponents={selectedComponents}
        />
      </TabsContent>

      <TabsContent value="preview" className="h-full m-0 p-6">
        <EconomyPreviewTab
          economyBuilder={economyBuilder}
          economicHealthMetrics={economicHealthMetrics}
          selectedComponents={selectedComponents}
          economicInputs={economicInputs}
        />
      </TabsContent>
    </div>
  );
}
