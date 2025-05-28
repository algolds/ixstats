// src/app/economy/components/EconomicInputForm.tsx
"use client";

import { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Eye, 
  Users, 
  DollarSign, 
  Percent, 
  TrendingDown, 
  Building, 
  CreditCard,
  AlertCircle,
  Info,
  CheckCircle
} from "lucide-react";
import type { EconomicInputs, RealCountryData } from "../lib/economy-data-service";
import { getEconomicTier } from "../lib/economy-data-service";

interface EconomicInputFormProps {
  inputs: EconomicInputs;
  referenceCountry: RealCountryData;
  onInputsChange: (inputs: EconomicInputs) => void;
  onPreview: () => void;
  onBack: () => void;
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export function EconomicInputForm({ 
  inputs, 
  referenceCountry, 
  onInputsChange, 
  onPreview, 
  onBack 
}: EconomicInputFormProps) {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Validate inputs whenever they change
  useEffect(() => {
    validateInputs();
  }, [inputs]);

  const validateInputs = () => {
    const newErrors: ValidationError[] = [];

    // Country name validation
    if (!inputs.countryName.trim()) {
      newErrors.push({
        field: 'countryName',
        message: 'Country name is required',
        severity: 'error'
      });
    }

    // Population validation
    if (inputs.population <= 0) {
      newErrors.push({
        field: 'population',
        message: 'Population must be greater than 0',
        severity: 'error'
      });
    } else if (inputs.population < 1000) {
      newErrors.push({
        field: 'population',
        message: 'Very small population - consider if this is realistic for a nation',
        severity: 'warning'
      });
    } else if (inputs.population > 2000000000) {
      newErrors.push({
        field: 'population',
        message: 'Extremely large population - larger than any real country',
        severity: 'warning'
      });
    }

    // GDP per capita validation
    if (inputs.gdpPerCapita <= 0) {
      newErrors.push({
        field: 'gdpPerCapita',
        message: 'GDP per capita must be greater than 0',
        severity: 'error'
      });
    } else if (inputs.gdpPerCapita < 500) {
      newErrors.push({
        field: 'gdpPerCapita',
        message: 'Very low GDP per capita - indicates extreme poverty',
        severity: 'warning'
      });
    } else if (inputs.gdpPerCapita > 200000) {
      newErrors.push({
        field: 'gdpPerCapita',
        message: 'Extremely high GDP per capita - higher than any real country',
        severity: 'warning'
      });
    }

    // Tax revenue validation
    if (inputs.taxRevenuePercent < 0 || inputs.taxRevenuePercent > 100) {
      newErrors.push({
        field: 'taxRevenuePercent',
        message: 'Tax revenue must be between 0% and 100%',
        severity: 'error'
      });
    } else if (inputs.taxRevenuePercent > 50) {
      newErrors.push({
        field: 'taxRevenuePercent',
        message: 'Very high tax rate - may impact economic growth',
        severity: 'warning'
      });
    } else if (inputs.taxRevenuePercent < 5) {
      newErrors.push({
        field: 'taxRevenuePercent',
        message: 'Very low tax revenue - may limit government services',
        severity: 'warning'
      });
    }

    // Unemployment validation
    if (inputs.unemploymentRate < 0 || inputs.unemploymentRate > 100) {
      newErrors.push({
        field: 'unemploymentRate',
        message: 'Unemployment rate must be between 0% and 100%',
        severity: 'error'
      });
    } else if (inputs.unemploymentRate > 25) {
      newErrors.push({
        field: 'unemploymentRate',
        message: 'Very high unemployment - indicates economic crisis',
        severity: 'warning'
      });
    } else if (inputs.unemploymentRate < 1) {
      newErrors.push({
        field: 'unemploymentRate',
        message: 'Extremely low unemployment - may indicate labor shortages',
        severity: 'info'
      });
    }

    // Government budget validation
    if (inputs.governmentBudgetPercent < 0 || inputs.governmentBudgetPercent > 100) {
      newErrors.push({
        field: 'governmentBudgetPercent',
        message: 'Government budget must be between 0% and 100%',
        severity: 'error'
      });
    } else if (inputs.governmentBudgetPercent > 60) {
      newErrors.push({
        field: 'governmentBudgetPercent',
        message: 'Very large government sector - may crowd out private investment',
        severity: 'warning'
      });
    }

    // Debt validation
    if (inputs.internalDebtPercent < 0 || inputs.internalDebtPercent > 1000) {
      newErrors.push({
        field: 'internalDebtPercent',
        message: 'Internal debt must be between 0% and 1000% of GDP',
        severity: 'error'
      });
    } else if (inputs.internalDebtPercent > 200) {
      newErrors.push({
        field: 'internalDebtPercent',
        message: 'Very high internal debt - may pose fiscal risks',
        severity: 'warning'
      });
    }

    if (inputs.externalDebtPercent < 0 || inputs.externalDebtPercent > 1000) {
      newErrors.push({
        field: 'externalDebtPercent',
        message: 'External debt must be between 0% and 1000% of GDP',
        severity: 'error'
      });
    } else if (inputs.externalDebtPercent > 100) {
      newErrors.push({
        field: 'externalDebtPercent',
        message: 'High external debt - may create dependency on foreign creditors',
        severity: 'warning'
      });
    }

    setErrors(newErrors);
  };

  const handleInputChange = (field: keyof EconomicInputs, value: string | number) => {
    setIsDirty(true);
    onInputsChange({
      ...inputs,
      [field]: value
    });
  };

  const getFieldError = (field: string) => {
    return errors.find(error => error.field === field);
  };

  const hasErrors = errors.some(error => error.severity === 'error');
  const canPreview = !hasErrors && inputs.countryName.trim();

  const calculateTotalGDP = () => {
    return (inputs.population * inputs.gdpPerCapita) / 1e9; // In billions
  };

  const calculateTaxRevenue = () => {
    return (calculateTotalGDP() * inputs.taxRevenuePercent) / 100;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  const inputFields = [
    {
      key: 'countryName' as keyof EconomicInputs,
      label: 'Country Name',
      icon: Building,
      type: 'text',
      placeholder: 'Enter your nation\'s name',
      help: 'Choose a unique name for your nation'
    },
    {
      key: 'population' as keyof EconomicInputs,
      label: 'Population',
      icon: Users,
      type: 'number',
      placeholder: '50000000',
      help: 'Total number of citizens in your nation',
      reference: referenceCountry.population.toLocaleString()
    },
    {
      key: 'gdpPerCapita' as keyof EconomicInputs,
      label: 'GDP per Capita ($)',
      icon: DollarSign,
      type: 'number',
      placeholder: '25000',
      help: 'Average economic output per person per year',
      reference: `$${referenceCountry.gdpPerCapita.toLocaleString()}`
    },
    {
      key: 'taxRevenuePercent' as keyof EconomicInputs,
      label: 'Tax Revenue (% of GDP)',
      icon: Percent,
      type: 'number',
      step: '0.1',
      placeholder: '15.0',
      help: 'Government tax collection as percentage of total GDP',
      reference: `${referenceCountry.taxRevenuePercent.toFixed(1)}%`
    },
    {
      key: 'unemploymentRate' as keyof EconomicInputs,
      label: 'Unemployment Rate (%)',
      icon: TrendingDown,
      type: 'number',
      step: '0.1',
      placeholder: '5.0',
      help: 'Percentage of workforce actively seeking employment',
      reference: `${referenceCountry.unemploymentRate.toFixed(1)}%`
    },
    {
      key: 'governmentBudgetPercent' as keyof EconomicInputs,
      label: 'Government Budget (% of GDP)',
      icon: Building,
      type: 'number',
      step: '0.1',
      placeholder: '20.0',
      help: 'Total government spending as percentage of GDP'
    },
    {
      key: 'internalDebtPercent' as keyof EconomicInputs,
      label: 'Internal Debt (% of GDP)',
      icon: CreditCard,
      type: 'number',
      step: '0.1',
      placeholder: '60.0',
      help: 'Government debt owed to domestic creditors'
    },
    {
      key: 'externalDebtPercent' as keyof EconomicInputs,
      label: 'External Debt (% of GDP)',
      icon: CreditCard,
      type: 'number',
      step: '0.1',
      placeholder: '30.0',
      help: 'Government debt owed to foreign creditors'
    }
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Economic Parameters
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Customize your nation's economic indicators based on {referenceCountry.name}
          </p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Selection
        </button>
      </div>

      {/* Quick Stats Summary */}
      <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Live Economic Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Total GDP:</span>
            <div className="font-semibold text-gray-900 dark:text-white">
              {formatNumber(calculateTotalGDP() * 1e9)}
            </div>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Tax Revenue:</span>
            <div className="font-semibold text-gray-900 dark:text-white">
              {formatNumber(calculateTaxRevenue() * 1e9)}
            </div>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Economic Tier:</span>
            <div className="font-semibold text-gray-900 dark:text-white">
              {getEconomicTier(inputs.gdpPerCapita)}
            </div>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Total Debt:</span>
            <div className="font-semibold text-gray-900 dark:text-white">
              {(inputs.internalDebtPercent + inputs.externalDebtPercent).toFixed(1)}% GDP
            </div>
          </div>
        </div>
      </div>

      {/* Input Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {inputFields.map((field) => {
          const Icon = field.icon;
          const error = getFieldError(field.key);
          const value = inputs[field.key];
          
          return (
            <div key={field.key} className="space-y-2">
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                <Icon className="h-4 w-4 mr-2" />
                {field.label}
              </label>
              
              <div className="relative">
                <input
                  type={field.type}
                  step={field.step}
                  placeholder={field.placeholder}
                  value={value}
                  onChange={(e) => {
                    const newValue = field.type === 'number' 
                      ? parseFloat(e.target.value) || 0 
                      : e.target.value;
                    handleInputChange(field.key, newValue);
                  }}
                  className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 ${
                    error 
                      ? error.severity === 'error' 
                        ? 'border-red-500 dark:border-red-400' 
                        : 'border-yellow-500 dark:border-yellow-400'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {error && (
                  <div className="absolute -right-2 top-2">
                    {error.severity === 'error' ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : error.severity === 'warning' ? (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <Info className="h-5 w-5 text-blue-500" />
                    )}
                  </div>
                )}
              </div>

              {/* Help text and reference */}
              <div className="flex flex-col space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">{field.help}</p>
                {field.reference && (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400">
                    {referenceCountry.name}: {field.reference}
                  </p>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className={`text-xs flex items-center ${
                  error.severity === 'error' 
                    ? 'text-red-600 dark:text-red-400' 
                    : error.severity === 'warning'
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-blue-600 dark:text-blue-400'
                }`}>
                  {error.severity === 'error' ? (
                    <AlertCircle className="h-3 w-3 mr-1" />
                  ) : error.severity === 'warning' ? (
                    <AlertCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <Info className="h-3 w-3 mr-1" />
                  )}
                  {error.message}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
          {canPreview ? (
            <div className="flex items-center text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4 mr-1" />
              Ready for preview
            </div>
          ) : (
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {hasErrors ? 'Please fix errors before continuing' : 'Fill in all required fields'}
            </div>
          )}
        </div>
        
        <button
          onClick={onPreview}
          disabled={!canPreview}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Eye className="h-4 w-4 mr-2" />
          Preview & Compare
        </button>
      </div>
    </div>
  );
}