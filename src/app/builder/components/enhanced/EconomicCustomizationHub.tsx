"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings } from 'lucide-react';
import { cn } from '~/lib/utils';
import { GlassCard, GlassCardContent, GlassCardHeader } from '../glass/GlassCard';
import { LiveFeedback } from '../glass/LiveFeedback';
import type { EconomicInputs, RealCountryData } from '../../lib/economy-data-service';
import type { BuilderStyle, BuilderMode } from '../glass/BuilderStyleToggle';

// Import new modular components
import { EconomicHubHeader } from '../../primitives/EconomicHubHeader';
import { SectionNavigator } from '../../primitives/SectionNavigator';
import { PolicyAdvisor } from '../../primitives/PolicyAdvisor';
import { SectionHeader } from '../../primitives/SectionHeader';

// Import section components (using modern versions)
import {
  NationalIdentitySection,
  CoreIndicatorsSectionModern as CoreIndicatorsSection,
  LaborEmploymentSectionModern as LaborEmploymentSection,
  FiscalSystemSectionModern as FiscalSystemSection,
  GovernmentSpendingSectionModern as GovernmentSpendingSection,
  DemographicsSectionModern as DemographicsSection,
  GovernmentStructureSection
} from '../../sections';

// Import utilities
import { sections } from '../../utils/sectionData';
import { generatePolicyAdvisorTips } from '../../utils/policyAdvisorUtils';
import type { Section, PolicyAdvisorTip } from '../../types/builder';

interface EconomicCustomizationHubProps {
  inputs: EconomicInputs;
  referenceCountry: RealCountryData;
  onInputsChange: (inputs: EconomicInputs) => void;
  onPreview: () => void;
  onBack: () => void;
  onFoundationFlagUrlChange?: (url: string | undefined) => void;
  builderStyle?: BuilderStyle;
  builderMode?: BuilderMode;
}

export function EconomicCustomizationHub({
  inputs,
  referenceCountry,
  onInputsChange,
  onPreview,
  onBack,
  onFoundationFlagUrlChange
}: EconomicCustomizationHubProps) {
  const [activeSection, setActiveSection] = useState('symbols');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [builderMode, setBuilderMode] = useState<BuilderMode>('basic');
  const [builderStyle, setBuilderStyle] = useState<BuilderStyle>('modern');
  const [advisorTips, setAdvisorTips] = useState<PolicyAdvisorTip[]>([]);

  // Sync builder mode with showAdvanced
  useEffect(() => {
    setBuilderMode(showAdvanced ? 'advanced' : 'basic');
  }, [showAdvanced]);

  // Generate policy advisor tips using utility function - context-aware
  useEffect(() => {
    setAdvisorTips(generatePolicyAdvisorTips(inputs, activeSection));
  }, [inputs, activeSection]);

  const activeSectionData = sections.find(s => s.id === activeSection);

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
  };

  const handleToggleAdvanced = () => {
    console.log('Toggling advanced view from EconomicCustomizationHub');
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
      gdpPerCapita: inputs.coreIndicators.gdpPerCapita
    };

    switch (activeSection) {
      case 'symbols':
        return <NationalIdentitySection {...commonProps} />;
      case 'core':
        return <CoreIndicatorsSection {...commonProps} />;
      case 'labor':
        return <LaborEmploymentSection {...commonProps} />;
      case 'fiscal':
        return <FiscalSystemSection {...commonProps} />;
      case 'government':
        return (
          <GovernmentSpendingSection
            spendingData={inputs.governmentSpending}
            nominalGDP={inputs.coreIndicators.nominalGDP}
            totalPopulation={inputs.coreIndicators.totalPopulation}
            onSpendingDataChangeAction={(newSpendingData: any) => onInputsChange({ ...inputs, governmentSpending: newSpendingData })}
          />
        );
      case 'structure':
        return <GovernmentStructureSection {...commonProps} />;
      case 'demographics':
        return <DemographicsSection {...commonProps} />;
      default:
        return null;
    }
  };

  // Check if current section is a modern section (has its own header)
  const isModernSection = ['core', 'labor', 'fiscal', 'government', 'demographics'].includes(activeSection);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4 md:p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header - Using modular component */}
        <EconomicHubHeader
          inputs={inputs}
          referenceCountry={referenceCountry}
          onBack={onBack}
        />

        <div className={cn(
          "grid gap-6",
          builderStyle === 'classic' 
            ? "grid-cols-1 lg:grid-cols-6" // More compact layout for classic
            : "grid-cols-1 lg:grid-cols-5"  // Wider layout: 1.5 columns + 2.5 columns + 1 column
        )}>
          {/* Sidebar Navigation */}
          <div className={cn(
            "space-y-4 md:space-y-6 sticky top-6 self-start",
            builderStyle === 'classic' ? "lg:col-span-1" : "lg:col-span-1"
          )}>
            {/* Section Navigation - Using modular component */}
            <SectionNavigator
              sections={sections}
              activeSection={activeSection}
              onSectionChange={handleSectionChange}
            />

            {/* Policy Advisor - Using modular component */}
            <PolicyAdvisor tips={advisorTips} maxTips={3} activeSection={activeSection} />
          </div>

          {/* Main Content */}
          <div className={cn(
            builderStyle === 'classic' 
              ? "lg:col-span-4" // More space for content in classic mode
              : "lg:col-span-3"  // Wider content area for modern
          )}>
{isModernSection ? (
              // Modern sections have their own glass cards and headers
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {renderSectionContent()}
                </motion.div>
              </AnimatePresence>
            ) : (
              // Legacy sections use the hub's glass card wrapper
              <GlassCard depth="elevated" blur="medium" motionPreset="slide">
                <GlassCardHeader>
                  {/* Section Header - Using modular component */}
                  <SectionHeader
                    section={activeSectionData || { 
                      id: activeSection, 
                      name: 'Section', 
                      description: '',
                      icon: Settings,
                      color: 'text-gray-500',
                      completeness: 0
                    }}
                    showAdvanced={showAdvanced}
                    onToggleAdvanced={handleToggleAdvanced}
                  />
                </GlassCardHeader>
                <GlassCardContent>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeSection}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      {renderSectionContent()}
                    </motion.div>
                  </AnimatePresence>
                </GlassCardContent>
              </GlassCard>
            )}
          </div>

          {/* Live Feedback Panel */}
          <div className={cn(
            "sticky top-6 self-start",
            builderStyle === 'classic' 
              ? "lg:col-span-1" // Smaller feedback panel in classic mode
              : "lg:col-span-1"  // Full width on mobile/tablet, sidebar on desktop
          )}>
            <LiveFeedback 
              inputs={inputs} 
              activeSection={activeSection}
              extractedColors={null}
              flagUrl={inputs.flagUrl}
              coatOfArmsUrl={inputs.coatOfArmsUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}