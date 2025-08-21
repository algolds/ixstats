"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';
import type { EconomicInputs, RealCountryData } from '../../lib/economy-data-service';
import { SectionContainer, BasicView, AdvancedView, FormGrid, MetricOverview, ValidationMessage } from './ProgressiveViews';

// Base props that all sections will receive
export interface BaseSectionProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  showAdvanced: boolean;
  onToggleAdvanced?: () => void;
  referenceCountry?: RealCountryData;
  theme?: 'gold' | 'blue' | 'indigo' | 'red' | 'neutral';
  className?: string;
}

// Extended props for sections that need additional data
export interface ExtendedSectionProps extends BaseSectionProps {
  totalPopulation?: number;
  nominalGDP?: number;
  gdpPerCapita?: number;
}

// Configuration for each section
export interface SectionConfig {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  theme: 'gold' | 'blue' | 'indigo' | 'red' | 'neutral';
  showMetricOverview?: boolean;
  validation?: {
    rules: ValidationRule[];
    showWarnings?: boolean;
  };
}

// Validation rule interface
export interface ValidationRule {
  field: string;
  condition: (value: any, inputs: EconomicInputs) => boolean;
  message: string;
  type: 'error' | 'warning' | 'info';
}

// Main Section Base Component
interface SectionBaseProps extends BaseSectionProps {
  config: SectionConfig;
  children: React.ReactNode;
  metrics?: Array<{
    label: string;
    value: string | number;
    unit?: string;
    trend?: 'up' | 'down' | 'neutral';
    change?: number;
    icon?: React.ElementType;
  }>;
  validation?: {
    errors: string[];
    warnings: string[];
    info: string[];
  };
  headerActions?: React.ReactNode;
}

export function SectionBase({
  config,
  inputs,
  onInputsChange,
  showAdvanced,
  onToggleAdvanced,
  referenceCountry,
  children,
  metrics = [],
  validation,
  headerActions,
  className
}: SectionBaseProps) {
  const handleToggleAdvanced = () => {
    if (onToggleAdvanced) {
      onToggleAdvanced();
    }
  };

  // Auto-validate based on config rules
  const validateInputs = () => {
    if (!config.validation) return { errors: [], warnings: [], info: [] };
    
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: string[] = [];
    
    config.validation.rules.forEach(rule => {
      // This is a simplified validation - you'd implement actual field checking
      // based on the rule.field and rule.condition
      const fieldValue = getNestedValue(inputs, rule.field);
      if (rule.condition(fieldValue, inputs)) {
        switch (rule.type) {
          case 'error':
            errors.push(rule.message);
            break;
          case 'warning':
            warnings.push(rule.message);
            break;
          case 'info':
            info.push(rule.message);
            break;
        }
      }
    });
    
    return { errors, warnings, info };
  };

  const autoValidation = config.validation ? validateInputs() : undefined;
  const finalValidation = validation || autoValidation;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={className}
    >
      <SectionContainer
        title={config.title}
        subtitle={config.subtitle}
        icon={config.icon}
        showAdvanced={showAdvanced}
        onToggleAdvanced={handleToggleAdvanced}
        theme={config.theme}
        headerActions={headerActions}
      >
        {/* Metric Overview */}
        {config.showMetricOverview && metrics.length > 0 && (
          <MetricOverview metrics={metrics} className="mb-6" />
        )}

        {/* Validation Messages */}
        {finalValidation && (
          <div className="space-y-2">
            {finalValidation.errors.map((error, index) => (
              <ValidationMessage
                key={`error-${index}`}
                type="error"
                message={error}
              />
            ))}
            {finalValidation.warnings.map((warning, index) => (
              <ValidationMessage
                key={`warning-${index}`}
                type="warning"
                message={warning}
              />
            ))}
            {finalValidation.info.map((info, index) => (
              <ValidationMessage
                key={`info-${index}`}
                type="info"
                message={info}
              />
            ))}
          </div>
        )}

        {/* Section Content */}
        {children}
      </SectionContainer>
    </motion.div>
  );
}

// Utility function to get nested values from objects
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Helper component for creating consistent section layouts
interface SectionLayoutProps {
  basicContent: React.ReactNode;
  advancedContent: React.ReactNode;
  showAdvanced: boolean;
  basicColumns?: 1 | 2 | 3 | 4;
  advancedColumns?: 1 | 2 | 3 | 4;
}

export function SectionLayout({
  basicContent,
  advancedContent,
  showAdvanced,
  basicColumns = 2,
  advancedColumns = 2
}: SectionLayoutProps) {
  return (
    <div className="space-y-6">
      <BasicView visible={true}>
        <FormGrid columns={basicColumns}>
          {basicContent}
        </FormGrid>
      </BasicView>
      
      <AdvancedView visible={showAdvanced}>
        <FormGrid columns={advancedColumns}>
          {advancedContent}
        </FormGrid>
      </AdvancedView>
    </div>
  );
}

// Preset section configurations
export const sectionConfigs: Record<string, SectionConfig> = {
  demographics: {
    id: 'demographics',
    title: 'Demographics & Population',
    subtitle: 'Population distribution, age groups, and social characteristics',
    theme: 'gold',
    showMetricOverview: true,
    validation: {
      rules: [
        {
          field: 'demographics.lifeExpectancy',
          condition: (value) => value < 60,
          message: 'Life expectancy below 60 years may indicate health system challenges',
          type: 'warning'
        },
        {
          field: 'demographics.literacyRate',
          condition: (value) => value < 70,
          message: 'Literacy rates below 70% may limit economic development potential',
          type: 'warning'
        }
      ]
    }
  },
  
  fiscal: {
    id: 'fiscal',
    title: 'Fiscal System & Taxation',
    subtitle: 'Government revenue, taxation, spending, and debt management',
    theme: 'blue',
    showMetricOverview: true,
    validation: {
      rules: [
        {
          field: 'fiscalSystem.budgetDeficitSurplus',
          condition: (value, inputs) => {
            const gdp = inputs.coreIndicators.nominalGDP;
            return gdp > 0 && (value / gdp) < -0.05; // Deficit > 5% of GDP
          },
          message: 'Budget deficit exceeds 5% of GDP - consider fiscal consolidation',
          type: 'warning'
        },
        {
          field: 'fiscalSystem.totalDebtGDPRatio',
          condition: (value) => value > 90,
          message: 'Public debt exceeds 90% of GDP - high debt burden',
          type: 'error'
        }
      ]
    }
  },
  
  labor: {
    id: 'labor',
    title: 'Labor & Employment',
    subtitle: 'Workforce dynamics, employment rates, and income distribution',
    theme: 'indigo',
    showMetricOverview: true,
    validation: {
      rules: [
        {
          field: 'laborEmployment.unemploymentRate',
          condition: (value) => value > 15,
          message: 'Unemployment rate above 15% indicates severe labor market distress',
          type: 'error'
        },
        {
          field: 'laborEmployment.minimumWage',
          condition: (value, inputs) => {
            const avgIncome = inputs.laborEmployment.averageAnnualIncome;
            return value > 0 && avgIncome > 0 && (value * 2000) > (avgIncome * 0.6);
          },
          message: 'Minimum wage appears high relative to average income',
          type: 'warning'
        }
      ]
    }
  },
  
  government: {
    id: 'government',
    title: 'Government Spending',
    subtitle: 'Budget allocation across sectors and public services',
    theme: 'red',
    showMetricOverview: true
  },
  
  symbols: {
    id: 'symbols',
    title: 'National Symbols',
    subtitle: 'Flag, coat of arms, and national identity elements',
    theme: 'neutral',
    showMetricOverview: false
  }
};

// Export utility functions for sections to use
export const sectionUtils = {
  formatNumber: (num: number, precision = 1): string => {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    if (Math.abs(num) >= 1e12) return `${(num / 1e12).toFixed(precision)}T`;
    if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(precision)}B`;
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(precision)}K`;
    return num.toFixed(precision);
  },
  
  formatPercentage: (num: number, precision = 1): string => {
    return `${num.toFixed(precision)}%`;
  },
  
  formatCurrency: (num: number, currency = '$', precision = 0): string => {
    return `${currency}${sectionUtils.formatNumber(num, precision)}`;
  },
  
  clampValue: (value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max);
  },
  
  calculatePopulationInGroup: (percentage: number, totalPopulation: number): number => {
    return Math.round(totalPopulation * (percentage / 100));
  }
};