"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  BarChart3,
  Users,
  Building2,
  Coins,
  TrendingUp,
  Shield,
  Heart,
  Zap,
  ChevronLeft,
  ChevronRight,
  Eye,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Info,
  Image as ImageIcon,
  Flag
} from 'lucide-react';
import { cn } from '~/lib/utils';
import { GlassCard, GlassCardContent, GlassCardHeader } from '../glass/GlassCard';
import { GlassTooltip, InfoIcon } from '../glass/GlassTooltip';
import { LiveFeedback } from '../glass/LiveFeedback';
import { Button } from '~/components/ui/button';
import type { EconomicInputs, RealCountryData } from '../../lib/economy-data-service';
import { CountrySymbolsUploader } from '../CountrySymbolsUploader';
import { EnhancedCountryFlag } from '~/components/ui/enhanced-country-flag';
import { BuilderModeToggle } from '../glass/BuilderModeToggle';
import { useBuilderTheming } from '~/hooks/useBuilderTheming';
import {
  GlassNumberPicker,
  GlassDial,
  GlassToggle,
  GlassSlider,
  GlassBarChart,
  GlassPieChart,
  GoogleGaugeChart,
  GoogleLineChart
} from '~/components/charts';
import type { BuilderStyle, BuilderMode } from '../glass/BuilderStyleToggle';
import { BuilderStyleToggle } from '../glass/BuilderStyleToggle';

interface EconomicCustomizationHubProps {
  inputs: EconomicInputs;
  referenceCountry: RealCountryData;
  onInputsChange: (inputs: EconomicInputs) => void;
  onPreview: () => void;
  onBack: () => void;
  builderStyle?: BuilderStyle;
  builderMode?: BuilderMode;
  onFoundationFlagUrlChange: (url: string | undefined) => void;
}

interface Section {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
  completeness: number;
}

interface PolicyAdvisorTip {
  id: string;
  section: string;
  type: 'warning' | 'suggestion' | 'optimization';
  title: string;
  description: string;
  impact: string;
}

const sections: Section[] = [
  {
    id: 'symbols',
    name: 'National Symbols',
    icon: Flag,
    color: 'text-[var(--color-warning)]',
    description: 'Flag, coat of arms, national identity',
    completeness: 95
  },
  {
    id: 'core',
    name: 'Core Indicators',
    icon: BarChart3,
    color: 'text-[var(--color-brand-primary)]',
    description: 'GDP, population, growth rates',
    completeness: 90
  },
  {
    id: 'labor',
    name: 'Labor & Employment',
    icon: Users,
    color: 'text-[var(--color-success)]',
    description: 'Employment, wages, workforce',
    completeness: 75
  },
  {
    id: 'fiscal',
    name: 'Fiscal System',
    icon: Coins,
    color: 'text-[var(--color-warning)]',
    description: 'Taxes, budget, debt management',
    completeness: 80
  },
  {
    id: 'government',
    name: 'Government Spending',
    icon: Building2,
    color: 'text-[var(--color-purple)]',
    description: 'Education, healthcare, infrastructure',
    completeness: 85
  },
  {
    id: 'demographics',
    name: 'Demographics',
    icon: Heart,
    color: 'text-[var(--color-error)]',
    description: 'Age distribution, social structure',
    completeness: 70
  }
];

export function EconomicCustomizationHub({
  inputs,
  referenceCountry,
  onInputsChange,
  onPreview,
  onBack,
  onFoundationFlagUrlChange
}: EconomicCustomizationHubProps) {
  const [activeSection, setActiveSection] = useState('symbols');
  const [isSimulating, setIsSimulating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [builderMode, setBuilderMode] = useState<BuilderMode>('basic');
  const [builderStyle, setBuilderStyle] = useState<BuilderStyle>('modern');
  const [advisorTips, setAdvisorTips] = useState<PolicyAdvisorTip[]>([]);

  // Sync builder mode with showAdvanced
  useEffect(() => {
    setBuilderMode(showAdvanced ? 'advanced' : 'basic');
  }, [showAdvanced]);

  // Calculate policy advisor tips based on current inputs
  useEffect(() => {
    const generateTips = (): PolicyAdvisorTip[] => {
      const tips: PolicyAdvisorTip[] = [];

      // High unemployment warning
      if (inputs.laborEmployment.unemploymentRate > 10) {
        tips.push({
          id: 'high-unemployment',
          section: 'labor',
          type: 'warning',
          title: 'High Unemployment Risk',
          description: 'Unemployment above 10% may lead to social instability and reduced economic growth.',
          impact: 'Consider increasing infrastructure spending or reducing labor taxes.'
        });
      }

      // Debt sustainability
      if (inputs.fiscalSystem.totalDebtGDPRatio > 100) {
        tips.push({
          id: 'debt-sustainability',
          section: 'fiscal',
          type: 'warning',
          title: 'High Debt Levels',
          description: 'Debt-to-GDP ratio above 100% may threaten fiscal sustainability.',
          impact: 'Consider reducing government spending or increasing tax revenue.'
        });
      }

      // Low education spending
      if (inputs.governmentSpending.spendingCategories.find(c => c.category === 'Education')?.percent || 0 < 15) {
        tips.push({
          id: 'education-investment',
          section: 'government',
          type: 'suggestion',
          title: 'Education Investment Opportunity',
          description: 'Higher education spending can boost long-term economic growth.',
          impact: 'Consider increasing education budget to 15-20% of government spending.'
        });
      }

      // Inflation optimization
      const idealInflation = 2;
      if (Math.abs(inputs.coreIndicators.inflationRate - idealInflation) > 3) {
        tips.push({
          id: 'inflation-target',
          section: 'core',
          type: 'optimization',
          title: 'Inflation Target Optimization',
          description: 'Central banks typically target 2% inflation for optimal economic stability.',
          impact: 'Adjust monetary policy to achieve target inflation rate.'
        });
      }

      return tips;
    };

    setAdvisorTips(generateTips());
  }, [inputs]);

  const activeSectionData = sections.find(s => s.id === activeSection);

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'symbols':
        return <NationalSymbolsSection inputs={inputs} onInputsChange={onInputsChange} referenceCountry={referenceCountry} onFoundationFlagUrlChange={onFoundationFlagUrlChange} />;
      case 'core':
        return <CoreIndicatorsSection inputs={inputs} onInputsChange={onInputsChange} referenceCountry={referenceCountry} />;
      case 'labor':
        return <LaborEmploymentSection inputs={inputs} onInputsChange={onInputsChange} />;
      case 'fiscal':
        return <FiscalSystemSection inputs={inputs} onInputsChange={onInputsChange} />;
      case 'government':
        return <GovernmentSpendingSection inputs={inputs} onInputsChange={onInputsChange} />;
      case 'demographics':
        return <DemographicsSection inputs={inputs} onInputsChange={onInputsChange} />;
      default:
        return null;
    }
  };

  const getTipIcon = (type: PolicyAdvisorTip['type']) => {
    switch (type) {
      case 'warning': return AlertTriangle;
      case 'suggestion': return Info;
      case 'optimization': return TrendingUp;
    }
  };

  const getTipColor = (type: PolicyAdvisorTip['type']) => {
    switch (type) {
      case 'warning': return 'border-[var(--color-error)]/30 bg-[var(--color-error)]/10 text-[var(--color-error)]';
      case 'suggestion': return 'border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]';
      case 'optimization': return 'border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-bg-primary)] via-[var(--color-bg-secondary)] to-[var(--color-bg-primary)] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8 relative z-50 bg-[var(--color-bg-primary)]/95 backdrop-blur-sm rounded-lg p-4 border border-[var(--color-border-primary)]"
          style={{
            backgroundImage: `url(/flags/${referenceCountry.name.toLowerCase().replace(/ /g, '-')}.svg)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Overlay for blur effect */}
          <div className="absolute inset-0 backdrop-filter backdrop-blur-md bg-black/50 z-0" />
          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <Button
                onClick={onBack}
                variant="outline"
                size="default"
                className="bg-[var(--color-bg-accent)] border-[var(--color-border-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-accent)]/80 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-4">
                {/* Foundation Country Info */}
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    Building : {inputs.countryName}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Foundation Country: {referenceCountry.name} {referenceCountry.countryCode ? `(${referenceCountry.countryCode})` : ''}
                  </p>
                </div>
              </div>
            </div>
            <p className="text-[var(--color-text-secondary)]">
                 Customize your economic parameters below
                </p>
              
            <div className="flex items-center gap-4 relative z-10">
              {/* Builder Style and Mode Toggles - Hidden for now */}
              {false && (
                <BuilderStyleToggle
                  style={builderStyle}
                  mode={builderMode}
                  onStyleChange={setBuilderStyle}
                  onModeChange={(mode) => {
                    setBuilderMode(mode);
                    setShowAdvanced(mode === 'advanced');
                  }}
                  className="hidden lg:block"
                />
              )}
              
              {/* Existing Controls */}
              <div className="flex items-center gap-3">
              </div>
            </div>
          </div>
        </motion.div>

        <div className={cn(
          "grid gap-6",
          builderStyle === 'classic' 
            ? "grid-cols-1 lg:grid-cols-5" // More compact layout for classic
            : "grid-cols-1 lg:grid-cols-4"  // Standard layout for modern
        )}>
          {/* Sidebar Navigation */}
          <div className={cn(
            "space-y-6",
            builderStyle === 'classic' ? "lg:col-span-1" : ""
          )}>
            {/* Section Navigation */}
            <GlassCard depth="elevated" blur="medium">
              <GlassCardHeader>
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-[var(--color-text-primary)]" />
                  <h3 className="font-semibold text-[var(--color-text-primary)]">Sections</h3>
                </div>
              </GlassCardHeader>
              <GlassCardContent>
                <div className="space-y-2">
                  {sections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;

                    return (
                      <motion.button
                        key={section.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSectionChange(section.id)}
                        className={cn(
                          'w-full p-3 rounded-lg border text-left transition-all duration-200',
                          isActive
                            ? 'bg-[var(--color-bg-accent)] border-[var(--color-border-secondary)] shadow-lg'
                            : 'border-[var(--color-border-primary)] hover:bg-[var(--color-bg-accent)]/50 hover:border-[var(--color-border-secondary)]'
                        )}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <Icon className={cn('h-5 w-5', section.color)} />
                          <span className="font-medium text-[var(--color-text-primary)]">{section.name}</span>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)] mb-2">{section.description}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[var(--color-bg-accent)] rounded-full h-1.5">
                            <div
                              className="bg-gradient-to-r from-[var(--color-success)] to-[var(--color-brand-primary)] h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${section.completeness}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--color-text-muted)]">{section.completeness}%</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </GlassCardContent>
            </GlassCard>

            {/* Policy Advisor */}
            {advisorTips.length > 0 && (
              <GlassCard depth="elevated" blur="medium" theme="gold">
                <GlassCardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-300" />
                    <h3 className="font-semibold text-[var(--color-text-primary)]">Policy Advisor</h3>
                  </div>
                </GlassCardHeader>
                <GlassCardContent>
                  <div className="space-y-3">
                    {advisorTips.slice(0, 3).map((tip) => {
                      const Icon = getTipIcon(tip.type);
                      return (
                        <motion.div
                          key={tip.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn(
                            'p-3 rounded-lg border',
                            getTipColor(tip.type)
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <h4 className="font-medium text-sm mb-1">{tip.title}</h4>
                              <p className="text-xs opacity-90 mb-2">{tip.description}</p>
                              <p className="text-xs opacity-75">{tip.impact}</p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </GlassCardContent>
              </GlassCard>
            )}
          </div>

          {/* Main Content */}
          <div className={cn(
            builderStyle === 'classic' 
              ? "lg:col-span-3" // More space for content in classic mode
              : "lg:col-span-2"  // Standard layout for modern
          )}>
            <GlassCard depth="elevated" blur="medium" motionPreset="slide">
              <GlassCardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {activeSectionData && (
                      <>
                        <activeSectionData.icon className={`h-6 w-6 ${activeSectionData.color}`} />
                        <div>
                          <h3 className="font-semibold text-[var(--color-text-primary)]">{activeSectionData.name}</h3>
                          <p className="text-sm text-[var(--color-text-muted)]">{activeSectionData.description}</p>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      variant="outline"
                      size="sm"
                      className="bg-[var(--color-bg-accent)] border-[var(--color-border-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-accent)]/80"
                    >
                      Advanced
                    </Button>
                    <GlassTooltip
                      content="Get detailed explanations and impact analysis for each parameter"
                      position="left"
                    >
                      <InfoIcon />
                    </GlassTooltip>
                  </div>
                </div>
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
          </div>

          {/* Live Feedback Panel */}
          <div className={cn(
            builderStyle === 'classic' 
              ? "lg:col-span-1" // Smaller feedback panel in classic mode
              : ""  // Default behavior for modern
          )}>
            <LiveFeedback inputs={inputs} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Section Components (simplified versions - you can expand these)
import { MediaSearchModal } from '~/components/thinkpages/MediaSearchModal';
import { NationalSymbolsSection } from './NationalSymbolsSection';

function CoreIndicatorsSection({ 
  inputs, 
  onInputsChange,
  referenceCountry
}: { 
  inputs: EconomicInputs; 
  onInputsChange: (inputs: EconomicInputs) => void;
  referenceCountry: RealCountryData;
}) {
  return (
    <div className="space-y-6">
      {/* Core Metrics with Advanced Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassNumberPicker
          label="Population"
          value={inputs.coreIndicators.totalPopulation}
          onChange={(value) => onInputsChange({
            ...inputs,
            coreIndicators: {
              ...inputs.coreIndicators,
              totalPopulation: value
            }
          })}
          min={100000}
          max={2000000000}
          step={100000}
          unit=" people"
          theme="blue"
        />
        
        <GlassNumberPicker
          label="GDP per Capita"
          value={inputs.coreIndicators.gdpPerCapita}
          onChange={(value) => onInputsChange({
            ...inputs,
            coreIndicators: {
              ...inputs.coreIndicators,
              gdpPerCapita: value
            }
          })}
          min={500}
          max={150000}
          step={1000}
          unit=" $"
          theme="emerald"
        />

        <GlassSlider
          label="Real GDP Growth Rate"
          value={inputs.coreIndicators.realGDPGrowthRate}
          onChange={(value) => onInputsChange({
            ...inputs,
            coreIndicators: {
              ...inputs.coreIndicators,
              realGDPGrowthRate: value
            }
          })}
          min={-10}
          max={15}
          step={0.1}
          unit="%"
          theme="gold"
          showTicks={true}
          tickCount={6}
        />

        <GlassDial
          label="Inflation Rate"
          value={inputs.coreIndicators.inflationRate}
          onChange={(value) => onInputsChange({
            ...inputs,
            coreIndicators: {
              ...inputs.coreIndicators,
              inflationRate: value
            }
          })}
          min={-5}
          max={20}
          step={0.1}
          unit="%"
          theme="purple"
        />
      </div>
    </div>
  );
}

function LaborEmploymentSection({ 
  inputs, 
  onInputsChange 
}: { 
  inputs: EconomicInputs; 
  onInputsChange: (inputs: EconomicInputs) => void;
}) {
  // Labor market data for visualization
  const laborData = [
    { category: 'Employed', value: 100 - inputs.laborEmployment.unemploymentRate, color: 'emerald' },
    { category: 'Unemployed', value: inputs.laborEmployment.unemploymentRate, color: 'red' }
  ];

  const wageData = [
    { name: 'Minimum Wage', value: inputs.laborEmployment.minimumWage },
    { name: 'Average Wage', value: inputs.laborEmployment.averageAnnualIncome },
    { name: 'Median Wage', value: inputs.laborEmployment.averageAnnualIncome * 0.85 }
  ];

  const workforceData = [
    { name: 'Active Labor Force', value: inputs.laborEmployment.laborForceParticipationRate },
    { name: 'Youth Employment', value: Math.max(0, 100 - inputs.laborEmployment.unemploymentRate * 1.5) },
    { name: 'Senior Employment', value: Math.max(0, 100 - inputs.laborEmployment.unemploymentRate * 0.8) }
  ];

  return (
    <div className="space-y-6">
      {/* Employment Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <GlassSlider
          label="Unemployment Rate"
          value={inputs.laborEmployment.unemploymentRate}
          onChange={(value) => onInputsChange({
            ...inputs,
            laborEmployment: {
              ...inputs.laborEmployment,
              unemploymentRate: value
            }
          })}
          min={0}
          max={25}
          step={0.1}
          unit="%"
          theme="default"
          showTicks={true}
          tickCount={6}
        />

        <GlassDial
          label="Labor Force Participation"
          value={inputs.laborEmployment.laborForceParticipationRate}
          onChange={(value) => onInputsChange({
            ...inputs,
            laborEmployment: {
              ...inputs.laborEmployment,
              laborForceParticipationRate: value
            }
          })}
          min={30}
          max={90}
          step={0.5}
          unit="%"
          theme="blue"
        />

        <GlassNumberPicker
          label="Average Wage"
          value={inputs.laborEmployment.averageAnnualIncome}
          onChange={(value) => onInputsChange({
            ...inputs,
            laborEmployment: {
              ...inputs.laborEmployment,
              averageAnnualIncome: value
            }
          })}
          min={500}
          max={10000}
          step={50}
          unit=" $/month"
          theme="emerald"
        />

        <GlassNumberPicker
          label="Minimum Wage"
          value={inputs.laborEmployment.minimumWage}
          onChange={(value) => onInputsChange({
            ...inputs,
            laborEmployment: {
              ...inputs.laborEmployment,
              minimumWage: value
            }
          })}
          min={100}
          max={3000}
          step={25}
          unit=" $/month"
          theme="gold"
        />

        <GlassSlider
          label="Working Hours per Week"
          value={inputs.laborEmployment.averageWorkweekHours}
          onChange={(value) => onInputsChange({
            ...inputs,
            laborEmployment: {
              ...inputs.laborEmployment,
              averageWorkweekHours: value
            }
          })}
          min={20}
          max={60}
          step={1}
          unit=" hours"
          theme="purple"
          showTicks={true}
          tickCount={5}
        />

        <GlassToggle
          label="Strong Labor Protections"
          description="Enhanced worker rights and job security"
          checked={inputs.laborEmployment.laborProtections}
          onChange={(checked) => onInputsChange({
            ...inputs,
            laborEmployment: {
              ...inputs.laborEmployment,
              laborProtections: checked
            }
          })}
          theme="blue"
        />
      </div>

      {/* Labor Market Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPieChart
          data={laborData}
          dataKey="value"
          nameKey="category"
          title="Employment Status"
          description="Labor force distribution"
          height={300}
          theme="emerald"
        />

        <GlassBarChart
          data={wageData}
          xKey="name"
          yKey="value"
          title="Wage Structure"
          description="Income levels across the economy"
          height={300}
          theme="gold"
        />
      </div>

      <div className="w-full">
        <GlassBarChart
          data={workforceData}
          xKey="name"
          yKey="value"
          title="Workforce Participation by Demographics"
          description="Employment rates across different age groups"
          height={250}
          theme="blue"
        />
      </div>
    </div>
  );
}

function FiscalSystemSection({ 
  inputs, 
  onInputsChange 
}: { 
  inputs: EconomicInputs; 
  onInputsChange: (inputs: EconomicInputs) => void;
}) {
  // Fiscal data for visualization
  const taxData = [
    { name: 'Income Tax', rate: inputs.fiscalSystem.taxRates.personalIncomeTaxRates[1]?.rate || 0, revenue: inputs.fiscalSystem.taxRates.personalIncomeTaxRates[1]?.rate || 0 * 0.8 },
    { name: 'Corporate Tax', rate: inputs.fiscalSystem.taxRates.corporateTaxRates[1]?.rate || 0, revenue: inputs.fiscalSystem.taxRates.corporateTaxRates[1]?.rate || 0 * 0.6 },
    { name: 'VAT/Sales Tax', rate: inputs.fiscalSystem.taxRates.salesTaxRate, revenue: inputs.fiscalSystem.taxRates.salesTaxRate * 1.2 }
  ];


  const budgetBalanceData = [
    ['Year', 'Budget Balance'],
    ['2020', -3.2],
    ['2021', -4.1],
    ['2022', -2.8],
    ['2023', -1.5],
    ['2024', (inputs.fiscalSystem.budgetDeficitSurplus / inputs.coreIndicators.nominalGDP) * 100 || -2.0],
    ['2025', ((inputs.fiscalSystem.budgetDeficitSurplus / inputs.coreIndicators.nominalGDP) * 100 || -2.0) * 0.8],
    ['2026', ((inputs.fiscalSystem.budgetDeficitSurplus / inputs.coreIndicators.nominalGDP) * 100 || -2.0) * 0.6]
  ];

  const fiscalHealthScore = Math.max(0, Math.min(100, 
    100 - (inputs.fiscalSystem.totalDebtGDPRatio * 0.5) - (Math.abs((inputs.fiscalSystem.budgetDeficitSurplus / inputs.coreIndicators.nominalGDP) * 100 || 0) * 10)
  ));

  const fiscalGaugeData = [
    ['Label', 'Value'],
    ['Fiscal Health', fiscalHealthScore]
  ];

  return (
    <div className="space-y-6">
      {/* Tax Controls */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <Coins className="h-5 w-5 text-[var(--color-warning)]" />
          Tax Policy
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlassSlider
            label="Income Tax Rate"
            value={inputs.fiscalSystem.taxRates.personalIncomeTaxRates[1]?.rate || 0}
            onChange={(value) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                taxRates: {
                  ...inputs.fiscalSystem.taxRates,
                  personalIncomeTaxRates: inputs.fiscalSystem.taxRates.personalIncomeTaxRates.map((rate, index) =>
                    index === 1 ? { ...rate, rate: value } : rate
                  )
                }
              }
            })}
            min={0}
            max={70}
            step={0.5}
            unit="%"
            theme="gold"
            showTicks={true}
            tickCount={8}
          />

          <GlassSlider
            label="Corporate Tax Rate"
            value={inputs.fiscalSystem.taxRates.corporateTaxRates[1]?.rate || 0}
            onChange={(value) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                taxRates: {
                  ...inputs.fiscalSystem.taxRates,
                  corporateTaxRates: inputs.fiscalSystem.taxRates.corporateTaxRates.map((rate, index) =>
                    index === 1 ? { ...rate, rate: value } : rate
                  )
                }
              }
            })}
            min={0}
            max={50}
            step={0.5}
            unit="%"
            theme="blue"
            showTicks={true}
            tickCount={6}
          />

          <GlassSlider
            label="VAT/Sales Tax Rate"
            value={inputs.fiscalSystem.taxRates.salesTaxRate}
            onChange={(value) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                salesTaxRate: value
              }
            })}
            min={0}
            max={30}
            step={0.5}
            unit="%"
            theme="emerald"
            showTicks={true}
            tickCount={7}
          />
        </div>
      </div>

      {/* Debt and Budget Controls */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[var(--color-error)]" />
          Debt & Budget Management
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <GlassDial
            label="Total Debt to GDP"
            value={inputs.fiscalSystem.totalDebtGDPRatio}
            onChange={(value) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                totalDebtGDPRatio: value
              }
            })}
            min={0}
            max={200}
            step={1}
            unit="%"
            theme="default"
          />

          <GlassSlider
            label="Budget Deficit/Surplus"
            value={(inputs.fiscalSystem.budgetDeficitSurplus / inputs.coreIndicators.nominalGDP) * 100 || 0}
            onChange={(value) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                budgetDeficitSurplus: (value / 100) * inputs.coreIndicators.nominalGDP
              }
            })}
            min={-15}
            max={5}
            step={0.1}
            unit="% of GDP"
            theme="purple"
            showTicks={true}
            tickCount={5}
          />

          <GlassNumberPicker
            label="Tax Revenue Efficiency"
            value={inputs.fiscalSystem.taxRevenueGDPPercent || 25}
            onChange={(value) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                taxRevenueGDPPercent: value
              }
            })}
            min={5}
            max={50}
            step={0.5}
            unit="% of GDP"
            theme="gold"
          />
        </div>
      </div>

      {/* Fiscal Policy Toggles */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">Policy Options</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassToggle
            label="Progressive Tax System"
            description="Higher rates for higher income brackets"
            checked={inputs.fiscalSystem.progressiveTaxation}
            onChange={(checked) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                progressiveTaxation: checked
              }
            })}
            theme="blue"
          />

          <GlassToggle
            label="Balanced Budget Rule"
            description="Constitutional requirement for balanced budgets"
            checked={inputs.fiscalSystem.balancedBudgetRule}
            onChange={(checked) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                balancedBudgetRule: checked
              }
            })}
            theme="emerald"
          />

          <GlassNumberPicker
            label="Debt Ceiling"
            value={inputs.fiscalSystem.debtCeiling}
            onChange={(value) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                debtCeiling: value
              }
            })}
            min={0}
            max={500}
            step={10}
            unit="%"
            theme="gold"
          />

          <GlassToggle
            label="Anti-Tax Avoidance Measures"
            description="Strong enforcement against tax evasion"
            checked={inputs.fiscalSystem.antiAvoidance}
            onChange={(checked) => onInputsChange({
              ...inputs,
              fiscalSystem: {
                ...inputs.fiscalSystem,
                antiAvoidance: checked
              }
            })}
            theme="purple"
          />
        </div>
      </div>

      {/* Fiscal Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassBarChart
          data={taxData}
          xKey="name"
          yKey={['rate', 'revenue']}
          title="Tax Rates vs Revenue Generation"
          description="Tax policy effectiveness"
          height={300}
          theme="gold"
        />

        <GoogleGaugeChart
          data={fiscalGaugeData}
          title="Fiscal Health Score"
          description="Overall fiscal sustainability"
          height={300}
          theme="gold"
          min={0}
          max={100}
          yellowFrom={30}
          yellowTo={70}
          redFrom={0}
          redTo={30}
        />
      </div>

      <div className="w-full">
        <GoogleLineChart
          data={budgetBalanceData}
          title="Budget Balance Projection"
          description="Historical and projected budget balance as % of GDP"
          height={250}
          theme="purple"
          curveType="function"
        />
      </div>
    </div>
  );
}

function GovernmentSpendingSection({ 
  inputs, 
  onInputsChange 
}: { 
  inputs: EconomicInputs; 
  onInputsChange: (inputs: EconomicInputs) => void;
}) {
  // Government spending data for visualization
  const spendingCategories = [
    { name: 'Education', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Education')?.percent || 0, icon: '🎓', priority: 'high' },
    { name: 'Healthcare', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Healthcare')?.percent || 0, icon: '🏥', priority: 'high' },
    { name: 'Defense', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Defense')?.percent || 0, icon: '🛡️', priority: 'medium' },
    { name: 'Infrastructure', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Infrastructure')?.percent || 0, icon: '🏗️', priority: 'high' },
    { name: 'Social Security', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Social Security')?.percent || 0, icon: '👥', priority: 'high' },
    { name: 'Environmental', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Other')?.percent || 0 || 8, icon: '🌱', priority: 'medium' }
  ];

  const totalSpending = spendingCategories.reduce((sum, cat) => sum + cat.value, 0);
  const isValidBudget = Math.abs(totalSpending - 100) <= 1; // Allow 1% variance

  const spendingEfficiencyData = spendingCategories.map(cat => ({
    name: cat.name,
    allocation: cat.value,
    efficiency: Math.random() * 30 + 60, // Mock efficiency score
    impact: cat.priority === 'high' ? cat.value * 1.2 : cat.value * 0.8
  }));

  const historicalSpendingData = [
    ['Year', 'Education', 'Healthcare', 'Defense', 'Infrastructure'],
    ['2020', 15, 22, 18, 12],
    ['2021', 16, 23, 17, 13],
    ['2022', 17, 24, 16, 14],
    ['2023', 18, 25, 15, 15],
    ['2024', inputs.governmentSpending.spendingCategories.find(c => c.category === 'Education')?.percent || 0, inputs.governmentSpending.spendingCategories.find(c => c.category === 'Healthcare')?.percent || 0, 
            inputs.governmentSpending.spendingCategories.find(c => c.category === 'Defense')?.percent || 0, inputs.governmentSpending.spendingCategories.find(c => c.category === 'Infrastructure')?.percent || 0]
  ];

  const updateSpending = (category: string, value: number) => {
    onInputsChange({
      ...inputs,
      governmentSpending: {
        ...inputs.governmentSpending,
        spendingCategories: inputs.governmentSpending.spendingCategories.map(c =>
          c.category.toLowerCase() === category.toLowerCase() ? { ...c, percent: value } : c
        )
      }
    });
  };

  const updateSpendingPolicy = (policy: keyof typeof inputs.governmentSpending, checked: boolean) => {
    onInputsChange({
      ...inputs,
      governmentSpending: {
        ...inputs.governmentSpending,
        [policy]: checked
      }
    });
  };

  // Auto-balance feature
  const autoBalance = () => {
    const currentTotal = totalSpending;
    const adjustment = (100 - currentTotal) / spendingCategories.length;
    
    const newSpendingCategories = inputs.governmentSpending.spendingCategories.map(cat => {
      return {
        ...cat,
        percent: Math.max(0, cat.percent + adjustment)
      };
    });
    
    onInputsChange({
      ...inputs,
      governmentSpending: {
        ...inputs.governmentSpending,
        spendingCategories: newSpendingCategories
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Budget Balance Indicator */}
      <div className="bg-[var(--color-bg-secondary)]/50 rounded-lg p-4 border border-[var(--color-border-primary)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-[var(--color-text-secondary)]">
            Budget Allocation Total
          </span>
          <div className={cn(
            'text-lg font-bold',
            isValidBudget 
              ? 'text-[var(--color-success)]' 
              : 'text-[var(--color-error)]'
          )}>
            {totalSpending.toFixed(1)}%
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex-1 bg-[var(--color-bg-tertiary)] rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                isValidBudget 
                  ? 'bg-[var(--color-success)]' 
                  : totalSpending > 100 
                    ? 'bg-[var(--color-error)]' 
                    : 'bg-[var(--color-warning)]'
              )}
              style={{ width: `${Math.min(100, totalSpending)}%` }}
            />
          </div>
          <Button
            onClick={autoBalance}
            variant="outline"
            size="sm"
            className="ml-3 text-xs"
          >
            Auto-Balance
          </Button>
        </div>
      </div>

      {/* Spending Category Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <GlassSlider
          label="Education Spending"
          value={inputs.governmentSpending.spendingCategories.find(c => c.category === 'Education')?.percent || 0}
          onChange={(value) => updateSpending('education', value)}
          min={5}
          max={35}
          step={0.5}
          unit="% of budget"
          theme="blue"
          showTicks={true}
          tickCount={7}
        />

        <GlassSlider
          label="Healthcare Spending"
          value={inputs.governmentSpending.spendingCategories.find(c => c.category === 'Healthcare')?.percent || 0}
          onChange={(value) => updateSpending('healthcare', value)}
          min={8}
          max={40}
          step={0.5}
          unit="% of budget"
          theme="default"
          showTicks={true}
          tickCount={7}
        />

        <GlassSlider
          label="Defense Spending"
          value={inputs.governmentSpending.spendingCategories.find(c => c.category === 'Defense')?.percent || 0}
          onChange={(value) => updateSpending('defense', value)}
          min={2}
          max={30}
          step={0.5}
          unit="% of budget"
          theme="purple"
          showTicks={true}
          tickCount={6}
        />

        <GlassSlider
          label="Infrastructure Spending"
          value={inputs.governmentSpending.spendingCategories.find(c => c.category === 'Infrastructure')?.percent || 0}
          onChange={(value) => updateSpending('infrastructure', value)}
          min={5}
          max={25}
          step={0.5}
          unit="% of budget"
          theme="emerald"
          showTicks={true}
          tickCount={5}
        />

        <GlassSlider
          label="Social Security"
          value={inputs.governmentSpending.spendingCategories.find(c => c.category === 'Social Security')?.percent || 0}
          onChange={(value) => updateSpending('socialSecurity', value)}
          min={5}
          max={35}
          step={0.5}
          unit="% of budget"
          theme="gold"
          showTicks={true}
          tickCount={7}
        />

        <GlassSlider
          label="Environmental Programs"
          value={inputs.governmentSpending.spendingCategories.find(c => c.category === 'Other')?.percent || 0 || 8}
          onChange={(value) => updateSpending('environmental', value)}
          min={2}
          max={20}
          step={0.5}
          unit="% of budget"
          theme="emerald"
          showTicks={true}
          tickCount={5}
        />
      </div>

      {/* Spending Policy Toggles */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">Spending Policies</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassToggle
            label="Performance-Based Budgeting"
            description="Link funding to measurable outcomes"
            checked={inputs.governmentSpending.performanceBasedBudgeting}
            onChange={(checked) => updateSpendingPolicy('performanceBasedBudgeting', checked)}
            theme="blue"
          />

          <GlassToggle
            label="Universal Basic Services"
            description="Free public services for all citizens"
            checked={inputs.governmentSpending.universalBasicServices}
            onChange={(checked) => updateSpendingPolicy('universalBasicServices', checked)}
            theme="emerald"
          />

          <GlassToggle
            label="Green Investment Priority"
            description="Prioritize environmental and sustainable projects"
            checked={inputs.governmentSpending.greenInvestmentPriority}
            onChange={(checked) => updateSpendingPolicy('greenInvestmentPriority', checked)}
            theme="emerald"
          />

          <GlassToggle
            label="Digital Government Initiative"
            description="Major investment in digital infrastructure"
            checked={inputs.governmentSpending.digitalGovernmentInitiative}
            onChange={(checked) => updateSpendingPolicy('digitalGovernmentInitiative', checked)}
            theme="purple"
          />
        </div>
      </div>

      {/* Spending Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPieChart
          data={spendingCategories.map(cat => ({
            category: cat.name,
            amount: cat.value,
            percent: cat.value,
            icon: cat.icon,
          }))}
          dataKey="amount"
          nameKey="category"
          title="Budget Allocation"
          description="Government spending by sector"
          height={350}
          theme="purple"
        />

        <GlassBarChart
          data={spendingEfficiencyData}
          xKey="name"
          yKey={['allocation', 'efficiency']}
          title="Spending Efficiency Analysis"
          description="Budget allocation vs effectiveness scores"
          height={350}
          theme="gold"
        />
      </div>

      <div className="w-full">
        <GoogleLineChart
          data={historicalSpendingData}
          title="Historical Spending Trends"
          description="Government spending patterns over time (% of total budget)"
          height={250}
          theme="blue"
          curveType="function"
        />
      </div>
    </div>
  );
}

function DemographicsSection({ 
  inputs, 
  onInputsChange 
}: { 
  inputs: EconomicInputs; 
  onInputsChange: (inputs: EconomicInputs) => void;
}) {
  // Demographics data for visualization
  const ageDistribution = [
    { name: '0-17 years', value: inputs.demographics.ageDistribution.find(a => a.group === '0-15')?.percent || 20, category: 'youth' },
    { name: '18-64 years', value: inputs.demographics.ageDistribution.find(a => a.group === '16-64')?.percent || 65, category: 'working' },
    { name: '65+ years', value: inputs.demographics.ageDistribution.find(a => a.group === '65+')?.percent || 15, category: 'elderly' }
  ];

  const populationTrends = [
    ['Year', 'Birth Rate', 'Death Rate', 'Migration Rate'],
    ['2020', 12.5, 8.2, 2.1],
    ['2021', 12.1, 8.5, 1.8],
    ['2022', 11.8, 8.7, 2.3],
    ['2023', 11.5, 8.9, 2.5],
    ['2024', 12.5, 
            8.2, 
            2.1]
  ];

  const educationLevels = [
    { name: 'Primary', value: inputs.demographics.educationLevels.find(e => e.level === 'Primary Education')?.percent || 15 },
    { name: 'Secondary', value: inputs.demographics.educationLevels.find(e => e.level === 'Secondary Education')?.percent || 55 },
    { name: 'Tertiary', value: inputs.demographics.educationLevels.find(e => e.level === 'Higher Education')?.percent || 25 },
    { name: 'Postgraduate', value: inputs.demographics.educationLevels.find(e => e.level === 'Postgraduate Education')?.percent || 5 }
  ];

  const urbanRuralSplit = [
    { name: 'Urban', value: inputs.demographics.urbanRuralSplit.urban },
    { name: 'Rural', value: inputs.demographics.urbanRuralSplit.rural }
  ];

  const diversityData = [
    { name: 'Cultural Diversity Index', value: 7.5 },
    { name: 'Language Diversity', value: 6.2 },
    { name: 'Religious Diversity', value: 5.8 }
  ];

  const updateDemographics = (category: string, subcategory: string | null, value: number | boolean) => {
    if (subcategory) {
      onInputsChange({
        ...inputs,
        demographics: {
          ...inputs.demographics,
          [category]: {
            // Spread demographics data if needed
            [subcategory]: value
          }
        }
      });
    } else {
      onInputsChange({
        ...inputs,
        demographics: {
          ...inputs.demographics,
          [category]: value
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Population Dynamics */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <Users className="h-5 w-5 text-[var(--color-success)]" />
          Population Dynamics
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlassSlider
            label="Birth Rate"
            value={12.5}
            onChange={(value) => updateDemographics('birthRate', null, value)}
            min={5}
            max={40}
            step={0.1}
            unit=" per 1000"
            theme="emerald"
            showTicks={true}
            tickCount={6}
          />

          <GlassSlider
            label="Death Rate"
            value={8.2}
            onChange={(value) => updateDemographics('deathRate', null, value)}
            min={4}
            max={25}
            step={0.1}
            unit=" per 1000"
            theme="default"
            showTicks={true}
            tickCount={6}
          />

          <GlassSlider
            label="Net Migration Rate"
            value={2.1}
            onChange={(value) => updateDemographics('migrationRate', null, value)}
            min={-10}
            max={15}
            step={0.1}
            unit=" per 1000"
            theme="blue"
            showTicks={true}
            tickCount={6}
          />
        </div>
      </div>

      {/* Age Structure */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <Heart className="h-5 w-5 text-[var(--color-warning)]" />
          Age Distribution
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlassDial
            label="Youth (0-17)"
            value={inputs.demographics.ageDistribution.find(a => a.group === '0-15')?.percent || 20}
            onChange={(value) => updateDemographics('ageGroups', 'youth', value)}
            min={10}
            max={40}
            step={0.5}
            unit="%"
            theme="blue"
          />

          <GlassDial
            label="Working Age (18-64)"
            value={inputs.demographics.ageDistribution.find(a => a.group === '16-64')?.percent || 65}
            onChange={(value) => updateDemographics('ageGroups', 'working', value)}
            min={45}
            max={75}
            step={0.5}
            unit="%"
            theme="emerald"
          />

          <GlassDial
            label="Elderly (65+)"
            value={inputs.demographics.ageDistribution.find(a => a.group === '65+')?.percent || 15}
            onChange={(value) => updateDemographics('ageGroups', 'elderly', value)}
            min={5}
            max={35}
            step={0.5}
            unit="%"
            theme="purple"
          />
        </div>
      </div>

      {/* Social Characteristics */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[var(--color-purple)]" />
          Social Structure
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <GlassSlider
            label="Urbanization Rate"
            value={inputs.demographics.urbanRuralSplit.urban}
            onChange={(value) => updateDemographics('urbanization', null, value)}
            min={20}
            max={95}
            step={1}
            unit="%"
            theme="gold"
            showTicks={true}
            tickCount={6}
          />

          <GlassNumberPicker
            label="Life Expectancy"
            value={inputs.demographics.lifeExpectancy || 78.5}
            onChange={(value) => updateDemographics('lifeExpectancy', null, value)}
            min={50}
            max={90}
            step={0.1}
            precision={1}
            unit=" years"
            theme="emerald"
          />

          <GlassSlider
            label="Literacy Rate"
            value={inputs.demographics.literacyRate || 96.8}
            onChange={(value) => updateDemographics('literacyRate', null, value)}
            min={40}
            max={100}
            step={0.1}
            unit="%"
            theme="blue"
            showTicks={true}
            tickCount={7}
          />

          <GlassSlider
            label="Gender Equality Index"
            value={7.8}
            onChange={(value) => updateDemographics('genderEquality', null, value)}
            min={1}
            max={10}
            step={0.1}
            unit="/10"
            theme="purple"
            showTicks={true}
            tickCount={5}
          />
        </div>
      </div>

      {/* Social Policies */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">Social Policies</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassToggle
            label="Universal Healthcare"
            description="Free healthcare for all citizens"
            checked={false || false}
            onChange={(checked) => updateDemographics('universalHealthcare', null, checked)}
            theme="default"
          />

          <GlassToggle
            label="Free Education"
            description="Public education through university level"
            checked={false || false}
            onChange={(checked) => updateDemographics('freeEducation', null, checked)}
            theme="blue"
          />

          <GlassToggle
            label="Immigration-Friendly Policies"
            description="Welcoming stance toward immigrants"
            checked={false || false}
            onChange={(checked) => updateDemographics('immigrationFriendly', null, checked)}
            theme="emerald"
          />

          <GlassToggle
            label="Family Support Programs"
            description="Child care and family benefits"
            checked={false || false}
            onChange={(checked) => updateDemographics('familySupport', null, checked)}
            theme="gold"
          />

          <GlassToggle
            label="Senior Care System"
            description="Comprehensive elderly care programs"
            checked={false || false}
            onChange={(checked) => updateDemographics('seniorCare', null, checked)}
            theme="purple"
          />

          <GlassToggle
            label="Cultural Preservation"
            description="Programs to preserve cultural heritage"
            checked={false || false}
            onChange={(checked) => updateDemographics('culturalPreservation', null, checked)}
            theme="gold"
          />
        </div>
      </div>

      {/* Demographics Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPieChart
          data={ageDistribution}
          dataKey="value"
          nameKey="name"
          title="Age Distribution"
          description="Population by age groups"
          height={300}
          theme="blue"
        />

        <GlassPieChart
          data={educationLevels}
          dataKey="value"
          nameKey="name"
          title="Education Levels"
          description="Population by educational attainment"
          height={300}
          theme="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassBarChart
          data={urbanRuralSplit}
          xKey="name"
          yKey="value"
          title="Urban vs Rural Population"
          description="Geographic distribution of population"
          height={250}
          theme="gold"
        />

        <GlassBarChart
          data={diversityData}
          xKey="name"
          yKey="value"
          title="Diversity Indices"
          description="Cultural, linguistic, and religious diversity scores"
          height={250}
          theme="purple"
        />
      </div>

      <div className="w-full">
        <GoogleLineChart
          data={populationTrends}
          title="Population Dynamics Trends"
          description="Birth rate, death rate, and migration patterns over time"
          height={250}
          theme="emerald"
          curveType="function"
        />
      </div>
    </div>
  );
}