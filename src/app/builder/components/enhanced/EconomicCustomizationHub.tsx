"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, ArrowLeft, ArrowRight, CheckCircle, BarChart3, Users, Coins, Building2, Heart, Crown, TrendingUp, Flag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { cn } from '~/lib/utils';
import type { EconomicInputs, RealCountryData } from '../../lib/economy-data-service';

// Import section components (using clean versions without glass)
import {
  NationalIdentitySection,
  CoreIndicatorsSection,
  LaborEmploymentSection,
  FiscalSystemSection,
  GovernmentSpendingSection,
  DemographicsSection,
  GovernmentStructureSection,
  EconomySection
} from '../../sections';

// Import utilities
import { sections } from '../../utils/sectionData';
import type { Section } from '../../types/builder';

interface EconomicCustomizationHubProps {
  inputs: EconomicInputs;
  referenceCountry: RealCountryData;
  onInputsChange: (inputs: EconomicInputs) => void;
  onPreview: () => void;
  onBack: () => void;
  onFoundationFlagUrlChange?: (url: string | undefined) => void;
}

export function EconomicCustomizationHub({
  inputs,
  referenceCountry,
  onInputsChange,
  onPreview,
  onBack
}: EconomicCustomizationHubProps) {
  const [activeSection, setActiveSection] = useState('core'); // Start with Core Indicators
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeSectionData = sections.find(s => s.id === activeSection);

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
  };

  const handleToggleAdvanced = () => {
    setShowAdvanced(!showAdvanced);
  };

  const renderSectionContent = () => {
    const commonProps = {
      inputs,
      onInputsChange,
      showAdvanced,
      onToggleAdvanced: handleToggleAdvanced,
      referenceCountry,
      totalPopulation: inputs.coreIndicators.totalPopulation,
      nominalGDP: inputs.coreIndicators.nominalGDP,
      gdpPerCapita: inputs.coreIndicators.gdpPerCapita,
      isReadOnly: false,
      showComparison: true
    };

    switch (activeSection) {
      case 'symbols':
        return <NationalIdentitySection {...commonProps} />;
      case 'core':
        return <CoreIndicatorsSection {...commonProps} />;
      case 'economy':
        return <EconomySection {...commonProps} />;
      case 'labor':
        return <LaborEmploymentSection {...commonProps} />;
      case 'fiscal':
        return <FiscalSystemSection {...commonProps} />;
      case 'government':
        return <GovernmentSpendingSection {...commonProps} />;
      case 'structure':
        return <GovernmentStructureSection {...commonProps} />;
      case 'demographics':
        return <DemographicsSection {...commonProps} />;
      default:
        return <CoreIndicatorsSection {...commonProps} />;
    }
  };

  const getSectionIcon = (sectionId: string) => {
    switch (sectionId) {
      case 'symbols': return Flag;
      case 'core': return BarChart3;
      case 'economy': return TrendingUp;
      case 'labor': return Users;
      case 'fiscal': return Coins;
      case 'government': return Building2;
      case 'structure': return Crown;
      case 'demographics': return Heart;
      default: return BarChart3;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Economic Configuration</h2>
            <p className="text-muted-foreground">
              Configure {referenceCountry.name}'s economic parameters
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={showAdvanced ? "default" : "outline"}
            onClick={handleToggleAdvanced}
            size="sm"
          >
            <Settings className="h-4 w-4 mr-2" />
            {showAdvanced ? 'Advanced' : 'Basic'}
          </Button>
          <Button onClick={onPreview} className="flex items-center gap-2">
            Preview
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Section Navigation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Configuration Sections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeSection} onValueChange={handleSectionChange}>
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
              {sections.map((section) => {
                const Icon = getSectionIcon(section.id);
                return (
                  <TabsTrigger key={section.id} value={section.id} className="flex flex-col items-center gap-1 p-3">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{section.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {section.completeness}%
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value={activeSection} className="mt-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderSectionContent()}
                </motion.div>
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Section Info */}
      {activeSectionData && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{activeSectionData.name}:</strong> {activeSectionData.description}
            <br />
            <span className="text-sm text-muted-foreground">
              Completeness: {activeSectionData.completeness}%
            </span>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}