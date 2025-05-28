// src/app/economy/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Globe, DollarSign, Users, TrendingUp, Building, AlertCircle } from "lucide-react";
import { CountrySelector } from "./components/CountrySelector";
import { EconomicInputForm } from "./components/EconomicInputForm";
import { EconomicPreview } from "./components/EconomicPreview";
import { parseEconomyData, type RealCountryData, type EconomicInputs } from "./lib/economy-data-service";

export default function EconomyPage() {
  const [realCountryData, setRealCountryData] = useState<RealCountryData[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<RealCountryData | null>(null);
  const [economicInputs, setEconomicInputs] = useState<EconomicInputs>({
    countryName: "",
    population: 0,
    gdpPerCapita: 0,
    taxRevenuePercent: 0,
    unemploymentRate: 0,
    governmentBudgetPercent: 0,
    internalDebtPercent: 0,
    externalDebtPercent: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [currentPhase, setCurrentPhase] = useState<'select' | 'input' | 'preview'>('select');

  // Load economy data on component mount
  useEffect(() => {
    const loadEconomyData = async () => {
      try {
        setIsLoading(true);
        const data = await parseEconomyData();
        setRealCountryData(data);
      } catch (error) {
        console.error("Failed to load economy data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEconomyData();
  }, []);

  const handleCountrySelect = (country: RealCountryData) => {
    setSelectedCountry(country);
    // Pre-populate inputs with selected country's data
    setEconomicInputs({
      countryName: `New ${country.name}`,
      population: Math.round(country.gdp / country.gdpPerCapita), // Calculate population
      gdpPerCapita: country.gdpPerCapita,
      taxRevenuePercent: country.taxRevenuePercent,
      unemploymentRate: country.unemploymentRate,
      governmentBudgetPercent: country.taxRevenuePercent, // Default assumption
      internalDebtPercent: 60, // Default assumption
      externalDebtPercent: 30, // Default assumption
    });
    setCurrentPhase('input');
  };

  const handleInputsChange = (newInputs: EconomicInputs) => {
    setEconomicInputs(newInputs);
  };

  const handlePreview = () => {
    setCurrentPhase('preview');
  };

  const handleBack = () => {
    if (currentPhase === 'preview') {
      setCurrentPhase('input');
    } else if (currentPhase === 'input') {
      setCurrentPhase('select');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">Loading economic data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Building className="h-8 w-8 mr-3 text-indigo-600 dark:text-indigo-400" />
            IxEconomy Builder
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Create and model your nation's economic system using real-world data as reference
          </p>
        </div>

        {/* Phase Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            {[
              { phase: 'select', label: 'Select Reference', icon: Globe },
              { phase: 'input', label: 'Economic Inputs', icon: DollarSign },
              { phase: 'preview', label: 'Preview & Compare', icon: TrendingUp },
            ].map(({ phase, label, icon: Icon }, index) => {
              const isActive = currentPhase === phase;
              const isCompleted = 
                (phase === 'select' && selectedCountry) ||
                (phase === 'input' && currentPhase === 'preview');
              
              return (
                <div key={phase} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    isActive 
                      ? 'border-indigo-600 bg-indigo-600 text-white' 
                      : isCompleted
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    isActive || isCompleted 
                      ? 'text-gray-900 dark:text-white' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {label}
                  </span>
                  {index < 2 && (
                    <div className={`w-16 h-0.5 mx-4 ${
                      isCompleted ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          {currentPhase === 'select' && (
            <CountrySelector
              countries={realCountryData}
              onCountrySelect={handleCountrySelect}
              selectedCountry={selectedCountry}
            />
          )}

          {currentPhase === 'input' && selectedCountry && (
            <EconomicInputForm
              inputs={economicInputs}
              referenceCountry={selectedCountry}
              onInputsChange={handleInputsChange}
              onPreview={handlePreview}
              onBack={handleBack}
            />
          )}

          {currentPhase === 'preview' && selectedCountry && (
            <EconomicPreview
              inputs={economicInputs}
              referenceCountry={selectedCountry}
              allCountries={realCountryData}
              onBack={handleBack}
              onConfirm={() => {
                // Phase 2 will handle baseline confirmation
                console.log('Baseline confirmed:', economicInputs);
                alert('Baseline confirmation will be implemented in Phase 2!');
              }}
            />
          )}
        </div>

        {/* Info Panel */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                IxEconomy Builder - Phase 1
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                This is a mockup of the economic modeling system. Select a reference country to base your 
                nation's economy on, then customize the economic parameters to fit your world.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}