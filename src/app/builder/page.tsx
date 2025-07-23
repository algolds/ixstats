"use client";
export const dynamic = 'force-dynamic';
// src/app/economy/page.tsx

import { useState, useEffect } from "react";
import { CountrySelector } from "./components/CountrySelector";
import { EconomicInputForm } from "./components/EconomicInputForm";
import { EconomicPreview } from "./components/EconomicPreview";
import type { RealCountryData, EconomicInputs } from "./lib/economy-data-service";
import { parseEconomyData, createDefaultEconomicInputs, saveBaselineToStorage } from "./lib/economy-data-service";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

type BuilderPhase = 'select' | 'customize' | 'preview';

export default function CreateCountryBuilder() {
  const { user } = useUser();
  const router = useRouter();
  const [currentPhase, setCurrentPhase] = useState<BuilderPhase>('select');
  const [allCountries, setAllCountries] = useState<RealCountryData[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<RealCountryData | null>(null);
  const [economicInputs, setEconomicInputs] = useState<EconomicInputs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // TRPC mutations
  const createCountryMutation = api.users.createCountry.useMutation();
  const linkCountryMutation = api.users.linkCountry.useMutation();

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

  const handleConfirmBaseline = async () => {
    if (!economicInputs || !user?.id) return;
    
    setIsCreating(true);
    try {
      // Create the country in the database with the built economic data
      const result = await createCountryMutation.mutateAsync({
        userId: user.id,
        countryName: economicInputs.countryName,
        economicData: {
          baselinePopulation: economicInputs.population,
          baselineGdpPerCapita: economicInputs.gdpPerCapita,
          populationGrowthRate: economicInputs.populationGrowthRate,
          realGDPGrowthRate: economicInputs.gdpGrowthRate,
          inflationRate: economicInputs.inflationRate,
          unemploymentRate: economicInputs.unemploymentRate,
          // Add any other economic data fields from economicInputs
        }
      });

      // Save to local storage as well for backup
      saveBaselineToStorage(economicInputs);
      
      // Redirect to the newly created country
      router.push(`/mycountry`);
    } catch (error) {
      console.error('Failed to create country:', error);
      alert(`Failed to create ${economicInputs.countryName}. Please try again.`);
    } finally {
      setIsCreating(false);
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
                isCreating={isCreating}
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

