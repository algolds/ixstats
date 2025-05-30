// src/app/economy/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Globe, DollarSign, Users, TrendingUp, Building, AlertCircle, Loader2, Info } from "lucide-react";
import { CountrySelector } from "./components/CountrySelector";
import { EconomicInputForm } from "./components/EconomicInputForm";
import { EconomicPreview } from "./components/EconomicPreview";
import { 
  parseEconomyData, 
  type RealCountryData, 
  type EconomicInputs, 
  saveBaselineToStorage, 
  loadBaselineFromStorage,
  createDefaultEconomicInputs
} from "./lib/economy-data-service";

type EconomyPhase = 'select' | 'input' | 'preview';

export default function EconomyPage() {
  const [realCountryData, setRealCountryData] = useState<RealCountryData[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<RealCountryData | null>(null);
  const [economicInputs, setEconomicInputs] = useState<EconomicInputs>(createDefaultEconomicInputs());
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
            setEconomicInputs(savedBaseline);
            // Try to find the reference country if its name is stored or derivable
            const refCountryName = savedBaseline.countryName.startsWith("New ") ? savedBaseline.countryName.substring(4) : null;
            const refCountry = refCountryName ? data.find(c => c.name === refCountryName) : null;
            if (refCountry) {
                setSelectedCountry(refCountry);
            }
            setCurrentPhase('preview'); // Go directly to preview if baseline loaded
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
    setEconomicInputs(createDefaultEconomicInputs(country));
    setCurrentPhase('input');
  };

  const handleInputsChange = (newInputs: EconomicInputs) => setEconomicInputs(newInputs);
  const handlePreview = () => setCurrentPhase('preview');
  const handleBack = () => {
    if (currentPhase === 'preview') setCurrentPhase('input');
    else if (currentPhase === 'input') setCurrentPhase('select');
  };
  
  const handleConfirmBaseline = () => {
    saveBaselineToStorage(economicInputs);
    // Here you would typically navigate to the next step or save to DB
    alert(`${economicInputs.countryName} baseline saved! (Locally for now)`);
    // Potentially, navigate or enable next features:
    // router.push(`/dm-dashboard?country=${economicInputs.countryName}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-[var(--color-brand-primary)] animate-spin mx-auto" />
          <p className="mt-4 text-lg text-[var(--color-text-secondary)]">Loading Economic Data...</p>
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
    { phase: 'select', label: 'Select Reference', icon: Globe },
    { phase: 'input', label: 'Economic Framework', icon: DollarSign },
    { phase: 'preview', label: 'Preview & Compare', icon: TrendingUp },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] flex items-center justify-center">
            <Building className="h-8 w-8 mr-3 text-[var(--color-brand-primary)]" />
            IxEconomy Builder
          </h1>
          <p className="mt-2 text-[var(--color-text-muted)]">
            Create a comprehensive economic framework using real-world data as a foundation.
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-around max-w-2xl mx-auto">
            {phases.map((p, index) => {
              const isActive = currentPhase === p.phase;
              const isCompleted = 
                (p.phase === 'select' && (currentPhase === 'input' || currentPhase === 'preview')) ||
                (p.phase === 'input' && currentPhase === 'preview');
              const Icon = p.icon;
              
              return (
                <div key={p.phase} className={`flex items-center ${index < phases.length -1 ? 'flex-1' : ''}`}>
                  <div className={`flex flex-col items-center ${isActive ? 'text-[var(--color-brand-primary)]' : isCompleted ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`}>
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300
                      ${isActive ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white' 
                               : isCompleted ? 'border-[var(--color-success)] bg-[var(--color-success)] text-white' 
                               : 'border-[var(--color-border-secondary)]'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="mt-2 text-xs font-medium text-center">{p.label}</span>
                  </div>
                  {index < phases.length -1 && (
                    <div className={`h-0.5 flex-1 mx-2 transition-colors duration-300 ${isCompleted ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border-secondary)]'}`} />
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
              onConfirm={handleConfirmBaseline}
            />
          )}
        </div>

        <div className="mt-6 p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-[var(--color-info)] mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Enhanced IxEconomy Builder
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                This comprehensive tool establishes a complete economic framework covering core indicators, labor markets, and fiscal systems. 
                The framework integrates with the broader IxStats ecosystem for simulations and DM management. 
                All data is currently saved locally to your browser.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
