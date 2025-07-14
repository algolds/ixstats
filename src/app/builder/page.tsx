// src/app/economy/page.tsx
"use client";

import { useState, useEffect } from "react";
import { CountrySelector } from "./components/CountrySelector";
import { EconomicInputForm } from "./components/EconomicInputForm";
import { EconomicPreview } from "./components/EconomicPreview";
import type { RealCountryData, EconomicInputs } from "./lib/economy-data-service";
import { parseEconomyData, createDefaultEconomicInputs, saveBaselineToStorage } from "./lib/economy-data-service";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";

type BuilderPhase = 'select' | 'customize' | 'preview';

export default function CreateCountryBuilder() {
  const [currentPhase, setCurrentPhase] = useState<BuilderPhase>('select');
  const [allCountries, setAllCountries] = useState<RealCountryData[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<RealCountryData | null>(null);
  const [economicInputs, setEconomicInputs] = useState<EconomicInputs | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const countries = await parseEconomyData();
        setAllCountries(countries);
      } catch (error) {
        console.error('Failed to load country data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCountry) {
      const defaultInputs = createDefaultEconomicInputs(selectedCountry);
      setEconomicInputs(defaultInputs);
    }
  }, [selectedCountry]);

  const handleCountrySelect = (country: RealCountryData) => {
    setSelectedCountry(country);
    setCurrentPhase('customize');
  };

  const handleInputsChange = (newInputs: EconomicInputs) => setEconomicInputs(newInputs);
  const handlePreview = () => setCurrentPhase('preview');
  const handleBack = () => {
    if (currentPhase === 'customize') setCurrentPhase('select');
    else if (currentPhase === 'preview') setCurrentPhase('customize');
  };

  const handleConfirmBaseline = () => {
    if (economicInputs) {
      saveBaselineToStorage(economicInputs);
      alert(`${economicInputs.countryName} has been created successfully! You can now use it in the campaign.`);
      // Could redirect to countries list or dashboard here
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-brand-primary)] mx-auto mb-4"></div>
          <p className="text-[var(--color-text-muted)]">Loading country builder...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SignedIn>
        <div className="min-h-screen bg-[var(--color-bg-primary)]">
          <div className="container mx-auto">
            {currentPhase === 'select' && (
              <div>
                <div className="text-center py-8">
                  <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
                    Create a Country
                  </h1>
                  <p className="text-[var(--color-text-muted)] text-lg">
                    Build a custom nation for your campaign using real-world economic data as a foundation
                  </p>
                </div>
                <CountrySelector
                  countries={allCountries}
                  onCountrySelect={handleCountrySelect}
                  selectedCountry={selectedCountry}
                />
              </div>
            )}

            {currentPhase === 'customize' && selectedCountry && economicInputs && (
              <EconomicInputForm
                inputs={economicInputs}
                referenceCountry={selectedCountry}
                onInputsChange={handleInputsChange}
                onPreview={handlePreview}
                onBack={handleBack}
              />
            )}

            {currentPhase === 'preview' && selectedCountry && economicInputs && (
              <EconomicPreview
                inputs={economicInputs}
                referenceCountry={selectedCountry}
                allCountries={allCountries}
                onBack={handleBack}
                onConfirm={handleConfirmBaseline}
              />
            )}
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <SignInButton mode="modal" />
        </div>
      </SignedOut>
    </>
  );
}

