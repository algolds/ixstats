// src/app/economy/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Globe, DollarSign, Users, TrendingUp, Building, AlertCircle, Loader2, Info, Settings } from "lucide-react";
import { CountrySelector } from "./components/CountrySelector";
import { EnhancedEconomicInputForm } from "./components/EnhancedEconomicInputForm";
import { EnhancedEconomicPreview } from "./components/EnhancedEconomicPreview";
import { parseEconomyData, type RealCountryData, saveBaselineToStorage, loadBaselineFromStorage } from "./lib/economy-data-service";
import type { EnhancedEconomicInputs, TaxBracket, CorporateTaxTier, ExciseTaxRates, GovernmentSpending } from "./lib/enhanced-economic-types";

type EconomyPhase = 'select' | 'input' | 'preview';

export default function EnhancedEconomyPage() {
  const [realCountryData, setRealCountryData] = useState<RealCountryData[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<RealCountryData | null>(null);
  const [economicInputs, setEconomicInputs] = useState<EnhancedEconomicInputs>({
    // Base fields
    countryName: "",
    population: 0,
    gdpPerCapita: 0,
    taxRevenuePercent: 10,
    unemploymentRate: 5,
    governmentBudgetPercent: 20,
    internalDebtPercent: 60,
    externalDebtPercent: 30,

    // Core Economic Indicators
    realGDPGrowthRate: 0.025,
    inflationRate: 0.02,
    currencyExchangeRate: 1.0,
    baseCurrency: 'USD',

    // Labor & Employment
    laborForceParticipationRate: 65,
    employmentRate: 95,
    totalWorkforce: 0,
    averageWorkweekHours: 40,
    minimumWage: 7.25,
    averageAnnualIncome: 0,

    // Fiscal System - Revenue
    governmentRevenueTotal: 0,
    taxRevenuePerCapita: 0,
    
    // Tax Rates (defaults)
    personalIncomeTaxRates: [
      { minIncome: 0, maxIncome: 10000, rate: 0.10 },
      { minIncome: 10000, maxIncome: 40000, rate: 0.22 },
      { minIncome: 40000, maxIncome: 85000, rate: 0.24 },
      { minIncome: 85000, maxIncome: null, rate: 0.32 }
    ] as TaxBracket[],
    corporateTaxRates: [
      { revenueThreshold: 0, rate: 0.15, description: 'Small Business' },
      { revenueThreshold: 50000, rate: 0.21, description: 'Standard Rate' },
      { revenueThreshold: 10000000, rate: 0.25, description: 'Large Corporation' }
    ] as CorporateTaxTier[],
    salesTaxRate: 8.5,
    propertyTaxRate: 1.2,
    payrollTaxRate: 15.3,
    exciseTaxRates: {
      alcohol: 2.5,
      tobacco: 15.0,
      fuel: 0.5,
      luxuryGoods: 10.0,
      environmentalTax: 5.0
    } as ExciseTaxRates,
    wealthTaxRate: 0.5,

    // Government Spending
    budgetDeficitSurplus: 0,
    governmentSpendingBreakdown: {
      defense: 15,
      education: 20,
      healthcare: 18,
      infrastructure: 12,
      socialServices: 15,
      administration: 8,
      diplomatic: 3,
      justice: 5
    } as GovernmentSpending
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [currentPhase, setCurrentPhase] = useState<EconomyPhase>('select');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await parseEconomyData();
        setRealCountryData(data);

        // Try to load saved baseline
        const savedBaseline = loadBaselineFromStorage();
        if (savedBaseline) {
          // Convert legacy baseline to enhanced format
          const enhancedInputs: EnhancedEconomicInputs = {
            ...economicInputs,
            ...savedBaseline,
            // Ensure enhanced fields exist
            realGDPGrowthRate: economicInputs.realGDPGrowthRate,
            inflationRate: economicInputs.inflationRate,
            currencyExchangeRate: economicInputs.currencyExchangeRate,
            baseCurrency: economicInputs.baseCurrency,
            laborForceParticipationRate: economicInputs.laborForceParticipationRate,
            employmentRate: 100 - savedBaseline.unemploymentRate,
            totalWorkforce: Math.round(savedBaseline.population * 0.65 * 0.95),
            averageWorkweekHours: economicInputs.averageWorkweekHours,
            minimumWage: economicInputs.minimumWage,
            averageAnnualIncome: savedBaseline.gdpPerCapita * 0.8,
            governmentRevenueTotal: 0,
            taxRevenuePerCapita: 0,
            personalIncomeTaxRates: economicInputs.personalIncomeTaxRates,
            corporateTaxRates: economicInputs.corporateTaxRates,
            salesTaxRate: economicInputs.salesTaxRate,
            propertyTaxRate: economicInputs.propertyTaxRate,
            payrollTaxRate: economicInputs.payrollTaxRate,
            exciseTaxRates: economicInputs.exciseTaxRates,
            wealthTaxRate: economicInputs.wealthTaxRate,
            budgetDeficitSurplus: 0,
            governmentSpendingBreakdown: economicInputs.governmentSpendingBreakdown
          };
          
          setEconomicInputs(enhancedInputs);
          
          // Try to find the reference country
          const refCountryName = savedBaseline.countryName.startsWith("New ") 
            ? savedBaseline.countryName.substring(4) 
            : null;
          const refCountry = refCountryName ? data.find(c => c.name === refCountryName) : null;
          if (refCountry) {
            setSelectedCountry(refCountry);
          }
          setCurrentPhase('preview');
        }

      } catch (e) {
        console.error("Failed to load economy data:", e);
        setError(e instanceof Error ? e.message : "An unknown error occurred while loading data.");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleCountrySelect = (country: RealCountryData) => {
    setSelectedCountry(country);
    
    // Create enhanced inputs based on country data
    const newInputs: EnhancedEconomicInputs = {
      ...economicInputs,
      countryName: `New ${country.name}`,
      population: country.population,
      gdpPerCapita: country.gdpPerCapita,
      taxRevenuePercent: country.taxRevenuePercent,
      unemploymentRate: country.unemploymentRate,
      governmentBudgetPercent: Math.min(country.taxRevenuePercent * 1.2, 40),
      
      // Enhanced defaults based on country tier
      realGDPGrowthRate: country.gdpPerCapita > 50000 ? 0.02 : country.gdpPerCapita > 25000 ? 0.025 : 0.04,
      inflationRate: 0.02,
      currencyExchangeRate: 1.0,
      baseCurrency: 'USD',
      
      // Labor estimates based on country data
      laborForceParticipationRate: country.gdpPerCapita > 40000 ? 70 : 65,
      employmentRate: 100 - country.unemploymentRate,
      totalWorkforce: Math.round(country.population * 0.65 * (1 - country.unemploymentRate / 100)),
      averageWorkweekHours: country.gdpPerCapita > 50000 ? 38 : 40,
      minimumWage: Math.max(3, country.gdpPerCapita / 5000),
      averageAnnualIncome: country.gdpPerCapita * 0.75,
      
      // Fiscal estimates
      governmentRevenueTotal: (country.population * country.gdpPerCapita * country.taxRevenuePercent) / 100,
      taxRevenuePerCapita: (country.gdpPerCapita * country.taxRevenuePercent) / 100,
      
      // Tax system based on development level
      salesTaxRate: country.gdpPerCapita > 40000 ? 6 : 10,
      propertyTaxRate: country.gdpPerCapita > 40000 ? 1.5 : 0.8,
      payrollTaxRate: country.gdpPerCapita > 40000 ? 18 : 12,
      
      // Government spending based on development
      governmentSpendingBreakdown: {
        defense: country.gdpPerCapita > 40000 ? 12 : 18,
        education: country.gdpPerCapita > 40000 ? 22 : 16,
        healthcare: country.gdpPerCapita > 40000 ? 20 : 12,
        infrastructure: country.gdpPerCapita > 40000 ? 10 : 18,
        socialServices: country.gdpPerCapita > 40000 ? 18 : 8,
        administration: 8,
        diplomatic: country.gdpPerCapita > 40000 ? 4 : 2,
        justice: country.gdpPerCapita > 40000 ? 6 : 4
      }
    };
    
    setEconomicInputs(newInputs);
    setCurrentPhase('input');
  };

  const handleInputsChange = (newInputs: EnhancedEconomicInputs) => {
    setEconomicInputs(newInputs);
  };

  const handlePreview = () => setCurrentPhase('preview');
  
  const handleBack = () => {
    if (currentPhase === 'preview') setCurrentPhase('input');
    else if (currentPhase === 'input') setCurrentPhase('select');
  };
  
  const handleConfirmBaseline = () => {
    // Convert enhanced inputs to legacy format for storage compatibility
    const legacyInputs = {
      countryName: economicInputs.countryName,
      population: economicInputs.population,
      gdpPerCapita: economicInputs.gdpPerCapita,
      taxRevenuePercent: economicInputs.taxRevenuePercent,
      unemploymentRate: economicInputs.unemploymentRate,
      governmentBudgetPercent: economicInputs.governmentBudgetPercent,
      internalDebtPercent: economicInputs.internalDebtPercent,
      externalDebtPercent: economicInputs.externalDebtPercent,
    };
    
    saveBaselineToStorage(legacyInputs);
    
    // Also save enhanced data to separate storage
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('ixeconomy_enhanced_baseline', JSON.stringify({
          ...economicInputs,
          timestamp: Date.now(),
        }));
      }
    } catch (error) {
      console.error('Failed to save enhanced baseline:', error);
    }
    
    alert(`${economicInputs.countryName} comprehensive economic model saved! Ready for IxStats integration.`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-[var(--color-brand-primary)] animate-spin mx-auto" />
          <p className="mt-4 text-lg text-[var(--color-text-secondary)]">Loading Economic Data...</p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Preparing enhanced economy builder</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
        <div className="card text-center max-w-md">
          <div className="p-6">
            <AlertCircle className="h-12 w-12 text-[var(--color-error)] mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Error Loading Data</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="btn-primary">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const phases = [
    { phase: 'select', label: 'Select Reference', icon: Globe, description: 'Choose baseline country' },
    { phase: 'input', label: 'Economic Model', icon: Settings, description: 'Build comprehensive economy' },
    { phase: 'preview', label: 'Review & Compare', icon: TrendingUp, description: 'Finalize and compare' },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] flex items-center justify-center">
            <Building className="h-8 w-8 mr-3 text-[var(--color-brand-primary)]" />
            IxEconomy Builder <span className="text-lg text-[var(--color-brand-secondary)] ml-2">Enhanced</span>
          </h1>
          <p className="mt-2 text-[var(--color-text-muted)] max-w-3xl mx-auto">
            Create comprehensive economic models with advanced subsystems including core indicators, 
            labor markets, and fiscal policy. Build realistic economies for your IxStats nations.
          </p>
        </div>

        {/* Enhanced Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center max-w-4xl mx-auto">
            {phases.map((p, index) => {
              const isActive = currentPhase === p.phase;
              const isCompleted = 
                (p.phase === 'select' && (currentPhase === 'input' || currentPhase === 'preview')) ||
                (p.phase === 'input' && currentPhase === 'preview');
              const Icon = p.icon;
              
              return (
                <div key={p.phase} className={`flex items-center ${index < phases.length - 1 ? 'flex-1' : ''}`}>
                  <div className={`flex flex-col items-center ${isActive ? 'text-[var(--color-brand-primary)]' : isCompleted ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`}>
                    <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${
                      isActive ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white scale-110' 
                               : isCompleted ? 'border-[var(--color-success)] bg-[var(--color-success)] text-white' 
                               : 'border-[var(--color-border-secondary)]'
                    }`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="mt-3 text-center">
                      <span className="text-sm font-medium block">{p.label}</span>
                      <span className="text-xs opacity-75 block">{p.description}</span>
                    </div>
                  </div>
                  {index < phases.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-4 transition-colors duration-300 ${isCompleted ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border-secondary)]'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          {currentPhase === 'select' && (
            <CountrySelector
              countries={realCountryData}
              onCountrySelect={handleCountrySelect}
              selectedCountry={selectedCountry}
            />
          )}
          {currentPhase === 'input' && selectedCountry && (
            <EnhancedEconomicInputForm
              inputs={economicInputs}
              referenceCountry={selectedCountry}
              allCountries={realCountryData}
              onInputsChange={handleInputsChange}
              onPreview={handlePreview}
              onBack={handleBack}
            />
          )}
          {currentPhase === 'preview' && selectedCountry && (
            <EnhancedEconomicPreview
              inputs={economicInputs}
              referenceCountry={selectedCountry}
              allCountries={realCountryData}
              onBack={handleBack}
              onConfirm={handleConfirmBaseline}
            />
          )}
        </div>

        {/* Enhanced Info Panel */}
        <div className="mt-6 p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-[var(--color-info)] mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Enhanced IxEconomy Builder
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                This advanced version includes comprehensive economic modeling with rich data entry interfaces:
                sliding scales for tax rates, interactive charts for government spending, bar graphs for labor statistics, 
                and real-time economic health scoring. All models integrate seamlessly with the IxTime system and provide 
                intelligent hints based on real-world country comparisons.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}